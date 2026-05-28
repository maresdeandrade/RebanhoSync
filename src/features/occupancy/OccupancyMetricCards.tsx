import { useMemo, useState } from "react";
import {
  TrendingUp,
  Calendar,
  Weight,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LoteOccupancyMetrics, PastoOccupancyMetrics } from "./occupancyTypes";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  status?: "complete" | "partial" | "empty";
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
        {typeof value === "number" ? value.toFixed(2) : value}
        {unit && <span className="text-sm font-medium text-muted-foreground ml-2">{unit}</span>}
      </p>
      {extraContent}
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
  const [showSemEcc, setShowSemEcc] = useState(false);

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
      ? "Sem pesagens suficientes para calcular ganho de peso. GMD indisponível."
      : metrics.weightStatus.status === "partial"
        ? "Apenas uma pesagem disponível no período. GMD indisponível."
        : "GMD calculado com base em pelo menos duas pesagens válidas no período.";

  const eccStatusTooltip =
    metrics.eccStatus.status === "empty"
      ? "Sem avaliações de ECC factual registradas para este grupo."
      : metrics.eccStatus.status === "partial"
        ? "Cobertura de ECC parcial. Alguns animais não possuem ECC factual."
        : "Cobertura completa. Todos os animais possuem ECC factual.";

  const formatMovementDate = (dateStr: string | null) => {
    if (!dateStr) return "Nenhum histórico";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      dateStyle: "short",
    });
  };

  const semEccListContent = metrics.animaisSemEcc.length > 0 && (
    <div className="mt-2 pt-2 border-t border-border/40 text-xs">
      <button
        onClick={() => setShowSemEcc(!showSemEcc)}
        className="flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        {showSemEcc ? (
          <>
            <EyeOff className="h-3 w-3" /> Ocultar animais sem ECC
          </>
        ) : (
          <>
            <Eye className="h-3 w-3" /> Ver {metrics.animaisSemEcc.length} animais sem ECC
          </>
        )}
      </button>
      {showSemEcc && (
        <div className="mt-2 max-h-24 overflow-y-auto rounded bg-background/60 p-2 border border-border/30 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            Sem ECC factual registrado:
          </p>
          {metrics.animaisSemEcc.map((identificacao) => (
            <div key={identificacao} className="font-mono text-muted-foreground py-0.5">
              • {identificacao}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (type === "lote") {
    const loteMetrics = metrics as LoteOccupancyMetrics;
    return (
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2 border-b border-border/50 pb-4">
            <h3 className="text-lg font-bold text-foreground">
              Métricas de Ocupação
            </h3>
            <p className="text-sm text-muted-foreground">
              Dados operacionais do lote
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Quantidade Atual"
              value={loteMetrics.quantidadeAtual}
              unit="animais"
              icon={<Calendar className="h-4 w-4" />}
              extraContent={
                <p className="text-xs text-muted-foreground mt-1">
                  Predomina: <span className="font-semibold text-foreground">{loteMetrics.categoriaPredominante || "Não classificada"}</span>
                </p>
              }
            />
            <MetricCard
              label="Tempo Médio"
              value={loteMetrics.tempoMedioPermanencia}
              unit="dias"
              icon={<Calendar className="h-4 w-4" />}
              status={loteMetrics.tempoLotacaoStatus.status}
              tooltip={loteMetrics.tempoLotacaoStatus.reason}
              extraContent={
                <p className="text-xs text-muted-foreground mt-1">
                  Movimentação: <span className="font-semibold text-foreground">{formatMovementDate(loteMetrics.ultimaMovimentacao)}</span>
                </p>
              }
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
              label="GMD Estimado"
              value={loteMetrics.gmdEstimado}
              unit="kg/dia"
              icon={<TrendingUp className="h-4 w-4" />}
              status={loteMetrics.weightStatus.status}
              tooltip={weightStatusTooltip}
              extraContent={
                loteMetrics.weightStatus.status !== "complete" && (
                  <p className="text-[10px] text-yellow-600 font-semibold mt-1">
                    ⚠️ Requer ≥2 pesagens no período
                  </p>
                )
              }
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
              extraContent={semEccListContent}
            />
          </div>

          {(loteMetrics.weightStatus.status !== "complete" ||
            loteMetrics.eccStatus.status !== "complete" ||
            loteMetrics.tempoLotacaoStatus.status !== "complete") && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
              <p className="text-xs text-yellow-800 space-y-1">
                <strong>Limitações e Cobertura:</strong>
                {loteMetrics.tempoLotacaoStatus.status !== "complete" && (
                  <span> • Tempo de permanência estimado por ausência de histórico de movimentação factual.</span>
                )}
                {loteMetrics.weightStatus.status !== "complete" && (
                  <span> • Ganho de peso e GMD indisponíveis por pesagens insuficientes no lote.</span>
                )}
                {loteMetrics.eccStatus.status !== "complete" && (
                  <span> • Média de ECC parcial por falta de avaliações factuais para {loteMetrics.animaisSemEcc.length} animais.</span>
                )}
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
        <div className="space-y-2 border-b border-border/50 pb-4">
          <h3 className="text-lg font-bold text-foreground">
            Métricas de Ocupação
          </h3>
          <p className="text-sm text-muted-foreground">
            Dados operacionais do pasto
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Lotação Atual"
            value={pastoMetrics.lotacaoAtual}
            unit="animais"
            icon={<Calendar className="h-4 w-4" />}
            extraContent={
              <p className="text-xs text-muted-foreground mt-1">
                Predomina: <span className="font-semibold text-foreground">{pastoMetrics.categoriaPredominante || "Não classificada"}</span>
              </p>
            }
          />
          <MetricCard
            label="Tempo Médio de Ocupação"
            value={pastoMetrics.tempoMedioOcupacao}
            unit="dias"
            icon={<Calendar className="h-4 w-4" />}
            status={pastoMetrics.tempoLotacaoStatus.status}
            tooltip={pastoMetrics.tempoLotacaoStatus.reason}
            extraContent={
              <p className="text-xs text-muted-foreground mt-1">
                Movimentação: <span className="font-semibold text-foreground">{formatMovementDate(pastoMetrics.ultimaMovimentacao)}</span>
              </p>
            }
          />
          <MetricCard
            label="GMD Estimado"
            value={pastoMetrics.gmdEstimado}
            unit="kg/dia"
            icon={<TrendingUp className="h-4 w-4" />}
            status={pastoMetrics.weightStatus.status}
            tooltip={weightStatusTooltip}
            extraContent={
              pastoMetrics.weightStatus.status !== "complete" && (
                <p className="text-[10px] text-yellow-600 font-semibold mt-1">
                  ⚠️ Requer ≥2 pesagens no período
                </p>
              )
            }
          />
          <MetricCard
            label="ECC Médio Atual"
            value={pastoMetrics.eccMedioAtual}
            icon={<AlertCircle className="h-4 w-4" />}
            status={pastoMetrics.eccStatus.status}
            tooltip={eccStatusTooltip}
          />
          <MetricCard
            label="Cobertura ECC"
            value={`${pastoMetrics.eccCobertura.avaliados}/${pastoMetrics.eccCobertura.total}`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            extraContent={semEccListContent}
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
          pastoMetrics.eccStatus.status !== "complete" ||
          pastoMetrics.tempoLotacaoStatus.status !== "complete") && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
            <p className="text-xs text-yellow-800 space-y-1">
              <strong>Limitações e Cobertura:</strong>
              {pastoMetrics.tempoLotacaoStatus.status !== "complete" && (
                <span> • Tempo de ocupação estimado por ausência de histórico de movimentação factual.</span>
              )}
              {pastoMetrics.weightStatus.status !== "complete" && (
                <span> • GMD indisponível por pesagens insuficientes dos animais no pasto.</span>
              )}
              {pastoMetrics.eccStatus.status !== "complete" && (
                <span> • Média de ECC parcial por falta de avaliações factuais para {pastoMetrics.animaisSemEcc.length} animais.</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
