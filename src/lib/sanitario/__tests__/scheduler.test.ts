import { describe, it, expect } from "vitest";
import { computeNextSanitaryOccurrence, type ComputeNextSanitaryOccurrenceInput } from "../scheduler";
import { buildSanitaryDedupKey } from "../dedup";
import type { SanitaryProtocolItemDomain } from "../domain";

describe("Sanitary Scheduler and Deduplication", () => {
  const baseIdentity = {
    protocolId: "p1",
    itemId: "i1",
    familyCode: "brucelose",
    itemCode: "dose_unica",
    regimenVersion: 1,
    layer: "custom" as const,
    scopeType: "animal" as const
  };

  const baseItem: SanitaryProtocolItemDomain = {
    identity: baseIdentity,
    applicability: { type: "sempre" },
    eligibility: { sexTarget: "femea", ageMinDays: null, ageMaxDays: null, species: null, categoryCodes: null },
    schedule: {
      mode: "janela_etaria",
      anchor: "nascimento",
      intervalDays: null,
      campaignMonths: null,
      ageStartDays: 90,
      ageEndDays: 240,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: null,
      notes: null,
      instructions: null
    },
    compliance: {
      level: "obrigatorio",
      mandatory: true,
      requiresVeterinarian: false,
      requiresDocument: false,
      requiredDocumentTypes: null,
      blocksExecutionWithoutVeterinarian: false,
      blocksCompletionWithoutDocument: false
    },
    executionPolicy: {
      allowsManualExecution: true,
      createsInstantTaskOnEvent: false,
      expiresWhenWindowEnds: true,
      supportsBatchExecution: true
    }
  };

  const baseSubject = {
    scopeType: "animal" as const,
    scopeId: "animal-123",
    fazenda: { id: "f1", uf: null, municipio: null },
    activeRisks: [],
    activeEvents: [],
    animal: {
      id: "animal-123",
      birthDate: "2024-01-01", // Age calculations will depend on 'now'
      sex: "femea" as const,
      species: "bovino" as const,
      categoryCode: null
    }
  };

  describe("computeNextSanitaryOccurrence", () => {
    it("should return not_eligible if sex mismatch", () => {
      const input: ComputeNextSanitaryOccurrenceInput = {
        item: baseItem,
        subject: { ...baseSubject, animal: { ...baseSubject.animal, sex: "macho" } },
        history: [],
        now: { nowIso: "2024-05-01T00:00:00Z", timezone: "UTC" }
      };

      const result = computeNextSanitaryOccurrence(input);
      expect(result.reasonCode).toBe("not_eligible");
      expect(result.materialize).toBe(false);
    });

    it("should return before_window if animal is too young", () => {
      // Animal born Jan 1. Now is Jan 15 (14 days old). Min age is 90.
      const input: ComputeNextSanitaryOccurrenceInput = {
        item: baseItem,
        subject: baseSubject,
        history: [],
        now: { nowIso: "2024-01-15T00:00:00Z", timezone: "UTC" }
      };

      const result = computeNextSanitaryOccurrence(input);
      expect(result.reasonCode).toBe("before_window");
      expect(result.materialize).toBe(false);
    });

    it("should return ready and materialize if animal is within age window", () => {
      // Animal born Jan 1. Now is May 1 (121 days old). Window 90-240.
      const input: ComputeNextSanitaryOccurrenceInput = {
        item: baseItem,
        subject: baseSubject,
        history: [],
        now: { nowIso: "2024-05-01T00:00:00Z", timezone: "UTC" }
      };

      const result = computeNextSanitaryOccurrence(input);
      expect(result.reasonCode).toBe("ready");
      expect(result.materialize).toBe(true);
      expect(result.dedupKey).toContain("window");
    });

    it("should return window_expired if animal is too old", () => {
      // Animal born Jan 1. Now is Oct 1 (274 days old). Window 90-240.
      const input: ComputeNextSanitaryOccurrenceInput = {
        item: baseItem,
        subject: baseSubject,
        history: [],
        now: { nowIso: "2024-10-01T00:00:00Z", timezone: "UTC" }
      };

      const result = computeNextSanitaryOccurrence(input);
      expect(result.reasonCode).toBe("window_expired");
      expect(result.materialize).toBe(false);
    });

    it("should return dependency_not_satisfied if dependency is missing", () => {
      const itemWithDep = {
        ...baseItem,
        schedule: { ...baseItem.schedule, dependsOnItemCode: "dose_1" }
      };

      const input: ComputeNextSanitaryOccurrenceInput = {
        item: itemWithDep,
        subject: baseSubject,
        history: [], // No dose_1 in history
        now: { nowIso: "2024-05-01T00:00:00Z", timezone: "UTC" }
      };

      const result = computeNextSanitaryOccurrence(input);
      expect(result.reasonCode).toBe("dependency_not_satisfied");
      expect(result.materialize).toBe(false);
    });
  });

  describe("buildSanitaryDedupKey", () => {
    it("generates correct key for campanha", () => {
      const key = buildSanitaryDedupKey({
        identity: baseIdentity,
        scopeId: "animal-123",
        mode: "campanha",
        jurisdictionKey: "SP",
        campaignYear: 2024,
        campaignMonth: 5
      });
      expect(key).toBe("sanitario:animal:animal-123:brucelose:dose_unica:v1:jur:SP:ym:2024-5");
    });

    it("generates correct key for janela_etaria", () => {
      const key = buildSanitaryDedupKey({
        identity: baseIdentity,
        scopeId: "animal-123",
        mode: "janela_etaria",
        windowStartIso: "2024-04-01"
      });
      expect(key).toBe("sanitario:animal:animal-123:brucelose:dose_unica:v1:window:2024-04-01");
    });

    it("generates correct key for procedimento_imediato", () => {
      const key = buildSanitaryDedupKey({
        identity: { ...baseIdentity, scopeType: "fazenda" },
        scopeId: "f1",
        mode: "procedimento_imediato",
        sourceEventId: "evt-999"
      });
      expect(key).toBe("sanitario:fazenda:f1:brucelose:dose_unica:v1:event:evt-999");
    });
  });
});
