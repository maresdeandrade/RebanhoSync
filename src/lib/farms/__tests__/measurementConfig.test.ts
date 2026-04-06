import { describe, expect, it } from "vitest";

import {
  DEFAULT_FARM_MEASUREMENT_CONFIG,
  resolveFarmMeasurementConfig,
  withFarmMeasurementConfig,
} from "@/lib/farms/measurementConfig";

describe("measurementConfig", () => {
  it("falls back to kg when metadata is empty", () => {
    expect(resolveFarmMeasurementConfig(null)).toEqual(
      DEFAULT_FARM_MEASUREMENT_CONFIG,
    );
  });

  it("persists the selected unit under measurement_preferences", () => {
    const metadata = withFarmMeasurementConfig(
      { experience_mode: "completo" },
      { weight_unit: "arroba" },
    );

    expect(metadata).toMatchObject({
      experience_mode: "completo",
      measurement_preferences: {
        weight_unit: "arroba",
      },
    });
    expect(resolveFarmMeasurementConfig(metadata).weight_unit).toBe("arroba");
  });
});
