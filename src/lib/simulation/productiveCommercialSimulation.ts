import {
  calculateCommercialPricingLine,
  type CommercialArrobaBasis,
  type CommercialPricingLineCalculation,
} from "@/lib/comercial/commercialPricing";

export type SimulationStatus = "READY" | "PARTIAL" | "BLOCKED";
export type CostCoverage = "COMPLETE" | "PARTIAL";

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
  sellNowCarcassWeightKg?: number | null;
  targetCarcassWeightKg?: number | null;
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

function validateLiveWeightYieldBasis(yieldPercent: number | null | undefined): string | null {
  if (yieldPercent == null || !Number.isFinite(yieldPercent) || yieldPercent <= 0 || yieldPercent > 100) {
    return "Rendimento de carcaça obrigatório e deve estar entre 0 e 100% para a base informada.";
  }
  return null;
}

function validateCarcassWeightBasis(
  targetCarcassKg: number | null | undefined,
  sellNowCarcassKg: number | null | undefined,
): string[] {
  const issues: string[] = [];
  if (targetCarcassKg == null || !Number.isFinite(targetCarcassKg) || targetCarcassKg <= 0) {
    issues.push("Peso de carcaça no peso-alvo é obrigatório para base carcaça.");
  }
  if (sellNowCarcassKg == null || !Number.isFinite(sellNowCarcassKg) || sellNowCarcassKg <= 0) {
    issues.push("Peso de carcaça na venda agora é obrigatório para base carcaça.");
  }
  return issues;
}

function validateArrobaBasis(assumptions: ProductiveCommercialSimulationAssumptionsInput): string[] {
  if (assumptions.arrobaBasis === "live_weight_yield") {
    const yieldIssue = validateLiveWeightYieldBasis(assumptions.carcassYieldPercent);
    return yieldIssue ? [yieldIssue] : [];
  }
  if (assumptions.arrobaBasis === "carcass_weight") {
    return validateCarcassWeightBasis(
      assumptions.targetCarcassWeightKg,
      assumptions.sellNowCarcassWeightKg,
    );
  }
  return ["Base de cálculo da arroba inválida."];
}

function validateAssumptionsInputs(assumptions: ProductiveCommercialSimulationAssumptionsInput): string[] {
  const issues: string[] = [];
  const targetIssue = validateTargetWeight(assumptions.targetWeightKg);
  if (targetIssue) issues.push(targetIssue);
  const gmdIssue = validateAssumedGmd(assumptions.assumedGmdKgDay);
  if (gmdIssue) issues.push(gmdIssue);
  const priceIssue = validatePricePerArroba(assumptions.pricePerArroba);
  if (priceIssue) issues.push(priceIssue);
  issues.push(...validateArrobaBasis(assumptions));
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
  return { costCoverage: "PARTIAL", incrementalCost: null };
}

function buildLimitationsList(costCoverage: CostCoverage, hasIncrementalCost: boolean): string[] {
  const list = [...CANONICAL_LIMITATIONS];
  if (costCoverage === "PARTIAL") {
    if (hasIncrementalCost) {
      list.push(
        "Cálculo parcial com base apenas nos custos informados. Custos ausentes não foram assumidos como zero.",
      );
    } else {
      list.push(
        "Custos incrementais não informados. Margem parcial simulada e preço de equilíbrio não foram calculados.",
      );
    }
  }
  return list;
}

type SingleLineResult =
  | { success: true; line: CommercialPricingLineCalculation }
  | { success: false; issue: string };

function resolveTargetPricingLine(
  assumptions: ProductiveCommercialSimulationAssumptionsInput,
): SingleLineResult {
  const isLive = assumptions.arrobaBasis === "live_weight_yield";
  const line = calculateCommercialPricingLine({
    pricingMode: "per_arroba",
    commercialWeight: {
      unit: "kg",
      amount: isLive ? assumptions.targetWeightKg : assumptions.targetCarcassWeightKg!,
    },
    pricePerArroba: assumptions.pricePerArroba,
    arrobaBasis: assumptions.arrobaBasis,
    carcassYieldPercent: isLive ? assumptions.carcassYieldPercent : undefined,
  });

  if (line.issue || line.arrobas === null || line.individualGrossValue === null) {
    return { success: false, issue: line.issue || "Erro no cálculo comercial da arroba no peso-alvo." };
  }
  return { success: true, line };
}

