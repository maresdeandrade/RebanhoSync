import { useMemo } from "react";
import {
  TrendingUp,
  Calendar,
  Weight,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LoteOccupancyMetrics, PastoOccupancyMetrics } from "./occupancyTypes";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  status?: "complete" | "partial" | "empty";
  tooltip?: string;
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  status,
  tooltip,
}: MetricCardProps) {
  const statusColor = {
    complete: "text-green-600",
    partial: "text-yellow-600",
    empty: "text-gray-400",
  };

  const statusIcon = {
    complete: <CheckCircle2 className="h-4 w-4" />,
    partial: <AlertCircle className="h-4 w-4" />,
    empty: <HelpCircle className="h-4 w-4" />,
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
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
      <p className="text-2xl font-semibold text-foreground">
        {typeof value === "number" ? value.toFixed(2) : value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
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
  const hasData = useMemo(() => metrics !== null, [metrics]);

  if (!hasData || !metrics) {
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

  const weightStatusTooltip =
    metrics.weightStatus.status === "empty"
      ? "Sem pesagens suficientes para calcular ganho de peso"
      : metrics.weightStatus.status === "partial"
        ? "Dados parciais de peso disponíveis"
        : "Ganho de peso calculado com dados completos";

  const eccStatusTooltip =
    metrics.eccStatus.status === "empty"
      ? "Sem avaliações de ECC disponíveis"
      : metrics.eccStatus.status === "partial"
        ? "Apenas uma avaliação de ECC disponível"
        : "ECC calculado com dados completos";

  if (type === "lote") {
    const loteMetrics = metrics as LoteOccupancyMetrics;
    return (
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Métricas de Ocupação
              </h3>
              <p className="text-sm text-muted-foreground">
                Dados operacionais do lote
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Quantidade Atual"
              value={loteMetrics.quantidadeAtual}
              unit="animais"
              icon={<Calendar className="h-4 w-4" />}
            />
            <MetricCard
              label="Tempo Médio"
              value={loteMetrics.tempoMedioPermanencia}
              unit="dias"
              icon={<Calendar className="h-4 w-4" />}
            />
            <MetricCard
              label="Tempo Máximo"
              value={loteMetrics.tempoMaximoPermanencia}
              unit="dias"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Peso Médio Inicial"
              value={loteMetrics.pesoMedioInicial}
              unit="kg"
              icon={<Weight className="h-4 w-4" />}
              status={loteMetrics.weightStatus.status}
              tooltip={weightStatusTooltip}
            />
            <MetricCard
              label="Peso Médio Final"
              value={loteMetrics.pesoMedioFinal}
              unit="kg"
              icon={<Weight className="h-4 w-4" />}
              status={loteMetrics.weightStatus.status}
              tooltip={weightStatusTooltip}
            />
            <MetricCard
              label="Ganho Médio"
              value={loteMetrics.ganhoMedio}
              unit="kg"
              icon={<TrendingUp className="h-4 w-4" />}
              status={loteMetrics.weightStatus.status}
              tooltip={weightStatusTooltip}
            />
            <MetricCard
              label="GMD Estimado"
              value={loteMetrics.gmdEstimado}
              unit="kg/dia"
              icon={<TrendingUp className="h-4 w-4" />}
              status={loteMetrics.weightStatus.status}
              tooltip={weightStatusTooltip}
            />
            <MetricCard
              label="ECC Médio Atual"
              value={loteMetrics.eccMedioAtual}
              icon={<AlertCircle className="h-4 w-4" />}
              status={loteMetrics.eccStatus.status}
              tooltip={eccStatusTooltip}
            />
            <MetricCard
              label="Cobertura ECC"
              value={`${loteMetrics.eccCobertura.avaliados}/${loteMetrics.eccCobertura.total}`}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>

          {(loteMetrics.weightStatus.status !== "complete" ||
            loteMetrics.eccStatus.status !== "complete") && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
              <p className="text-sm text-yellow-800">
                <strong>Nota:</strong> Alguns dados estão incompletos. Métricas
                com status "parcial" ou "vazio" podem não refletir a realidade
                completa do lote.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Type === "pasto"
  const pastoMetrics = metrics as PastoOccupancyMetrics;
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Métricas de Ocupação
            </h3>
            <p className="text-sm text-muted-foreground">
              Dados operacionais do pasto
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Lotação Atual"
            value={pastoMetrics.lotacaoAtual}
            unit="animais"
            icon={<Calendar className="h-4 w-4" />}
          />
          <MetricCard
            label="Tempo Médio de Ocupação"
            value={pastoMetrics.tempoMedioOcupacao}
            unit="dias"
            icon={<Calendar className="h-4 w-4" />}
          />
          <MetricCard
            label="Ganho Médio de Peso"
            value={pastoMetrics.ganhoMedioPeso}
            unit="kg"
            icon={<TrendingUp className="h-4 w-4" />}
            status={pastoMetrics.weightStatus.status}
            tooltip={weightStatusTooltip}
          />
          <MetricCard
            label="GMD Estimado"
            value={pastoMetrics.gmdEstimado}
            unit="kg/dia"
            icon={<TrendingUp className="h-4 w-4" />}
            status={pastoMetrics.weightStatus.status}
            tooltip={weightStatusTooltip}
          />
          <MetricCard
            label="ECC Médio Atual"
            value={pastoMetrics.eccMedioAtual}
            icon={<AlertCircle className="h-4 w-4" />}
            status={pastoMetrics.eccStatus.status}
            tooltip={eccStatusTooltip}
          />
          <MetricCard
            label="Variação Média de ECC"
            value={pastoMetrics.eccVariacaoMedia}
            icon={<TrendingUp className="h-4 w-4" />}
            status={pastoMetrics.eccStatus.status}
            tooltip={eccStatusTooltip}
          />
        </div>

        {(pastoMetrics.weightStatus.status !== "complete" ||
          pastoMetrics.eccStatus.status !== "complete") && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Alguns dados estão incompletos. Métricas
              com status "parcial" ou "vazio" podem não refletir a realidade
              completa do pasto.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
