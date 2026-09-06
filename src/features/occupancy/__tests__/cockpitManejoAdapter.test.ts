// src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import { calculateLoteMetrics, calculatePastoMetrics } from "../cockpitManejoAdapter";
import type { Animal, Evento, EventoPesagem, EventoEcc, EventoMovimentacao, Pasto, Lote } from "../../../lib/offline/types";
import type { OccupancyAggregate } from "@/lib/occupancy/occupancyAggregation";
import type { OccupancyPerformanceAggregate } from "@/lib/occupancy/occupancyPerformance";

function observedPerformance(
  dimension: "LOT" | "PASTURE",
  groupId: string,
): OccupancyPerformanceAggregate {
  return {
    dimension,
    groupId,
    fazendaId: "faz-1",
    animalIds: ["ani-1"],
    meanInitialObservedWeightKg: 200,
    meanFinalObservedWeightKg: 210,
    meanWeightDeltaKg: 10,
    meanObservedGmdKgPerDay: 1,
    calculatedIntervals: 1,
    unavailableIntervals: 0,
    coverage: "PARTIAL_WEIGHT_COVERAGE",
    reliability: "UNCLASSIFIED",
    operationalUse: "NOT_AUTHORIZED",
    limitations: [],
    conflicts: [],
  };
}

function qualifiedDuration(
  dimension: "LOT" | "PASTURE",
  groupId: string,
  days: number,
  coverage: OccupancyAggregate["coverage"] = "COMPLETE",
): OccupancyAggregate {
  return {
    dimension,
    groupId,
    fazendaId: "faz-1",
    animalIds: ["ani-1"],
    knownDurationMs: days * 86_400_000,
    knownDurationDays: days,
    meanKnownDurationMs: days * 86_400_000,
    meanKnownDurationDays: days,
    maxKnownDurationMs: days * 86_400_000,
    maxKnownDurationDays: days,
    knownIntervals: 1,
    unknownIntervals: coverage === "COMPLETE" ? 0 : 1,
    coverage,
    limitations: [],
    conflicts: [],
  };
}

