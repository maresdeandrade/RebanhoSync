import { useEffect, useMemo, useRef } from "react";

import { getAdjacentAgendaCriticalNavigationTarget } from "@/lib/agenda/criticalNavigation";
import { getAgendaScheduleBucket } from "@/lib/agenda/groupOrdering";
import { mapAnimalBadgeToQuickFilter, mapScheduleBadgeToQuickFilter, matchesAnimalQuickFilter } from "@/pages/Agenda/helpers/quickFilters";
import type { AgendaRow, AgendaScheduleQuickFilter, AnimalQuickFilter } from "@/pages/Agenda/types";

export type UseAgendaInteractionStateInput = {
  contextualFocus: { groupKey: string; rowId: string; rowIds: string[] } | null;
  filteredRows: AgendaRow[];
  criticalTargets: Array<{ groupKey: string; rows: AgendaRow[] }>;
  currentCriticalGroupKey: string | null;
  quickScheduleFilter: AgendaScheduleQuickFilter;
  quickTypeFilter: string;
  quickAnimalFilter: AnimalQuickFilter;
  setContextualFocus: (value: { token: number; groupKey: string; rowId: string; rowIds: string[] } | null) => void;
  setQuickScheduleFilter: (value: AgendaScheduleQuickFilter) => void;
  setQuickTypeFilter: (value: string) => void;
  setQuickAnimalFilter: (value: AnimalQuickFilter) => void;
  clearContextualState: () => void;
  applyContextualFocus: (groupKey: string, rows: AgendaRow[]) => void;
};

export function useAgendaInteractionState({
  contextualFocus,
  filteredRows,
  criticalTargets,
  currentCriticalGroupKey,
  quickScheduleFilter,
  quickTypeFilter,
  quickAnimalFilter,
  setContextualFocus,
  setQuickScheduleFilter,
  setQuickTypeFilter,
  setQuickAnimalFilter,
  clearContextualState,
  applyContextualFocus,
}: UseAgendaInteractionStateInput) {
  const rowRefs = useRef(new Map<string, HTMLElement>());

  const contextualHighlightedRowIds = useMemo(
    () => new Set(contextualFocus?.rowIds ?? []),
    [contextualFocus],
  );

  useEffect(() => {
    if (!contextualFocus) return;

    const visibleRowId = contextualFocus.rowIds.find((rowId) => rowRefs.current.has(rowId));
    if (!visibleRowId) {
      setContextualFocus(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const node = rowRefs.current.get(visibleRowId);
      if (!node) return;

      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [contextualFocus, filteredRows, setContextualFocus]);

  const registerRowRef = (rowId: string, node: HTMLElement | null) => {
    if (node) {
      rowRefs.current.set(rowId, node);
      return;
    }

    rowRefs.current.delete(rowId);
  };

  const navigateCriticalGroup = (direction: "next" | "previous") => {
    const target = getAdjacentAgendaCriticalNavigationTarget(
      criticalTargets,
      currentCriticalGroupKey,
      direction,
    );
    if (!target) return;

    setQuickScheduleFilter("overdue");
    applyContextualFocus(target.groupKey, target.rows);
  };

  const handleAnimalSummaryBadgeClick = (
    groupKey: string,
    rows: AgendaRow[],
    badgeKey: string,
  ) => {
    const isSameGroupFocused = contextualFocus?.groupKey === groupKey;
    const scheduleFilter = mapScheduleBadgeToQuickFilter(badgeKey);

    if (scheduleFilter) {
      if (quickScheduleFilter === scheduleFilter && isSameGroupFocused) {
        setQuickScheduleFilter("all");
        clearContextualState();
        return;
      }

      setQuickScheduleFilter(scheduleFilter);
      applyContextualFocus(
        groupKey,
        rows.filter((row) => getAgendaScheduleBucket(row.item) === scheduleFilter),
      );
      return;
    }

    if (quickTypeFilter === badgeKey && isSameGroupFocused) {
      setQuickTypeFilter("all");
      clearContextualState();
      return;
    }

    setQuickTypeFilter(badgeKey);
    applyContextualFocus(
      groupKey,
      rows.filter((row) => row.item.tipo === badgeKey),
    );
  };

  const handleEventSummaryBadgeClick = (
    groupKey: string,
    rows: AgendaRow[],
    badgeKey: string,
  ) => {
    const animalFilter = mapAnimalBadgeToQuickFilter(badgeKey);
    if (!animalFilter) return;

    const isSameGroupFocused = contextualFocus?.groupKey === groupKey;
    if (quickAnimalFilter === animalFilter && isSameGroupFocused) {
      setQuickAnimalFilter("all");
      clearContextualState();
      return;
    }

    setQuickAnimalFilter(animalFilter);
    applyContextualFocus(
      groupKey,
      rows.filter((row) => matchesAnimalQuickFilter(row.item, row.animal, animalFilter)),
    );
  };

  return {
    contextualHighlightedRowIds,
    registerRowRef,
    navigateCriticalGroup,
    handleAnimalSummaryBadgeClick,
    handleEventSummaryBadgeClick,
  };
}
