import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";

export const KG_PER_ARROBA = 15;

function getDisplayFormatter(unit: FarmWeightUnit) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: unit === "arroba" ? 2 : 1,
    maximumFractionDigits: unit === "arroba" ? 2 : 1,
  });
}

function trimNumericString(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

export function getWeightUnitLabel(unit: FarmWeightUnit) {
  return unit === "arroba" ? "arroba" : "kg";
}

export function getWeightInputStep(unit: FarmWeightUnit) {
  return unit === "arroba" ? "0.01" : "0.1";
}

export function convertKgToWeightUnit(
  valueKg: number,
  unit: FarmWeightUnit,
): number {
  return unit === "arroba" ? valueKg / KG_PER_ARROBA : valueKg;
}

export function convertWeightUnitToKg(
  value: number,
  unit: FarmWeightUnit,
): number {
  return unit === "arroba" ? value * KG_PER_ARROBA : value;
}

export function parseWeightInput(
  value: string,
  unit: FarmWeightUnit,
): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return convertWeightUnitToKg(parsed, unit);
}

export function formatWeightInput(
  valueKg: number | null | undefined,
  unit: FarmWeightUnit,
): string {
  if (typeof valueKg !== "number" || !Number.isFinite(valueKg)) {
    return "";
  }

  const converted = convertKgToWeightUnit(valueKg, unit);
  const precision = unit === "arroba" ? 2 : 1;
  return trimNumericString(converted.toFixed(precision));
}

export function formatWeight(
  valueKg: number | null | undefined,
  unit: FarmWeightUnit,
): string {
  if (typeof valueKg !== "number" || !Number.isFinite(valueKg)) {
    return "-";
  }

  return `${getDisplayFormatter(unit).format(
    convertKgToWeightUnit(valueKg, unit),
  )} ${getWeightUnitLabel(unit)}`;
}

export function formatWeightValue(
  valueKg: number | null | undefined,
  unit: FarmWeightUnit,
): string {
  if (typeof valueKg !== "number" || !Number.isFinite(valueKg)) {
    return "-";
  }

  return getDisplayFormatter(unit).format(convertKgToWeightUnit(valueKg, unit));
}

export function formatWeightPerDay(
  valueKgPerDay: number | null | undefined,
  unit: FarmWeightUnit,
): string {
  if (typeof valueKgPerDay !== "number" || !Number.isFinite(valueKgPerDay)) {
    return "Aguardando serie";
  }

  const converted = convertKgToWeightUnit(valueKgPerDay, unit);
  return `${getDisplayFormatter(unit).format(converted)} ${getWeightUnitLabel(unit)}/dia`;
}
