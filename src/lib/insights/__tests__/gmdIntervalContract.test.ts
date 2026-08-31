import { describe, expect, it } from "vitest";
import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";
import {
  selectFactualGmdInterval,
  type SelectFactualGmdIntervalInput,
} from "../gmdIntervalContract";

const FARM_ID = "farm-1";
const ANIMAL_ID = "animal-1";
const REFERENCE_DATE = "2026-04-01T12:00:00Z";

const animal: Pick<Animal, "id" | "fazenda_id" | "deleted_at"> = {
  id: ANIMAL_ID,
  fazenda_id: FARM_ID,
  deleted_at: null,
};

function event(
  id: string,
  occurredAt: string,
  overrides: Partial<Evento> = {},
): Evento {
  return {
    id,
    fazenda_id: FARM_ID,
    dominio: "pesagem",
    occurred_at: occurredAt,
    animal_id: ANIMAL_ID,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: null,
    client_recorded_at: occurredAt,
    server_received_at: occurredAt,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: null,
    ...overrides,
  };
}

function detail(
  eventId: string,
  weightKg: number,
  overrides: Partial<EventoPesagem> = {},
): EventoPesagem {
  return {
    evento_id: eventId,
    fazenda_id: FARM_ID,
    peso_kg: weightKg,
    payload: {},
    client_id: "client-1",
    client_op_id: `detail-${eventId}`,
    client_tx_id: null,
    client_recorded_at: REFERENCE_DATE,
    server_received_at: REFERENCE_DATE,
    created_at: REFERENCE_DATE,
    updated_at: REFERENCE_DATE,
    deleted_at: null,
    ...overrides,
  };
}

function input(
  overrides: Partial<SelectFactualGmdIntervalInput> = {},
): SelectFactualGmdIntervalInput {
  return {
    fazendaId: FARM_ID,
    animalId: ANIMAL_ID,
    animal,
    events: [],
    weightDetails: [],
    referenceDate: REFERENCE_DATE,
    ...overrides,
  };
}

function twoObservationInput(): SelectFactualGmdIntervalInput {
  return input({
    events: [
      event("event-1", "2026-03-01T12:00:00Z"),
      event("event-2", "2026-03-11T12:00:00Z"),
    ],
    weightDetails: [detail("event-1", 300), detail("event-2", 320)],
  });
}

