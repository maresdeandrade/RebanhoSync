import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventValidationError } from "@/lib/events/validators";
import { db } from "@/lib/offline/db";
import {
  buildReproductionGesture,
  prepareReproductionGesture,
  registerReproductionGesture,
} from "../register";

async function seedAnimal(id: string) {
  const now = new Date().toISOString();
  await db.state_animais.add({
    id,
    fazenda_id: "farm-1",
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
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

async function seedService({
  id,
  animalId,
  fazendaId = "farm-1",
  tipo = "cobertura",
  occurredAt = "2026-01-10T10:00:00.000Z",
}: {
  id: string;
  animalId: string;
  fazendaId?: string;
  tipo?: "cobertura" | "IA" | "diagnostico";
  occurredAt?: string;
}) {
  const now = "2026-03-20T10:00:00.000Z";
  await db.event_eventos.add({
    id,
    fazenda_id: fazendaId,
    dominio: "reproducao",
    occurred_at: occurredAt,
    animal_id: animalId,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  await db.event_eventos_reproducao.add({
    evento_id: id,
    fazenda_id: fazendaId,
    tipo,
    macho_id: "touro-1",
    payload: { schema_version: 1 },
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

describe("buildReproductionGesture", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    await db.state_animais.clear();
    await db.event_eventos.clear();
    await db.event_eventos_reproducao.clear();
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.state_agenda_itens.clear();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.state_animais.clear();
    await db.event_eventos.clear();
    await db.event_eventos_reproducao.clear();
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.state_agenda_itens.clear();
  });

  it("requires male for cobertura and IA", () => {
    expect(() =>
      buildReproductionGesture({
        fazendaId: "farm-1",
        animalId: "animal-1",
        data: {
          tipo: "cobertura",
          machoId: null,
        },
      }),
    ).toThrowError(EventValidationError);
  });

  it("blocks parto marked as unlinked", () => {
    expect(() =>
      buildReproductionGesture({
        fazendaId: "farm-1",
        animalId: "animal-1",
        data: {
          tipo: "parto",
          episodeLinkMethod: "unlinked",
        },
      }),
    ).toThrowError(EventValidationError);
  });

  it("builds a valid diagnostico gesture with linked episode", () => {
    const result = buildReproductionGesture({
      fazendaId: "farm-1",
      animalId: "animal-1",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        dataPrevistaParto: "2026-10-10",
        episodeLinkMethod: "manual",
        episodeEventoId: "evento-servico-1",
      },
    });

    expect(result.ops).toHaveLength(2);
    expect(result.ops[1]?.table).toBe("eventos_reproducao");
    expect(result.ops[1]?.record.payload.resultado).toBe("positivo");
    expect(result.ops[1]?.record.payload.episode_evento_id).toBe(
      "evento-servico-1",
    );
  });

  it("generates DPP automatically for cobertura using service date plus 283 days", async () => {
    const result = await prepareReproductionGesture({
      fazendaId: "farm-1",
      animalId: "animal-1",
      occurredAt: "2026-01-10T10:00:00.000Z",
      data: {
        tipo: "cobertura",
        machoId: "touro-1",
      },
    });

    expect(result.ops[1]?.record.payload.data_prevista_parto).toBe("2026-10-20");
  });

  it("generates DPP automatically for positive diagnostico from linked service", async () => {
    const now = "2026-03-20T10:00:00.000Z";

    await db.event_eventos.add({
      id: "servico-dpp-1",
      fazenda_id: "farm-1",
      dominio: "reproducao",
      occurred_at: "2026-01-10T10:00:00.000Z",
      animal_id: "matriz-1",
      lote_id: "maternidade",
      source_task_id: null,
      source_tx_id: null,
      source_client_op_id: null,
      corrige_evento_id: null,
      observacoes: null,
      payload: {},
      client_id: "client-1",
      client_op_id: "op-dpp-1",
      client_tx_id: "tx-dpp-1",
      client_recorded_at: now,
      server_received_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    await db.event_eventos_reproducao.add({
      evento_id: "servico-dpp-1",
      fazenda_id: "farm-1",
      tipo: "IA",
      macho_id: "touro-1",
      payload: {
        schema_version: 1,
      },
      client_id: "client-1",
      client_op_id: "op-dpp-1",
      client_tx_id: "tx-dpp-1",
      client_recorded_at: now,
      server_received_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    const result = await prepareReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-1",
      occurredAt: "2026-03-30T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        episodeLinkMethod: "manual",
        episodeEventoId: "servico-dpp-1",
      },
    });

    expect(result.ops[1]?.record.payload.data_prevista_parto).toBe("2026-10-20");
  });

  it("adds a taxonomy facts update after positive diagnostico", async () => {
    await seedAnimal("matriz-tax-1");
    await seedService({ id: "service-tax-1", animalId: "matriz-tax-1" });

    const result = await prepareReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-tax-1",
      occurredAt: "2026-03-30T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        dataPrevistaParto: "2026-11-01",
        episodeEventoId: "service-tax-1",
        episodeLinkMethod: "manual",
      },
    });

    const updateOp = result.ops.find(
      (op) => op.table === "animais" && op.action === "UPDATE",
    );

    expect(updateOp).toBeTruthy();
    expect(updateOp?.record.payload.taxonomy_facts).toMatchObject({
      prenhez_confirmada: true,
      data_prevista_parto: "2026-11-01",
    });
  });

  it("accepts PRENHA linked to IA and preserves explicit DPP", async () => {
    await seedService({ id: "ia-1", animalId: "matriz-ia", tipo: "IA" });

    const result = await prepareReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-ia",
      occurredAt: "2026-02-20T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        episodeEventoId: "ia-1",
        dataPrevistaParto: "2026-10-25",
      },
    });

    expect(result.projection).toMatchObject({
      status: "PRENHA",
      currentEpisodeId: "ia-1",
      dpp: "2026-10-25",
      dppOrigin: "explicit",
    });
  });

  it.each([
    ["missing service", "missing", "matriz-valid", "farm-1"],
    ["other animal", "other-animal", "matriz-valid", "farm-1"],
    ["other farm", "other-farm", "matriz-valid", "farm-1"],
    ["incompatible type", "diagnosis", "matriz-valid", "farm-1"],
  ])("rejects diagnosis linked to %s", async (_label, serviceId, animalId, farmId) => {
    if (serviceId === "other-animal") {
      await seedService({ id: serviceId, animalId: "matriz-other" });
    } else if (serviceId === "other-farm") {
      await seedService({ id: serviceId, animalId, fazendaId: "farm-other" });
    } else if (serviceId === "diagnosis") {
      await seedService({ id: serviceId, animalId, tipo: "diagnostico" });
    }

    await expect(
      prepareReproductionGesture({
        fazendaId: farmId,
        animalId,
        occurredAt: "2026-02-20T10:00:00.000Z",
        data: {
          tipo: "diagnostico",
          resultadoDiagnostico: "positivo",
          episodeEventoId: serviceId,
        },
      }),
    ).rejects.toBeInstanceOf(EventValidationError);
  });

  it("keeps VAZIA as history and clears pregnancy cache without creating agenda", async () => {
    await seedAnimal("matriz-vazia");
    await seedService({ id: "service-vazia", animalId: "matriz-vazia" });
    await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-vazia",
      eventId: "diag-prenha",
      occurredAt: "2026-02-15T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        episodeEventoId: "service-vazia",
      },
    });

    const result = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-vazia",
      eventId: "diag-vazia",
      occurredAt: "2026-02-20T10:00:00.000Z",
      data: {
        tipo: "diagnostico",
        resultadoDiagnostico: "negativo",
        episodeEventoId: "service-vazia",
        dataPrevistaParto: "2026-12-31",
      },
    });

    expect(result.projection).toMatchObject({ status: "VAZIA", dpp: null });
    expect(await db.event_eventos.get("service-vazia")).toBeDefined();
    expect(await db.event_eventos.get("diag-vazia")).toBeDefined();
    expect(
      (await db.event_eventos_reproducao.get("diag-vazia"))?.payload,
    ).not.toHaveProperty("data_prevista_parto");
    const taxonomyFacts = (await db.state_animais.get("matriz-vazia"))?.payload
      .taxonomy_facts;
    expect(taxonomyFacts).toMatchObject({ prenhez_confirmada: false });
    expect(taxonomyFacts).not.toHaveProperty("data_prevista_parto");
    expect(await db.state_agenda_itens.count()).toBe(0);
  });

  it("retries the same event identity without duplicating fact or queue", async () => {
    await seedService({ id: "service-retry", animalId: "matriz-retry" });
    const input = {
      fazendaId: "farm-1",
      animalId: "matriz-retry",
      eventId: "diag-retry",
      occurredAt: "2026-02-20T10:00:00.000Z",
      data: {
        tipo: "diagnostico" as const,
        resultadoDiagnostico: "positivo",
        episodeEventoId: "service-retry",
      },
    };

    const first = await registerReproductionGesture(input);
    const counts = {
      events: await db.event_eventos.count(),
      details: await db.event_eventos_reproducao.count(),
      queue: await db.queue_ops.count(),
    };
    const second = await registerReproductionGesture(input);

    expect(second.txId).toBe(first.txId);
    expect(await db.event_eventos.count()).toBe(counts.events);
    expect(await db.event_eventos_reproducao.count()).toBe(counts.details);
    expect(await db.queue_ops.count()).toBe(counts.queue);
  });

  it("rejects different content with the same event identity", async () => {
    await seedService({ id: "service-conflict", animalId: "matriz-conflict" });
    const baseInput = {
      fazendaId: "farm-1",
      animalId: "matriz-conflict",
      eventId: "diag-conflict",
      occurredAt: "2026-02-20T10:00:00.000Z",
      data: {
        tipo: "diagnostico" as const,
        resultadoDiagnostico: "positivo",
        episodeEventoId: "service-conflict",
      },
    };
    await registerReproductionGesture(baseInput);

    await expect(
      registerReproductionGesture({
        ...baseInput,
        data: { ...baseInput.data, resultadoDiagnostico: "negativo" },
      }),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "REPRO_OPERATION_IDENTITY_CONFLICT" })],
    });
  });

  it("rolls back event, detail, cache and queue when the Dexie transaction fails", async () => {
    await seedAnimal("matriz-rollback");
    await seedService({ id: "service-rollback", animalId: "matriz-rollback" });
    const failDetail = () => {
      throw new Error("forced detail failure");
    };
    db.event_eventos_reproducao.hook("creating", failDetail);

    try {
      await expect(
        registerReproductionGesture({
          fazendaId: "farm-1",
          animalId: "matriz-rollback",
          eventId: "diag-rollback",
          occurredAt: "2026-02-20T10:00:00.000Z",
          data: {
            tipo: "diagnostico",
            resultadoDiagnostico: "positivo",
            episodeEventoId: "service-rollback",
          },
        }),
      ).rejects.toThrow("forced detail failure");
    } finally {
      db.event_eventos_reproducao.hook("creating").unsubscribe(failDetail);
    }

    expect(await db.event_eventos.get("diag-rollback")).toBeUndefined();
    expect(
      await db.event_eventos_reproducao.get("diag-rollback"),
    ).toBeUndefined();
    expect(
      (await db.state_animais.get("matriz-rollback"))?.payload.taxonomy_facts,
    ).toBeUndefined();
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.queue_gestures.count()).toBe(0);
  });

  it("adds a taxonomy facts update after parto", async () => {
    await seedAnimal("matriz-tax-2");

    const result = await prepareReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-tax-2",
      occurredAt: "2026-03-30T10:00:00.000Z",
      data: {
        tipo: "parto",
        dataParto: "2026-03-30",
        numeroCrias: 1,
        episodeLinkMethod: "manual",
        episodeEventoId: "servico-1",
      },
    });

    const updateOp = result.ops.find(
      (op) => op.table === "animais" && op.action === "UPDATE",
    );

    expect(updateOp).toBeTruthy();
    expect(updateOp?.record.payload.taxonomy_facts).toMatchObject({
      prenhez_confirmada: false,
      data_ultimo_parto: "2026-03-30",
      em_lactacao: true,
      secagem_realizada: false,
      puberdade_confirmada: true,
    });
  });

  it("creates calf insert ops on parto with maternal and paternal linkage", () => {
    const result = buildReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-1",
      animalIdentificacao: "MAT-001",
      loteId: "maternidade",
      paiId: "touro-1",
      data: {
        tipo: "parto",
        dataParto: "2026-03-30",
        numeroCrias: 1,
        episodeLinkMethod: "manual",
        episodeEventoId: "servico-1",
        crias: [
          {
            localId: "cria-1",
            identificacao: "BZ-001",
            sexo: "F",
            nome: "Aurora",
          },
        ],
      },
    });

    expect(result.ops).toHaveLength(9);
    expect(result.ops[2]?.table).toBe("animais");
    expect(result.ops[2]?.record.identificacao).toBe("BZ-001");
    expect(result.ops[2]?.record.mae_id).toBe("matriz-1");
    expect(result.ops[2]?.record.pai_id).toBe("touro-1");
    expect(result.ops[2]?.record.origem).toBe("nascimento");
    const umbigoAgendaOps = result.ops.filter(
      (op) => op.table === "agenda_itens" && op.record.tipo === "cura_umbigo",
    );
    expect(umbigoAgendaOps).toHaveLength(6);
    expect(umbigoAgendaOps[0]?.record.payload).toMatchObject({
      schedule_kind: "twice_daily_until_dry",
      stop_condition: "umbigo_completamente_seco",
    });
  });

  it("resolves sire from linked service before generating calf ops", async () => {
    const now = "2026-03-20T10:00:00.000Z";

    await db.event_eventos.add({
      id: "servico-1",
      fazenda_id: "farm-1",
      dominio: "reproducao",
      occurred_at: "2026-01-10T10:00:00.000Z",
      animal_id: "matriz-1",
      lote_id: "maternidade",
      source_task_id: null,
      source_tx_id: null,
      source_client_op_id: null,
      corrige_evento_id: null,
      observacoes: null,
      payload: {},
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: "tx-1",
      client_recorded_at: now,
      server_received_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    await db.event_eventos_reproducao.add({
      evento_id: "servico-1",
      fazenda_id: "farm-1",
      tipo: "cobertura",
      macho_id: "touro-9",
      payload: {
        schema_version: 1,
      },
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: "tx-1",
      client_recorded_at: now,
      server_received_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    const result = await prepareReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-1",
      animalIdentificacao: "MAT-001",
      loteId: "maternidade",
      occurredAt: "2026-03-30T10:00:00.000Z",
      data: {
        tipo: "parto",
        dataParto: "2026-03-30",
        numeroCrias: 1,
        episodeLinkMethod: "manual",
        episodeEventoId: "servico-1",
      },
    });

    expect(result.ops[2]?.table).toBe("animais");
    expect(result.ops[2]?.record.pai_id).toBe("touro-9");
    expect(result.ops[2]?.record.mae_id).toBe("matriz-1");
  });

  it("returns calf ids after registering parto", async () => {
    const result = await registerReproductionGesture({
      fazendaId: "farm-1",
      animalId: "matriz-1",
      animalIdentificacao: "MAT-001",
      loteId: "maternidade",
      data: {
        tipo: "parto",
        dataParto: "2026-03-30",
        numeroCrias: 2,
        episodeLinkMethod: "manual",
        episodeEventoId: "servico-1",
        crias: [
          {
            localId: "cria-a",
            identificacao: "BZ-101",
            sexo: "F",
          },
          {
            localId: "cria-b",
            identificacao: "BZ-102",
            sexo: "M",
          },
        ],
      },
    });

    expect(result.eventId).toBeTruthy();
    expect(result.txId).toBeTruthy();
    expect(result.calfIds).toEqual(["cria-a", "cria-b"]);

    const calves = await db.state_animais.bulkGet(result.calfIds);
    expect(calves[0]?.mae_id).toBe("matriz-1");
    expect(calves[1]?.identificacao).toBe("BZ-102");
  });
});
