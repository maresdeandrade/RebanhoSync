/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "token", expires_at: 9999999999 } },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));
vi.mock("../pull", () => ({
  pullDataForFarm: mocks.pullDataForFarm,
  pullInitialData: vi.fn(),
  pullSanitarioAgendaV2: vi.fn(),
  pullSanitarioV2CutoverState: vi.fn(),
}));
vi.mock("@/lib/reproduction/remoteSync", () => ({
  pullReproductionDiagnosisState: vi.fn(),
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(),
  flushPilotMetrics: vi.fn(),
}));

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { buildCommercialOperationGesture } from "@/lib/comercial/commercialOperationCommand";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { db } from "../db";
import { createGesture } from "../ops";
import { processGesture } from "../syncWorker";

const farm = "10000000-0000-4000-8000-000000000001";
const animalId = "20000000-0000-4000-8000-000000000001";
const eventId = "30000000-0000-4000-8000-000000000001";

async function createPurchase() {
  const event = buildEventGesture({
    dominio: "comercial",
    eventId,
    fazendaId: farm,
    occurredAt: "2026-08-08T12:00:00.000Z",
    animalId,
    operationType: "compra",
    scope: "animal",
    quantidadeAnimais: 1,
    animalIds: [animalId],
    animalStatusSnapshot: "ativo",
  });
  return createGesture(farm, [
    {
      table: "animais",
      action: "INSERT",
      record: {
        id: animalId,
        identificacao: "COMP-1",
        sexo: "F",
        status: "ativo",
        origem: "compra",
        payload: {},
      },
    },
    ...event.ops,
  ]);
}

async function createPurchaseV2() {
  const gesture = buildCommercialOperationGesture({
    fazendaId: farm,
    operationType: "compra",
    scope: "animal",
    occurredAt: "2026-08-13T12:00:00.000Z",
    declaredQuantity: 1,
    loteId: null,
    selectedAnimalIds: [],
    animals: [],
    newAnimals: [
      {
        localId: "row-1",
        id: animalId,
        identificacao: "COMP-V2",
        sexo: "F",
        especie: "bovino",
        dataNascimento: "2025-01-01",
        dataEntrada: "2026-08-13",
      },
    ],
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    operationId: eventId,
    valorBruto: 1200,
  });
  return createGesture(farm, gesture.ops);
}

async function clear() {
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.queue_gestures,
      db.queue_rejections,
      db.state_animais,
      db.event_eventos,
      db.event_eventos_comercial,
    ],
    async () => {
      await db.queue_ops.clear();
      await db.queue_gestures.clear();
      await db.queue_rejections.clear();
      await db.state_animais.clear();
      await db.event_eventos.clear();
      await db.event_eventos_comercial.clear();
    },
  );
}

describe("commercial purchase sync worker", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await clear();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await clear();
  });

  it("sends one compound command and reconciles all three tables", async () => {
    const txId = await createPurchase();
    const [queued] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: queued.client_op_id,
              status: "APPLIED",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture missing");
    await processGesture(gesture);

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.ops).toHaveLength(1);
    expect(body.ops[0]).toMatchObject({
      domain: "commercial_purchase_v1",
      command: "apply_individual_purchase",
    });
    expect(mocks.pullDataForFarm).toHaveBeenCalledWith(
      farm,
      expect.arrayContaining(["animais", "eventos", "eventos_comercial"]),
    );
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("keeps local history and the compound command on explicit conflict", async () => {
    const txId = await createPurchase();
    const [queued] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: queued.client_op_id,
              status: "CONFLICT",
              reason_code: "COMMERCIAL_PURCHASE_EVENT_DIVERGENT",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture missing");
    await processGesture(gesture);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "REJECTED",
    });
    expect(await db.queue_ops.get(queued.client_op_id)).toBeDefined();
    expect(await db.state_animais.get(animalId)).toBeDefined();
    expect(await db.event_eventos.get(eventId)).toBeDefined();
    expect(await db.event_eventos_comercial.get(eventId)).toBeDefined();
  });

  it("sends commercial_operation_v2 as one queue command", async () => {
    const txId = await createPurchaseV2();
    const [queued] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ op_id: queued.client_op_id, status: "APPLIED" }],
        }),
        { status: 200 },
      ),
    );
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture missing");
    await processGesture(gesture);

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.ops).toHaveLength(1);
    expect(body.ops[0]).toMatchObject({
      domain: "commercial_operation_v2",
      command: "apply_commercial_operation",
      contract_version: 2,
      animal_ids: [animalId],
    });
    expect(mocks.pullDataForFarm).toHaveBeenCalledWith(
      farm,
      expect.arrayContaining(["animais", "eventos", "eventos_comercial"]),
    );
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });
});