function resolveSellNowPricingLine(
  factual: ProductiveCommercialSimulationFactualInput,
  assumptions: ProductiveCommercialSimulationAssumptionsInput,
): SingleLineResult {
  const isLive = assumptions.arrobaBasis === "live_weight_yield";
  const line = calculateCommercialPricingLine({
    pricingMode: "per_arroba",
    commercialWeight: {
      unit: "kg",
      amount: isLive ? factual.observedWeightKg : assumptions.sellNowCarcassWeightKg!,
    },
    pricePerArroba: assumptions.pricePerArroba,
    arrobaBasis: assumptions.arrobaBasis,
    carcassYieldPercent: isLive ? assumptions.carcassYieldPercent : undefined,
  });

  if (line.issue || line.arrobas === null || line.individualGrossValue === null) {
    return { success: false, issue: line.issue || "Erro no cálculo comercial da venda agora." };
  }
  return { success: true, line };
}

function buildComparisonScenario(
  observedWeightKg: number,
  targetWeightKg: number,
  sellNowArrobas: number,
  grossRevenueNow: number,
  targetArrobas: number,
  grossRevenueSimulated: number,
  incrementalCost: number | null,
  partialSimulatedMargin: number | null,
): SimulationComparisonDerived {
  return {
    sellNow: {
      label: "Venda agora",
      weightKg: observedWeightKg,
      arrobas: sellNowArrobas,
      grossRevenue: grossRevenueNow,
    },
    keepUntilTarget: {
      label: "Manter até peso-alvo",
      targetWeightKg,
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

  const targetRes = resolveTargetPricingLine(assumptionsCopy);
  if (!targetRes.success) {
    return {
      status: "BLOCKED",
      blockReasons: [targetRes.issue],
      factual: factualCopy,
      assumptions: assumptionsCopy,
      productive: null,
      commercial: null,
      comparison: null,
      limitations: ["Erro no cálculo comercial da arroba.", targetRes.issue],
    };
  }

  const sellNowRes = resolveSellNowPricingLine(factualCopy, assumptionsCopy);
  if (!sellNowRes.success) {
    return {
      status: "BLOCKED",
      blockReasons: [sellNowRes.issue],
      factual: factualCopy,
      assumptions: assumptionsCopy,
      productive: null,
      commercial: null,
      comparison: null,
      limitations: ["Erro no cálculo comercial da venda agora.", sellNowRes.issue],
    };
  }

  const targetArrobas = targetRes.line.arrobas!;
  const grossRevenueSimulated = targetRes.line.individualGrossValue!;
  const grossRevenueNow = sellNowRes.line.individualGrossValue!;
  const sellNowArrobas = sellNowRes.line.arrobas!;

  const { costCoverage, incrementalCost } = resolveIncrementalCosts(
    productive.estimatedDays,
    assumptionsCopy.dailyIncrementalCost,
    assumptionsCopy.additionalIncrementalCosts,
  );

  const partialSimulatedMargin =
    incrementalCost !== null ? grossRevenueSimulated - incrementalCost : null;

  const breakEvenPricePerArroba =
    costCoverage === "COMPLETE" && incrementalCost !== null && targetArrobas > 0
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

  const comparison = buildComparisonScenario(
    factualCopy.observedWeightKg,
    assumptionsCopy.targetWeightKg,
    sellNowArrobas,
    grossRevenueNow,
    targetArrobas,
    grossRevenueSimulated,
    incrementalCost,
    partialSimulatedMargin,
  );

  return {
    status: costCoverage === "COMPLETE" ? "READY" : "PARTIAL",
    factual: factualCopy,
    assumptions: assumptionsCopy,
    productive,
    commercial,
    comparison,
    limitations: buildLimitationsList(costCoverage, incrementalCost !== null),
  };
}
