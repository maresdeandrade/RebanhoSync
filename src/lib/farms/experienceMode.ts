export const FARM_EXPERIENCE_MODES = ["essencial", "completo"] as const;

export type FarmExperienceMode = (typeof FARM_EXPERIENCE_MODES)[number];

export const DEFAULT_FARM_EXPERIENCE_MODE: FarmExperienceMode = "essencial";

function isFarmExperienceMode(value: unknown): value is FarmExperienceMode {
  return (
    typeof value === "string" &&
    FARM_EXPERIENCE_MODES.includes(value as FarmExperienceMode)
  );
}

export function resolveFarmExperienceMode(
  metadata: Record<string, unknown> | null | undefined,
): FarmExperienceMode {
  const experienceRaw = metadata?.app_experience;
  const experience =
    experienceRaw && typeof experienceRaw === "object"
      ? (experienceRaw as Record<string, unknown>)
      : {};

  return isFarmExperienceMode(experience.mode)
    ? experience.mode
    : DEFAULT_FARM_EXPERIENCE_MODE;
}

export function withFarmExperienceMode(
  metadata: Record<string, unknown> | null | undefined,
  mode: FarmExperienceMode,
): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object"
      ? { ...metadata }
      : ({} as Record<string, unknown>);

  const existingExperience = current.app_experience;
  const appExperience =
    existingExperience && typeof existingExperience === "object"
      ? { ...(existingExperience as Record<string, unknown>) }
      : {};

  return {
    ...current,
    app_experience: {
      ...appExperience,
      mode,
    },
  };
}
