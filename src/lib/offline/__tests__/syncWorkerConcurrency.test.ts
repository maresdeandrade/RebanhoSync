/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-c2-1-concurrency",
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
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "../db";
import { createGesture } from "../ops";
import { pullDataForFarm } from "../pull";
import {
  isGestureLockActive,
  processGesture,
  recoverStaleSyncingGesturesOnce,
} from "../syncWorker";
import type { Gesture, Operation } from "../types";

const farmId = "10000000-0000-4000-8000-000000000001";
const txId = "50000000-0000-4000-8000-000000000001";
const opId = "60000000-0000-4000-8000-000000000001";
const eventId = "40000000-0000-4000-8000-000000000001";

function makeGesture(overrides: Partial<Gesture> = {}): Gesture {
  return {
    client_tx_id: txId,
    fazenda_id: farmId,
    client_id: "client-c2-1",
    status: "PENDING",
    created_at: "2026-09-17T16:00:00.000Z",
    ...overrides,
  };
}

function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    client_tx_id: txId,
    client_op_id: opId,
    table: "lotes",
    action: "INSERT",
    record: { id: "lote-c2-1", fazenda_id: farmId },
    sync_state: "PENDING",
    created_at: "2026-09-17T16:00:00.000Z",
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
    await db.queue_gestures.add(makeGesture());
    await db.queue_ops.add(makeOperation(opOverrides));
  });
}

async function loadGesture() {
  const queued = await db.queue_gestures.get(txId);
  if (!queued) throw new Error("gesture not found");
  return queued;
}

