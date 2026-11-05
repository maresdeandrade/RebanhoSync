/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { AgendaItem, Animal } from "@/lib/offline/types";

const farmId = "10000000-0000-4000-8000-000000000001";
const otherFarmId = "10000000-0000-4000-8000-000000000002";
const animalId = "20000000-0000-4000-8000-000000000001";
const otherAnimalId = "20000000-0000-4000-8000-000000000002";
const agendaId = "30000000-0000-4000-8000-000000000001";
const eventId = "40000000-0000-4000-8000-000000000001";

async function registerDeath() {
  const gesture = buildEventGesture({
    dominio: "obito",
    fazendaId: farmId,
    animalId,
    eventId,
    causa: "doenca",
    cancelAgendaIds: [agendaId],
  });
  await createGesture(farmId, gesture.ops);
}

describe("persistência local das consequências de óbito", () => {
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    localStorage.clear();
    await db.open();
    await Promise.all([
      db.state_animais.clear(),
      db.state_agenda_itens.clear(),
      db.event_eventos.clear(),
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
    await db.state_animais.put({ id: animalId, fazenda_id: farmId, status: "ativo", revision: 1 } as Animal);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("farm-switch durante a transação reverte fato e fila juntos", async () => {
    const built = buildEventGesture({ dominio: "obito", fazendaId: farmId, animalId, eventId, causa: "doenca" });
    let checks = 0;
    await expect(createGesture(farmId, built.ops, {
      deathConsequences: { animalId, eventId },
      validateContext: () => { if (++checks === 3) throw new Error("OBITO_ACTIVE_FARM_CHANGED"); },
    })).rejects.toThrow("OBITO_ACTIVE_FARM_CHANGED");
    expect(await db.event_eventos.get(eventId)).toBeUndefined();
    expect((await db.state_animais.get(animalId))?.status).toBe("ativo");
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.queue_gestures.count()).toBe(0);
  });

  it("não dispensa participante de outra fazenda", async () => {
    const sanitaryAgenda = crypto.randomUUID();
    await db.ops_sanitario_agenda_v2.put({ id: sanitaryAgenda, fazenda_id: otherFarmId, status: "programada" } as never);
    await db.ops_sanitario_agenda_animais_v2.put({ agenda_id: sanitaryAgenda, animal_id: animalId, fazenda_id: otherFarmId, planned_status: "planejado" } as never);
    const built = buildEventGesture({ dominio: "obito", fazendaId: farmId, animalId, eventId, causa: "doenca" });
    await createGesture(farmId, built.ops, { deathConsequences: { animalId, eventId } });
    expect((await db.ops_sanitario_agenda_animais_v2.get([sanitaryAgenda, animalId]))?.planned_status).toBe("planejado");
    expect(await db.queue_ops.filter(op => op.record?.command === "death_participant").count()).toBe(0);
  });

  it("não cancela Agenda excluída", async () => {
    await db.state_agenda_itens.put({ id: agendaId, fazenda_id: farmId, animal_id: animalId, status: "agendado", dominio: "pesagem", deleted_at: "2026-11-03T00:00:00Z" } as AgendaItem);
    await registerDeath();
    expect((await db.state_agenda_itens.get(agendaId))?.status).toBe("agendado");
    expect(await db.event_eventos.get(eventId)).toBeDefined();
  });

  it("não cancela localmente uma agenda sanitária pelo comando comum", async () => {
    await db.state_agenda_itens.put({ id: agendaId, fazenda_id: farmId, animal_id: animalId, status: "agendado", dominio: "sanitario", deleted_at: null } as AgendaItem);
    await registerDeath();
    expect((await db.state_agenda_itens.get(agendaId))?.status).toBe("agendado");
    expect(await db.event_eventos.get(eventId)).toMatchObject({ dominio: "obito" });
  });

  it("registra desfecho apenas do participante pendente na mesma transação do óbito", async () => {
    const sanitaryAgenda = crypto.randomUUID();
    const otherAnimal = crypto.randomUUID();
    await db.ops_sanitario_agenda_v2.put({ id: sanitaryAgenda, fazenda_id: farmId, status: "programada", deleted_at: null } as never);
    await db.ops_sanitario_agenda_animais_v2.bulkPut([
      { agenda_id: sanitaryAgenda, animal_id: animalId, fazenda_id: farmId, planned_status: "planejado", execution_evento_id: null },
      { agenda_id: sanitaryAgenda, animal_id: otherAnimal, fazenda_id: farmId, planned_status: "planejado", execution_evento_id: null },
    ] as never[]);
    const built = buildEventGesture({ dominio: "obito", fazendaId: farmId, animalId, eventId, causa: "doenca" });
    await createGesture(farmId, built.ops, { deathConsequences: { animalId, eventId } });
    expect(await db.ops_sanitario_agenda_animais_v2.get([sanitaryAgenda, animalId])).toMatchObject({ planned_status: "nao_executado", not_executed_reason: `obito:${eventId}` });
    expect(await db.ops_sanitario_agenda_animais_v2.get([sanitaryAgenda, otherAnimal])).toMatchObject({ planned_status: "planejado" });
    const commands = await db.queue_ops.filter(op => op.record?.command === "death_participant").toArray();
    expect(commands).toHaveLength(1);
    expect(commands[0].record.payload).toMatchObject({ agenda_id: sanitaryAgenda, animal_id: animalId, death_event_id: eventId });
  });

  it("não altera participante cuja execução já foi confirmada", async () => {
    const sanitaryAgenda = crypto.randomUUID();
    const executionId = crypto.randomUUID();
    await db.ops_sanitario_agenda_v2.put({ id: sanitaryAgenda, fazenda_id: farmId, status: "programada", deleted_at: null } as never);
    await db.ops_sanitario_agenda_animais_v2.put({ agenda_id: sanitaryAgenda, animal_id: animalId, fazenda_id: farmId, planned_status: "executado", execution_evento_id: executionId } as never);
    const built = buildEventGesture({ dominio: "obito", fazendaId: farmId, animalId, eventId, causa: "doenca" });
    await createGesture(farmId, built.ops, { deathConsequences: { animalId, eventId } });
    expect(await db.ops_sanitario_agenda_animais_v2.get([sanitaryAgenda, animalId])).toMatchObject({ planned_status: "executado", execution_evento_id: executionId });
    expect(await db.queue_ops.filter(op => op.record?.command === "death_participant").count()).toBe(0);
  });

  it.each([
    { status: "agendado", agendaFarm: farmId, agendaAnimal: animalId, expected: "cancelado" },
    { status: "concluido", agendaFarm: farmId, agendaAnimal: animalId, expected: "concluido" },
    { status: "agendado", agendaFarm: farmId, agendaAnimal: otherAnimalId, expected: "agendado" },
    { status: "agendado", agendaFarm: otherFarmId, agendaAnimal: animalId, expected: "agendado" },
  ] as const)("preserva fato e aplica apenas transição válida: $status, $agendaFarm, $agendaAnimal", async ({ status, agendaFarm, agendaAnimal, expected }) => {
    await db.state_agenda_itens.put({
      id: agendaId,
      fazenda_id: agendaFarm,
      animal_id: agendaAnimal,
      status,
      dominio: "pesagem",
      deleted_at: null,
    } as AgendaItem);

    await registerDeath();

    expect(await db.event_eventos.get(eventId)).toMatchObject({ dominio: "obito", fazenda_id: farmId, animal_id: animalId });
    expect((await db.state_animais.get(animalId))?.status).toBe("morto");
    expect(await db.state_agenda_itens.get(agendaId)).toMatchObject({ fazenda_id: agendaFarm, animal_id: agendaAnimal, status: expected });
  });

  it.each(["ecc", "comercial", "pastagem"] as const)("cancela também Agenda não sanitária de %s", async (dominio) => {
    await db.state_agenda_itens.put({ id: agendaId, fazenda_id: farmId, animal_id: animalId, status: "agendado", dominio, deleted_at: null } as AgendaItem);
    await registerDeath();
    expect((await db.state_agenda_itens.get(agendaId))?.status).toBe("cancelado");
  });
});
