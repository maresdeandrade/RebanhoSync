/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";

const farmId = "00000000-0000-4000-8000-000000000014";
const animalId = "00000000-0000-4000-8000-000000000141";
const eventId = "00000000-0000-4000-8000-000000000142";
const occurredAt = "2026-08-07T12:00:00.000Z";

function buildPurchaseOps(): OperationInput[] {
  const animalOp: OperationInput = {
    table: "animais",
    action: "INSERT",
    record: {
      id: animalId,
      identificacao: "COMPRA-14-01",
      sexo: "F",
      status: "ativo",
      origem: "compra",
      lote_id: null,
      data_entrada: "2026-08-07",
      payload: {},
    },
  };
  const purchase = buildEventGesture({
    dominio: "comercial",
    eventId,
    fazendaId: farmId,
    occurredAt,
    animalId,
    operationType: "compra",
    scope: "animal",
    quantidadeAnimais: 1,
    valorBruto: 3200,
    valorLiquidoDerivado: 3200,
    animalIds: [animalId],
    animalStatusSnapshot: "ativo",
  });

  return [animalOp, ...purchase.ops];
}

async function clearPurchaseStores() {
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.queue_gestures,
      db.event_eventos_comercial,
      db.event_eventos,
      db.state_animais,
    ],
    async () => {
      await db.queue_ops.clear();
      await db.queue_gestures.clear();
      await db.event_eventos_comercial.clear();
      await db.event_eventos.clear();
      await db.state_animais.clear();
    },
  );
}

describe("cadastro factual de compra animal", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearPurchaseStores();
  });

  afterEach(clearPurchaseStores);

  it("persiste animal ativo, Evento, detalhe e fila no mesmo gesto", async () => {
    const txId = await createGesture(farmId, buildPurchaseOps());

    expect(await db.state_animais.get(animalId)).toMatchObject({
      fazenda_id: farmId,
      origem: "compra",
      status: "ativo",
    });
    expect(await db.event_eventos.get(eventId)).toMatchObject({
      fazenda_id: farmId,
      dominio: "comercial",
      animal_id: animalId,
    });
    expect(await db.event_eventos_comercial.get(eventId)).toMatchObject({
      fazenda_id: farmId,
      operation_type: "compra",
      valor_bruto: 3200,
      animal_ids: [animalId],
    });

    const queued = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      table: "commercial_purchase_v1",
      record: {
        domain: "commercial_purchase_v1",
        command: "apply_individual_purchase",
        contract_version: 1,
        animal: { id: animalId, status: "ativo", origem: "compra" },
        event: { id: eventId, dominio: "comercial", animal_id: animalId },
        detail: {
          evento_id: eventId,
          operation_type: "compra",
          scope: "animal",
          animal_ids: [animalId],
        },
      },
    });
  });

  it("reverte integralmente animal, fato e fila quando um detalhe falha", async () => {
    const invalidDetail: OperationInput = {
      table: "eventos_comercial",
      action: "INSERT",
      record: {
        operation_type: "compra",
        scope: "animal",
      },
    };

    await expect(
      createGesture(farmId, [...buildPurchaseOps(), invalidDetail]),
    ).rejects.toBeDefined();

    expect(await db.state_animais.get(animalId)).toBeUndefined();
    expect(await db.event_eventos.get(eventId)).toBeUndefined();
    expect(await db.event_eventos_comercial.get(eventId)).toBeUndefined();
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.queue_gestures.count()).toBe(0);
  });
});
