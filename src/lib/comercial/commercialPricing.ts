export type CommercialPricingMode = "per_head" | "per_arroba" | "total_value";
export type CommercialArrobaBasis = "carcass_weight" | "live_weight_yield";
export type CommercialWeightUnit = "kg" | "arroba";
export type CommercialWeightSource = "direct" | "calculated";
export type CommercialPricingValueSource = "input" | "derived";
export type CommercialWeight<TAmount = number> =
  | { unit: "kg"; amount: TAmount }
  | { unit: "arroba"; amount: TAmount };

export function resolveCommercialWeightUnit(
  _pricingMode: CommercialPricingMode,
  arrobaBasis: CommercialArrobaBasis | null = null,
): CommercialWeightUnit {
  return arrobaBasis === null ? "arroba" : "kg";
}

const DECIMAL_SCALE = 1_000_000n;
const MONEY_SCALE = 100n;

type DecimalInput = string | number | null | undefined;

function parseDecimal(value: DecimalInput): bigint | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const padded = `${fraction}000000`.slice(0, 6);
  return BigInt(whole!) * DECIMAL_SCALE + BigInt(padded);
}

function divideRounded(numerator: bigint, denominator: bigint) {
  return (numerator + denominator / 2n) / denominator;
}

function scaledToNumber(value: bigint, scale = DECIMAL_SCALE) {
  return Number(value) / Number(scale);
}

function toFixedDecimal(
  value: bigint,
  decimals: number,
  scale = DECIMAL_SCALE,
) {
  return scaledToNumber(value, scale).toFixed(decimals);
}

