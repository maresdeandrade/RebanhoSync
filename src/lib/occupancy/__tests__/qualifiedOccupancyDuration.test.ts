import { describe, expect, it } from "vitest";
import type {
  HistoricalLotOccupancyInterval,
  HistoricalLotOccupancyResult,
} from "../historicalLotOccupancy";
import type { HistoricalPastureOccupancyResult } from "../historicalPastureOccupancy";
import {
  qualifyHistoricalLotOccupancyDuration,
  qualifyHistoricalPastureOccupancyDuration,
} from "../qualifiedOccupancyDuration";

const DAY = 86_400_000;

function lotResult(
  intervals: HistoricalLotOccupancyInterval[],
  overrides: Partial<HistoricalLotOccupancyResult> = {},
): HistoricalLotOccupancyResult {
  return {
    status: "READY",
    animalId: "animal-1",
    fazendaId: "farm-1",
    referenceDate: "2026-02-01T00:00:00.000Z",
    intervals,
    coverage: {
      history: "CONTIGUOUS_HISTORY",
      leftBoundary: "KNOWN_LEFT_BOUND",
      rightBoundary: "KNOWN_RIGHT_BOUND",
      inputEventCount: 2,
      scopedEventCount: 2,
      usableMovementCount: 2,
      appliedMovementCount: 2,
      deduplicatedEventCount: 0,
      deduplicatedDetailCount: 0,
    },
    limitations: [],
    conflicts: [],
    ...overrides,
  };
}

function lotInterval(
  overrides: Partial<HistoricalLotOccupancyInterval> = {},
): HistoricalLotOccupancyInterval {
  return {
    animalId: "animal-1",
    fazendaId: "farm-1",
    loteId: "lot-1",
    enteredAt: "2026-01-01T00:00:00.000Z",
    leftAt: "2026-01-11T00:00:00.000Z",
    startBoundary: "KNOWN",
    endBoundary: "KNOWN",
    sourceEventIds: ["event-1", "event-2"],
    ...overrides,
  };
}

function pastureResult(): HistoricalPastureOccupancyResult {
  return {
    status: "PARTIAL",
    animalId: "animal-1",
    fazendaId: "farm-1",
    referenceDate: "2026-02-01T00:00:00.000Z",
    intervals: [
      {
        animalId: "animal-1",
        fazendaId: "farm-1",
        loteId: "lot-1",
        pastoId: "pasture-1",
        enteredAt: "2026-01-01T00:00:00.000Z",
        leftAt: "2026-01-03T12:00:00.000Z",
        startBoundary: "KNOWN",
        endBoundary: "KNOWN",
        lotOccupancySourceEventIds: ["animal-lot-1"],
        pastureSourceEventIds: ["lot-pasture-1"],
      },
    ],
    coverage: {
      history: "PARTIAL_HISTORY",
      leftBoundary: "KNOWN_LEFT_BOUND",
      rightBoundary: "KNOWN_RIGHT_BOUND",
      animalLotStatus: "READY",
      lotPastureStatuses: { "lot-1": "PARTIAL" },
      unknownPasturePeriods: [],
    },
    limitations: [
      {
        source: "LOT_PASTURE",
        code: "PARTIAL_SOURCE",
        loteId: "lot-1",
        eventIds: ["lot-pasture-1"],
        affectsCoverage: true,
      },
    ],
    conflicts: [],
  };
}

