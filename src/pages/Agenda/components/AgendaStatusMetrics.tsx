import { MetricCard } from "@/components/ui/metric-card";

type AgendaStatusMetricsProps = {
  agendado: number;
  concluido: number;
  cancelado: number;
};

export function AgendaStatusMetrics({ agendado, concluido, cancelado }: AgendaStatusMetricsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Agendados"
        value={agendado}
        hint="Itens que ainda pedem acao."
        tone={agendado > 0 ? "warning" : "default"}
      />
      <MetricCard
        label="Concluidos"
        value={concluido}
        hint="Ja resolvidos no recorte atual."
        tone="success"
      />
      <MetricCard
        label="Cancelados"
        value={cancelado}
        hint="Itens encerrados sem execucao."
        tone={cancelado > 0 ? "danger" : "default"}
      />
    </section>
  );
}
