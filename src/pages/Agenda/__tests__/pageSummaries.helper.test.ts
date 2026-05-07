import { describe, expect, it } from "vitest";

import {
  buildAgendaLifecyclePanelItems,
  buildAgendaOverviewBadges,
  buildAgendaPageSummaries,
  type AgendaPageSummaryFilters,
} from "@/pages/Agenda/helpers/pageSummaries";
import type {
  PendingAnimalLifecycleSummary,
  PendingAnimalLifecycleTransition,
} from "@/lib/animals/lifecycle";
import type { RegulatoryComplianceAttentionSummary } from "@/lib/sanitario/compliance/complianceAttention";

const DEFAULT_FILTERS: AgendaPageSummaryFilters = {
  search: "",
  statusFilter: "all",
  dominioFilter: "all",
  dateFrom: "",
  dateTo: "",
  groupMode: "animal",
  quickTypeFilter: "all",
  quickScheduleFilter: "all",
  quickCalendarModeFilter: "all",
  quickCalendarAnchorFilter: "all",
  quickAnimalFilter: "all",
};

const EMPTY_COMPLIANCE_SUMMARY = {
  badges: [],
  openCount: 0,
} satisfies Pick<RegulatoryComplianceAttentionSummary, "badges" | "openCount">;

const EMPTY_LIFECYCLE_SUMMARY = {
  total: 0,
  strategic: 0,
  biological: 0,
} satisfies Pick<
  PendingAnimalLifecycleSummary,
  "total" | "strategic" | "biological"
>;

function createLifecycleItem(
  overrides: Partial<PendingAnimalLifecycleTransition & { loteNome: string }> = {},
): PendingAnimalLifecycleTransition & { loteNome: string } {
  return {
    animalId: "animal-1",
    identificacao: "Matriz 001",
    currentStage: "novilha",
    targetStage: "vaca_adulta",
    queueKind: "decisao_estrategica",
    transitionMode: "manual",
    suggestionKind: "transition",
    canAutoApply: false,
    reason: "Atingiu limiar de idade.",
    loteNome: "Lote A",
    ...overrides,
  };
}

describe("agenda page summaries", () => {
  it("keeps overview badge order, counts and labels", () => {
    const badges = buildAgendaOverviewBadges({
      filteredLength: 7,
      filters: {
        ...DEFAULT_FILTERS,
        search: "matriz",
        quickTypeFilter: "vacinacao_pncebt",
        quickScheduleFilter: "overdue",
        quickCalendarModeFilter: "janela_etaria",
        quickCalendarAnchorFilter: "nascimento",
        quickAnimalFilter: "F",
      },
      complianceSummary: {
        openCount: 2,
        badges: [
          { key: "feed-ban", label: "Feed-ban", count: 2, tone: "danger" },
        ],
      },
      lifecycleSummary: {
        total: 3,
        strategic: 1,
        biological: 2,
      },
    });

    expect(badges.map((badge) => badge.key)).toEqual([
      "recorte",
      "filters",
      "quick-type",
      "quick-schedule",
      "quick-calendar-mode",
      "quick-calendar-anchor",
      "quick-animal",
      "compliance-feed-ban",
      "lifecycle",
    ]);
    expect(badges.map((badge) => badge.label)).toEqual([
      "7 item(ns) no recorte",
      "Filtros ativos",
      "Tipo: Vacinacao Pncebt",
      "Prazo: Atrasado",
      "Calendário: Janela etaria",
      "Âncora: Nascimento",
      "Animal: Fêmeas",
      "Feed-ban 2",
      "3 transição(ões) no radar",
    ]);
    expect(badges.at(-2)?.tone).toBe("danger");
    expect(badges.at(-1)?.tone).toBe("warning");
  });

  it("keeps lifecycle panel labels and limits the visual list to four items", () => {
    const items = buildAgendaLifecyclePanelItems([
      createLifecycleItem(),
      createLifecycleItem({
        animalId: "animal-2",
        identificacao: "Bezerra 002",
        queueKind: "marco_biologico",
        currentStage: "cria_aleitamento",
        targetStage: "desmamado",
        canAutoApply: true,
        loteNome: "Sem lote",
      }),
      createLifecycleItem({ animalId: "animal-3" }),
      createLifecycleItem({ animalId: "animal-4" }),
      createLifecycleItem({ animalId: "animal-5" }),
    ]);

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      animalId: "animal-1",
      identificacao: "Matriz 001",
      kindLabel: "Decisao estrategica",
      kindTone: "warning",
      autoApplyLabel: "Manual",
      autoApplyTone: "warning",
      stageLabel: "Novilha para Vaca adulta",
      loteNome: "Lote A",
    });
    expect(items[1]).toMatchObject({
      kindLabel: "Marco biologico",
      kindTone: "info",
      autoApplyLabel: "Auto/híbrido",
      autoApplyTone: "info",
      stageLabel: "Cria em aleitamento para Desmamado",
    });
  });

  it("keeps summary display flags", () => {
    const result = buildAgendaPageSummaries({
      filteredLength: 1,
      filters: { ...DEFAULT_FILTERS, groupMode: "evento" },
      complianceSummary: {
        openCount: 1,
        badges: [],
      },
      lifecycleSummary: {
        total: 1,
        strategic: 1,
        biological: 0,
      },
      lifecycleQueue: [createLifecycleItem()],
    });

    expect(result.hasActiveFilters).toBe(true);
    expect(result.hasComplianceAttention).toBe(true);
    expect(result.showLifecyclePanel).toBe(true);
    expect(result.lifecyclePanelItems).toHaveLength(1);
  });

  it("returns empty visual summaries when there is no data beyond the recorte badge", () => {
    const result = buildAgendaPageSummaries({
      filteredLength: 0,
      filters: DEFAULT_FILTERS,
      complianceSummary: EMPTY_COMPLIANCE_SUMMARY,
      lifecycleSummary: EMPTY_LIFECYCLE_SUMMARY,
      lifecycleQueue: [],
    });

    expect(result.hasActiveFilters).toBe(false);
    expect(result.hasComplianceAttention).toBe(false);
    expect(result.showLifecyclePanel).toBe(false);
    expect(result.lifecyclePanelItems).toEqual([]);
    expect(result.overviewBadges).toEqual([
      { key: "recorte", label: "0 item(ns) no recorte", tone: "neutral" },
    ]);
  });
});
