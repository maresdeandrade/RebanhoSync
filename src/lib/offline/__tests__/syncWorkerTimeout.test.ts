import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "timeout-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "test-owner" },
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
import { seedLocalOwner } from "./ownershipTestFixture";
import {
  processGesture,
  REQUEST_TIMEOUT_MS,
  stopSyncWorker,
} from "../syncWorker";
import type { Gesture, Operation } from "../types";

const farmId = "10000000-0000-4000-8000-000000000001";
const txId = "50000000-0000-4000-8000-000000000001";
const opId = "60000000-0000-4000-8000-000000000001";

function makeGesture(overrides: Partial<Gesture> = {}): Gesture {
  return {
    client_tx_id: txId,
    fazenda_id: farmId,
    client_id: "client-timeout",
    status: "PENDING",
    created_at: "2026-09-19T08:00:00.000Z",
    ...overrides,
  };
}

function makeOperation(): Operation {
  return {
    client_tx_id: txId,
    client_op_id: opId,
    table: "lotes",
    action: "INSERT",
    record: { id: "lote-timeout", fazenda_id: farmId },
    sync_state: "PENDING",
    created_at: "2026-09-19T08:00:00.000Z",
  };
}

async function seedGesture() {
  await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
    await db.queue_gestures.add(makeGesture());
    await db.queue_ops.add(makeOperation());
  });
}

async function loadGesture() {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error("gesture not found");
  return gesture;
}

describe("F24.2D1A — request timeout and worker liveness", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
    await seedLocalOwner("test-owner");
  });

  afterEach(async () => {
    stopSyncWorker();
    vi.restoreAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
  });

  it("T1/T5 — aborts a hung request and returns the gesture to retryable state", async () => {
    await seedGesture();
    const fetchStarted = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            fetchStarted(init?.signal);
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );

    const processing = processGesture(await loadGesture());
    await vi.waitFor(() => expect(fetchStarted).toHaveBeenCalledTimes(1));
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_TIMEOUT_MS + 100),
    );
    await processing;

    expect(fetchStarted.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      retry_count: 1,
    });
    expect(await db.queue_ops.get(opId)).toEqual(expect.objectContaining({
      client_op_id: opId,
    }));
  });

  it("T2/T3 — timeout preserves persisted identities and does not ACK", async () => {
    await seedGesture();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );

    const firstAttempt = processGesture(await loadGesture());
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_TIMEOUT_MS + 100),
    );
    await firstAttempt;

    const pending = await loadGesture();
    expect(pending.status).toBe("PENDING");
    expect(await db.queue_ops.get(opId)).toMatchObject({
      client_tx_id: txId,
      client_op_id: opId,
    });
    expect(pending.status).not.toBe("DONE");
  });

  it("T4 — stopSyncWorker aborts the active request without removing queue work", async () => {
    await seedGesture();
    let abortCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              abortCount += 1;
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );

    const processing = processGesture(await loadGesture());
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    stopSyncWorker();
    await processing;

    expect(abortCount).toBe(1);
    expect(await db.queue_ops.get(opId)).toBeDefined();
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
    });
  });

  it("T6 — a normal response before timeout preserves the ACK path", async () => {
    await seedGesture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ results: [{ op_id: opId, status: "APPLIED" }] }),
          { status: 200 },
        ),
      ),
    );

    await processGesture(await loadGesture());

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
    expect(await db.queue_ops.get(opId)).toBeUndefined();
  });
});
