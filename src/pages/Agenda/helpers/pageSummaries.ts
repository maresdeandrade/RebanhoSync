import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  type PendingAnimalLifecycleSummary,
  type PendingAnimalLifecycleTransition,
} from "@/lib/animals/lifecycle";
import type { RegulatoryComplianceAttentionSummary } from "@/lib/sanitario/compliance/complianceAttention";
import { formatAgendaTypeLabel } from "@/pages/Agenda/helpers/formatting";
import {
  getAnimalQuickFilterLabel,
  getCalendarAnchorQuickFilterLabel,
  getCalendarModeQuickFilterLabel,
  getScheduleQuickFilterLabel,
} from "@/pages/Agenda/helpers/quickFilters";
import type {
  AgendaCalendarAnchorQuickFilter,
  AgendaCalendarModeQuickFilter,
  AgendaScheduleQuickFilter,
  AnimalQuickFilter,
  GroupMode,
  QuickFilterTone,
} from "@/pages/Agenda/types";

export type AgendaOverviewBadge = {
  key: string;
  label: string;
  tone: QuickFilterTone;
};

export type AgendaLifecyclePanelItem = {
  animalId: string;
  identificacao: string;
  kindLabel: string;
  kindTone: "warning" | "info";
  autoApplyLabel: string;
  autoApplyTone: "info" | "warning";
  stageLabel: string;
  loteNome: string;
  reason: string;
};

type AgendaLifecycleQueueItem = PendingAnimalLifecycleTransition & {
  loteNome: string;
};

export type AgendaPageSummaryFilters = {
  search: string;
  statusFilter: string;
  dominioFilter: string;
  dateFrom: string;
  dateTo: string;
  groupMode: GroupMode;
  quickTypeFilter: string;
  quickScheduleFilter: AgendaScheduleQuickFilter;
  quickCalendarModeFilter: AgendaCalendarModeQuickFilter;
  quickCalendarAnchorFilter: AgendaCalendarAnchorQuickFilter;
  quickAnimalFilter: AnimalQuickFilter;
};

export type AgendaPageSummariesInput = {
  filteredLength: number;
  filters: AgendaPageSummaryFilters;
  complianceSummary: Pick<
    RegulatoryComplianceAttentionSummary,
    "badges" | "openCount"
  >;
  lifecycleSummary: Pick<
    PendingAnimalLifecycleSummary,
    "total" | "strategic" | "biological"
  >;
  lifecycleQueue: AgendaLifecycleQueueItem[];
};

export function hasAgendaPageActiveFilters(filters: AgendaPageSummaryFilters) {
  return (
    filters.search.trim().length > 0 ||
    filters.statusFilter !== "all" ||
    filters.dominioFilter !== "all" ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0 ||
    filters.groupMode !== "animal" ||
    filters.quickTypeFilter !== "all" ||
    filters.quickScheduleFilter !== "all" ||
    filters.quickCalendarModeFilter !== "all" ||
    filters.quickCalendarAnchorFilter !== "all" ||
    filters.quickAnimalFilter !== "all"
  );
}

export function buildAgendaLifecyclePanelItems(
  lifecycleQueue: AgendaLifecycleQueueItem[],
): AgendaLifecyclePanelItem[] {
  return lifecycleQueue.slice(0, 4).map((item) => ({
    animalId: item.animalId,
    identificacao: item.identificacao,
    kindLabel: getPendingAnimalLifecycleKindLabel(item.queueKind),
    kindTone: item.queueKind === "decisao_estrategica" ? "warning" : "info",
    autoApplyLabel: item.canAutoApply ? "Auto/híbrido" : "Manual",
    autoApplyTone: item.canAutoApply ? "info" : "warning",
    stageLabel: `${getAnimalLifeStageLabel(item.currentStage)} para ${getAnimalLifeStageLabel(item.targetStage)}`,
    loteNome: item.loteNome,
    reason: item.reason,
  }));
}

export function buildAgendaOverviewBadges({
  filteredLength,
  filters,
  complianceSummary,
  lifecycleSummary,
}: Omit<AgendaPageSummariesInput, "lifecycleQueue">): AgendaOverviewBadge[] {
  const hasActiveFilters = hasAgendaPageActiveFilters(filters);
  const badges: AgendaOverviewBadge[] = [
    {
      key: "recorte",
      label: `${filteredLength} item(ns) no recorte`,
      tone: "neutral",
    },
  ];

  if (hasActiveFilters) {
    badges.push({ key: "filters", label: "Filtros ativos", tone: "info" });
  }
  if (filters.quickTypeFilter !== "all") {
    badges.push({
      key: "quick-type",
      label: `Tipo: ${formatAgendaTypeLabel(filters.quickTypeFilter)}`,
      tone: "info",
    });
  }
  if (filters.quickScheduleFilter !== "all") {
    badges.push({
      key: "quick-schedule",
      label: `Prazo: ${getScheduleQuickFilterLabel(filters.quickScheduleFilter)}`,
      tone: "info",
    });
  }
  if (filters.quickCalendarModeFilter !== "all") {
    badges.push({
      key: "quick-calendar-mode",
      label: `Calendário: ${getCalendarModeQuickFilterLabel(filters.quickCalendarModeFilter)}`,
      tone: "info",
    });
  }
  if (filters.quickCalendarAnchorFilter !== "all") {
    badges.push({
      key: "quick-calendar-anchor",
      label: `Âncora: ${getCalendarAnchorQuickFilterLabel(filters.quickCalendarAnchorFilter)}`,
      tone: "info",
    });
  }
  if (filters.quickAnimalFilter !== "all") {
    badges.push({
      key: "quick-animal",
      label: `Animal: ${getAnimalQuickFilterLabel(filters.quickAnimalFilter)}`,
      tone: "info",
    });
  }

  for (const badge of complianceSummary.badges) {
    badges.push({
      key: `compliance-${badge.key}`,
      label: `${badge.label} ${badge.count}`,
      tone: badge.tone,
    });
  }

  if (lifecycleSummary.total > 0) {
    badges.push({
      key: "lifecycle",
      label: `${lifecycleSummary.total} transição(ões) no radar`,
      tone: "warning",
    });
  }

  return badges;
}

export function buildAgendaPageSummaries(input: AgendaPageSummariesInput) {
  return {
    hasActiveFilters: hasAgendaPageActiveFilters(input.filters),
    hasComplianceAttention: input.complianceSummary.openCount > 0,
    showLifecyclePanel: input.lifecycleSummary.total > 0,
    lifecyclePanelItems: buildAgendaLifecyclePanelItems(input.lifecycleQueue),
    overviewBadges: buildAgendaOverviewBadges(input),
  };
}
