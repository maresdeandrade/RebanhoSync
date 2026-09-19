/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-c2-characterization",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { createGesture } from "../ops";
import { pullDataForFarm } from "../pull";
import {
  processGesture,
  recoverBlockedSanitarioV2Operations,
  recoverStaleSyncingGesturesOnce,
} from "../syncWorker";
import type { Gesture, Operation } from "../types";

const farmId = "10000000-0000-4000-8000-000000000001";
const txId = "50000000-0000-4000-8000-000000000001";
const opId = "60000000-0000-4000-8000-000000000001";

function gesture(overrides: Partial<Gesture> = {}): Gesture {
  return {
    client_tx_id: txId,
    fazenda_id: farmId,
    client_id: "client-c2",
    status: "PENDING",
    created_at: "2026-09-17T15:00:00.000Z",
    ...overrides,
  };
}

function operation(overrides: Partial<Operation> = {}): Operation {
  return {
    client_tx_id: txId,
    client_op_id: opId,
    table: "lotes",
    action: "INSERT",
    record: { id: "lote-c2", fazenda_id: farmId },
    sync_state: "PENDING",
    created_at: "2026-09-17T15:00:00.000Z",
    ...overrides,
  };
}

function appliedResponse(operationId = opId) {
  return new Response(
    JSON.stringify({ results: [{ op_id: operationId, status: "APPLIED" }] }),
    { status: 200 },
  );
}

async function seedGesture(opOverrides: Partial<Operation> = {}) {
  await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
    await db.queue_gestures.add(gesture());
    await db.queue_ops.add(operation(opOverrides));
  });
}

async function loadGesture() {
  const queued = await db.queue_gestures.get(txId);
  if (!queued) throw new Error("gesture not found");
  return queued;
}

describe("F24.2C2 worker concurrency characterization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await Promise.all([db.queue_gestures.clear(), db.queue_ops.clear()]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await Promise.all([db.queue_gestures.clear(), db.queue_ops.clear()]);
  });

  it("proves ACTIVE_CONCURRENCY_PATH_TO_SYNCING_ZERO is NOT_REPRODUCIBLE", async () => {
    await seedGesture();
    const initial = await loadGesture();

    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    // Two workers try to process the same gesture concurrently
    const workerA = processGesture(initial);
    const workerB = processGesture(initial);

    await Promise.all([workerA, workerB]);

    // Exactly one worker got the claim and executed fetch
    expect(fetch).toHaveBeenCalledTimes(1);

    // Gesture is DONE, never SYNCING + 0
    const finalGesture = await db.queue_gestures.get(txId);
    expect(finalGesture).toMatchObject({ status: "DONE" });
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);

    // Even if workerB tries again directly, it cannot overwrite DONE with SYNCING
    await processGesture(finalGesture!);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate requests and avoids PENDING without ops under concurrent execution", async () => {
    await seedGesture();
    const initial = await loadGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    await Promise.all([processGesture(initial), processGesture(initial)]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
    const afterRace = await loadGesture();
    expect(afterRace).toMatchObject({ status: "DONE" });
  });

  it("keeps DONE and removed ops when the post-ACK pull fails", async () => {
    await seedGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());
    vi.mocked(pullDataForFarm).mockRejectedValue(
      new Error("POST_ACK_PULL_INTERRUPTED"),
    );

    await processGesture(await loadGesture());

    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
  });

  it("characterizes the generic writer accepting an empty PENDING gesture", async () => {
    await createGesture(farmId, [], { clientTxId: txId, clientOpIds: [] });

    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
    });

    await processGesture(await loadGesture());
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  it("keeps later serial work pending while the first gesture fetch is unresolved", async () => {
    await seedGesture();
    const secondTxId = "50000000-0000-4000-8000-000000000002";
    const secondOpId = "60000000-0000-4000-8000-000000000002";
    await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
      await db.queue_gestures.add(
        gesture({
          client_tx_id: secondTxId,
          created_at: "2026-09-17T15:01:00.000Z",
        }),
      );
      await db.queue_ops.add(
        operation({
          client_tx_id: secondTxId,
          client_op_id: secondOpId,
          record: { id: "lote-c2-second", fazenda_id: farmId },
          created_at: "2026-09-17T15:01:00.000Z",
        }),
      );
    });

    let reportFetchStarted = () => undefined;
    let releaseFirstFetch = (_response: Response) => undefined;
    const fetchStarted = new Promise<void>((resolve) => {
      reportFetchStarted = resolve;
    });
    const firstFetch = new Promise<Response>((resolve) => {
      releaseFirstFetch = resolve;
    });
    vi.mocked(fetch)
      .mockImplementationOnce(async () => {
        reportFetchStarted();
        return firstFetch;
      })
      .mockResolvedValueOnce(appliedResponse(secondOpId));

    const firstProcessing = processGesture(await loadGesture());
    await fetchStarted;

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "SYNCING",
    });
    expect(await db.queue_gestures.get(secondTxId)).toMatchObject({
      status: "PENDING",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.queue_gestures.get(secondTxId)).toMatchObject({
      status: "PENDING",
    });

    releaseFirstFetch(appliedResponse());
    await firstProcessing;
    const secondGesture = await db.queue_gestures.get(secondTxId);
    if (!secondGesture) throw new Error("second gesture not found");
    await processGesture(secondGesture);
    expect(await db.queue_gestures.get(secondTxId)).toMatchObject({
      status: "DONE",
    });
  });

  it.each([
    ["REJECTED", "REJECTED", "REJECTED"],
    ["BLOCKED_DEPENDENCY", "ERROR", "ERROR"],
  ] as const)(
    "derives gesture %s-only as %s when processGesture is explicitly invoked",
    async (syncState, expectedStatus, expectedResult) => {
      await seedGesture({ sync_state: syncState });

      await processGesture(await loadGesture());

      expect(fetch).not.toHaveBeenCalled();
      expect(await db.queue_gestures.get(txId)).toMatchObject({
        status: expectedStatus,
        sync_result: expectedResult,
      });
      expect(await db.queue_ops.get(opId)).toMatchObject({
        sync_state: syncState,
      });
    },
  );

  it("recovers BLOCKED_DEPENDENCY before stale SYNCING recovery", async () => {
    await seedGesture({ sync_state: "BLOCKED_DEPENDENCY" });
    await db.queue_gestures.update(txId, { status: "SYNCING" });

    await expect(
      recoverBlockedSanitarioV2Operations("app_startup"),
    ).resolves.toBe(1);
    await expect(recoverStaleSyncingGesturesOnce()).resolves.toBe(0);

    expect(await db.queue_ops.get(opId)).toMatchObject({
      sync_state: "PENDING",
    });
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
    });
  });
});
