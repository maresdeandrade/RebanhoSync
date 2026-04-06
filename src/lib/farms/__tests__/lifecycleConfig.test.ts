import { describe, expect, it } from "vitest";
import {
  DEFAULT_FARM_LIFECYCLE_CONFIG,
  resolveFarmLifecycleConfig,
  withFarmLifecycleConfig,
} from "../lifecycleConfig";

describe("farm lifecycle config", () => {
  it("returns defaults when metadata is missing", () => {
    expect(resolveFarmLifecycleConfig(null)).toEqual(
      DEFAULT_FARM_LIFECYCLE_CONFIG,
    );
  });

  it("reads configured lifecycle thresholds from metadata", () => {
    expect(
      resolveFarmLifecycleConfig({
        animal_lifecycle: {
          neonatal_days: 10,
          weaning_days: 240,
          weaning_weight_kg: 190,
          male_breeding_candidate_days: 420,
          male_breeding_candidate_weight_kg: 330,
          male_adult_days: 760,
          male_adult_weight_kg: 470,
          female_adult_days: 930,
          female_adult_weight_kg: 320,
          default_transition_mode: "hibrido",
          stage_classification_basis: "peso",
          hybrid_auto_apply_age_stages: false,
        },
      }),
    ).toEqual({
      neonatal_days: 10,
      weaning_days: 240,
      weaning_weight_kg: 190,
      male_breeding_candidate_days: 420,
      male_breeding_candidate_weight_kg: 330,
      male_adult_days: 760,
      male_adult_weight_kg: 470,
      female_adult_days: 930,
      female_adult_weight_kg: 320,
      default_transition_mode: "hibrido",
      stage_classification_basis: "peso",
      hybrid_auto_apply_age_stages: false,
    });
  });

  it("merges lifecycle config without dropping other metadata keys", () => {
    expect(
      withFarmLifecycleConfig(
        {
          app_experience: { mode: "essencial" },
        },
        {
          ...DEFAULT_FARM_LIFECYCLE_CONFIG,
          weaning_days: 200,
        },
      ),
    ).toEqual({
      app_experience: { mode: "essencial" },
      animal_lifecycle: {
        ...DEFAULT_FARM_LIFECYCLE_CONFIG,
        weaning_days: 200,
      },
    });
  });
});
