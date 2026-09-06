import { describe, expect, it } from "vitest";
import type { HistoricalLotOccupancyResult } from "../historicalLotOccupancy";
import type { HistoricalPastureOccupancyResult } from "../historicalPastureOccupancy";
import {
  buildLotOccupancyAggregation,
  buildPastureOccupancyAggregation,
} from "../occupancyAggregation";

function lotResult(
  animalId: string,
  loteId: string,
  start: string | null,
  end: string | null,
  boundaries: {
    start: "KNOWN" | "LEFT_BOUND_UNKNOWN";
    end: "KNOWN" | "OPEN" | "RIGHT_BOUND_UNKNOWN";
  } = { start: "KNOWN", end: "KNOWN" },
): HistoricalLotOccupancyResult {
  return {
    status: boundaries.start === "KNOWN" && boundaries.end !== "RIGHT_BOUND_UNKNOWN" ? "READY" : "PARTIAL",
    animalId,
    fazendaId: "farm-1",
    referenceDate: "2026-02-01T00:00:00.000Z",
    intervals: [
      {
        animalId,
        fazendaId: "farm-1",
        loteId,
        enteredAt: start,
        leftAt: end,
        startBoundary: boundaries.start,
        endBoundary: boundaries.end,
        sourceEventIds: [`${animalId}-${loteId}`],
      },
    ],
    coverage: {
      history: boundaries.start === "KNOWN" && boundaries.end !== "RIGHT_BOUND_UNKNOWN" ? "CONTIGUOUS_HISTORY" : "PARTIAL_HISTORY",
      leftBoundary: boundaries.start === "KNOWN" ? "KNOWN_LEFT_BOUND" : "LEFT_BOUND_UNKNOWN",
      rightBoundary: boundaries.end === "KNOWN" ? "KNOWN_RIGHT_BOUND" : boundaries.end === "OPEN" ? "OPEN_RIGHT_BOUND" : "RIGHT_BOUND_UNKNOWN",
      inputEventCount: 1,
      scopedEventCount: 1,
      usableMovementCount: 1,
      appliedMovementCount: 1,
      deduplicatedEventCount: 0,
      deduplicatedDetailCount: 0,
    },
    limitations: [],
    conflicts: [],
  };
}

function pastureResult(
  animalId: string,
  loteId: string,
  pastoId: string,
): HistoricalPastureOccupancyResult {
  return {
    status: "READY",
    animalId,
    fazendaId: "farm-1",
    referenceDate: "2026-01-05T00:00:00.000Z",
    intervals: [
      {
        animalId,
        fazendaId: "farm-1",
        loteId,
        pastoId,
        enteredAt: "2026-01-01T00:00:00.000Z",
        leftAt: "2026-01-03T00:00:00.000Z",
        startBoundary: "KNOWN",
        endBoundary: "KNOWN",
        lotOccupancySourceEventIds: [`animal-${animalId}`],
        pastureSourceEventIds: [`pasture-${pastoId}`],
      },
    ],
    coverage: {
      history: "CONTIGUOUS_HISTORY",
      leftBoundary: "KNOWN_LEFT_BOUND",
      rightBoundary: "KNOWN_RIGHT_BOUND",
      animalLotStatus: "READY",
      lotPastureStatuses: { [loteId]: "READY" },
      unknownPasturePeriods: [],
    },
    limitations: [],
    conflicts: [],
  };
}

