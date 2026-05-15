import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Plus } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { useAuth } from "@/hooks/useAuth";
import { buildAgendaCriticalNavigationTargets } from "@/lib/agenda/criticalNavigation";
import {
  getPendingAnimalLifecycleTransitions,
  summarizePendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import { buildRegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/infrastructure/service";
import {
  parseAgendaDominioFilter,
  parseCalendarAnchorQuickFilter,
  parseCalendarModeQuickFilter,
} from "@/pages/Agenda/helpers/quickFilters";
import { AgendaComplianceSummaryPanel } from "@/pages/Agenda/components/AgendaComplianceSummaryPanel";
import { AgendaFiltersToolbar } from "@/pages/Agenda/components/AgendaFiltersToolbar";
import { AgendaGroupedContent } from "@/pages/Agenda/components/AgendaGroupedContent";
import { AgendaLifecycleSummaryPanel } from "@/pages/Agenda/components/AgendaLifecycleSummaryPanel";
import { AgendaOverviewHeader } from "@/pages/Agenda/components/AgendaOverviewHeader";
import { AgendaStatusMetrics } from "@/pages/Agenda/components/AgendaStatusMetrics";
import {
  applyAgendaQuickFilters,
  buildAgendaBaseRows,
  groupAgendaRowsByAnimal,
  groupAgendaRowsByEvent,
  hasAgendaQuickFiltersActive,
  summarizeAgendaRowsByStatus,
} from "@/pages/Agenda/helpers/derivations";
import { buildAgendaPageSummaries } from "@/pages/Agenda/helpers/pageSummaries";
import { buildAgendaRowMeta } from "@/pages/Agenda/helpers/rowMeta";
import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";
import { useAgendaPageData } from "@/pages/Agenda/useAgendaPageData";
import { useAgendaShellState } from "@/pages/Agenda/useAgendaShellState";
import { useAgendaInteractionState } from "@/pages/Agenda/useAgendaInteractionState";
import { showError, showSuccess } from "@/utils/toast";

export default function Agenda() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFarmId, farmLifecycleConfig, user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const queryCalendarModeFilter = parseCalendarModeQuickFilter(
    searchParams.get("calendarMode"),
  );
  const queryCalendarAnchorFilter = parseCalendarAnchorQuickFilter(
    searchParams.get("calendarAnchor"),
  );
  const queryDominioFilter = parseAgendaDominioFilter(
    searchParams.get("dominio"),
  );
  const {
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
    resetFilters,
    clearContextualState,
    ensureGroupExpanded,
    toggleGroupExpanded,
    toggleGroupReveal,
    applyContextualFocus,
  } = useAgendaShellState({
    activeFarmId,
    userId: user?.id,
    queryCalendarModeFilter,
    queryCalendarAnchorFilter,
    queryDominioFilter,
  });

  useEffect(() => {
    if (!activeFarmId) return;

    setIsRefreshing(true);
    setRefreshError(null);
    pullDataForFarm(
      activeFarmId,
      [
        "agenda_itens",
        "animais",
        "lotes",
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      {
        mode: "merge",
      },
    )
      .catch((error) => {
        console.warn("[agenda] failed to refresh agenda_itens", error);
        setRefreshError("Falha ao atualizar agenda local.");
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [activeFarmId]);

  const data = useAgendaPageData(activeFarmId);

  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel({
        config: data?.sanidadeConfig ?? null,
        templates: data?.officialTemplates ?? [],
        items: data?.officialTemplateItems ?? [],
      }),
    [data],
  );

  const complianceSummary = regulatoryReadModel.attention;

  const baseRows = useMemo(
    () =>
      buildAgendaBaseRows(data, {
        search,
        statusFilter,
        dominioFilter,
        dateFrom,
        dateTo,
      }),
    [data, dateFrom, dateTo, dominioFilter, search, statusFilter],
  );

  const filtered = useMemo(
    () =>
      applyAgendaQuickFilters(baseRows, {
        quickTypeFilter,
        quickScheduleFilter,
        quickCalendarModeFilter,
        quickCalendarAnchorFilter,
        quickAnimalFilter,
      }),
    [
      baseRows,
      quickCalendarModeFilter,
      quickCalendarAnchorFilter,
      quickAnimalFilter,
      quickScheduleFilter,
      quickTypeFilter,
    ],
  );

  const hasQuickFiltersActive = hasAgendaQuickFiltersActive({
    quickTypeFilter,
    quickScheduleFilter,
    quickCalendarModeFilter,
    quickCalendarAnchorFilter,
    quickAnimalFilter,
  });

  const expandedGroupSet = useMemo(
    () => new Set(expandedGroups),
    [expandedGroups],
  );

  const lifecycleQueue = useMemo(() => {
    if (!data) return [];

    return getPendingAnimalLifecycleTransitions(
      data.animais.filter((animal) => animal.status === "ativo"),
      farmLifecycleConfig,
    ).map((item) => {
      const animal =
        data.animais.find((entry) => entry.id === item.animalId) ?? null;
      const lote = animal?.lote_id
        ? (data.lotes.find((entry) => entry.id === animal.lote_id) ?? null)
        : null;

      return {
        ...item,
        loteNome: lote?.nome ?? "Sem lote",
      };
    });
  }, [data, farmLifecycleConfig]);

  const lifecycleSummary = useMemo(
    () => summarizePendingAnimalLifecycleTransitions(lifecycleQueue),
    [lifecycleQueue],
  );

  const groupedByAnimal = useMemo(
    () =>
      groupAgendaRowsByAnimal({
        baseRows,
        filteredRows: filtered,
        hasQuickFiltersActive,
      }),
    [baseRows, filtered, hasQuickFiltersActive],
  );

  const groupedByEvent = useMemo(
    () =>
      groupAgendaRowsByEvent({
        baseRows,
        filteredRows: filtered,
        hasQuickFiltersActive,
      }),
    [baseRows, filtered, hasQuickFiltersActive],
  );

  const counts = useMemo(
    () => summarizeAgendaRowsByStatus(filtered),
    [filtered],
  );

  const pageSummaries = useMemo(
    () =>
      buildAgendaPageSummaries({
        filteredLength: filtered.length,
        filters: {
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
        },
        complianceSummary,
        lifecycleSummary,
        lifecycleQueue,
      }),
    [
      complianceSummary,
      dateFrom,
      dateTo,
      dominioFilter,
      filtered.length,
      groupMode,
      lifecycleQueue,
      lifecycleSummary,
      quickAnimalFilter,
      quickCalendarAnchorFilter,
      quickCalendarModeFilter,
      quickScheduleFilter,
      quickTypeFilter,
      search,
      statusFilter,
    ],
  );

  const {
    hasComplianceAttention,
    lifecyclePanelItems,
    overviewBadges,
    showLifecyclePanel,
  } = pageSummaries;

  const criticalTargets = useMemo(
    () =>
      groupMode === "animal"
        ? buildAgendaCriticalNavigationTargets(
            groupedByAnimal.map((group) => ({
              key: group.key,
              title: group.title,
              rows: group.visibleRows,
            })),
          )
        : buildAgendaCriticalNavigationTargets(
            groupedByEvent.map((group) => ({
              key: group.key,
              title: group.title,
              rows: group.visibleRows,
            })),
          ),
    [groupMode, groupedByAnimal, groupedByEvent],
  );

  const currentCriticalTarget = useMemo(
    () =>
      criticalTargets.find(
        (entry) => entry.groupKey === contextualFocus?.groupKey,
      ) ?? null,
    [contextualFocus?.groupKey, criticalTargets],
  );
  const actionController = useMemo(
    () =>
      createAgendaActionController({
        activeFarmId,
        navigate,
        createGesture,
        concludePendingSanitary: concluirPendenciaSanitaria,
        pullDataForFarm,
        getProtocolItemById: async (id) =>
          (await db.state_protocolos_sanitarios_itens.get(id)) ?? null,
        showError,
        showSuccess,
        nowIso: () => new Date().toISOString(),
        logError: (...args) => console.error(...args),
      }),
    [activeFarmId, navigate],
  );
  const {
    contextualHighlightedRowIds,
    registerRowRef,
    navigateCriticalGroup,
    handleAnimalSummaryBadgeClick,
    handleEventSummaryBadgeClick,
  } = useAgendaInteractionState({
    contextualFocus,
    filteredRows: filtered,
    criticalTargets,
    currentCriticalGroupKey: currentCriticalTarget?.groupKey ?? null,
    quickScheduleFilter,
    quickTypeFilter,
    quickAnimalFilter,
    setContextualFocus,
    setQuickScheduleFilter,
    setQuickTypeFilter,
    setQuickAnimalFilter,
    clearContextualState,
    applyContextualFocus,
  });

  if (!activeFarmId) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rotina planejada"
          title="Fazenda não selecionada"
          actions={
            <Button size="sm" onClick={() => navigate("/select-fazenda")}>
              Selecionar fazenda
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rotina planejada"
          title="Agenda de manejo"
          actions={
            <Button size="sm" onClick={() => navigate("/registrar")}>
              <Plus className="h-4 w-4" />
              Registrar
            </Button>
          }
        />

        <EmptyState
          icon={Calendar}
          title="Carregando agenda"
          action={{
            label: "Registrar",
            onClick: () => navigate("/registrar"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AgendaOverviewHeader
        badges={overviewBadges}
        onGoToRegistrar={() => navigate("/registrar")}
      />

      {isRefreshing ? (
        <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
          Atualizando dados locais da agenda...
        </div>
      ) : null}
      {refreshError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {refreshError}
        </div>
      ) : null}

      <AgendaStatusMetrics
        agendado={counts.agendado}
        concluido={counts.concluido}
        cancelado={counts.cancelado}
      />

      {hasComplianceAttention ? (
        <AgendaComplianceSummaryPanel
          openCount={complianceSummary.openCount}
          blockingCount={complianceSummary.blockingCount}
          badges={complianceSummary.badges}
          topItems={complianceSummary.topItems}
          onOpenComplianceOverlay={() => navigate("/protocolos-sanitarios")}
        />
      ) : null}

      {showLifecyclePanel ? (
        <AgendaLifecycleSummaryPanel
          total={lifecycleSummary.total}
          strategic={lifecycleSummary.strategic}
          biological={lifecycleSummary.biological}
          items={lifecyclePanelItems}
        />
      ) : null}

      {data.itens.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Agenda vazia"
          description={
            hasComplianceAttention
              ? "Ha pendencias de conformidade fora da agenda."
              : "Registre eventos ou ative protocolos para alimentar a rotina."
          }
          action={{
            label: hasComplianceAttention ? "Abrir protocolos" : "Registrar",
            onClick: () =>
              navigate(
                hasComplianceAttention
                  ? "/protocolos-sanitarios"
                  : "/registrar",
              ),
          }}
        />
      ) : null}

      {data.itens.length === 0 ? null : (
        <>
          <AgendaFiltersToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dominioFilter={dominioFilter}
            onDominioFilterChange={setDominioFilter}
            quickCalendarModeFilter={quickCalendarModeFilter}
            onQuickCalendarModeFilterChange={setQuickCalendarModeFilter}
            quickCalendarAnchorFilter={quickCalendarAnchorFilter}
            onQuickCalendarAnchorFilterChange={setQuickCalendarAnchorFilter}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            groupMode={groupMode}
            onGroupModeChange={setGroupMode}
            onClearFilters={resetFilters}
          />

          <AgendaGroupedContent
            filteredLength={filtered.length}
            groupMode={groupMode}
            groupedByAnimal={groupedByAnimal}
            groupedByEvent={groupedByEvent}
            expandedGroupSet={expandedGroupSet}
            revealedGroups={revealedGroups}
            contextualFocus={contextualFocus}
            contextualHighlightedRowIds={contextualHighlightedRowIds}
            hasQuickFiltersActive={hasQuickFiltersActive}
            complianceGroupBadge={complianceSummary.groupBadge}
            quickScheduleFilter={quickScheduleFilter}
            quickTypeFilter={quickTypeFilter}
            quickAnimalFilter={quickAnimalFilter}
            criticalTargets={criticalTargets}
            currentCriticalTarget={currentCriticalTarget}
            onNavigateCriticalGroup={navigateCriticalGroup}
            onToggleGroupExpanded={toggleGroupExpanded}
            onToggleGroupReveal={toggleGroupReveal}
            onAnimalSummaryBadgeClick={handleAnimalSummaryBadgeClick}
            onEventSummaryBadgeClick={handleEventSummaryBadgeClick}
            onGoToRegistrar={actionController.goToRegistrar}
            onUpdateStatus={actionController.updateStatus}
            onNavigateToEvent={actionController.goToEvent}
            onNavigateToAnimal={actionController.goToAnimal}
            renderRowMeta={buildAgendaRowMeta}
            registerRowRef={registerRowRef}
          />
        </>
      )}
    </div>
  );
}
