import type {
  QualifiedOccupancyDurationResult,
  QualifiedOccupancyInterval,
} from "./qualifiedOccupancyDuration";
import {
  qualifyHistoricalLotOccupancyDuration,
  qualifyHistoricalPastureOccupancyDuration,
  type QualifiedOccupancyPeriod,
} from "./qualifiedOccupancyDuration";
import type { HistoricalLotOccupancyResult } from "./historicalLotOccupancy";
import type { HistoricalPastureOccupancyResult } from "./historicalPastureOccupancy";

export type OccupancyAggregationCoverage =
  | "COMPLETE"
  | "PARTIAL"
  | "CONFLICTED"
  | "NO_HISTORY";

export interface OccupancyAggregate {
  dimension: "ANIMAL" | "LOT" | "PASTURE";
  groupId: string;
  fazendaId: string;
  animalIds: string[];
  knownDurationMs: number | null;
  knownDurationDays: number | null;
  meanKnownDurationMs: number | null;
  meanKnownDurationDays: number | null;
  maxKnownDurationMs: number | null;
  maxKnownDurationDays: number | null;
  knownIntervals: number;
  unknownIntervals: number;
  coverage: OccupancyAggregationCoverage;
  limitations: Array<{ source: string; code: string; eventIds: string[] }>;
  conflicts: QualifiedOccupancyDurationResult["conflicts"];
}

export interface LotOccupancyAggregation {
  qualified: QualifiedOccupancyDurationResult[];
  byAnimal: OccupancyAggregate[];
  byLote: OccupancyAggregate[];
}

export interface PastureOccupancyAggregation {
  qualified: QualifiedOccupancyDurationResult[];
  byAnimal: OccupancyAggregate[];
  byPasto: OccupancyAggregate[];
}

interface AggregateAccumulator {
  dimension: OccupancyAggregate["dimension"];
  groupId: string;
  fazendaId: string;
  animalIds: Set<string>;
  intervals: QualifiedOccupancyInterval[];
  limitations: OccupancyAggregate["limitations"];
  conflicts: OccupancyAggregate["conflicts"];
  sourceNoHistory: boolean;
}

function resolveAggregateCoverage(
  accumulator: AggregateAccumulator,
  knownCount: number,
  unknownCount: number,
): OccupancyAggregationCoverage {
  const hasConflict =
    accumulator.conflicts.length > 0 ||
    accumulator.intervals.some((interval) => interval.coverage === "CONFLICTED");
  if (hasConflict) return "CONFLICTED";

  if (
    knownCount === 0 &&
    (accumulator.sourceNoHistory || accumulator.intervals.length === 0)
  ) {
    return "NO_HISTORY";
  }

  const hasPartial =
    unknownCount > 0 ||
    accumulator.limitations.length > 0 ||
    accumulator.intervals.some(
      (interval) =>
        interval.coverage === "PARTIAL" || interval.coverage === "UNAVAILABLE",
    );
  return hasPartial ? "PARTIAL" : "COMPLETE";
}

