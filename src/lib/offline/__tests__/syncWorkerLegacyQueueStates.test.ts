/**
 * F24.2D1D — Legacy queue state recovery (fail-closed): ambiguous persisted
 * states are classified without fabricating DONE and without factual replay.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "legacy-token",
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
import {
  processGesture,
  recoverErroredGesturesOnce,
  recoverStaleSyncingGesturesOnce,
} from "../syncWorker";
import type { Gesture, Operation } from "../types";

const farmId = "farm-legacy";
const LEGACY_EMPTY_QUEUE_ERROR =
  "Gesture sem operações enfileiradas; reconciliação manual necessária";

function makeGesture(overrides: Partial<Gesture>): Gesture {
  return {
    client_tx_id: "tx-legacy",
    fazenda_id: farmId,
    client_id: "client-legacy",
    status: "PENDING",
    created_at: "2026-09-19T12:00:00.000Z",
    ...overrides,
  };
}

function makeOperation(overrides: Partial<Operation>): Operation {
  return {
    client_tx_id: "tx-legacy",
    client_op_id: "op-legacy",
    table: "lotes",
    action: "INSERT",
    record: { id: "lote-legacy", fazenda_id: farmId },
    sync_state: "PENDING",
    created_at: "2026-09-19T12:00:00.000Z",
    ...overrides,
  };
}

async function seed(gesture: Gesture, operations: Operation[] = []) {
  await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
    await db.queue_gestures.add(gesture);
    for (const operation of operations) {
      await db.queue_ops.add(operation);
    }
  });
}

async function loadGesture(txId: string) {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error("gesture not found");
  return gesture;
}

describe("F24.2D1D — legacy queue state recovery", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
  });

  it("T1 — SYNCING + zero ops: fail-closed ERROR, nunca DONE fabricado", async () => {
    await seed(makeGesture({ status: "SYNCING" }));

    const recovered = await recoverStaleSyncingGesturesOnce();

    expect(recovered).toBe(1);
    const gesture = await loadGesture("tx-legacy");
    expect(gesture.status).toBe("ERROR");
    expect(gesture.sync_result).toBe("ERROR");
    expect(gesture.client_tx_id).toBe("tx-legacy");
    expect(gesture.last_error).toBe(LEGACY_EMPTY_QUEUE_ERROR);
    expect(gesture.status).not.toBe("DONE");
    expect(
      await db.queue_ops.where("client_tx_id").equals("tx-legacy").count(),
    ).toBe(0);
  });

  it("T2 — SYNCING + terminal-only (REJECTED): reenfileira e settle termina sem replay", async () => {
    await seed(
      makeGesture({ status: "SYNCING" }),
      [makeOperation({ sync_state: "REJECTED" })],
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const recovered = await recoverStaleSyncingGesturesOnce();
    expect(recovered).toBe(1);
    expect((await loadGesture("tx-legacy")).status).toBe("PENDING");

    await processGesture(await loadGesture("tx-legacy"));

    expect(fetchSpy).not.toHaveBeenCalled();
    const gesture = await loadGesture("tx-legacy");
    expect(gesture.status).toBe("REJECTED");
    expect(gesture.sync_result).toBe("REJECTED");
    expect(gesture.client_tx_id).toBe("tx-legacy");
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals("tx-legacy")
      .toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].client_op_id).toBe("op-legacy");
    expect(ops[0].sync_state).toBe("REJECTED");
  });

  it("T2b — SYNCING + terminal-only (BLOCKED_DEPENDENCY): settle em ERROR sem fetch", async () => {
    await seed(
      makeGesture({ status: "SYNCING", client_tx_id: "tx-blocked" }),
      [
        makeOperation({
          client_tx_id: "tx-blocked",
          client_op_id: "op-blocked",
          sync_state: "BLOCKED_DEPENDENCY",
        }),
      ],
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await recoverStaleSyncingGesturesOnce();
    expect((await loadGesture("tx-blocked")).status).toBe("PENDING");

    await processGesture(await loadGesture("tx-blocked"));

    expect(fetchSpy).not.toHaveBeenCalled();
    const gesture = await loadGesture("tx-blocked");
    expect(gesture.status).toBe("ERROR");
    expect(gesture.sync_result).toBe("ERROR");
    expect(gesture.last_error).toBe(
      "sanitario_v2 blocked by unavailable dependency",
    );
    expect(
      await db.queue_ops.where("client_tx_id").equals("tx-blocked").count(),
    ).toBe(1);
  });

  it("T3 — ERROR + zero ops: recovery não reenfileira (fail-closed manual)", async () => {
    await seed(
      makeGesture({
        status: "ERROR",
        sync_result: "ERROR",
        completed_at: "2026-09-19T12:01:00.000Z",
        last_error: "Max retries: HTTP 503 - Service Unavailable",
        retry_count: 3,
      }),
    );

    await recoverErroredGesturesOnce();

    const gesture = await loadGesture("tx-legacy");
    expect(gesture.status).toBe("ERROR");
    expect(gesture.sync_result).toBe("ERROR");
    expect(gesture.status).not.toBe("DONE");
    expect(gesture.last_error).toBe(
      "Max retries: HTTP 503 - Service Unavailable",
    );
  });

  it("T4 — PENDING + zero ops: claim resolve fail-closed em ERROR, sem fetch", async () => {
    await seed(makeGesture({ status: "PENDING" }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await processGesture(await loadGesture("tx-legacy"));

    expect(fetchSpy).not.toHaveBeenCalled();
    const gesture = await loadGesture("tx-legacy");
    expect(gesture.status).toBe("ERROR");
    expect(gesture.sync_result).toBe("ERROR");
    expect(gesture.client_tx_id).toBe("tx-legacy");
    expect(gesture.last_error).toBe(LEGACY_EMPTY_QUEUE_ERROR);
    expect(gesture.status).not.toBe("DONE");
  });

  it("T5 — DONE + ops residuais: sem replay e sem remoção automática", async () => {
    await seed(
      makeGesture({
        status: "DONE",
        sync_result: "APPLIED",
        completed_at: "2026-09-19T12:02:00.000Z",
      }),
      [makeOperation({ sync_state: "PENDING" })],
    );

    await recoverStaleSyncingGesturesOnce();
    await recoverErroredGesturesOnce();

    const gesture = await loadGesture("tx-legacy");
    expect(gesture.status).toBe("DONE");
    expect(gesture.sync_result).toBe("APPLIED");
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals("tx-legacy")
      .toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].client_op_id).toBe("op-legacy");
  });

  it("T6 — REJECTED + op não terminal: permanece intocado (fail-closed manual)", async () => {
    await seed(
      makeGesture({
        status: "REJECTED",
        sync_result: "REJECTED",
        completed_at: "2026-09-19T12:03:00.000Z",
      }),
      [makeOperation({ sync_state: "PENDING" })],
    );

    await recoverStaleSyncingGesturesOnce();
    await recoverErroredGesturesOnce();

    const gesture = await loadGesture("tx-legacy");
    expect(gesture.status).toBe("REJECTED");
    expect(gesture.sync_result).toBe("REJECTED");
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals("tx-legacy")
      .toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].sync_state).toBe("PENDING");
  });

  it("T10 — stale SYNCING com ops não terminais continua recuperando para PENDING", async () => {
    await seed(
      makeGesture({
        status: "SYNCING",
        client_tx_id: "tx-stale-normal",
      }),
      [
        makeOperation({
          client_tx_id: "tx-stale-normal",
          client_op_id: "op-stale-normal",
        }),
      ],
    );

    const recovered = await recoverStaleSyncingGesturesOnce();

    expect(recovered).toBe(1);
    const gesture = await loadGesture("tx-stale-normal");
    expect(gesture.status).toBe("PENDING");
    expect(gesture.client_tx_id).toBe("tx-stale-normal");
    expect(gesture.last_error).toBe(
      "Recovered interrupted sync; retrying with persisted identity",
    );
    expect(
      await db.queue_ops
        .where("client_tx_id")
        .equals("tx-stale-normal")
        .count(),
    ).toBe(1);
  });
});
