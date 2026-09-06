import type { Evento, EventoPesagem } from "@/lib/offline/types";
import {
  selectObservedWeightEvidence,
  type ObservedWeightConflict,
  type ObservedWeightLimitation,
  type ObservedWeightObservation,
} from "@/lib/insights/observedWeightEvidence";
import type {
  QualifiedOccupancyDurationResult,
  QualifiedOccupancyInterval,
} from "./qualifiedOccupancyDuration";

const DAY_MS = 86_400_000;

export type OccupancyPerformanceCoverage =
  | "FULL_BOUNDARY_COVERAGE"
  | "PARTIAL_WEIGHT_COVERAGE"
  | "INSUFFICIENT_WEIGHT_EVIDENCE"
  | "CONFLICT";

export interface ObservedOccupancyPerformanceInterval {
  contract: "OBSERVED_WITHIN_OCCUPANCY";
  status: "CALCULATED" | "NOT_CALCULATED";
  dimension: "LOT" | "PASTURE";
  animalId: string;
  fazendaId: string;
  loteId: string;
  pastoId: string | null;
  occupancyEnteredAt: string | null;
  occupancyLeftAt: string | null;
  initialObservedWeight: ObservedWeightObservation | null;
  finalObservedWeight: ObservedWeightObservation | null;
  weightDeltaKg: number | null;
  observedDaysBetweenWeights: number | null;
  observedGmdKgPerDay: number | null;
  coverage: OccupancyPerformanceCoverage;
  reliability: "UNCLASSIFIED";
  operationalUse: "NOT_AUTHORIZED";
  occupancyCoverage: QualifiedOccupancyInterval["coverage"];
  limitations: ObservedWeightLimitation[];
  conflicts: ObservedWeightConflict[];
  lotOccupancySourceEventIds: string[];
  pastureSourceEventIds: string[];
  weightSourceEventIds: string[];
}

export interface OccupancyPerformanceResult {
  dimension: "LOT" | "PASTURE";
  animalId: string;
  fazendaId: string;
  intervals: ObservedOccupancyPerformanceInterval[];
}

export interface OccupancyPerformanceAggregate {
  dimension: "LOT" | "PASTURE";
  groupId: string;
  fazendaId: string;
  animalIds: string[];
  meanInitialObservedWeightKg: number | null;
  meanFinalObservedWeightKg: number | null;
  meanWeightDeltaKg: number | null;
  meanObservedGmdKgPerDay: number | null;
  calculatedIntervals: number;
  unavailableIntervals: number;
  coverage: OccupancyPerformanceCoverage;
  reliability: "UNCLASSIFIED";
  operationalUse: "NOT_AUTHORIZED";
  limitations: ObservedWeightLimitation[];
  conflicts: ObservedWeightConflict[];
}

export interface OccupancyPerformanceAggregation {
  results: OccupancyPerformanceResult[];
  byAnimal: OccupancyPerformanceAggregate[];
  byGroup: OccupancyPerformanceAggregate[];
}

export interface BuildOccupancyPerformanceInput {
  qualifiedResults: readonly QualifiedOccupancyDurationResult[];
  events: readonly Evento[];
  weightDetails: readonly EventoPesagem[];
  referenceDate: string;
}

function timestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function occupancyBounds(interval: QualifiedOccupancyInterval): {
  start: number | null;
  end: number | null;
} {
  return {
    start: interval.startBoundary === "KNOWN" ? timestamp(interval.enteredAt) : null,
    end:
      interval.endBoundary === "KNOWN"
        ? timestamp(interval.leftAt)
        : interval.endBoundary === "OPEN"
          ? timestamp(interval.effectiveTo)
          : null,
  };
}

function isWithinInterval(
  observation: ObservedWeightObservation,
  interval: QualifiedOccupancyInterval,
): boolean {
  const measuredAt = timestamp(observation.measuredAt);
  if (measuredAt === null) return false;
  const { start, end } = occupancyBounds(interval);
  if (start === null && end === null) return false;
  return (start === null || measuredAt >= start) && (end === null || measuredAt <= end);
}

function conflictsWithinInterval(
  conflicts: readonly ObservedWeightConflict[],
  interval: QualifiedOccupancyInterval,
): ObservedWeightConflict[] {
  return conflicts.filter((conflict) => {
    if (conflict.measuredAt === null) return true;
    return isWithinInterval(
      {
        animalId: interval.animalId,
        fazendaId: interval.fazendaId,
        eventId: conflict.eventIds[0] ?? "unknown",
        weightKg: 1,
        unit: "kg",
        measuredAt: conflict.measuredAt,
      },
      interval,
    );
  });
}