describe("qualified occupancy duration", () => {
  it("calculates a closed factual interval with real millisecond precision", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([lotInterval()]),
    });

    expect(result.intervals[0]).toMatchObject({
      calculation: "CALCULATED",
      durationMs: 10 * DAY,
      durationDays: 10,
      endBasis: "FACTUAL_EXIT",
      coverage: "COMPLETE",
    });
  });

  it("uses only an explicit reference date for an open interval", () => {
    const source = lotResult([
      lotInterval({ leftAt: null, endBoundary: "OPEN" }),
    ]);

    const absent = qualifyHistoricalLotOccupancyDuration({ result: source });
    const explicit = qualifyHistoricalLotOccupancyDuration({
      result: source,
      referenceDate: "2026-01-04T12:00:00.000Z",
    });

    expect(absent.intervals[0]).toMatchObject({
      calculation: "NOT_CALCULATED",
      durationMs: null,
      limitationCodes: ["OPEN_INTERVAL_REQUIRES_REFERENCE_DATE"],
    });
    expect(explicit.intervals[0]).toMatchObject({
      calculation: "CALCULATED",
      durationMs: 3.5 * DAY,
      durationDays: 3.5,
      endBasis: "REFERENCE_DATE",
      leftAt: null,
    });
  });

  it("does not calculate unknown left or right boundaries", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([
        lotInterval({ enteredAt: null, startBoundary: "LEFT_BOUND_UNKNOWN" }),
        lotInterval({ leftAt: null, endBoundary: "RIGHT_BOUND_UNKNOWN" }),
      ]),
      referenceDate: "2026-02-01T00:00:00.000Z",
    });

    expect(result.intervals.map((interval) => interval.durationMs)).toEqual([
      null,
      null,
    ]);
    expect(result.intervals.map((interval) => interval.limitationCodes[0])).toEqual([
      "LEFT_BOUND_UNKNOWN",
      "RIGHT_BOUND_UNKNOWN",
    ]);
  });

  it("keeps NO_HISTORY unavailable instead of converting it to zero", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([], {
        status: "NO_HISTORY",
        coverage: {
          ...lotResult([]).coverage,
          history: "NO_HISTORY",
          leftBoundary: "NOT_AVAILABLE",
          rightBoundary: "NOT_AVAILABLE",
        },
      }),
    });

    expect(result.intervals).toEqual([]);
    expect(result.limitations).toContainEqual({
      source: "LOT",
      code: "SOURCE_NO_HISTORY",
      eventIds: [],
    });
  });

  it("allows a fully known prefix before a conflict and marks its coverage", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([lotInterval()], {
        status: "CONFLICT",
        coverage: {
          ...lotResult([]).coverage,
          history: "CONFLICTED_HISTORY",
        },
        conflicts: [
          {
            code: "BROKEN_CHAIN",
            occurredAt: "2026-01-20T00:00:00.000Z",
            eventIds: ["event-3"],
            description: "conflict after the known prefix",
          },
        ],
      }),
    });

    expect(result.intervals[0]).toMatchObject({
      calculation: "CALCULATED",
      durationDays: 10,
      coverage: "CONFLICTED",
    });
    expect(result.conflicts).toHaveLength(1);
  });

  it("blocks an open interval when a later conflict affects its boundary", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([lotInterval({ leftAt: null, endBoundary: "OPEN" })], {
        status: "CONFLICT",
        conflicts: [
          {
            code: "SAME_TIMESTAMP_CONFLICT",
            occurredAt: "2026-01-05T00:00:00.000Z",
            eventIds: ["event-x", "event-y"],
            description: "ambiguous destination",
          },
        ],
      }),
      referenceDate: "2026-01-10T00:00:00.000Z",
    });

    expect(result.intervals[0]).toMatchObject({
      calculation: "NOT_CALCULATED",
      durationMs: null,
      coverage: "CONFLICTED",
      limitationCodes: ["CONFLICT_AFFECTS_BOUNDARY"],
    });
  });

  it("clips duration to the requested period and excludes a disjoint interval", () => {
    const source = lotResult([lotInterval()]);
    const clipped = qualifyHistoricalLotOccupancyDuration({
      result: source,
      period: {
        from: "2026-01-04T00:00:00.000Z",
        to: "2026-01-06T12:00:00.000Z",
      },
    });
    const outside = qualifyHistoricalLotOccupancyDuration({
      result: source,
      period: {
        from: "2026-02-01T00:00:00.000Z",
        to: "2026-02-02T00:00:00.000Z",
      },
    });

    expect(clipped.intervals[0]).toMatchObject({
      durationMs: 2.5 * DAY,
      durationDays: 2.5,
      effectiveFrom: "2026-01-04T00:00:00.000Z",
      effectiveTo: "2026-01-06T12:00:00.000Z",
    });
    expect(outside.intervals[0]).toMatchObject({
      calculation: "NOT_CALCULATED",
      durationMs: null,
      limitationCodes: ["OUTSIDE_REQUESTED_PERIOD"],
    });
  });

  it("preserves factual zero and distinguishes it from unavailable duration", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([
        lotInterval({ leftAt: "2026-01-01T00:00:00.000Z" }),
        lotInterval({
          loteId: "lot-2",
          enteredAt: null,
          leftAt: "2026-01-02T00:00:00.000Z",
          startBoundary: "LEFT_BOUND_UNKNOWN",
        }),
      ]),
    });

    const factualZero = result.intervals.find(
      (interval) => interval.loteId === "lot-1",
    );
    const unavailable = result.intervals.find(
      (interval) => interval.loteId === "lot-2",
    );
    expect(factualZero?.durationMs).toBe(0);
    expect(factualZero?.calculation).toBe("CALCULATED");
    expect(unavailable?.durationMs).toBeNull();
  });

  it("rejects cross-farm interval contamination", () => {
    const result = qualifyHistoricalLotOccupancyDuration({
      result: lotResult([lotInterval({ fazendaId: "farm-2" })]),
    });

    expect(result.intervals[0]).toMatchObject({
      calculation: "NOT_CALCULATED",
      durationMs: null,
      coverage: "CONFLICTED",
      limitationCodes: ["CROSS_FARM_INTERVAL"],
    });
  });

  it("qualifies pasture intervals while preserving both provenance chains", () => {
    const result = qualifyHistoricalPastureOccupancyDuration({
      result: pastureResult(),
    });

    expect(result.intervals[0]).toMatchObject({
      dimension: "PASTURE",
      pastoId: "pasture-1",
      durationMs: 2.5 * DAY,
      durationDays: 2.5,
      coverage: "PARTIAL",
      lotOccupancySourceEventIds: ["animal-lot-1"],
      pastureSourceEventIds: ["lot-pasture-1"],
    });
    expect(result.limitations[0].source).toBe("LOT_PASTURE");
  });

  it("is independent from physical interval order and does not mutate input", () => {
    const later = lotInterval({
      loteId: "lot-2",
      enteredAt: "2026-01-20T00:00:00.000Z",
      leftAt: "2026-01-21T00:00:00.000Z",
    });
    const earlier = lotInterval();
    const source = lotResult([later, earlier]);
    const before = structuredClone(source);

    const result = qualifyHistoricalLotOccupancyDuration({ result: source });

    expect(result.intervals.map((interval) => interval.loteId)).toEqual([
      "lot-1",
      "lot-2",
    ]);
    expect(source).toEqual(before);
  });
});
