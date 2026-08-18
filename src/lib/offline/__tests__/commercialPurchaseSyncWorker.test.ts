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
import type { Animal } from "../types";
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

function activeAnimal(): Animal {
  return {
    id: animalId,
    fazenda_id: farm,
    identificacao: "SALE-V2",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2025-01-01",
    data_entrada: "2026-01-01",
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: "nascimento",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "test-client",
    client_op_id: "before-op",
    client_tx_id: "before-tx",
    client_recorded_at: "2026-01-01T12:00:00.000Z",
    server_received_at: null,
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    deleted_at: null,
  };
}

async function createPurchaseV2(weightUnit: "kg" | "arroba" = "kg") {
  const commercialWeight = weightUnit === "kg" ? 300 : 20;
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
        commercialWeight,
      },
    ],
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    operationId: eventId,
    valorBruto: 6000,
    contraparteId: "40000000-0000-4000-8000-000000000001",
    contraparteNome: "Comprador",
    pricing: {
      pricingMode: "per_arroba",
      weightUnit,
      pricePerArroba: 300,
      arrobaBasis: weightUnit === "kg" ? "carcass_weight" : null,
      carcassYieldPercent: null,
      lines: {
        "row-1": {
          commercialWeight: { unit: weightUnit, amount: commercialWeight },
        },
      },
    },
  });
  return createGesture(farm, gesture.ops);
}

function buildSaleV2(animal: Animal) {
  return buildCommercialOperationGesture({
    fazendaId: farm,
    operationType: "venda",
    scope: "animal",
    occurredAt: "2026-08-13T12:00:00.000Z",
    declaredQuantity: 1,
    loteId: null,
    selectedAnimalIds: [animal.id],
    animals: [animal],
    newAnimals: [],
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    operationId: eventId,
    valorBruto: 6000,
    contraparteId: "40000000-0000-4000-8000-000000000001",
    contraparteNome: "Comprador",
    pricing: {
      pricingMode: "per_arroba",
      weightUnit: "arroba",
      pricePerArroba: 300,
      lines: {
        [animal.id]: {
          commercialWeight: { unit: "arroba", amount: 20 },
        },
      },
    },
  });
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

  it.each(["kg", "arroba"] as const)(
    "persists a %s purchase offline and survives a local reload",
    async (weightUnit) => {
      const txId = await createPurchaseV2(weightUnit);
      await db.close();
      await db.open();

      const [queued] = await db.queue_ops
        .where("client_tx_id")
        .equals(txId)
        .toArray();
      expect(queued.record.detail.snapshot.pricing).toMatchObject({
        weight_unit: weightUnit,
        commercial_weight_total: weightUnit === "kg" ? 300 : 20,
      });
      expect(await db.state_animais.get(animalId)).toBeDefined();
      expect(await db.event_eventos.get(eventId)).toBeDefined();
      expect(await db.event_eventos_comercial.get(eventId)).toBeDefined();
    },
  );

  it("retries the exact same arroba command after a transient failure", async () => {
    const txId = await createPurchaseV2("arroba");
    const [queuedBefore] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    const originalRecord = structuredClone(queuedBefore.record);
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ op_id: queuedBefore.client_op_id, status: "APPLIED" }],
          }),
          { status: 200 },
        ),
      );

    const firstAttempt = await db.queue_gestures.get(txId);
    if (!firstAttempt) throw new Error("gesture missing");
    await processGesture(firstAttempt);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      retry_count: 1,
    });
    expect((await db.queue_ops.get(queuedBefore.client_op_id))?.record).toEqual(
      originalRecord,
    );

    const retry = await db.queue_gestures.get(txId);
    if (!retry) throw new Error("gesture missing");
    await processGesture(retry);
    const requestBodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(requestBodies[1].ops[0]).toEqual(requestBodies[0].ops[0]);
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
    expect(await db.queue_ops.count()).toBe(0);
  });

  it.each([
    ["after animal", "event_eventos"],
    ["after event", "event_eventos_comercial"],
  ] as const)(
    "rolls back the whole purchase when failing %s",
    async (_label, store) => {
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
            identificacao: "ROLLBACK-V2",
            sexo: "F",
            especie: "bovino",
          },
        ],
        lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
        operationId: eventId,
        valorBruto: 1000,
      });
      const table = db[store];
      const failCreate = () => {
        throw new Error("injected");
      };
      table.hook("creating", failCreate);
      try {
        await expect(createGesture(farm, gesture.ops)).rejects.toThrow(
          "injected",
        );
      } finally {
        table.hook("creating").unsubscribe(failCreate);
      }
      expect(await db.queue_gestures.count()).toBe(0);
      expect(await db.queue_ops.count()).toBe(0);
      expect(await db.state_animais.count()).toBe(0);
      expect(await db.event_eventos.count()).toBe(0);
      expect(await db.event_eventos_comercial.count()).toBe(0);
    },
  );

  it("restores the complete sale state when the local detail write fails", async () => {
    const animal = activeAnimal();
    await db.state_animais.put(animal);
    const gesture = buildSaleV2(animal);
    const failCreate = () => {
      throw new Error("injected");
    };
    db.event_eventos_comercial.hook("creating", failCreate);
    try {
      await expect(createGesture(farm, gesture.ops)).rejects.toThrow(
        "injected",
      );
    } finally {
      db.event_eventos_comercial.hook("creating").unsubscribe(failCreate);
    }
    expect(await db.state_animais.get(animalId)).toEqual(animal);
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_comercial.count()).toBe(0);
  });
});

describe("commercial auxiliary queue", () => {
  beforeEach(async () => {
    await clear();
    await db.state_sociedade_animais.clear();
  });
  afterEach(async () => {
    await clear();
    await db.state_sociedade_animais.clear();
  });
  it("keeps auxiliary society updates alongside the compound commercial queue operation", async () => {
    const animal = activeAnimal();
    await db.state_animais.put(animal);
    const gesture = buildSaleV2(animal);
    await createGesture(farm, [
      ...gesture.ops,
      {
        table: "sociedade_animais",
        action: "UPDATE",
        record: {
          id: "society-link-1",
          fazenda_id: farm,
          animal_id: animalId,
          status: "encerrado",
          data_saida: "2026-08-13",
          motivo_saida: "venda",
          payload: {},
        },
      },
    ]);
    const queued = await db.queue_ops.toArray();
    expect(queued).toHaveLength(2);
    expect(queued.map((op) => op.table)).toEqual(expect.arrayContaining(["commercial_operation_v2", "sociedade_animais"]));
    expect(await db.state_sociedade_animais.get("society-link-1")).toMatchObject({ status: "encerrado", animal_id: animalId });
  });
});