describe("selectFactualGmdInterval", () => {
  it("returns insufficient observations when none exist", () => {
    expect(selectFactualGmdInterval(input())).toMatchObject({
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: 0,
      requiredCount: 2,
    });
  });

  it("returns insufficient observations for one factual weighing", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [event("event-1", "2026-03-01T12:00:00Z")],
        weightDetails: [detail("event-1", 300)],
      }),
    );
    expect(result).toMatchObject({
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: 1,
    });
  });

  it("returns a factual interval for two valid observations without calculating GMD", () => {
    const result = selectFactualGmdInterval(twoObservationInput());
    expect(result).toMatchObject({
      status: "READY",
      interval: {
        animalId: ANIMAL_ID,
        fazendaId: FARM_ID,
        initialObservation: {
          eventId: "event-1",
          weightKg: 300,
          unit: "kg",
          measuredAt: "2026-03-01T12:00:00Z",
        },
        finalObservation: {
          eventId: "event-2",
          weightKg: 320,
          unit: "kg",
          measuredAt: "2026-03-11T12:00:00Z",
        },
        intervalDays: 10,
      },
    });
    expect(result).not.toHaveProperty("interval.gmd");
    expect(result).not.toHaveProperty("interval.dailyGain");
  });

  it("selects the two most recent distinct observations from three", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-1", "2026-01-01T12:00:00Z"),
          event("event-2", "2026-02-01T12:00:00Z"),
          event("event-3", "2026-03-01T12:00:00Z"),
        ],
        weightDetails: [
          detail("event-1", 250),
          detail("event-2", 280),
          detail("event-3", 310),
        ],
      }),
    );
    expect(result).toMatchObject({
      status: "READY",
      interval: {
        selectionPolicy: "LATEST_TWO_DISTINCT_OBSERVATIONS",
        initialObservation: { eventId: "event-2" },
        finalObservation: { eventId: "event-3" },
      },
    });
  });

  it("is independent of the physical input order", () => {
    const chronological = selectFactualGmdInterval(twoObservationInput());
    const reversed = selectFactualGmdInterval(
      input({
        events: [
          event("event-2", "2026-03-11T12:00:00Z"),
          event("event-1", "2026-03-01T12:00:00Z"),
        ],
        weightDetails: [detail("event-2", 320), detail("event-1", 300)],
      }),
    );
    expect(reversed).toEqual(chronological);
  });

  it("does not mix observations from another animal", () => {
    const target = twoObservationInput();
    const result = selectFactualGmdInterval({
      ...target,
      events: [
        ...target.events,
        event("event-other", "2026-03-20T12:00:00Z", {
          animal_id: "animal-2",
        }),
      ],
      weightDetails: [...target.weightDetails, detail("event-other", 900)],
    });
    expect(result).toMatchObject({
      status: "READY",
      interval: { finalObservation: { eventId: "event-2" } },
    });
  });

  it("does not mix events or details from another farm", () => {
    const target = twoObservationInput();
    const result = selectFactualGmdInterval({
      ...target,
      events: [
        ...target.events,
        event("event-other", "2026-03-20T12:00:00Z", {
          fazenda_id: "farm-2",
        }),
      ],
      weightDetails: [
        ...target.weightDetails,
        detail("event-other", 900, { fazenda_id: "farm-2" }),
        detail("event-2", 999, { fazenda_id: "farm-2" }),
      ],
    });
    expect(result).toMatchObject({
      status: "READY",
      interval: { finalObservation: { eventId: "event-2", weightKg: 320 } },
    });
  });

  it("returns conflict for distinct events at the same factual instant", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-a", "2026-03-01T12:00:00Z"),
          event("event-b", "2026-03-01T12:00:00Z"),
        ],
        weightDetails: [detail("event-a", 300), detail("event-b", 310)],
      }),
    );
    expect(result).toMatchObject({
      status: "CONFLICT",
      conflicts: [
        {
          code: "MEASUREMENT_TIMESTAMP_CONFLICT",
          measuredAt: "2026-03-01T12:00:00Z",
          eventIds: ["event-a", "event-b"],
        },
      ],
    });
  });

  it("does not silently include an observation after referenceDate", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-known", "2026-03-01T12:00:00Z"),
          event("event-future", "2026-05-01T12:00:00Z"),
        ],
        weightDetails: [
          detail("event-known", 300),
          detail("event-future", 350),
        ],
      }),
    );
    expect(result).toMatchObject({
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: 1,
    });
    if (result.status !== "INSUFFICIENT_OBSERVATIONS") {
      throw new Error("expected insufficient observations");
    }
    expect(result.limitations).toContainEqual({
      code: "FUTURE_MEASUREMENT_IGNORED",
      recordIds: ["event-future"],
    });
  });

  it("keeps a factual interval when final weight is lower", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-1", "2026-03-01T12:00:00Z"),
          event("event-2", "2026-03-11T12:00:00Z"),
        ],
        weightDetails: [detail("event-1", 320), detail("event-2", 300)],
      }),
    );
    expect(result).toMatchObject({
      status: "READY",
      interval: {
        initialObservation: { weightKg: 320 },
        finalObservation: { weightKg: 300 },
      },
    });
  });

  it("does not turn one observation plus its duplicate into two weighings", () => {
    const repeatedEvent = event("event-1", "2026-03-01T12:00:00Z");
    const repeatedDetail = detail("event-1", 300);
    const result = selectFactualGmdInterval(
      input({
        events: [repeatedEvent, { ...repeatedEvent }],
        weightDetails: [repeatedDetail, { ...repeatedDetail }],
      }),
    );
    expect(result).toMatchObject({
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: 1,
    });
  });

  it("returns conflict for divergent details attached to one event", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [event("event-1", "2026-03-01T12:00:00Z")],
        weightDetails: [detail("event-1", 300), detail("event-1", 310)],
      }),
    );
    expect(result).toMatchObject({
      status: "CONFLICT",
      conflicts: [{ code: "EVENT_WEIGHT_CONFLICT", eventIds: ["event-1"] }],
    });
  });

  it("does not ignore a conflict at the most recent instant", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-old", "2026-02-01T12:00:00Z"),
          event("event-a", "2026-03-01T12:00:00Z"),
          event("event-b", "2026-03-01T12:00:00Z"),
        ],
        weightDetails: [
          detail("event-old", 280),
          detail("event-a", 300),
          detail("event-b", 310),
        ],
      }),
    );
    expect(result.status).toBe("CONFLICT");
  });

  it("excludes invalid non-positive weight", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-zero", "2026-02-01T12:00:00Z"),
          event("event-valid", "2026-03-01T12:00:00Z"),
        ],
        weightDetails: [detail("event-zero", 0), detail("event-valid", 300)],
      }),
    );
    expect(result).toMatchObject({
      status: "INSUFFICIENT_OBSERVATIONS",
      observedCount: 1,
    });
  });

  it("uses the controlled referenceDate for deterministic selection", () => {
    const result = selectFactualGmdInterval(
      input({
        referenceDate: "2026-03-15T12:00:00Z",
        events: [
          event("event-1", "2026-03-01T12:00:00Z"),
          event("event-2", "2026-03-10T12:00:00Z"),
          event("event-3", "2026-03-20T12:00:00Z"),
        ],
        weightDetails: [
          detail("event-1", 300),
          detail("event-2", 310),
          detail("event-3", 320),
        ],
      }),
    );
    expect(result).toMatchObject({
      status: "READY",
      interval: {
        initialObservation: { eventId: "event-1" },
        finalObservation: { eventId: "event-2" },
      },
    });
  });

  it("keeps a short positive interval ready for contextual policy evaluation", () => {
    const result = selectFactualGmdInterval(
      input({
        events: [
          event("event-1", "2026-03-01T00:00:00Z"),
          event("event-2", "2026-03-01T12:00:00Z"),
        ],
        weightDetails: [detail("event-1", 300), detail("event-2", 301)],
      }),
    );
    expect(result).toMatchObject({
      status: "READY",
      interval: {
        intervalDays: 0.5,
        coverage: { minimumIntervalPolicy: "context_dependent" },
      },
    });
    if (result.status !== "READY") throw new Error("expected ready interval");
    expect(result.interval).not.toHaveProperty("gmdKgPerDay");
    expect(result.interval).not.toHaveProperty("reliability");
    expect(result.interval).not.toHaveProperty("operationalUse");
  });

  it("returns unsupported when the animal does not exist in the farm scope", () => {
    expect(
      selectFactualGmdInterval(input({ animal: null })),
    ).toMatchObject({ status: "UNSUPPORTED", reason: "ANIMAL_NOT_FOUND" });
  });
});
