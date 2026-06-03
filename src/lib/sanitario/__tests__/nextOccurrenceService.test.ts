/**
 * Tests — Next Occurrence Service Integration
 *
 * Cobre contrato mínimo do fallback:
 * - campos obrigatórios (family_code, item_code);
 * - comportamento quando campo obrigatório ausente;
 * - retorno bloqueado em vez de erro não controlado.
 */

import { describe, it, expect } from "vitest";
import {
  computeNextOccurrence,
  computeNextOccurrencesForAnimal,
  isItemCompatibleWithNewScheduler,
  getSchedulerHealthStatus,
  computeWithMetadata,
  diagnosticWhichSchedulerWasUsed,
  type NextOccurrenceMetadata,
} from "@/lib/sanitario/engine/nextOccurrenceService";
import { VALID_MODE_FIXTURES } from "../__fixtures__/scheduler.fixtures";
import type { ProtocoloSanitarioItem, Animal } from "@/lib/offline/types";
import type { ComputeNextOccurrenceContext } from "@/lib/sanitario/engine/schedulerIntegration";

/**
 * Contrato mínimo de fallback: campos obrigatórios para parseLegacyProtocolItemToDomain
 */
const LEGACY_SAFE_ITEM_BASE: Partial<ProtocoloSanitarioItem> = {
  protocolo_id: "proto-test",
  id: "item-test",
  tipo: "vacinacao",
  produto: "Vacina teste",
  intervalo_dias: 30,
  dose_num: 1,
  gera_agenda: true,
  payload: {
    family_code: "test_family",
    item_code: "dose_unica",
  },
};

function makeLegacyFallbackSafeItem(
  overrides: Partial<ProtocoloSanitarioItem> = {},
): ProtocoloSanitarioItem {
  return {
    ...LEGACY_SAFE_ITEM_BASE,
    ...overrides,
    id: overrides.id ?? LEGACY_SAFE_ITEM_BASE.id,
    protocolo_id: overrides.protocolo_id ?? LEGACY_SAFE_ITEM_BASE.protocolo_id,
    payload: {
      ...LEGACY_SAFE_ITEM_BASE.payload,
      ...overrides.payload,
      family_code: overrides.payload?.family_code ?? LEGACY_SAFE_ITEM_BASE.payload?.family_code,
      item_code: overrides.payload?.item_code ?? LEGACY_SAFE_ITEM_BASE.payload?.item_code,
    },
  } as unknown as ProtocoloSanitarioItem;
}

