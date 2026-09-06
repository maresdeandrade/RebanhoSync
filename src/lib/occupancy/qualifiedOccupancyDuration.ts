import type {
  HistoricalLotOccupancyInterval,
  HistoricalLotOccupancyResult,
} from "./historicalLotOccupancy";
import type {
  HistoricalPastureOccupancyInterval,
  HistoricalPastureOccupancyResult,
} from "./historicalPastureOccupancy";

export const OCCUPANCY_DAY_MS = 86_400_000;

export type QualifiedOccupancyDimension = "LOT" | "PASTURE";
export type QualifiedOccupancyCalculation = "CALCULATED" | "NOT_CALCULATED";
export type QualifiedOccupancyEndBasis =
  | "FACTUAL_EXIT"
  | "REFERENCE_DATE"
  | null;
export type QualifiedOccupancyCoverage =
  | "COMPLETE"
  | "PARTIAL"
  | "CONFLICTED"
  | "UNAVAILABLE";

export type QualifiedOccupancyLimitationCode =
  | "LEFT_BOUND_UNKNOWN"
  | "RIGHT_BOUND_UNKNOWN"
  | "OPEN_INTERVAL_REQUIRES_REFERENCE_DATE"
  | "REFERENCE_DATE_NOT_AFTER_ENTRY"
  | "INVALID_TIMESTAMP"
  | "INVALID_PERIOD"
  | "OUTSIDE_REQUESTED_PERIOD"
  | "CONFLICT_AFFECTS_BOUNDARY"
  | "CROSS_FARM_INTERVAL"
  | "SOURCE_NO_HISTORY";

export interface QualifiedOccupancyPeriod {
  from: string;
  to: string;
}

export interface QualifiedOccupancyInterval {
  dimension: QualifiedOccupancyDimension;
  animalId: string;
  fazendaId: string;
  loteId: string;
  pastoId: string | null;
  enteredAt: string | null;
  leftAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  startBoundary: "KNOWN" | "LEFT_BOUND_UNKNOWN";
  endBoundary: "KNOWN" | "OPEN" | "RIGHT_BOUND_UNKNOWN";
  calculation: QualifiedOccupancyCalculation;
  durationMs: number | null;
  durationDays: number | null;
  endBasis: QualifiedOccupancyEndBasis;
  coverage: QualifiedOccupancyCoverage;
  limitationCodes: QualifiedOccupancyLimitationCode[];
  lotOccupancySourceEventIds: string[];
  pastureSourceEventIds: string[];
}

export interface QualifiedOccupancyDurationResult {
  dimension: QualifiedOccupancyDimension;
  animalId: string;
  fazendaId: string;
  sourceStatus: HistoricalLotOccupancyResult["status"];
  sourceCoverage:
    | HistoricalLotOccupancyResult["coverage"]["history"]
    | HistoricalPastureOccupancyResult["coverage"]["history"];
  intervals: QualifiedOccupancyInterval[];
  limitations: Array<{ source: string; code: string; eventIds: string[] }>;
  conflicts: Array<{
    source: string;
    code: string;
    occurredAt: string | null;
    eventIds: string[];
    description: string;
  }>;
}

interface QualifyInput<T> {
  result: T;
  referenceDate?: string;
  period?: QualifiedOccupancyPeriod;
}

interface NormalizedSourceInterval {
  dimension: QualifiedOccupancyDimension;
  animalId: string;
  fazendaId: string;
  loteId: string;
  pastoId: string | null;
  enteredAt: string | null;
  leftAt: string | null;
  startBoundary: "KNOWN" | "LEFT_BOUND_UNKNOWN";
  endBoundary: "KNOWN" | "OPEN" | "RIGHT_BOUND_UNKNOWN";
  lotOccupancySourceEventIds: string[];
  pastureSourceEventIds: string[];
}

function validTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function coverageFromSource(
  history: QualifiedOccupancyDurationResult["sourceCoverage"],
  hasConflicts: boolean,
): QualifiedOccupancyCoverage {
  if (hasConflicts || history === "CONFLICTED_HISTORY") return "CONFLICTED";
  if (history === "CONTIGUOUS_HISTORY") return "COMPLETE";
  if (history === "PARTIAL_HISTORY") return "PARTIAL";
  return "UNAVAILABLE";
}

function conflictAffectsInterval(
  conflicts: QualifiedOccupancyDurationResult["conflicts"],
  start: number,
  end: number,
  isOpen: boolean,
): boolean {
  return conflicts.some((conflict) => {
    const occurredAt = validTimestamp(conflict.occurredAt);
    if (occurredAt === null) return isOpen;
    return occurredAt >= start && occurredAt < end;
  });
}

