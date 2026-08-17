export const COMMERCIAL_LINE_PRECISION = 2;

function precisionFactor(precision: number) {
  return 10 ** precision;
}

export function parseOptionalCommercialNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function distributeCommercialTotal(
  total: number,
  quantity: number,
  precision = COMMERCIAL_LINE_PRECISION,
): number[] {
  if (
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return [];
  }

  const factor = precisionFactor(precision);
  const totalUnits = Math.round(total * factor);
  const regularUnits = Math.floor(totalUnits / quantity);
  const values = Array.from({ length: quantity }, () => regularUnits / factor);
  values[quantity - 1] = (totalUnits - regularUnits * (quantity - 1)) / factor;
  return values;
}

export function distributeCommercialInput(
  totalInput: string,
  lineIds: readonly string[],
  precision = COMMERCIAL_LINE_PRECISION,
): Record<string, string> {
  const total = parseOptionalCommercialNumber(totalInput);
  if (total === null) {
    return Object.fromEntries(lineIds.map((id) => [id, ""]));
  }
  const distributed = distributeCommercialTotal(
    total,
    lineIds.length,
    precision,
  );
  return Object.fromEntries(
    lineIds.map((id, index) => [id, distributed[index]!.toFixed(precision)]),
  );
}

export function sumCommercialInputs(
  values: readonly string[],
  precision = COMMERCIAL_LINE_PRECISION,
): string {
  const parsed = values.map(parseOptionalCommercialNumber);
  if (parsed.every((value) => value === null)) return "";
  const factor = precisionFactor(precision);
  const units = parsed.reduce(
    (total, value) => total + Math.round((value ?? 0) * factor),
    0,
  );
  return (units / factor).toFixed(precision);
}
