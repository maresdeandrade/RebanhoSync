export type MetricStatus = "complete" | "partial" | "unavailable";

export type MetricSourceRole = "primary" | "auxiliary";

export type MetricCoverageState =
  | "verified"
  | "partial"
  | "unknown"
  | "not_applicable";

export type MetricCoverageKind = "historical" | "current_snapshot" | "planning";

export type MetricTimezoneSource = "farm" | "runtime" | "unavailable";

export interface MetricSource {
  name: string;
  role: MetricSourceRole;
}

export interface MetricPeriod {
  from: string;
  to: string;
  timezone: string | null;
  timezoneSource: MetricTimezoneSource;
  boundary: "inclusive";
  factualDateField: "evento.occurred_on ?? evento.occurred_at convertido no timezone declarado";
}

export interface MetricCoverage {
  kind: MetricCoverageKind;
  state: MetricCoverageState;
  scope: {
    fazendaId: string;
    domain?: string;
  };
  evidence: string[];
  pendingLocalOperations?: number;
}

export interface MetricResult<T> {
  value: T | null;
  status: MetricStatus;
  period?: MetricPeriod;
  coverage?: MetricCoverage;
  sources: MetricSource[];
  limitations: string[];
}

export function createMetricPeriod(
  from: string,
  to: string,
  options: {
    timezone?: string | null;
    timezoneSource?: MetricTimezoneSource;
  } = {},
): MetricPeriod {
  return {
    from,
    to,
    timezone: options.timezone ?? null,
    timezoneSource: options.timezoneSource ?? "unavailable",
    boundary: "inclusive",
    factualDateField:
      "evento.occurred_on ?? evento.occurred_at convertido no timezone declarado",
  };
}

export function createMetricResult<T>(input: {
  value: T | null;
  status: MetricStatus;
  sources: readonly MetricSource[];
  limitations?: readonly string[];
  period?: MetricPeriod;
  coverage?: MetricCoverage;
}): MetricResult<T> {
  return {
    value: input.value,
    status: input.status,
    period: input.period,
    coverage: input.coverage
      ? {
          ...input.coverage,
          scope: { ...input.coverage.scope },
          evidence: [...input.coverage.evidence],
        }
      : undefined,
    sources: input.sources.map((source) => ({ ...source })),
    limitations: Array.from(new Set(input.limitations ?? [])),
  };
}
