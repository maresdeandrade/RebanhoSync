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
});
