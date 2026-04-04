import { describe, expect, it } from "vitest";
import {
  DEFAULT_FARM_EXPERIENCE_MODE,
  resolveFarmExperienceMode,
  withFarmExperienceMode,
} from "../experienceMode";

describe("resolveFarmExperienceMode", () => {
  it("returns the default mode when metadata is null", () => {
    expect(resolveFarmExperienceMode(null)).toBe(
      DEFAULT_FARM_EXPERIENCE_MODE,
    );
  });

  it("returns the default mode when app_experience is missing", () => {
    expect(resolveFarmExperienceMode({})).toBe(DEFAULT_FARM_EXPERIENCE_MODE);
  });

  it("returns the default mode when the stored mode is invalid", () => {
    expect(
      resolveFarmExperienceMode({
        app_experience: {
          mode: "avancado",
        },
      }),
    ).toBe(DEFAULT_FARM_EXPERIENCE_MODE);
  });

  it("resolves explicit modes from metadata", () => {
    expect(
      resolveFarmExperienceMode({
        app_experience: {
          mode: "completo",
        },
      }),
    ).toBe("completo");
  });
});

describe("withFarmExperienceMode", () => {
  it("writes the mode into a new metadata object", () => {
    expect(withFarmExperienceMode(null, "essencial")).toEqual({
      app_experience: {
        mode: "essencial",
      },
    });
  });

  it("merges the mode without dropping existing metadata", () => {
    expect(
      withFarmExperienceMode(
        {
          existing_key: "value",
          app_experience: {
            onboarding_done: true,
          },
        },
        "completo",
      ),
    ).toEqual({
      existing_key: "value",
      app_experience: {
        onboarding_done: true,
        mode: "completo",
      },
    });
  });

  it("does not mutate the original metadata object", () => {
    const metadata = {
      app_experience: {
        onboarding_done: true,
      },
    };

    withFarmExperienceMode(metadata, "completo");

    expect(metadata).toEqual({
      app_experience: {
        onboarding_done: true,
      },
    });
  });
});
