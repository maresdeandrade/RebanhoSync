import { describe, expect, it } from "vitest";
import type { Evento, EventoPesagem } from "@/lib/offline/types";
import type {
  QualifiedOccupancyDurationResult,
  QualifiedOccupancyInterval,
} from "../qualifiedOccupancyDuration";
import { buildObservedOccupancyPerformance } from "../occupancyPerformance";

const FARM = "farm-1";
const ANIMAL = "animal-1";

function interval(
  overrides: Partial<QualifiedOccupancyInterval> = {},
): QualifiedOccupancyInterval {
  return {
    dimension: "LOT",
    animalId: ANIMAL,
    fazendaId: FARM,
    loteId: "lot-1",
    pastoId: null,
    enteredAt: "2026-01-01T00:00:00.000Z",
    leftAt: "2026-01-11T00:00:00.000Z",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: "2026-01-11T00:00:00.000Z",
    startBoundary: "KNOWN",
    endBoundary: "KNOWN",
    calculation: "CALCULATED",
    durationMs: 10 * 86_400_000,
    durationDays: 10,
    endBasis: "FACTUAL_EXIT",
    coverage: "COMPLETE",
    limitationCodes: [],
    lotOccupancySourceEventIds: ["movement-1", "movement-2"],
    pastureSourceEventIds: [],
    ...overrides,
  };
}

function qualified(
  intervals: QualifiedOccupancyInterval[] = [interval()],
): QualifiedOccupancyDurationResult {
  return {
    dimension: intervals[0]?.dimension ?? "LOT",
    animalId: ANIMAL,
    fazendaId: FARM,
    sourceStatus: "READY",
    sourceCoverage: "CONTIGUOUS_HISTORY",
    intervals,
    limitations: [],
    conflicts: [],
  };
}

function weight(
  id: string,
  measuredAt: string,
  weightKg: number,
  overrides: Partial<Evento> = {},
): { event: Evento; detail: EventoPesagem } {
  return {
    event: {
      id,
      fazenda_id: FARM,
      animal_id: ANIMAL,
      lote_id: null,
      dominio: "pesagem",
      occurred_at: measuredAt,
      deleted_at: null,
      ...overrides,
    } as Evento,
    detail: {
      evento_id: id,
      fazenda_id: FARM,
      peso_kg: weightKg,
      deleted_at: null,
    } as EventoPesagem,
  };
}

function calculate(
  weights: Array<{ event: Evento; detail: EventoPesagem }>,
  qualifiedResults = [qualified()],
) {
  return buildObservedOccupancyPerformance({
    qualifiedResults,
    events: weights.map(({ event }) => event),
    weightDetails: weights.map(({ detail }) => detail),
    referenceDate: "2026-02-01T00:00:00.000Z",
  });
}

