import { describe, expect, it } from "vitest";

import type { ProtocoloSanitario } from "@/lib/offline/types";
import {
  buildSanitaryFamilyCoverageIndex,
  findSanitaryFamilyConflict,
  hasOfficialFamilyCoverage,
  resolveActivationState,
  resolveProtocolPrecedence,
  resolveEffectiveProtocolsByFamily,
} from "@/lib/sanitario/protocolLayers";

const buildProtocol = (
  id: string,
  payload: Record<string, unknown>,
): ProtocoloSanitario => ({
  id,
  fazenda_id: "farm-1",
  nome: id,
  descricao: null,
  ativo: true,
  payload,
  client_id: "client-1",
  client_op_id: `${id}-op`,
  client_tx_id: null,
  client_recorded_at: "2026-04-12T12:00:00.000Z",
  server_received_at: "2026-04-12T12:00:00.000Z",
  created_at: "2026-04-12T12:00:00.000Z",
  updated_at: "2026-04-12T12:00:00.000Z",
  deleted_at: null,
});

describe("sanitary protocol layering", () => {
  it("flags official-family duplication before a standard/custom protocol is created", () => {
    const protocols = [
      buildProtocol("official-brucelose", {
        origem: "catalogo_oficial",
        family_code: "brucelose",
      }),
    ];

    const conflict = findSanitaryFamilyConflict({
      protocols,
      candidateFamilyCode: "brucelose",
      candidateLayer: "custom",
    });

    expect(conflict).toMatchObject({
      familyCode: "brucelose",
      reason: "official_family_already_active",
      existingLayer: "official",
    });
  });

  it("keeps family coverage indexed by layer so the UI can signal active trunks", () => {
    const protocols = [
      buildProtocol("official-raiva", {
        origem: "catalogo_oficial",
        family_code: "raiva_herbivoros",
      }),
      buildProtocol("custom-secagem", {
        origem: "customizado_fazenda",
        family_code: "secagem_local",
      }),
    ];

    const coverage = buildSanitaryFamilyCoverageIndex(protocols);

    expect(hasOfficialFamilyCoverage(coverage, "raiva_herbivoros")).toBe(true);
    expect(hasOfficialFamilyCoverage(coverage, "secagem_local")).toBe(false);
    expect(Array.from(coverage.get("secagem_local")?.layers ?? [])).toEqual([
      "custom",
    ]);
  });
});