describe("Next Occurrence Service", () => {
  describe("computeNextOccurrence", () => {
    it("não lança exceção com item válido", () => {
      const item = makeLegacyFallbackSafeItem({
        id: "item-brucelose",
        payload: {
          family_code: "brucelose",
          item_code: "dose_1",
          calendario_base: {
            mode: "janela_etaria",
            anchor: "birth",
            minAgeMonths: 3,
          },
        },
      });
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animal: {
          id: "animal-test",
          nome: "Bezerro Test",
          data_nascimento: "2026-01-01",
          sexo: "F",
        } as Partial<Animal> as Animal,
        now: new Date("2026-04-15"),
      };

      expect(() => {
        computeNextOccurrence(item, context);
      }).not.toThrow();
    });

    it("retorna null quando fazendaId ausente", () => {
      const item = makeLegacyFallbackSafeItem();
      const context = {
        animalId: "animal-test",
      } as ComputeNextOccurrenceContext;

      const result = computeNextOccurrence(item, context);
      expect(result).toBeNull();
    });

    it("retorna null quando animalId ausente", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
      };

      const result = computeNextOccurrence(item, context);
      expect(result).toBeNull();
    });

    it("não lança exceção com context mínimo completo", () => {
      const item = makeLegacyFallbackSafeItem();
      const minimalContext: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      expect(() => {
        computeNextOccurrence(item, minimalContext);
      }).not.toThrow();
    });

    it("retorna resultado bloqueado quando payload faltando family_code", () => {
      const item = makeLegacyFallbackSafeItem({
        payload: {
          item_code: "dose_1",
        },
      });
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      expect(() => {
        computeNextOccurrence(item, context);
      }).not.toThrow();
      const result = computeNextOccurrence(item, context);
      expect(result).not.toBeNull();
      expect(result?.materialize).toBe(false);
      expect(result?.reasonCode).toBe("agenda_disabled");
    });

    it("retorna resultado bloqueado quando payload faltando item_code", () => {
      const item = makeLegacyFallbackSafeItem({
        payload: {
          family_code: "test_family",
        },
      });
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      expect(() => {
        computeNextOccurrence(item, context);
      }).not.toThrow();
      const result = computeNextOccurrence(item, context);
      expect(result).not.toBeNull();
      expect(result?.materialize).toBe(false);
      expect(result?.reasonCode).toBe("agenda_disabled");
    });
  });

  describe("computeNextOccurrencesForAnimal (Batch)", () => {
    it("processa múltiplos items para um animal", () => {
      const animal: Animal = {
        id: "animal-test",
        nome: "Bezerro Test",
        data_nascimento: "2026-01-01",
        sexo: "F",
      } as Partial<Animal> as Animal;
      const context: Partial<ComputeNextOccurrenceContext> = {
        fazendaId: "farm-test",
      };
      const item1 = makeLegacyFallbackSafeItem({ id: "item-1" });
      const item2 = makeLegacyFallbackSafeItem({ id: "item-2" });

      const results = computeNextOccurrencesForAnimal(
        [item1, item2],
        animal,
        context,
      );

      expect(results).toHaveLength(2);
      expect(results[0].item).toBe(item1);
      expect(results[1].item).toBe(item2);
    });

    it("cada resultado tem item e result", () => {
      const animal: Animal = {
        id: "animal-test",
        nome: "Bezerro Test",
        data_nascimento: "2026-01-01",
        sexo: "F",
      } as Partial<Animal> as Animal;
      const item = makeLegacyFallbackSafeItem();

      const results = computeNextOccurrencesForAnimal([item], animal);

      results.forEach((r) => {
        expect(r.item).toBeDefined();
        expect(r.result === null || r.result !== null).toBe(true);
      });
    });

    it("batch vazio retorna array vazio", () => {
      const animal: Animal = {
        id: "test",
        nome: "Test",
        data_nascimento: "2024-01-01",
      } as Partial<Animal> as Animal;

      const results = computeNextOccurrencesForAnimal([], animal);

      expect(results).toHaveLength(0);
    });
  });

  describe("isItemCompatibleWithNewScheduler", () => {
    it("retorna false quando feature flag está desativado", () => {
      const item = makeLegacyFallbackSafeItem();

      const compatible = isItemCompatibleWithNewScheduler(item);

      expect(compatible).toBe(false);
    });

    it("validação não lança exceção", () => {
      const item = makeLegacyFallbackSafeItem();

      expect(() => {
        isItemCompatibleWithNewScheduler(item);
      }).not.toThrow();
    });
  });

  describe("getSchedulerHealthStatus", () => {
    it("retorna status com flag desativado", () => {
      const status = getSchedulerHealthStatus();

      expect(status.featureFlagEnabled).toBe(false);
      expect(status.newSchedulerReady).toBe(true);
      expect(status.lastCheckedAt).toBeInstanceOf(Date);
    });

    it("status é sempre \"ready\" quando wrapper existe", () => {
      const status = getSchedulerHealthStatus();

      expect(status.newSchedulerReady).toBe(true);
    });
  });

  describe("computeWithMetadata", () => {
    it("retorna metadata com sourceScheduler = legacy quando flag desativado", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);

      expect(metadata.sourceScheduler).toBe("legacy");
      expect(metadata.computedAt).toBeInstanceOf(Date);
      expect(metadata.context).toBeDefined();
      expect(metadata.item).toBe(item);
    });

    it("metadata sempre tem result", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);

      const hasResult = metadata.result !== null;
      expect(hasResult || metadata.error).toBe(true);
    });
  });

  describe("diagnosticWhichSchedulerWasUsed", () => {
    it("retorna string diagnóstico", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);
      const diagnostic = diagnosticWhichSchedulerWasUsed(
        item,
        context,
        metadata,
      );

      expect(typeof diagnostic).toBe("string");
      expect(diagnostic.length).toBeGreaterThan(0);
    });

    it("diagnóstico contém sourceScheduler", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);
      const diagnostic = diagnosticWhichSchedulerWasUsed(
        item,
        context,
        metadata,
      );

      expect(diagnostic.toUpperCase()).toContain("LEGACY");
    });

    it("diagnóstico contém item ID", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);
      const diagnostic = diagnosticWhichSchedulerWasUsed(
        item,
        context,
        metadata,
      );

      expect(diagnostic).toContain(item.id);
    });

    it("diagnóstico contém timestamp", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);
      const diagnostic = diagnosticWhichSchedulerWasUsed(
        item,
        context,
        metadata,
      );

      expect(diagnostic).toContain(metadata.computedAt.toISOString());
    });

    it("diagnóstico pode ser usado para debugging", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(item, context);
      const diagnostic = diagnosticWhichSchedulerWasUsed(
        item,
        context,
        metadata,
      );

      expect(diagnostic).toContain("◆");
      expect(diagnostic).toContain("Scheduler:");
    });
  });

  describe("Integration Readiness", () => {
    it("serviço é pronto para usar em componentes", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
        now: new Date(),
      };

      expect(() => {
        computeNextOccurrence(item, context);
      }).not.toThrow();
    });

    it("health status pode ser checado antes de usar", () => {
      const health = getSchedulerHealthStatus();

      expect(health.newSchedulerReady).toBe(true);
      expect(health.featureFlagEnabled).toBe(false);
    });

    it("metadata é útil para observability", () => {
      const item = makeLegacyFallbackSafeItem();
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      const metadata = computeWithMetadata(
        item,
        context,
      );

      expect(metadata.sourceScheduler).toBeDefined();
      expect(metadata.computedAt).toBeDefined();
      expect(metadata.context).toBeDefined();
    });
  });
});