function notCalculated(
  interval: NormalizedSourceInterval,
  coverage: QualifiedOccupancyCoverage,
  code: QualifiedOccupancyLimitationCode,
): QualifiedOccupancyInterval {
  return {
    ...interval,
    effectiveFrom: null,
    effectiveTo: null,
    calculation: "NOT_CALCULATED",
    durationMs: null,
    durationDays: null,
    endBasis: null,
    coverage,
    limitationCodes: [code],
  };
}

type ResolvedIntervalBoundary =
  | {
      start: number;
      end: number;
      endBasis: Exclude<QualifiedOccupancyEndBasis, null>;
    }
  | { limitation: QualifiedOccupancyLimitationCode };

function resolveIntervalBoundary(
  interval: NormalizedSourceInterval,
  referenceDate: string | undefined,
): ResolvedIntervalBoundary {
  const start = validTimestamp(interval.enteredAt);
  if (start === null) return { limitation: "INVALID_TIMESTAMP" };

  if (interval.endBoundary === "KNOWN") {
    const end = validTimestamp(interval.leftAt);
    if (end === null || end < start) return { limitation: "INVALID_TIMESTAMP" };
    return { start, end, endBasis: "FACTUAL_EXIT" };
  }

  if (referenceDate === undefined) {
    return { limitation: "OPEN_INTERVAL_REQUIRES_REFERENCE_DATE" };
  }
  const end = validTimestamp(referenceDate);
  if (end === null) return { limitation: "INVALID_TIMESTAMP" };
  if (end <= start) return { limitation: "REFERENCE_DATE_NOT_AFTER_ENTRY" };
  return { start, end, endBasis: "REFERENCE_DATE" };
}

type ClippedInterval =
  | { start: number; end: number }
  | { limitation: "INVALID_PERIOD" | "OUTSIDE_REQUESTED_PERIOD" };

type ParsedPeriod =
  | { start: number; end: number }
  | { limitation: "INVALID_PERIOD" };

function parseRequestedPeriod(period: QualifiedOccupancyPeriod): ParsedPeriod {
  const start = validTimestamp(period.from);
  const end = validTimestamp(period.to);
  if (start === null || end === null || end <= start) {
    return { limitation: "INVALID_PERIOD" };
  }
  return { start, end };
}

function clipToRequestedPeriod(
  start: number,
  end: number,
  period: QualifiedOccupancyPeriod | undefined,
): ClippedInterval {
  if (!period) return { start, end };
  const requested = parseRequestedPeriod(period);
  if ("limitation" in requested) return requested;

  const clippedStart = Math.max(start, requested.start);
  const clippedEnd = Math.min(end, requested.end);
  const factualZero =
    start === end && start >= requested.start && start < requested.end;
  if (clippedEnd < clippedStart || (clippedEnd === clippedStart && !factualZero)) {
    return { limitation: "OUTSIDE_REQUESTED_PERIOD" };
  }
  return { start: clippedStart, end: clippedEnd };
}

function qualifyInterval(
  interval: NormalizedSourceInterval,
  sourceCoverage: QualifiedOccupancyCoverage,
  conflicts: QualifiedOccupancyDurationResult["conflicts"],
  referenceDate: string | undefined,
  period: QualifiedOccupancyPeriod | undefined,
): QualifiedOccupancyInterval {
  if (interval.startBoundary === "LEFT_BOUND_UNKNOWN" || interval.enteredAt === null) {
    return notCalculated(interval, sourceCoverage, "LEFT_BOUND_UNKNOWN");
  }
  if (interval.endBoundary === "RIGHT_BOUND_UNKNOWN") {
    return notCalculated(interval, sourceCoverage, "RIGHT_BOUND_UNKNOWN");
  }
  if (interval.fazendaId.length === 0) {
    return notCalculated(interval, "CONFLICTED", "CROSS_FARM_INTERVAL");
  }

  const boundary = resolveIntervalBoundary(interval, referenceDate);
  if ("limitation" in boundary) {
    return notCalculated(interval, sourceCoverage, boundary.limitation);
  }
  if (
    conflictAffectsInterval(
      conflicts,
      boundary.start,
      boundary.end,
      interval.endBoundary === "OPEN",
    )
  ) {
    return notCalculated(interval, "CONFLICTED", "CONFLICT_AFFECTS_BOUNDARY");
  }

  const clipped = clipToRequestedPeriod(boundary.start, boundary.end, period);
  if ("limitation" in clipped) {
    return notCalculated(interval, sourceCoverage, clipped.limitation);
  }

  const durationMs = clipped.end - clipped.start;
  return {
    ...interval,
    effectiveFrom: new Date(clipped.start).toISOString(),
    effectiveTo: new Date(clipped.end).toISOString(),
    calculation: "CALCULATED",
    durationMs,
    durationDays: durationMs / OCCUPANCY_DAY_MS,
    endBasis: boundary.endBasis,
    coverage: sourceCoverage,
    limitationCodes: [],
  };
}

