import { describe, expect, it } from 'vitest';
import { resolveEventFeatureFlags } from './flags';

describe('sync-batch flags: resolveEventFeatureFlags', () => {
  it('defaults to strict rules when metadata is missing', () => {
    const flags = resolveEventFeatureFlags(undefined);

    expect(flags).toEqual({
      strictRulesEnabled: true,
      strictAntiTeleport: true,
    });
  });

  it('disables anti-teleporte when strict_anti_teleporte is false', () => {
    const flags = resolveEventFeatureFlags({
      eventos_rollout: {
        strict_rules_enabled: true,
        strict_anti_teleporte: false,
      },
    });

    expect(flags).toEqual({
      strictRulesEnabled: true,
      strictAntiTeleport: false,
    });
  });

  it('forces anti-teleporte off when strict rules are globally disabled', () => {
    const flags = resolveEventFeatureFlags({
      eventos_rollout: {
        strict_rules_enabled: false,
        strict_anti_teleporte: true,
      },
    });

    expect(flags).toEqual({
      strictRulesEnabled: false,
      strictAntiTeleport: false,
    });
  });
});
