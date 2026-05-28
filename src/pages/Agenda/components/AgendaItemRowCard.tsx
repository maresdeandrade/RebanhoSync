import { MoreHorizontal, ChevronDown, ChevronUp, Calendar, Info, Beaker, MapPin, Tag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import { cn } from "@/lib/utils";
import type { AgendaRow } from "@/pages/Agenda/types";

export type AgendaRowMeta = {
  dateLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning" | "danger";
  syncLabel: string;
  syncTone: "neutral" | "info" | "success" | "warning" | "danger";
  indicacao: string;
  domainLabel: string;
};

type AgendaItemRowCardProps = {
  row: AgendaRow;
  isContextualMatch: boolean;
  isContextualFocusRow: boolean;
  onGoToRegistrar: (item: AgendaRow["item"]) => void;
  onUpdateStatus: (item: AgendaRow["item"], status: "concluido" | "cancelado") => void;
  onNavigateToEvent: (eventoId: string) => void;
  onNavigateToAnimal: (animalId: string) => void;
  renderRowMeta: (row: AgendaRow) => AgendaRowMeta;
  registerRowRef: (rowId: string, node: HTMLElement | null) => void;
};

export function AgendaItemRowCard({
  row,
  isContextualMatch,
  isContextualFocusRow,
  onGoToRegistrar,
  onUpdateStatus,
  onNavigateToEvent,
  onNavigateToAnimal,
  renderRowMeta,
  registerRowRef,
}: AgendaItemRowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rowMeta = renderRowMeta(row);
  const isScheduled = row.item.status === "agendado";
  const isCalfJourney = isCalfJourneyAgendaItem(row.item);
  const isSanitary = row.item.dominio === "sanitario";
  const canDirectComplete = isScheduled && !isCalfJourney;

  const registerCtaLabel = isCalfJourney
    ? "Seguir rotina da cria"
    : "Revisar no Registrar";
  const directCompleteLabel = isSanitary
    ? "Concluir tarefa"
    : "Concluir";
  
  const nextStepHint = isCalfJourney
    ? "Próximo passo: seguir a rotina guiada da cria."
    : isSanitary
      ? "Próximo passo: usar Registrar para revisar dados ou Concluir para gerar evento sanitário."
      : "Próximo passo: usar Registrar para gravar a execução completa; Concluir apenas fecha a pendência.";

  return (
    <article
      ref={(node) => registerRowRef(row.item.id, node)}
      tabIndex={-1}
      className={cn(
        "scroll-mt-24 rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/25 shadow-sm",
        isContextualMatch ? "border-info/30 bg-info-muted/10" : null,
        isContextualFocusRow ? "ring-2 ring-info/25 ring-offset-2 ring-offset-background" : null,
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Header: Tipo e Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-bold text-base capitalize leading-tight">
              {row.item.tipo.replaceAll("_", " ")}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="neutral" className="h-5 px-1.5 text-[10px] uppercase font-semibold">
                {rowMeta.domainLabel}
              </StatusBadge>
              {row.priority ? (
                <StatusBadge tone={row.priority.tone} className="h-5 px-1.5 text-[10px] uppercase font-semibold">
                  {row.priority.label}
                </StatusBadge>
              ) : null}
              <StatusBadge tone={rowMeta.statusTone} className="h-5 px-1.5 text-[10px] uppercase font-semibold">
                {rowMeta.statusLabel}
              </StatusBadge>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label={`Mais ações para o item ${row.item.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canDirectComplete ? (
                  <DropdownMenuItem onClick={() => onUpdateStatus(row.item, "concluido")}>
                    {directCompleteLabel}
                  </DropdownMenuItem>
                ) : null}
                {isScheduled ? (
                  <DropdownMenuItem onClick={() => onUpdateStatus(row.item, "cancelado")} className="text-destructive">
                    Cancelar tarefa
                  </DropdownMenuItem>
                ) : null}
                {row.item.source_evento_id ? (
                  <DropdownMenuItem onClick={() => onNavigateToEvent(row.item.source_evento_id!)}>Ver evento original</DropdownMenuItem>
                ) : null}
                {row.item.animal_id ? (
                  <DropdownMenuItem onClick={() => onNavigateToAnimal(row.item.animal_id!)}>
                    Abrir ficha do animal
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Info Principal: Animal e Data */}
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{row.animalNome} <span className="text-muted-foreground font-normal">({row.idadeLabel})</span></span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{row.loteNome}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className={cn(rowMeta.statusTone === "warning" || rowMeta.statusTone === "danger" ? "text-orange-600 font-medium" : "")}>
              {rowMeta.dateLabel}
            </span>
          </div>
        </div>

        {/* Detalhes do Manejo */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <Beaker className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Produto: </span>
              <span className="font-medium">{row.produtoLabel}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Indicação: </span>
              <span className="font-medium">{rowMeta.indicacao}</span>
            </div>
          </div>
        </div>

        {/* Progressive Disclosure: Metadados Técnicos */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-full justify-between px-2 text-xs text-muted-foreground hover:text-foreground">
              <span>{isExpanded ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}</span>
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 border-t border-border/50 mt-2">
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {row.scheduleLabel && (
                <p>Periodicidade: <span className="text-foreground">{row.scheduleLabel}</span></p>
              )}
              {row.scheduleAnchorLabel && (
                <p>Âncora: <span className="text-foreground">{row.scheduleAnchorLabel}</span></p>
              )}
              <p>Origem: <span className="text-foreground">{row.item.source_kind}</span></p>
              {row.protocol && (
                <p>Protocolo: <span className="text-foreground">{row.protocol.nome}</span></p>
              )}
              <p>ID: <span className="text-foreground font-mono">{row.item.id.slice(0, 8)}...</span></p>
              <StatusBadge tone={rowMeta.syncTone} className="h-4 px-1 text-[9px] w-fit">
                {rowMeta.syncLabel}
              </StatusBadge>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Ações Primárias */}
        {isScheduled && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button 
              size="sm" 
              className="flex-1 font-semibold" 
              onClick={() => onGoToRegistrar(row.item)}
            >
              {registerCtaLabel}
            </Button>
            {canDirectComplete && (
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1" 
                onClick={() => onUpdateStatus(row.item, "concluido")}
              >
                {directCompleteLabel}
              </Button>
            )}
          </div>
        )}
        
        {isScheduled && (
          <p className="text-[10px] text-center text-muted-foreground italic">
            {nextStepHint}
          </p>
        )}
      </div>
    </article>
  );
}
