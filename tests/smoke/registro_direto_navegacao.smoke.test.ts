import { describe, expect, it, vi } from "vitest";

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";

describe("smoke: registro direto e navegacao critica", () => {
  it("monta gestures dos trilhos principais de registro direto", () => {
    const casos = [
      {
        nome: "sanitario",
        input: {
          dominio: "sanitario",
          fazendaId: "farm-1",
          animalId: "animal-1",
          tipo: "vacinacao",
          produto: "Vacina X",
        } as const,
        detalheEsperado: "eventos_sanitario",
      },
      {
        nome: "pesagem",
        input: {
          dominio: "pesagem",
          fazendaId: "farm-1",
          animalId: "animal-1",
          pesoKg: 420.5,
        } as const,
        detalheEsperado: "eventos_pesagem",
      },
      {
        nome: "movimentacao",
        input: {
          dominio: "movimentacao",
          fazendaId: "farm-1",
          animalId: "animal-1",
          fromLoteId: "lote-a",
          toLoteId: "lote-b",
        } as const,
        detalheEsperado: "eventos_movimentacao",
      },
      {
        nome: "nutricao",
        input: {
          dominio: "nutricao",
          fazendaId: "farm-1",
          animalId: "animal-1",
          alimentoNome: "Racao Base",
          quantidadeKg: 12,
        } as const,
        detalheEsperado: "eventos_nutricao",
      },
      {
        nome: "reproducao",
        input: {
          dominio: "reproducao",
          fazendaId: "farm-1",
          animalId: "animal-1",
          tipo: "cobertura",
        } as const,
        detalheEsperado: "eventos_reproducao",
      },
      {
        nome: "financeiro",
        input: {
          dominio: "financeiro",
          fazendaId: "farm-1",
          animalId: "animal-1",
          tipo: "receita",
          valorTotal: 1000,
        } as const,
        detalheEsperado: "eventos_financeiro",
      },
    ];

    for (const caso of casos) {
      const result = buildEventGesture(caso.input);
      const tabelas = result.ops.map((op) => op.table);

      expect(tabelas[0]).toBe("eventos");
      expect(tabelas).toContain(caso.detalheEsperado);
    }
  });

  it("mantem navegacao critica para animal e evento", () => {
    const navigate = vi.fn();
    const controller = createAgendaActionController({
      activeFarmId: "farm-1",
      navigate,
      createGesture: vi.fn().mockResolvedValue(undefined),
      concludePendingSanitary: vi.fn().mockResolvedValue("evento-1"),
      pullDataForFarm: vi.fn().mockResolvedValue(undefined),
      getProtocolItemById: vi.fn().mockResolvedValue(null),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      nowIso: () => "2026-04-19T00:00:00.000Z",
      logError: vi.fn(),
    });

    controller.goToAnimal("animal-1");
    controller.goToEvent("evento-1");

    expect(navigate).toHaveBeenNthCalledWith(1, "/animais/animal-1");
    expect(navigate).toHaveBeenNthCalledWith(2, "/eventos?eventoId=evento-1");
  });
});
