import { describe, expect, it } from "vitest";

import { buildEventGesture } from "@/lib/events/buildEventGesture";

describe("smoke: registro avulso de multiplos dominios", () => {
  it("valida que o source_task_id é nulo para registros avulsos de múltiplos domínios", () => {
    const casos = [
      {
        nome: "pesagem avulsa",
        contract: "generic_event" as const,
        input: {
          dominio: "pesagem",
          fazendaId: "farm-1",
          animalId: "animal-1",
          pesoKg: 380,
          sourceTaskId: undefined, // Avulso
        } as const,
        detalheTabela: "eventos_pesagem",
      },
      {
        nome: "movimentacao avulsa",
        contract: "movement_v1" as const,
        input: {
          dominio: "movimentacao",
          fazendaId: "farm-1",
          animalId: "animal-1",
          toLoteId: "lote-dest",
          sourceTaskId: undefined, // Avulso
        } as const,
      },
      {
        nome: "nutricao avulsa",
        contract: "generic_event" as const,
        input: {
          dominio: "nutricao",
          fazendaId: "farm-1",
          animalId: "animal-1",
          alimentoNome: "Feno",
          quantidadeKg: 5,
          sourceTaskId: undefined, // Avulso
        } as const,
        detalheTabela: "eventos_nutricao",
      },
      {
        nome: "sanitario avulso",
        contract: "generic_event" as const,
        input: {
          dominio: "sanitario",
          fazendaId: "farm-1",
          animalId: "animal-1",
          tipo: "vacinacao",
          produto: "Vacina Febre Aftosa",
          sourceTaskId: undefined, // Avulso
        } as const,
        detalheTabela: "eventos_sanitario",
      },
    ];

    for (const caso of casos) {
      const { eventId, ops } = buildEventGesture(caso.input);

      if (caso.contract === "movement_v1") {
        expect(ops).toHaveLength(1);
        const movement = ops[0];
        expect(movement.table).toBe("movement_v1");
        expect(movement.action).toBe("INSERT");
        expect(movement.record.event_id).toBe(eventId);
        expect(movement.record.subject_id).toBe("animal-1");
        expect(movement.record.to_lote_id).toBe("lote-dest");
        expect(movement.record.source_task_id).toBeNull();
        continue;
      }

      // Deve ter pelo menos a base (eventos) e o detalhe
      expect(ops.length).toBeGreaterThanOrEqual(2);

      // Valida o registro base na tabela 'eventos'
      const baseOp = ops.find((op) => op.table === "eventos");
      expect(baseOp).toBeDefined();
      expect(baseOp?.action).toBe("INSERT");
      expect(baseOp?.record.id).toBe(eventId);
      expect(baseOp?.record.source_task_id).toBeNull(); // Importante: deve ser nulo no registro avulso!

      // Valida o registro detalhado
      const detalheOp = ops.find((op) => op.table === caso.detalheTabela);
      expect(detalheOp).toBeDefined();
      expect(detalheOp?.action).toBe("INSERT");
      expect(detalheOp?.record.evento_id).toBe(eventId);
    }
  });
});
