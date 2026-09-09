import {
  calculateCommercialPricingLine,
  type CommercialArrobaBasis,
} from "@/lib/comercial/commercialPricing";

export type SimulationStatus = "READY" | "PARTIAL" | "BLOCKED";
export type CostCoverage = "COMPLETE" | "PARTIAL" | "NONE";

export interface ProductiveCommercialSimulationFactualInput {
  animalId: string;
  fazendaId: string;
  observedWeightKg: number;
  observedAt: string;
  factualGmdKgDay?: number | null;
  weightConflict?: boolean;
}

export interface ProductiveCommercialSimulationAssumptionsInput {
  targetWeightKg: number;
  assumedGmdKgDay: number;
  pricePerArroba: number;
  arrobaBasis: CommercialArrobaBasis;
  carcassYieldPercent?: number | null;
  dailyIncrementalCost?: number | null;
  additionalIncrementalCosts?: number | null;
}

export interface ProductiveCommercialSimulationInput {
  factual: ProductiveCommercialSimulationFactualInput;
  assumptions: ProductiveCommercialSimulationAssumptionsInput;
}

export interface ProductiveSimulationDerived {
  weightGainKg: number;
  estimatedDays: number;
  targetWeightKg: number;
}

export interface CommercialSimulationDerived {
  targetArrobas: number;
  grossRevenueSimulated: number;
  incrementalCost: number | null;
  costCoverage: CostCoverage;
  partialSimulatedMargin: number | null;
  breakEvenPricePerArroba: number | null;
}

export interface ComparisonScenarioSellNow {
  label: "Venda agora";
  weightKg: number;
  arrobas: number;
  grossRevenue: number;
}

export interface ComparisonScenarioKeepUntilTarget {
  label: "Manter até peso-alvo";
  targetWeightKg: number;
  targetArrobas: number;
  grossRevenue: number;
  incrementalCost: number | null;
  partialIncrementalResult: number | null;
}

export interface ComparisonDifference {
  grossRevenueDelta: number;
  partialIncrementalResultDelta: number | null;
}

export interface SimulationComparisonDerived {
  sellNow: ComparisonScenarioSellNow;
  keepUntilTarget: ComparisonScenarioKeepUntilTarget;
  difference: ComparisonDifference;
}

export interface ProductiveCommercialSimulationResult {
  status: SimulationStatus;
  blockReasons?: string[];
  factual: ProductiveCommercialSimulationFactualInput;
  assumptions: ProductiveCommercialSimulationAssumptionsInput;
  productive: ProductiveSimulationDerived | null;
  commercial: CommercialSimulationDerived | null;
  comparison: SimulationComparisonDerived | null;
  limitations: string[];
}

const CANONICAL_LIMITATIONS = [
  "Simulação prospectiva com premissas editáveis; não constitui recomendação técnica ou comercial.",
  "O peso observado provém de pesagem factual registrada e não representa o peso em tempo real.",
  "O GMD assumido no cenário é uma premissa projetada e não garante ganho de peso futuro.",
  "Custos fixos da fazenda, depreciação, custos de aquisição e carência de medicamentos não foram deduzidos.",
  "Esta simulação é estritamente efêmera: não cria Evento, Agenda, estado animal ou lançamentos financeiros.",
] as const;

function validateFactualInputs(factual: ProductiveCommercialSimulationFactualInput): string[] {
  const issues: string[] = [];
  if (!factual.animalId?.trim() || !factual.fazendaId?.trim()) {
    issues.push("Identificação do animal ou fazenda ausente ou inválida.");
  }
  if (factual.weightConflict) {
    issues.push("Conflito factual de pesagem detectado para este animal.");
  }
  if (
    typeof factual.observedWeightKg !== "number" ||
    !Number.isFinite(factual.observedWeightKg) ||
    factual.observedWeightKg <= 0
  ) {
    issues.push("Peso observado indisponível ou inválido.");
  }
  return issues;
}

function validateTargetWeight(weight: number): string | null {
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
    return "Peso-alvo inválido (deve ser maior que zero).";
  }
  return null;
}

