/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useProductiveCommercialSimulation } from "../useProductiveCommercialSimulation";
import { useAnimalWeightPresentation } from "@/hooks/useAnimalWeightPresentation";

vi.mock("@/hooks/useAnimalWeightPresentation");

const mockedUseAnimalWeightPresentation = vi.mocked(useAnimalWeightPresentation);

describe("useProductiveCommercialSimulation", () => {
  const mockAnimal = {
    id: "animal-123",
    brinco: "BR-99",
    nome: "Estrela",
    fazenda_id: "fazenda-456",
    deleted_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicia peso-alvo e preço/@ vazios e sem fallback 1.00 quando GMD indisponível", () => {
    mockedUseAnimalWeightPresentation.mockReturnValue({
      evidence: {
        status: "available",
        scopedEventCount: 1,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "available",
        value: {
          animalId: "animal-123",
          fazendaId: "fazenda-456",
          weight: 400,
          unit: "kg",
          measuredAt: "2026-08-15T12:00:00.000Z",
          eventId: "evt-1",
          ageDays: 5,
          limitations: [],
        },
      },
      gmd: {
        status: "NOT_CALCULATED",
        reason: "INSUFFICIENT_OBSERVATIONS",
        source: {
          status: "INSUFFICIENT_OBSERVATIONS",
          observedCount: 1,
          requiredCount: 2,
          limitations: [],
        },
      },
      observations: [],
    });

    const { result } = renderHook(() =>
      useProductiveCommercialSimulation({
        animal: mockAnimal,
        fazendaId: "fazenda-456",
      }),
    );

    // Peso-alvo inicia vazio (nunca 500 ou observedWeight + 100)
    expect(result.current.inputs.targetWeightInput).toBe("");
    // Preço por arroba inicia vazio (nunca 300.00)
    expect(result.current.inputs.pricePerArrobaInput).toBe("");
    // GMD assumido inicia vazio quando factual indisponível (nunca 1.00)
    expect(result.current.inputs.assumedGmdInput).toBe("");
    // Rendimento inicia vazio
    expect(result.current.inputs.carcassYieldInput).toBe("");

    // Sem premissas mínimas, simulação deve estar BLOCKED
    expect(result.current.simulation.status).toBe("BLOCKED");
    expect(result.current.simulation.blockReasons?.length).toBeGreaterThan(0);
  });

  it("preenche GMD assumido como sugestão inicial quando GMD factual está disponível", () => {
    mockedUseAnimalWeightPresentation.mockReturnValue({
      evidence: {
        status: "available",
        scopedEventCount: 2,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "available",
        value: {
          animalId: "animal-123",
          fazendaId: "fazenda-456",
          weight: 420,
          unit: "kg",
          measuredAt: "2026-08-15T12:00:00.000Z",
          eventId: "evt-2",
          ageDays: 10,
          limitations: [],
        },
      },
      gmd: {
        status: "CALCULATED",
        animalId: "animal-123",
        fazendaId: "fazenda-456",
        initialWeightKg: 380,
        finalWeightKg: 420,
        initialMeasuredAt: "2026-07-15T12:00:00.000Z",
        finalMeasuredAt: "2026-08-15T12:00:00.000Z",
        intervalDays: 31,
        weightDeltaKg: 40,
        gmdKgPerDay: 0.85,
        reliability: "UNCLASSIFIED",
        operationalUse: "NOT_AUTHORIZED",
        universalMinInterval: "CONTEXT_DEPENDENT",
        limitations: [],
      },
      observations: [],
    });

    const { result } = renderHook(() =>
      useProductiveCommercialSimulation({
        animal: mockAnimal,
        fazendaId: "fazenda-456",
      }),
    );

    // Sugestão factual preenchida
    expect(result.current.inputs.assumedGmdInput).toBe("0.85");
    // Mas peso-alvo e preço/@ continuam vazios
    expect(result.current.inputs.targetWeightInput).toBe("");
    expect(result.current.inputs.pricePerArrobaInput).toBe("");
  });

  it("usuário digita GMD 1.00 e chegada posterior do GMD factual NÃO sobrescreve", () => {
    let currentPresentation: ReturnType<typeof useAnimalWeightPresentation> = {
      evidence: {
        status: "available",
        scopedEventCount: 1,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "available",
        value: {
          animalId: "animal-123",
          fazendaId: "fazenda-456",
          weight: 400,
          unit: "kg",
          measuredAt: "2026-08-15T12:00:00.000Z",
          eventId: "evt-1",
          ageDays: 5,
          limitations: [],
        },
      },
      gmd: {
        status: "NOT_CALCULATED",
        reason: "INSUFFICIENT_OBSERVATIONS",
        source: {
          status: "INSUFFICIENT_OBSERVATIONS",
          observedCount: 1,
          requiredCount: 2,
          limitations: [],
        },
      },
      observations: [],
    };

    mockedUseAnimalWeightPresentation.mockImplementation(() => currentPresentation);

    const { result, rerender } = renderHook(() =>
      useProductiveCommercialSimulation({
        animal: mockAnimal,
        fazendaId: "fazenda-456",
      }),
    );

    expect(result.current.inputs.assumedGmdInput).toBe("");

    // Produtor digita explicitamente 1.00 como premissa desejada
    act(() => {
      result.current.setters.setAssumedGmdInput("1.00");
    });

    expect(result.current.inputs.assumedGmdInput).toBe("1.00");

    // Chegada assíncrona posterior do cálculo factual de GMD (ex: 0.65)
    currentPresentation = {
      ...currentPresentation,
      gmd: {
        status: "CALCULATED",
        animalId: "animal-123",
        fazendaId: "fazenda-456",
        initialWeightKg: 360,
        finalWeightKg: 400,
        initialMeasuredAt: "2026-06-15T12:00:00.000Z",
        finalMeasuredAt: "2026-08-15T12:00:00.000Z",
        intervalDays: 61,
        weightDeltaKg: 40,
        gmdKgPerDay: 0.65,
        reliability: "UNCLASSIFIED",
        operationalUse: "NOT_AUTHORIZED",
        universalMinInterval: "CONTEXT_DEPENDENT",
        limitations: [],
      },
    };

    rerender();

    // NÃO pode ter sido sobrescrito pelo 0.65
    expect(result.current.inputs.assumedGmdInput).toBe("1.00");
  });

  it("usuário digita peso-alvo 500 e chegada posterior do peso factual NÃO sobrescreve", () => {
    let currentPresentation: ReturnType<typeof useAnimalWeightPresentation> = {
      evidence: {
        status: "available",
        scopedEventCount: 0,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "unavailable",
        reason: "NO_OBSERVATION",
        limitations: [],
      },
      gmd: {
        status: "NOT_CALCULATED",
        reason: "INSUFFICIENT_OBSERVATIONS",
        source: {
          status: "INSUFFICIENT_OBSERVATIONS",
          observedCount: 0,
          requiredCount: 2,
          limitations: [],
        },
      },
      observations: [],
    };

    mockedUseAnimalWeightPresentation.mockImplementation(() => currentPresentation);

    const { result, rerender } = renderHook(() =>
      useProductiveCommercialSimulation({
        animal: mockAnimal,
        fazendaId: "fazenda-456",
      }),
    );

    expect(result.current.inputs.targetWeightInput).toBe("");

    // Produtor digita 500 como peso-alvo
    act(() => {
      result.current.setters.setTargetWeightInput("500");
    });

    expect(result.current.inputs.targetWeightInput).toBe("500");

    // Chegada assíncrona do peso factual (ex: 380 kg)
    currentPresentation = {
      ...currentPresentation,
      latestObservedWeight: {
        status: "available",
        value: {
          animalId: "animal-123",
          fazendaId: "fazenda-456",
          weight: 380,
          unit: "kg",
          measuredAt: "2026-08-15T12:00:00.000Z",
          eventId: "evt-380",
          ageDays: 1,
          limitations: [],
        },
      },
    };

    rerender();

    // Peso-alvo não foi alterado para 480 (380+100) nem apagado
    expect(result.current.inputs.targetWeightInput).toBe("500");
  });

  it("habilita cálculo quando todas as premissas mínimas são explicitadas pelo usuário", () => {
    mockedUseAnimalWeightPresentation.mockReturnValue({
      evidence: {
        status: "available",
        scopedEventCount: 1,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "available",
        value: {
          animalId: "animal-123",
          fazendaId: "fazenda-456",
          weight: 420,
          unit: "kg",
          measuredAt: "2026-08-15T12:00:00.000Z",
          eventId: "evt-420",
          ageDays: 2,
          limitations: [],
        },
      },
      gmd: {
        status: "NOT_CALCULATED",
        reason: "INSUFFICIENT_OBSERVATIONS",
        source: {
          status: "INSUFFICIENT_OBSERVATIONS",
          observedCount: 1,
          requiredCount: 2,
          limitations: [],
        },
      },
      observations: [],
    });

    const { result } = renderHook(() =>
      useProductiveCommercialSimulation({
        animal: mockAnimal,
        fazendaId: "fazenda-456",
      }),
    );

    expect(result.current.simulation.status).toBe("BLOCKED");

    // Preenche premissas mínimas (sem custos)
    act(() => {
      result.current.setters.setTargetWeightInput("520");
      result.current.setters.setAssumedGmdInput("1.00");
      result.current.setters.setPricePerArrobaInput("310");
      result.current.setters.setCarcassYieldInput("52");
    });

    // Cálculo desbloqueado (status PARTIAL devido à ausência de custos)
    expect(result.current.simulation.status).toBe("PARTIAL");
    expect(result.current.simulation.productive).not.toBeNull();
    expect(result.current.simulation.commercial).not.toBeNull();
    expect(result.current.simulation.comparison).not.toBeNull();

    // Preenche custos completos
    act(() => {
      result.current.setters.setDailyCostInput("4.50");
      result.current.setters.setAdditionalCostInput("50.00");
    });

    // Com custos completos, status torna-se READY
    expect(result.current.simulation.status).toBe("READY");
    expect(result.current.simulation.commercial?.costCoverage).toBe("COMPLETE");
  });
});
