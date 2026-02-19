import { describe, it, expect } from "vitest";
import {
  resolveEventosRolloutFlags,
  withEventosRolloutFlags,
  DEFAULT_EVENTOS_ROLLOUT_FLAGS,
} from "../featureFlags";

describe("resolveEventosRolloutFlags", () => {
  it("should return default flags when metadata is null", () => {
    const flags = resolveEventosRolloutFlags(null);
    expect(flags).toEqual(DEFAULT_EVENTOS_ROLLOUT_FLAGS);
  });

  it("should return default flags when metadata is undefined", () => {
    const flags = resolveEventosRolloutFlags(undefined);
    expect(flags).toEqual(DEFAULT_EVENTOS_ROLLOUT_FLAGS);
  });

  it("should return default flags when eventos_rollout is missing", () => {
    const flags = resolveEventosRolloutFlags({});
    expect(flags).toEqual(DEFAULT_EVENTOS_ROLLOUT_FLAGS);
  });

  it("should return default flags when eventos_rollout is not an object", () => {
    const flags = resolveEventosRolloutFlags({ eventos_rollout: "invalid" });
    expect(flags).toEqual(DEFAULT_EVENTOS_ROLLOUT_FLAGS);
  });

  it("should return default flags when properties are missing", () => {
    const flags = resolveEventosRolloutFlags({ eventos_rollout: {} });
    expect(flags).toEqual(DEFAULT_EVENTOS_ROLLOUT_FLAGS);
  });

  it("should return default flags when properties are of incorrect type", () => {
    const flags = resolveEventosRolloutFlags({
      eventos_rollout: {
        strict_rules_enabled: "false",
        strict_anti_teleporte: 123,
      },
    });
    expect(flags).toEqual(DEFAULT_EVENTOS_ROLLOUT_FLAGS);
  });

  it("should correctly resolve explicit boolean values", () => {
    const flags = resolveEventosRolloutFlags({
      eventos_rollout: {
        strict_rules_enabled: false,
        strict_anti_teleporte: false,
      },
    });
    expect(flags).toEqual({
      strict_rules_enabled: false,
      strict_anti_teleporte: false,
    });
  });

  it("should use default for missing properties in partial object", () => {
    const flags = resolveEventosRolloutFlags({
      eventos_rollout: {
        strict_rules_enabled: false,
      },
    });
    expect(flags).toEqual({
      strict_rules_enabled: false,
      strict_anti_teleporte: DEFAULT_EVENTOS_ROLLOUT_FLAGS.strict_anti_teleporte,
    });
  });
});

describe("withEventosRolloutFlags", () => {
  it("should set flags on a new object when metadata is null", () => {
    const flags = {
      strict_rules_enabled: false,
      strict_anti_teleporte: false,
    };
    const metadata = withEventosRolloutFlags(null, flags);
    expect(metadata).toEqual({
      eventos_rollout: flags,
    });
  });

  it("should merge flags into existing metadata", () => {
    const initialMetadata = { existing_key: "value" };
    const flags = {
      strict_rules_enabled: false,
      strict_anti_teleporte: true,
    };
    const metadata = withEventosRolloutFlags(initialMetadata, flags);
    expect(metadata).toEqual({
      existing_key: "value",
      eventos_rollout: flags,
    });
  });

  it("should overwrite existing flags", () => {
    const initialMetadata = {
      eventos_rollout: {
        strict_rules_enabled: true,
        strict_anti_teleporte: true,
      },
    };
    const flags = {
      strict_rules_enabled: false,
      strict_anti_teleporte: false,
    };
    const metadata = withEventosRolloutFlags(initialMetadata, flags);
    expect(metadata).toEqual({
      eventos_rollout: flags,
    });
  });

  it("should not mutate the original metadata object", () => {
    const initialMetadata = { existing_key: "value" };
    const flags = {
      strict_rules_enabled: false,
      strict_anti_teleporte: true,
    };
    withEventosRolloutFlags(initialMetadata, flags);
    expect(initialMetadata).toEqual({ existing_key: "value" });
  });
});
