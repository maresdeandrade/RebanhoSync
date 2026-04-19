/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAgendaInteractionState } from "@/pages/Agenda/useAgendaInteractionState";
import type { AgendaRow } from "@/pages/Agenda/types";

function createRow(id: string, overrides: Partial<AgendaRow> = {}): AgendaRow {
  return {
    item: {
      id,
      tipo: "vacinacao",
      status: "agendado",
      data_prevista: "2020-01-01",
      animal_id: "animal-1",
      dominio: "sanitario",
    } as AgendaRow["item"],
    animal: { id: "animal-1", sexo: "F", identificacao: "Matriz 001" } as AgendaRow["animal"],
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

describe("useAgendaInteractionState", () => {
  it("navigates overdue groups through critical targets", () => {
    const setQuickScheduleFilter = vi.fn();
    const applyContextualFocus = vi.fn();

    const rows = [createRow("row-1")];

    const { result } = renderHook(() =>
      useAgendaInteractionState({
        contextualFocus: null,
        filteredRows: rows,
        criticalTargets: [{ groupKey: "animal:1", rows }],
        currentCriticalGroupKey: null,
        quickScheduleFilter: "all",
        quickTypeFilter: "all",
        quickAnimalFilter: "all",
        setContextualFocus: vi.fn(),
        setQuickScheduleFilter,
        setQuickTypeFilter: vi.fn(),
        setQuickAnimalFilter: vi.fn(),
        clearContextualState: vi.fn(),
        applyContextualFocus,
      }),
    );

    act(() => {
      result.current.navigateCriticalGroup("next");
    });

    expect(setQuickScheduleFilter).toHaveBeenCalledWith("overdue");
    expect(applyContextualFocus).toHaveBeenCalledWith("animal:1", rows);
  });

  it("toggles schedule quick filter off when badge is clicked twice in same focused group", () => {
    const setQuickScheduleFilter = vi.fn();
    const clearContextualState = vi.fn();

    const rows = [
      createRow("row-overdue", {
        item: {
          id: "row-overdue",
          tipo: "vacinacao",
          status: "agendado",
          data_prevista: "2020-01-01",
          animal_id: "animal-1",
          dominio: "sanitario",
        } as AgendaRow["item"],
      }),
    ];

    const { result } = renderHook(() =>
      useAgendaInteractionState({
        contextualFocus: {
          token: 1,
          groupKey: "animal:1",
          rowId: "row-overdue",
          rowIds: ["row-overdue"],
        },
        filteredRows: rows,
        criticalTargets: [],
        currentCriticalGroupKey: null,
        quickScheduleFilter: "overdue",
        quickTypeFilter: "all",
        quickAnimalFilter: "all",
        setContextualFocus: vi.fn(),
        setQuickScheduleFilter,
        setQuickTypeFilter: vi.fn(),
        setQuickAnimalFilter: vi.fn(),
        clearContextualState,
        applyContextualFocus: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleAnimalSummaryBadgeClick("animal:1", rows, "overdue");
    });

    expect(setQuickScheduleFilter).toHaveBeenCalledWith("all");
    expect(clearContextualState).toHaveBeenCalled();
  });

  it("applies animal badge filter in event groups", () => {
    const setQuickAnimalFilter = vi.fn();
    const applyContextualFocus = vi.fn();

    const rows = [
      createRow("row-f", { animal: { id: "animal-1", sexo: "F" } as AgendaRow["animal"] }),
      createRow("row-m", { animal: { id: "animal-2", sexo: "M" } as AgendaRow["animal"] }),
    ];

    const { result } = renderHook(() =>
      useAgendaInteractionState({
        contextualFocus: null,
        filteredRows: rows,
        criticalTargets: [],
        currentCriticalGroupKey: null,
        quickScheduleFilter: "all",
        quickTypeFilter: "all",
        quickAnimalFilter: "all",
        setContextualFocus: vi.fn(),
        setQuickScheduleFilter: vi.fn(),
        setQuickTypeFilter: vi.fn(),
        setQuickAnimalFilter,
        clearContextualState: vi.fn(),
        applyContextualFocus,
      }),
    );

    act(() => {
      result.current.handleEventSummaryBadgeClick("evento:vacinacao", rows, "female");
    });

    expect(setQuickAnimalFilter).toHaveBeenCalledWith("F");
    expect(applyContextualFocus).toHaveBeenCalledWith(
      "evento:vacinacao",
      expect.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ id: "row-f" }) }),
      ]),
    );
  });
});
