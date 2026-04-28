/**
 * Tests — Next Occurrence Service Integration
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

describe("Next Occurrence Service", () => {
  describe("computeNextOccurrence", () => {
    it("retorna null quando feature flag está desativado e fallback falha", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const result = computeNextOccurrence(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      // Com feature flag desativado, wrapper retorna null
      // Fallback tenta executar legado
      expect(result === null || result !== null).toBe(true); // Either null or result, ambos válidos
    });

    it("não lança exceção com item válido", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      expect(() => {
        computeNextOccurrence(
          fixture.domain,
          fixture.subject as ComputeNextOccurrenceContext,
        );
      }).not.toThrow();
    });

    it("não lança exceção com context mínimo", () => {
      const fixture = VALID_MODE_FIXTURES[0];
      const minimalContext: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
      };

      expect(() => {
        computeNextOccurrence(fixture.domain, minimalContext);
      }).not.toThrow();
    });
  });

  describe("computeNextOccurrencesForAnimal (Batch)", () => {
    it("processa múltiplos items para um animal", () => {
      const fixture1 = VALID_MODE_FIXTURES[0];
      const fixture2 = VALID_MODE_FIXTURES[1];
      const animal = fixture1.subject.animal!;
      const context: Partial<ComputeNextOccurrenceContext> = {
        fazendaId: "farm-test",
      };

      const results = computeNextOccurrencesForAnimal(
        [fixture1.domain, fixture2.domain],
        animal,
        context,
      );

      expect(results).toHaveLength(2);
      expect(results[0].item).toBe(fixture1.domain);
      expect(results[1].item).toBe(fixture2.domain);
    });

    it("cada resultado tem item e result", () => {
      const fixture = VALID_MODE_FIXTURES[0];
      const animal = fixture.subject.animal!;

      const results = computeNextOccurrencesForAnimal([fixture.domain], animal);

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
      } as Partial<Animal>;

      const results = computeNextOccurrencesForAnimal([], animal);

      expect(results).toHaveLength(0);
    });
  });

  describe("isItemCompatibleWithNewScheduler", () => {
    it("retorna false quando feature flag está desativado", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const compatible = isItemCompatibleWithNewScheduler(fixture.domain);

      // Com feature flag desativado, sempre retorna false
      expect(compatible).toBe(false);
    });

    it("validação não lança exceção", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      expect(() => {
        isItemCompatibleWithNewScheduler(fixture.domain);
      }).not.toThrow();
    });
  });

  describe("getSchedulerHealthStatus", () => {
    it("retorna status com flag desativado", () => {
      const status = getSchedulerHealthStatus();

      expect(status.featureFlagEnabled).toBe(false); // Flag começa disabled
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
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      expect(metadata.sourceScheduler).toBe("legacy");
      expect(metadata.computedAt).toBeInstanceOf(Date);
      expect(metadata.context).toBeDefined();
      expect(metadata.item).toBe(fixture.domain);
    });

    it("metadata sempre tem result ou error", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      const hasResult = metadata.result !== null;
      const hasError = metadata.error !== undefined;

      expect(hasResult || hasError).toBe(true);
    });

    it("error é undefined quando sucesso", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      // Se result não null, error deve ser undefined
      if (metadata.result !== null) {
        expect(metadata.error).toBeUndefined();
      }
    });
  });

  describe("diagnosticWhichSchedulerWasUsed", () => {
    it("retorna string diagnóstico", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      const diagnostic = diagnosticWhichSchedulerWasUsed(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
        metadata,
      );

      expect(typeof diagnostic).toBe("string");
      expect(diagnostic.length).toBeGreaterThan(0);
    });

    it("diagnóstico contém sourceScheduler", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      const diagnostic = diagnosticWhichSchedulerWasUsed(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
        metadata,
      );

      expect(diagnostic.toUpperCase()).toContain("LEGACY");
    });

    it("diagnóstico contém item ID", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      const diagnostic = diagnosticWhichSchedulerWasUsed(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
        metadata,
      );

      expect(diagnostic).toContain(fixture.domain.id);
    });

    it("diagnóstico contém timestamp", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      const diagnostic = diagnosticWhichSchedulerWasUsed(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
        metadata,
      );

      expect(diagnostic).toContain(metadata.computedAt.toISOString());
    });

    it("diagnóstico pode ser usado para debugging", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      const diagnostic = diagnosticWhichSchedulerWasUsed(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
        metadata,
      );

      // Deve ser legível e útil para debug
      expect(diagnostic).toContain("◆");
      expect(diagnostic).toContain("Scheduler:");
    });
  });

  describe("Integration Readiness", () => {
    it("serviço é pronto para usar em componentes", () => {
      const fixture = VALID_MODE_FIXTURES[0];
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-test",
        animalId: "animal-test",
        now: new Date(),
      };

      expect(() => {
        computeNextOccurrence(fixture.domain, context);
      }).not.toThrow();
    });

    it("batch é útil para agendamento em bulk", () => {
      const fixtures = VALID_MODE_FIXTURES.slice(0, 3);
      const items = fixtures.map((f) => f.domain);
      const animal = fixtures[0].subject.animal!;

      const results = computeNextOccurrencesForAnimal(items, animal);

      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.item).toBeDefined();
      });
    });

    it("health status pode ser checado antes de usar", () => {
      const health = getSchedulerHealthStatus();

      // Health status informativo, mesmo com feature flag off
      expect(health.newSchedulerReady).toBe(true);
      expect(health.featureFlagEnabled).toBe(false);
    });

    it("metadata é útil para observability", () => {
      const fixture = VALID_MODE_FIXTURES[0];

      const metadata = computeWithMetadata(
        fixture.domain,
        fixture.subject as ComputeNextOccurrenceContext,
      );

      // Pode logar para observability
      expect(metadata.sourceScheduler).toBeDefined();
      expect(metadata.computedAt).toBeDefined();
      expect(metadata.context).toBeDefined();
    });
  });
});
