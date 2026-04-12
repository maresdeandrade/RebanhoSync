import { describe, expect, it } from "vitest";

import { buildAgendaGroupRecommendation } from "@/lib/agenda/groupRecommendations";

function createRow(
  overrides: Partial<{
    id: string;
    status: "agendado" | "concluido" | "cancelado";
    data_prevista: string;
    tipo: string;
    animalNome: string;
    loteNome: string;
    priority: {
      label: string;
      tone: "neutral" | "info" | "warning" | "danger";
      mandatory: boolean;
    } | null;
  }> = {},
) {
  return {
    item: {
      id: "agenda-1",
      status: "agendado" as const,
      data_prevista: "2026-04-09",
      tipo: "vacinacao",
      ...overrides,
    },
    animalNome: "Matriz 01",
    loteNome: "Lote A",
    priority: null,
    ...overrides,
  };
}

describe("agenda group recommendations", () => {
  it("picks the most urgent pending row in the group", () => {
    const recommendation = buildAgendaGroupRecommendation(
      [
        createRow({
          id: "future",
          data_prevista: "2026-04-12",
          tipo: "vermifugacao",
        }),
        createRow({
          id: "overdue",
          data_prevista: "2026-04-08",
          tipo: "vacinacao",
        }),
      ],
      new Date("2026-04-09T09:00:00"),
    );

    expect(recommendation).toEqual({
      rowId: "overdue",
      urgencyLabel: "Atrasado",
      actionLabel: "Vacinacao",
      targetLabel: "Matriz 01",
      tone: "danger",
    });
  });

  it("prioritizes mandatory sanitary actions inside the same schedule bucket", () => {
    const recommendation = buildAgendaGroupRecommendation(
      [
        createRow({
          id: "today-optional",
          data_prevista: "2026-04-09",
          tipo: "vacinacao",
          priority: {
            label: "Hoje",
            tone: "warning",
            mandatory: false,
          },
        }),
        createRow({
          id: "today-mandatory",
          data_prevista: "2026-04-09",
          tipo: "medicamento",
          priority: {
            label: "Obrigatorio hoje",
            tone: "danger",
            mandatory: true,
          },
        }),
      ],
      new Date("2026-04-09T09:00:00"),
    );

    expect(recommendation).toEqual({
      rowId: "today-mandatory",
      urgencyLabel: "Obrigatorio hoje",
      actionLabel: "Medicamento",
      targetLabel: "Matriz 01",
      tone: "danger",
    });
  });

  it("ignores closed rows and returns null without pending actions", () => {
    const recommendation = buildAgendaGroupRecommendation(
      [
        createRow({
          status: "concluido",
          data_prevista: "2026-04-08",
        }),
        createRow({
          status: "cancelado",
          data_prevista: "2026-04-09",
        }),
      ],
      new Date("2026-04-09T09:00:00"),
    );

    expect(recommendation).toBeNull();
  });

  it("falls back to lote when the row has no animal", () => {
    const recommendation = buildAgendaGroupRecommendation(
      [
        createRow({
          id: "lote-row",
          animalNome: "Sem animal",
          loteNome: "Lote Coletivo",
          tipo: "movimentacao",
          data_prevista: "2026-04-09",
        }),
      ],
      new Date("2026-04-09T09:00:00"),
    );

    expect(recommendation).toEqual({
      rowId: "lote-row",
      urgencyLabel: "Hoje",
      actionLabel: "Movimentacao",
      targetLabel: "Lote Coletivo",
      tone: "warning",
    });
  });
});
