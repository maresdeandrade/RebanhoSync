import { describe, expect, it } from "vitest";
import {
  calculateQualifiedGmd,
  type GmdCalculationResult,
} from "../gmdCalculation";
import type {
  FactualGmdInterval,
  GmdIntervalResult,
} from "../gmdIntervalContract";

const BASE_INTERVAL: FactualGmdInterval = {
  animalId: "animal-1",
  fazendaId: "farm-1",
  initialObservation: {
    animalId: "animal-1",
    fazendaId: "farm-1",
    eventId: "event-initial",
    weightKg: 100,
    unit: "kg",
    measuredAt: "2026-01-01T00:00:00Z",
  },
  finalObservation: {
    animalId: "animal-1",
    fazendaId: "farm-1",
    eventId: "event-final",
    weightKg: 130,
    unit: "kg",
    measuredAt: "2026-01-31T00:00:00Z",
  },
  intervalDays: 30,
  selectionPolicy: "LATEST_TWO_DISTINCT_OBSERVATIONS",
  coverage: {
    validObservationCount: 2,
    requiredObservationCount: 2,
    temporalOrder: "verified",
    unitCompatibility: "verified_kg",
    factualConflicts: "none",
    source: "not_available",
    method: "not_available",
    minimumIntervalPolicy: "context_dependent",
  },
  limitations: [
    { code: "MEASUREMENT_SOURCE_NOT_AVAILABLE", recordIds: [] },
    { code: "MEASUREMENT_METHOD_NOT_AVAILABLE", recordIds: [] },
  ],
};

function readyInterval(
  overrides: Partial<FactualGmdInterval> = {},
): GmdIntervalResult {
  return {
    status: "READY",
    interval: {
      ...BASE_INTERVAL,
      ...overrides,
      initialObservation: {
        ...BASE_INTERVAL.initialObservation,
        ...overrides.initialObservation,
      },
      finalObservation: {
        ...BASE_INTERVAL.finalObservation,
        ...overrides.finalObservation,
      },
    },
  };
}

function expectQualified(result: GmdCalculationResult): void {
  expect(result).toMatchObject({
    status: "CALCULATED",
    reliability: "UNCLASSIFIED",
    operationalUse: "NOT_AUTHORIZED",
    universalMinInterval: "CONTEXT_DEPENDENT",
  });
}

