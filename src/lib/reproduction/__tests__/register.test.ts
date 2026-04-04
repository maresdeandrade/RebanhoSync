import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventValidationError } from "@/lib/events/validators";
import { db } from "@/lib/offline/db";
import {
  buildReproductionGesture,
  prepareReproductionGesture,
  registerReproductionGesture,
} from "../register";

describe("buildReproductionGesture", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    await db.state_animais.clear();
    await db.event_eventos.clear();
    await db.event_eventos_reproducao.clear();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.state_animais.clear();
    await db.event_eventos.clear();
    await db.event_eventos_reproducao.clear();
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

    expect(result.ops).toHaveLength(3);
    expect(result.ops[2]?.table).toBe("animais");
    expect(result.ops[2]?.record.identificacao).toBe("BZ-001");
    expect(result.ops[2]?.record.mae_id).toBe("matriz-1");
    expect(result.ops[2]?.record.pai_id).toBe("touro-1");
    expect(result.ops[2]?.record.origem).toBe("nascimento");
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
