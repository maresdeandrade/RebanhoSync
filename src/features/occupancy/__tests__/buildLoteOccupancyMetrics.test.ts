import { describe, it, expect } from "vitest";
import { buildLoteOccupancyMetrics } from "../buildLoteOccupancyMetrics";
import type { AnimalOccupancyPeriod } from "../occupancyTypes";
import type { OccupancyAggregate } from "@/lib/occupancy/occupancyAggregation";
import type { OccupancyPerformanceAggregate } from "@/lib/occupancy/occupancyPerformance";

function observedLotPerformance(): OccupancyPerformanceAggregate {
  return {
    dimension: "LOT",
    groupId: "lote-A",
    fazendaId: "farm-1",
    animalIds: ["animal-1", "animal-2"],
    meanInitialObservedWeightKg: 105,
    meanFinalObservedWeightKg: 140,
    meanWeightDeltaKg: 35,
    meanObservedGmdKgPerDay: 0.75,
    calculatedIntervals: 2,
    unavailableIntervals: 1,
    coverage: "PARTIAL_WEIGHT_COVERAGE",
    reliability: "UNCLASSIFIED",
    operationalUse: "NOT_AUTHORIZED",
    limitations: [],
    conflicts: [],
  };
}

function qualifiedLotDuration(
  meanDays: number,
  maxDays: number,
): OccupancyAggregate {
  return {
    dimension: "LOT",
    groupId: "lote-A",
    fazendaId: "farm-1",
    animalIds: ["animal-1", "animal-2", "animal-3"],
    knownDurationMs: meanDays * 3 * 86_400_000,
    knownDurationDays: meanDays * 3,
    meanKnownDurationMs: meanDays * 86_400_000,
    meanKnownDurationDays: meanDays,
    maxKnownDurationMs: maxDays * 86_400_000,
    maxKnownDurationDays: maxDays,
    knownIntervals: 3,
    unknownIntervals: 0,
    coverage: "COMPLETE",
    limitations: [],
    conflicts: [],
  };
}

