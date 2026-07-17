import { describe, expect, it } from "vitest";

import {
  applyAgendaQuickFilters,
  buildAgendaBaseRows,
  groupAgendaRowsByAnimal,
  groupAgendaRowsByEvent,
  hasAgendaQuickFiltersActive,
  summarizeAgendaRowsByStatus,
} from "@/pages/Agenda/helpers/derivations";
import type { AgendaPageData } from "@/pages/Agenda/helpers/derivations";
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
    operationalClass: "operational_protocol",
    operationalClassLabel: "Protocolo operacional",
    protocol: null,
    protocolItem: null,
    priority: null,
    ...overrides,
  };
}

describe("agenda derivations", () => {
  it("resolves lote name from animal state when automatic agenda item has no lote_id", () => {
    const data: AgendaPageData = {
      itens: [
        {
          id: "agenda-1",
          tipo: "vacinacao",
          status: "agendado",
          data_prevista: "2026-06-01",
          animal_id: "animal-1",
          lote_id: null,
          dominio: "sanitario",
          payload: {},
          source_ref: {},
        } as AgendaRow["item"],
      ],
      animais: [
        {
          id: "animal-1",
          identificacao: "Matriz 001",
          lote_id: "lote-1",
          data_nascimento: null,
        } as AgendaRow["animal"],
      ].filter(Boolean) as AgendaPageData["animais"],
      lotes: [{ id: "lote-1", nome: "Lote A" } as AgendaRow["lote"]].filter(
        Boolean,
      ) as AgendaPageData["lotes"],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: null,
      officialTemplates: [],
      officialTemplateItems: [],
    };

    const rows = buildAgendaBaseRows(data, {
      search: "",
      statusFilter: "all",
      dominioFilter: "all",
      dateFrom: "",
      dateTo: "",
    });

    expect(rows[0]?.loteNome).toBe("Lote A");
  });

  it("uses sanitary agenda target label instead of Sem animal for grouped animal links", () => {
    const data: AgendaPageData = {
      itens: [
        {
          id: "sanitario-v2:agenda-1",
          tipo: "Reforço anual",
          status: "agendado",
          data_prevista: "2026-07-12",
          animal_id: null,
          lote_id: "lote-1",
          dominio: "sanitario",
          payload: { targetLabel: "2 animais" },
          source_ref: { target_label: "2 animais", produto: "Vacina Raiva" },
        } as AgendaRow["item"],
      ],
      animais: [],
      lotes: [{ id: "lote-1", nome: "L_09" } as AgendaRow["lote"]].filter(Boolean) as AgendaPageData["lotes"],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: null,
      officialTemplates: [],
      officialTemplateItems: [],
    };

    const rows = buildAgendaBaseRows(data, {
      search: "",
      statusFilter: "all",
      dominioFilter: "all",
      dateFrom: "",
      dateTo: "",
    });

    expect(rows[0]?.animalNome).toBe("2 animais");
    expect(rows[0]?.loteNome).toBe("L_09");

    const groups = groupAgendaRowsByAnimal({
      baseRows: rows,
      filteredRows: rows,
      hasQuickFiltersActive: false,
    });
    expect(groups[0]?.title).toBe("2 animais");
  });

  it("groups sanitary agenda by operational status, date, protocol and item instead of lote", () => {
    const rows = [
      createRow("agenda-a", {
        item: {
          id: "agenda-a",
          tipo: "vacinacao",
          status: "agendado",
          data_prevista: "2099-07-12",
          animal_id: null,
          lote_id: "lot-1",
          dominio: "sanitario",
          protocol_item_version_id: "item-ibr-bvd-d1",
          source_ref: {
            protocolo_id: "protocol-repro",
            produto: "Vacina Reprodutiva IBR BVD Leptospirose",
          },
        } as AgendaRow["item"],
        loteNome: "L_09",
        animalNome: "10 animais",
        produtoLabel: "Vacina Reprodutiva IBR BVD Leptospirose",
        protocol: { id: "protocol-repro", nome: "IBR/BVD" } as AgendaRow["protocol"],
      }),
      createRow("agenda-b", {
        item: {
          id: "agenda-b",
          tipo: "vacinacao",
          status: "agendado",
          data_prevista: "2099-07-12",
          animal_id: null,
          lote_id: "lot-2",
          dominio: "sanitario",
          protocol_item_version_id: "item-ibr-bvd-d1",
          source_ref: {
            protocolo_id: "protocol-repro",
            produto: "Vacina Reprodutiva IBR BVD Leptospirose",
          },
        } as AgendaRow["item"],
        loteNome: "L_10",
        animalNome: "8 animais",
        produtoLabel: "Vacina Reprodutiva IBR BVD Leptospirose",
        protocol: { id: "protocol-repro", nome: "IBR/BVD" } as AgendaRow["protocol"],
      }),
      createRow("agenda-cancelada", {
        item: {
          id: "agenda-cancelada",
          tipo: "vacinacao",
          status: "cancelado",
          data_prevista: "2099-07-12",
          animal_id: null,
          lote_id: "lot-1",
          dominio: "sanitario",
          protocol_item_version_id: "item-ibr-bvd-d1",
          source_ref: {
            protocolo_id: "protocol-repro",
            produto: "Vacina Reprodutiva IBR BVD Leptospirose",
          },
        } as AgendaRow["item"],
        loteNome: "L_09",
        animalNome: "10 animais",
        produtoLabel: "Vacina Reprodutiva IBR BVD Leptospirose",
        protocol: { id: "protocol-repro", nome: "IBR/BVD" } as AgendaRow["protocol"],
      }),
    ];

    const groups = groupAgendaRowsByEvent({
      baseRows: rows,
      filteredRows: rows,
      hasQuickFiltersActive: false,
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]?.title).toContain("Planejadas");
    expect(groups[0]?.title).toContain("IBR/BVD");
    expect(groups[0]?.rows.map((row) => row.loteNome).sort()).toEqual(["L_09", "L_10"]);
    expect(groups[0]?.subtitle).toContain("18 animal(is)");
    expect(groups[0]?.subtitle).toContain("2 lote(s)");
    expect(groups[1]?.title).toContain("Canceladas");
  });

  it("hides executed and cancelled sanitary agenda from default sanitary recorte", () => {
    const data: AgendaPageData = {
      itens: [
        {
          id: "planned",
          tipo: "vacinacao",
          status: "agendado",
          data_prevista: "2099-07-12",
          animal_id: null,
          lote_id: "lote-1",
          dominio: "sanitario",
          payload: {},
          source_ref: {},
        } as AgendaRow["item"],
        {
          id: "executed",
          tipo: "vacinacao",
          status: "concluido",
          data_prevista: "2099-07-12",
          animal_id: null,
          lote_id: "lote-1",
          dominio: "sanitario",
          payload: {},
          source_ref: {},
        } as AgendaRow["item"],
        {
          id: "cancelled",
          tipo: "vacinacao",
          status: "cancelado",
          data_prevista: "2099-07-12",
          animal_id: null,
          lote_id: "lote-1",
          dominio: "sanitario",
          payload: {},
          source_ref: {},
        } as AgendaRow["item"],
      ],
      animais: [],
      lotes: [{ id: "lote-1", nome: "L_09" } as AgendaRow["lote"]].filter(Boolean) as AgendaPageData["lotes"],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: null,
      officialTemplates: [],
      officialTemplateItems: [],
    };

    expect(
      buildAgendaBaseRows(data, {
        search: "",
        statusFilter: "all",
        dominioFilter: "sanitario",
        dateFrom: "",
        dateTo: "",
      }).map((row) => row.item.id),
    ).toEqual(["planned"]);
    expect(
      buildAgendaBaseRows(data, {
        search: "",
        statusFilter: "cancelado",
        dominioFilter: "sanitario",
        dateFrom: "",
        dateTo: "",
      }).map((row) => row.item.id),
    ).toEqual(["cancelled"]);
  });

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
      quickOperationalClassFilter: "operational_protocol",
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
        quickOperationalClassFilter: "all",
        quickAnimalFilter: "all",
      }),
    ).toBe(false);

    expect(
      hasAgendaQuickFiltersActive({
        quickTypeFilter: "vacinacao",
        quickScheduleFilter: "all",
        quickCalendarModeFilter: "all",
        quickCalendarAnchorFilter: "all",
        quickOperationalClassFilter: "clinical_protocol",
        quickAnimalFilter: "all",
      }),
    ).toBe(true);
  });
});
