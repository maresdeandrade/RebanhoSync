import { describe, it, expect } from "vitest";
import { validateEccInput } from "@/lib/events/validators/ecc";
import { getLatestValidEcc } from "../eccHelpers";
import { buildLoteOccupancyMetrics } from "../buildLoteOccupancyMetrics";
import { buildPastoOccupancyMetrics } from "../buildPastoOccupancyMetrics";
import type { Evento, EventoEcc, Animal } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod } from "../occupancyTypes";

describe("Fase 2 — ECC and Occupancy Metrics Core", () => {
  describe("validateEccInput", () => {
    it("should accept valid ECC within default scale and step", () => {
      const input = {
        dominio: "ecc" as const,
        fazendaId: "farm-1",
        animalId: "animal-1",
        ecc: 3.25, // default min=1, max=5, step=0.25 -> valid
      };
      const issues = validateEccInput(input);
      expect(issues).toHaveLength(0);
    });

    it("should accept step boundary limits with floating point tolerance", () => {
      const input = {
        dominio: "ecc" as const,
        fazendaId: "farm-1",
        animalId: "animal-1",
        ecc: 2.50,
      };
      const issues = validateEccInput(input);
      expect(issues).toHaveLength(0);
    });

    it("should reject ECC outside the scale limits", () => {
      const input = {
        dominio: "ecc" as const,
        fazendaId: "farm-1",
        animalId: "animal-1",
        ecc: 5.25,
      };
      const issues = validateEccInput(input);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe("INVALID_RANGE");
    });

    it("should reject ECC that does not respect the scale step", () => {
      const input = {
        dominio: "ecc" as const,
        fazendaId: "farm-1",
        animalId: "animal-1",
        ecc: 3.10, // 3.10 is not a multiple of 0.25 starting from 1.00
      };
      const issues = validateEccInput(input);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe("INVALID_STEP");
    });
  });

  describe("getLatestValidEcc", () => {
    const animalId = "animal-1";
    const baseEvents: Evento[] = [
      {
        id: "ecc-1",
        fazenda_id: "farm-1",
        dominio: "ecc",
        occurred_at: "2026-05-10T12:00:00Z",
        animal_id: animalId,
        client_id: "c1",
        client_op_id: "o1",
        client_recorded_at: "2026-05-10T12:00:00Z",
        server_received_at: "2026-05-10T12:00:00Z",
        created_at: "2026-05-10T12:00:00Z",
        updated_at: "2026-05-10T12:00:00Z",
        deleted_at: null,
      },
      {
        id: "ecc-2",
        fazenda_id: "farm-1",
        dominio: "ecc",
        occurred_at: "2026-05-20T12:00:00Z", // Most recent factual date
        animal_id: animalId,
        client_id: "c1",
        client_op_id: "o2",
        client_recorded_at: "2026-05-20T12:00:00Z",
        server_received_at: "2026-05-20T12:00:00Z",
        created_at: "2026-05-20T12:00:00Z",
        updated_at: "2026-05-20T12:00:00Z",
        deleted_at: null,
      },
      {
        id: "ecc-deleted",
        fazenda_id: "farm-1",
        dominio: "ecc",
        occurred_at: "2026-05-25T12:00:00Z", // Factually newer, but soft-deleted
        animal_id: animalId,
        client_id: "c1",
        client_op_id: "o3",
        client_recorded_at: "2026-05-25T12:00:00Z",
        server_received_at: "2026-05-25T12:00:00Z",
        created_at: "2026-05-25T12:00:00Z",
        updated_at: "2026-05-25T12:00:00Z",
        deleted_at: "2026-05-25T12:30:00Z",
      },
    ];

    const eccDetails: EventoEcc[] = [
      {
        event_id: "ecc-1",
        fazenda_id: "farm-1",
        animal_id: animalId,
        ecc: 3.0,
        escala_min: 1,
        escala_max: 5,
        escala_passo: 0.25,
        payload: {},
        client_id: "c1",
        client_op_id: "o1",
        client_recorded_at: "2026-05-10T12:00:00Z",
        created_at: "2026-05-10T12:00:00Z",
        updated_at: "2026-05-10T12:00:00Z",
        deleted_at: null,
        client_tx_id: null,
      },
      {
        event_id: "ecc-2",
        fazenda_id: "farm-1",
        animal_id: animalId,
        ecc: 3.75,
        escala_min: 1,
        escala_max: 5,
        escala_passo: 0.25,
        payload: {},
        client_id: "c1",
        client_op_id: "o2",
        client_recorded_at: "2026-05-20T12:00:00Z",
        created_at: "2026-05-20T12:00:00Z",
        updated_at: "2026-05-20T12:00:00Z",
        deleted_at: null,
        client_tx_id: null,
      },
      {
        event_id: "ecc-deleted",
        fazenda_id: "farm-1",
        animal_id: animalId,
        ecc: 4.5,
        escala_min: 1,
        escala_max: 5,
        escala_passo: 0.25,
        payload: {},
        client_id: "c1",
        client_op_id: "o3",
        client_recorded_at: "2026-05-25T12:00:00Z",
        created_at: "2026-05-25T12:00:00Z",
        updated_at: "2026-05-25T12:00:00Z",
        deleted_at: null, // base is deleted
        client_tx_id: null,
      },
    ];

    const baseEventsMap = new Map<string, Evento>(baseEvents.map((e) => [e.id, e]));

    it("should select the most recent valid ECC factual event, ignoring deleted ones", () => {
      const result = getLatestValidEcc(animalId, eccDetails, baseEventsMap);
      expect(result).not.toBeNull();
      expect(result!.event_id).toBe("ecc-2");
      expect(result!.ecc).toBe(3.75);
    });
  });

  describe("buildLoteOccupancyMetrics", () => {
    const activeAnimals: Animal[] = [
      {
        id: "a1",
        fazenda_id: "farm-1",
        identificacao: "BR-01",
        status: "ativo",
        lote_id: "lote-1",
        client_id: "c1",
        client_op_id: "o1",
        client_tx_id: null,
        client_recorded_at: "2026-01-01T00:00:00Z",
        server_received_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
        sexo: "F",
      },
      {
        id: "a2",
        fazenda_id: "farm-1",
        identificacao: "BR-02",
        status: "ativo",
        lote_id: "lote-1",
        client_id: "c1",
        client_op_id: "o1",
        client_tx_id: null,
        client_recorded_at: "2026-01-01T00:00:00Z",
        server_received_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
        sexo: "F",
      },
    ];

    const latestEccsMap = new Map<string, number>([
      ["a1", 3.5], // a1 evaluated, a2 has no ECC
    ]);

    it("should calculate average ECC and list animals without ECC", () => {
      const metrics = buildLoteOccupancyMetrics({
        loteId: "lote-1",
        animalPeriods: [],
        totalAnimalsInLote: 2,
        activeAnimals,
        latestEccsMap,
        lastMovementDate: null,
        categoriaPredominante: "Novilha",
      });

      expect(metrics.eccMedioAtual).toBe(3.5);
      expect(metrics.eccCobertura.avaliados).toBe(1);
      expect(metrics.eccCobertura.total).toBe(2);
      expect(metrics.animaisSemEcc).toEqual(["BR-02"]);
      expect(metrics.eccStatus.status).toBe("partial");
      expect(metrics.tempoLotacaoStatus.status).toBe("empty"); // movement absent
    });

    it("should correctly calculate GMD with 2 pesagens and block with 1", () => {
      const period1: AnimalOccupancyPeriod = {
        animalId: "a1",
        loteId: "lote-1",
        pastoId: "pasto-1",
        entradaAt: "2026-01-01T00:00:00Z",
        saidaAt: null,
        dias: 30,
        pesoInicial: 200,
        pesoFinal: 230,
        ganho: 30,
        gmd: 1.0, // 30kg / 30 dias
        weightStatus: { status: "complete" }, // has 2 weightings
        eccStatus: { status: "empty" },
      };

      const period2: AnimalOccupancyPeriod = {
        animalId: "a2",
        loteId: "lote-1",
        pastoId: "pasto-1",
        entradaAt: "2026-01-01T00:00:00Z",
        saidaAt: null,
        dias: 30,
        weightStatus: { status: "partial", reason: "Apenas uma pesagem" }, // blocked GMD
        eccStatus: { status: "empty" },
      };

      const metrics = buildLoteOccupancyMetrics({
        loteId: "lote-1",
        animalPeriods: [period1, period2],
        totalAnimalsInLote: 2,
        activeAnimals,
        latestEccsMap,
        lastMovementDate: "2026-01-01T00:00:00Z",
        categoriaPredominante: "Novilha",
      });

      expect(metrics.weightStatus.status).toBe("complete");
      expect(metrics.gmdEstimado).toBe(1.0); // only period1 has complete status
      expect(metrics.tempoLotacaoStatus.status).toBe("complete"); // movement present
    });
  });
});
