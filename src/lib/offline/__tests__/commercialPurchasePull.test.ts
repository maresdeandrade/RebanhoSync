/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: new Map<string, unknown[]>() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: async () => ({ data: mocks.rows.get(table) ?? [], error: null }),
      }),
    })),
  },
}));

import { db } from "../db";
import { pullDataForFarm } from "../pull";
import type { Operation } from "../types";

const farm = "10000000-0000-4000-8000-000000000001";
const tx = "20000000-0000-4000-8000-000000000001";
const animalId = "30000000-0000-4000-8000-000000000001";
const eventId = "40000000-0000-4000-8000-000000000001";

function compoundOp(): Operation {
  const animal = {
    id: animalId,
    fazenda_id: farm,
    identificacao: "LOCAL",
    origem: "compra",
    status: "ativo",
  };
  const event = {
    id: eventId,
    fazenda_id: farm,
    dominio: "comercial",
    animal_id: animalId,
    payload: { source: "local" },
  };
  const detail = {
    evento_id: eventId,
    fazenda_id: farm,
    operation_type: "compra",
    scope: "animal",
    animal_ids: [animalId],
    valor_bruto: 10,
  };
  return {
    client_op_id: "50000000-0000-4000-8000-000000000001",
    client_tx_id: tx,
    table: "commercial_purchase_v1",
    action: "INSERT",
    record: {
      domain: "commercial_purchase_v1",
      command: "apply_individual_purchase",
      contract_version: 1,
      client_op_id: "50000000-0000-4000-8000-000000000001",
      client_tx_id: tx,
      animal,
      event,
      detail,
    },
    created_at: "2026-08-08T12:00:00.000Z",
  };
}

function compoundV2Op(): Operation {
  const legacy = compoundOp();
  const saleAnimal = {
    ...legacy.record.animal,
    status: "vendido",
    lote_id: null,
    data_saida: "2026-08-13",
  };
  const saleEvent = {
    ...legacy.record.event,
    id: eventId,
    payload: { kind: "commercial_operation_v2", source: "local" },
  };
  const saleDetail = {
    ...legacy.record.detail,
    evento_id: eventId,
    operation_type: "venda",
    occurred_at: "2026-08-13T12:00:00.000Z",
    snapshot: {
      pricing: {
        contract_version: 1,
        pricing_mode: "per_arroba",
        weight_unit: "arroba",
        commercial_weight_total: 20,
        price_per_arroba: 300,
        arroba_basis: null,
        carcass_yield_percent: null,
        lines: [
          {
            animal_id: animalId,
            commercial_weight: 20,
            commercial_weight_unit: "arroba",
            weight_source: "direct",
            weight_considered_kg: null,
            arrobas: 20,
            individual_gross_value: 6000,
          },
        ],
      },
    },
  };
  return {
    ...legacy,
    table: "commercial_operation_v2",
    record: {
      domain: "commercial_operation_v2",
      command: "apply_commercial_operation",
      contract_version: 2,
      client_op_id: legacy.client_op_id,
      client_tx_id: tx,
      operation_id: eventId,
      operation_type: "venda",
      scope: "animal",
      fazenda_id: farm,
      occurred_at: "2026-08-13T12:00:00.000Z",
      animal_ids: [animalId],
      animals: [saleAnimal],
      event: saleEvent,
      detail: saleDetail,
    },
  };
}

async function clear() {
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.state_animais,
      db.event_eventos,
      db.event_eventos_comercial,
    ],
    async () => {
      await db.queue_ops.clear();
      await db.state_animais.clear();
      await db.event_eventos.clear();
      await db.event_eventos_comercial.clear();
    },
  );
}