describe("occupancy aggregation", () => {
  it("aggregates known and unknown lot intervals without turning absence into zero", () => {
    const aggregation = buildLotOccupancyAggregation({
      results: [
        lotResult(
          "animal-1",
          "lot-1",
          "2026-01-01T00:00:00.000Z",
          "2026-01-04T00:00:00.000Z",
        ),
        lotResult("animal-2", "lot-1", null, "2026-01-04T00:00:00.000Z", {
          start: "LEFT_BOUND_UNKNOWN",
          end: "KNOWN",
        }),
      ],
    });

    expect(aggregation.byLote[0]).toMatchObject({
      dimension: "LOT",
      groupId: "lot-1",
      knownDurationMs: 3 * 86_400_000,
      knownDurationDays: 3,
      meanKnownDurationDays: 3,
      knownIntervals: 1,
      unknownIntervals: 1,
      coverage: "PARTIAL",
      animalIds: ["animal-1", "animal-2"],
    });
    expect(aggregation.byAnimal[1]).toMatchObject({
      groupId: "animal-2",
      knownDurationMs: null,
      knownDurationDays: null,
      knownIntervals: 0,
      unknownIntervals: 1,
      meanKnownDurationDays: null,
      maxKnownDurationDays: null,
      coverage: "PARTIAL",
    });
  });

  it("aggregates open lot intervals against the explicit reference date", () => {
    const aggregation = buildLotOccupancyAggregation({
      results: [
        lotResult("animal-1", "lot-1", "2026-01-01T00:00:00.000Z", null, {
          start: "KNOWN",
          end: "OPEN",
        }),
      ],
      referenceDate: "2026-01-02T12:00:00.000Z",
    });

    expect(aggregation.byLote[0]).toMatchObject({
      knownDurationDays: 1.5,
      meanKnownDurationDays: 1.5,
      maxKnownDurationDays: 1.5,
      knownIntervals: 1,
      unknownIntervals: 0,
    });
  });

  it("does not count intervals outside the requested period as unknown", () => {
    const aggregation = buildLotOccupancyAggregation({
      results: [
        lotResult(
          "animal-1",
          "lot-1",
          "2026-01-01T00:00:00.000Z",
          "2026-01-02T00:00:00.000Z",
        ),
      ],
      period: {
        from: "2026-02-01T00:00:00.000Z",
        to: "2026-02-02T00:00:00.000Z",
      },
    });

    expect(aggregation.byLote[0]).toMatchObject({
      knownDurationMs: null,
      knownDurationDays: null,
      knownIntervals: 0,
      unknownIntervals: 0,
      meanKnownDurationDays: null,
    });
  });

  it("preserves a factual zero duration instead of marking it unavailable", () => {
    const aggregation = buildLotOccupancyAggregation({
      results: [
        lotResult(
          "animal-1",
          "lot-1",
          "2026-01-01T00:00:00.000Z",
          "2026-01-01T00:00:00.000Z",
        ),
      ],
    });

    expect(aggregation.byLote[0]).toMatchObject({
      knownDurationMs: 0,
      knownDurationDays: 0,
      knownIntervals: 1,
      unknownIntervals: 0,
    });
  });

  it("aggregates pasture duration by animal and pasture", () => {
    const aggregation = buildPastureOccupancyAggregation({
      results: [
        pastureResult("animal-1", "lot-1", "pasture-1"),
        pastureResult("animal-2", "lot-2", "pasture-1"),
      ],
    });

    expect(aggregation.byPasto[0]).toMatchObject({
      dimension: "PASTURE",
      groupId: "pasture-1",
      knownDurationDays: 4,
      meanKnownDurationDays: 2,
      maxKnownDurationDays: 2,
      knownIntervals: 2,
      unknownIntervals: 0,
      coverage: "COMPLETE",
      animalIds: ["animal-1", "animal-2"],
    });
    expect(aggregation.byAnimal).toHaveLength(2);
  });

  it("isolates aggregation by farm even when group ids match", () => {
    const otherFarm = lotResult(
      "animal-2",
      "lot-1",
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
    );
    otherFarm.fazendaId = "farm-2";
    otherFarm.intervals[0].fazendaId = "farm-2";

    const aggregation = buildLotOccupancyAggregation({
      results: [
        lotResult(
          "animal-1",
          "lot-1",
          "2026-01-01T00:00:00.000Z",
          "2026-01-02T00:00:00.000Z",
        ),
        otherFarm,
      ],
    });

    expect(aggregation.byLote).toHaveLength(2);
    expect(aggregation.byLote.map((item) => item.fazendaId)).toEqual([
      "farm-1",
      "farm-2",
    ]);
  });
});
