import { describe, expect, it } from "vitest";

import {
  applyAgendaQuickFilters,
  groupAgendaRowsByAnimal,
  hasAgendaQuickFiltersActive,
  summarizeAgendaRowsByStatus,
} from "@/pages/Agenda/helpers/derivations";
import type { AgendaRow } from "@/pages/Agenda/types";

function createRow(
  id: string,
  overrides: Partial<AgendaRow> = {},
): AgendaRow {
  return {
    item: {
      id,
      tipo: "vacinacao",
      status: "agendado",
      data_prevista: "2020-01-01",
      animal_id: "animal-1",
      dominio: "sanitario",
    } as AgendaRow["item"],
    animal: { sexo: "F", identificacao: "Matriz 001" } as AgendaRow["animal"],
    lote: null,
    animalNome: "Matriz 001",
    loteNome: "Lote A",
    idadeLabel: "3a",
    syncStage: "synced",
    produtoLabel: "Vacina",
    scheduleLabel: null,
    scheduleMode: null,
    scheduleModeLabel: null,
    scheduleAnchor: null,
    scheduleAnchorLabel: null,
    protocol: null,
    protocolItem: null,
    priority: null,
    ...overrides,
  };
}

describe("agenda derivations", () => {
  it("applies quick filters without duplicating domain rules", () => {
    const rows: AgendaRow[] = [
      createRow("row-1", {
        item: {
          id: "row-1",
          tipo: "vacinacao",
          status: "agendado",
          data_prevista: "2020-01-01",
          animal_id: "animal-1",
          dominio: "sanitario",
        } as AgendaRow["item"],
        scheduleMode: "janela_etaria",
        scheduleAnchor: "nascimento",
      }),
      createRow("row-2", {
        item: {
          id: "row-2",
          tipo: "vermifugacao",
          status: "concluido",
          data_prevista: "2099-01-01",
          animal_id: null,
          dominio: "sanitario",
        } as AgendaRow["item"],
        animal: null,
      }),
    ];

    const filtered = applyAgendaQuickFilters(rows, {
      quickTypeFilter: "vacinacao",
      quickScheduleFilter: "overdue",
      quickCalendarModeFilter: "janela_etaria",
      quickCalendarAnchorFilter: "nascimento",
      quickAnimalFilter: "F",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.item.id).toBe("row-1");
  });

  it("groups by animal and keeps visible rows aligned with recorte", () => {
    const rowA = createRow("row-a", {
      item: {
        id: "row-a",
        tipo: "vacinacao",
        status: "agendado",
        data_prevista: "2020-01-01",
        animal_id: "animal-1",
        dominio: "sanitario",
      } as AgendaRow["item"],
      animal: { sexo: "F", identificacao: "Matriz 001" } as AgendaRow["animal"],
      animalNome: "Matriz 001",
    });
    const rowB = createRow("row-b", {
      item: {
        id: "row-b",
        tipo: "vermifugacao",
        status: "agendado",
        data_prevista: "2020-02-01",
        animal_id: "animal-1",
        dominio: "sanitario",
      } as AgendaRow["item"],
      animal: { sexo: "F", identificacao: "Matriz 001" } as AgendaRow["animal"],
      animalNome: "Matriz 001",
    });

    const groups = groupAgendaRowsByAnimal({
      baseRows: [rowA, rowB],
      filteredRows: [rowA],
      hasQuickFiltersActive: true,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(2);
    expect(groups[0]?.visibleRows).toHaveLength(1);
    expect(groups[0]?.visibleRows[0]?.item.id).toBe("row-a");
  });

  it("summarizes status counters and quick-filter activation", () => {
    const rows: AgendaRow[] = [
      createRow("row-1", { item: { status: "agendado" } as AgendaRow["item"] }),
      createRow("row-2", { item: { status: "concluido" } as AgendaRow["item"] }),
      createRow("row-3", { item: { status: "cancelado" } as AgendaRow["item"] }),
    ];

    expect(summarizeAgendaRowsByStatus(rows)).toEqual({
      agendado: 1,
      concluido: 1,
      cancelado: 1,
    });

    expect(
      hasAgendaQuickFiltersActive({
        quickTypeFilter: "all",
        quickScheduleFilter: "all",
        quickCalendarModeFilter: "all",
        quickCalendarAnchorFilter: "all",
        quickAnimalFilter: "all",
      }),
    ).toBe(false);

    expect(
      hasAgendaQuickFiltersActive({
        quickTypeFilter: "vacinacao",
        quickScheduleFilter: "all",
        quickCalendarModeFilter: "all",
        quickCalendarAnchorFilter: "all",
        quickAnimalFilter: "all",
      }),
    ).toBe(true);
  });
});
