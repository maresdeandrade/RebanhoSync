import { useEffect, useRef, useState } from "react";

import {
  readAgendaUiState,
  writeAgendaUiState,
} from "@/lib/agenda/storage";
import type {
  AgendaContextualFocus,
  AgendaCalendarAnchorQuickFilter,
  AgendaCalendarModeQuickFilter,
  AgendaRow,
  AgendaStatusFilter,
  AnimalQuickFilter,
  GroupMode,
} from "@/pages/Agenda/types";
import type { AgendaScheduleQuickFilter } from "@/pages/Agenda/types";

export const DEFAULT_AGENDA_SHELL_STATE = {
  search: "",
  statusFilter: "all" as AgendaStatusFilter,
  dominioFilter: "all",
  dateFrom: "",
  dateTo: "",
  groupMode: "animal" as GroupMode,
  quickTypeFilter: "all",
  quickScheduleFilter: "all" as AgendaScheduleQuickFilter,
  quickCalendarModeFilter: "all" as AgendaCalendarModeQuickFilter,
  quickCalendarAnchorFilter: "all" as AgendaCalendarAnchorQuickFilter,
  quickAnimalFilter: "all" as AnimalQuickFilter,
};

type UseAgendaShellStateInput = {
  activeFarmId: string | null;
  userId: string | undefined;
  queryCalendarModeFilter: AgendaCalendarModeQuickFilter | null;
  queryCalendarAnchorFilter: AgendaCalendarAnchorQuickFilter | null;
  queryDominioFilter: string | null;
};

function buildGroupStateKey(mode: GroupMode, groupKey: string) {
  return `${mode}:${groupKey}`;
}

