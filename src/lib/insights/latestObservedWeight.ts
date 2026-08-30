import {
  selectObservedWeightEvidence,
  type ObservedWeightLimitation,
  type ObservedWeightLimitationCode,
  type SelectObservedWeightEvidenceInput,
} from "./observedWeightEvidence";

export type LatestObservedWeightLimitationCode = ObservedWeightLimitationCode;
export type LatestObservedWeightLimitation = ObservedWeightLimitation;

export interface LatestObservedWeight {
  animalId: string;
  fazendaId: string;
  weight: number;
  unit: "kg";
  measuredAt: string;
  eventId: string;
  ageDays: number;
  limitations: LatestObservedWeightLimitation[];
}

export type LatestObservedWeightUnavailableReason =
  | "ANIMAL_NOT_FOUND"
  | "NO_OBSERVATION"
  | "NO_VALID_OBSERVATION";

export type LatestObservedWeightConflictCode =
  | "EVENT_WEIGHT_CONFLICT"
  | "LATEST_MEASUREMENT_TIMESTAMP_CONFLICT";

export type LatestObservedWeightResult =
  | {
      status: "available";
      value: LatestObservedWeight;
    }
  | {
      status: "unavailable";
      reason: LatestObservedWeightUnavailableReason;
      limitations: LatestObservedWeightLimitation[];
    }
  | {
      status: "conflict";
      conflict: {
        code: LatestObservedWeightConflictCode;
        measuredAt: string | null;
        eventIds: string[];
      };
      limitations: LatestObservedWeightLimitation[];
    };

export type SelectLatestObservedWeightInput =
  SelectObservedWeightEvidenceInput;

const DAY_MS = 86_400_000;

export function selectLatestObservedWeight(
  input: SelectLatestObservedWeightInput,
): LatestObservedWeightResult {
  const evidence = selectObservedWeightEvidence(input);
  if (evidence.status === "unavailable") {
    return evidence;
  }

  const detailConflict = evidence.conflicts.find(
    (conflict) => conflict.code === "EVENT_WEIGHT_CONFLICT",
  );
  if (detailConflict) {
    return {
      status: "conflict",
      conflict: detailConflict,
      limitations: evidence.limitations,
    };
  }

  const latest = evidence.observations[evidence.observations.length - 1];
  if (!latest) {
    return {
      status: "unavailable",
      reason:
        evidence.scopedEventCount === 0
          ? "NO_OBSERVATION"
          : "NO_VALID_OBSERVATION",
      limitations: evidence.limitations,
    };
  }
  const latestTimestampConflict = evidence.conflicts.find(
    (conflict) =>
      conflict.code === "MEASUREMENT_TIMESTAMP_CONFLICT" &&
      conflict.measuredAt === latest.measuredAt,
  );
  if (latestTimestampConflict) {
    return {
      status: "conflict",
      conflict: {
        ...latestTimestampConflict,
        code: "LATEST_MEASUREMENT_TIMESTAMP_CONFLICT",
      },
      limitations: evidence.limitations,
    };
  }

  return {
    status: "available",
    value: {
      animalId: latest.animalId,
      fazendaId: latest.fazendaId,
      weight: latest.weightKg,
      unit: latest.unit,
      measuredAt: latest.measuredAt,
      eventId: latest.eventId,
      ageDays: Math.floor(
        (evidence.referenceTimestamp - Date.parse(latest.measuredAt)) / DAY_MS,
      ),
      limitations: evidence.limitations,
    },
  };
}
