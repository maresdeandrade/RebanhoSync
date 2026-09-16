/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";

const farmOne = "10000000-0000-4000-8000-000000000001";
const farmTwo = "10000000-0000-4000-8000-000000000002";
const animalId = "20000000-0000-4000-8000-000000000001";
const agendaId = "30000000-0000-4000-8000-000000000001";
const occurredAt = "2026-09-16T12:00:00.000Z";

async function clearIdentityStores() {
  await db.transaction(
    "rw",
    db.event_eventos,
    db.event_eventos_pesagem,
    db.queue_gestures,
    db.queue_ops,
    async () => {
      await Promise.all([
        db.event_eventos.clear(),
        db.event_eventos_pesagem.clear(),
        db.queue_gestures.clear(),
        db.queue_ops.clear(),
      ]);
    },
  );
}

function buildWeightGesture(input: {
  eventId: string;
  fazendaId: string;
  sourceTaskId?: string | null;
}) {
  return buildEventGesture({
    dominio: "pesagem",
    fazendaId: input.fazendaId,
    eventId: input.eventId,
    animalId,
    occurredAt,
    sourceTaskId: input.sourceTaskId ?? null,
    pesoKg: 250.5,
    observacoes: "Caracterização de identidade factual",
    payload: { tipo_acao: "identity_characterization" },
  });
}

describe("F24.2B1: identidade factual e replay", () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.open();
    await clearIdentityStores();
  });

  afterEach(clearIdentityStores);

  it("reaplica E1/T1/O1 sem criar um segundo fato", async () => {
    const built = buildWeightGesture({
      eventId: "40000000-0000-4000-8000-000000000001",
      fazendaId: farmOne,
    });
    const options = {
      clientTxId: "50000000-0000-4000-8000-000000000001",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000001",
        "60000000-0000-4000-8000-000000000002",
      ],
    };

    const firstTx = await createGesture(farmOne, built.ops, options);
    const replayTx = await createGesture(farmOne, built.ops, options);

    expect(replayTx).toBe(firstTx);
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
    expect(await db.queue_gestures.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(2);
    expect((await db.queue_ops.toArray()).map((op) => op.client_op_id).sort())
      .toEqual([...options.clientOpIds].sort());
  });

  it("permite dois fatos com conteúdo de negócio igual quando as identidades são distintas", async () => {
    const first = buildWeightGesture({
      eventId: "40000000-0000-4000-8000-000000000011",
      fazendaId: farmOne,
    });
    const second = buildWeightGesture({
      eventId: "40000000-0000-4000-8000-000000000012",
      fazendaId: farmOne,
    });

    await createGesture(farmOne, first.ops, {
      clientTxId: "50000000-0000-4000-8000-000000000011",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000011",
        "60000000-0000-4000-8000-000000000012",
      ],
    });
    await createGesture(farmOne, second.ops, {
      clientTxId: "50000000-0000-4000-8000-000000000012",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000013",
        "60000000-0000-4000-8000-000000000014",
      ],
    });

    const events = await db.event_eventos.orderBy("id").toArray();
    const details = await db.event_eventos_pesagem.orderBy("evento_id").toArray();

    expect(events).toHaveLength(2);
    expect(details).toHaveLength(2);
    expect(events.map((event) => event.id)).toEqual([
      first.eventId,
      second.eventId,
    ]);
    expect(events[0]).toMatchObject({
      fazenda_id: farmOne,
      dominio: "pesagem",
      occurred_at: occurredAt,
      animal_id: animalId,
      observacoes: "Caracterização de identidade factual",
      payload: { tipo_acao: "identity_characterization" },
    });
    expect(events[1]).toMatchObject({
      fazenda_id: farmOne,
      dominio: "pesagem",
      occurred_at: occurredAt,
      animal_id: animalId,
      observacoes: "Caracterização de identidade factual",
      payload: { tipo_acao: "identity_characterization" },
    });
    expect(details.map((detail) => detail.peso_kg)).toEqual([250.5, 250.5]);
  });

  it("mantém a mesma origem causal isolada quando usada em fazendas distintas", async () => {
    const first = buildWeightGesture({
      eventId: "40000000-0000-4000-8000-000000000021",
      fazendaId: farmOne,
      sourceTaskId: agendaId,
    });
    const second = buildWeightGesture({
      eventId: "40000000-0000-4000-8000-000000000022",
      fazendaId: farmTwo,
      sourceTaskId: agendaId,
    });

    await createGesture(farmOne, first.ops, {
      clientTxId: "50000000-0000-4000-8000-000000000021",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000021",
        "60000000-0000-4000-8000-000000000022",
      ],
    });
    await createGesture(farmTwo, second.ops, {
      clientTxId: "50000000-0000-4000-8000-000000000022",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000023",
        "60000000-0000-4000-8000-000000000024",
      ],
    });

    const events = await db.event_eventos.toArray();
    const gestures = await db.queue_gestures.toArray();

    expect(events).toHaveLength(2);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ fazenda_id: farmOne, source_task_id: agendaId }),
      expect.objectContaining({ fazenda_id: farmTwo, source_task_id: agendaId }),
    ]));
    expect(gestures).toEqual(expect.arrayContaining([
      expect.objectContaining({ fazenda_id: farmOne }),
      expect.objectContaining({ fazenda_id: farmTwo }),
    ]));
  });

  it("preserva no gesto os IDs pré-gerados pelo peso de entrada societária", async () => {
    const eventId = "40000000-0000-4000-8000-000000000031";
    const txId = "50000000-0000-4000-8000-000000000031";
    const clientOpIds = [
      "60000000-0000-4000-8000-000000000031",
      "60000000-0000-4000-8000-000000000032",
    ];
    const societyWeightOps: OperationInput[] = [
      {
        table: "eventos",
        action: "INSERT",
        record: {
          id: eventId,
          dominio: "pesagem",
          occurred_at: "2026-09-16",
          animal_id: animalId,
          lote_id: null,
          source_task_id: null,
          corrige_evento_id: null,
          sanitario_caso_id: null,
          observacoes: "Peso inicial registrado na entrada em sociedade",
          payload: { tipo_acao: "entrada_sociedade" },
        },
      },
      {
        table: "eventos_pesagem",
        action: "INSERT",
        record: { evento_id: eventId, peso_kg: 250.5, payload: {} },
      },
    ];

    await createGesture(farmOne, societyWeightOps, { clientTxId: txId, clientOpIds });
    await createGesture(farmOne, societyWeightOps, { clientTxId: txId, clientOpIds });

    expect(await db.event_eventos.get(eventId)).toMatchObject({
      id: eventId,
      fazenda_id: farmOne,
      client_tx_id: txId,
      client_op_id: clientOpIds[0],
    });
    expect(await db.event_eventos_pesagem.get(eventId)).toMatchObject({
      evento_id: eventId,
      fazenda_id: farmOne,
      client_tx_id: txId,
      client_op_id: clientOpIds[1],
    });
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
    expect(await db.queue_gestures.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(2);
  });
});