describe("calculateQualifiedGmd", () => {
  it("calculates positive GMD", () => {
    const result = calculateQualifiedGmd(readyInterval());
    expect(result).toMatchObject({
      status: "CALCULATED",
      initialWeightKg: 100,
      finalWeightKg: 130,
      initialMeasuredAt: "2026-01-01T00:00:00Z",
      finalMeasuredAt: "2026-01-31T00:00:00Z",
      intervalDays: 30,
      weightDeltaKg: 30,
      gmdKgPerDay: 1,
    });
    expectQualified(result);
  });

  it("preserves negative GMD as a valid mathematical result", () => {
    const result = calculateQualifiedGmd(
      readyInterval({
        initialObservation: {
          ...BASE_INTERVAL.initialObservation,
          weightKg: 130,
        },
        finalObservation: {
          ...BASE_INTERVAL.finalObservation,
          weightKg: 100,
        },
      }),
    );
    expect(result).toMatchObject({
      status: "CALCULATED",
      weightDeltaKg: -30,
      gmdKgPerDay: -1,
    });
    expectQualified(result);
  });

  it("preserves zero GMD as a valid mathematical result", () => {
    const result = calculateQualifiedGmd(
      readyInterval({
        finalObservation: {
          ...BASE_INTERVAL.finalObservation,
          weightKg: 100,
        },
      }),
    );
    expect(result).toMatchObject({
      status: "CALCULATED",
      weightDeltaKg: 0,
      gmdKgPerDay: 0,
    });
    expectQualified(result);
  });

  it("calculates a one-day interval without promoting reliability", () => {
    const result = calculateQualifiedGmd(readyInterval({ intervalDays: 1 }));
    expect(result).toMatchObject({
      status: "CALCULATED",
      intervalDays: 1,
      gmdKgPerDay: 30,
    });
    expectQualified(result);
  });

  it("keeps decimal precision without rounding", () => {
    const result = calculateQualifiedGmd(
      readyInterval({
        intervalDays: 3,
        finalObservation: {
          ...BASE_INTERVAL.finalObservation,
          weightKg: 101,
        },
      }),
    );
    expect(result.status).toBe("CALCULATED");
    if (result.status !== "CALCULATED") throw new Error("expected calculation");
    expect(result.gmdKgPerDay).toBe(1 / 3);
    expect(result.gmdKgPerDay).toBeCloseTo(0.3333333333333333, 14);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not calculate an invalid interval (%s)",
    (intervalDays) => {
      const result = calculateQualifiedGmd(readyInterval({ intervalDays }));
      expect(result).toMatchObject({
        status: "NOT_CALCULATED",
        reason: "INVALID_INTERVAL",
      });
      expect(result).not.toHaveProperty("gmdKgPerDay");
    },
  );

  it("does not calculate a conflict", () => {
    const source: GmdIntervalResult = {
      status: "CONFLICT",
      conflicts: [
        {
          code: "MEASUREMENT_TIMESTAMP_CONFLICT",
          measuredAt: "2026-01-31T00:00:00Z",
          eventIds: ["event-a", "event-b"],
        },
      ],
      limitations: [],
    };
    const result = calculateQualifiedGmd(source);
    expect(result).toEqual({
      status: "NOT_CALCULATED",
      reason: "CONFLICT",
      source,
    });
    expect(result).not.toHaveProperty("gmdKgPerDay");
  });

  it("does not calculate insufficient observations", () => {
    const source: GmdIntervalResult = {
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: 1,
      requiredCount: 2,
      limitations: [],
    };
    expect(calculateQualifiedGmd(source)).toEqual({
      status: "NOT_CALCULATED",
      reason: "INSUFFICIENT_OBSERVATIONS",
      source,
    });
  });

  it.each([
    {
      status: "INVALID_INTERVAL" as const,
      reason: "NON_POSITIVE_INTERVAL" as const,
      eventIds: ["event-initial", "event-final"] as [string, string],
      limitations: [],
    },
    {
      status: "UNSUPPORTED" as const,
      reason: "ANIMAL_NOT_FOUND" as const,
      limitations: [],
    },
  ])("propagates $status without calculating", (source) => {
    const result = calculateQualifiedGmd(source);
    expect(result).toEqual({
      status: "NOT_CALCULATED",
      reason: source.status,
      source,
    });
    expect(result).not.toHaveProperty("gmdKgPerDay");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "never emits an invalid numeric result for weight %s",
    (weightKg) => {
      const result = calculateQualifiedGmd(
        readyInterval({
          finalObservation: {
            ...BASE_INTERVAL.finalObservation,
            weightKg,
          },
        }),
      );
      expect(result).toMatchObject({
        status: "NOT_CALCULATED",
        reason: "INVALID_NUMERIC_INPUT",
      });
      expect(result).not.toHaveProperty("gmdKgPerDay");
    },
  );

  it("preserves animal and farm isolation from the factual interval", () => {
    const result = calculateQualifiedGmd(
      readyInterval({ animalId: "animal-target", fazendaId: "farm-target" }),
    );
    expect(result).toMatchObject({
      status: "CALCULATED",
      animalId: "animal-target",
      fazendaId: "farm-target",
    });
  });

  it("adds mandatory measurement and operational limitations", () => {
    const result = calculateQualifiedGmd(readyInterval());
    expect(result.status).toBe("CALCULATED");
    if (result.status !== "CALCULATED") throw new Error("expected calculation");
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        { code: "MEASUREMENT_SOURCE_NOT_AVAILABLE", recordIds: [] },
        { code: "MEASUREMENT_METHOD_NOT_AVAILABLE", recordIds: [] },
        { code: "MEASUREMENT_CONDITIONS_NOT_AVAILABLE", recordIds: [] },
        { code: "GMD_RELIABILITY_UNCLASSIFIED", recordIds: [] },
        { code: "GMD_OPERATIONAL_USE_NOT_AUTHORIZED", recordIds: [] },
      ]),
    );
  });
});
