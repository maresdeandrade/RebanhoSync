import {
  buildSanitaryProtocolWindowV2,
  loadSanitaryProtocolWindowSourceV2,
  type SanitaryProtocolWindowRowV2,
  type SanitaryProtocolWindowSourceV2,
} from "../windows/sanitaryProtocolWindowsV2";
import type { SanitaryTemporalWindowV2 } from "../checks/sanitaryProtocolPrecheckV2";

export type SanitaryTriageDispositionV2 =
  | "opportunity_in_window"
  | "future_opportunity"
  | "scheduled"
  | "factual_completed"
  | "restricted"
  | "insufficient_data"
  | "outside_period";

export type SanitaryTriageEvaluationV2 = {
  animalId: string;
  identification: string;
  lotId: string | null;
  lotLabel: string;
  protocolId: string;
  protocolLabel: string;
  itemId: string;
  itemKey: string;
  itemLabel: string;
  status: SanitaryProtocolWindowRowV2["status"];
  disposition: SanitaryTriageDispositionV2;
  temporalWindow?: SanitaryTemporalWindowV2;
  intersectsPeriod: boolean;
  intervalStart?: string;
  intervalEnd?: string;
  reason: string;
  warnings: string[];
  blockers: string[];
  documentaryPending: boolean;
  documentaryPendingReasons: string[];
  alreadyPlanned: boolean;
  plannedFor: string | null;
  planningAllowed: false;
  source: "SanitaryProtocolWindowRowV2";
};

export type SanitaryTriageResultV2 = {
  period: { startDate: string; endDate: string };
  evaluatedAt: string;
  evaluations: SanitaryTriageEvaluationV2[];
  summary: Record<SanitaryTriageDispositionV2, number>;
  source: {
    type: "SanitaryProtocolWindowSourceV2";
    createsAgenda: false;
    createsEvent: false;
    createsStockMovement: false;
  };
};

function dateKey(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function intervalIntersects(
  interval: { startDate?: string; endDate?: string },
  period: { startDate: string; endDate: string },
): boolean {
  const start = interval.startDate ?? "0000-01-01";
  const end = interval.endDate ?? "9999-12-31";
  return start <= period.endDate && end >= period.startDate;
}

function intervalStartsAfterPeriod(
  interval: { startDate?: string; endDate?: string },
  period: { startDate: string; endDate: string },
): boolean {
  return Boolean(interval.startDate && interval.startDate > period.endDate);
}

function dispositionForRow(
  row: SanitaryProtocolWindowRowV2,
  period: { startDate: string; endDate: string },
  intersectsPeriod: boolean,
  startsAfterPeriod: boolean,
): SanitaryTriageDispositionV2 {
  if (row.status === "completed") return "factual_completed";
  if (row.alreadyPlanned && intersectsPeriod) return "scheduled";
  if (
    row.documentaryPending ||
    row.status === "insufficient_data" ||
    row.temporalWindow?.resolution === "insufficient"
  ) {
    return "insufficient_data";
  }
  if (intersectsPeriod) {
    // A future age window can overlap the requested period even when the
    // animal is not yet eligible at the period's first day.
    if (row.blockers.length || (!row.canSelect && row.status !== "not_yet_eligible"))
      return "restricted";
    return "opportunity_in_window";
  }
  if (startsAfterPeriod && !row.blockers.length) return "future_opportunity";
  if (row.blockers.length || !row.canSelect) return "restricted";
  return "outside_period";
}

function evaluateRow(
  row: SanitaryProtocolWindowRowV2,
  period: { startDate: string; endDate: string },
): SanitaryTriageEvaluationV2 {
  const intervals = row.temporalWindow?.intervals ?? [];
  const intersectsPeriod = intervals.some((interval) =>
    intervalIntersects(interval, period),
  );
  const startsAfterPeriod = intervals.some((interval) =>
    intervalStartsAfterPeriod(interval, period),
  );
  const relevantInterval = intervals.find((interval) =>
    intervalIntersects(interval, period),
  ) ?? intervals[0];
  return {
    animalId: row.animalId,
    identification: row.identification,
    lotId: row.lotId,
    lotLabel: row.lotLabel,
    protocolId: row.protocolId,
    protocolLabel: row.protocolLabel,
    itemId: row.itemId,
    itemKey: row.itemKey,
    itemLabel: row.itemLabel,
    status: row.status,
    disposition: dispositionForRow(
      row,
      period,
      intersectsPeriod,
      startsAfterPeriod,
    ),
    temporalWindow: row.temporalWindow,
    intersectsPeriod,
    intervalStart: relevantInterval?.startDate,
    intervalEnd: relevantInterval?.endDate,
    reason: row.reason,
    warnings: row.warnings,
    blockers: row.blockers,
    documentaryPending: row.documentaryPending,
    documentaryPendingReasons: row.documentaryPendingReasons,
    alreadyPlanned: row.alreadyPlanned,
    plannedFor: row.plannedFor,
    planningAllowed: false,
    source: "SanitaryProtocolWindowRowV2",
  };
}

export function triageSanitaryProtocolIntervalV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  startDate: string;
  endDate: string;
}): SanitaryTriageResultV2 {
  const startDate = dateKey(input.startDate);
  const endDate = dateKey(input.endDate);
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("Período sanitário inválido.");
  }
  const period = { startDate, endDate };
  const evaluations = input.source.catalog.items.flatMap((item) => {
    const window = buildSanitaryProtocolWindowV2({
      source: input.source,
      protocolId: item.protocolId,
      itemId: item.id,
      evaluatedAt: startDate,
    });
    return window?.rows.map((row) => evaluateRow(row, period)) ?? [];
  });
  const summary = evaluations.reduce<SanitaryTriageResultV2["summary"]>(
    (current, evaluation) => {
      current[evaluation.disposition] += 1;
      return current;
    },
    {
      opportunity_in_window: 0,
      future_opportunity: 0,
      scheduled: 0,
      factual_completed: 0,
      restricted: 0,
      insufficient_data: 0,
      outside_period: 0,
    },
  );
  return {
    period,
    evaluatedAt: startDate,
    evaluations,
    summary,
    source: {
      type: "SanitaryProtocolWindowSourceV2",
      createsAgenda: false,
      createsEvent: false,
      createsStockMovement: false,
    },
  };
}

export async function loadSanitaryTriageV2(input: {
  fazendaId: string;
  startDate: string;
  endDate: string;
}): Promise<SanitaryTriageResultV2> {
  const source = await loadSanitaryProtocolWindowSourceV2(input.fazendaId);
  return triageSanitaryProtocolIntervalV2({
    source,
    startDate: input.startDate,
    endDate: input.endDate,
  });
}
