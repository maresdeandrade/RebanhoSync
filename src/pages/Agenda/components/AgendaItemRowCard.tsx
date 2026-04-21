import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
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
  const rowMeta = renderRowMeta(row);
  const isScheduled = row.item.status === "agendado";
  const isCalfJourney = isCalfJourneyAgendaItem(row.item);
  const isSanitary = row.item.dominio === "sanitario";
  const canDirectComplete = isScheduled && !isCalfJourney;

  const registerCtaLabel = isCalfJourney
    ? "Seguir rotina da cria"
    : "Registrar";
  const directCompleteLabel = isSanitary
    ? "Executar"
    : "Encerrar";
  const nextStepHint = isCalfJourney
    ? "Próximo passo: seguir a rotina guiada da cria."
    : isSanitary
      ? "Próximo passo: usar Registrar para revisar dados ou Executar para gerar evento sanitário."
      : "Próximo passo: usar Registrar para gravar a execução completa; Encerrar apenas fecha a pendência.";

  return (
    <article
      ref={(node) => registerRowRef(row.item.id, node)}
      tabIndex={-1}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border/70 bg-muted/30 p-4 transition-colors transition-shadow",
        isContextualMatch ? "border-info/30 bg-info-muted/30" : null,
        isContextualFocusRow ? "ring-2 ring-info/25 ring-offset-2 ring-offset-background" : null,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium capitalize">{row.item.tipo.replaceAll("_", " ")}</p>
            <StatusBadge tone="neutral">{rowMeta.domainLabel}</StatusBadge>
            {row.priority ? <StatusBadge tone={row.priority.tone}>{row.priority.label}</StatusBadge> : null}
            <StatusBadge tone={rowMeta.statusTone}>{rowMeta.statusLabel}</StatusBadge>
            <StatusBadge tone={rowMeta.syncTone}>{rowMeta.syncLabel}</StatusBadge>
            {row.scheduleModeLabel ? <StatusBadge tone="info">{row.scheduleModeLabel}</StatusBadge> : null}
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {rowMeta.dateLabel} | {row.animalNome} ({row.idadeLabel}) | {row.loteNome}
          </p>

          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p className="text-muted-foreground">
              Produto: <span className="font-medium text-foreground">{row.produtoLabel}</span>
            </p>
            {row.scheduleLabel ? (
              <p className="text-muted-foreground">
                Periodicidade: <span className="font-medium text-foreground">{row.scheduleLabel}</span>
              </p>
            ) : null}
            {row.scheduleAnchorLabel ? (
              <p className="text-muted-foreground">
                Âncora: <span className="font-medium text-foreground">{row.scheduleAnchorLabel}</span>
              </p>
            ) : null}
            <p className="text-muted-foreground">
              Indicação: <span className="font-medium text-foreground">{rowMeta.indicacao}</span>
            </p>
            <p className="text-muted-foreground">
              Origem: <span className="font-medium text-foreground">{row.item.source_kind}</span>
            </p>
            {row.priority ? (
              <p className="text-muted-foreground">
                Prioridade: <span className="font-medium text-foreground">{row.priority.label}</span>
              </p>
            ) : null}
          </div>
          {isScheduled ? (
            <p className="text-xs text-muted-foreground">{nextStepHint}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isScheduled ? (
            <Button size="sm" onClick={() => onGoToRegistrar(row.item)}>
              {registerCtaLabel}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
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
                <DropdownMenuItem onClick={() => onUpdateStatus(row.item, "cancelado")}>Cancelar</DropdownMenuItem>
              ) : null}
              {row.item.source_evento_id ? (
                <DropdownMenuItem onClick={() => onNavigateToEvent(row.item.source_evento_id!)}>Ver evento</DropdownMenuItem>
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
    </article>
  );
}
