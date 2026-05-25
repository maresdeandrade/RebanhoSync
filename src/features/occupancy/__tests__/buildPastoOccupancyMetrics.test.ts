import { describe, it, expect } from "vitest";
import { buildPastoOccupancyMetrics } from "../buildPastoOccupancyMetrics";
import type { AnimalOccupancyPeriod } from "../occupancyTypes";

describe("buildPastoOccupancyMetrics", () => {
  const pastoId = "pasto-X";

  it("should return empty metrics if no animal periods in the pasto", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [];

    const result = buildPastoOccupancyMetrics({
      pastoId,
      animalPeriods,
    });

    expect(result).toMatchObject({
      pastoId,
      lotacaoAtual: 0,
      tempoMedioOcupacao: 0,
      ganhoMedioPeso: 0,
      gmdEstimado: 0,
      weightStatus: { status: "empty" },
      eccMedioAtual: 0,
      eccVariacaoMedia: 0,
      eccStatus: { status: "empty" },
    });
  });

  it("should calculate pasto metrics correctly", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [
      {
        animalId: "animal-1",
        loteId: "lote-A",
        pastoId: pastoId,
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
        loteId: "lote-A",
        pastoId: pastoId,
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
        loteId: "lote-B",
        pastoId: "pasto-Y", // This animal is not in pasto-X
        entradaAt: "2026-02-01T00:00:00.000Z",
        saidaAt: null,
        dias: 113,
        weightStatus: { status: "empty" },
        eccStatus: { status: "empty" },
      },
    ];

    const result = buildPastoOccupancyMetrics({
      pastoId,
      animalPeriods,
    });

    expect(result.lotacaoAtual).toBe(1);
    expect(result.tempoMedioOcupacao).toBeCloseTo((30 + 130) / 2);
    expect(result.ganhoMedioPeso).toBeCloseTo((30 + 40) / 2);
    expect(result.gmdEstimado).toBeCloseTo((1 + 0.5) / 2);
    expect(result.weightStatus.status).toBe("complete");
    expect(result.eccMedioAtual).toBeCloseTo(4.5); // Only animal-2 is current and has final ecc
    expect(result.eccVariacaoMedia).toBeCloseTo((1 + 1) / 2);
    expect(result.eccStatus.status).toBe("complete");
  });

  it("should handle partial weight data", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [
      {
        animalId: "animal-1",
        loteId: "lote-A",
        pastoId: pastoId,
        entradaAt: "2026-01-01T00:00:00.000Z",
        saidaAt: null,
        dias: 144,
        pesoInicial: 100,
        weightStatus: { status: "partial", reason: "Apenas uma pesagem valida no periodo." },
        eccStatus: { status: "empty" },
      },
    ];

    const result = buildPastoOccupancyMetrics({
      pastoId,
      animalPeriods,
    });

    expect(result.weightStatus.status).toBe("empty"); // No complete weight data
  });

  it("should handle partial ECC data", () => {
    const animalPeriods: AnimalOccupancyPeriod[] = [
      {
        animalId: "animal-1",
        loteId: "lote-A",
        pastoId: pastoId,
        entradaAt: "2026-01-01T00:00:00.000Z",
        saidaAt: null,
        dias: 144,
        weightStatus: { status: "empty" },
        eccInicial: 3.5,
        eccStatus: { status: "partial", reason: "Apenas uma avaliacao de ECC disponivel no periodo." },
      },
    ];

    const result = buildPastoOccupancyMetrics({
      pastoId,
      animalPeriods,
    });

    expect(result.eccMedioAtual).toBeCloseTo(3.5);
    expect(result.eccVariacaoMedia).toBe(0); // No variation with only one ECC
    expect(result.eccStatus.status).toBe("complete"); // Partial ECC data is still considered for coverage
  });
});