describe("cockpitManejoAdapter unit tests", () => {
  // Test Lote cockpit metrics calculations
  describe("calculateLoteMetrics", () => {
    const refDate = "2026-05-28";

    it("presents the qualified observed GMD aggregate", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculateLoteMetrics(
        "lote-1", refDate, 30, animals, events, pesagens, [], [], [], undefined,
        observedPerformance("LOT", "lote-1"),
      );
      expect(metrics.gmdMedio).toBe(1); // 10kg gain / 10 days = 1.0 kg/day
      expect(metrics.ganhoMedio).toBe(10); // 10kg gain
      expect(metrics.gmdStatus.status).toBe("partial");
      expect(metrics.gmdStatus.reason).toContain("GMD observado");
      expect(metrics.gmdStatus.limitation).toContain("não representa ganho de toda a permanência");
    });

    it("blocks GMD with less than 2 weights", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
      expect(metrics.gmdStatus.reason).toContain("Pesagens factuais insuficientes");
      expect(metrics.gmdStatus.limitation).toContain("não representa desempenho de toda a permanência");
    });

    it("blocks GMD with 0 days interval", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
    });

    it("ignores soft-deleted weights and excluded dead or sold animals", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "morto", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
        { id: "ani-2", status: "ativo", lote_id: "lote-1", rfid: null, identificacao: "A2", sexo: "F", fazenda_id: "faz-1", payload: {}, deleted_at: "2026-05-28" } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.quantidadeAtual).toBe(0);
      expect(metrics.gmdMedio).toBeNull();
    });

    it("calculates lotation UA correctly with fresh and stale weights", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
        { id: "ani-2", status: "ativo", lote_id: "lote-1", identificacao: "A2", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-2", occurred_at: "2026-04-10", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any,
        { evento_id: "evt-2", peso_kg: 450 } as any
      ];

      // freshness is 30 days. ani-2's weight is expired (April 10 vs May 28).
      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.uaTotal).toBe(2); // (450 + 450) / 450 = 2 UA
      expect(metrics.lotacaoStatus.status).toBe("partial"); // contains outdated weights
      expect(metrics.lotacaoStatus.limitation).toContain("desatualizados");
      expect(metrics.lotacaoStatus.limitation).toContain("peso explícito");
    });

    it("uses only qualified lot duration for permanence", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      // Movimentacao factual indicating entry on 2026-05-20
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-20", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_lote_id: "lote-1" } as any
      ];

      const metrics = calculateLoteMetrics(
        "lote-1", refDate, 30, animals, events, [], [], movimentacoes, [],
        qualifiedDuration("LOT", "lote-1", 3),
      );
      expect(metrics.tempoMedioPermanencia).toBe(3);
      expect(metrics.permanenciaStatus.source).toContain("Historical occupancy");
      expect(metrics.permanenciaStatus.status).toBe("complete");
    });

    it("does not silently fall back to movement entry when qualified duration is absent", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", rfid: null, identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-20", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_lote_id: "lote-1" } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, [], [], movimentacoes, []);
      expect(metrics.tempoMedioPermanencia).toBeNull();
      expect(metrics.permanenciaStatus.source).toContain("Historical occupancy");
      expect(metrics.permanenciaStatus.status).toBe("empty");
      expect(metrics.permanenciaStatus.limitation).toContain("não é usado como fallback");
    });
  });

  // Test Pasto cockpit metrics calculations
  describe("calculatePastoMetrics", () => {
    const refDate = "2026-05-28";
    const pastos: Pasto[] = [
      { id: "pasto-1", nome: "Pasto Verde", area_ha: 10 } as any
    ];
    const lotes: Lote[] = [
      { id: "lote-1", pasto_id: "pasto-1" } as any
    ];

    it("calculates stocking rate UA/ha correctly when area is valid", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any
      ];

      const metrics = calculatePastoMetrics(
        "pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], [], undefined,
        observedPerformance("PASTURE", "pasto-1"),
      );
      expect(metrics.uaTotal).toBe(1); // 450 / 450 = 1 UA
      expect(metrics.taxaLotacaoUaHa).toBe(0.1); // 1 UA / 10 ha = 0.1 UA/ha
      expect(metrics.taxaLotacaoStatus.status).toBe("complete");
      expect(metrics.taxaLotacaoStatus.limitation).toContain("area_ha válida");
      expect(metrics.taxaLotacaoStatus.limitation).toContain("peso explícito");
    });

    it("blocks stocking rate UA/ha when area is <= 0 or missing", () => {
      const pastosNoArea: Pasto[] = [
        { id: "pasto-1", nome: "Pasto Verde", area_ha: 0 } as any
      ];
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastosNoArea, events, pesagens, [], [], []);
      expect(metrics.taxaLotacaoUaHa).toBeNull();
      expect(metrics.taxaLotacaoStatus.status).toBe("bloqueado");
      expect(metrics.taxaLotacaoStatus.limitation).toContain("area_ha válida");
    });

    it("keeps pasture observed GMD qualified as partial", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculatePastoMetrics(
        "pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], [], undefined,
        observedPerformance("PASTURE", "pasto-1"),
      );
      expect(metrics.gmdMedio).toBe(1);
      expect(metrics.gmdStatus.status).toBe("partial");
      expect(metrics.gmdStatus.reason).toContain("GMD observado");
      expect(metrics.gmdStatus.limitation).toContain("não representa ganho de toda a permanência");
    });

    it("uses qualified partial pasture duration and propagates coverage", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-01", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_pasto_id: "pasto-1", to_lote_id: "lote-1" } as any
      ];
      const metrics = calculatePastoMetrics(
        "pasto-1", refDate, 30, animals, lotes, pastos, events, [], [], movimentacoes, [],
        qualifiedDuration("PASTURE", "pasto-1", 8, "PARTIAL"),
      );
      expect(metrics.tempoUsoDias).toBe(8);
      expect(metrics.permanenciaStatus.status).toBe("partial");
      expect(metrics.permanenciaStatus.source).toContain("Historical occupancy");
      expect(metrics.permanenciaStatus.limitation).toContain("Coverage: PARTIAL");
    });

    it("does not treat entry-only movement as a pasture duration fallback", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-20", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_pasto_id: "pasto-1", to_lote_id: "lote-1" } as any
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, [], [], movimentacoes, []);
      expect(metrics.tempoUsoDias).toBeNull();
      expect(metrics.permanenciaStatus.status).toBe("empty");
      expect(metrics.permanenciaStatus.source).toContain("Historical occupancy");
      expect(metrics.permanenciaStatus.limitation).toContain("não é usado como fallback");
    });
  });

  // Testes adicionais Fase 5.1
  describe("Testes adicionais Fase 5.1 — invariantes KPI", () => {
    const refDate = "2026-05-28";

    it("consome o GMD observado qualificado sem recalcular no cockpit", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics(
        "lote-1", refDate, 30, animals, events, pesagens, [], [], [], undefined,
        observedPerformance("LOT", "lote-1"),
      );
      expect(metrics.gmdMedio).toBe(1.0);
      expect(metrics.gmdStatus.status).toBe("partial");
    });

    it("pesagem com soft delete é ignorada no cálculo de GMD", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        // Este evento está deletado — não deve ser contado
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: "2026-05-28" } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      // Apenas 1 pesagem válida (evt-2 deletado), GMD deve ser bloqueado
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
    });

    it("animal morto é excluído do cálculo de GMD", () => {
      const animals: Animal[] = [
        { id: "ani-morto", status: "morto", lote_id: "lote-1", identificacao: "M1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-morto", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-morto", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      // Animal morto não está ativo, quantidadeAtual = 0 e gmdMedio = null
      expect(metrics.quantidadeAtual).toBe(0);
      expect(metrics.gmdMedio).toBeNull();
    });

it("animal vendido é excluído do cálculo de GMD", () => {
       const animals: Animal[] = [
         { id: "ani-vendido", status: "vendido", lote_id: "lote-1", identificacao: "V1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
       ];
       const events: Evento[] = [
         { id: "evt-1", dominio: "pesagem", animal_id: "ani-vendido", occurred_at: "2026-05-18", deleted_at: null } as any,
         { id: "evt-2", dominio: "pesagem", animal_id: "ani-vendido", occurred_at: "2026-05-28", deleted_at: null } as any,
       ];
       const pesagens: EventoPesagem[] = [
         { evento_id: "evt-1", peso_kg: 200 } as any,
         { evento_id: "evt-2", peso_kg: 210 } as any,
       ];

       const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
       expect(metrics.quantidadeAtual).toBe(0);
       expect(metrics.gmdMedio).toBeNull();
     });

     it("animal retirado é excluído do cálculo de GMD", () => {
       const animals: Animal[] = [
         { id: "ani-retirado", status: "retirado", lote_id: "lote-1", identificacao: "R1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
       ];
       const events: Evento[] = [
         { id: "evt-1", dominio: "pesagem", animal_id: "ani-retirado", occurred_at: "2026-05-18", deleted_at: null } as any,
         { id: "evt-2", dominio: "pesagem", animal_id: "ani-retirado", occurred_at: "2026-05-28", deleted_at: null } as any,
       ];
       const pesagens: EventoPesagem[] = [
         { evento_id: "evt-1", peso_kg: 200 } as any,
         { evento_id: "evt-2", peso_kg: 210 } as any,
       ];

       const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
       expect(metrics.quantidadeAtual).toBe(0);
       expect(metrics.gmdMedio).toBeNull();
     });

    it("mesmo dia (intervalo 0) bloqueia GMD", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        // Mesmo dia — intervalo 0 dias
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
      expect(metrics.gmdStatus.limitation).toContain("não representa desempenho de toda a permanência");
    });

    it("UA/ha bloqueia quando área do pasto é 0", () => {
      const pastos: Pasto[] = [
        { id: "pasto-1", nome: "Pasto", area_ha: 0 } as any,
      ];
      const lotes: Lote[] = [
        { id: "lote-1", pasto_id: "pasto-1" } as any,
      ];
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any,
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], []);
      expect(metrics.taxaLotacaoUaHa).toBeNull();
      expect(metrics.taxaLotacaoStatus.status).toBe("bloqueado");
    });

    it("UA/ha bloqueia quando área do pasto é ausente (null)", () => {
      const pastos: Pasto[] = [
        { id: "pasto-1", nome: "Pasto", area_ha: null } as any,
      ];
      const lotes: Lote[] = [
        { id: "lote-1", pasto_id: "pasto-1" } as any,
      ];
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any,
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], []);
      expect(metrics.taxaLotacaoUaHa).toBeNull();
      expect(metrics.taxaLotacaoStatus.status).toBe("bloqueado");
    });

    it("permanência usa o agregado qualificado e não estado ou movimentação como fallback", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      // Movimentação indica entrada em 2026-05-01 (mais antiga)
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-01", deleted_at: null } as any,
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_lote_id: "lote-1" } as any,
      ];
      const metrics = calculateLoteMetrics(
        "lote-1", refDate, 30, animals, events, [], [], movimentacoes, [],
        qualifiedDuration("LOT", "lote-1", 8, "PARTIAL"),
      );
      expect(metrics.tempoMedioPermanencia).toBe(8);
      expect(metrics.permanenciaStatus.source).toContain("Historical occupancy");
      expect(metrics.permanenciaStatus.status).toBe("partial");
      expect(metrics.permanenciaStatus.limitation).toContain("Coverage: PARTIAL");
    });

    it("categoriaPredominante não exibe snake_case — exibe label formatado", () => {
      const animals: Animal[] = [
        {
          id: "ani-1",
          status: "ativo",
          lote_id: "lote-1",
          identificacao: "A1",
          sexo: "F",
          fazenda_id: "faz-1",
          categoria_zootecnica: "novilha_solteira",
          payload: {},
        } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, [], [], [], [], []);
      // Usa classificationSnapshot como leitura operacional canonica, nunca snake_case cru.
      expect(metrics.categoriaPredominante).toBe("Novilha");
      expect(metrics.categoriaPredominante).not.toContain("_");
      expect(metrics.categoriaStatus.source).toContain("classificationSnapshot");
      expect(metrics.categoriaStatus.status).toBe("partial");
      expect(metrics.categoriaStatus.limitation).toContain("sem data de nascimento");
    });

    it("categoriaPredominante propaga limitacao quando a classificacao e parcial", () => {
      const animals: Animal[] = [
        {
          id: "ani-1",
          status: "ativo",
          lote_id: "lote-1",
          identificacao: "A1",
          sexo: "F",
          fazenda_id: "faz-1",
          payload: {},
        } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, [], [], [], [], []);
      expect(metrics.categoriaPredominante).toBe("Categoria desconhecida");
      expect(metrics.categoriaStatus.source).toBe("classificationSnapshot");
      expect(metrics.categoriaStatus.status).toBe("empty");
      expect(metrics.categoriaStatus.limitation).toContain("sem data de nascimento");
    });

  });
});
