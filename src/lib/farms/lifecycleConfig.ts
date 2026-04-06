export interface FarmLifecycleConfig {
  neonatal_days: number;
  weaning_days: number;
  weaning_weight_kg: number;
  male_breeding_candidate_days: number;
  male_breeding_candidate_weight_kg: number;
  male_adult_days: number;
  male_adult_weight_kg: number;
  female_adult_days: number;
  female_adult_weight_kg: number;
  default_transition_mode: "manual" | "hibrido" | "automatico";
  stage_classification_basis: "idade" | "peso";
  hybrid_auto_apply_age_stages: boolean;
}

export const DEFAULT_FARM_LIFECYCLE_CONFIG: FarmLifecycleConfig = {
  neonatal_days: 7,
  weaning_days: 210,
  weaning_weight_kg: 180,
  male_breeding_candidate_days: 450,
  male_breeding_candidate_weight_kg: 320,
  male_adult_days: 731,
  male_adult_weight_kg: 450,
  female_adult_days: 901,
  female_adult_weight_kg: 300,
  default_transition_mode: "manual",
  stage_classification_basis: "idade",
  hybrid_auto_apply_age_stages: true,
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parsePositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseTransitionMode(
  value: unknown,
  fallback: FarmLifecycleConfig["default_transition_mode"],
) {
  return value === "manual" || value === "hibrido" || value === "automatico"
    ? value
    : fallback;
}

function parseClassificationBasis(
  value: unknown,
  fallback: FarmLifecycleConfig["stage_classification_basis"],
) {
  return value === "idade" || value === "peso" ? value : fallback;
}

export function resolveFarmLifecycleConfig(
  metadata: Record<string, unknown> | null | undefined,
): FarmLifecycleConfig {
  const current = asRecord(metadata);
  const lifecycle = asRecord(current.animal_lifecycle);

  return {
    neonatal_days: parsePositiveNumber(
      lifecycle.neonatal_days,
      DEFAULT_FARM_LIFECYCLE_CONFIG.neonatal_days,
    ),
    weaning_days: parsePositiveNumber(
      lifecycle.weaning_days,
      DEFAULT_FARM_LIFECYCLE_CONFIG.weaning_days,
    ),
    weaning_weight_kg: parsePositiveNumber(
      lifecycle.weaning_weight_kg,
      DEFAULT_FARM_LIFECYCLE_CONFIG.weaning_weight_kg,
    ),
    male_breeding_candidate_days: parsePositiveNumber(
      lifecycle.male_breeding_candidate_days,
      DEFAULT_FARM_LIFECYCLE_CONFIG.male_breeding_candidate_days,
    ),
    male_breeding_candidate_weight_kg: parsePositiveNumber(
      lifecycle.male_breeding_candidate_weight_kg,
      DEFAULT_FARM_LIFECYCLE_CONFIG.male_breeding_candidate_weight_kg,
    ),
    male_adult_days: parsePositiveNumber(
      lifecycle.male_adult_days,
      DEFAULT_FARM_LIFECYCLE_CONFIG.male_adult_days,
    ),
    male_adult_weight_kg: parsePositiveNumber(
      lifecycle.male_adult_weight_kg,
      DEFAULT_FARM_LIFECYCLE_CONFIG.male_adult_weight_kg,
    ),
    female_adult_days: parsePositiveNumber(
      lifecycle.female_adult_days,
      DEFAULT_FARM_LIFECYCLE_CONFIG.female_adult_days,
    ),
    female_adult_weight_kg: parsePositiveNumber(
      lifecycle.female_adult_weight_kg,
      DEFAULT_FARM_LIFECYCLE_CONFIG.female_adult_weight_kg,
    ),
    default_transition_mode: parseTransitionMode(
      lifecycle.default_transition_mode,
      DEFAULT_FARM_LIFECYCLE_CONFIG.default_transition_mode,
    ),
    stage_classification_basis: parseClassificationBasis(
      lifecycle.stage_classification_basis,
      DEFAULT_FARM_LIFECYCLE_CONFIG.stage_classification_basis,
    ),
    hybrid_auto_apply_age_stages: parseBoolean(
      lifecycle.hybrid_auto_apply_age_stages,
      DEFAULT_FARM_LIFECYCLE_CONFIG.hybrid_auto_apply_age_stages,
    ),
  };
}

export function withFarmLifecycleConfig(
  metadata: Record<string, unknown> | null | undefined,
  config: FarmLifecycleConfig,
): Record<string, unknown> {
  const current = asRecord(metadata);
  const lifecycle = asRecord(current.animal_lifecycle);

  return {
    ...current,
    animal_lifecycle: {
      ...lifecycle,
      neonatal_days: config.neonatal_days,
      weaning_days: config.weaning_days,
      weaning_weight_kg: config.weaning_weight_kg,
      male_breeding_candidate_days: config.male_breeding_candidate_days,
      male_breeding_candidate_weight_kg: config.male_breeding_candidate_weight_kg,
      male_adult_days: config.male_adult_days,
      male_adult_weight_kg: config.male_adult_weight_kg,
      female_adult_days: config.female_adult_days,
      female_adult_weight_kg: config.female_adult_weight_kg,
      default_transition_mode: config.default_transition_mode,
      stage_classification_basis: config.stage_classification_basis,
      hybrid_auto_apply_age_stages: config.hybrid_auto_apply_age_stages,
    },
  };
}
