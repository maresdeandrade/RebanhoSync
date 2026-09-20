/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-atomic-ack",
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
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "../db";
import { seedLocalOwner } from "./ownershipTestFixture";
import { createGesture } from "../ops";
import { pullDataForFarm } from "../pull";
import { processGesture, recoverStaleSyncingGesturesOnce } from "../syncWorker";

const farmId = "10000000-0000-4000-8000-000000000001";
const eventId = "40000000-0000-4000-8000-000000000001";
const txId = "50000000-0000-4000-8000-000000000001";
const opIds = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
];

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.event_eventos,
      db.event_eventos_pesagem,
      db.queue_gestures,
      db.queue_ops,
    ],
    async () => {
      await db.event_eventos.clear();
      await db.event_eventos_pesagem.clear();
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
    },
  );
}

async function seedWeightGesture() {
  const built = buildEventGesture({
    dominio: "pesagem",
    fazendaId: farmId,
    eventId,
    animalId: "20000000-0000-4000-8000-000000000001",
    occurredAt: "2026-09-17T12:00:00.000Z",
    sourceTaskId: null,
    pesoKg: 250.5,
    observacoes: "F24.2C1 atomic ack",
    payload: { source: "f24_2c1" },
  });
  await createGesture(farmId, built.ops, {
    clientTxId: txId,
    clientOpIds: opIds,
  });
  return built;
}

function appliedResponse() {
  return new Response(
    JSON.stringify({
      results: opIds.map((opId) => ({ op_id: opId, status: "APPLIED" })),
    }),
    { status: 200 },
  );
}

async function loadGesture() {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error("gesture not found");
  return gesture;
}

describe("syncWorker atomic ACK and stale SYNCING recovery", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await clearStores();
    await seedLocalOwner("test-owner");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await clearStores();
  });

  it("recovers SYNCING and replays the persisted identities without a new event", async () => {
    await seedWeightGesture();
    await db.queue_gestures.update(txId, { status: "SYNCING" });
    const eventCountBefore = await db.event_eventos.count();

    await recoverStaleSyncingGesturesOnce();
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
    });
    vi.mocked(fetch).mockResolvedValue(appliedResponse());
    await processGesture(await loadGesture());

    const [, request] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      client_tx_id: string;
      ops: Array<{ client_op_id: string }>;
    };
    expect(body.client_tx_id).toBe(txId);
    expect(body.ops.map((operation) => operation.client_op_id)).toEqual(opIds);
    expect(await db.event_eventos.count()).toBe(eventCountBefore);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  it("commits operation removal, audit and DONE as one ACK state", async () => {
    await seedWeightGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());
    vi.mocked(pullDataForFarm).mockImplementation(async () => {
      expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
        0,
      );
      expect(await db.queue_gestures.get(txId)).toMatchObject({
        status: "DONE",
        sync_result: "APPLIED",
      });
    });

    await processGesture(await loadGesture());

    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      0,
    );
    const gesture = await loadGesture();
    expect(gesture).toMatchObject({ status: "DONE", sync_result: "APPLIED" });
    expect(gesture.operation_results).toHaveLength(2);
    expect(gesture.operation_results?.every((result) => result.matched)).toBe(
      true,
    );
  });

  it("rolls back operation removal when the gesture ACK write fails", async () => {
    await seedWeightGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());
    const originalUpdate = db.queue_gestures.update.bind(db.queue_gestures);
    vi.spyOn(db.queue_gestures, "update").mockImplementation(
      async (key, changes) => {
        if (changes.status === "DONE")
          throw new Error("ACK_WRITE_INJECTED_FAILURE");
        return originalUpdate(key, changes);
      },
    );

    await processGesture(await loadGesture());

    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      2,
    );
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      last_error: "ACK_WRITE_INJECTED_FAILURE",
    });
    expect(pullDataForFarm).not.toHaveBeenCalled();
  });
});