function validateAssumedGmd(gmd: number): string | null {
  if (typeof gmd !== "number" || !Number.isFinite(gmd) || gmd <= 0) {
    return "GMD do cenário deve ser maior que zero.";
  }
  return null;
}

function validatePricePerArroba(price: number): string | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return "Preço por arroba inválido (deve ser maior que zero).";
  }
  return null;
}

function validateArrobaBasis(
  basis: CommercialArrobaBasis,
  yieldPercent: number | null | undefined,
): string | null {
  if (basis === "carcass_weight") return null;
  if (basis !== "live_weight_yield") return "Base de cálculo da arroba inválida.";
  if (yieldPercent == null || !Number.isFinite(yieldPercent) || yieldPercent <= 0 || yieldPercent > 100) {
    return "Rendimento de carcaça obrigatório e deve estar entre 0 e 100% para a base informada.";
  }
  return null;
}

function validateAssumptionsInputs(assumptions: ProductiveCommercialSimulationAssumptionsInput): string[] {
  const issues: string[] = [];
  const targetIssue = validateTargetWeight(assumptions.targetWeightKg);
  if (targetIssue) issues.push(targetIssue);
  const gmdIssue = validateAssumedGmd(assumptions.assumedGmdKgDay);
  if (gmdIssue) issues.push(gmdIssue);
  const priceIssue = validatePricePerArroba(assumptions.pricePerArroba);
  if (priceIssue) issues.push(priceIssue);
  const basisIssue = validateArrobaBasis(assumptions.arrobaBasis, assumptions.carcassYieldPercent);
  if (basisIssue) issues.push(basisIssue);
  return issues;
}

function calculateProductive(
  observedWeightKg: number,
  targetWeightKg: number,
  assumedGmdKgDay: number,
): ProductiveSimulationDerived {
  const weightGainKg = Math.max(targetWeightKg - observedWeightKg, 0);
  const estimatedDays = weightGainKg > 0 ? weightGainKg / assumedGmdKgDay : 0;
  return { weightGainKg, estimatedDays, targetWeightKg };
}

function resolveIncrementalCosts(
  estimatedDays: number,
  dailyCost: number | null | undefined,
  additionalCost: number | null | undefined,
): { costCoverage: CostCoverage; incrementalCost: number | null } {
  const hasDaily = typeof dailyCost === "number" && Number.isFinite(dailyCost) && dailyCost >= 0;
  const hasAdditional = typeof additionalCost === "number" && Number.isFinite(additionalCost) && additionalCost >= 0;

  if (hasDaily && hasAdditional) {
    return {
      costCoverage: "COMPLETE",
      incrementalCost: estimatedDays * dailyCost + additionalCost,
    };
  }
  if (hasDaily) {
    return {
      costCoverage: "PARTIAL",
      incrementalCost: estimatedDays * dailyCost,
    };
  }
  if (hasAdditional) {
    return {
      costCoverage: "PARTIAL",
      incrementalCost: additionalCost,
    };
  }
  return { costCoverage: "NONE", incrementalCost: null };
}

function buildLimitationsList(costCoverage: CostCoverage): string[] {
  const list = [...CANONICAL_LIMITATIONS];
  if (costCoverage === "PARTIAL") {
    list.push(
      "Cálculo parcial com base apenas nos custos informados. Custos ausentes não foram assumidos como zero.",
    );
  } else if (costCoverage === "NONE") {
    list.push(
      "Custos incrementais não informados. Margem parcial simulada e preço de equilíbrio não foram calculados.",
    );
  }
  return list;
}

/**
 * Motor funcional puro de simulação produtiva e comercial de cenários.
 *
 * FATOS OBSERVADOS + PREMISSAS EXPLÍCITAS = CENÁRIO SIMULADO
 *
 * Não realiza persistência, chamadas a Dexie/Supabase nem efeitos colaterais.
 * Nunca emite recomendações ("vender", "abater", "manter").
 */
