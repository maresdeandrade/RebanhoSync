import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Plus } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { useAuth } from "@/hooks/useAuth";
import { buildAgendaCriticalNavigationTargets } from "@/lib/agenda/criticalNavigation";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  summarizePendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import {
  getSyncStageLabel,
  getSyncStageTone,
} from "@/lib/offline/syncPresentation";
import { buildRegulatoryOperationalReadModel } from "@/lib/sanitario/regulatoryReadModel";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import {
  formatAgendaDate,
  formatAgendaTypeLabel,
  getAgendaStatusTone,
  readNumber,
  readString,
} from "@/pages/Agenda/helpers/formatting";
import {
  getAnimalQuickFilterLabel,
  getCalendarAnchorQuickFilterLabel,
  getCalendarModeQuickFilterLabel,
  getScheduleQuickFilterLabel,
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
import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";
import type { AgendaRow } from "@/pages/Agenda/types";
import { useAgendaShellState } from "@/pages/Agenda/useAgendaShellState";
import { useAgendaInteractionState } from "@/pages/Agenda/useAgendaInteractionState";
import { showError, showSuccess } from "@/utils/toast";

const DOMAIN_LABEL: Record<string, string> = {
  sanitario: "Sanitario",
  alerta_sanitario: "Alerta sanitario",
  conformidade: "Conformidade",
  pesagem: "Pesagem",
  movimentacao: "Movimentacao",
  nutricao: "Nutricao",
  financeiro: "Financeiro",
  reproducao: "Reproducao",
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluido",
  cancelado: "Cancelado",
};

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
    ).catch((error) => {
      console.warn("[agenda] failed to refresh agenda_itens", error);
      setRefreshError("Falha ao atualizar agenda local.");
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [activeFarmId]);

  const data = useLiveQuery(async () => {
    if (!activeFarmId) {
      return {
        itens: [],
        animais: [],
        lotes: [],
        protocolos: [],
        protocoloItens: [],
        gestos: [],
        sanidadeConfig: null,
        officialTemplates: [],
        officialTemplateItems: [],
      };
    }

    const [
      itens,
      animais,
      lotes,
      protocolos,
      protocoloItens,
      gestos,
      sanidadeConfig,
      officialTemplates,
      officialTemplateItems,
    ] = await Promise.all([
      db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_protocolos_sanitarios
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_protocolos_sanitarios_itens
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_fazenda_sanidade_config.get(activeFarmId),
      db.catalog_protocolos_oficiais.toArray(),
      db.catalog_protocolos_oficiais_itens.toArray(),
    ]);

    return {
      itens: itens.filter((item) => !item.deleted_at),
      animais: animais.filter((animal) => !animal.deleted_at),
      lotes: lotes.filter((lote) => !lote.deleted_at),
      protocolos: protocolos.filter((protocolo) => !protocolo.deleted_at),
      protocoloItens: protocoloItens.filter((item) => !item.deleted_at),
      gestos,
      sanidadeConfig:
        sanidadeConfig && !sanidadeConfig.deleted_at ? sanidadeConfig : null,
      officialTemplates,
      officialTemplateItems,
    };
  }, [activeFarmId]);

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

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    dominioFilter !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    groupMode !== "animal" ||
    quickTypeFilter !== "all" ||
    quickScheduleFilter !== "all" ||
    quickCalendarModeFilter !== "all" ||
    quickCalendarAnchorFilter !== "all" ||
    quickAnimalFilter !== "all";

  const hasComplianceAttention = complianceSummary.openCount > 0;
  const lifecyclePanelItems = useMemo(
    () =>
      lifecycleQueue.slice(0, 4).map((item) => ({
        animalId: item.animalId,
        identificacao: item.identificacao,
        kindLabel: getPendingAnimalLifecycleKindLabel(item.queueKind),
        kindTone: (item.queueKind === "decisao_estrategica"
          ? "warning"
          : "info") as "warning" | "info",
        autoApplyLabel: item.canAutoApply ? "Auto/hibrido" : "Manual",
        autoApplyTone: (item.canAutoApply ? "info" : "warning") as
          | "info"
          | "warning",
        stageLabel: `${getAnimalLifeStageLabel(item.currentStage)} para ${getAnimalLifeStageLabel(item.targetStage)}`,
        loteNome: item.loteNome,
        reason: item.reason,
      })),
    [lifecycleQueue],
  );
  const overviewBadges = useMemo(() => {
    const badges: Array<{
      key: string;
      label: string;
      tone: "neutral" | "info" | "success" | "warning" | "danger";
    }> = [
      {
        key: "recorte",
        label: `${filtered.length} item(ns) no recorte`,
        tone: "neutral",
      },
    ];

    if (hasActiveFilters)
      badges.push({ key: "filters", label: "Filtros ativos", tone: "info" });
    if (quickTypeFilter !== "all") {
      badges.push({
        key: "quick-type",
        label: `Tipo: ${formatAgendaTypeLabel(quickTypeFilter)}`,
        tone: "info",
      });
    }
    if (quickScheduleFilter !== "all") {
      badges.push({
        key: "quick-schedule",
        label: `Prazo: ${getScheduleQuickFilterLabel(quickScheduleFilter)}`,
        tone: "info",
      });
    }
    if (quickCalendarModeFilter !== "all") {
      badges.push({
        key: "quick-calendar-mode",
        label: `Calendario: ${getCalendarModeQuickFilterLabel(quickCalendarModeFilter)}`,
        tone: "info",
      });
    }
    if (quickCalendarAnchorFilter !== "all") {
      badges.push({
        key: "quick-calendar-anchor",
        label: `Ancora: ${getCalendarAnchorQuickFilterLabel(quickCalendarAnchorFilter)}`,
        tone: "info",
      });
    }
    if (quickAnimalFilter !== "all") {
      badges.push({
        key: "quick-animal",
        label: `Animal: ${getAnimalQuickFilterLabel(quickAnimalFilter)}`,
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
        label: `${lifecycleSummary.total} transicao(oes) no radar`,
        tone: "warning",
      });
    }

    return badges;
  }, [
    complianceSummary.badges,
    filtered.length,
    hasActiveFilters,
    lifecycleSummary.total,
    quickAnimalFilter,
    quickCalendarAnchorFilter,
    quickCalendarModeFilter,
    quickScheduleFilter,
    quickTypeFilter,
  ]);

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

  const renderRowMeta = (row: AgendaRow) => {
    const indicacao =
      readString(row.item.source_ref, "indicacao") ??
      (readNumber(row.item.source_ref, "dose_num")
        ? `Dose ${readNumber(row.item.source_ref, "dose_num")}`
        : "Aplicacao conforme protocolo");

    return {
      dateLabel: formatAgendaDate(row.item.data_prevista),
      statusLabel: STATUS_LABEL[row.item.status] ?? row.item.status,
      statusTone: getAgendaStatusTone(row.item.status),
      syncLabel: getSyncStageLabel(row.syncStage),
      syncTone: getSyncStageTone(row.syncStage),
      indicacao,
      domainLabel: DOMAIN_LABEL[row.item.dominio] ?? row.item.dominio,
    };
  };

  if (!activeFarmId) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rotina planejada"
          title="Fazenda nao selecionada"
          description="Selecione uma fazenda para abrir a agenda operacional."
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
          description="Carregando itens manuais e automaticos da rotina."
          actions={
            <Button size="sm" onClick={() => navigate("/registrar")}>
              <Plus className="h-4 w-4" />
              Abrir registro
            </Button>
          }
        />

        <EmptyState
          icon={Calendar}
          title="Carregando agenda"
          description="Estamos preparando o recorte operacional desta fazenda."
          action={{
            label: "Abrir registro",
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

      {lifecycleSummary.total > 0 ? (
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
              ? "A agenda ainda nao tem tarefas abertas, mas o overlay regulatorio da fazenda segue com pendencias operacionais."
              : "A agenda ainda nao tem tarefas abertas. Registre eventos ou ative protocolos para alimentar a rotina."
          }
          action={{
            label: hasComplianceAttention
              ? "Abrir protocolos"
              : "Abrir registro",
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
            renderRowMeta={renderRowMeta}
            registerRowRef={registerRowRef}
          />
        </>
      )}
    </div>
  );
}
