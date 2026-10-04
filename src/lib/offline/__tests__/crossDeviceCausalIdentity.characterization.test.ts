/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";

const clientIdKey = "gestao_agro_client_id";
const farmId = "10000000-0000-4000-8000-000000000001";
const animalId = "20000000-0000-4000-8000-000000000001";
const sourceTaskOne = "30000000-0000-4000-8000-000000000001";
const sourceTaskTwo = "30000000-0000-4000-8000-000000000002";

async function clearStores() {
  await db.transaction(
    "rw",
    db.event_eventos,
    db.event_eventos_pesagem,
    db.event_eventos_movimentacao,
    db.queue_gestures,
    db.queue_ops,
    async () => {
      await Promise.all([
        db.event_eventos.clear(),
        db.event_eventos_pesagem.clear(),
        db.event_eventos_movimentacao.clear(),
        db.queue_gestures.clear(),
        db.queue_ops.clear(),
      ]);
    },
  );
}

async function enqueueFromClient(input: {
  clientId: string;
  eventId: string;
  clientTxId: string;
  clientOpIds: string[];
  sourceTaskId?: string | null;
  occurredAt?: string;
}) {
  localStorage.setItem(clientIdKey, input.clientId);
  const built = buildEventGesture({
    dominio: "pesagem",
    fazendaId: farmId,
    eventId: input.eventId,
    animalId,
    occurredAt: input.occurredAt ?? "2026-09-24T12:00:00.000Z",
    sourceTaskId: input.sourceTaskId ?? null,
    pesoKg: 250.5,
    observacoes: "F24.4B causal identity characterization",
    payload: { origin: "characterization" },
  });

  await createGesture(farmId, built.ops, {
    clientTxId: input.clientTxId,
    clientOpIds: input.clientOpIds,
  });
}

describe("F24.4B: concurrent event writes and causal identity", () => {
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    localStorage.clear();
    await db.open();
    await clearStores();
  });

  afterEach(async () => { await clearStores(); vi.unstubAllGlobals(); });

  it("replays the same persisted identity without duplicating the fact", async () => {
    const input = {
      clientId: "browser:device-a",
      eventId: "40000000-0000-4000-8000-000000000001",
      clientTxId: "50000000-0000-4000-8000-000000000001",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000001",
        "60000000-0000-4000-8000-000000000002",
      ],
    };

    await enqueueFromClient(input);
    await enqueueFromClient(input);

    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
    expect(await db.queue_gestures.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(2);
  });

  it("keeps independent optimistic facts when two devices share one source task", async () => {
    await enqueueFromClient({
      clientId: "browser:device-a",
      eventId: "40000000-0000-4000-8000-000000000011",
      clientTxId: "50000000-0000-4000-8000-000000000011",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000011",
        "60000000-0000-4000-8000-000000000012",
      ],
      sourceTaskId: sourceTaskOne,
    });
    await enqueueFromClient({
      clientId: "browser:device-b",
      eventId: "40000000-0000-4000-8000-000000000012",
      clientTxId: "50000000-0000-4000-8000-000000000012",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000013",
        "60000000-0000-4000-8000-000000000014",
      ],
      sourceTaskId: sourceTaskOne,
    });

    const events = await db.event_eventos.orderBy("id").toArray();
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.client_id)).toEqual([
      "browser:device-a",
      "browser:device-b",
    ]);
    expect(
      events.every((event) => event.source_task_id === sourceTaskOne),
    ).toBe(true);
  });

  it("preserves equal business content when the causal source tasks are distinct", async () => {
    await enqueueFromClient({
      clientId: "browser:device-a",
      eventId: "40000000-0000-4000-8000-000000000021",
      clientTxId: "50000000-0000-4000-8000-000000000021",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000021",
        "60000000-0000-4000-8000-000000000022",
      ],
      sourceTaskId: sourceTaskOne,
    });
    await enqueueFromClient({
      clientId: "browser:device-b",
      eventId: "40000000-0000-4000-8000-000000000022",
      clientTxId: "50000000-0000-4000-8000-000000000022",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000023",
        "60000000-0000-4000-8000-000000000024",
      ],
      sourceTaskId: sourceTaskTwo,
    });

    const events = await db.event_eventos.orderBy("id").toArray();
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.source_task_id)).toEqual([
      sourceTaskOne,
      sourceTaskTwo,
    ]);
    expect(await db.event_eventos_pesagem.count()).toBe(2);
  });

  it("does not heuristically deduplicate equal ad-hoc facts from independent devices", async () => {
    await enqueueFromClient({
      clientId: "browser:device-a",
      eventId: "40000000-0000-4000-8000-000000000031",
      clientTxId: "50000000-0000-4000-8000-000000000031",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000031",
        "60000000-0000-4000-8000-000000000032",
      ],
    });
    await enqueueFromClient({
      clientId: "browser:device-b",
      eventId: "40000000-0000-4000-8000-000000000032",
      clientTxId: "50000000-0000-4000-8000-000000000032",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000033",
        "60000000-0000-4000-8000-000000000034",
      ],
    });

    const events = await db.event_eventos.toArray();
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.source_task_id === null)).toBe(true);
  });

  it("preserves both movement facts when reconnect order is inverted", async () => {
    await db.state_animais.put({ id: animalId, fazenda_id: farmId, lote_id: null } as never);
    const later = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      eventId: "40000000-0000-4000-8000-000000000041",
      animalId,
      occurredAt: "2026-09-24T14:00:00.000Z",
      fromLoteId: "70000000-0000-4000-8000-000000000001",
      toLoteId: "70000000-0000-4000-8000-000000000002",
      applyAnimalStateUpdate: false,
    });
    const earlier = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      eventId: "40000000-0000-4000-8000-000000000042",
      animalId,
      occurredAt: "2026-09-24T13:00:00.000Z",
      fromLoteId: "70000000-0000-4000-8000-000000000003",
      toLoteId: "70000000-0000-4000-8000-000000000001",
      applyAnimalStateUpdate: false,
    });

    localStorage.setItem(clientIdKey, "browser:device-b");
    await createGesture(farmId, later.ops, {
      clientTxId: "50000000-0000-4000-8000-000000000041",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000041",
        "60000000-0000-4000-8000-000000000042",
      ],
    });
    localStorage.setItem(clientIdKey, "browser:device-a");
    await createGesture(farmId, earlier.ops, {
      clientTxId: "50000000-0000-4000-8000-000000000042",
      clientOpIds: [
        "60000000-0000-4000-8000-000000000043",
        "60000000-0000-4000-8000-000000000044",
      ],
    });

    const events = (await db.event_eventos.toArray()).sort((left, right) =>
      left.occurred_at.localeCompare(right.occurred_at),
    );
    expect(events.map((event) => event.id)).toEqual([
      earlier.eventId,
      later.eventId,
    ]);
    expect(await db.event_eventos_movimentacao.count()).toBe(2);
  });
});
