import {
  selectObservedWeightEvidence,
  type ObservedWeightConflict,
  type ObservedWeightLimitation,
  type ObservedWeightObservation,
  type SelectObservedWeightEvidenceInput,
} from "./observedWeightEvidence";

export type GmdIntervalStatus =
  | "READY"
  | "INSUFFICIENT_OBSERVATIONS"
  | "CONFLICT"
  | "INVALID_INTERVAL"
  | "UNSUPPORTED";

export type GmdIntervalLimitation =
  | ObservedWeightLimitation
  | {
      code:
        | "GMD_MIN_INTERVAL_POLICY_UNDEFINED"
        | "GMD_CALCULATION_NOT_AUTHORIZED";
      recordIds: string[];
    };

export interface GmdIntervalObservation {
  animalId: string;
  fazendaId: string;
  eventId: string;
  weightKg: number;
  unit: "kg";
  measuredAt: string;
}

export interface FactualGmdInterval {
  animalId: string;
  fazendaId: string;
  initialObservation: GmdIntervalObservation;
  finalObservation: GmdIntervalObservation;
  intervalDays: number;
  selectionPolicy: "LATEST_TWO_DISTINCT_OBSERVATIONS";
  coverage: {
    validObservationCount: number;
    requiredObservationCount: 2;
    temporalOrder: "verified";
    unitCompatibility: "verified_kg";
    factualConflicts: "none";
    source: "not_available";
    method: "not_available";
    minimumIntervalPolicy: "not_defined";
  };
  limitations: GmdIntervalLimitation[];
}

export type GmdIntervalResult =
  | { status: "READY"; interval: FactualGmdInterval }
  | {
      status: "INSUFFICIENT_OBSERVATIONS";
      observedCount: number;
      requiredCount: 2;
      limitations: GmdIntervalLimitation[];
    }
  | {
      status: "CONFLICT";
      conflicts: ObservedWeightConflict[];
      limitations: GmdIntervalLimitation[];
    }
  | {
      status: "INVALID_INTERVAL";
      reason: "NON_POSITIVE_INTERVAL";
      eventIds: [string, string];
      limitations: GmdIntervalLimitation[];
    }
  | {
      status: "UNSUPPORTED";
      reason: "ANIMAL_NOT_FOUND";
      limitations: GmdIntervalLimitation[];
    };

export type SelectFactualGmdIntervalInput =
  SelectObservedWeightEvidenceInput;

const DAY_MS = 86_400_000;

function intervalLimitations(
  limitations: readonly ObservedWeightLimitation[],
): GmdIntervalLimitation[] {
  return [
    ...limitations.map((limitation) => ({
      ...limitation,
      recordIds: [...limitation.recordIds],
    })),
    { code: "GMD_MIN_INTERVAL_POLICY_UNDEFINED", recordIds: [] },
    { code: "GMD_CALCULATION_NOT_AUTHORIZED", recordIds: [] },
  ];
}

function toIntervalObservation(
  observation: ObservedWeightObservation,
): GmdIntervalObservation {
  return { ...observation };
}

export function selectFactualGmdInterval(
  input: SelectFactualGmdIntervalInput,
): GmdIntervalResult {
  const evidence = selectObservedWeightEvidence(input);
  const limitations = intervalLimitations(evidence.limitations);
  if (evidence.status === "unavailable") {
    return {
      status: "UNSUPPORTED",
      reason: evidence.reason,
      limitations,
    };
  }
  if (evidence.conflicts.length > 0) {
    return {
      status: "CONFLICT",
      conflicts: evidence.conflicts,
      limitations,
    };
  }
  if (evidence.observations.length < 2) {
    return {
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: evidence.observations.length,
      requiredCount: 2,
      limitations,
    };
  }

  const initial = evidence.observations[evidence.observations.length - 2];
  const final = evidence.observations[evidence.observations.length - 1];
  const intervalDays =
    (Date.parse(final.measuredAt) - Date.parse(initial.measuredAt)) / DAY_MS;
  if (intervalDays <= 0) {
    return {
      status: "INVALID_INTERVAL",
      reason: "NON_POSITIVE_INTERVAL",
      eventIds: [initial.eventId, final.eventId],
      limitations,
    };
  }

  return {
    status: "READY",
    interval: {
      animalId: input.animalId,
      fazendaId: input.fazendaId,
      initialObservation: toIntervalObservation(initial),
      finalObservation: toIntervalObservation(final),
      intervalDays,
      selectionPolicy: "LATEST_TWO_DISTINCT_OBSERVATIONS",
      coverage: {
        validObservationCount: evidence.observations.length,
        requiredObservationCount: 2,
        temporalOrder: "verified",
        unitCompatibility: "verified_kg",
        factualConflicts: "none",
        source: "not_available",
        method: "not_available",
        minimumIntervalPolicy: "not_defined",
      },
      limitations,
    },
  };
}
