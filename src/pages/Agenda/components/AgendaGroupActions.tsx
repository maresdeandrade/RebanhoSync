import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import type { AgendaRow, GroupMode } from "@/pages/Agenda/types";

function getCompactActionLabel(item: AgendaRow["item"]) {
  return isCalfJourneyAgendaItem(item) ? "Rotina da cria" : "Abrir acao";
}

type AgendaGroupActionsProps = {
  mode: GroupMode;
  groupKey: string;
  groupTitle: string;
  isExpanded: boolean;
  isRevealed: boolean;
  canToggleReveal: boolean;
  recommendedRow: AgendaRow | null;
  onGoToRegistrar: (item: AgendaRow["item"]) => void;
  onToggleGroupExpanded: (mode: GroupMode, groupKey: string) => void;
  onToggleGroupReveal: (mode: GroupMode, groupKey: string) => void;
};

export function AgendaGroupActions({
  mode,
  groupKey,
  groupTitle,
  isExpanded,
  isRevealed,
  canToggleReveal,
  recommendedRow,
  onGoToRegistrar,
  onToggleGroupExpanded,
  onToggleGroupReveal,
}: AgendaGroupActionsProps) {
  return (
    <>
      <div className="flex w-full items-center gap-2 sm:hidden">
        {recommendedRow ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 flex-1"
            onClick={() => onGoToRegistrar(recommendedRow.item)}
          >
            {getCompactActionLabel(recommendedRow.item)}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("shrink-0", recommendedRow ? null : "flex-1")}
          aria-expanded={isExpanded}
          onClick={() => onToggleGroupExpanded(mode, groupKey)}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {isExpanded ? "Ocultar" : "Itens"}
        </Button>
        {canToggleReveal ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="outline" aria-label={`Mais acoes para o grupo ${groupTitle}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggleGroupReveal(mode, groupKey)}>
                {isRevealed ? "Voltar ao recorte" : "Ver grupo completo"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="hidden flex-wrap justify-end gap-2 sm:flex">
        {recommendedRow ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onGoToRegistrar(recommendedRow.item)}
          >
            {isCalfJourneyAgendaItem(recommendedRow.item) ? "Abrir rotina da cria" : "Abrir proxima acao"}
          </Button>
        ) : null}
        {canToggleReveal ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onToggleGroupReveal(mode, groupKey)}
          >
            {isRevealed ? "Voltar ao recorte" : "Ver grupo completo"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={isExpanded}
          onClick={() => onToggleGroupExpanded(mode, groupKey)}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {isExpanded ? "Ocultar itens" : "Ver itens"}
        </Button>
      </div>
    </>
  );
}