export function useAgendaShellState({
  activeFarmId,
  userId,
  queryCalendarModeFilter,
  queryCalendarAnchorFilter,
  queryDominioFilter,
}: UseAgendaShellStateInput) {
  const previousGroupModeRef = useRef<GroupMode | null>(null);
  const [search, setSearch] = useState(DEFAULT_AGENDA_SHELL_STATE.search);
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>(
    DEFAULT_AGENDA_SHELL_STATE.statusFilter,
  );
  const [dominioFilter, setDominioFilter] = useState(DEFAULT_AGENDA_SHELL_STATE.dominioFilter);
  const [dateFrom, setDateFrom] = useState(DEFAULT_AGENDA_SHELL_STATE.dateFrom);
  const [dateTo, setDateTo] = useState(DEFAULT_AGENDA_SHELL_STATE.dateTo);
  const [groupMode, setGroupMode] = useState<GroupMode>(DEFAULT_AGENDA_SHELL_STATE.groupMode);
  const [quickTypeFilter, setQuickTypeFilter] = useState<string>(
    DEFAULT_AGENDA_SHELL_STATE.quickTypeFilter,
  );
  const [quickScheduleFilter, setQuickScheduleFilter] = useState<AgendaScheduleQuickFilter>(
    DEFAULT_AGENDA_SHELL_STATE.quickScheduleFilter,
  );
  const [quickCalendarModeFilter, setQuickCalendarModeFilter] =
    useState<AgendaCalendarModeQuickFilter>(DEFAULT_AGENDA_SHELL_STATE.quickCalendarModeFilter);
  const [quickCalendarAnchorFilter, setQuickCalendarAnchorFilter] =
    useState<AgendaCalendarAnchorQuickFilter>(
      DEFAULT_AGENDA_SHELL_STATE.quickCalendarAnchorFilter,
    );
  const [quickAnimalFilter, setQuickAnimalFilter] =
    useState<AnimalQuickFilter>(DEFAULT_AGENDA_SHELL_STATE.quickAnimalFilter);
  const [contextualFocus, setContextualFocus] = useState<AgendaContextualFocus | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [revealedGroups, setRevealedGroups] = useState<string[]>([]);
  const [hasHydratedUiState, setHasHydratedUiState] = useState(false);

  const clearContextualState = () => {
    setContextualFocus(null);
    setExpandedGroups([]);
    setRevealedGroups([]);
  };

  const resetFilters = () => {
    setSearch(DEFAULT_AGENDA_SHELL_STATE.search);
    setStatusFilter(DEFAULT_AGENDA_SHELL_STATE.statusFilter);
    setDominioFilter(DEFAULT_AGENDA_SHELL_STATE.dominioFilter);
    setDateFrom(DEFAULT_AGENDA_SHELL_STATE.dateFrom);
    setDateTo(DEFAULT_AGENDA_SHELL_STATE.dateTo);
    setGroupMode(DEFAULT_AGENDA_SHELL_STATE.groupMode);
    setQuickTypeFilter(DEFAULT_AGENDA_SHELL_STATE.quickTypeFilter);
    setQuickScheduleFilter(DEFAULT_AGENDA_SHELL_STATE.quickScheduleFilter);
    setQuickCalendarModeFilter(DEFAULT_AGENDA_SHELL_STATE.quickCalendarModeFilter);
    setQuickCalendarAnchorFilter(DEFAULT_AGENDA_SHELL_STATE.quickCalendarAnchorFilter);
    setQuickAnimalFilter(DEFAULT_AGENDA_SHELL_STATE.quickAnimalFilter);
    clearContextualState();
  };

  const ensureGroupExpanded = (mode: GroupMode, groupKey: string) => {
    const stateKey = buildGroupStateKey(mode, groupKey);
    setExpandedGroups((current) => (current.includes(stateKey) ? current : [...current, stateKey]));
  };

  const toggleGroupExpanded = (mode: GroupMode, groupKey: string) => {
    const stateKey = buildGroupStateKey(mode, groupKey);
    setExpandedGroups((current) =>
      current.includes(stateKey)
        ? current.filter((entry) => entry !== stateKey)
        : [...current, stateKey],
    );
  };

  const toggleGroupReveal = (mode: GroupMode, groupKey: string) => {
    const stateKey = buildGroupStateKey(mode, groupKey);
    setRevealedGroups((current) =>
      current.includes(stateKey)
        ? current.filter((entry) => entry !== stateKey)
        : [...current, stateKey],
    );
  };

  const applyContextualFocus = (groupKey: string, rows: AgendaRow[]) => {
    if (rows.length === 0) {
      setContextualFocus(null);
      return;
    }

    const stateKey = buildGroupStateKey(groupMode, groupKey);
    ensureGroupExpanded(groupMode, groupKey);
    setRevealedGroups((current) => current.filter((entry) => entry !== stateKey));
    setContextualFocus({
      token: Date.now(),
      groupKey,
      rowId: rows[0].item.id,
      rowIds: rows.map((row) => row.item.id),
    });
  };

  useEffect(() => {
    if (!userId || !activeFarmId) {
      previousGroupModeRef.current = null;
      setHasHydratedUiState(false);
      return;
    }

    const persistedState = readAgendaUiState(userId, activeFarmId);
    const nextGroupMode = persistedState?.groupMode ?? DEFAULT_AGENDA_SHELL_STATE.groupMode;

    setSearch(persistedState?.search ?? DEFAULT_AGENDA_SHELL_STATE.search);
    setStatusFilter(persistedState?.statusFilter ?? DEFAULT_AGENDA_SHELL_STATE.statusFilter);
    setDominioFilter(persistedState?.dominioFilter ?? DEFAULT_AGENDA_SHELL_STATE.dominioFilter);
    setDateFrom(persistedState?.dateFrom ?? DEFAULT_AGENDA_SHELL_STATE.dateFrom);
    setDateTo(persistedState?.dateTo ?? DEFAULT_AGENDA_SHELL_STATE.dateTo);
    setGroupMode(nextGroupMode);
    setQuickTypeFilter(
      persistedState?.quickTypeFilter ?? DEFAULT_AGENDA_SHELL_STATE.quickTypeFilter,
    );
    setQuickScheduleFilter(
      persistedState?.quickScheduleFilter ?? DEFAULT_AGENDA_SHELL_STATE.quickScheduleFilter,
    );
    setQuickCalendarModeFilter(
      persistedState?.quickCalendarModeFilter ??
        DEFAULT_AGENDA_SHELL_STATE.quickCalendarModeFilter,
    );
    setQuickCalendarAnchorFilter(
      persistedState?.quickCalendarAnchorFilter ??
        DEFAULT_AGENDA_SHELL_STATE.quickCalendarAnchorFilter,
    );
    setQuickAnimalFilter(
      persistedState?.quickAnimalFilter ?? DEFAULT_AGENDA_SHELL_STATE.quickAnimalFilter,
    );
    setExpandedGroups(persistedState?.expandedGroups ?? []);
    setRevealedGroups(persistedState?.revealedGroups ?? []);
    setContextualFocus(
      persistedState?.contextualFocus
        ? {
            token: Date.now(),
            ...persistedState.contextualFocus,
          }
        : null,
    );
    previousGroupModeRef.current = nextGroupMode;
    setHasHydratedUiState(true);
  }, [activeFarmId, userId]);

  useEffect(() => {
    if (!userId || !activeFarmId || !hasHydratedUiState) return;

    writeAgendaUiState(userId, activeFarmId, {
      search,
      statusFilter,
      dominioFilter,
      dateFrom,
      dateTo,
      groupMode,
      quickTypeFilter,
      quickScheduleFilter,
      quickCalendarModeFilter,
      quickCalendarAnchorFilter,
      quickAnimalFilter,
      expandedGroups,
      revealedGroups,
      contextualFocus: contextualFocus
        ? {
            groupKey: contextualFocus.groupKey,
            rowId: contextualFocus.rowId,
            rowIds: contextualFocus.rowIds,
          }
        : null,
    });
  }, [
    activeFarmId,
    contextualFocus,
    dateFrom,
    dateTo,
    dominioFilter,
    expandedGroups,
    groupMode,
    hasHydratedUiState,
    quickAnimalFilter,
    quickCalendarAnchorFilter,
    quickCalendarModeFilter,
    quickScheduleFilter,
    quickTypeFilter,
    revealedGroups,
    search,
    statusFilter,
    userId,
  ]);

  useEffect(() => {
    if (!hasHydratedUiState) return;

    const previousGroupMode = previousGroupModeRef.current;
    if (previousGroupMode === null) {
      previousGroupModeRef.current = groupMode;
      return;
    }

    if (previousGroupMode === groupMode) return;

    previousGroupModeRef.current = groupMode;
    clearContextualState();
  }, [groupMode, hasHydratedUiState]);

  useEffect(() => {
    if (!hasHydratedUiState || queryCalendarModeFilter === null) return;

    setQuickCalendarModeFilter(queryCalendarModeFilter);
    clearContextualState();
  }, [hasHydratedUiState, queryCalendarModeFilter]);

  useEffect(() => {
    if (!hasHydratedUiState || queryCalendarAnchorFilter === null) return;

    setQuickCalendarAnchorFilter(queryCalendarAnchorFilter);
    clearContextualState();
  }, [hasHydratedUiState, queryCalendarAnchorFilter]);

  useEffect(() => {
    if (!hasHydratedUiState || queryDominioFilter === null) return;

    setDominioFilter(queryDominioFilter);
    clearContextualState();
  }, [hasHydratedUiState, queryDominioFilter]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dominioFilter,
    setDominioFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    groupMode,
    setGroupMode,
    quickTypeFilter,
    setQuickTypeFilter,
    quickScheduleFilter,
    setQuickScheduleFilter,
    quickCalendarModeFilter,
    setQuickCalendarModeFilter,
    quickCalendarAnchorFilter,
    setQuickCalendarAnchorFilter,
    quickAnimalFilter,
    setQuickAnimalFilter,
    contextualFocus,
    setContextualFocus,
    expandedGroups,
    revealedGroups,
    hasHydratedUiState,
    resetFilters,
    clearContextualState,
    ensureGroupExpanded,
    toggleGroupExpanded,
    toggleGroupReveal,
    applyContextualFocus,
  };
}