describe("observed occupancy performance", () => {
  it.each([
    ["positive gain", 200, 210, 1],
    ["negative gain", 210, 200, -1],
    ["stable weight", 200, 200, 0],
  ])("calculates %s without internal rounding", (_name, initial, final, gmd) => {
    const result = calculate([
      weight("weight-1", "2026-01-01T00:00:00.000Z", initial),
      weight("weight-2", "2026-01-11T00:00:00.000Z", final),
    ]).results[0].intervals[0];

    expect(result).toMatchObject({
      contract: "OBSERVED_WITHIN_OCCUPANCY",
      status: "CALCULATED",
      weightDeltaKg: final - initial,
      observedDaysBetweenWeights: 10,
      observedGmdKgPerDay: gmd,
      coverage: "FULL_BOUNDARY_COVERAGE",
      reliability: "UNCLASSIFIED",
      operationalUse: "NOT_AUTHORIZED",
      weightSourceEventIds: ["weight-1", "weight-2"],
    });
  });

  it("uses the first and last factual observations inside the occupancy", () => {
    const result = calculate([
      weight("outside-before", "2025-12-31T00:00:00.000Z", 180),
      weight("middle", "2026-01-06T00:00:00.000Z", 205),
      weight("first", "2026-01-02T00:00:00.000Z", 200),
      weight("last", "2026-01-10T00:00:00.000Z", 220),
      weight("outside-after", "2026-01-12T00:00:00.000Z", 230),
    ]).results[0].intervals[0];

    expect(result.initialObservedWeight?.eventId).toBe("first");
    expect(result.finalObservedWeight?.eventId).toBe("last");
    expect(result.coverage).toBe("PARTIAL_WEIGHT_COVERAGE");
  });

  it.each([
    [[]],
    [[weight("only", "2026-01-05T00:00:00.000Z", 200)]],
  ])(
    "keeps insufficient evidence unavailable",
    (weights) => {
      const result = calculate(weights).results[0].intervals[0];
      expect(result).toMatchObject({
        status: "NOT_CALCULATED",
        coverage: "INSUFFICIENT_WEIGHT_EVIDENCE",
        weightDeltaKg: null,
        observedGmdKgPerDay: null,
      });
    },
  );

  it("does not fall back when an event has divergent weight details", () => {
    const first = weight("weight-1", "2026-01-01T00:00:00.000Z", 200);
    const final = weight("weight-2", "2026-01-11T00:00:00.000Z", 210);
    const conflictingDetail = { ...first.detail, peso_kg: 201 };
    const aggregation = buildObservedOccupancyPerformance({
      qualifiedResults: [qualified()],
      events: [first.event, final.event],
      weightDetails: [first.detail, conflictingDetail, final.detail],
      referenceDate: "2026-02-01T00:00:00.000Z",
    });

    expect(aggregation.results[0].intervals[0]).toMatchObject({
      status: "NOT_CALCULATED",
      coverage: "CONFLICT",
      observedGmdKgPerDay: null,
    });
  });

  it("does not choose between different events at the same timestamp", () => {
    const result = calculate([
      weight("weight-1", "2026-01-01T00:00:00.000Z", 200),
      weight("weight-2", "2026-01-11T00:00:00.000Z", 210),
      weight("weight-3", "2026-01-11T00:00:00.000Z", 211),
    ]).results[0].intervals[0];
    expect(result.coverage).toBe("CONFLICT");
    expect(result.status).toBe("NOT_CALCULATED");
  });

  it("ignores cross-farm and cross-animal weight facts", () => {
    const result = calculate([
      weight("other-farm", "2026-01-01T00:00:00.000Z", 200, {
        fazenda_id: "farm-2",
      }),
      weight("other-animal", "2026-01-11T00:00:00.000Z", 210, {
        animal_id: "animal-2",
      }),
    ]).results[0].intervals[0];
    expect(result.coverage).toBe("INSUFFICIENT_WEIGHT_EVIDENCE");
  });

  it.each([
    interval({
      enteredAt: null,
      effectiveFrom: null,
      startBoundary: "LEFT_BOUND_UNKNOWN",
      calculation: "NOT_CALCULATED",
      durationMs: null,
      durationDays: null,
      endBasis: null,
      coverage: "PARTIAL",
      limitationCodes: ["LEFT_BOUND_UNKNOWN"],
    }),
    interval({
      leftAt: null,
      effectiveTo: null,
      endBoundary: "RIGHT_BOUND_UNKNOWN",
      calculation: "NOT_CALCULATED",
      durationMs: null,
      durationDays: null,
      endBasis: null,
      coverage: "PARTIAL",
      limitationCodes: ["RIGHT_BOUND_UNKNOWN"],
    }),
  ])("calculates only the observed weight window in partial occupancy", (partial) => {
    const result = calculate(
      [
        weight("weight-1", "2026-01-02T00:00:00.000Z", 200),
        weight("weight-2", "2026-01-10T00:00:00.000Z", 208),
      ],
      [qualified([partial])],
    ).results[0].intervals[0];
    expect(result).toMatchObject({
      status: "CALCULATED",
      coverage: "PARTIAL_WEIGHT_COVERAGE",
      observedGmdKgPerDay: 1,
      occupancyCoverage: "PARTIAL",
    });
  });

  it("blocks a conflicted occupancy interval", () => {
    const conflicted = interval({ coverage: "CONFLICTED" });
    const result = calculate(
      [
        weight("weight-1", "2026-01-02T00:00:00.000Z", 200),
        weight("weight-2", "2026-01-10T00:00:00.000Z", 208),
      ],
      [qualified([conflicted])],
    ).results[0].intervals[0];
    expect(result).toMatchObject({
      status: "NOT_CALCULATED",
      coverage: "CONFLICT",
      observedGmdKgPerDay: null,
    });
  });

  it("aggregates lot and pasture independently of physical input order", () => {
    const lot = qualified([interval()]);
    const pastureInterval = interval({
      dimension: "PASTURE",
      pastoId: "pasture-1",
      pastureSourceEventIds: ["pasture-movement-1"],
    });
    const pasture = qualified([pastureInterval]);
    const weights = [
      weight("weight-2", "2026-01-11T00:00:00.000Z", 210),
      weight("weight-1", "2026-01-01T00:00:00.000Z", 200),
    ];
    const result = calculate(weights, [pasture, lot]);

    expect(result.byGroup).toHaveLength(2);
    expect(result.byGroup.map((item) => item.groupId).sort()).toEqual([
      "lot-1",
      "pasture-1",
    ]);
    expect(result.byGroup.every((item) => item.meanObservedGmdKgPerDay === 1)).toBe(true);
  });
});
