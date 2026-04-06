export type FarmWeightUnit = "kg" | "arroba";

export interface FarmMeasurementConfig {
  weight_unit: FarmWeightUnit;
}

export const DEFAULT_FARM_MEASUREMENT_CONFIG: FarmMeasurementConfig = {
  weight_unit: "kg",
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseWeightUnit(
  value: unknown,
  fallback: FarmWeightUnit,
): FarmWeightUnit {
  return value === "arroba" || value === "kg" ? value : fallback;
}

export function resolveFarmMeasurementConfig(
  metadata: Record<string, unknown> | null | undefined,
): FarmMeasurementConfig {
  const current = asRecord(metadata);
  const measurement = asRecord(current.measurement_preferences);

  return {
    weight_unit: parseWeightUnit(
      measurement.weight_unit,
      DEFAULT_FARM_MEASUREMENT_CONFIG.weight_unit,
    ),
  };
}

export function withFarmMeasurementConfig(
  metadata: Record<string, unknown> | null | undefined,
  config: FarmMeasurementConfig,
): Record<string, unknown> {
  const current = asRecord(metadata);
  const measurement = asRecord(current.measurement_preferences);

  return {
    ...current,
    measurement_preferences: {
      ...measurement,
      weight_unit: config.weight_unit,
    },
  };
}