describe("buildLoteOccupancyMetrics", () => {
  const loteId = "lote-A";
  const totalAnimalsInLote = 3;

  it("should return empty metrics if no animal periods in the lote", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [];

    const result = buildLoteOccupancyMetrics({
      loteId,
      animalPeriods,
      totalAnimalsInLote,
    });

    expect(result).toMatchObject({
      loteId,
      quantidadeAtual: 0,
      dataEntradaRecente: null,
      tempoMedioPermanencia: null,
      tempoMaximoPermanencia: null,
      pesoMedioInicial: null,
      pesoMedioFinal: null,
      ganhoMedio: null,
      gmdEstimado: null,
      weightStatus: { status: "empty" },
      eccMedioAtual: 0,
      eccCobertura: { avaliados: 0, total: 3 },
      eccStatus: { status: "empty" },
      categoriaPredominante: "Categoria desconhecida",
      categoriaStatus: { status: "empty", source: "classificationSnapshot" },
    });
  });

  it("should calculate lote metrics correctly", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [
      {
        animalId: "animal-1",
        loteId: loteId,
        pastoId: "pasto-X",
        entradaAt: "2026-01-01T00:00:00.000Z",
        saidaAt: "2026-01-31T00:00:00.000Z",
        dias: 30,
        pesoInicial: 100,
        pesoFinal: 130,
        ganho: 30,
        gmd: 1,
        weightStatus: { status: "complete" },
        eccInicial: 3,
        eccFinal: 4,
        variacaoEcc: 1,
        eccStatus: { status: "complete" },
      },
      {
        animalId: "animal-2",
        loteId: loteId,
        pastoId: "pasto-Y",
        entradaAt: "2026-01-15T00:00:00.000Z",
        saidaAt: null,
        dias: 130, // Days from 2026-01-15 to 2026-05-25
        pesoInicial: 110,
        pesoFinal: 150,
        ganho: 40,
        gmd: 0.5,
        weightStatus: { status: "complete" },
        eccInicial: 3.5,
        eccFinal: 4.5,
        variacaoEcc: 1,
        eccStatus: { status: "complete" },
      },
      {
        animalId: "animal-3",
        loteId: loteId,
        pastoId: "pasto-Z",
        entradaAt: "2026-02-01T00:00:00.000Z",
        saidaAt: null,
        dias: 113, // Days from 2026-02-01 to 2026-05-25
        weightStatus: { status: "empty" },
        eccStatus: { status: "empty" },
      },
    ];

    const result = buildLoteOccupancyMetrics({
      loteId,
      animalPeriods,
      totalAnimalsInLote,
      qualifiedDuration: qualifiedLotDuration((30 + 130 + 113) / 3, 130),
      observedPerformance: observedLotPerformance(),
    });

    expect(result.quantidadeAtual).toBe(2);
    expect(result.dataEntradaRecente).toBe("2026-02-01T00:00:00.000Z");
    expect(result.tempoMedioPermanencia).toBeCloseTo((30 + 130 + 113) / 3);
    expect(result.tempoMaximoPermanencia).toBe(130);
    expect(result.pesoMedioInicial).toBeCloseTo((100 + 110) / 2);
    expect(result.pesoMedioFinal).toBeCloseTo(140);
    expect(result.ganhoMedio).toBeCloseTo(35);
    expect(result.gmdEstimado).toBeCloseTo(0.75);
    expect(result.weightStatus.status).toBe("partial");
    expect(result.eccMedioAtual).toBeCloseTo(4.5); // Only animal-2 is current and has final ecc
    expect(result.eccCobertura).toMatchObject({ avaliados: 2, total: 3 });
    expect(result.eccStatus.status).toBe("complete");
    expect(result.categoriaStatus?.source).toBe("classificationSnapshot");
  });

  it("should handle partial weight data", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [
      {
        animalId: "animal-1",
        loteId: loteId,
        pastoId: "pasto-X",
        entradaAt: "2026-01-01T00:00:00.000Z",
        saidaAt: null,
        dias: 144,
        pesoInicial: 100,
        weightStatus: { status: "partial", reason: "Apenas uma pesagem valida no periodo." },
        eccStatus: { status: "empty" },
      },
    ];

    const result = buildLoteOccupancyMetrics({
      loteId,
      animalPeriods,
      totalAnimalsInLote: 1,
    });

    expect(result.weightStatus.status).toBe("empty"); // No complete weight data
  });

  it("does not present a partial aggregate when factual weight evidence conflicts", () => {
    const conflicted = {
      ...observedLotPerformance(),
      coverage: "CONFLICT" as const,
      conflicts: [
        {
          code: "MEASUREMENT_TIMESTAMP_CONFLICT" as const,
          measuredAt: "2026-01-10T00:00:00.000Z",
          eventIds: ["weight-1", "weight-2"],
        },
      ],
    };
    const result = buildLoteOccupancyMetrics({
      loteId,
      animalPeriods: [],
      totalAnimalsInLote: 1,
      observedPerformance: conflicted,
    });

    expect(result.gmdEstimado).toBeNull();
    expect(result.ganhoMedio).toBeNull();
    expect(result.weightStatus.status).toBe("bloqueado");
  });

  it("should handle partial ECC data", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [
      {
        animalId: "animal-1",
        loteId: loteId,
        pastoId: "pasto-X",
        entradaAt: "2026-01-01T00:00:00.000Z",
        saidaAt: null,
        dias: 144,
        weightStatus: { status: "empty" },
        eccInicial: 3.5,
        eccStatus: { status: "partial", reason: "Apenas uma avaliacao de ECC disponivel no periodo." },
      },
    ];

    const result = buildLoteOccupancyMetrics({
      loteId,
      animalPeriods,
      totalAnimalsInLote: 1,
    });

    expect(result.eccMedioAtual).toBeCloseTo(3.5);
    expect(result.eccCobertura).toMatchObject({ avaliados: 1, total: 1 });
    expect(result.eccStatus.status).toBe("complete"); // Partial ECC data is still considered for coverage
  });
});
