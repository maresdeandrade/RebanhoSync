import { useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  TrendingUp,
  Weight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type {
  DataStatus,
  LoteOccupancyMetrics,
  PastoOccupancyMetrics,
} from "./occupancyTypes";

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  icon?: React.ReactNode;
  status?: DataStatus["status"];
  tooltip?: string;
  extraContent?: React.ReactNode;
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  status,
  tooltip,
  extraContent,
}: MetricCardProps) {
  const statusColor: Partial<Record<DataStatus["status"], string>> = {
    complete: "text-green-600",
    partial: "text-yellow-600",
    empty: "text-gray-400",
  };
  const statusIcon: Partial<Record<DataStatus["status"], React.ReactNode>> = {
    complete: <CheckCircle2 className="h-4 w-4" />,
    partial: <AlertCircle className="h-4 w-4" />,
    empty: <HelpCircle className="h-4 w-4" />,
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-gradient-to-br from-muted/40 to-muted/20 p-4 transition-all hover:border-border hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && <div className="text-primary/60">{icon}</div>}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
        {status && (
          <div
            className={`flex items-center gap-1 ${statusColor[status]}`}
            title={tooltip}
          >
            {statusIcon[status]}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-foreground">
        {value === null ? "—" : typeof value === "number" ? value.toFixed(2) : value}
        {value !== null && unit && <span className="text-sm font-medium text-muted-foreground ml-2">{unit}</span>}
      </p>
      {extraContent}
    </div>
  );
}

function getWeightStatusTooltip(status: DataStatus["status"]) {
  switch (status) {
    case "bloqueado":
      return "Conflito factual impede apresentar o GMD observado.";
    case "empty":
      return "Pesagens factuais insuficientes dentro da ocupação. GMD observado indisponível.";
    case "partial":
      return "GMD observado entre pesagens factuais dentro da ocupação; não representa toda a permanência.";
    default:
      return "GMD observado com cobertura factual dos limites da ocupação.";
  }
}

function getEccStatusTooltip(status: DataStatus["status"]) {
  switch (status) {
    case "empty":
      return "Sem avaliações de ECC factual registradas para este grupo.";
    case "partial":
      return "Cobertura de ECC parcial. Alguns animais não possuem ECC factual.";
    default:
      return "Cobertura completa. Todos os animais possuem ECC factual.";
  }
}

function formatMovementDate(dateStr: string | null) {
  if (!dateStr) return "Nenhum histórico";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    dateStyle: "short",
  });
}

