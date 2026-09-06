import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import {
  selectHistoricalLotOccupancy,
  type HistoricalLotOccupancyInterval,
  type HistoricalLotOccupancyResult,
} from "./historicalLotOccupancy";
import {
  selectHistoricalLotPastureOccupancy,
  type HistoricalLotPastureInterval,
  type HistoricalLotPastureResult,
  type HistoricalLotPastureStatus,
} from "./historicalLotPastureOccupancy";

export type HistoricalPastureOccupancyStatus =
  | "READY"
  | "PARTIAL"
  | "NO_HISTORY"
  | "CONFLICT";

export interface HistoricalPastureOccupancyInterval {
  animalId: string;
  fazendaId: string;
  loteId: string;
  pastoId: string;
  enteredAt: string | null;
  leftAt: string | null;
  startBoundary: "KNOWN" | "LEFT_BOUND_UNKNOWN";
  endBoundary: "KNOWN" | "OPEN" | "RIGHT_BOUND_UNKNOWN";
  lotOccupancySourceEventIds: string[];
  pastureSourceEventIds: string[];
}

export interface HistoricalPastureUnknownPeriod {
  loteId: string;
  enteredAt: string | null;
  leftAt: string | null;
  lotOccupancySourceEventIds: string[];
}

export interface HistoricalPastureOccupancyLimitation {
  source: "ANIMAL_LOT" | "LOT_PASTURE" | "COMPOSITION";
  code: string;
  loteId: string | null;
  eventIds: string[];
  affectsCoverage: boolean;
  unknownPeriod?: HistoricalPastureUnknownPeriod;
}

export interface HistoricalPastureOccupancyConflict {
  source: "ANIMAL_LOT" | "LOT_PASTURE";
  code: string;
  loteId: string | null;
  occurredAt: string | null;
  eventIds: string[];
  description: string;
}

export type HistoricalPastureHistoryCoverage =
  | "NO_HISTORY"
  | "PARTIAL_HISTORY"
  | "CONTIGUOUS_HISTORY"
  | "CONFLICTED_HISTORY";

export interface HistoricalPastureOccupancyCoverage {
  history: HistoricalPastureHistoryCoverage;
  leftBoundary:
    | "KNOWN_LEFT_BOUND"
    | "LEFT_BOUND_UNKNOWN"
    | "NOT_AVAILABLE";
  rightBoundary:
    | "KNOWN_RIGHT_BOUND"
    | "OPEN_RIGHT_BOUND"
    | "RIGHT_BOUND_UNKNOWN"
    | "NOT_AVAILABLE";
  animalLotStatus: HistoricalLotOccupancyResult["status"];
  lotPastureStatuses: Record<string, HistoricalLotPastureStatus>;
  unknownPasturePeriods: HistoricalPastureUnknownPeriod[];
}

export interface HistoricalPastureOccupancyResult {
  status: HistoricalPastureOccupancyStatus;
  animalId: string;
  fazendaId: string;
  referenceDate: string;
  intervals: HistoricalPastureOccupancyInterval[];
  coverage: HistoricalPastureOccupancyCoverage;
  limitations: HistoricalPastureOccupancyLimitation[];
  conflicts: HistoricalPastureOccupancyConflict[];
}

export interface ComposeHistoricalPastureOccupancyInput {
  lotOccupancy: HistoricalLotOccupancyResult;
  lotPastureOccupancies: readonly HistoricalLotPastureResult[];
}

export interface SelectHistoricalPastureOccupancyInput {
  animalId: string;
  fazendaId: string;
  referenceDate: string;
  events: readonly Evento[];
  movementDetails: readonly EventoMovimentacao[];
}

interface NumericSegment {
  start: number;
  end: number;
}

