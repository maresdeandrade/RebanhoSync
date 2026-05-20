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
      className="flex flex-wrap items-center gap-2"
    >
      <StatusBadge tone={agendado > 0 ? "warning" : "neutral"}>
        <span>Agendados</span>
        <span>{agendado}</span>
      </StatusBadge>
      <StatusBadge tone="success">
        <span>Concluídos</span>
        <span>{concluido}</span>
      </StatusBadge>
      <StatusBadge tone={cancelado > 0 ? "danger" : "neutral"}>
        <span>Cancelados</span>
        <span>{cancelado}</span>
      </StatusBadge>
    </section>
  );
}