function SemEccList({ animaisSemEcc }: { animaisSemEcc: string[] }) {
  const [showSemEcc, setShowSemEcc] = useState(false);

  if (animaisSemEcc.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/40 text-xs">
      <button
        onClick={() => setShowSemEcc((current) => !current)}
        className="flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        {showSemEcc ? (
          <>
            <EyeOff className="h-3 w-3" /> Ocultar animais sem ECC
          </>
        ) : (
          <>
            <Eye className="h-3 w-3" /> Ver {animaisSemEcc.length} animais sem ECC
          </>
        )}
      </button>
      {showSemEcc && (
        <div className="mt-2 max-h-24 overflow-y-auto rounded bg-background/60 p-2 border border-border/30 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            Sem ECC factual registrado:
          </p>
          {animaisSemEcc.map((identificacao) => (
            <div key={identificacao} className="font-mono text-muted-foreground py-0.5">
              • {identificacao}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsHeader({ type }: { type: "lote" | "pasto" }) {
  return (
    <div className="space-y-2 border-b border-border/50 pb-4">
      <h3 className="text-lg font-bold text-foreground">
        Métricas de Ocupação
      </h3>
      <p className="text-sm text-muted-foreground">
        Dados operacionais do {type}
      </p>
    </div>
  );
}

interface OccupancyLimitationsProps {
  metrics: Pick<
    LoteOccupancyMetrics,
    "weightStatus" | "eccStatus" | "tempoLotacaoStatus" | "animaisSemEcc"
  >;
  permanenceMessage: string;
  weightMessage: string;
}

function OccupancyLimitations({
  metrics,
  permanenceMessage,
  weightMessage,
}: OccupancyLimitationsProps) {
  if (
    metrics.weightStatus.status === "complete" &&
    metrics.eccStatus.status === "complete" &&
    metrics.tempoLotacaoStatus!.status === "complete"
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
      <p className="text-xs text-yellow-800 space-y-1">
        <strong>Limitações e Cobertura:</strong>
        {metrics.tempoLotacaoStatus!.status !== "complete" && (
          <span> • {permanenceMessage}</span>
        )}
        {metrics.weightStatus.status !== "complete" && (
          <span> • {weightMessage}</span>
        )}
        {metrics.eccStatus.status !== "complete" && (
          <span> • Média de ECC parcial por falta de avaliações factuais para {metrics.animaisSemEcc.length} animais.</span>
        )}
      </p>
    </div>
  );
}

type CommonPerformanceMetrics = Pick<
  LoteOccupancyMetrics,
  "gmdEstimado" | "weightStatus" | "eccMedioAtual" | "eccStatus" | "eccCobertura" | "animaisSemEcc"
>;

function CommonPerformanceMetricCards({
  metrics,
  weightStatusTooltip,
  eccStatusTooltip,
}: {
  metrics: CommonPerformanceMetrics;
  weightStatusTooltip: string;
  eccStatusTooltip: string;
}) {
  return (
    <>
      <MetricCard
        label="GMD observado"
        value={metrics.gmdEstimado}
        unit="kg/dia"
        icon={<TrendingUp className="h-4 w-4" />}
        status={metrics.weightStatus.status}
        tooltip={weightStatusTooltip}
        extraContent={
          metrics.weightStatus.status !== "complete" && (
            <p className="text-[10px] text-yellow-600 font-semibold mt-1">
              ⚠️ Uso operacional não autorizado
            </p>
          )
        }
      />
      <MetricCard
        label="ECC Médio Atual"
        value={metrics.eccMedioAtual}
        icon={<AlertCircle className="h-4 w-4" />}
        status={metrics.eccStatus.status}
        tooltip={eccStatusTooltip}
      />
      <MetricCard
        label="Cobertura ECC"
        value={`${metrics.eccCobertura.avaliados}/${metrics.eccCobertura.total}`}
        icon={<CheckCircle2 className="h-4 w-4" />}
        extraContent={<SemEccList animaisSemEcc={metrics.animaisSemEcc} />}
      />
    </>
  );
}

function LoteMetricCards({ metrics }: { metrics: LoteOccupancyMetrics }) {
  const weightStatusTooltip = getWeightStatusTooltip(metrics.weightStatus.status);
  const eccStatusTooltip = getEccStatusTooltip(metrics.eccStatus.status);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <MetricsHeader type="lote" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Quantidade Atual"
            value={metrics.quantidadeAtual}
            unit="animais"
            icon={<Calendar className="h-4 w-4" />}
            extraContent={
              <p className="text-xs text-muted-foreground mt-1">
                Predomina: <span className="font-semibold text-foreground">{metrics.categoriaPredominante || "Não classificada"}</span>
              </p>
            }
          />
          <MetricCard
            label="Tempo Médio"
            value={metrics.tempoMedioPermanencia}
            unit="dias"
            icon={<Calendar className="h-4 w-4" />}
            status={metrics.tempoLotacaoStatus!.status}
            tooltip={metrics.tempoLotacaoStatus!.reason}
            extraContent={
              <p className="text-xs text-muted-foreground mt-1">
                Movimentação: <span className="font-semibold text-foreground">{formatMovementDate(metrics.ultimaMovimentacao)}</span>
              </p>
            }
          />
          <MetricCard
            label="Tempo Máximo"
            value={metrics.tempoMaximoPermanencia}
            unit="dias"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label="Peso Médio Inicial"
            value={metrics.pesoMedioInicial}
            unit="kg"
            icon={<Weight className="h-4 w-4" />}
            status={metrics.weightStatus.status}
            tooltip={weightStatusTooltip}
          />
          <MetricCard
            label="Peso Médio Final"
            value={metrics.pesoMedioFinal}
            unit="kg"
            icon={<Weight className="h-4 w-4" />}
            status={metrics.weightStatus.status}
            tooltip={weightStatusTooltip}
          />
          <CommonPerformanceMetricCards
            metrics={metrics}
            weightStatusTooltip={weightStatusTooltip}
            eccStatusTooltip={eccStatusTooltip}
          />
        </div>
        <OccupancyLimitations
          metrics={metrics}
          permanenceMessage="Tempo exibido somente quando a duração histórica possui boundaries qualificadas."
          weightMessage="Ganho de peso e GMD indisponíveis por pesagens insuficientes no lote."
        />
      </CardContent>
    </Card>
  );
}

function PastoMetricCards({ metrics }: { metrics: PastoOccupancyMetrics }) {
  const weightStatusTooltip = getWeightStatusTooltip(metrics.weightStatus.status);
  const eccStatusTooltip = getEccStatusTooltip(metrics.eccStatus.status);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <MetricsHeader type="pasto" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Lotação Atual"
            value={metrics.lotacaoAtual}
            unit="animais"
            icon={<Calendar className="h-4 w-4" />}
            extraContent={
              <p className="text-xs text-muted-foreground mt-1">
                Predomina: <span className="font-semibold text-foreground">{metrics.categoriaPredominante || "Não classificada"}</span>
              </p>
            }
          />
          <MetricCard
            label="Tempo Médio de Ocupação"
            value={metrics.tempoMedioOcupacao}
            unit="dias"
            icon={<Calendar className="h-4 w-4" />}
            status={metrics.tempoLotacaoStatus!.status}
            tooltip={metrics.tempoLotacaoStatus!.reason}
            extraContent={
              <p className="text-xs text-muted-foreground mt-1">
                Movimentação: <span className="font-semibold text-foreground">{formatMovementDate(metrics.ultimaMovimentacao)}</span>
              </p>
            }
          />
          <CommonPerformanceMetricCards
            metrics={metrics}
            weightStatusTooltip={weightStatusTooltip}
            eccStatusTooltip={eccStatusTooltip}
          />
          <MetricCard
            label="Variação Média de ECC"
            value={metrics.eccVariacaoMedia}
            icon={<TrendingUp className="h-4 w-4" />}
            status={metrics.eccStatus.status}
            tooltip={eccStatusTooltip}
          />
        </div>
        <OccupancyLimitations
          metrics={metrics}
          permanenceMessage="Tempo de ocupação estimado por ausência de histórico de movimentação factual."
          weightMessage="GMD indisponível por pesagens insuficientes dos animais no pasto."
        />
      </CardContent>
    </Card>
  );
}

export interface OccupancyMetricCardsProps {
  metrics: LoteOccupancyMetrics | PastoOccupancyMetrics | null;
  type: "lote" | "pasto";
}

export function OccupancyMetricCards({
  metrics,
  type,
}: OccupancyMetricCardsProps) {
  if (!metrics) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Sem dados de ocupação disponíveis para este {type}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return type === "lote" ? (
    <LoteMetricCards metrics={metrics as LoteOccupancyMetrics} />
  ) : (
    <PastoMetricCards metrics={metrics as PastoOccupancyMetrics} />
  );
}