describe("PR1: Protocol canonicalization and precedence", () => {
  describe("resolveActivationState", () => {
    it("returns active_official for official protocols", () => {
      const protocol = buildProtocol("p1", {
        origem: "catalogo_oficial",
        family_code: "brucelose",
      });

      const state = resolveActivationState(protocol, "official", false);
      expect(state).toBe("active_official");
    });

    it("returns active_custom for custom protocols with operational_complement=true", () => {
      const protocol = buildProtocol("p1", {
        origem: "customizado_fazenda",
        family_code: "custom_family",
        operational_complement: true,
      });

      const state = resolveActivationState(protocol, "custom", false);
      expect(state).toBe("active_custom");
    });

    it("returns draft_template for custom protocols without operational_complement", () => {
      const protocol = buildProtocol("p1", {
        origem: "customizado_fazenda",
        family_code: "custom_family",
      });

      const state = resolveActivationState(protocol, "custom", false);
      expect(state).toBe("draft_template");
    });

    it("returns superseded_legacy when isSuperseded=true", () => {
      const protocol = buildProtocol("p1", {
        origem: "customizado_fazenda",
        family_code: "custom_family",
      });

      const state = resolveActivationState(protocol, "custom", true);
      expect(state).toBe("superseded_legacy");
    });

    it("returns draft_template for standard (canonical) templates", () => {
      const protocol = buildProtocol("p1", {
        origem: "template_padrao",
        family_code: "standard_family",
      });

      const state = resolveActivationState(protocol, "standard", false);
      expect(state).toBe("draft_template");
    });
  });

  describe("resolveProtocolPrecedence", () => {
    it("official wins when multiple layers have same family", () => {
      const protocols = [
        buildProtocol("custom", {
          origem: "customizado_fazenda",
          family_code: "brucelose",
        }),
        buildProtocol("official", {
          origem: "catalogo_oficial",
          family_code: "brucelose",
        }),
        buildProtocol("standard", {
          origem: "template_padrao",
          family_code: "brucelose",
        }),
      ];

      const { winnerId, losers } = resolveProtocolPrecedence(
        protocols,
        "brucelose",
      );

      expect(winnerId).toBe("official");
      expect(losers).toEqual(expect.arrayContaining(["custom", "standard"]));
    });

    it("custom operational_complement wins over standard/legacy", () => {
      const protocols = [
        buildProtocol("custom-operational", {
          origem: "customizado_fazenda",
          family_code: "family_x",
          operational_complement: true,
        }),
        buildProtocol("standard-legacy", {
          origem: "template_padrao",
          family_code: "family_x",
        }),
      ];

      const { winnerId, losers } = resolveProtocolPrecedence(
        protocols,
        "family_x",
      );

      expect(winnerId).toBe("custom-operational");
      expect(losers).toContain("standard-legacy");
    });

    it("custom without operational_complement does NOT win", () => {
      const protocols = [
        buildProtocol("custom-draft", {
          origem: "customizado_fazenda",
          family_code: "family_y",
        }),
        buildProtocol("standard-legacy", {
          origem: "template_padrao",
          family_code: "family_y",
        }),
      ];

      const { winnerId, losers } = resolveProtocolPrecedence(
        protocols,
        "family_y",
      );

      // Standard wins as next in precedence
      expect(winnerId).toBe("standard-legacy");
      expect(losers).toContain("custom-draft");
    });

    it("ignores deleted protocols", () => {
      const protocols = [
        buildProtocol("official", {
          origem: "catalogo_oficial",
          family_code: "brucelose",
          deleted_at: "2026-04-12T00:00:00Z",
        }) as ProtocoloSanitario & { deleted_at: string | null },
        buildProtocol("custom", {
          origem: "customizado_fazenda",
          family_code: "brucelose",
        }),
      ];
      protocols[0].deleted_at = "2026-04-12T00:00:00Z";

      const { winnerId } = resolveProtocolPrecedence(protocols, "brucelose");

      // Custom wins since official is deleted
      expect(winnerId).toBe("custom");
    });

    it("normalizes family_code (case insensitive, spaces to underscores)", () => {
      const protocols = [
        buildProtocol("p1", {
          origem: "customizado_fazenda",
          family_code: "Brucelose_Vacina",
        }),
      ];

      const { winnerId } = resolveProtocolPrecedence(
        protocols,
        "brucelose-vacina",
      );

      expect(winnerId).toBe("p1");
    });
  });

  describe("resolveEffectiveProtocolsByFamily", () => {
    it("returns map with one entry per family, resolving to winner", () => {
      const protocols = [
        buildProtocol("official-brucelose", {
          origem: "catalogo_oficial",
          family_code: "brucelose",
        }),
        buildProtocol("custom-brucelose", {
          origem: "customizado_fazenda",
          family_code: "brucelose",
        }),
        buildProtocol("custom-other", {
          origem: "customizado_fazenda",
          family_code: "other_family",
        }),
      ];

      const { effective, metadata } = resolveEffectiveProtocolsByFamily(protocols);

      expect(effective.size).toBe(2);
      expect(effective.get("brucelose")).toBe("official-brucelose");
      expect(effective.get("other_family")).toBe("custom-other");
    });

    it("populates metadata with superseded and activation states", () => {
      const protocols = [
        buildProtocol("official-brucelose", {
          origem: "catalogo_oficial",
          family_code: "brucelose",
        }),
        buildProtocol("custom-brucelose", {
          origem: "customizado_fazenda",
          family_code: "brucelose",
        }),
      ];

      const { metadata } = resolveEffectiveProtocolsByFamily(protocols);

      const officialMeta = metadata.get("official-brucelose");
      expect(officialMeta?.activationState).toBe("active_official");
      expect(officialMeta?.hiddenFromPrimaryList).toBe(false);
      expect(officialMeta?.supersededByProtocolId).toBeNull();

      const customMeta = metadata.get("custom-brucelose");
      expect(customMeta?.activationState).toBe("superseded_legacy");
      expect(customMeta?.hiddenFromPrimaryList).toBe(true);
      expect(customMeta?.supersededByProtocolId).toBe("official-brucelose");
    });

    it("operational_complement custom is NOT superseded by absent official", () => {
      const protocols = [
        buildProtocol("custom-opera", {
          origem: "customizado_fazenda",
          family_code: "custom_family",
          operational_complement: true,
        }),
      ];

      const { effective, metadata } = resolveEffectiveProtocolsByFamily(protocols);

      expect(effective.get("custom_family")).toBe("custom-opera");

      const meta = metadata.get("custom-opera");
      expect(meta?.activationState).toBe("active_custom");
      expect(meta?.hiddenFromPrimaryList).toBe(false);
      expect(meta?.operationalComplement).toBe(true);
    });
  });
});