function trimDecimalInput(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function parseCarcassYield(value: DecimalInput) {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed > 0n && parsed <= 100n * DECIMAL_SCALE
    ? parsed
    : null;
}

export interface CommercialWeightConversion {
  issue: string | null;
  valueKg: number | null;
  displayValue: number | null;
  displayInput: string;
}

export function convertCommercialWeightToKg(input: {
  displayWeight: DecimalInput;
  weightUnit: CommercialWeightUnit;
  arrobaBasis?: CommercialArrobaBasis | null;
  carcassYieldPercent?: DecimalInput;
}): CommercialWeightConversion {
  const displayWeight = parseDecimal(input.displayWeight);
  if (displayWeight === null) {
    return { issue: null, valueKg: null, displayValue: null, displayInput: "" };
  }

  if (input.weightUnit === "kg") {
    return {
      issue: null,
      valueKg: scaledToNumber(displayWeight),
      displayValue: scaledToNumber(displayWeight),
      displayInput: trimDecimalInput(toFixedDecimal(displayWeight, 2)),
    };
  }
  if (!input.arrobaBasis) {
    return {
      issue: "Selecione a base de cálculo da arroba.",
      valueKg: null,
      displayValue: scaledToNumber(displayWeight),
      displayInput: trimDecimalInput(toFixedDecimal(displayWeight, 2)),
    };
  }

  let weightKg: bigint;
  if (input.arrobaBasis === "carcass_weight") {
    weightKg = displayWeight * 15n;
  } else {
    const yieldPercent = parseCarcassYield(input.carcassYieldPercent);
    if (yieldPercent === null) {
      return {
        issue:
          "Informe rendimento de carcaça entre 0 e 100% para converter arrobas.",
        valueKg: null,
        displayValue: scaledToNumber(displayWeight),
        displayInput: trimDecimalInput(toFixedDecimal(displayWeight, 2)),
      };
    }
    weightKg = divideRounded(
      displayWeight * 1_500n * DECIMAL_SCALE,
      yieldPercent,
    );
  }

  return {
    issue: null,
    valueKg: scaledToNumber(weightKg),
    displayValue: scaledToNumber(displayWeight),
    displayInput: trimDecimalInput(toFixedDecimal(displayWeight, 2)),
  };
}

export function convertCommercialWeightFromKg(input: {
  weightKg: DecimalInput;
  weightUnit: CommercialWeightUnit;
  arrobaBasis?: CommercialArrobaBasis | null;
  carcassYieldPercent?: DecimalInput;
}): CommercialWeightConversion {
  const weightKg = parseDecimal(input.weightKg);
  if (weightKg === null) {
    return { issue: null, valueKg: null, displayValue: null, displayInput: "" };
  }

  if (input.weightUnit === "kg") {
    return {
      issue: null,
      valueKg: scaledToNumber(weightKg),
      displayValue: scaledToNumber(weightKg),
      displayInput: trimDecimalInput(toFixedDecimal(weightKg, 2)),
    };
  }
  if (!input.arrobaBasis) {
    return {
      issue: "Selecione a base de cálculo da arroba.",
      valueKg: scaledToNumber(weightKg),
      displayValue: null,
      displayInput: "",
    };
  }

  let displayWeight: bigint;
  if (input.arrobaBasis === "carcass_weight") {
    displayWeight = divideRounded(weightKg, 15n);
  } else {
    const yieldPercent = parseCarcassYield(input.carcassYieldPercent);
    if (yieldPercent === null) {
      return {
        issue:
          "Informe rendimento de carcaça entre 0 e 100% para converter arrobas.",
        valueKg: scaledToNumber(weightKg),
        displayValue: null,
        displayInput: "",
      };
    }
    displayWeight = divideRounded(
      weightKg * yieldPercent,
      1_500n * DECIMAL_SCALE,
    );
  }

  return {
    issue: null,
    valueKg: scaledToNumber(weightKg),
    displayValue: scaledToNumber(displayWeight),
    displayInput: trimDecimalInput(toFixedDecimal(displayWeight, 2)),
  };
}

export function sumCommercialWeights(
  values: readonly CommercialWeight<DecimalInput>[],
): CommercialWeight<string> | null {
  if (values.length === 0) return null;
  const unit = values[0]!.unit;
  if (values.some((value) => value.unit !== unit)) {
    throw new Error("Não some pesos comerciais de unidades diferentes.");
  }
  const parsed = values.map((value) => parseDecimal(value.amount));
  if (parsed.every((value) => value === null)) {
    return { unit, amount: "" } as CommercialWeight<string>;
  }
  const total = parsed.reduce((sum, value) => sum + (value ?? 0n), 0n);
  return {
    unit,
    amount: trimDecimalInput(toFixedDecimal(total, 6)),
  } as CommercialWeight<string>;
}

export function switchCommercialWeightUnit<TAmount>(
  current: CommercialWeight<TAmount>,
  nextUnit: CommercialWeightUnit,
): CommercialWeight<TAmount | null> {
  if (current.unit === nextUnit) return current;
  return { unit: nextUnit, amount: null } as CommercialWeight<TAmount | null>;
}

export interface CommercialPricingLineCalculation {
  issue: string | null;
  commercialWeight: CommercialWeight | null;
  weightSource: CommercialWeightSource;
  weightConsideredKg: number | null;
  arrobas: number | null;
  individualGrossValue: number | null;
  arrobasInput: string;
  individualGrossValueInput: string;
  individualGrossValueSource?: CommercialPricingValueSource;
}

export function calculateCommercialPricingLine(input: {
  pricingMode: CommercialPricingMode;
  commercialWeight: CommercialWeight<DecimalInput>;
  pricePerHead?: DecimalInput;
  /** Valor individual rateado a partir do total informado no modo total_value. */
  allocatedGrossValue?: DecimalInput;
  pricePerArroba?: DecimalInput;
  arrobaBasis?: CommercialArrobaBasis | null;
  carcassYieldPercent?: DecimalInput;
}): CommercialPricingLineCalculation {
  const weightUnit = input.commercialWeight.unit;
  const weight = parseDecimal(input.commercialWeight.amount);
  const commercialWeight =
    weight === null
      ? null
      : ({
          unit: weightUnit,
          amount: scaledToNumber(weight),
        } as CommercialWeight);
  const weightConsideredKg =
    weightUnit === "kg" && weight !== null ? scaledToNumber(weight) : null;
  const weightSource: CommercialWeightSource =
    weightUnit === "kg" && input.arrobaBasis !== null ? "calculated" : "direct";
  if (input.pricingMode === "per_head" || input.pricingMode === "total_value") {
    const valueInput =
      input.pricingMode === "per_head"
        ? input.pricePerHead
        : input.allocatedGrossValue;
    const value = parseDecimal(valueInput);
    if (value === null) {
      return {
        issue:
          input.pricingMode === "total_value"
            ? "Informe o valor total da negociação."
            : "Informe o valor por cabeça.",
        commercialWeight,
        weightSource,
        weightConsideredKg,
        arrobas: null,
        individualGrossValue: null,
        arrobasInput: "",
        individualGrossValueInput: "",
      };
    }
    const cents = divideRounded(value * MONEY_SCALE, DECIMAL_SCALE);
    let derivedArrobas: bigint | null = weightUnit === "arroba" ? weight : null;
    if (weightUnit === "kg" && weight !== null && input.arrobaBasis) {
      if (input.arrobaBasis === "carcass_weight") {
        derivedArrobas = divideRounded(weight, 15n);
      } else {
        const yieldPercent = parseCarcassYield(input.carcassYieldPercent);
        if (yieldPercent === null) {
          return {
            issue: "Informe rendimento de carcaça entre 0 e 100%.",
            commercialWeight,
            weightSource: "calculated",
            weightConsideredKg,
            arrobas: null,
            individualGrossValue: null,
            arrobasInput: "",
            individualGrossValueInput: "",
          };
        }
        derivedArrobas = divideRounded(
          weight * yieldPercent,
          1_500n * DECIMAL_SCALE,
        );
      }
    }
    return {
      issue: null,
      commercialWeight,
      weightSource,
      weightConsideredKg,
      arrobas: derivedArrobas === null ? null : scaledToNumber(derivedArrobas),
      individualGrossValue: scaledToNumber(cents, MONEY_SCALE),
      individualGrossValueSource:
        input.pricingMode === "per_head" ? "input" : "derived",
      arrobasInput:
        derivedArrobas === null ? "" : toFixedDecimal(derivedArrobas, 4),
      individualGrossValueInput: toFixedDecimal(cents, 2, MONEY_SCALE),
    };
  }

  const pricePerArroba = parseDecimal(input.pricePerArroba);
  if (pricePerArroba === null) {
    return {
      issue: "Informe o preço por arroba.",
      commercialWeight,
      weightSource,
      weightConsideredKg,
      arrobas: null,
      individualGrossValue: null,
      arrobasInput: "",
      individualGrossValueInput: "",
    };
  }
  if (weightUnit === "arroba") {
    if (weight === null) {
      return {
        issue: "Informe o peso comercial em arrobas.",
        commercialWeight: null,
        weightSource,
        weightConsideredKg: null,
        arrobas: null,
        individualGrossValue: null,
        arrobasInput: "",
        individualGrossValueInput: "",
      };
    }
    const grossCents = divideRounded(
      weight * pricePerArroba * MONEY_SCALE,
      DECIMAL_SCALE * DECIMAL_SCALE,
    );
    return {
      issue: null,
      commercialWeight,
      weightSource,
      weightConsideredKg: null,
      arrobas: scaledToNumber(weight),
      individualGrossValue: scaledToNumber(grossCents, MONEY_SCALE),
      individualGrossValueSource: "derived",
      arrobasInput: toFixedDecimal(weight, 4),
      individualGrossValueInput: toFixedDecimal(grossCents, 2, MONEY_SCALE),
    };
  }
  if (!input.arrobaBasis) {
    return {
      issue: "Selecione a base de cálculo da arroba.",
      commercialWeight,
      weightSource,
      weightConsideredKg,
      arrobas: null,
      individualGrossValue: null,
      arrobasInput: "",
      individualGrossValueInput: "",
    };
  }
  if (weight === null) {
    return {
      issue: "Informe o peso considerado.",
      commercialWeight: null,
      weightSource,
      weightConsideredKg: null,
      arrobas: null,
      individualGrossValue: null,
      arrobasInput: "",
      individualGrossValueInput: "",
    };
  }

  let arrobas: bigint;
  if (input.arrobaBasis === "carcass_weight") {
    arrobas = divideRounded(weight, 15n);
  } else {
    const yieldPercent = parseDecimal(input.carcassYieldPercent);
    if (
      yieldPercent === null ||
      yieldPercent <= 0n ||
      yieldPercent > 100n * DECIMAL_SCALE
    ) {
      return {
        issue: "Informe rendimento de carcaça entre 0 e 100%.",
        commercialWeight,
        weightSource,
        weightConsideredKg,
        arrobas: null,
        individualGrossValue: null,
        arrobasInput: "",
        individualGrossValueInput: "",
      };
    }
    arrobas = divideRounded(weight * yieldPercent, 1_500n * DECIMAL_SCALE);
  }
  const grossCents = divideRounded(
    arrobas * pricePerArroba * MONEY_SCALE,
    DECIMAL_SCALE * DECIMAL_SCALE,
  );
  return {
    issue: null,
    commercialWeight,
    weightSource,
    weightConsideredKg,
    arrobas: scaledToNumber(arrobas),
    individualGrossValue: scaledToNumber(grossCents, MONEY_SCALE),
    individualGrossValueSource: "derived",
    arrobasInput: toFixedDecimal(arrobas, 4),
    individualGrossValueInput: toFixedDecimal(grossCents, 2, MONEY_SCALE),
  };
}

export interface CommercialPricingSimulationLineInput {
  lineRef: string;
  commercialWeight: CommercialWeight<string | number | null | undefined>;
  pricePerHead?: string | number | null;
}

export interface CommercialPricingSimulationResult {
  issue: string | null;
  calculations: Record<string, CommercialPricingLineCalculation>;
  grossValue: { value: number; input: string } | null;
  totalArrobas: { value: number; input: string } | null;
  effectivePricePerArrobaGross: { value: number; input: string } | null;
  effectivePricePerArrobaNet: { value: number; input: string } | null;
  effectivePricePerHeadGross: { value: number; input: string } | null;
  effectivePricePerHeadNet: { value: number; input: string } | null;
}

/**
 * Simulação local/transitória. Este cálculo não cria eventos, operações,
 * alterações de estado animal, lançamentos financeiros ou fila de sync.
 */
export function simulateCommercialPricing(input: {
  pricingMode: CommercialPricingMode;
  weightUnit: CommercialWeightUnit;
  pricePerArroba?: string | number | null;
  arrobaBasis?: CommercialArrobaBasis | null;
  carcassYieldPercent?: string | number | null;
  totalValue?: string | number | null;
  netValue?: string | number | null;
  lines: readonly CommercialPricingSimulationLineInput[];
}): CommercialPricingSimulationResult {
  const allocations =
    input.pricingMode === "total_value"
      ? allocateCommercialTotalValue(input.totalValue, input.lines.length)
      : null;
  const calculations = input.lines.map((line, index) =>
    calculateCommercialPricingLine({
      pricingMode: input.pricingMode,
      commercialWeight: line.commercialWeight,
      pricePerHead:
        input.pricingMode === "per_head" ? line.pricePerHead : undefined,
      allocatedGrossValue:
        input.pricingMode === "total_value"
          ? allocations?.[index]?.value
          : undefined,
      pricePerArroba: input.pricePerArroba,
      arrobaBasis: input.arrobaBasis,
      carcassYieldPercent: input.carcassYieldPercent,
    }),
  );
  const calculationMap = Object.fromEntries(
    input.lines.map((line, index) => [line.lineRef, calculations[index]!]),
  );
  const issue = calculations.find((calculation) => calculation.issue)?.issue ?? null;
  const grossValue = issue ? null : sumCommercialPricingValues(calculations);
  const totalArrobas = issue ? null : sumCommercialArrobas(calculations);
  const effectiveArrobaPrices =
    totalArrobas && grossValue
      ? calculateEffectiveArrobaPrices({
          totalArrobas: totalArrobas.value,
          grossValue: grossValue.value,
          netValue: input.netValue,
        })
      : null;
  return {
    issue,
    calculations: calculationMap,
    grossValue,
    totalArrobas,
    effectivePricePerArrobaGross: effectiveArrobaPrices?.gross ?? null,
    effectivePricePerArrobaNet: effectiveArrobaPrices?.net ?? null,
    effectivePricePerHeadGross: calculateAverageCommercialPricePerHead({
      totalValue: grossValue?.value,
      quantity: input.lines.length,
    }),
    effectivePricePerHeadNet: calculateAverageCommercialPricePerHead({
      totalValue: input.netValue,
      quantity: input.lines.length,
    }),
  };
}

export function sumCommercialPricingValues(
  calculations: readonly CommercialPricingLineCalculation[],
) {
  if (
    calculations.some(
      (item) => item.issue || item.individualGrossValue === null,
    )
  ) {
    return null;
  }
  const cents = calculations.reduce(
    (total, item) =>
      total + BigInt(Math.round((item.individualGrossValue ?? 0) * 100)),
    0n,
  );
  return {
    value: scaledToNumber(cents, MONEY_SCALE),
    input: toFixedDecimal(cents, 2, MONEY_SCALE),
  };
}

export interface CommercialTotalValueAllocation {
  value: number;
  input: string;
}

/**
 * Rateia um valor total em centavos, entregando o resto de centavos às
 * primeiras linhas. A ordem recebida é a ordem factual das linhas.
 */
export function allocateCommercialTotalValue(
  totalValue: DecimalInput,
  lineCount: number,
): CommercialTotalValueAllocation[] | null {
  const parsed = parseDecimal(totalValue);
  if (parsed === null || !Number.isInteger(lineCount) || lineCount < 1) {
    return null;
  }
  const totalCents = divideRounded(parsed * MONEY_SCALE, DECIMAL_SCALE);
  const count = BigInt(lineCount);
  const base = totalCents / count;
  const remainder = Number(totalCents % count);
  return Array.from({ length: lineCount }, (_, index) => {
    const cents = base + (index < remainder ? 1n : 0n);
    return {
      value: scaledToNumber(cents, MONEY_SCALE),
      input: toFixedDecimal(cents, 2, MONEY_SCALE),
    };
  });
}

export function calculateAverageCommercialPricePerHead(input: {
  totalValue: DecimalInput;
  quantity: number;
}) {
  const total = parseDecimal(input.totalValue);
  if (total === null || !Number.isInteger(input.quantity) || input.quantity < 1) {
    return null;
  }
  const totalCents = divideRounded(total * MONEY_SCALE, DECIMAL_SCALE);
  const averageCents = divideRounded(totalCents, BigInt(input.quantity));
  return {
    value: scaledToNumber(averageCents, MONEY_SCALE),
    input: toFixedDecimal(averageCents, 2, MONEY_SCALE),
  };
}

export function sumCommercialArrobas(
  calculations: readonly CommercialPricingLineCalculation[],
) {
  if (calculations.some((item) => item.issue || item.arrobas === null))
    return null;
  const total = calculations.reduce(
    (sum, item) => sum + (parseDecimal(item.arrobas) ?? 0n),
    0n,
  );
  return {
    value: scaledToNumber(total),
    input: trimDecimalInput(toFixedDecimal(total, 6)),
  };
}

export function calculateEffectiveArrobaPrices(input: {
  totalArrobas: DecimalInput;
  grossValue: DecimalInput;
  netValue: DecimalInput;
}) {
  const totalArrobas = parseDecimal(input.totalArrobas);
  if (totalArrobas === null || totalArrobas <= 0n) return null;
  const price = (value: DecimalInput) => {
    const parsed = parseDecimal(value);
    if (parsed === null) return null;
    const effective = divideRounded(parsed * DECIMAL_SCALE, totalArrobas);
    return {
      value: scaledToNumber(effective),
      input: toFixedDecimal(effective, 2),
    };
  };
  return { gross: price(input.grossValue), net: price(input.netValue) };
}
