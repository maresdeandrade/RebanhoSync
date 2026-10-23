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
      const explicitCoverage = input.historicalCoverage?.[key];
      const canUseExplicitCoverage =
        kind === "historical" &&
        explicitCoverage !== undefined &&
        pendingLocalOperations === 0;
      const coverage: MetricCoverage = {
        kind,
        state:
          kind === "current_snapshot"
            ? "not_applicable"
            : kind === "planning"
              ? "partial"
              : canUseExplicitCoverage
                ? explicitCoverage.state
                : historicalCoverageState,
        scope: {
          fazendaId: input.fazendaId,
          domain: getMetricCoverageDomain(key),
        },
        evidence:
          kind === "current_snapshot"
            ? ["Read model local atual filtrado por fazenda_id."]
            : kind === "planning"
              ? [
                  "Agenda representa planejamento futuro e nao comprova execucao.",
                ]
              : canUseExplicitCoverage
                ? explicitCoverage.evidence
                : historicalEvidence,
        ...(pendingLocalOperations > 0
          ? { pendingLocalOperations }
          : explicitCoverage?.pendingLocalOperations !== undefined
            ? {
                pendingLocalOperations: explicitCoverage.pendingLocalOperations,
              }
            : {}),
      };
      const limitations = [
        ...metric.limitations,
        ...(metricTimezone.limitation ? [metricTimezone.limitation] : []),
      ];
      let status = metric.status;
      let value = metric.value;

      if (
        kind === "historical" &&
        (metric.status === "complete" ||
          metric.status === "partial" ||
          metric.status === "unavailable") &&
        coverage.state !== "verified"
      ) {
        const hasLocalEvidence = metric.value != null && metric.value !== 0;
        status =
          coverage.state === "partial" || hasLocalEvidence
            ? "partial"
            : "unavailable";
        value = status === "unavailable" ? null : metric.value;
        limitations.push(
          hasLocalEvidence
            ? "Valor representa o conjunto local observado, mas a cobertura historica completa nao foi comprovada."
            : "Zero local nao e tratado como zero factual porque a cobertura historica completa nao foi comprovada.",
        );
      }

      if (kind === "planning" && metric.status === "complete") {
        status = "partial";
        limitations.push(
          "Demanda futura e planejamento local; nao ha prova de cobertura historica nem de execucao.",
        );
      }

      if (status === "unavailable") value = null;

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
