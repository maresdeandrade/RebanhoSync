import { describe, expect, it } from "vitest";

import {
  summarizeAgendaGroupByAnimal,
  summarizeAgendaGroupByEvent,
  type AgendaGroupSummaryRow,
} from "@/lib/agenda/groupSummaries";

function createRow(
  overrides: Partial<AgendaGroupSummaryRow["item"]> = {},
  animalSexo: AgendaGroupSummaryRow["animal"] = { sexo: "F" },
): AgendaGroupSummaryRow {
  return {
    item: {
      id: crypto.randomUUID(),
      tipo: "vacinacao",
      status: "agendado",
      data_prevista: "2026-04-09",
      animal_id: "animal-1",
      ...overrides,
    },
    animal: animalSexo,
  };
}

describe("agenda group summaries", () => {
  it("summarizes animal cards by type and schedule bucket", () => {
    const rows = [
      createRow({
        tipo: "vacinacao",
        data_prevista: "2026-04-08",
      }),
      createRow({
        id: "row-2",
        tipo: "vacinacao",
        data_prevista: "2026-04-09",
      }),
      createRow({
        id: "row-3",
        tipo: "vermifugacao",
        data_prevista: "2026-04-12",
      }),
      createRow({
        id: "row-4",
        tipo: "pesagem",
        status: "concluido",
        data_prevista: "2026-04-05",
      }),
    ];

    const summary = summarizeAgendaGroupByAnimal(rows, new Date("2026-04-09T10:00:00"));

    expect(summary.typeBadges).toEqual([
      { key: "vacinacao", label: "Vacinacao", count: 2, tone: "info" },
      { key: "pesagem", label: "Pesagem", count: 1, tone: "neutral" },
      {
        key: "vermifugacao",
        label: "Vermifugacao",
        count: 1,
        tone: "success",
      },
    ]);

    expect(summary.scheduleBadges).toEqual([
      { key: "overdue", label: "Atrasado", count: 1, tone: "danger" },
      { key: "today", label: "Hoje", count: 1, tone: "warning" },
      { key: "future", label: "Futuro", count: 1, tone: "info" },
    ]);
  });

  it("summarizes event cards by unique animals and sex split", () => {
    const rows = [
      createRow({ id: "row-1", animal_id: "animal-f-1" }, { sexo: "F" }),
      createRow({ id: "row-2", animal_id: "animal-f-1" }, { sexo: "F" }),
      createRow({ id: "row-3", animal_id: "animal-m-1" }, { sexo: "M" }),
      createRow({ id: "row-4", animal_id: "animal-u-1" }, null),
      createRow({ id: "row-5", animal_id: null }, null),
    ];

    const summary = summarizeAgendaGroupByEvent(rows);

    expect(summary.animalBadges).toEqual([
      { key: "animals", label: "Animais", count: 3, tone: "neutral" },
      { key: "female", label: "Femeas", count: 1, tone: "info" },
      { key: "male", label: "Machos", count: 1, tone: "warning" },
      { key: "unknown", label: "Sexo n/d", count: 1, tone: "neutral" },
      { key: "without-animal", label: "Sem animal", count: 1, tone: "danger" },
    ]);
  });
});
