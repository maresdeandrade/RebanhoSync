import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";

export type ObservedWeightLimitationCode =
  | "LATEST_OBSERVED_WEIGHT_IS_NOT_CURRENT_WEIGHT"
  | "MEASUREMENT_SOURCE_NOT_AVAILABLE"
  | "MEASUREMENT_METHOD_NOT_AVAILABLE"
  | "SNAPSHOT_COVERAGE_MUST_BE_VERIFIED_BY_CALLER"
  | "INVALID_MEASUREMENT_DATE_IGNORED"
  | "FUTURE_MEASUREMENT_IGNORED"
  | "INVALID_WEIGHT_IGNORED";

export interface ObservedWeightLimitation {
  code: ObservedWeightLimitationCode;
  recordIds: string[];
}

export interface ObservedWeightObservation {
  animalId: string;
  fazendaId: string;
  eventId: string;
  weightKg: number;
  unit: "kg";
  measuredAt: string;
}

export type ObservedWeightConflictCode =
  | "EVENT_WEIGHT_CONFLICT"
  | "MEASUREMENT_TIMESTAMP_CONFLICT";

export interface ObservedWeightConflict {
  code: ObservedWeightConflictCode;
  measuredAt: string | null;
  eventIds: string[];
}

export interface SelectObservedWeightEvidenceInput {
  fazendaId: string;
  animalId: string;
  animal: Pick<Animal, "id" | "fazenda_id" | "deleted_at"> | null;
  events: readonly Evento[];
  weightDetails: readonly EventoPesagem[];
  referenceDate: string;
}

export type ObservedWeightEvidenceResult =
  | {
      status: "available";
      scopedEventCount: number;
      observations: ObservedWeightObservation[];
      conflicts: ObservedWeightConflict[];
      limitations: ObservedWeightLimitation[];
      referenceTimestamp: number;
    }
  | {
      status: "unavailable";
      reason: "ANIMAL_NOT_FOUND";
      limitations: ObservedWeightLimitation[];
    };

type EligibleEvent = { event: Evento; timestamp: number };

const BASE_LIMITATIONS: readonly ObservedWeightLimitation[] = [
  {
    code: "LATEST_OBSERVED_WEIGHT_IS_NOT_CURRENT_WEIGHT",
    recordIds: [],
  },
  { code: "MEASUREMENT_SOURCE_NOT_AVAILABLE", recordIds: [] },
  { code: "MEASUREMENT_METHOD_NOT_AVAILABLE", recordIds: [] },
  {
    code: "SNAPSHOT_COVERAGE_MUST_BE_VERIFIED_BY_CALLER",
    recordIds: [],
  },
];

