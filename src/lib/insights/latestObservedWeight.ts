import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";

export type LatestObservedWeightLimitationCode =
  | "LATEST_OBSERVED_WEIGHT_IS_NOT_CURRENT_WEIGHT"
  | "MEASUREMENT_SOURCE_NOT_AVAILABLE"
  | "MEASUREMENT_METHOD_NOT_AVAILABLE"
  | "SNAPSHOT_COVERAGE_MUST_BE_VERIFIED_BY_CALLER"
  | "INVALID_MEASUREMENT_DATE_IGNORED"
  | "FUTURE_MEASUREMENT_IGNORED"
  | "INVALID_WEIGHT_IGNORED";

export interface LatestObservedWeightLimitation {
  code: LatestObservedWeightLimitationCode;
  recordIds: string[];
}

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

export interface SelectLatestObservedWeightInput {
  fazendaId: string;
  animalId: string;
  animal: Pick<Animal, "id" | "fazenda_id" | "deleted_at"> | null;
  events: readonly Evento[];
  weightDetails: readonly EventoPesagem[];
  referenceDate: string;
}

const DAY_MS = 86_400_000;

const BASE_LIMITATIONS: readonly LatestObservedWeightLimitation[] = [
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

function parseInstant(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function limitationsWith(
  additions: Array<{
    code: LatestObservedWeightLimitationCode;
    recordIds: readonly string[];
  }>,
): LatestObservedWeightLimitation[] {
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

type EligibleEvent = { event: Evento; timestamp: number };
type WeightObservation = EligibleEvent & { detail: EventoPesagem };

function collectEligibleEvents(
  input: SelectLatestObservedWeightInput,
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
    const timestamp = parseInstant(event.occurred_at);
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
  input: SelectLatestObservedWeightInput,
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

function findEventWeightConflict(
  eligibleEvents: readonly EligibleEvent[],
  detailsByEvent: ReadonlyMap<string, readonly EventoPesagem[]>,
): LatestObservedWeightResult | null {
  for (const [eventId, details] of detailsByEvent) {
    const weights = unique(details.map((detail) => String(detail.peso_kg)));
    if (weights.length <= 1) continue;
    const event = eligibleEvents.find(
      ({ event: candidate }) => candidate.id === eventId,
    );
    return {
      status: "conflict",
      conflict: {
        code: "EVENT_WEIGHT_CONFLICT",
        measuredAt: event?.event.occurred_at ?? null,
        eventIds: [eventId],
      },
      limitations: [],
    };
  }
  return null;
}

function buildObservations(
  eligibleEvents: readonly EligibleEvent[],
  detailsByEvent: ReadonlyMap<string, readonly EventoPesagem[]>,
): WeightObservation[] {
  return eligibleEvents.flatMap(({ event, timestamp }) => {
    const detail = detailsByEvent.get(event.id)?.[0];
    return detail ? [{ event, detail, timestamp }] : [];
  });
}

function selectLatestObservation(
  observations: readonly WeightObservation[],
):
  | { selected: WeightObservation; conflict: null }
  | {
      selected: null;
      conflict: LatestObservedWeightResult & { status: "conflict" };
    } {
  const latestTimestamp = Math.max(
    ...observations.map((observation) => observation.timestamp),
  );
  const latestByEvent = new Map(
    observations
      .filter((observation) => observation.timestamp === latestTimestamp)
      .map((observation) => [observation.event.id, observation]),
  );
  const latestObservations = Array.from(latestByEvent.values());
  if (latestObservations.length === 1) {
    return { selected: latestObservations[0], conflict: null };
  }
  return {
    selected: null,
    conflict: {
      status: "conflict",
      conflict: {
        code: "LATEST_MEASUREMENT_TIMESTAMP_CONFLICT",
        measuredAt: latestObservations[0].event.occurred_at,
        eventIds: unique(
          latestObservations.map((observation) => observation.event.id),
        ),
      },
      limitations: [],
    },
  };
}

export function selectLatestObservedWeight(
  input: SelectLatestObservedWeightInput,
): LatestObservedWeightResult {
  if (!input.fazendaId.trim()) throw new Error("fazendaId is required");
  if (!input.animalId.trim()) throw new Error("animalId is required");

  const referenceTimestamp = parseInstant(input.referenceDate);
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

  const limitations = limitationsWith([
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
  ]);

  const detailConflict = findEventWeightConflict(
    eventSelection.eligibleEvents,
    detailSelection.detailsByEvent,
  );
  if (detailConflict?.status === "conflict") {
    return { ...detailConflict, limitations };
  }

  const observations = buildObservations(
    eventSelection.eligibleEvents,
    detailSelection.detailsByEvent,
  );
  if (observations.length === 0) {
    return {
      status: "unavailable",
      reason:
        eventSelection.scopedCount === 0
          ? "NO_OBSERVATION"
          : "NO_VALID_OBSERVATION",
      limitations,
    };
  }

  const latestSelection = selectLatestObservation(observations);
  if (latestSelection.conflict) {
    return { ...latestSelection.conflict, limitations };
  }
  const latest = latestSelection.selected;
  return {
    status: "available",
    value: {
      animalId: input.animalId,
      fazendaId: input.fazendaId,
      weight: latest.detail.peso_kg,
      unit: "kg",
      measuredAt: latest.event.occurred_at,
      eventId: latest.event.id,
      ageDays: Math.floor((referenceTimestamp - latest.timestamp) / DAY_MS),
      limitations,
    },
  };
}
