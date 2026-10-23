import {
  createMetricResult,
  type MetricCoverage,
  type MetricResult,
} from "./metricContract";
import type {
  OperationalMetricKey,
  OperationalSummaryInput,
} from "./operationalSummaryTypes";
import type { resolveMetricTimezone } from "./operationalSummaryCalendar";

function getMetricCoverageKind(
  key: OperationalMetricKey,
): MetricCoverage["kind"] {
  if (
    key === "rebanho_animais_ativos" ||
    key === "rebanho_lotes_ativos" ||
    key === "rebanho_pastos_ativos" ||
    key === "repro_matrizes" ||
    key === "estoque_saldo_atual"
  ) {
    return "current_snapshot";
  }

  if (key === "agenda_aberta" || key === "estoque_demanda_futura") {
    return "planning";
  }

  return "historical";
}

function getMetricCoverageDomain(key: OperationalMetricKey): string {
  if (key.startsWith("financeiro_")) return "financeiro";
  if (key.startsWith("comercial_")) return "comercial";
  if (key.startsWith("pesagem_")) return "pesagem";
  if (key.startsWith("repro_")) return "reproducao";
  if (key.startsWith("sanitario_")) return "sanitario";
  if (key.startsWith("estoque_")) return "estoque";
  if (key.startsWith("rebanho_")) return "rebanho";
  return "operacional";
}

type CoverageInput = Pick<
  OperationalSummaryInput,
  "fazendaId" | "historicalCoverage" | "gestures" | "rejections"
>;
type ExplicitCoverage = NonNullable<
  OperationalSummaryInput["historicalCoverage"]
>[OperationalMetricKey];

function resolveCoverageState(
  kind: MetricCoverage["kind"],
  useExplicit: boolean,
  explicit: ExplicitCoverage,
  fallback: MetricCoverage["state"],
): MetricCoverage["state"] {
  return kind === "current_snapshot"
    ? "not_applicable"
    : kind === "planning"
      ? "partial"
      : useExplicit
        ? explicit.state
        : fallback;
}
function resolveCoverageEvidence(
  kind: MetricCoverage["kind"],
  useExplicit: boolean,
  explicit: ExplicitCoverage,
  fallback: string[],
): string[] {
  return kind === "current_snapshot"
    ? ["Read model local atual filtrado por fazenda_id."]
    : kind === "planning"
      ? ["Agenda representa planejamento futuro e nao comprova execucao."]
      : useExplicit
        ? explicit.evidence
        : fallback;
}
function resolvePendingCoverage(pending: number, explicit: ExplicitCoverage) {
  return pending > 0
    ? { pendingLocalOperations: pending }
    : explicit?.pendingLocalOperations !== undefined
      ? { pendingLocalOperations: explicit.pendingLocalOperations }
      : {};
}
function buildMetricCoverage(
  key: OperationalMetricKey,
  kind: MetricCoverage["kind"],
  input: CoverageInput,
  pending: number,
  fallbackState: MetricCoverage["state"],
  fallbackEvidence: string[],
): MetricCoverage {
  const explicit = input.historicalCoverage?.[key];
  const useExplicit =
    kind === "historical" && explicit !== undefined && pending === 0;
  return {
    kind,
    state: resolveCoverageState(kind, useExplicit, explicit, fallbackState),
    scope: { fazendaId: input.fazendaId, domain: getMetricCoverageDomain(key) },
    evidence: resolveCoverageEvidence(
      kind,
      useExplicit,
      explicit,
      fallbackEvidence,
    ),
    ...resolvePendingCoverage(pending, explicit),
  };
}
function needsHistoricalDowngrade(
  kind: MetricCoverage["kind"],
  metric: MetricResult<number>,
  coverage: MetricCoverage,
): boolean {
  return (
    kind === "historical" &&
    ["complete", "partial", "unavailable"].includes(metric.status) &&
    coverage.state !== "verified"
  );
}
function downgradeHistoricalMetric(
  metric: MetricResult<number>,
  coverage: MetricCoverage,
  limitations: string[],
): Pick<MetricResult<number>, "status" | "value"> {
  const hasLocalEvidence = metric.value != null && metric.value !== 0;
  const status =
    coverage.state === "partial" || hasLocalEvidence
      ? "partial"
      : "unavailable";
  const value = status === "unavailable" ? null : metric.value;
  limitations.push(
    hasLocalEvidence
      ? "Valor representa o conjunto local observado, mas a cobertura historica completa nao foi comprovada."
      : "Zero local nao e tratado como zero factual porque a cobertura historica completa nao foi comprovada.",
  );
  return { status, value };
}
function closeMetricValue(
  metric: MetricResult<number>,
  kind: MetricCoverage["kind"],
  coverage: MetricCoverage,
  limitations: string[],
) {
  let status = metric.status;
  let value = metric.value;
  if (needsHistoricalDowngrade(kind, metric, coverage)) {
    const closed = downgradeHistoricalMetric(metric, coverage, limitations);
    status = closed.status;
    value = closed.value;
  }
  if (kind === "planning" && metric.status === "complete") {
    status = "partial";
    limitations.push(
      "Demanda futura e planejamento local; nao ha prova de cobertura historica nem de execucao.",
    );
  }
  if (status === "unavailable") value = null;
  return { status, value };
}

export function closeMetricSemantics(
  metrics: Record<OperationalMetricKey, MetricResult<number>>,
  input: Pick<
    OperationalSummaryInput,
    "fazendaId" | "historicalCoverage" | "gestures" | "rejections"
  >,
  metricTimezone: ReturnType<typeof resolveMetricTimezone>,
): Record<OperationalMetricKey, MetricResult<number>> {
  const pendingLocalOperations =
    input.gestures.filter(
      (gesture) => !["DONE", "SYNCED"].includes(gesture.status),
    ).length + input.rejections.length;
  const historicalCoverageState: MetricCoverage["state"] =
    pendingLocalOperations > 0 ? "partial" : "unknown";
  const historicalEvidence = [
    "Nao existe marcador local que prove cobertura historica completa por fazenda, dominio e periodo.",
    "PullCursor/watermark registra somente ultimo updated_at/last_id e nao prova completude historica.",
    ...(pendingLocalOperations > 0
      ? [
          `${pendingLocalOperations} pendencia(s) local(is) de sync/rejeicao impedem afirmar cobertura plena.`,
        ]
      : []),
  ];

  return Object.fromEntries(
    Object.entries(metrics).map(([rawKey, metric]) => {
      const key = rawKey as OperationalMetricKey;
      const kind = getMetricCoverageKind(key);
      const coverage = buildMetricCoverage(
        key,
        kind,
        input,
        pendingLocalOperations,
        historicalCoverageState,
        historicalEvidence,
      );
      const limitations = [
        ...metric.limitations,
        ...(metricTimezone.limitation ? [metricTimezone.limitation] : []),
      ];
      const { status, value } = closeMetricValue(
        metric,
        kind,
        coverage,
        limitations,
      );

      return [
        key,
        createMetricResult({
          value,
          status,
          period: metric.period,
          coverage,
          sources: metric.sources,
          limitations,
        }),
      ];
    }),
  ) as Record<OperationalMetricKey, MetricResult<number>>;
}