function qualify(
  dimension: QualifiedOccupancyDimension,
  animalId: string,
  fazendaId: string,
  sourceStatus: HistoricalLotOccupancyResult["status"],
  sourceCoverage: QualifiedOccupancyDurationResult["sourceCoverage"],
  intervals: readonly NormalizedSourceInterval[],
  limitations: QualifiedOccupancyDurationResult["limitations"],
  conflicts: QualifiedOccupancyDurationResult["conflicts"],
  referenceDate: string | undefined,
  period: QualifiedOccupancyPeriod | undefined,
): QualifiedOccupancyDurationResult {
  const intervalCoverage = coverageFromSource(sourceCoverage, conflicts.length > 0);
  const qualifiedIntervals = [...intervals]
    .sort((left, right) => {
      const leftTime = validTimestamp(left.enteredAt) ?? Number.NEGATIVE_INFINITY;
      const rightTime = validTimestamp(right.enteredAt) ?? Number.NEGATIVE_INFINITY;
      return leftTime - rightTime || left.loteId.localeCompare(right.loteId);
    })
    .map((interval) => {
      if (interval.fazendaId !== fazendaId || interval.animalId !== animalId) {
        return notCalculated(interval, "CONFLICTED", "CROSS_FARM_INTERVAL");
      }
      return qualifyInterval(
        interval,
        intervalCoverage,
        conflicts,
        referenceDate,
        period,
      );
    });

  return {
    dimension,
    animalId,
    fazendaId,
    sourceStatus,
    sourceCoverage,
    intervals: qualifiedIntervals,
    limitations:
      sourceStatus === "NO_HISTORY"
        ? [
            ...limitations,
            { source: dimension, code: "SOURCE_NO_HISTORY", eventIds: [] },
          ]
        : limitations,
    conflicts,
  };
}

export function qualifyHistoricalLotOccupancyDuration({
  result,
  referenceDate,
  period,
}: QualifyInput<HistoricalLotOccupancyResult>): QualifiedOccupancyDurationResult {
  const intervals: NormalizedSourceInterval[] = result.intervals.map(
    (interval: HistoricalLotOccupancyInterval) => ({
      dimension: "LOT",
      animalId: interval.animalId,
      fazendaId: interval.fazendaId,
      loteId: interval.loteId,
      pastoId: null,
      enteredAt: interval.enteredAt,
      leftAt: interval.leftAt,
      startBoundary: interval.startBoundary,
      endBoundary: interval.endBoundary,
      lotOccupancySourceEventIds: [...interval.sourceEventIds],
      pastureSourceEventIds: [],
    }),
  );

  return qualify(
    "LOT",
    result.animalId,
    result.fazendaId,
    result.status,
    result.coverage.history,
    intervals,
    result.limitations.map((limitation) => ({
      source: "ANIMAL_LOT",
      code: limitation.code,
      eventIds: [...limitation.eventIds],
    })),
    result.conflicts.map((conflict) => ({
      source: "ANIMAL_LOT",
      code: conflict.code,
      occurredAt: conflict.occurredAt,
      eventIds: [...conflict.eventIds],
      description: conflict.description,
    })),
    referenceDate,
    period,
  );
}

export function qualifyHistoricalPastureOccupancyDuration({
  result,
  referenceDate,
  period,
}: QualifyInput<HistoricalPastureOccupancyResult>): QualifiedOccupancyDurationResult {
  const intervals: NormalizedSourceInterval[] = result.intervals.map(
    (interval: HistoricalPastureOccupancyInterval) => ({
      dimension: "PASTURE",
      animalId: interval.animalId,
      fazendaId: interval.fazendaId,
      loteId: interval.loteId,
      pastoId: interval.pastoId,
      enteredAt: interval.enteredAt,
      leftAt: interval.leftAt,
      startBoundary: interval.startBoundary,
      endBoundary: interval.endBoundary,
      lotOccupancySourceEventIds: [...interval.lotOccupancySourceEventIds],
      pastureSourceEventIds: [...interval.pastureSourceEventIds],
    }),
  );

  return qualify(
    "PASTURE",
    result.animalId,
    result.fazendaId,
    result.status,
    result.coverage.history,
    intervals,
    result.limitations.map((limitation) => ({
      source: limitation.source,
      code: limitation.code,
      eventIds: [...limitation.eventIds],
    })),
    result.conflicts.map((conflict) => ({
      source: conflict.source,
      code: conflict.code,
      occurredAt: conflict.occurredAt,
      eventIds: [...conflict.eventIds],
      description: conflict.description,
    })),
    referenceDate,
    period,
  );
}