function unavailableInterval(
  interval: QualifiedOccupancyInterval,
  coverage: OccupancyPerformanceCoverage,
  limitations: readonly ObservedWeightLimitation[],
  conflicts: readonly ObservedWeightConflict[],
): ObservedOccupancyPerformanceInterval {
  return {
    contract: "OBSERVED_WITHIN_OCCUPANCY",
    status: "NOT_CALCULATED",
    dimension: interval.dimension,
    animalId: interval.animalId,
    fazendaId: interval.fazendaId,
    loteId: interval.loteId,
    pastoId: interval.pastoId,
    occupancyEnteredAt: interval.enteredAt,
    occupancyLeftAt: interval.leftAt,
    initialObservedWeight: null,
    finalObservedWeight: null,
    weightDeltaKg: null,
    observedDaysBetweenWeights: null,
    observedGmdKgPerDay: null,
    coverage,
    reliability: "UNCLASSIFIED",
    operationalUse: "NOT_AUTHORIZED",
    occupancyCoverage: interval.coverage,
    limitations: limitations.map((limitation) => ({
      ...limitation,
      recordIds: [...limitation.recordIds],
    })),
    conflicts: conflicts.map((conflict) => ({
      ...conflict,
      eventIds: [...conflict.eventIds],
    })),
    lotOccupancySourceEventIds: [...interval.lotOccupancySourceEventIds],
    pastureSourceEventIds: [...interval.pastureSourceEventIds],
    weightSourceEventIds: [],
  };
}

function performanceCoverage(
  interval: QualifiedOccupancyInterval,
  initial: ObservedWeightObservation,
  final: ObservedWeightObservation,
): OccupancyPerformanceCoverage {
  const hasFactualBoundaries =
    interval.startBoundary === "KNOWN" && interval.endBoundary === "KNOWN";
  const matchesBoundaries =
    initial.measuredAt === interval.enteredAt && final.measuredAt === interval.leftAt;
  return hasFactualBoundaries && matchesBoundaries
    ? "FULL_BOUNDARY_COVERAGE"
    : "PARTIAL_WEIGHT_COVERAGE";
}

function qualifyIntervalPerformance(
  interval: QualifiedOccupancyInterval,
  observations: readonly ObservedWeightObservation[],
  conflicts: readonly ObservedWeightConflict[],
  limitations: readonly ObservedWeightLimitation[],
): ObservedOccupancyPerformanceInterval {
  const intervalConflicts = conflictsWithinInterval(conflicts, interval);
  if (interval.coverage === "CONFLICTED" || intervalConflicts.length > 0) {
    return unavailableInterval(interval, "CONFLICT", limitations, intervalConflicts);
  }

  const within = observations.filter((observation) =>
    isWithinInterval(observation, interval),
  );
  if (within.length < 2) {
    return unavailableInterval(
      interval,
      "INSUFFICIENT_WEIGHT_EVIDENCE",
      limitations,
      [],
    );
  }

  const initial = within[0];
  const final = within[within.length - 1];
  const observedDaysBetweenWeights =
    (Date.parse(final.measuredAt) - Date.parse(initial.measuredAt)) / DAY_MS;
  if (observedDaysBetweenWeights <= 0) {
    return unavailableInterval(interval, "CONFLICT", limitations, [
      {
        code: "MEASUREMENT_TIMESTAMP_CONFLICT",
        measuredAt: initial.measuredAt,
        eventIds: [initial.eventId, final.eventId],
      },
    ]);
  }

  const weightDeltaKg = final.weightKg - initial.weightKg;
  return {
    ...unavailableInterval(interval, performanceCoverage(interval, initial, final), limitations, []),
    status: "CALCULATED",
    initialObservedWeight: { ...initial },
    finalObservedWeight: { ...final },
    weightDeltaKg,
    observedDaysBetweenWeights,
    observedGmdKgPerDay: weightDeltaKg / observedDaysBetweenWeights,
    weightSourceEventIds: [initial.eventId, final.eventId],
  };
}

