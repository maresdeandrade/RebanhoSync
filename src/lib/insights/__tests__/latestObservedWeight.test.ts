import { describe, expect, it } from "vitest";
import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";
import {
  selectLatestObservedWeight,
  type SelectLatestObservedWeightInput,
} from "../latestObservedWeight";

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
  weight: number,
  overrides: Partial<EventoPesagem> = {},
): EventoPesagem {
  return {
    evento_id: eventId,
    fazenda_id: FARM_ID,
    peso_kg: weight,
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
  overrides: Partial<SelectLatestObservedWeightInput> = {},
): SelectLatestObservedWeightInput {
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

describe("selectLatestObservedWeight", () => {
  it("returns no observation without using zero as fallback", () => {
    expect(selectLatestObservedWeight(input())).toMatchObject({
      status: "unavailable",
      reason: "NO_OBSERVATION",
    });
  });

  it("returns the only factual observation in kg", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [event("event-1", "2026-03-15T12:00:00Z")],
        weightDetails: [detail("event-1", 350)],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: {
        animalId: ANIMAL_ID,
        fazendaId: FARM_ID,
        eventId: "event-1",
        weight: 350,
        unit: "kg",
        measuredAt: "2026-03-15T12:00:00Z",
      },
    });
    if (result.status !== "available") throw new Error("expected available");
    expect(result.value.limitations.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "LATEST_OBSERVED_WEIGHT_IS_NOT_CURRENT_WEIGHT",
        "MEASUREMENT_SOURCE_NOT_AVAILABLE",
        "MEASUREMENT_METHOD_NOT_AVAILABLE",
      ]),
    );
  });

  it("selects the latest factual date independently of insertion order", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [
          event("event-2", "2026-03-15T12:00:00Z"),
          event("event-3", "2026-02-10T12:00:00Z"),
          event("event-1", "2026-01-01T12:00:00Z"),
        ],
        weightDetails: [
          detail("event-1", 200),
          detail("event-2", 350),
          detail("event-3", 250),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { eventId: "event-2", weight: 350 },
    });
  });

  it("does not mix observations from another animal", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [
          event("event-a", "2026-02-01T12:00:00Z"),
          event("event-b", "2026-03-20T12:00:00Z", {
            animal_id: "animal-2",
          }),
        ],
        weightDetails: [detail("event-a", 300), detail("event-b", 500)],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { eventId: "event-a", weight: 300 },
    });
  });

  it("does not mix events or details from another farm", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [
          event("event-a", "2026-02-01T12:00:00Z"),
          event("event-b", "2026-03-20T12:00:00Z", {
            fazenda_id: "farm-2",
          }),
        ],
        weightDetails: [
          detail("event-a", 300),
          detail("event-b", 500, { fazenda_id: "farm-2" }),
          detail("event-a", 999, { fazenda_id: "farm-2" }),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { eventId: "event-a", weight: 300 },
    });
  });

  it("reports an animal outside the requested farm as not found", () => {
    const result = selectLatestObservedWeight(
      input({ animal: { ...animal, fazenda_id: "farm-2" } }),
    );

    expect(result).toMatchObject({
      status: "unavailable",
      reason: "ANIMAL_NOT_FOUND",
    });
  });

  it("reports a missing animal as not found", () => {
    expect(selectLatestObservedWeight(input({ animal: null }))).toMatchObject({
      status: "unavailable",
      reason: "ANIMAL_NOT_FOUND",
    });
  });

  it("ignores an invalid factual date and exposes the limitation", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [
          event("event-valid", "2026-02-01T12:00:00Z"),
          event("event-invalid", "not-a-date"),
        ],
        weightDetails: [
          detail("event-valid", 300),
          detail("event-invalid", 500),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { eventId: "event-valid", weight: 300 },
    });
    if (result.status !== "available") throw new Error("expected available");
    expect(result.value.limitations).toContainEqual({
      code: "INVALID_MEASUREMENT_DATE_IGNORED",
      recordIds: ["event-invalid"],
    });
  });

  it("returns an explicit conflict for distinct events at the latest instant", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [
          event("event-a", "2026-03-15T12:00:00Z"),
          event("event-b", "2026-03-15T12:00:00Z"),
        ],
        weightDetails: [detail("event-a", 300), detail("event-b", 300)],
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "conflict",
        conflict: {
          code: "LATEST_MEASUREMENT_TIMESTAMP_CONFLICT",
          measuredAt: "2026-03-15T12:00:00Z",
          eventIds: ["event-a", "event-b"],
        },
      }),
    );
  });

  it("collapses repeated copies of the same factual event and detail", () => {
    const repeatedEvent = event("event-1", "2026-03-15T12:00:00Z");
    const repeatedDetail = detail("event-1", 350);
    const result = selectLatestObservedWeight(
      input({
        events: [repeatedEvent, { ...repeatedEvent }],
        weightDetails: [repeatedDetail, { ...repeatedDetail }],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { eventId: "event-1", weight: 350 },
    });
  });

  it("reports divergent weights attached to the same event as conflict", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [event("event-1", "2026-03-15T12:00:00Z")],
        weightDetails: [detail("event-1", 350), detail("event-1", 360)],
      }),
    );

    expect(result).toMatchObject({
      status: "conflict",
      conflict: {
        code: "EVENT_WEIGHT_CONFLICT",
        measuredAt: "2026-03-15T12:00:00Z",
        eventIds: ["event-1"],
      },
    });
  });

  it("calculates ageDays from the controlled reference date without freshness threshold", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [event("event-1", "2026-03-01T12:00:00Z")],
        weightDetails: [detail("event-1", 400)],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { ageDays: 31 },
    });
    if (result.status !== "available") throw new Error("expected available");
    expect(result.value).not.toHaveProperty("freshness");
  });

  it("does not promote zero weight because the factual schema requires weight > 0", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [event("event-zero", "2026-03-01T12:00:00Z")],
        weightDetails: [detail("event-zero", 0)],
      }),
    );

    expect(result).toMatchObject({
      status: "unavailable",
      reason: "NO_VALID_OBSERVATION",
    });
    expect(result).not.toHaveProperty("value.weight", 0);
  });

  it("ignores future observations relative to the controlled reference date", () => {
    const result = selectLatestObservedWeight(
      input({
        events: [
          event("event-known", "2026-03-01T12:00:00Z"),
          event("event-future", "2026-05-01T12:00:00Z"),
        ],
        weightDetails: [
          detail("event-known", 400),
          detail("event-future", 500),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "available",
      value: { eventId: "event-known", weight: 400 },
    });
  });
});
