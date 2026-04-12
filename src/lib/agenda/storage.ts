import { STORAGE_PREFIX } from "@/lib/storage";

export type PersistedAgendaGroupMode = "animal" | "evento";
export type PersistedAgendaStatusFilter = "all" | "agendado" | "concluido" | "cancelado";
export type PersistedAgendaAnimalQuickFilter =
  | "all"
  | "with-animal"
  | "without-animal"
  | "F"
  | "M"
  | "unknown";
export type PersistedAgendaScheduleQuickFilter = "all" | "overdue" | "today" | "future";
export type PersistedAgendaCalendarModeQuickFilter =
  | "all"
  | "campaign"
  | "age_window"
  | "rolling_interval"
  | "immediate"
  | "clinical_protocol";
export type PersistedAgendaCalendarAnchorQuickFilter =
  | "all"
  | "calendar_month"
  | "birth"
  | "weaning"
  | "pre_breeding_season"
  | "clinical_need"
  | "dry_off";

export interface PersistedAgendaContextualFocus {
  groupKey: string;
  rowId: string;
  rowIds: string[];
}

export interface PersistedAgendaUiState {
  search: string;
  statusFilter: PersistedAgendaStatusFilter;
  dominioFilter: string;
  dateFrom: string;
  dateTo: string;
  groupMode: PersistedAgendaGroupMode;
  quickTypeFilter: string;
  quickScheduleFilter: PersistedAgendaScheduleQuickFilter;
  quickCalendarModeFilter: PersistedAgendaCalendarModeQuickFilter;
  quickCalendarAnchorFilter: PersistedAgendaCalendarAnchorQuickFilter;
  quickAnimalFilter: PersistedAgendaAnimalQuickFilter;
  expandedGroups: string[];
  revealedGroups: string[];
  contextualFocus: PersistedAgendaContextualFocus | null;
}

const AGENDA_UI_VERSION = 1;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asGroupMode(value: unknown): PersistedAgendaGroupMode {
  return value === "evento" ? "evento" : "animal";
}

function asStatusFilter(value: unknown): PersistedAgendaStatusFilter {
  return value === "agendado" || value === "concluido" || value === "cancelado"
    ? value
    : "all";
}

function asScheduleQuickFilter(value: unknown): PersistedAgendaScheduleQuickFilter {
  return value === "overdue" || value === "today" || value === "future" ? value : "all";
}

function asCalendarModeQuickFilter(value: unknown): PersistedAgendaCalendarModeQuickFilter {
  return value === "campaign" ||
    value === "age_window" ||
    value === "rolling_interval" ||
    value === "immediate" ||
    value === "clinical_protocol"
    ? value
    : "all";
}

function asCalendarAnchorQuickFilter(
  value: unknown,
): PersistedAgendaCalendarAnchorQuickFilter {
  return value === "calendar_month" ||
    value === "birth" ||
    value === "weaning" ||
    value === "pre_breeding_season" ||
    value === "clinical_need" ||
    value === "dry_off"
    ? value
    : "all";
}

function asAnimalQuickFilter(value: unknown): PersistedAgendaAnimalQuickFilter {
  return value === "with-animal" ||
    value === "without-animal" ||
    value === "F" ||
    value === "M" ||
    value === "unknown"
    ? value
    : "all";
}

function asContextualFocus(value: unknown): PersistedAgendaContextualFocus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.groupKey !== "string" ||
    typeof record.rowId !== "string" ||
    !isStringArray(record.rowIds)
  ) {
    return null;
  }

  return {
    groupKey: record.groupKey,
    rowId: record.rowId,
    rowIds: record.rowIds,
  };
}

export function getAgendaUiStorageKey(userId: string, farmId: string) {
  return `${STORAGE_PREFIX}agenda_ui_v${AGENDA_UI_VERSION}:${userId}:${farmId}`;
}

export function readAgendaUiState(
  userId: string,
  farmId: string,
): PersistedAgendaUiState | null {
  try {
    const raw = localStorage.getItem(getAgendaUiStorageKey(userId, farmId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      search: asString(parsed.search),
      statusFilter: asStatusFilter(parsed.statusFilter),
      dominioFilter: asString(parsed.dominioFilter, "all"),
      dateFrom: asString(parsed.dateFrom),
      dateTo: asString(parsed.dateTo),
      groupMode: asGroupMode(parsed.groupMode),
      quickTypeFilter: asString(parsed.quickTypeFilter, "all"),
      quickScheduleFilter: asScheduleQuickFilter(parsed.quickScheduleFilter),
      quickCalendarModeFilter: asCalendarModeQuickFilter(parsed.quickCalendarModeFilter),
      quickCalendarAnchorFilter: asCalendarAnchorQuickFilter(parsed.quickCalendarAnchorFilter),
      quickAnimalFilter: asAnimalQuickFilter(parsed.quickAnimalFilter),
      expandedGroups: isStringArray(parsed.expandedGroups) ? parsed.expandedGroups : [],
      revealedGroups: isStringArray(parsed.revealedGroups) ? parsed.revealedGroups : [],
      contextualFocus: asContextualFocus(parsed.contextualFocus),
    };
  } catch {
    return null;
  }
}

export function writeAgendaUiState(
  userId: string,
  farmId: string,
  state: PersistedAgendaUiState,
) {
  try {
    localStorage.setItem(getAgendaUiStorageKey(userId, farmId), JSON.stringify(state));
  } catch {
    // Ignore storage errors in runtime environments without durable storage.
  }
}
