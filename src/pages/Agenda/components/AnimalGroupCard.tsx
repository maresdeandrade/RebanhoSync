import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildAgendaBadgeOverflowLayout } from "@/lib/agenda/badgeOverflow";
import { buildAgendaGroupRecommendation } from "@/lib/agenda/groupRecommendations";
import { getAnimalBreedLabel } from "@/lib/animals/catalogs";
import { cn } from "@/lib/utils";
import { getGroupVisibilityLabel, readString } from "@/pages/Agenda/helpers/formatting";
import { mapScheduleBadgeToQuickFilter } from "@/pages/Agenda/helpers/quickFilters";
import type { AgendaAnimalGroup, AgendaRow, AgendaScheduleQuickFilter, GroupMode } from "@/pages/Agenda/types";
import { AgendaGroupActions } from "@/pages/Agenda/components/AgendaGroupActions";
import { AgendaItemRowCard, type AgendaRowMeta } from "@/pages/Agenda/components/AgendaItemRowCard";
import { AgendaQuickFilterBadge } from "@/pages/Agenda/components/AgendaQuickFilterBadge";

type AnimalGroupCardProps = {
  group: AgendaAnimalGroup;
  contextualFocusGroupKey: string | null;
  contextualFocusRowId: string | null;
  contextualHighlightedRowIds: Set<string>;
  expandedGroupSet: Set<string>;
  revealedGroups: string[];
  hasQuickFiltersActive: boolean;
  complianceGroupBadge: { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" } | null;
  quickScheduleFilter: AgendaScheduleQuickFilter;
  quickTypeFilter: string;
  onAnimalSummaryBadgeClick: (groupKey: string, rows: AgendaRow[], badgeKey: string) => void;
  onToggleGroupExpanded: (mode: GroupMode, groupKey: string) => void;
  onToggleGroupReveal: (mode: GroupMode, groupKey: string) => void;
  onGoToRegistrar: (item: AgendaRow["item"]) => void;
  onUpdateStatus: (item: AgendaRow["item"], status: "concluido" | "cancelado") => void;
  onNavigateToEvent: (eventoId: string) => void;
  onNavigateToAnimal: (animalId: string) => void;
  renderRowMeta: (row: AgendaRow) => AgendaRowMeta;
  registerRowRef: (rowId: string, node: HTMLElement | null) => void;
};

function buildGroupStateKey(mode: GroupMode, groupKey: string) {
  return `${mode}:${groupKey}`;
}

export function AnimalGroupCard({
  group,
  contextualFocusGroupKey,
  contextualFocusRowId,
  contextualHighlightedRowIds,
  expandedGroupSet,
  revealedGroups,
  hasQuickFiltersActive,
  complianceGroupBadge,
  quickScheduleFilter,
  quickTypeFilter,
  onAnimalSummaryBadgeClick,
  onToggleGroupExpanded,
  onToggleGroupReveal,
  onGoToRegistrar,
  onUpdateStatus,
  onNavigateToEvent,
  onNavigateToAnimal,
  renderRowMeta,
  registerRowRef,
}: AnimalGroupCardProps) {
  const categoriaZootecnica =
    readString(group.animal?.payload, "categoria_produtiva") ??
    readString(group.animal?.payload, "categoria") ??
    "N/D";
  const sexoLabel = group.animal?.sexo === "M" ? "Macho" : group.animal?.sexo === "F" ? "Femea" : "N/D";
  const raca = getAnimalBreedLabel(group.animal?.raca) ?? "N/D";
  const lote = group.rows[0]?.loteNome ?? "Sem lote";
  const idade = group.rows[0]?.idadeLabel ?? "idade n/d";
  const isContextualGroup = contextualFocusGroupKey === group.key;
  const groupStateKey = buildGroupStateKey("animal", group.key);
  const isExpanded = expandedGroupSet.has(groupStateKey);
  const isRevealed = revealedGroups.includes(groupStateKey);
  const displayedRows = hasQuickFiltersActive && !isRevealed ? group.visibleRows : group.rows;
  const canToggleReveal = hasQuickFiltersActive && group.visibleRows.length < group.rows.length;
  const recommendation = buildAgendaGroupRecommendation(displayedRows);
  const recommendedRow = recommendation
    ? displayedRows.find((row) => row.item.id === recommendation.rowId) ?? null
    : null;

  const badges = [...group.summary.typeBadges, ...group.summary.scheduleBadges];
  const compactLayout = buildAgendaBadgeOverflowLayout(badges, 3);

  return (
    <Card key={group.key} className={cn(isContextualGroup ? "border-info/25 shadow-sm shadow-info/10" : null)}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{group.title}</CardTitle>
              <StatusBadge tone="neutral">{getGroupVisibilityLabel(group.visibleRows.length, group.rows.length)}</StatusBadge>
              {complianceGroupBadge && group.sortMeta.pendingCount > 0 ? (
                <StatusBadge tone={complianceGroupBadge.tone}>{complianceGroupBadge.label}</StatusBadge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge, index) => {
                const scheduleFilter = mapScheduleBadgeToQuickFilter(badge.key);
                return (
                  <AgendaQuickFilterBadge
                    key={badge.key}
                    className={index >= compactLayout.visibleBadges.length ? "hidden sm:inline-flex" : undefined}
                    tone={badge.tone}
                    active={scheduleFilter ? quickScheduleFilter === scheduleFilter : quickTypeFilter === badge.key}
                    onClick={() => onAnimalSummaryBadgeClick(group.key, group.rows, badge.key)}
                  >
                    {badge.label} {badge.count}
                  </AgendaQuickFilterBadge>
                );
              })}
              {compactLayout.hiddenCount > 0 ? (
                <StatusBadge tone="neutral" className="sm:hidden">
                  +{compactLayout.hiddenCount}
                </StatusBadge>
              ) : null}
            </div>
            <CardDescription className="text-xs leading-5 sm:text-sm sm:leading-6">
              {sexoLabel} | {idade} | {lote} | {raca} | {categoriaZootecnica}
            </CardDescription>
            {recommendation ? (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <StatusBadge tone={recommendation.tone}>{recommendation.urgencyLabel}</StatusBadge>
                <p className="text-muted-foreground">
                  Proxima acao: <span className="font-medium text-foreground">{recommendation.actionLabel}</span>
                </p>
              </div>
            ) : null}
          </div>
          <AgendaGroupActions
            mode="animal"
            groupKey={group.key}
            groupTitle={group.title}
            isExpanded={isExpanded}
            isRevealed={isRevealed}
            canToggleReveal={canToggleReveal}
            recommendedRow={recommendedRow}
            onGoToRegistrar={onGoToRegistrar}
            onToggleGroupExpanded={onToggleGroupExpanded}
            onToggleGroupReveal={onToggleGroupReveal}
          />
        </div>
      </CardHeader>
      {isExpanded ? (
        <CardContent className="space-y-3">
          {displayedRows.map((row) => (
            <AgendaItemRowCard
              key={row.item.id}
              row={row}
              isContextualMatch={contextualHighlightedRowIds.has(row.item.id)}
              isContextualFocusRow={contextualFocusRowId === row.item.id}
              onGoToRegistrar={onGoToRegistrar}
              onUpdateStatus={onUpdateStatus}
              onNavigateToEvent={onNavigateToEvent}
              onNavigateToAnimal={onNavigateToAnimal}
              renderRowMeta={renderRowMeta}
              registerRowRef={registerRowRef}
            />
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
