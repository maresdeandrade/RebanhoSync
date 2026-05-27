import { StatusBadge } from "@/components/ui/status-badge";

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
    <section
      aria-label="Resumo da agenda"
      className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center"
    >
      <StatusBadge tone={agendado > 0 ? "warning" : "neutral"} className="flex flex-col items-center justify-center py-2 sm:flex-row sm:gap-2 sm:py-1">
        <span className="text-[10px] uppercase tracking-wider opacity-70 sm:text-xs sm:normal-case sm:tracking-normal sm:opacity-100">Agendados</span>
        <span className="text-lg font-bold sm:text-sm sm:font-medium">{agendado}</span>
      </StatusBadge>
      <StatusBadge tone="success" className="flex flex-col items-center justify-center py-2 sm:flex-row sm:gap-2 sm:py-1">
        <span className="text-[10px] uppercase tracking-wider opacity-70 sm:text-xs sm:normal-case sm:tracking-normal sm:opacity-100">Concluídos</span>
        <span className="text-lg font-bold sm:text-sm sm:font-medium">{concluido}</span>
      </StatusBadge>
      <StatusBadge tone={cancelado > 0 ? "danger" : "neutral"} className="flex flex-col items-center justify-center py-2 sm:flex-row sm:gap-2 sm:py-1">
        <span className="text-[10px] uppercase tracking-wider opacity-70 sm:text-xs sm:normal-case sm:tracking-normal sm:opacity-100">Cancelados</span>
        <span className="text-lg font-bold sm:text-sm sm:font-medium">{cancelado}</span>
      </StatusBadge>
    </section>
  );
}