export function parseObservedWeightInstant(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function limitationsWith(
  additions: Array<{
    code: ObservedWeightLimitationCode;
    recordIds: readonly string[];
  }>,
): ObservedWeightLimitation[] {
  return [
    ...BASE_LIMITATIONS.map((limitation) => ({
      ...limitation,
      recordIds: [...limitation.recordIds],
    })),
    ...additions
      .filter((limitation) => limitation.recordIds.length > 0)
      .map((limitation) => ({
        code: limitation.code,
        recordIds: unique(limitation.recordIds),
      })),
  ];
}

function collectEligibleEvents(
  input: SelectObservedWeightEvidenceInput,
  referenceTimestamp: number,
): {
  scopedCount: number;
  eligibleEvents: EligibleEvent[];
  invalidDateEventIds: string[];
  futureEventIds: string[];
} {
  const scopedEvents = input.events.filter(
    (event) =>
      event.fazenda_id === input.fazendaId &&
      event.animal_id === input.animalId &&
      event.dominio === "pesagem" &&
      !event.deleted_at,
  );
  const invalidDateEventIds: string[] = [];
  const futureEventIds: string[] = [];
  const eligibleEvents = scopedEvents.flatMap((event) => {
    const timestamp = parseObservedWeightInstant(event.occurred_at);
    if (timestamp === null) {
      invalidDateEventIds.push(event.id);
      return [];
    }
    if (timestamp > referenceTimestamp) {
      futureEventIds.push(event.id);
      return [];
    }
    return [{ event, timestamp }];
  });
  return {
    scopedCount: scopedEvents.length,
    eligibleEvents,
    invalidDateEventIds,
    futureEventIds,
  };
}

function collectWeightDetails(
  input: SelectObservedWeightEvidenceInput,
  eligibleEvents: readonly EligibleEvent[],
): {
  detailsByEvent: Map<string, EventoPesagem[]>;
  invalidWeightEventIds: string[];
} {
  const eligibleEventIds = new Set(
    eligibleEvents.map(({ event }) => event.id),
  );
  const invalidWeightEventIds: string[] = [];
  const detailsByEvent = new Map<string, EventoPesagem[]>();
  for (const detail of input.weightDetails) {
    if (
      detail.fazenda_id !== input.fazendaId ||
      detail.deleted_at ||
      !eligibleEventIds.has(detail.evento_id)
    ) {
      continue;
    }
    if (!Number.isFinite(detail.peso_kg) || detail.peso_kg <= 0) {
      invalidWeightEventIds.push(detail.evento_id);
      continue;
    }
    detailsByEvent.set(detail.evento_id, [
      ...(detailsByEvent.get(detail.evento_id) ?? []),
      detail,
    ]);
  }
  return { detailsByEvent, invalidWeightEventIds };
}

function buildEventEvidence(
  input: SelectObservedWeightEvidenceInput,
  eligibleEvents: readonly EligibleEvent[],
  detailsByEvent: ReadonlyMap<string, readonly EventoPesagem[]>,
): {
  observations: ObservedWeightObservation[];
  conflicts: ObservedWeightConflict[];
} {
  const observationsByEvent = new Map<string, ObservedWeightObservation>();
  const conflicts: ObservedWeightConflict[] = [];
  for (const { event } of eligibleEvents) {
    const details = detailsByEvent.get(event.id) ?? [];
    const weights = unique(details.map((detail) => String(detail.peso_kg)));
    if (weights.length > 1) {
      conflicts.push({
        code: "EVENT_WEIGHT_CONFLICT",
        measuredAt: event.occurred_at,
        eventIds: [event.id],
      });
      observationsByEvent.delete(event.id);
      continue;
    }
    const detail = details[0];
    if (!detail || observationsByEvent.has(event.id)) continue;
    observationsByEvent.set(event.id, {
      animalId: input.animalId,
      fazendaId: input.fazendaId,
      eventId: event.id,
      weightKg: detail.peso_kg,
      unit: "kg",
      measuredAt: event.occurred_at,
    });
  }
  return { observations: Array.from(observationsByEvent.values()), conflicts };
}

function timestampConflicts(
  observations: readonly ObservedWeightObservation[],
): ObservedWeightConflict[] {
  const byTimestamp = new Map<number, ObservedWeightObservation[]>();
  for (const observation of observations) {
    const timestamp = Date.parse(observation.measuredAt);
    byTimestamp.set(timestamp, [
      ...(byTimestamp.get(timestamp) ?? []),
      observation,
    ]);
  }
  return Array.from(byTimestamp.values())
    .filter((entries) => entries.length > 1)
    .map((entries) => ({
      code: "MEASUREMENT_TIMESTAMP_CONFLICT" as const,
      measuredAt: entries[0].measuredAt,
      eventIds: unique(entries.map((entry) => entry.eventId)),
    }));
}

export function selectObservedWeightEvidence(
  input: SelectObservedWeightEvidenceInput,
): ObservedWeightEvidenceResult {
  if (!input.fazendaId.trim()) throw new Error("fazendaId is required");
  if (!input.animalId.trim()) throw new Error("animalId is required");
  const referenceTimestamp = parseObservedWeightInstant(input.referenceDate);
  if (referenceTimestamp === null) {
    throw new Error("referenceDate must be a valid instant");
  }
  const animalExists =
    input.animal?.id === input.animalId &&
    input.animal.fazenda_id === input.fazendaId &&
    !input.animal.deleted_at;
  if (!animalExists) {
    return {
      status: "unavailable",
      reason: "ANIMAL_NOT_FOUND",
      limitations: limitationsWith([]),
    };
  }

  const eventSelection = collectEligibleEvents(input, referenceTimestamp);
  const detailSelection = collectWeightDetails(
    input,
    eventSelection.eligibleEvents,
  );
  const evidence = buildEventEvidence(
    input,
    eventSelection.eligibleEvents,
    detailSelection.detailsByEvent,
  );
  const observations = evidence.observations.sort((left, right) => {
    const timestampDelta =
      Date.parse(left.measuredAt) - Date.parse(right.measuredAt);
    return timestampDelta || left.eventId.localeCompare(right.eventId);
  });
  return {
    status: "available",
    scopedEventCount: eventSelection.scopedCount,
    observations,
    conflicts: [...evidence.conflicts, ...timestampConflicts(observations)],
    limitations: limitationsWith([
      {
        code: "INVALID_MEASUREMENT_DATE_IGNORED",
        recordIds: eventSelection.invalidDateEventIds,
      },
      {
        code: "FUTURE_MEASUREMENT_IGNORED",
        recordIds: eventSelection.futureEventIds,
      },
      {
        code: "INVALID_WEIGHT_IGNORED",
        recordIds: detailSelection.invalidWeightEventIds,
      },
    ]),
    referenceTimestamp,
  };
}