export function calculateProductiveCommercialSimulation(
  input: ProductiveCommercialSimulationInput,
): ProductiveCommercialSimulationResult {
  const factualCopy: ProductiveCommercialSimulationFactualInput = { ...input.factual };
  const assumptionsCopy: ProductiveCommercialSimulationAssumptionsInput = { ...input.assumptions };

  const blockReasons = [
    ...validateFactualInputs(factualCopy),
    ...validateAssumptionsInputs(assumptionsCopy),
  ];

  if (blockReasons.length > 0) {
    return {
      status: "BLOCKED",
      blockReasons,
      factual: factualCopy,
      assumptions: assumptionsCopy,
      productive: null,
      commercial: null,
      comparison: null,
      limitations: [
        "Simulação bloqueada por ausência ou inconsistência de parâmetros essenciais.",
        ...blockReasons,
      ],
    };
  }

  const productive = calculateProductive(
    factualCopy.observedWeightKg,
    assumptionsCopy.targetWeightKg,
    assumptionsCopy.assumedGmdKgDay,
  );

  const targetPricingLine = calculateCommercialPricingLine({
    pricingMode: "per_arroba",
    commercialWeight: { unit: "kg", amount: assumptionsCopy.targetWeightKg },
    pricePerArroba: assumptionsCopy.pricePerArroba,
    arrobaBasis: assumptionsCopy.arrobaBasis,
    carcassYieldPercent: assumptionsCopy.carcassYieldPercent,
  });

  if (targetPricingLine.issue || targetPricingLine.arrobas === null || targetPricingLine.individualGrossValue === null) {
    return {
      status: "BLOCKED",
      blockReasons: [targetPricingLine.issue || "Erro no cálculo comercial da arroba no peso-alvo."],
      factual: factualCopy,
      assumptions: assumptionsCopy,
      productive: null,
      commercial: null,
      comparison: null,
      limitations: ["Erro no cálculo comercial da arroba."],
    };
  }

  const targetArrobas = targetPricingLine.arrobas;
  const grossRevenueSimulated = targetPricingLine.individualGrossValue;

  const { costCoverage, incrementalCost } = resolveIncrementalCosts(
    productive.estimatedDays,
    assumptionsCopy.dailyIncrementalCost,
    assumptionsCopy.additionalIncrementalCosts,
  );

  const partialSimulatedMargin =
    incrementalCost !== null ? grossRevenueSimulated - incrementalCost : null;

  const sellNowPricingLine = calculateCommercialPricingLine({
    pricingMode: "per_arroba",
    commercialWeight: { unit: "kg", amount: factualCopy.observedWeightKg },
    pricePerArroba: assumptionsCopy.pricePerArroba,
    arrobaBasis: assumptionsCopy.arrobaBasis,
    carcassYieldPercent: assumptionsCopy.carcassYieldPercent,
  });

  const grossRevenueNow = sellNowPricingLine.individualGrossValue ?? 0;
  const sellNowArrobas = sellNowPricingLine.arrobas ?? 0;

  const breakEvenPricePerArroba =
    incrementalCost !== null && targetArrobas > 0
      ? (grossRevenueNow + incrementalCost) / targetArrobas
      : null;

  const commercial: CommercialSimulationDerived = {
    targetArrobas,
    grossRevenueSimulated,
    incrementalCost,
    costCoverage,
    partialSimulatedMargin,
    breakEvenPricePerArroba,
  };

  const comparison: SimulationComparisonDerived = {
    sellNow: {
      label: "Venda agora",
      weightKg: factualCopy.observedWeightKg,
      arrobas: sellNowArrobas,
      grossRevenue: grossRevenueNow,
    },
    keepUntilTarget: {
      label: "Manter até peso-alvo",
      targetWeightKg: assumptionsCopy.targetWeightKg,
      targetArrobas,
      grossRevenue: grossRevenueSimulated,
      incrementalCost,
      partialIncrementalResult: partialSimulatedMargin,
    },
    difference: {
      grossRevenueDelta: grossRevenueSimulated - grossRevenueNow,
      partialIncrementalResultDelta:
        incrementalCost !== null
          ? (grossRevenueSimulated - incrementalCost) - grossRevenueNow
          : null,
    },
  };

  return {
    status: costCoverage === "COMPLETE" ? "READY" : "PARTIAL",
    factual: factualCopy,
    assumptions: assumptionsCopy,
    productive,
    commercial,
    comparison,
    limitations: buildLimitationsList(costCoverage),
  };
}
