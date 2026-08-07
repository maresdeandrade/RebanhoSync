import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
} from "@/lib/animals/taxonomy";
import { db } from "@/lib/offline/db";
import type { Animal } from "@/lib/offline/types";
import { registerReproductionGesture } from "@/lib/reproduction/register";
import { getReproductionEventsJoined } from "@/lib/reproduction/selectors";

const FARM_ID = "farm-phase-13";

async function seedAnimal(
  id: string,
  sexo: Animal["sexo"],
  overrides: Partial<Animal> = {},
) {
  const now = "2026-08-07T10:00:00.000Z";
  await db.state_animais.add({
    id,
    fazenda_id: FARM_ID,
    identificacao: id.toUpperCase(),
    sexo,
    status: "ativo",
    lote_id: null,
    data_nascimento: "2022-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: sexo === "M" ? "reprodutor" : null,
    habilitado_monta: sexo === "M",
    observacoes: null,
    payload: {},
    client_id: "client-phase-13",
    client_op_id: `seed-${id}`,
    client_tx_id: `seed-tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  });
}

async function clearReproductionSmokeData() {
  await db.state_animais.clear();
  await db.event_eventos.clear();
  await db.event_eventos_reproducao.clear();
  await db.ops_sanitario_agenda_v2.clear();
  await db.ops_sanitario_agenda_animais_v2.clear();
  await db.state_agenda_itens.clear();
  await db.queue_ops.clear();
  await db.queue_gestures.clear();
}

describe("Fase 13 functional smoke", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    await clearReproductionSmokeData();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearReproductionSmokeData();
  });

  it("caminho A: IA, diagnostico positivo, parto, cria e seis Agendas neonatais", async () => {
    await seedAnimal("matriz-a", "F");
    await seedAnimal("touro-a", "M");

    const service = await registerReproductionGesture({
      fazendaId: FARM_ID,
      animalId: "matriz-a",
      eventId: "servico-a",
      occurredAt: "2025-10-01T10:00:00.000Z",
      data: { tipo: "IA", machoId: "touro-a" },
    });
    const diagnosis = await registerReproductionGesture({
      fazendaId: FARM_ID,
      animalId: "matriz-a",
      eventId: "diagnostico-a",
      occurredAt: "2025-11-01T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        episodeEventoId: service.eventId,
      },
    });

    expect(diagnosis.projection).toMatchObject({
      status: "PRENHA",
      currentEpisodeId: service.eventId,
      dpp: "2026-07-11",
    });

    const birthInput = {
      fazendaId: FARM_ID,
      animalId: "matriz-a",
      eventId: "parto-a",
      occurredAt: "2026-07-11T10:00:00.000Z",
      data: {
        tipo: "parto" as const,
        dataParto: "2026-07-11",
        numeroCrias: 1,
        crias: [
          {
            localId: "cria-a",
            identificacao: "CRIA-A",
            sexo: "F" as const,
          },
        ],
      },
    };
    const birth = await registerReproductionGesture(birthInput);
    const countsAfterBirth = {
      events: await db.event_eventos.count(),
      details: await db.event_eventos_reproducao.count(),
      animals: await db.state_animais.count(),
      agendas: await db.ops_sanitario_agenda_v2.count(),
      agendaAnimals: await db.ops_sanitario_agenda_animais_v2.count(),
      queue: await db.queue_ops.count(),
    };

    expect(birth.projection).toMatchObject({
      status: "PARIDA_PUERPERIO",
      currentEpisodeId: null,
      dpp: null,
      lastBirthDate: "2026-07-11",
      inconsistency: null,
    });
    expect(birth.calfIds).toEqual(["cria-a"]);
    expect(await db.state_animais.get("cria-a")).toMatchObject({
      fazenda_id: FARM_ID,
      mae_id: "matriz-a",
      pai_id: "touro-a",
    });
    expect(countsAfterBirth).toMatchObject({
      events: 3,
      details: 3,
      animals: 3,
      agendas: 6,
      agendaAnimals: 6,
    });
    expect(await db.state_agenda_itens.count()).toBe(0);
    expect(
      (await db.ops_sanitario_agenda_v2.toArray()).every(
        (agenda) => agenda.fazenda_id === FARM_ID,
      ),
    ).toBe(true);

    const replay = await registerReproductionGesture(birthInput);
    expect(replay).toMatchObject({ txId: birth.txId, calfIds: ["cria-a"] });
    expect(await db.event_eventos.count()).toBe(countsAfterBirth.events);
    expect(await db.event_eventos_reproducao.count()).toBe(
      countsAfterBirth.details,
    );
    expect(await db.state_animais.count()).toBe(countsAfterBirth.animals);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(
      countsAfterBirth.agendas,
    );
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(
      countsAfterBirth.agendaAnimals,
    );
    expect(await db.queue_ops.count()).toBe(countsAfterBirth.queue);
  });

  it("caminho B: cobertura, diagnostico positivo e aborto encerram a gestacao", async () => {
    await seedAnimal("matriz-b", "F");
    await seedAnimal("touro-b", "M");

    const service = await registerReproductionGesture({
      fazendaId: FARM_ID,
      animalId: "matriz-b",
      eventId: "servico-b",
      occurredAt: "2026-01-10T10:00:00.000Z",
      data: { tipo: "cobertura", machoId: "touro-b" },
    });
    const diagnosis = await registerReproductionGesture({
      fazendaId: FARM_ID,
      animalId: "matriz-b",
      eventId: "diagnostico-b",
      occurredAt: "2026-02-10T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        episodeEventoId: service.eventId,
      },
    });
    expect(diagnosis.projection).toMatchObject({
      status: "PRENHA",
      currentEpisodeId: service.eventId,
      dpp: "2026-10-20",
    });

    const abortionInput = {
      fazendaId: FARM_ID,
      animalId: "matriz-b",
      eventId: "aborto-b",
      occurredAt: "2026-04-10T10:00:00.000Z",
      data: { tipo: "aborto" as const },
    };
    const abortion = await registerReproductionGesture(abortionInput);
    const queueCount = await db.queue_ops.count();

    expect(abortion.calfIds).toEqual([]);
    expect(abortion.projection).toMatchObject({
      status: "VAZIA",
      currentEpisodeId: null,
      dpp: null,
      lastLossDate: "2026-04-10",
      inconsistency: null,
    });
    expect(await db.event_eventos.count()).toBe(3);
    expect(await db.event_eventos_reproducao.count()).toBe(3);
    expect(await db.state_animais.count()).toBe(2);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(0);

    const canonicalContext = buildAnimalTaxonomyReproContextMap(
      await getReproductionEventsJoined(FARM_ID),
    ).get("matriz-b");
    const matrix = await db.state_animais.get("matriz-b");
    const taxonomy = deriveAnimalTaxonomy(
      {
        ...matrix!,
        payload: {
          ...matrix!.payload,
          taxonomy_facts: {
            prenhez_confirmada: true,
            data_prevista_parto: "2099-01-01",
          },
        },
      },
      { reproContext: canonicalContext },
    );
    expect(taxonomy.facts.prenhez_confirmada).toBe(false);
    expect(taxonomy.facts.data_prevista_parto).toBeNull();

    const replay = await registerReproductionGesture(abortionInput);
    expect(replay.txId).toBe(abortion.txId);
    expect(await db.event_eventos.count()).toBe(3);
    expect(await db.event_eventos_reproducao.count()).toBe(3);
    expect(await db.queue_ops.count()).toBe(queueCount);
  });
});