describe("commercial purchase pull protection", () => {
  beforeEach(async () => {
    mocks.rows.clear();
    await clear();
  });
  afterEach(clear);

  it("does not overwrite any of the three locally pending records", async () => {
    const op = compoundOp();
    await db.queue_ops.add(op);
    await db.state_animais.put(op.record.animal);
    await db.event_eventos.put(op.record.event);
    await db.event_eventos_comercial.put(op.record.detail);
    mocks.rows.set("animais", [
      { ...op.record.animal, identificacao: "REMOTE" },
    ]);
    mocks.rows.set("eventos", [
      { ...op.record.event, payload: { source: "remote" } },
    ]);
    mocks.rows.set("eventos_comercial", [
      { ...op.record.detail, valor_bruto: 99 },
    ]);

    await pullDataForFarm(farm, ["animais", "eventos", "eventos_comercial"]);

    expect((await db.state_animais.get(animalId))?.identificacao).toBe("LOCAL");
    expect((await db.event_eventos.get(eventId))?.payload).toEqual({
      source: "local",
    });
    expect((await db.event_eventos_comercial.get(eventId))?.valor_bruto).toBe(
      10,
    );
  });

  it("is idempotent after the pending command is consumed", async () => {
    const op = compoundOp();
    mocks.rows.set("animais", [op.record.animal]);
    mocks.rows.set("eventos", [op.record.event]);
    mocks.rows.set("eventos_comercial", [op.record.detail]);
    await pullDataForFarm(farm, ["animais", "eventos", "eventos_comercial"]);
    await pullDataForFarm(farm, ["animais", "eventos", "eventos_comercial"]);
    expect(await db.state_animais.count()).toBe(1);
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_comercial.count()).toBe(1);
  });

  it("preserves the auditable pricing snapshot through the v2 pull", async () => {
    const op = compoundV2Op();
    const envelope = op.record as Record<string, unknown>;
    const detail = envelope.detail as Record<string, unknown>;
    mocks.rows.set("eventos_comercial", [detail]);

    await pullDataForFarm(farm, ["eventos_comercial"]);

    expect((await db.event_eventos_comercial.get(eventId))?.snapshot).toEqual(
      detail.snapshot,
    );
  });

  it("keeps a legacy pricing snapshot without weight_unit byte-for-byte", async () => {
    const op = compoundV2Op();
    const envelope = op.record as Record<string, unknown>;
    const detail = envelope.detail as Record<string, unknown>;
    const legacySnapshot = {
      pricing: {
        contract_version: 1,
        pricing_mode: "per_head",
        lines: [{ animal_id: animalId, individual_gross_value: 2500 }],
      },
    };
    detail.snapshot = legacySnapshot;
    mocks.rows.set("eventos_comercial", [detail]);

    await pullDataForFarm(farm, ["eventos_comercial"]);

    expect((await db.event_eventos_comercial.get(eventId))?.snapshot).toEqual(
      legacySnapshot,
    );
  });

  it("protects the sold state and both facts while v2 is pending", async () => {
    const op = compoundV2Op();
    const envelope = op.record as Record<string, unknown>;
    const localAnimal = (envelope.animals as Record<string, unknown>[])[0]!;
    const localEvent = envelope.event as Record<string, unknown>;
    const localDetail = envelope.detail as Record<string, unknown>;
    await db.queue_ops.add(op);
    await db.state_animais.put(localAnimal);
    await db.event_eventos.put(localEvent);
    await db.event_eventos_comercial.put(localDetail);
    mocks.rows.set("animais", [
      { ...localAnimal, status: "ativo", lote_id: "remote-lot" },
    ]);
    mocks.rows.set("eventos", [
      { ...localEvent, payload: { source: "remote" } },
    ]);
    mocks.rows.set("eventos_comercial", [{ ...localDetail, valor_bruto: 999 }]);

    await pullDataForFarm(farm, ["animais", "eventos", "eventos_comercial"]);

    expect((await db.state_animais.get(animalId))?.status).toBe("vendido");
    expect((await db.state_animais.get(animalId))?.lote_id).toBeNull();
    expect((await db.event_eventos.get(eventId))?.payload).toMatchObject({
      source: "local",
    });
    expect((await db.event_eventos_comercial.get(eventId))?.valor_bruto).toBe(
      10,
    );
  });
});
