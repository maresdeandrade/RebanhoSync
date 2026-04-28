/**
 * Tests for Phase 1: Domain, Adapters, and Validation
 *
 * This test suite validates:
 * - Adapter roundtrip (legacy → domain → legacy)
 * - Validation by mode (campanha, janela_etaria, rotina_recorrente, procedimento_imediato)
 * - Cycle detection in dependencies
 * - Subject context validation
 */

import { describe, it, expect } from "vitest";
import {
  parseLegacyProtocolItemToDomain,
  serializeDomainToLegacyPayload,
} from "@/lib/sanitario/models/adapters";
import {
  validateSanitaryItemDomain,
  validateSanitarySubjectContext,
  validateSanitaryExecutionRecord,
  detectDependencyCycle,
  validateSanitaryProtocolItemCollection,
} from "@/lib/sanitario/models/validation";
import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  LegacyPayload,
} from "@/lib/sanitario/models/domain";

// ============================================================================
// ADAPTER TESTS: ROUNDTRIP LEGACY → DOMAIN → LEGACY
// ============================================================================

describe("Adapter: parseLegacyProtocolItemToDomain", () => {
  it("should parse minimal legacy payload and infer mode=nao_estruturado", () => {
    const legacyPayload: LegacyPayload = {
      family_code: "brucelose",
      item_code: "dose_unica",
      origin: "official",
    };

    const domain = parseLegacyProtocolItemToDomain("prot-1", "item-1", legacyPayload);

    expect(domain.identity.protocolId).toBe("prot-1");
    expect(domain.identity.itemId).toBe("item-1");
    expect(domain.identity.familyCode).toBe("brucelose");
    expect(domain.identity.itemCode).toBe("dose_unica");
    expect(domain.schedule.mode).toBe("nao_estruturado");
  });

  it("should parse campanha mode with campaignMonths", () => {
    const legacyPayload: LegacyPayload = {
      family_code: "raiva",
      item_code: "dose_anual",
      campaign_months: [5, 6, 7],
      anchor: "entrada_fazenda",
    };

    const domain = parseLegacyProtocolItemToDomain("prot-2", "item-2", legacyPayload);

    expect(domain.schedule.mode).toBe("campanha");
    expect(domain.schedule.campaignMonths).toEqual([5, 6, 7]);
    expect(domain.schedule.anchor).toBe("entrada_fazenda");
  });

  it("should parse janela_etaria mode with ageStartDays and ageEndDays", () => {
    const legacyPayload: LegacyPayload = {
      family_code: "brucelose",
      item_code: "dose_1",
      age_start_days: "30",
      age_end_days: "180",
      anchor: "nascimento",
    };

    const domain = parseLegacyProtocolItemToDomain("prot-3", "item-3", legacyPayload);

    expect(domain.schedule.mode).toBe("janela_etaria");
    expect(domain.schedule.ageStartDays).toBe(30);
    expect(domain.schedule.ageEndDays).toBe(180);
    expect(domain.schedule.anchor).toBe("nascimento");
  });

  it("should support name variants (idade_min_dias, ageStartDays, age_min_days)", () => {
    const variants: LegacyPayload[] = [
      { family_code: "raiva", item_code: "dose_1", idade_min_dias: 15 },
      { family_code: "raiva", item_code: "dose_1", ageStartDays: 15 },
      { family_code: "raiva", item_code: "dose_1", age_min_days: 15 },
    ];

    for (const payload of variants) {
      const domain = parseLegacyProtocolItemToDomain("prot-x", "item-x", payload);
      expect(domain.eligibility.ageMinDays).toBe(15);
    }
  });

  it("should parse rotina_recorrente mode with intervalDays", () => {
    const legacyPayload: LegacyPayload = {
      family_code: "vermifugacao",
      item_code: "dose_recorrente",
      interval_days: "60",
      anchor: "ultima_conclusao_mesma_familia",
    };

    const domain = parseLegacyProtocolItemToDomain("prot-4", "item-4", legacyPayload);

    expect(domain.schedule.mode).toBe("rotina_recorrente");
    expect(domain.schedule.intervalDays).toBe(60);
  });

  it("should normalize grafia variations (origem → layer, familia_code → familyCode)", () => {
    const legacyPayload: LegacyPayload = {
      familia_code: "brucelose",
      codigo: "dose_unica",
      origem: "official",
    };

    const domain = parseLegacyProtocolItemToDomain("prot-5", "item-5", legacyPayload);

    expect(domain.identity.familyCode).toBe("brucelose");
    expect(domain.identity.itemCode).toBe("dose_unica");
    expect(domain.identity.layer).toBe("official");
  });
});

describe("Adapter: serializeDomainToLegacyPayload", () => {
  it("should serialize domain back to legacy format", () => {
    const legacyPayload: LegacyPayload = {
      family_code: "raiva",
      item_code: "dose_1",
      campaign_months: [5, 6],
    };

    const domain = parseLegacyProtocolItemToDomain("prot-x", "item-x", legacyPayload);
    const reserialized = serializeDomainToLegacyPayload(domain);

    expect(reserialized.family_code).toBe("raiva");
    expect(reserialized.item_code).toBe("dose_1");
    expect(reserialized.campaign_months).toEqual([5, 6]);
  });
});

