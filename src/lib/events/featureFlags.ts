export interface EventosRolloutFlags {
  strict_rules_enabled: boolean;
  strict_anti_teleporte: boolean;
}

export const DEFAULT_EVENTOS_ROLLOUT_FLAGS: EventosRolloutFlags = {
  strict_rules_enabled: true,
  strict_anti_teleporte: true,
};

function asBooleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveEventosRolloutFlags(
  metadata: Record<string, unknown> | null | undefined,
): EventosRolloutFlags {
  const rolloutRaw = metadata?.eventos_rollout;
  const rollout =
    rolloutRaw && typeof rolloutRaw === "object"
      ? (rolloutRaw as Record<string, unknown>)
      : {};

  const strictRules = asBooleanOrDefault(
    rollout.strict_rules_enabled,
    DEFAULT_EVENTOS_ROLLOUT_FLAGS.strict_rules_enabled,
  );
  const strictAntiTeleport = asBooleanOrDefault(
    rollout.strict_anti_teleporte,
    DEFAULT_EVENTOS_ROLLOUT_FLAGS.strict_anti_teleporte,
  );

  return {
    strict_rules_enabled: strictRules,
    strict_anti_teleporte: strictAntiTeleport,
  };
}

export function withEventosRolloutFlags(
  metadata: Record<string, unknown> | null | undefined,
  flags: EventosRolloutFlags,
): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object"
      ? { ...metadata }
      : ({} as Record<string, unknown>);

  return {
    ...current,
    eventos_rollout: {
      strict_rules_enabled: flags.strict_rules_enabled,
      strict_anti_teleporte: flags.strict_anti_teleporte,
    },
  };
}
