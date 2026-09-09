import { describe, expect, it } from "vitest";
import {
  calculateProductiveCommercialSimulation,
  type ProductiveCommercialSimulationInput,
} from "../productiveCommercialSimulation";

describe("productiveCommercialSimulation (pure engine)", () => {
  const baseLiveYieldInput: ProductiveCommercialSimulationInput = {
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
      arrobaBasis: "live_weight_yield",
      carcassYieldPercent: 50, // 50%
      dailyIncrementalCost: 5.0,
      additionalIncrementalCosts: 50.0,
    },
  };

  const baseCarcassInput: ProductiveCommercialSimulationInput = {
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
      sellNowCarcassWeightKg: 200,
      targetCarcassWeightKg: 250,
      dailyIncrementalCost: 5.0,
      additionalIncrementalCosts: 50.0,
    },
  };

  it("calcula arroba corretamente a partir de 500 kg vivo + 50% rendimento = 16,6667 @ e nunca 33,3333 @", () => {
    const result = calculateProductiveCommercialSimulation(baseLiveYieldInput);

    expect(result.status).toBe("READY");
    expect(result.commercial).not.toBeNull();
    // 500 kg vivo * 50% / 15 = 16.6667 @
    expect(result.commercial?.targetArrobas).toBeCloseTo(16.6667, 3);
    expect(result.commercial?.targetArrobas).not.toBeCloseTo(33.3333, 2);
    // 16.6667 * 300 = 5000.00
    expect(result.commercial?.grossRevenueSimulated).toBe(5000);
  });

  it("calcula cenário produtivo e comercial com base live_weight_yield e custos completos", () => {
    const result = calculateProductiveCommercialSimulation(baseLiveYieldInput);

    expect(result.status).toBe("READY");
    expect(result.productive).not.toBeNull();
    expect(result.productive?.weightGainKg).toBe(100);
    expect(result.productive?.estimatedDays).toBe(100);
    expect(result.productive?.targetWeightKg).toBe(500);

    expect(result.commercial).not.toBeNull();
    expect(result.commercial?.costCoverage).toBe("COMPLETE");
    // 100 dias * 5 + 50 = 550
    expect(result.commercial?.incrementalCost).toBe(550);
    expect(result.commercial?.partialSimulatedMargin).toBe(5000 - 550);

    // Break-even com custos completos:
    // Agora: 400 kg * 50% / 15 = 13.3333 @, grossRevenueNow = 4000
    // breakEven = (4000 + 550) / 16.6667 = 273.00
    expect(result.commercial?.breakEvenPricePerArroba).toBeCloseTo(273.0, 1);
  });

  it("calcula cenário comercial com base carcass_weight quando pesos de carcaça explícitos forem fornecidos", () => {
    const result = calculateProductiveCommercialSimulation(baseCarcassInput);

    expect(result.status).toBe("READY");
    expect(result.commercial).not.toBeNull();
    // 250 kg carcaça / 15 = 16.6667 @
    expect(result.commercial?.targetArrobas).toBeCloseTo(16.6667, 3);
    expect(result.commercial?.grossRevenueSimulated).toBe(5000);

    // Venda agora com 200 kg carcaça / 15 = 13.3333 @ -> 4000
    expect(result.comparison?.sellNow.arrobas).toBeCloseTo(13.3333, 3);
    expect(result.comparison?.sellNow.grossRevenue).toBe(4000);
  });

  it("bloqueia base carcass_weight se peso de carcaça no alvo estiver ausente", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseCarcassInput,
      assumptions: {
        ...baseCarcassInput.assumptions,
        targetCarcassWeightKg: null,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Peso de carcaça no peso-alvo é obrigatório para base carcaça.");
    expect(result.commercial).toBeNull();
  });

  it("bloqueia base carcass_weight se peso de carcaça na venda agora estiver ausente", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseCarcassInput,
      assumptions: {
        ...baseCarcassInput.assumptions,
        sellNowCarcassWeightKg: null,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Peso de carcaça na venda agora é obrigatório para base carcaça.");
    expect(result.commercial).toBeNull();
  });

  it("bloqueia base live_weight_yield se rendimento de carcaça estiver ausente", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        carcassYieldPercent: null,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain(
      "Rendimento de carcaça obrigatório e deve estar entre 0 e 100% para a base informada.",
    );
    expect(result.commercial).toBeNull();
  });

  it("bloqueia base live_weight_yield se rendimento for inválido (> 100 ou <= 0)", () => {
    const inputOver: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        carcassYieldPercent: 105,
      },
    };
    expect(calculateProductiveCommercialSimulation(inputOver).status).toBe("BLOCKED");

    const inputZero: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        carcassYieldPercent: 0,
      },
    };
    expect(calculateProductiveCommercialSimulation(inputZero).status).toBe("BLOCKED");
  });

  it("fail closed na venda agora: bloqueia simulação se houver erro comercial na venda agora e nunca retorna 0", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseCarcassInput,
      assumptions: {
        ...baseCarcassInput.assumptions,
        sellNowCarcassWeightKg: -10, // peso de carcaça inválido
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Peso de carcaça na venda agora é obrigatório para base carcaça.");
    expect(result.commercial).toBeNull();
    expect(result.comparison).toBeNull();
  });

  it("break-even é calculado apenas quando costCoverage === COMPLETE", () => {
    const completeResult = calculateProductiveCommercialSimulation(baseLiveYieldInput);
    expect(completeResult.commercial?.costCoverage).toBe("COMPLETE");
    expect(completeResult.commercial?.breakEvenPricePerArroba).not.toBeNull();

    // Com apenas custos diários (parciais)
    const partialInput: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        dailyIncrementalCost: 5.0,
        additionalIncrementalCosts: null,
      },
    };
    const partialResult = calculateProductiveCommercialSimulation(partialInput);
    expect(partialResult.status).toBe("PARTIAL");
    expect(partialResult.commercial?.costCoverage).toBe("PARTIAL");
    expect(partialResult.commercial?.incrementalCost).toBe(500); // 100 dias * 5
    expect(partialResult.commercial?.partialSimulatedMargin).toBe(5000 - 500);
    // Break-even DEVE SER NULL quando a cobertura for parcial!
    expect(partialResult.commercial?.breakEvenPricePerArroba).toBeNull();
  });

  it("quando nenhum custo for informado, costCoverage = PARTIAL e incrementalCost/margin/break-even são null", () => {
    const noCostsInput: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        dailyIncrementalCost: null,
        additionalIncrementalCosts: null,
      },
    };

    const result = calculateProductiveCommercialSimulation(noCostsInput);

    expect(result.status).toBe("PARTIAL");
    expect(result.commercial?.costCoverage).toBe("PARTIAL");
    expect(result.commercial?.incrementalCost).toBeNull();
    expect(result.commercial?.partialSimulatedMargin).toBeNull();
    expect(result.commercial?.breakEvenPricePerArroba).toBeNull();
    expect(result.comparison?.keepUntilTarget.incrementalCost).toBeNull();
    expect(result.comparison?.keepUntilTarget.partialIncrementalResult).toBeNull();
    expect(result.comparison?.difference.partialIncrementalResultDelta).toBeNull();
  });

  it("trata cenário quando o peso-alvo já foi atingido (targetWeightKg <= observedWeightKg)", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        targetWeightKg: 400,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("READY");
    expect(result.productive?.weightGainKg).toBe(0);
    expect(result.productive?.estimatedDays).toBe(0);
    // incremental cost: 0 dias * 5 + 50 = 50
    expect(result.commercial?.incrementalCost).toBe(50);
  });

  it("bloqueia quando GMD assumido for zero ou negativo", () => {
    const zeroGmd: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        assumedGmdKgDay: 0,
      },
    };
    expect(calculateProductiveCommercialSimulation(zeroGmd).status).toBe("BLOCKED");

    const negGmd: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      assumptions: {
        ...baseLiveYieldInput.assumptions,
        assumedGmdKgDay: -0.5,
      },
    };
    expect(calculateProductiveCommercialSimulation(negGmd).status).toBe("BLOCKED");
  });

  it("bloqueia quando há conflito factual de pesagem", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      factual: {
        ...baseLiveYieldInput.factual,
        weightConflict: true,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Conflito factual de pesagem detectado para este animal.");
  });

  it("bloqueia quando fazendaId ou animalId forem inválidos ou vazios", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      factual: {
        ...baseLiveYieldInput.factual,
        fazendaId: "   ",
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Identificação do animal ou fazenda ausente ou inválida.");
  });

  it("bloqueia quando peso observado for ausente ou <= 0", () => {
    const input: ProductiveCommercialSimulationInput = {
      ...baseLiveYieldInput,
      factual: {
        ...baseLiveYieldInput.factual,
        observedWeightKg: 0,
      },
    };

    const result = calculateProductiveCommercialSimulation(input);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContain("Peso observado indisponível ou inválido.");
  });

  it("preserva imutabilidade dos objetos de entrada", () => {
    const inputCopy = JSON.parse(JSON.stringify(baseLiveYieldInput));
    Object.freeze(baseLiveYieldInput.factual);
    Object.freeze(baseLiveYieldInput.assumptions);

    const result = calculateProductiveCommercialSimulation(baseLiveYieldInput);

    expect(result.status).toBe("READY");
    expect(baseLiveYieldInput).toEqual(inputCopy);
  });
});