function uniqueBy<T>(values: readonly T[], signature: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = signature(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finalize(accumulator: AggregateAccumulator): OccupancyAggregate {
  const known = accumulator.intervals.filter(
    (interval) => interval.calculation === "CALCULATED",
  );
  const unknown = accumulator.intervals.filter(
    (interval) =>
      interval.calculation === "NOT_CALCULATED" &&
      !interval.limitationCodes.includes("OUTSIDE_REQUESTED_PERIOD"),
  );
  const totalKnownDurationMs = known.reduce(
    (sum, interval) => sum + (interval.durationMs as number),
    0,
  );
  const knownDurationMs = known.length > 0 ? totalKnownDurationMs : null;
  const durations = known.map((interval) => interval.durationMs as number);
  const coverage = resolveAggregateCoverage(
    accumulator,
    known.length,
    unknown.length,
  );

  return {
    dimension: accumulator.dimension,
    groupId: accumulator.groupId,
    fazendaId: accumulator.fazendaId,
    animalIds: [...accumulator.animalIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    knownDurationMs,
    knownDurationDays:
      knownDurationMs === null ? null : knownDurationMs / 86_400_000,
    meanKnownDurationMs:
      known.length > 0 ? totalKnownDurationMs / known.length : null,
    meanKnownDurationDays:
      known.length > 0
        ? totalKnownDurationMs / known.length / 86_400_000
        : null,
    maxKnownDurationMs: durations.length > 0 ? Math.max(...durations) : null,
    maxKnownDurationDays:
      durations.length > 0 ? Math.max(...durations) / 86_400_000 : null,
    knownIntervals: known.length,
    unknownIntervals: unknown.length,
    coverage,
    limitations: uniqueBy(
      accumulator.limitations,
      (limitation) =>
        `${limitation.source}|${limitation.code}|${[...limitation.eventIds].sort().join(",")}`,
    ),
    conflicts: uniqueBy(
      accumulator.conflicts,
      (conflict) =>
        `${conflict.source}|${conflict.code}|${conflict.occurredAt ?? ""}|${[
          ...conflict.eventIds,
        ]
          .sort()
          .join(",")}`,
    ),
  };
}

function aggregateBy(
  results: readonly QualifiedOccupancyDurationResult[],
  dimension: OccupancyAggregate["dimension"],
  keyForInterval: (interval: QualifiedOccupancyInterval) => string | null,
): OccupancyAggregate[] {
  const groups = new Map<string, AggregateAccumulator>();

  const ensure = (
    groupId: string,
    result: QualifiedOccupancyDurationResult,
  ): AggregateAccumulator => {
    const key = `${result.fazendaId}|${groupId}`;
    const existing = groups.get(key);
    if (existing) return existing;
    const created: AggregateAccumulator = {
      dimension,
      groupId,
      fazendaId: result.fazendaId,
      animalIds: new Set<string>(),
      intervals: [],
      limitations: [],
      conflicts: [],
      sourceNoHistory: false,
    };
    groups.set(key, created);
    return created;
  };

  for (const result of results) {
    if (dimension === "ANIMAL") {
      const group = ensure(result.animalId, result);
      group.animalIds.add(result.animalId);
      group.intervals.push(...result.intervals);
      group.limitations.push(...result.limitations);
      group.conflicts.push(...result.conflicts);
      group.sourceNoHistory ||= result.sourceStatus === "NO_HISTORY";
      continue;
    }

    for (const interval of result.intervals) {
      const groupId = keyForInterval(interval);
      if (groupId === null) continue;
      const group = ensure(groupId, result);
      group.animalIds.add(result.animalId);
      group.intervals.push(interval);
      group.limitations.push(...result.limitations);
      group.conflicts.push(...result.conflicts);
    }
  }

  return [...groups.values()]
    .map(finalize)
    .sort(
      (left, right) =>
        left.fazendaId.localeCompare(right.fazendaId) ||
        left.groupId.localeCompare(right.groupId),
    );
}

export function aggregateQualifiedLotOccupancy(
  results: readonly QualifiedOccupancyDurationResult[],
): LotOccupancyAggregation {
  const qualified = results.filter((result) => result.dimension === "LOT");
  return {
    qualified: [...qualified],
    byAnimal: aggregateBy(qualified, "ANIMAL", (interval) => interval.animalId),
    byLote: aggregateBy(qualified, "LOT", (interval) => interval.loteId),
  };
}

export function aggregateQualifiedPastureOccupancy(
  results: readonly QualifiedOccupancyDurationResult[],
): PastureOccupancyAggregation {
  const qualified = results.filter((result) => result.dimension === "PASTURE");
  return {
    qualified: [...qualified],
    byAnimal: aggregateBy(qualified, "ANIMAL", (interval) => interval.animalId),
    byPasto: aggregateBy(qualified, "PASTURE", (interval) => interval.pastoId),
  };
}

export function buildLotOccupancyAggregation(input: {
  results: readonly HistoricalLotOccupancyResult[];
  referenceDate?: string;
  period?: QualifiedOccupancyPeriod;
}): LotOccupancyAggregation {
  return aggregateQualifiedLotOccupancy(
    input.results.map((result) =>
      qualifyHistoricalLotOccupancyDuration({
        result,
        referenceDate: input.referenceDate,
        period: input.period,
      }),
    ),
  );
}

export function buildPastureOccupancyAggregation(input: {
  results: readonly HistoricalPastureOccupancyResult[];
  referenceDate?: string;
  period?: QualifiedOccupancyPeriod;
}): PastureOccupancyAggregation {
  return aggregateQualifiedPastureOccupancy(
    input.results.map((result) =>
      qualifyHistoricalPastureOccupancyDuration({
        result,
        referenceDate: input.referenceDate,
        period: input.period,
      }),
    ),
  );
}
