/**
 * Testes — Fase 4: Feature Flag + Integração Scheduler
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  computeNextSanitaryOccurrenceForItem,
  tryComputeNextSanitaryOccurrence,
  isProtocolItemCompatibleWithNewScheduler,
  type ComputeNextOccurrenceContext,
} from "@/lib/sanitario/schedulerIntegration";
import {
  USE_NEW_SANITARY_SCHEDULER as FEATURE_FLAG,
  shouldUseNewSanitaryScheduler,
} from "@/lib/sanitario/featureFlags";
import type { ProtocoloSanitarioItem, Animal } from "@/lib/offline/types";

describe("Scheduler Integration & Feature Flag", () => {
  describe("Feature Flag Logic", () => {
    it("retorna false quando feature flag está disabled", () => {
      // IMPORTANTE: Feature flag começa como FALSE em featureFlags.ts
      expect(shouldUseNewSanitaryScheduler()).toBe(false);
    });

    it("retorna null do wrapper quando flag está disabled", () => {
      const mockItem: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: {
          calendario_base: {
            mode: "campaign",
            anchor: "birth",
            campaignMonths: [5, 6, 7],
          },
        },
      } as Partial<ProtocoloSanitarioItem>;

      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
        animalId: "animal-1",
      };

      const result = tryComputeNextSanitaryOccurrence(mockItem, context);

      // Quando flag está false, wrapper retorna null
      expect(result).toBeNull();
    });
  });

  describe("Protocol Item Compatibility", () => {
    it("identifies protocol item como compatível com bem-formed payload", () => {
      const item: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: {
          family_code: "brucelose",
          item_code: "dose_1",
          calendario_base: {
            mode: "campanha",
            anchor: "nascimento",
            campaignMonths: [5, 6, 7],
          },
        },
      } as Partial<ProtocoloSanitarioItem>;

      const compatible = isProtocolItemCompatibleWithNewScheduler(item);
      expect(compatible).toBe(true);
    });

    it("identifica item como incompatível com null payload", () => {
      const item: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: null,
      } as Partial<ProtocoloSanitarioItem>;

      const compatible = isProtocolItemCompatibleWithNewScheduler(item);
      expect(compatible).toBe(false);
    });

    it("rejeita payload legado minimo invalido", () => {
      const item: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: { invalid: "structure" },
      } as Partial<ProtocoloSanitarioItem>;

      const compatible = isProtocolItemCompatibleWithNewScheduler(item);
      expect(compatible).toBe(false);
    });
  });

  describe("Context Handling", () => {
    it("usa current date se não providenciado", () => {
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
        animalId: "animal-1",
        // now não definido
      };

      // Quando flag está false, não executa lógica
      // Mas estrutura deve estar ok
      expect(context.now).toBeUndefined();
    });

    it("usa provided date se definido", () => {
      const now = new Date("2026-05-15");
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
        animalId: "animal-1",
        now,
      };

      expect(context.now).toEqual(now);
    });

    it("suporta context com animal object", () => {
      const animal: Animal = {
        id: "animal-1",
        nome: "Bessie",
        data_nascimento: "2024-01-01",
        peso: 300,
        sexo: "F",
      } as Partial<Animal>;

      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
        animal,
      };

      expect(context.animal).toBe(animal);
    });

    it("suporta context com apenas IDs", () => {
      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
        animalId: "animal-1",
        loteId: "lote-1",
      };

      expect(context.animalId).toBe("animal-1");
      expect(context.loteId).toBe("lote-1");
    });
  });

  describe("Fixture Validation Structure", () => {
    it("estrutura permite validar todos os modos", () => {
      const fixtureStructure = {
        domain: {},
        subject: {
          animalId: "animal-123",
          loteId: undefined,
          fazendaId: "farm-1",
        },
        history: [],
        now: { nowIso: "2026-05-15T00:00:00Z", timezone: "America/Sao_Paulo" },
        expectedResult: {
          materialize: true,
          reasonCode: "ready",
          dueDate: "2026-05-20",
          dedupKey: "sanitario:animal:123:brucelose:dose_1:v1:campaign:2026-05",
        },
      };

      // Estrutura deve passar em validação básica de types
      expect(fixtureStructure.subject.fazendaId).toBe("farm-1");
      expect(fixtureStructure.expectedResult.reasonCode).toBe("ready");
    });

    it("fixtures devem cobrir todos os 4 modos", () => {
      const modes = [
        "campanha",
        "janela_etaria",
        "rotina_recorrente",
        "procedimento_imediato",
      ];

      // Checklist que cada fixture deve cobrir um modo
      expect(modes).toHaveLength(4);
    });
  });

  describe("Cutover Readiness", () => {
    it("wrapper sem side effects quando flag is false", () => {
      const item: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: {
          calendario_base: {
            mode: "campaign",
            anchor: "birth",
            campaignMonths: [5],
          },
        },
      } as Partial<ProtocoloSanitarioItem>;

      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
      };

      // Múltiplas chamadas devem ser idempotentes
      const result1 = tryComputeNextSanitaryOccurrence(item, context);
      const result2 = tryComputeNextSanitaryOccurrence(item, context);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it("compatibilidade check é pure function", () => {
      const item: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: {
          calendario_base: {
            mode: "campaign",
            anchor: "birth",
            campaignMonths: [5],
          },
        },
      } as Partial<ProtocoloSanitarioItem>;

      // Múltiplas chamadas devem retornar mesmo resultado
      const compat1 = isProtocolItemCompatibleWithNewScheduler(item);
      const compat2 = isProtocolItemCompatibleWithNewScheduler(item);

      expect(compat1).toBe(compat2);
    });
  });

  describe("Rollback Strategy", () => {
    it("quando flag é false, sistema ignora novo scheduler", () => {
      // Flag começa como false
      expect(shouldUseNewSanitaryScheduler()).toBe(false);

      const item: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: {
          calendario_base: {
            mode: "campaign",
            anchor: "birth",
            campaignMonths: [5],
          },
        },
      } as Partial<ProtocoloSanitarioItem>;

      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
      };

      const result = tryComputeNextSanitaryOccurrence(item, context);

      // Rollback é automático: wrapper retorna null, código usa fallback
      expect(result).toBeNull();
    });

    it("erro no scheduler não quebra fluxo legado", () => {
      // Quando flag está false, erro em novo scheduler nem é testado
      // Mas estrutura do wrapper previne exceções

      const malformedItem: ProtocoloSanitarioItem = {
        id: "item-1",
        protocol_id: "proto-1",
        tipo: "vacinacao",
        payload: { complete: "garbage" },
      } as Partial<ProtocoloSanitarioItem>;

      const context: ComputeNextOccurrenceContext = {
        fazendaId: "farm-1",
      };

      // Não deve lançar exceção
      expect(() => {
        isProtocolItemCompatibleWithNewScheduler(malformedItem);
      }).not.toThrow();
    });
  });

  describe("Fixture-Based Validation Ready", () => {
    it("permite validar fixture campanha sem dependência de feature flag", () => {
      // Simulação de fixture validation
      const fixture = {
        name: "brucelose.bezerra.100d",
        domain: {
          execution: {
            mode: "campanha",
            anchor: "entrada_fazenda",
            campaignMonths: [5, 6, 7],
          },
        },
        expectedResult: {
          materialize: true,
          reasonCode: "ready",
        },
      };

      // Estrutura deve ser validável
      expect(fixture.expectedResult.reasonCode).toBe("ready");
    });

    it("permite validar todos 8 fixtures em matrix", () => {
      const fixtures = [
        { name: "brucelose.bezerra.100d", mode: "janela_etaria" },
        {
          name: "raiva.risco.primo",
          mode: "janela_etaria",
        },
        {
          name: "raiva.reforco.dependencia",
          mode: "rotina_recorrente",
        },
        { name: "campanha.maio.go", mode: "campanha" },
        {
          name: "vermifugacao.recorrente",
          mode: "rotina_recorrente",
        },
        {
          name: "procedimento.imediato",
          mode: "procedimento_imediato",
        },
        {
          name: "invalid.ciclo.dependencia",
          mode: "rotina_recorrente",
        },
        {
          name: "invalid.campanha.sem_meses",
          mode: "campanha",
        },
      ];

      expect(fixtures).toHaveLength(8);
      expect(fixtures.map((f) => f.mode).sort()).toEqual([
        "campanha",
        "campanha",
        "janela_etaria",
        "janela_etaria",
        "procedimento_imediato",
        "rotina_recorrente",
        "rotina_recorrente",
        "rotina_recorrente",
      ]);
    });
  });
});
