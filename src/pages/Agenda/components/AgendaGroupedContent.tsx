import { ClipboardCheck } from "lucide-react";

import type { AgendaCriticalNavigationTarget } from "@/lib/agenda/criticalNavigation";
import type {
  AgendaAnimalGroup,
  AgendaContextualFocus,
  AgendaEventGroup,
  AgendaRow,
  AgendaScheduleQuickFilter,
  AnimalQuickFilter,
  GroupMode,
} from "@/pages/Agenda/types";
import { AnimalGroupCard } from "@/pages/Agenda/components/AnimalGroupCard";
import { EventGroupCard } from "@/pages/Agenda/components/EventGroupCard";
import type { AgendaRowMeta } from "@/pages/Agenda/components/AgendaItemRowCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

type AgendaGroupedContentProps = {
  filteredLength: number;
  groupMode: GroupMode;
  groupedByAnimal: AgendaAnimalGroup[];
  groupedByEvent: AgendaEventGroup[];
  expandedGroupSet: Set<string>;
  revealedGroups: string[];
  contextualFocus: AgendaContextualFocus | null;
  contextualHighlightedRowIds: Set<string>;
  hasQuickFiltersActive: boolean;
  complianceGroupBadge: { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" } | null;
  quickScheduleFilter: AgendaScheduleQuickFilter;
  quickTypeFilter: string;
  quickAnimalFilter: AnimalQuickFilter;
  criticalTargets: AgendaCriticalNavigationTarget<AgendaRow>[];
  currentCriticalTarget: AgendaCriticalNavigationTarget<AgendaRow> | null;
  onNavigateCriticalGroup: (direction: "next" | "previous") => void;
  onToggleGroupExpanded: (mode: GroupMode, groupKey: string) => void;
  onToggleGroupReveal: (mode: GroupMode, groupKey: string) => void;
  onAnimalSummaryBadgeClick: (groupKey: string, rows: AgendaRow[], badgeKey: string) => void;
  onEventSummaryBadgeClick: (groupKey: string, rows: AgendaRow[], badgeKey: string) => void;
  onGoToRegistrar: (item: AgendaRow["item"]) => void;
  onUpdateStatus: (item: AgendaRow["item"], status: "concluido" | "cancelado") => void;
  onNavigateToEvent: (eventoId: string) => void;
  onNavigateToAnimal: (animalId: string) => void;
  renderRowMeta: (row: AgendaRow) => AgendaRowMeta;
  registerRowRef: (rowId: string, node: HTMLElement | null) => void;
};

export function AgendaGroupedContent({
  filteredLength,
  groupMode,
  groupedByAnimal,
  groupedByEvent,
  expandedGroupSet,
  revealedGroups,
  contextualFocus,
  contextualHighlightedRowIds,
  hasQuickFiltersActive,
  complianceGroupBadge,
  quickScheduleFilter,
  quickTypeFilter,
  quickAnimalFilter,
  criticalTargets,
  currentCriticalTarget,
  onNavigateCriticalGroup,
  onToggleGroupExpanded,
  onToggleGroupReveal,
  onAnimalSummaryBadgeClick,
  onEventSummaryBadgeClick,
  onGoToRegistrar,
  onUpdateStatus,
  onNavigateToEvent,
  onNavigateToAnimal,
  renderRowMeta,
  registerRowRef,
}: AgendaGroupedContentProps) {
  return (
    <>
      {criticalTargets.length > 0 ? (
        <Card className="border-destructive/15 bg-destructive/5 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="danger">{criticalTargets.length} grupo(s) atrasado(s)</StatusBadge>
                {currentCriticalTarget ? (
                  <StatusBadge tone="info">Foco: {currentCriticalTarget.groupTitle}</StatusBadge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Use os atalhos para saltar entre os grupos mais urgentes do recorte atual.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onNavigateCriticalGroup("previous")}>
                Critico anterior
              </Button>
              <Button type="button" size="sm" onClick={() => onNavigateCriticalGroup("next")}>
                Proximo critico
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {filteredLength === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum item encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros para localizar tarefas da agenda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupMode === "animal"
            ? groupedByAnimal.map((group) => (
                <AnimalGroupCard
                  key={group.key}
                  group={group}
                  contextualFocusGroupKey={contextualFocus?.groupKey ?? null}
                  contextualFocusRowId={contextualFocus?.rowId ?? null}
                  contextualHighlightedRowIds={contextualHighlightedRowIds}
                  expandedGroupSet={expandedGroupSet}
                  revealedGroups={revealedGroups}
                  hasQuickFiltersActive={hasQuickFiltersActive}
                  complianceGroupBadge={complianceGroupBadge}
                  quickScheduleFilter={quickScheduleFilter}
                  quickTypeFilter={quickTypeFilter}
                  onAnimalSummaryBadgeClick={onAnimalSummaryBadgeClick}
                  onToggleGroupExpanded={onToggleGroupExpanded}
                  onToggleGroupReveal={onToggleGroupReveal}
                  onGoToRegistrar={onGoToRegistrar}
                  onUpdateStatus={onUpdateStatus}
                  onNavigateToEvent={onNavigateToEvent}
                  onNavigateToAnimal={onNavigateToAnimal}
                  renderRowMeta={renderRowMeta}
                  registerRowRef={registerRowRef}
                />
              ))
            : groupedByEvent.map((group) => (
                <EventGroupCard
                  key={group.key}
                  group={group}
                  contextualFocusGroupKey={contextualFocus?.groupKey ?? null}
                  contextualFocusRowId={contextualFocus?.rowId ?? null}
                  contextualHighlightedRowIds={contextualHighlightedRowIds}
                  expandedGroupSet={expandedGroupSet}
                  revealedGroups={revealedGroups}
                  hasQuickFiltersActive={hasQuickFiltersActive}
                  complianceGroupBadge={complianceGroupBadge}
                  quickAnimalFilter={quickAnimalFilter}
                  onEventSummaryBadgeClick={onEventSummaryBadgeClick}
                  onToggleGroupExpanded={onToggleGroupExpanded}
                  onToggleGroupReveal={onToggleGroupReveal}
                  onGoToRegistrar={onGoToRegistrar}
                  onUpdateStatus={onUpdateStatus}
                  onNavigateToEvent={onNavigateToEvent}
                  onNavigateToAnimal={onNavigateToAnimal}
                  renderRowMeta={renderRowMeta}
                  registerRowRef={registerRowRef}
                />
              ))}
        </div>
      )}
    </>
  );
}
