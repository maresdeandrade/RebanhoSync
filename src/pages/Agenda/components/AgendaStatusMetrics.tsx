import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

type AgendaStatusMetricsProps = {
  agendado: number;
  concluido: number;
  cancelado: number;
};

export function AgendaStatusMetrics({
  agendado,
  concluido,
  cancelado,
}: AgendaStatusMetricsProps) {
  return (
    <section aria-label="Resumo da agenda" className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="min-w-0 border-warning/25 bg-warning-muted/30 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 text-xs font-medium sm:text-sm">Agendados</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{agendado}</p>
        </Card>
        <Card className="min-w-0 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 text-xs font-medium sm:text-sm">Concluídos</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{concluido}</p>
        </Card>
        <Card className="min-w-0 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 text-xs font-medium sm:text-sm">Cancelados</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{cancelado}</p>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Status das tarefas no recorte atual. Concluir uma tarefa não comprova execução de manejo.
      </p>
    </section>
  );
}
