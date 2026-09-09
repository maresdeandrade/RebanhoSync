import { describe, expect, it } from "vitest";
import {
  calculateProductiveCommercialSimulation,
  type ProductiveCommercialSimulationInput,
} from "../productiveCommercialSimulation";

describe("productiveCommercialSimulation (pure engine)", () => {
  const baseValidInput: ProductiveCommercialSimulationInput = {
    factual: {
      animalId: "animal-1",
      fazendaId: "fazenda-1",
      observedWeightKg: 400,
      observedAt: "2026-08-01T10:00:00.000Z",
      factualGmdKgDay: 0.8,
    },
    assumptions: {
      targetWeightKg: 500,
      assumedGmdKgDay: 1.0,
      pricePerArroba: 300,
      arrobaBasis: "carcass_weight",
      carcassYieldPercent: null,
      dailyIncrementalCost: 5.0,
      additionalIncrementalCosts: 50.0,
    },
  };

  it("calcula cenário produtivo e comercial com peso + GMD + alvo válidos e custos completos", () => {
    const result = calculateProductiveCommercialSimulation(baseValidInput);

    expect(result.status).toBe("READY");
    expect(result.productive).not.toBeNull();
    expect(result.productive?.weightGainKg).toBe(100);
    expect(result.productive?.estimatedDays).toBe(100);
    expect(result.productive?.targetWeightKg).toBe(500);

    expect(result.commercial).not.toBeNull();
    // 500 kg / 15 = 33.333333... arrobas
    expect(result.commercial?.targetArrobas).toBeCloseTo(33.3333, 3);
    // 33.3333 * 300 = 10000.00
    expect(result.commercial?.grossRevenueSimulated).toBe(10000);
    // 100 dias * 5 + 50 = 550
    expect(result.commercial?.incrementalCost).toBe(550);
    expect(result.commercial?.costCoverage).toBe("COMPLETE");
    expect(result.commercial?.partialSimulatedMargin).toBe(10000 - 550);
  });

  it("calcula break-even e comparação sem recomendação", () => {
    const result = calculateProductiveCommercialSimulation(baseValidInput);

    // Break-even: Agora: 400 kg / 15 = 26.6667 @, grossRevenueNow = 8000.00
    // breakEven = (8000 + 550) / 33.333333 = 256.50
    expect(result.commercial?.breakEvenPricePerArroba).toBeCloseTo(256.5, 1);

    // Comparação
    expect(result.comparison).not.toBeNull();
    expect(result.comparison?.sellNow.weightKg).toBe(400);
    expect(result.comparison?.sellNow.grossRevenue).toBe(8000);
    expect(result.comparison?.keepUntilTarget.targetWeightKg).toBe(500);
    expect(result.comparison?.keepUntilTarget.grossRevenue).toBe(10000);
    expect(result.comparison?.keepUntilTarget.incrementalCost).toBe(550);
    expect(result.comparison?.difference.grossRevenueDelta).toBe(2000);
    expect(result.comparison?.difference.partialIncrementalResultDelta).toBe(1450);

    // Nenhuma chave de recomendação permitida
    expect((result as Record<string, unknown>).recommendation).toBeUndefined();
    expect((result as Record<string, unknown>).shouldSell).toBeUndefined();
    expect((result as Record<string, unknown>).shouldSlaughter).toBeUndefined();
    expect((result as Record<string, unknown>).commercialFitness).toBeUndefined();
  });

  it("trata cenário quando o peso-alvo já foi atingido (targetWeightKg <= observedWeightKg)", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        targetWeightKg: 400, // igual ao peso observado
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("READY");
    expect(result.productive?.weightGainKg).toBe(0);
    expect(result.productive?.estimatedDays).toBe(0);
    // incremental cost: 0 dias * 5 + 50 = 50
    expect(result.commercial?.incrementalCost).toBe(50);
  });

  it("bloqueia quando GMD assumido for zero", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        assumedGmdKgDay: 0,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("GMD do cenário deve ser maior que zero.");
    expect(result.productive).toBeNull();
    expect(result.commercial).toBeNull();
  });

  it("bloqueia quando GMD assumido for negativo", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        assumedGmdKgDay: -0.5,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("GMD do cenário deve ser maior que zero.");
  });

  it("bloqueia quando preço da arroba estiver ausente ou inválido", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        pricePerArroba: 0,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Preço por arroba inválido (deve ser maior que zero).");
  });

  it("suporta cálculo com base live_weight_yield e rendimento de carcaça informado", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent: 52, // 52%
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("READY");
    // 500 kg * 52% / 15 = 17.3333 @
    expect(result.commercial?.targetArrobas).toBeCloseTo(17.3333, 2);
    expect(result.commercial?.grossRevenueSimulated).toBeCloseTo(5200, 0);
  });

  it("bloqueia base live_weight_yield quando rendimento de carcaça estiver ausente", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent: null,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain(
      "Rendimento de carcaça obrigatório e deve estar entre 0 e 100% para a base informada.",
    );
  });

  it("bloqueia base live_weight_yield quando rendimento for inválido (> 100)", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent: 120,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
  });

  it("classifica como PARTIAL quando houver custos parciais e não assume ausente como zero", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        dailyIncrementalCost: 6.0,
        additionalIncrementalCosts: null, // ausente
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("PARTIAL");
    expect(result.commercial?.costCoverage).toBe("PARTIAL");
    // 100 dias * 6 = 600
    expect(result.commercial?.incrementalCost).toBe(600);
    expect(result.limitations.some((l) => l.includes("Custos ausentes não foram assumidos como zero"))).toBe(true);
  });

  it("classifica como NONE quando nenhum custo for informado", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      assumptions: {
        ...baseValidInput.assumptions,
        dailyIncrementalCost: null,
        additionalIncrementalCosts: null,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("PARTIAL");
    expect(result.commercial?.costCoverage).toBe("NONE");
    expect(result.commercial?.incrementalCost).toBeNull();
    expect(result.commercial?.partialSimulatedMargin).toBeNull();
    expect(result.commercial?.breakEvenPricePerArroba).toBeNull();
    expect(result.comparison?.keepUntilTarget.incrementalCost).toBeNull();
    expect(result.comparison?.keepUntilTarget.partialIncrementalResult).toBeNull();
    expect(result.comparison?.difference.partialIncrementalResultDelta).toBeNull();
  });

  it("bloqueia quando há conflito factual de pesagem", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      factual: {
        ...baseValidInput.factual,
        weightConflict: true,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Conflito factual de pesagem detectado para este animal.");
  });

  it("bloqueia quando fazendaId ou animalId forem inválidos ou vazios", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      factual: {
        ...baseValidInput.factual,
        fazendaId: "   ",
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Identificação do animal ou fazenda ausente ou inválida.");
  });

  it("bloqueia quando peso observado for ausente ou <= 0", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseValidInput,
      factual: {
        ...baseValidInput.factual,
        observedWeightKg: 0,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Peso observado indisponível ou inválido.");
  });

  it("preserva imutabilidade dos objetos de entrada", () => {
    const inputCopy = JSON.parse(JSON.stringify(baseValidInput));
    Object.freeze(baseValidInput.factual);
    Object.freeze(baseValidInput.assumptions);

    const result = calculateProductiveCommercialSimulation(baseValidInput);

    expect(result.status).toBe("READY");
    expect(baseValidInput).toEqual(inputCopy);
  });
});