interface Intersection {
  interval: HistoricalPastureOccupancyInterval;
  segment: NumericSegment;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function startTimestamp(value: string | null): number {
  return value === null ? Number.NEGATIVE_INFINITY : Date.parse(value);
}

function endTimestamp(value: string | null, referenceTimestamp: number): number {
  return value === null ? referenceTimestamp : Date.parse(value);
}

function laterStart(
  animalInterval: HistoricalLotOccupancyInterval,
  pastureInterval: HistoricalLotPastureInterval,
): string | null {
  if (animalInterval.enteredAt === null) return pastureInterval.enteredAt;
  if (pastureInterval.enteredAt === null) return animalInterval.enteredAt;
  return Date.parse(animalInterval.enteredAt) >= Date.parse(pastureInterval.enteredAt)
    ? animalInterval.enteredAt
    : pastureInterval.enteredAt;
}

function earlierEnd(
  animalInterval: HistoricalLotOccupancyInterval,
  pastureInterval: HistoricalLotPastureInterval,
): string | null {
  if (animalInterval.leftAt === null) return pastureInterval.leftAt;
  if (pastureInterval.leftAt === null) return animalInterval.leftAt;
  return Date.parse(animalInterval.leftAt) <= Date.parse(pastureInterval.leftAt)
    ? animalInterval.leftAt
    : pastureInterval.leftAt;
}

function composedStartBoundary(
  animalInterval: HistoricalLotOccupancyInterval,
  pastureInterval: HistoricalLotPastureInterval,
): HistoricalPastureOccupancyInterval["startBoundary"] {
  return animalInterval.startBoundary === "LEFT_BOUND_UNKNOWN" ||
    pastureInterval.startBoundary === "LEFT_BOUND_UNKNOWN"
    ? "LEFT_BOUND_UNKNOWN"
    : "KNOWN";
}

function composedEndBoundary(
  animalInterval: HistoricalLotOccupancyInterval,
  pastureInterval: HistoricalLotPastureInterval,
  leftAt: string | null,
): HistoricalPastureOccupancyInterval["endBoundary"] {
  if (
    animalInterval.endBoundary === "RIGHT_BOUND_UNKNOWN" ||
    pastureInterval.endBoundary === "RIGHT_BOUND_UNKNOWN"
  ) {
    return "RIGHT_BOUND_UNKNOWN";
  }
  return leftAt === null ? "OPEN" : "KNOWN";
}

function intersectIntervals(
  animalInterval: HistoricalLotOccupancyInterval,
  pastureInterval: HistoricalLotPastureInterval,
  referenceTimestamp: number,
): Intersection | null {
  const start = Math.max(
    startTimestamp(animalInterval.enteredAt),
    startTimestamp(pastureInterval.enteredAt),
  );
  const end = Math.min(
    endTimestamp(animalInterval.leftAt, referenceTimestamp),
    endTimestamp(pastureInterval.leftAt, referenceTimestamp),
  );
  if (start >= end) return null;
  const leftAt = earlierEnd(animalInterval, pastureInterval);
  return {
    segment: { start, end },
    interval: {
      animalId: animalInterval.animalId,
      fazendaId: animalInterval.fazendaId,
      loteId: animalInterval.loteId,
      pastoId: pastureInterval.pastoId,
      enteredAt: laterStart(animalInterval, pastureInterval),
      leftAt,
      startBoundary: composedStartBoundary(animalInterval, pastureInterval),
      endBoundary: composedEndBoundary(
        animalInterval,
        pastureInterval,
        leftAt,
      ),
      lotOccupancySourceEventIds: [...animalInterval.sourceEventIds],
      pastureSourceEventIds: [...pastureInterval.sourceEventIds],
    },
  };
}

function mergeSegments(segments: readonly NumericSegment[]): NumericSegment[] {
  const ordered = [...segments].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: NumericSegment[] = [];
  for (const segment of ordered) {
    const last = merged[merged.length - 1];
    if (!last || segment.start > last.end) {
      merged.push({ ...segment });
    } else {
      last.end = Math.max(last.end, segment.end);
    }
  }
  return merged;
}

function boundaryValue(
  timestamp: number,
  intervalValue: string | null,
  referenceTimestamp: number,
): string | null {
  if (!Number.isFinite(timestamp) || timestamp === referenceTimestamp) {
    return intervalValue;
  }
  return new Date(timestamp).toISOString();
}

function findUnknownPeriods(
  animalInterval: HistoricalLotOccupancyInterval,
  coveredSegments: readonly NumericSegment[],
  referenceTimestamp: number,
): HistoricalPastureUnknownPeriod[] {
  const animalStart = startTimestamp(animalInterval.enteredAt);
  const animalEnd = endTimestamp(animalInterval.leftAt, referenceTimestamp);
  const unknown: HistoricalPastureUnknownPeriod[] = [];
  let cursor = animalStart;
  for (const segment of mergeSegments(coveredSegments)) {
    if (segment.start > cursor) {
      unknown.push({
        loteId: animalInterval.loteId,
        enteredAt: boundaryValue(
          cursor,
          animalInterval.enteredAt,
          referenceTimestamp,
        ),
        leftAt: boundaryValue(
          segment.start,
          animalInterval.leftAt,
          referenceTimestamp,
        ),
        lotOccupancySourceEventIds: [...animalInterval.sourceEventIds],
      });
    }
    cursor = Math.max(cursor, segment.end);
  }
  if (cursor < animalEnd) {
    unknown.push({
      loteId: animalInterval.loteId,
      enteredAt: boundaryValue(
        cursor,
        animalInterval.enteredAt,
        referenceTimestamp,
      ),
      leftAt: boundaryValue(
        animalEnd,
        animalInterval.leftAt,
        referenceTimestamp,
      ),
      lotOccupancySourceEventIds: [...animalInterval.sourceEventIds],
    });
  }
  return unknown;
}

function collectSourceLimitations(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
): HistoricalPastureOccupancyLimitation[] {
  const animalLimitations = lotOccupancy.limitations.map((limitation) => ({
    source: "ANIMAL_LOT" as const,
    code: limitation.code,
    loteId: null,
    eventIds: [...limitation.eventIds],
    affectsCoverage: limitation.affectsCoverage,
  }));
  const pastureLimitations = lotPastureOccupancies.flatMap((result) =>
    result.limitations.map((limitation) => ({
      source: "LOT_PASTURE" as const,
      code: limitation.code,
      loteId: result.loteId,
      eventIds: [...limitation.eventIds],
      affectsCoverage: limitation.affectsCoverage,
    })),
  );
  return [...animalLimitations, ...pastureLimitations];
}

function collectSourceConflicts(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
): HistoricalPastureOccupancyConflict[] {
  const animalConflicts = lotOccupancy.conflicts.map((conflict) => ({
    source: "ANIMAL_LOT" as const,
    code: conflict.code,
    loteId: null,
    occurredAt: conflict.occurredAt,
    eventIds: [...conflict.eventIds],
    description: conflict.description,
  }));
  const pastureConflicts = lotPastureOccupancies.flatMap((result) =>
    result.conflicts.map((conflict) => ({
      source: "LOT_PASTURE" as const,
      code: conflict.code,
      loteId: result.loteId,
      occurredAt: conflict.occurredAt,
      eventIds: [...conflict.eventIds],
      description: conflict.description,
    })),
  );
  return [...animalConflicts, ...pastureConflicts];
}

function composedHistoryCoverage(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
  intervals: readonly HistoricalPastureOccupancyInterval[],
  unknownPeriods: readonly HistoricalPastureUnknownPeriod[],
  hasConflicts: boolean,
): HistoricalPastureHistoryCoverage {
  if (hasConflicts) return "CONFLICTED_HISTORY";
  if (intervals.length === 0 && lotOccupancy.status === "NO_HISTORY") {
    return "NO_HISTORY";
  }
  const partialSource =
    lotOccupancy.status === "PARTIAL" ||
    lotPastureOccupancies.some((result) => result.status !== "READY");
  const unknownBoundary = intervals.some(
    (interval) =>
      interval.startBoundary === "LEFT_BOUND_UNKNOWN" ||
      interval.endBoundary === "RIGHT_BOUND_UNKNOWN",
  );
  return intervals.length === 0 ||
    unknownPeriods.length > 0 ||
    partialSource ||
    unknownBoundary
    ? "PARTIAL_HISTORY"
    : "CONTIGUOUS_HISTORY";
}

function composedLeftCoverage(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
  intervals: readonly HistoricalPastureOccupancyInterval[],
): HistoricalPastureOccupancyCoverage["leftBoundary"] {
  if (intervals.length === 0) return "NOT_AVAILABLE";
  const sourceIsUnknown =
    lotOccupancy.coverage.leftBoundary === "LEFT_BOUND_UNKNOWN" ||
    lotPastureOccupancies.some(
      (result) => result.coverage.leftBoundary === "LEFT_BOUND_UNKNOWN",
    );
  const resultIsUnknown = intervals.some(
    (interval) => interval.startBoundary === "LEFT_BOUND_UNKNOWN",
  );
  return sourceIsUnknown || resultIsUnknown
    ? "LEFT_BOUND_UNKNOWN"
    : "KNOWN_LEFT_BOUND";
}

function composedRightCoverage(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
  intervals: readonly HistoricalPastureOccupancyInterval[],
): HistoricalPastureOccupancyCoverage["rightBoundary"] {
  const last = intervals[intervals.length - 1];
  if (!last) return "NOT_AVAILABLE";
  const sourceIsUnknown =
    lotOccupancy.coverage.rightBoundary === "RIGHT_BOUND_UNKNOWN" ||
    lotPastureOccupancies.some(
      (result) => result.coverage.rightBoundary === "RIGHT_BOUND_UNKNOWN",
    );
  if (sourceIsUnknown || last.endBoundary === "RIGHT_BOUND_UNKNOWN") {
    return "RIGHT_BOUND_UNKNOWN";
  }
  return last.endBoundary === "OPEN"
    ? "OPEN_RIGHT_BOUND"
    : "KNOWN_RIGHT_BOUND";
}

function coverageFor(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
  intervals: readonly HistoricalPastureOccupancyInterval[],
  unknownPeriods: readonly HistoricalPastureUnknownPeriod[],
  conflicts: readonly HistoricalPastureOccupancyConflict[],
): HistoricalPastureOccupancyCoverage {
  const statuses = Object.fromEntries(
    lotPastureOccupancies.map((result) => [result.loteId, result.status]),
  );
  return {
    history: composedHistoryCoverage(
      lotOccupancy,
      lotPastureOccupancies,
      intervals,
      unknownPeriods,
      conflicts.length > 0,
    ),
    leftBoundary: composedLeftCoverage(
      lotOccupancy,
      lotPastureOccupancies,
      intervals,
    ),
    rightBoundary: composedRightCoverage(
      lotOccupancy,
      lotPastureOccupancies,
      intervals,
    ),
    animalLotStatus: lotOccupancy.status,
    lotPastureStatuses: statuses,
    unknownPasturePeriods: unknownPeriods.map((period) => ({
      ...period,
      lotOccupancySourceEventIds: [...period.lotOccupancySourceEventIds],
    })),
  };
}

function statusFor(
  coverage: HistoricalPastureOccupancyCoverage,
): HistoricalPastureOccupancyStatus {
  if (coverage.history === "CONFLICTED_HISTORY") return "CONFLICT";
  if (coverage.history === "NO_HISTORY") return "NO_HISTORY";
  if (coverage.history === "PARTIAL_HISTORY") return "PARTIAL";
  return "READY";
}

function relevantPastureMap(
  lotOccupancy: HistoricalLotOccupancyResult,
  lotPastureOccupancies: readonly HistoricalLotPastureResult[],
): Map<string, HistoricalLotPastureResult> {
  const loteIds = new Set(
    lotOccupancy.intervals.map((interval) => interval.loteId),
  );
  return new Map(
    lotPastureOccupancies
      .filter(
        (result) =>
          loteIds.has(result.loteId) &&
          result.fazendaId === lotOccupancy.fazendaId &&
          result.referenceDate === lotOccupancy.referenceDate,
      )
      .map((result) => [result.loteId, result]),
  );
}

function composeIntervals(
  lotOccupancy: HistoricalLotOccupancyResult,
  byLote: ReadonlyMap<string, HistoricalLotPastureResult>,
  referenceTimestamp: number,
): {
  intervals: HistoricalPastureOccupancyInterval[];
  unknownPeriods: HistoricalPastureUnknownPeriod[];
} {
  const intervals: HistoricalPastureOccupancyInterval[] = [];
  const unknownPeriods: HistoricalPastureUnknownPeriod[] = [];
  for (const animalInterval of lotOccupancy.intervals) {
    const pastureResult = byLote.get(animalInterval.loteId);
    const intersections = (pastureResult?.intervals ?? [])
      .map((pastureInterval) =>
        intersectIntervals(animalInterval, pastureInterval, referenceTimestamp),
      )
      .filter((value): value is Intersection => value !== null);
    intervals.push(...intersections.map((intersection) => intersection.interval));
    unknownPeriods.push(
      ...findUnknownPeriods(
        animalInterval,
        intersections.map((intersection) => intersection.segment),
        referenceTimestamp,
      ),
    );
  }
  intervals.sort((left, right) => {
    const timeDifference =
      startTimestamp(left.enteredAt) - startTimestamp(right.enteredAt);
    return (
      timeDifference ||
      left.loteId.localeCompare(right.loteId) ||
      left.pastoId.localeCompare(right.pastoId)
    );
  });
  return { intervals, unknownPeriods };
}

function unknownPeriodLimitations(
  periods: readonly HistoricalPastureUnknownPeriod[],
): HistoricalPastureOccupancyLimitation[] {
  return periods.map((period) => ({
    source: "COMPOSITION",
    code: "PASTURE_UNKNOWN",
    loteId: period.loteId,
    eventIds: [...period.lotOccupancySourceEventIds],
    affectsCoverage: true,
    unknownPeriod: period,
  }));
}

export function composeHistoricalPastureOccupancy(
  input: ComposeHistoricalPastureOccupancyInput,
): HistoricalPastureOccupancyResult {
  const { lotOccupancy, lotPastureOccupancies } = input;
  const referenceTimestamp = Date.parse(lotOccupancy.referenceDate);
  const byLote = relevantPastureMap(lotOccupancy, lotPastureOccupancies);
  const { intervals, unknownPeriods } = composeIntervals(
    lotOccupancy,
    byLote,
    referenceTimestamp,
  );
  const relevantPastureResults = [...byLote.values()];
  const conflicts = collectSourceConflicts(
    lotOccupancy,
    relevantPastureResults,
  );
  const limitations = collectSourceLimitations(
    lotOccupancy,
    relevantPastureResults,
  );
  limitations.push(...unknownPeriodLimitations(unknownPeriods));
  const coverage = coverageFor(
    lotOccupancy,
    relevantPastureResults,
    intervals,
    unknownPeriods,
    conflicts,
  );
  return {
    status: statusFor(coverage),
    animalId: lotOccupancy.animalId,
    fazendaId: lotOccupancy.fazendaId,
    referenceDate: lotOccupancy.referenceDate,
    intervals,
    coverage,
    limitations,
    conflicts,
  };
}

export function selectHistoricalPastureOccupancy(
  input: SelectHistoricalPastureOccupancyInput,
): HistoricalPastureOccupancyResult {
  const lotOccupancy = selectHistoricalLotOccupancy(input);
  const loteIds = uniqueSorted(
    lotOccupancy.intervals.map((interval) => interval.loteId),
  );
  const lotPastureOccupancies = loteIds.map((loteId) =>
    selectHistoricalLotPastureOccupancy({
      loteId,
      fazendaId: input.fazendaId,
      referenceDate: input.referenceDate,
      events: input.events,
      movementDetails: input.movementDetails,
    }),
  );
  return composeHistoricalPastureOccupancy({
    lotOccupancy,
    lotPastureOccupancies,
  });
}