describe("F24.2C2.1 — Atomic Claim & Stale Worker Protection (T1–T10)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.event_eventos.clear(),
      db.event_eventos_pesagem.clear(),
    ]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.event_eventos.clear(),
      db.event_eventos_pesagem.clear(),
    ]);
  });

  // --------------------------------------------------------------------------
  // T1 — Dois claims simultâneos
  // --------------------------------------------------------------------------
  it("T1 — exactly one claim succeeds under concurrent acquisition", async () => {
    await seedGesture();
    const initial = await loadGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    const results = await Promise.all([
      processGesture(initial),
      processGesture(initial),
    ]);

    expect(results).toHaveLength(2);
    // Exactly one worker was able to execute network
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  // --------------------------------------------------------------------------
  // T2 — Loser não envia request
  // --------------------------------------------------------------------------
  it("T2 — loser of atomic claim sends zero network requests", async () => {
    await seedGesture();
    const initial = await loadGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    await Promise.all([
      processGesture(initial),
      processGesture(initial),
      processGesture(initial),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // T3 — Late SYNCING impossível (reprodução C2 resolvida)
  // --------------------------------------------------------------------------
  it("T3 — late write cannot mark SYNCING over DONE or produce SYNCING+0", async () => {
    await seedGesture();
    const initial = await loadGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    // Worker A completes ACK + DONE
    await processGesture(initial);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);

    // Worker B attempts to process using stale pre-claim snapshot
    await processGesture(initial);

    // Gesture MUST remain DONE, never SYNCING + 0
    const finalGesture = await db.queue_gestures.get(txId);
    expect(finalGesture?.status).toBe("DONE");
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // T4 — Stale catch cannot overwrite terminal state
  // --------------------------------------------------------------------------
  it("T4 — stale catch does not overwrite DONE to PENDING or ERROR", async () => {
    await seedGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    // Complete gesture normally so it is DONE
    await processGesture(await loadGesture());
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });

    // Simulate an overlapping worker whose network threw an error after DONE
    const originalUpdate = db.queue_gestures.update.bind(db.queue_gestures);
    let attemptedOverwrite = false;
    vi.spyOn(db.queue_gestures, "update").mockImplementation(
      async (key, changes) => {
        if (changes.status === "ERROR" || changes.status === "PENDING") {
          attemptedOverwrite = true;
        }
        return originalUpdate(key, changes);
      },
    );

    const doneGesture = (await db.queue_gestures.get(txId))!;
    await processGesture(doneGesture);

    expect(attemptedOverwrite).toBe(false);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  // --------------------------------------------------------------------------
  // T5 — Dois APPLIED concorrentes produzem estado coerente
  // --------------------------------------------------------------------------
  it("T5 — concurrent APPLIED resolves cleanly without PENDING+0 or SYNCING+0", async () => {
    await seedGesture();
    const initial = await loadGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    await Promise.all([processGesture(initial), processGesture(initial)]);

    const finalGesture = await db.queue_gestures.get(txId);
    expect(finalGesture?.status).toBe("DONE");
    expect(finalGesture?.sync_result).toBe("APPLIED");
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // T6 — Active claim × startup recovery (mandatory test)
  // --------------------------------------------------------------------------
  it("T6 — startup recovery does NOT reopen an active claim from another worker", async () => {
    await seedGesture();
    const initial = await loadGesture();

    let releaseFetch = (_res: Response) => undefined;
    let reportFetchStarted = () => undefined;
    const fetchStarted = new Promise<void>((resolve) => {
      reportFetchStarted = resolve;
    });
    const fetchHold = new Promise<Response>((resolve) => {
      releaseFetch = resolve;
    });

    vi.mocked(fetch).mockImplementation(async () => {
      reportFetchStarted();
      return fetchHold;
    });

    // Worker A acquires claim and holds it during fetch
    const workerA = processGesture(initial);
    await fetchStarted;

    // Gesture is actively SYNCING
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "SYNCING",
    });

    // Worker B (another tab starting up) runs startup recovery
    const recoveredCount = await recoverStaleSyncingGesturesOnce();

    // Worker B MUST NOT reopen Worker A's active work!
    expect(recoveredCount).toBe(0);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "SYNCING",
    });

    // Worker A finishes fetch
    releaseFetch(appliedResponse());
    await workerA;

    // Now gesture is DONE
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  // --------------------------------------------------------------------------
  // T6b — Fallback caveat (navigator.locks indisponível): caracterização
  // --------------------------------------------------------------------------
  it("T6b — fallback without navigator.locks: recovery cannot distinguish a remote context's active claim from a true orphan", async () => {
    // jsdom does not implement navigator.locks, so every test here (and this
    // one explicitly) exercises the per-tab in-memory Set fallback. A second
    // REAL tab would have its own empty registry, so an active SYNCING claim
    // held by another context is indistinguishable from a true orphaned claim.
    // Documented caveat: recovery reopens the gesture in that case.
    // CROSS_TAB_COORDINATION_WITHOUT_WEB_LOCKS = NOT_FULLY_PROTECTED
    await seedGesture();
    // Simulate "active in another context": SYNCING persisted, but no lock in
    // this context's registry (exactly what a second tab would observe).
    await db.queue_gestures.update(txId, { status: "SYNCING" });
    expect(await isGestureLockActive(txId)).toBe(false);

    const recoveredCount = await recoverStaleSyncingGesturesOnce();

    expect(recoveredCount).toBe(1);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      last_error: "Recovered interrupted sync; retrying with persisted identity",
    });
  });

  // --------------------------------------------------------------------------
  // T7 — Stale claim / crash verdadeiro
  // --------------------------------------------------------------------------
  it("T7 — true orphaned claim after crash is recovered back to PENDING", async () => {
    await seedGesture();
    // Simulate gesture left in SYNCING because previous worker crashed (lock is NOT active)
    await db.queue_gestures.update(txId, { status: "SYNCING" });
    expect(await isGestureLockActive(txId)).toBe(false);

    const recoveredCount = await recoverStaleSyncingGesturesOnce();

    expect(recoveredCount).toBe(1);
    const recovered = await db.queue_gestures.get(txId);
    expect(recovered).toMatchObject({
      client_tx_id: txId,
      status: "PENDING",
      last_error: "Recovered interrupted sync; retrying with persisted identity",
    });
    expect(recovered?.sync_result).toBeUndefined();
    expect(recovered?.completed_at).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // T8 — Restart/replay preserves identities without new events
  // --------------------------------------------------------------------------
  it("T8 — recovered gesture replays with same client_tx_id and client_op_id", async () => {
    const built = buildEventGesture({
      dominio: "pesagem",
      fazendaId: farmId,
      eventId,
      animalId: "20000000-0000-4000-8000-000000000001",
      occurredAt: "2026-09-17T12:00:00.000Z",
      sourceTaskId: null,
      pesoKg: 300,
      observacoes: "T8 identity preservation",
      payload: { test: "t8" },
    });
    await createGesture(farmId, built.ops, {
      clientTxId: txId,
      clientOpIds: [opId, "60000000-0000-4000-8000-000000000002"],
    });

    // Mark SYNCING (simulating crash)
    await db.queue_gestures.update(txId, { status: "SYNCING" });
    const eventCountBefore = await db.event_eventos.count();

    // Recovery
    await recoverStaleSyncingGesturesOnce();
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "PENDING" });

    // Replay
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: opId, status: "APPLIED" },
            { op_id: "60000000-0000-4000-8000-000000000002", status: "APPLIED" },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await loadGesture());

    const [, request] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      client_tx_id: string;
      ops: Array<{ client_op_id: string }>;
    };
    expect(body.client_tx_id).toBe(txId);
    expect(body.ops.map((o) => o.client_op_id)).toEqual([
      opId,
      "60000000-0000-4000-8000-000000000002",
    ]);
    expect(await db.event_eventos.count()).toBe(eventCountBefore);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  // --------------------------------------------------------------------------
  // T9 — ACK atomic regression (C1 boundary preserved)
  // --------------------------------------------------------------------------
  it("T9 — failure inside ACK rolls back operation deletion cleanly", async () => {
    await seedGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    const originalUpdate = db.queue_gestures.update.bind(db.queue_gestures);
    vi.spyOn(db.queue_gestures, "update").mockImplementation(
      async (key, changes) => {
        if (changes.status === "DONE") {
          throw new Error("T9_INJECTED_ACK_FAILURE");
        }
        return originalUpdate(key, changes);
      },
    );

    await processGesture(await loadGesture());

    // Operations remain intact because ACK transaction rolled back
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(1);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      last_error: "T9_INJECTED_ACK_FAILURE",
    });
    expect(pullDataForFarm).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // T10 — Partial success regression
  // --------------------------------------------------------------------------
  it("T10 — partial success preserves applied and rejected operations", async () => {
    const secondOpId = "60000000-0000-4000-8000-000000000002";
    await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
      await db.queue_gestures.add(makeGesture());
      await db.queue_ops.add(makeOperation({ client_op_id: opId }));
      await db.queue_ops.add(
        makeOperation({
          client_op_id: secondOpId,
          record: { id: "lote-2", fazenda_id: farmId },
        }),
      );
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: opId, status: "APPLIED" },
            {
              op_id: secondOpId,
              status: "REJECTED",
              reason_code: "INVALID_MUTATION",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await loadGesture());

    // Applied op was deleted from queue
    expect(await db.queue_ops.get(opId)).toBeUndefined();
    // Rejected op remains in queue with sync_state REJECTED
    expect(await db.queue_ops.get(secondOpId)).toMatchObject({
      sync_state: "REJECTED",
    });
    // Gesture status updated to REJECTED
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "REJECTED",
    });
  });
});
