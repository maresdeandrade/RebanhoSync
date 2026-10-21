/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventGroupCard } from "@/pages/Agenda/components/EventGroupCard";
import { groupAgendaRowsByEvent } from "@/pages/Agenda/helpers/derivations";
import type { AgendaRow } from "@/pages/Agenda/types";

function createRow(id: string, tipo: string): AgendaRow {
  return {
    item: {
      id,
      fazenda_id: "farm-1",
      tipo,
      dominio: "sanitario",
      status: "agendado",
      data_prevista: "2099-01-01",
      animal_id: id,
      source_kind: "automatico",
      source_ref: { dose_num: 2 },
      payload: {},
      protocol_item_version_id: "version-1",
      interval_days_applied: 60,
    } as AgendaRow["item"],
    animal: null,
    lote: null,
    animalNome: id,
    loteNome: "Sem lote",
    idadeLabel: "idade n/d",
    syncStage: "synced",
    produtoLabel: "Produto planejado",
    protocol: {
      id: "protocol-1",
      nome: "Programa preventivo",
    } as AgendaRow["protocol"],
    protocolItem: null,
    priority: null,
    operationalStatuses: [],
    scheduleLabel: null,
    scheduleMode: null,
    scheduleModeLabel: null,
    scheduleAnchor: null,
    scheduleAnchorLabel: null,
    operationalClass: null,
    operationalClassLabel: null,
  };
}

function renderCollapsed(rows: AgendaRow[], visibleRows = rows) {
  const groups = groupAgendaRowsByEvent({
    baseRows: rows,
    filteredRows: visibleRows,
    hasQuickFiltersActive: visibleRows !== rows,
  });
  expect(groups).toHaveLength(1);
  const group = groups[0];
  const renderRowMeta = vi.fn();
  render(
    <EventGroupCard
      group={group}
      contextualFocusGroupKey={null}
      contextualFocusRowId={null}
      contextualHighlightedRowIds={new Set()}
      expandedGroupSet={new Set()}
      revealedGroups={[]}
      hasQuickFiltersActive={visibleRows !== rows}
      complianceGroupBadge={null}
      quickAnimalFilter="all"
      onEventSummaryBadgeClick={vi.fn()}
      onToggleGroupExpanded={vi.fn()}
      onToggleGroupReveal={vi.fn()}
      onGoToRegistrar={vi.fn()}
      onUpdateStatus={vi.fn()}
      onNavigateToEvent={vi.fn()}
      onNavigateToAnimal={vi.fn()}
      renderRowMeta={renderRowMeta}
      registerRowRef={vi.fn()}
    />,
  );
  expect(renderRowMeta).not.toHaveBeenCalled();
  expect(screen.getByText(group.subtitle)).not.toBeVisible();
  return group;
}

describe("collapsed agenda management groups", () => {
  it.each([
    ["vacinacao", "Vacinação"],
    ["vermifugacao", "Vermifugação"],
    ["pesagem", "Pesagem"],
    ["reproducao", "Reprodução"],
    ["movimentacao", "Movimentação"],
    ["medicamento", "Medicamento"],
  ])(
    "identifies persisted type %s without expanding or replacing protocol details",
    (tipo, label) => {
      const group = renderCollapsed([createRow("a", tipo)]);
      expect(screen.getByRole("heading", { name: label })).toBeVisible();
      expect(screen.getByText(/Programa preventivo ·/)).toBeVisible();
      expect(screen.getByText("Produto: Produto planejado")).toBeVisible();
      expect(screen.getByText("Intervalo: 60 dias")).toBeVisible();
      expect(group.title).toContain("Programa preventivo");
      expect(group.subtitle).toContain("Produto: Produto planejado");
      expect(group.subtitle).toContain("Dose 2");
      expect(group.subtitle).toContain("60d");
      expect(screen.getByText("1 item(ns) no recorte")).toBeInTheDocument();
    },
  );

  it("lists all persisted types even when a quick filter exposes only one row", () => {
    const rows = [
      createRow("a", "vacinacao"),
      createRow("b", "vermifugacao"),
      createRow("c", "vacinacao"),
    ];
    const group = renderCollapsed(rows, rows.slice(0, 1));
    expect(
      screen.getByRole("heading", { name: "Vacinação · Vermifugação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 de 3 item(ns) visíveis")).toBeInTheDocument();
    expect(group.rows.map((row) => row.item.id)).toEqual(["a", "b", "c"]);
  });

  it("shows an explicit missing type instead of inferring it from product or domain", () => {
    renderCollapsed([createRow("a", "")]);
    expect(
      screen.getByRole("heading", { name: "Tipo não informado" }),
    ).toBeVisible();
  });

  it("keeps the type visible when a closed task has no next-action recommendation", () => {
    const row = createRow("a", "vacinacao");
    row.item.status = "cancelado";
    renderCollapsed([row]);
    expect(screen.getByRole("heading", { name: "Vacinação" })).toBeVisible();
    expect(screen.getByText("Cancelado")).toBeVisible();
    expect(screen.queryByText("Próxima ação")).not.toBeInTheDocument();
  });

  it("keeps an unfamiliar persisted subtype instead of substituting a domain classification", () => {
    renderCollapsed([createRow("a", "avaliacao_reprodutiva")]);
    expect(
      screen.getByRole("heading", { name: "Avaliacao Reprodutiva" }),
    ).toBeInTheDocument();
  });
});
