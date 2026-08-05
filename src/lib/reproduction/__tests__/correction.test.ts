import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { getBirthEventId } from "@/lib/reproduction/neonatal";
import { rebuildReproductiveProjection } from "../status";
import { registerReproductionGesture } from "../register";

async function seedAnimal(id: string, fazendaId = "farm-1") {
  const now = "2026-01-01T10:00:00.000Z";
  await db.state_animais.add({
    id,
    fazenda_id: fazendaId,
    identificacao: id.toUpperCase(),
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2024-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-test",
    client_op_id: `animal-${id}`,
    client_tx_id: `tx-animal-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

async function registerService(
  animalId: string,
  eventId: string,
  occurredAt = "2026-01-10T10:00:00.000Z",
) {
  return registerReproductionGesture({
    fazendaId: "farm-1",
    animalId,
    eventId,
    occurredAt,
    data: { tipo: "cobertura", machoId: "bull-1" },
  });
}

async function registerDiagnosis(input: {
  animalId: string;
  eventId: string;
  episodeId: string;
  result: "positivo" | "negativo";
  occurredAt?: string;
}) {
  return registerReproductionGesture({
    fazendaId: "farm-1",
    animalId: input.animalId,
    eventId: input.eventId,
    occurredAt: input.occurredAt ?? "2026-02-10T10:00:00.000Z",
    data: {
      tipo: "diagnostico",
      resultadoDiagnostico: input.result,
      episodeEventoId: input.episodeId,
    },
  });
}

describe("append-only reproductive corrections", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    await db.state_agenda_itens.clear();
    await db.state_animais.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.state_agenda_itens.clear();
    await db.state_animais.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
  });

  it("creates a diagnosis correction, preserves the original and recalculates PRENHA to VAZIA", async () => {
    await seedAnimal("cow-diagnosis");
    await registerService("cow-diagnosis", "service-diagnosis");
    await registerDiagnosis({
      animalId: "cow-diagnosis",
      eventId: "diagnosis-original",
      episodeId: "service-diagnosis",
      result: "positivo",
    });
    const original = await db.event_eventos.get("diagnosis-original");

    const corrected = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-diagnosis",
      eventId: "diagnosis-correction",
      corrigeEventoId: "diagnosis-original",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "negativo",
        dataPrevistaParto: null,
      },
    });

    expect(await db.event_eventos.get("diagnosis-original")).toEqual(original);
    expect(await db.event_eventos.get("diagnosis-correction")).toMatchObject({
      corrige_evento_id: "diagnosis-original",
      payload: {
        reproduction_correction: {
          nature: "correction",
          corrected_event_id: "diagnosis-original",
        },
      },
    });
    expect(corrected.projection).toMatchObject({
      status: "VAZIA",
      currentEpisodeId: null,
      dpp: null,
      lastDiagnosisEventId: "diagnosis-correction",
      inconsistency: null,
    });
    expect(
      (await db.state_animais.get("cow-diagnosis"))?.payload.taxonomy_facts,
    ).toMatchObject({ prenhez_confirmada: false });
  });

  it("recalculates VAZIA to PRENHA using a valid explicit DPP", async () => {
    await seedAnimal("cow-positive");
    await registerService("cow-positive", "service-positive");
    await registerDiagnosis({
      animalId: "cow-positive",
      eventId: "diagnosis-negative",
      episodeId: "service-positive",
      result: "negativo",
    });

    const corrected = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-positive",
      eventId: "diagnosis-positive-correction",
      corrigeEventoId: "diagnosis-negative",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        dataPrevistaParto: "2026-10-30",
      },
    });

    expect(corrected.projection).toMatchObject({
      status: "PRENHA",
      currentEpisodeId: "service-positive",
      dpp: "2026-10-30",
      dppOrigin: "explicit",
      inconsistency: null,
    });

    const latest = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-positive",
      eventId: "diagnosis-linear-correction",
      corrigeEventoId: "diagnosis-positive-correction",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "negativo",
        dataPrevistaParto: null,
      },
    });
    expect(latest.projection).toMatchObject({
      status: "VAZIA",
      lastDiagnosisEventId: "diagnosis-linear-correction",
      inconsistency: null,
    });
  });

  it("keeps a later pregnancy when an abortion is corrected to an older episode", async () => {
    await seedAnimal("cow-loss");
    await registerService("cow-loss", "service-old", "2026-01-01T10:00:00.000Z");
    await registerService("cow-loss", "service-current", "2026-02-01T10:00:00.000Z");
    await registerDiagnosis({
      animalId: "cow-loss",
      eventId: "diagnosis-current",
      episodeId: "service-current",
      result: "positivo",
      occurredAt: "2026-03-01T10:00:00.000Z",
    });
    await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-loss",
      eventId: "loss-original",
      occurredAt: "2026-03-15T10:00:00.000Z",
      data: { tipo: "aborto" },
    });

    const corrected = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-loss",
      eventId: "loss-correction",
      corrigeEventoId: "loss-original",
      occurredAt: "2026-03-15T10:00:00.000Z",
      data: { tipo: "aborto", episodeEventoId: "service-old" },
    });

    expect(corrected.projection).toMatchObject({
      status: "PRENHA",
      currentEpisodeId: "service-current",
      lastLossDate: "2026-03-15",
      inconsistency: "EPISODE_NOT_CURRENT",
    });
  });

  it("corrects only the observation of a birth and preserves calf identities", async () => {
    await seedAnimal("cow-birth");
    const birth = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-birth",
      eventId: "birth-original",
      occurredAt: "2026-04-10T10:00:00.000Z",
      data: { tipo: "parto", dataParto: "2026-04-10", numeroCrias: 2 },
    });
    const agendaCount = await db.state_agenda_itens.count();

    await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-birth",
      eventId: "birth-correction",
      corrigeEventoId: "birth-original",
      data: { tipo: "parto", observacoes: "Parto assistido confirmado." },
    });

    const calves = await db.state_animais
      .filter((animal) => getBirthEventId(animal.payload) === "birth-original")
      .toArray();
    expect(calves.map((calf) => calf.id).sort()).toEqual([...birth.calfIds].sort());
    expect(await db.state_agenda_itens.count()).toBe(agendaCount);
    expect(
      await db.state_animais
        .filter((animal) => getBirthEventId(animal.payload) === "birth-correction")
        .count(),
    ).toBe(0);

    await expect(
      registerReproductionGesture({
        fazendaId: "farm-1",
        animalId: "cow-birth",
        eventId: "birth-invalid-correction",
        corrigeEventoId: "birth-correction",
        data: { tipo: "parto", numeroCrias: 1 },
      }),
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: "REPRO_CORRECTION_BIRTH_FIELDS_UNSUPPORTED",
        }),
      ],
    });
  });

  it("rejects another matrix or farm and rejects a branch", async () => {
    await seedAnimal("cow-owner");
    await seedAnimal("cow-other");
    await registerService("cow-owner", "service-owner");
    await registerDiagnosis({
      animalId: "cow-owner",
      eventId: "diagnosis-owner",
      episodeId: "service-owner",
      result: "positivo",
    });

    await expect(
      registerReproductionGesture({
        fazendaId: "farm-1",
        animalId: "cow-other",
        eventId: "wrong-animal-correction",
        corrigeEventoId: "diagnosis-owner",
        data: { tipo: "diagnostico", resultadoDiagnostico: "negativo" },
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "REPRO_CORRECTION_ANIMAL_MISMATCH" })],
    });
    await expect(
      registerReproductionGesture({
        fazendaId: "farm-other",
        animalId: "cow-owner",
        eventId: "wrong-farm-correction",
        corrigeEventoId: "diagnosis-owner",
        data: { tipo: "diagnostico", resultadoDiagnostico: "negativo" },
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "REPRO_CORRECTION_FARM_MISMATCH" })],
    });

    await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "cow-owner",
      eventId: "first-correction",
      corrigeEventoId: "diagnosis-owner",
      data: { tipo: "diagnostico", resultadoDiagnostico: "negativo" },
    });
    await expect(
      registerReproductionGesture({
        fazendaId: "farm-1",
        animalId: "cow-owner",
        eventId: "branch-correction",
        corrigeEventoId: "diagnosis-owner",
        data: { tipo: "diagnostico", resultadoDiagnostico: "positivo" },
      }),
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: "REPRO_CORRECTION_CHAIN_BRANCH_CONFLICT",
        }),
      ],
    });
  });

  it("replays the same correction and rejects divergent content", async () => {
    await seedAnimal("cow-retry");
    await registerService("cow-retry", "service-retry");
    await registerDiagnosis({
      animalId: "cow-retry",
      eventId: "diagnosis-retry",
      episodeId: "service-retry",
      result: "positivo",
    });
    const input = {
      fazendaId: "farm-1",
      animalId: "cow-retry",
      eventId: "correction-retry",
      corrigeEventoId: "diagnosis-retry",
      data: {
        tipo: "diagnostico" as const,
        resultadoDiagnostico: "negativo",
      },
    };

    const first = await registerReproductionGesture(input);
    const counts = {
      events: await db.event_eventos.count(),
      details: await db.event_eventos_reproducao.count(),
      ops: await db.queue_ops.count(),
    };
    const replay = await registerReproductionGesture(input);
    expect(replay.txId).toBe(first.txId);
    expect(await db.event_eventos.count()).toBe(counts.events);
    expect(await db.event_eventos_reproducao.count()).toBe(counts.details);
    expect(await db.queue_ops.count()).toBe(counts.ops);

    await expect(
      registerReproductionGesture({
        ...input,
        data: { ...input.data, observacoes: "different" },
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "REPRO_OPERATION_IDENTITY_CONFLICT" })],
    });
  });

  it("reports a branch explicitly while keeping taxonomy facts outside projection input", () => {
    const detail = (resultado: "positivo" | "negativo") => ({
      tipo: "diagnostico" as const,
      deleted_at: null,
      payload: {
        schema_version: 1,
        resultado,
        episode_evento_id: "service-projection",
      },
    });
    const correctionPayload = {
      reproduction_correction: { nature: "correction" },
    };
    const projection = rebuildReproductiveProjection([
      {
        id: "service-projection",
        fazenda_id: "farm-1",
        animal_id: "cow-projection",
        occurred_at: "2026-01-01T10:00:00.000Z",
        deleted_at: null,
        details: { tipo: "cobertura", payload: {}, deleted_at: null },
      },
      {
        id: "diagnosis-projection",
        fazenda_id: "farm-1",
        animal_id: "cow-projection",
        occurred_at: "2026-02-01T10:00:00.000Z",
        deleted_at: null,
        details: detail("positivo"),
      },
      ...["branch-a", "branch-b"].map((id) => ({
        id,
        fazenda_id: "farm-1",
        animal_id: "cow-projection",
        occurred_at: "2026-02-01T10:00:00.000Z",
        corrige_evento_id: "diagnosis-projection",
        payload: correctionPayload,
        deleted_at: null,
        details: detail("negativo"),
      })),
    ]);

    expect(projection.status).toBe("PRENHA");
    expect(projection.inconsistency).toBe("CORRECTION_CHAIN_BRANCH");
  });

  it("rolls back correction event, detail, cache and queue after an intermediate failure", async () => {
    await seedAnimal("cow-rollback");
    await registerService("cow-rollback", "service-rollback");
    await registerDiagnosis({
      animalId: "cow-rollback",
      eventId: "diagnosis-rollback",
      episodeId: "service-rollback",
      result: "positivo",
    });
    const originalFacts = (await db.state_animais.get("cow-rollback"))?.payload
      .taxonomy_facts;
    const queueCount = await db.queue_ops.count();
    const failDetail = () => {
      throw new Error("forced correction detail failure");
    };
    db.event_eventos_reproducao.hook("creating", failDetail);

    try {
      await expect(
        registerReproductionGesture({
          fazendaId: "farm-1",
          animalId: "cow-rollback",
          eventId: "correction-rollback",
          corrigeEventoId: "diagnosis-rollback",
          data: { tipo: "diagnostico", resultadoDiagnostico: "negativo" },
        }),
      ).rejects.toThrow("forced correction detail failure");
    } finally {
      db.event_eventos_reproducao.hook("creating").unsubscribe(failDetail);
    }

    expect(await db.event_eventos.get("correction-rollback")).toBeUndefined();
    expect(
      await db.event_eventos_reproducao.get("correction-rollback"),
    ).toBeUndefined();
    expect(
      (await db.state_animais.get("cow-rollback"))?.payload.taxonomy_facts,
    ).toEqual(originalFacts);
    expect(await db.queue_ops.count()).toBe(queueCount);
  });
});