function buildResult(
  qualified: QualifiedOccupancyDurationResult,
  input: BuildOccupancyPerformanceInput,
): OccupancyPerformanceResult {
  const evidence = selectObservedWeightEvidence({
    fazendaId: qualified.fazendaId,
    animalId: qualified.animalId,
    animal: {
      id: qualified.animalId,
      fazenda_id: qualified.fazendaId,
      deleted_at: null,
    },
    events: input.events,
    weightDetails: input.weightDetails,
    referenceDate: input.referenceDate,
  });
  const observations = evidence.status === "available" ? evidence.observations : [];
  const conflicts = evidence.status === "available" ? evidence.conflicts : [];
  return {
    dimension: qualified.dimension,
    animalId: qualified.animalId,
    fazendaId: qualified.fazendaId,
    intervals: qualified.intervals.map((interval) =>
      qualifyIntervalPerformance(
        interval,
        observations,
        conflicts,
        evidence.limitations,
      ),
    ),
  };
}

interface AggregateAccumulator {
  dimension: "LOT" | "PASTURE";
  groupId: string;
  fazendaId: string;
  animalIds: Set<string>;
  intervals: ObservedOccupancyPerformanceInterval[];
}

function distinctBy<T>(values: readonly T[], signature: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [signature(value), value])).values()];
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateCoverage(
  intervals: readonly ObservedOccupancyPerformanceInterval[],
): OccupancyPerformanceCoverage {
  if (intervals.some((interval) => interval.coverage === "CONFLICT")) {
    return "CONFLICT";
  }
  const calculated = intervals.filter((interval) => interval.status === "CALCULATED");
  if (calculated.length === 0) return "INSUFFICIENT_WEIGHT_EVIDENCE";
  return calculated.length === intervals.length &&
    calculated.every((interval) => interval.coverage === "FULL_BOUNDARY_COVERAGE")
    ? "FULL_BOUNDARY_COVERAGE"
    : "PARTIAL_WEIGHT_COVERAGE";
}

function finalizeAggregate(accumulator: AggregateAccumulator): OccupancyPerformanceAggregate {
  const calculated = accumulator.intervals.filter(
    (interval) => interval.status === "CALCULATED",
  );
  return {
    dimension: accumulator.dimension,
    groupId: accumulator.groupId,
    fazendaId: accumulator.fazendaId,
    animalIds: [...accumulator.animalIds].sort(),
    meanInitialObservedWeightKg: average(
      calculated.map((interval) => interval.initialObservedWeight!.weightKg),
    ),
    meanFinalObservedWeightKg: average(
      calculated.map((interval) => interval.finalObservedWeight!.weightKg),
    ),
    meanWeightDeltaKg: average(calculated.map((interval) => interval.weightDeltaKg!)),
    meanObservedGmdKgPerDay: average(
      calculated.map((interval) => interval.observedGmdKgPerDay!),
    ),
    calculatedIntervals: calculated.length,
    unavailableIntervals: accumulator.intervals.length - calculated.length,
    coverage: aggregateCoverage(accumulator.intervals),
    reliability: "UNCLASSIFIED",
    operationalUse: "NOT_AUTHORIZED",
    limitations: distinctBy(
      accumulator.intervals.flatMap((interval) => interval.limitations),
      (limitation) => `${limitation.code}|${[...limitation.recordIds].sort().join(",")}`,
    ),
    conflicts: distinctBy(
      accumulator.intervals.flatMap((interval) => interval.conflicts),
      (conflict) => `${conflict.code}|${conflict.measuredAt ?? ""}|${[...conflict.eventIds].sort().join(",")}`,
    ),
  };
}

function aggregate(
  results: readonly OccupancyPerformanceResult[],
  byAnimal: boolean,
): OccupancyPerformanceAggregate[] {
  const groups = new Map<string, AggregateAccumulator>();
  for (const result of results) {
    for (const interval of result.intervals) {
      const groupId = byAnimal
        ? interval.animalId
        : interval.dimension === "LOT"
          ? interval.loteId
          : interval.pastoId;
      if (groupId === null) continue;
      const key = `${interval.fazendaId}|${interval.dimension}|${groupId}`;
      const current = groups.get(key) ?? {
        dimension: interval.dimension,
        groupId,
        fazendaId: interval.fazendaId,
        animalIds: new Set<string>(),
        intervals: [],
      };
      current.animalIds.add(interval.animalId);
      current.intervals.push(interval);
      groups.set(key, current);
    }
  }
  return [...groups.values()].map(finalizeAggregate).sort((left, right) =>
    left.fazendaId.localeCompare(right.fazendaId) || left.groupId.localeCompare(right.groupId),
  );
}

export function buildObservedOccupancyPerformance(
  input: BuildOccupancyPerformanceInput,
): OccupancyPerformanceAggregation {
  const results = input.qualifiedResults.map((qualified) =>
    buildResult(qualified, input),
  );
  return {
    results,
    byAnimal: aggregate(results, true),
    byGroup: aggregate(results, false),
  };
}
