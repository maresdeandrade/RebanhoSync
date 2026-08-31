import type {
  GmdIntervalLimitation,
  GmdIntervalResult,
} from "./gmdIntervalContract";

export type GmdCalculationLimitation =
  | GmdIntervalLimitation
  | {
      code:
        | "MEASUREMENT_CONDITIONS_NOT_AVAILABLE"
        | "GMD_RELIABILITY_UNCLASSIFIED"
        | "GMD_OPERATIONAL_USE_NOT_AUTHORIZED";
      recordIds: string[];
    };

export type GmdNotCalculatedReason =
  | Exclude<GmdIntervalResult["status"], "READY">
  | "INVALID_NUMERIC_INPUT";

export type GmdCalculationResult =
  | {
      status: "CALCULATED";
      animalId: string;
      fazendaId: string;
      initialWeightKg: number;
      finalWeightKg: number;
      initialMeasuredAt: string;
      finalMeasuredAt: string;
      intervalDays: number;
      weightDeltaKg: number;
      gmdKgPerDay: number;
      reliability: "UNCLASSIFIED";
      operationalUse: "NOT_AUTHORIZED";
      universalMinInterval: "CONTEXT_DEPENDENT";
      limitations: GmdCalculationLimitation[];
    }
  | {
      status: "NOT_CALCULATED";
      reason: GmdNotCalculatedReason;
      source: GmdIntervalResult;
    };

const QUALIFICATION_LIMITATIONS: readonly GmdCalculationLimitation[] = [
  { code: "MEASUREMENT_CONDITIONS_NOT_AVAILABLE", recordIds: [] },
  { code: "GMD_RELIABILITY_UNCLASSIFIED", recordIds: [] },
  { code: "GMD_OPERATIONAL_USE_NOT_AUTHORIZED", recordIds: [] },
];

export function calculateQualifiedGmd(
  source: GmdIntervalResult,
): GmdCalculationResult {
  if (source.status !== "READY") {
    return { status: "NOT_CALCULATED", reason: source.status, source };
  }

  const { interval } = source;
  if (!Number.isFinite(interval.intervalDays) || interval.intervalDays <= 0) {
    return { status: "NOT_CALCULATED", reason: "INVALID_INTERVAL", source };
  }

  const initialWeightKg = interval.initialObservation.weightKg;
  const finalWeightKg = interval.finalObservation.weightKg;
  if (!Number.isFinite(initialWeightKg) || !Number.isFinite(finalWeightKg)) {
    return {
      status: "NOT_CALCULATED",
      reason: "INVALID_NUMERIC_INPUT",
      source,
    };
  }

  const weightDeltaKg = finalWeightKg - initialWeightKg;
  const gmdKgPerDay = weightDeltaKg / interval.intervalDays;
  if (!Number.isFinite(weightDeltaKg) || !Number.isFinite(gmdKgPerDay)) {
    return {
      status: "NOT_CALCULATED",
      reason: "INVALID_NUMERIC_INPUT",
      source,
    };
  }

  return {
    status: "CALCULATED",
    animalId: interval.animalId,
    fazendaId: interval.fazendaId,
    initialWeightKg,
    finalWeightKg,
    initialMeasuredAt: interval.initialObservation.measuredAt,
    finalMeasuredAt: interval.finalObservation.measuredAt,
    intervalDays: interval.intervalDays,
    weightDeltaKg,
    gmdKgPerDay,
    reliability: "UNCLASSIFIED",
    operationalUse: "NOT_AUTHORIZED",
    universalMinInterval: "CONTEXT_DEPENDENT",
    limitations: [
      ...interval.limitations.map((limitation) => ({
        ...limitation,
        recordIds: [...limitation.recordIds],
      })),
      ...QUALIFICATION_LIMITATIONS.map((limitation) => ({
        ...limitation,
        recordIds: [...limitation.recordIds],
      })),
    ],
  };
}