describe("Adapter: roundtrip (legacy → domain → legacy)", () => {
  it("should maintain roundtrip for campanha protocol", () => {
    const original: LegacyPayload = {
      family_code: "raiva",
      item_code: "dose_anual",
      campaign_months: [5, 6, 7, 8],
      anchor: "desmama",
      mandatory: true,
      compliance_level: "obrigatorio",
    };

    const domain = parseLegacyProtocolItemToDomain("prot-x", "item-x", original);
    const reserialized = serializeDomainToLegacyPayload(domain);

    expect(reserialized.family_code).toBe(original.family_code);
    expect(reserialized.item_code).toBe(original.item_code);
    expect(reserialized.campaign_months).toEqual(original.campaign_months);
    expect(reserialized.mandatory).toBe(original.mandatory);
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe("validateSanitaryItemDomain", () => {
  it("should reject campanha without campaignMonths", () => {
    const domain: SanitaryProtocolItemDomain = {
      identity: {
        protocolId: "p1",
        itemId: "i1",
        familyCode: "raiva",
        itemCode: "dose_anual",
        regimenVersion: 1,
        layer: "official",
        scopeType: "animal",
      },
      schedule: {
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: null,
        intervalDays: null,
        ageStartDays: null,
        ageEndDays: null,
        dependsOnItemCode: null,
        generatesAgenda: true,
        operationalLabel: null,
        notes: null,
        instructions: null,
      },
      eligibility: {
        sexTarget: "sem_restricao",
        ageMinDays: null,
        ageMaxDays: null,
        species: null,
        categoryCodes: null,
      },
      applicability: {
        type: "sempre",
      },
      compliance: {
        level: "recomendado",
        mandatory: false,
        requiresVeterinarian: false,
        requiresDocument: false,
        requiredDocumentTypes: null,
        blocksExecutionWithoutVeterinarian: false,
        blocksCompletionWithoutDocument: false,
      },
      executionPolicy: {
        allowsManualExecution: true,
        createsInstantTaskOnEvent: false,
        expiresWhenWindowEnds: false,
        supportsBatchExecution: false,
      },
    };

    const errors = validateSanitaryItemDomain(domain);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject janela_etaria without ageStartDays", () => {
    const domain: SanitaryProtocolItemDomain = {
      ...createMinimalDomain(),
      schedule: {
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: null,
        ageEndDays: 180,
        intervalDays: null,
        campaignMonths: null,
        dependsOnItemCode: null,
        generatesAgenda: true,
        operationalLabel: null,
        notes: null,
        instructions: null,
      },
    };

    const errors = validateSanitaryItemDomain(domain);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject janela_etaria with ageEndDays < ageStartDays", () => {
    const domain: SanitaryProtocolItemDomain = {
      ...createMinimalDomain(),
      schedule: {
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 180,
        ageEndDays: 30, // Invalid: 30 < 180
        intervalDays: null,
        campaignMonths: null,
        dependsOnItemCode: null,
        generatesAgenda: true,
        operationalLabel: null,
        notes: null,
        instructions: null,
      },
    };

    const errors = validateSanitaryItemDomain(domain);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject rotina_recorrente without intervalDays", () => {
    const domain: SanitaryProtocolItemDomain = {
      ...createMinimalDomain(),
      schedule: {
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: null,
        ageStartDays: null,
        ageEndDays: null,
        campaignMonths: null,
        dependsOnItemCode: null,
        generatesAgenda: true,
        operationalLabel: null,
        notes: null,
        instructions: null,
      },
    };

    const errors = validateSanitaryItemDomain(domain);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should accept valid campanha", () => {
    const domain: SanitaryProtocolItemDomain = {
      ...createMinimalDomain(),
      schedule: {
        mode: "campanha",
        anchor: "desmama",
        campaignMonths: [5, 6, 7],
        intervalDays: null,
        ageStartDays: null,
        ageEndDays: null,
        dependsOnItemCode: null,
        generatesAgenda: true,
        operationalLabel: null,
        notes: null,
        instructions: null,
      },
    };

    const errors = validateSanitaryItemDomain(domain);
    expect(errors).toHaveLength(0);
  });

  it("should accept valid janela_etaria", () => {
    const domain: SanitaryProtocolItemDomain = {
      ...createMinimalDomain(),
      schedule: {
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 30,
        ageEndDays: 180,
        intervalDays: null,
        campaignMonths: null,
        dependsOnItemCode: null,
        generatesAgenda: true,
        operationalLabel: null,
        notes: null,
        instructions: null,
      },
    };

    const errors = validateSanitaryItemDomain(domain);
    expect(errors).toHaveLength(0);
  });
});

describe("validateSanitarySubjectContext", () => {
  it("should reject animal scope without animal data", () => {
    const subject: SanitarySubjectContext = {
      scopeType: "animal",
      scopeId: "animal-123",
      animal: null,
      lote: null,
      fazenda: { id: "faz-1", uf: "GO", municipio: "Goiânia" },
      activeRisks: [],
      activeEvents: [],
    };

    const errors = validateSanitarySubjectContext(subject);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should accept valid animal scope with required data", () => {
    const subject: SanitarySubjectContext = {
      scopeType: "animal",
      scopeId: "animal-123",
      animal: {
        id: "animal-123",
        birthDate: "2026-01-15",
        sex: "femea",
        species: "bovino",
        categoryCode: "bezerra",
      },
      lote: null,
      fazenda: { id: "faz-1", uf: "GO", municipio: "Goiânia" },
      activeRisks: [],
      activeEvents: [],
    };

    const errors = validateSanitarySubjectContext(subject);
    expect(errors).toHaveLength(0);
  });
});

describe("validateSanitaryExecutionRecord", () => {
  it("should reject record with invalid dedupKey format", () => {
    const record = {
      occurrenceId: "occ-1",
      familyCode: "raiva",
      itemCode: "dose_1",
      regimenVersion: 1,
      scopeType: "animal" as const,
      scopeId: "animal-123",
      completedAt: null,
      executionDate: null,
      sourceEventId: null,
      dedupKey: "invalid_format",
      status: "pending" as const,
    };

    const errors = validateSanitaryExecutionRecord(record);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should accept record with valid dedupKey", () => {
    const record = {
      occurrenceId: "occ-1",
      familyCode: "raiva",
      itemCode: "dose_1",
      regimenVersion: 1,
      scopeType: "animal" as const,
      scopeId: "animal-123",
      completedAt: null,
      executionDate: null,
      sourceEventId: null,
      dedupKey: "sanitario:animal:123:raiva:dose_1:v1:window:2026-05-01",
      status: "pending" as const,
    };

    const errors = validateSanitaryExecutionRecord(record);
    expect(errors).toHaveLength(0);
  });
});

describe("detectDependencyCycle", () => {
  it("should detect simple cycle A→B→A", () => {
    const itemA = createMinimalDomain();
    itemA.identity.itemCode = "dose_1";
    itemA.schedule.dependsOnItemCode = "dose_2";

    const itemB = createMinimalDomain();
    itemB.identity.itemCode = "dose_2";
    itemB.schedule.dependsOnItemCode = "dose_1";

    const errors = detectDependencyCycle([itemA, itemB]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Ciclo");
  });

  it("should not report error for linear dependency A→B→C", () => {
    const itemA = createMinimalDomain();
    itemA.identity.itemCode = "dose_1";
    itemA.schedule.dependsOnItemCode = "dose_2";

    const itemB = createMinimalDomain();
    itemB.identity.itemCode = "dose_2";
    itemB.schedule.dependsOnItemCode = "dose_3";

    const itemC = createMinimalDomain();
    itemC.identity.itemCode = "dose_3";
    itemC.schedule.dependsOnItemCode = null;

    const errors = detectDependencyCycle([itemA, itemB, itemC]);
    expect(errors).toHaveLength(0);
  });
});

describe("validateSanitaryProtocolItemCollection", () => {
  it("should validate entire collection and report all errors", () => {
    const validItem = createMinimalDomain();
    validItem.schedule.mode = "campanha";
    validItem.schedule.campaignMonths = [5, 6];
    validItem.schedule.generatesAgenda = true;

    const invalidItem = createMinimalDomain();
    invalidItem.schedule.mode = "campanha";
    invalidItem.schedule.campaignMonths = null; // Invalid
    invalidItem.schedule.generatesAgenda = false; // Invalid

    const errors = validateSanitaryProtocolItemCollection([validItem, invalidItem]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// HELPERS
// ============================================================================

function createMinimalDomain(): SanitaryProtocolItemDomain {
  return {
    identity: {
      protocolId: "test-prot",
      itemId: "test-item",
      familyCode: "test-family",
      itemCode: "test-code",
      regimenVersion: 1,
      layer: "custom",
      scopeType: "animal",
    },
    schedule: {
      mode: "nao_estruturado",
      anchor: "sem_ancora",
      intervalDays: null,
      campaignMonths: null,
      ageStartDays: null,
      ageEndDays: null,
      dependsOnItemCode: null,
      generatesAgenda: false,
      operationalLabel: null,
      notes: null,
      instructions: null,
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
      species: null,
      categoryCodes: null,
    },
    applicability: {
      type: "sempre",
    },
    compliance: {
      level: "recomendado",
      mandatory: false,
      requiresVeterinarian: false,
      requiresDocument: false,
      requiredDocumentTypes: null,
      blocksExecutionWithoutVeterinarian: false,
      blocksCompletionWithoutDocument: false,
    },
    executionPolicy: {
      allowsManualExecution: true,
      createsInstantTaskOnEvent: false,
      expiresWhenWindowEnds: false,
      supportsBatchExecution: false,
    },
  };
}
