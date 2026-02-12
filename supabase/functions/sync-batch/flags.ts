export interface EventFeatureFlags {
  strictRulesEnabled: boolean;
  strictAntiTeleport: boolean;
}

interface MetadataWithRollout {
  eventos_rollout?: {
    strict_rules_enabled?: unknown;
    strict_anti_teleporte?: unknown;
  };
}

function asBooleanOrDefault(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return defaultValue;
}

export function resolveEventFeatureFlags(metadata: unknown): EventFeatureFlags {
  const safeMetadata = (metadata ?? {}) as MetadataWithRollout;
  const rollout = safeMetadata.eventos_rollout ?? {};

  const strictRulesEnabled = asBooleanOrDefault(
    rollout.strict_rules_enabled,
    true,
  );
  const strictAntiTeleportRaw = asBooleanOrDefault(
    rollout.strict_anti_teleporte,
    true,
  );

  return {
    strictRulesEnabled,
    strictAntiTeleport: strictRulesEnabled && strictAntiTeleportRaw,
  };
}

