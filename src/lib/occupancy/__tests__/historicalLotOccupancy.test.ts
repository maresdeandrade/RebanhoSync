import { describe, expect, it } from "vitest";
import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import {
  selectHistoricalLotOccupancy,
  type SelectHistoricalLotOccupancyInput,
} from "../historicalLotOccupancy";

const FARM_ID = "farm-1";
const ANIMAL_ID = "animal-1";
const REFERENCE_DATE = "2026-04-01T12:00:00Z";

function event(
  id: string,
  occurredAt: string,
  overrides: Partial<Evento> = {},
): Evento {
  return {
    id,
    fazenda_id: FARM_ID,
    dominio: "movimentacao",
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
    client_tx_id: `tx-${id}`,
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
  fromLoteId: string | null,
  toLoteId: string | null,
  overrides: Partial<EventoMovimentacao> = {},
): EventoMovimentacao {
  return {
    evento_id: eventId,
    fazenda_id: FARM_ID,
    from_lote_id: fromLoteId,
    to_lote_id: toLoteId,
    from_pasto_id: null,
    to_pasto_id: null,
    payload: {},
    client_id: "client-1",
    client_tx_id: `tx-${eventId}`,
    client_recorded_at: REFERENCE_DATE,
    server_received_at: REFERENCE_DATE,
    created_at: REFERENCE_DATE,
    updated_at: REFERENCE_DATE,
    deleted_at: null,
    ...overrides,
  };
}

function input(
  overrides: Partial<SelectHistoricalLotOccupancyInput> = {},
): SelectHistoricalLotOccupancyInput {
  return {
    animalId: ANIMAL_ID,
    fazendaId: FARM_ID,
    referenceDate: REFERENCE_DATE,
    events: [],
    movementDetails: [],
    ...overrides,
  };
}

function chainInput(): SelectHistoricalLotOccupancyInput {
  return input({
    events: [
      event("event-1", "2026-01-10T12:00:00Z"),
      event("event-2", "2026-02-10T12:00:00Z"),
    ],
    movementDetails: [
      detail("event-1", "lot-a", "lot-b"),
      detail("event-2", "lot-b", "lot-c"),
    ],
  });
}

describe("selectHistoricalLotOccupancy", () => {
  it("returns NO_HISTORY without turning absence into a null-lot interval", () => {
    expect(selectHistoricalLotOccupancy(input())).toMatchObject({
      status: "NO_HISTORY",
      intervals: [],
      coverage: { history: "NO_HISTORY" },
    });
  });

  it("preserves the unknown left boundary for the first A to B fact", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [event("event-1", "2026-01-10T12:00:00Z")],
        movementDetails: [detail("event-1", "lot-a", "lot-b")],
      }),
    );

    expect(result).toMatchObject({
      status: "PARTIAL",
      intervals: [
        {
          loteId: "lot-a",
          enteredAt: null,
          leftAt: "2026-01-10T12:00:00Z",
          startBoundary: "LEFT_BOUND_UNKNOWN",
          endBoundary: "KNOWN",
          sourceEventIds: ["event-1"],
        },
        {
          loteId: "lot-b",
          enteredAt: "2026-01-10T12:00:00Z",
          leftAt: null,
          startBoundary: "KNOWN",
          endBoundary: "OPEN",
          sourceEventIds: ["event-1"],
        },
      ],
      coverage: {
        history: "PARTIAL_HISTORY",
        leftBoundary: "LEFT_BOUND_UNKNOWN",
        rightBoundary: "OPEN_RIGHT_BOUND",
      },
    });
  });

  it("starts a known interval for null to B without creating a null lot", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [event("event-1", "2026-01-10T12:00:00Z")],
        movementDetails: [detail("event-1", null, "lot-b")],
      }),
    );

    expect(result).toMatchObject({
      status: "READY",
      intervals: [
        {
          loteId: "lot-b",
          enteredAt: "2026-01-10T12:00:00Z",
          leftAt: null,
          startBoundary: "KNOWN",
          endBoundary: "OPEN",
        },
      ],
      coverage: {
        history: "CONTIGUOUS_HISTORY",
        leftBoundary: "KNOWN_LEFT_BOUND",
        rightBoundary: "OPEN_RIGHT_BOUND",
      },
    });
  });

  it("reconstructs A to B to C as contiguous half-open boundaries", () => {
    const result = selectHistoricalLotOccupancy(chainInput());

    expect(result.intervals).toEqual([
      expect.objectContaining({
        loteId: "lot-a",
        enteredAt: null,
        leftAt: "2026-01-10T12:00:00Z",
        startBoundary: "LEFT_BOUND_UNKNOWN",
        endBoundary: "KNOWN",
      }),
      expect.objectContaining({
        loteId: "lot-b",
        enteredAt: "2026-01-10T12:00:00Z",
        leftAt: "2026-02-10T12:00:00Z",
        endBoundary: "KNOWN",
        sourceEventIds: ["event-1", "event-2"],
      }),
      expect.objectContaining({
        loteId: "lot-c",
        enteredAt: "2026-02-10T12:00:00Z",
        leftAt: null,
        endBoundary: "OPEN",
      }),
    ]);
    expect(result.status).toBe("PARTIAL");
  });

  it("is independent of the physical order of events and details", () => {
    const chronological = selectHistoricalLotOccupancy(chainInput());
    const source = chainInput();
    const reversed = selectHistoricalLotOccupancy({
      ...source,
      events: [...source.events].reverse(),
      movementDetails: [...source.movementDetails].reverse(),
    });

    expect(reversed).toEqual(chronological);
  });

  it("keeps the current interval open instead of writing referenceDate as leftAt", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        referenceDate: "2026-01-20T12:00:00Z",
        events: [event("event-1", "2026-01-10T12:00:00Z")],
        movementDetails: [detail("event-1", null, "lot-b")],
      }),
    );

    expect(result.intervals[0]).toMatchObject({
      leftAt: null,
      endBoundary: "OPEN",
    });
    expect(result.referenceDate).toBe("2026-01-20T12:00:00Z");
  });

  it("isolates cross-animal and cross-farm data offline", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("target", "2026-01-10T12:00:00Z"),
          event("other-animal", "2026-01-20T12:00:00Z", {
            animal_id: "animal-2",
          }),
          event("other-farm", "2026-01-25T12:00:00Z", {
            fazenda_id: "farm-2",
          }),
        ],
        movementDetails: [
          detail("target", null, "lot-b"),
          detail("other-animal", null, "lot-x"),
          detail("other-farm", null, "lot-y", { fazenda_id: "farm-2" }),
          detail("target", null, "lot-leak", { fazenda_id: "farm-2" }),
        ],
      }),
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].loteId).toBe("lot-b");
    expect(result.coverage.scopedEventCount).toBe(1);
  });

  it("deduplicates identical retries of the same Evento and detail", () => {
    const repeatedEvent = event("event-1", "2026-01-10T12:00:00Z");
    const repeatedDetail = detail("event-1", null, "lot-b");
    const result = selectHistoricalLotOccupancy(
      input({
        events: [repeatedEvent, { ...repeatedEvent }],
        movementDetails: [repeatedDetail, { ...repeatedDetail }],
      }),
    );

    expect(result.status).toBe("READY");
    expect(result.intervals).toHaveLength(1);
    expect(result.coverage).toMatchObject({
      deduplicatedEventCount: 1,
      deduplicatedDetailCount: 1,
      appliedMovementCount: 1,
    });
  });

  it("reports divergent copies of one detail as conflict", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [event("event-1", "2026-01-10T12:00:00Z")],
        movementDetails: [
          detail("event-1", null, "lot-b"),
          detail("event-1", null, "lot-c"),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "CONFLICT",
      intervals: [],
      conflicts: [{ code: "DETAIL_IDENTITY_CONFLICT", eventIds: ["event-1"] }],
    });
  });

  it("reports divergent copies of one Evento as conflict", () => {
    const base = event("event-1", "2026-01-10T12:00:00Z");
    const result = selectHistoricalLotOccupancy(
      input({
        events: [base, { ...base, payload: { divergent: true } }],
        movementDetails: [detail("event-1", null, "lot-b")],
      }),
    );

    expect(result).toMatchObject({
      status: "CONFLICT",
      conflicts: [{ code: "EVENT_IDENTITY_CONFLICT", eventIds: ["event-1"] }],
    });
  });

  it("does not impose an ID order on incompatible movements at the same instant", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("event-a", "2026-01-10T12:00:00Z"),
          event("event-b", "2026-01-10T12:00:00Z"),
        ],
        movementDetails: [
          detail("event-a", "lot-a", "lot-b"),
          detail("event-b", "lot-a", "lot-c"),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "CONFLICT",
      intervals: [],
      conflicts: [
        {
          code: "SAME_TIMESTAMP_CONFLICT",
          eventIds: ["event-a", "event-b"],
        },
      ],
    });
  });

  it("preserves the known prefix and stops at a broken chain", () => {
    const source = chainInput();
    const result = selectHistoricalLotOccupancy({
      ...source,
      movementDetails: [
        detail("event-1", "lot-a", "lot-b"),
        detail("event-2", "lot-c", "lot-d"),
      ],
    });

    expect(result.status).toBe("CONFLICT");
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "BROKEN_CHAIN", eventIds: ["event-2"] }),
      ]),
    );
    expect(result.intervals).toEqual([
      expect.objectContaining({ loteId: "lot-a", endBoundary: "KNOWN" }),
      expect.objectContaining({
        loteId: "lot-b",
        enteredAt: "2026-01-10T12:00:00Z",
        leftAt: null,
        endBoundary: "RIGHT_BOUND_UNKNOWN",
      }),
    ]);
  });

  it("ignores a future movement relative to explicit referenceDate", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        referenceDate: "2026-01-15T12:00:00Z",
        events: [
          event("known", "2026-01-10T12:00:00Z"),
          event("future", "2026-02-10T12:00:00Z"),
        ],
        movementDetails: [
          detail("known", null, "lot-b"),
          detail("future", "lot-b", "lot-c"),
        ],
      }),
    );

    expect(result.status).toBe("READY");
    expect(result.intervals).toHaveLength(1);
    expect(result.limitations).toContainEqual({
      code: "FUTURE_EVENT_IGNORED",
      eventIds: ["future"],
      affectsCoverage: false,
    });
  });

  it("does not turn an invalid event date into a fact", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("known", "2026-01-10T12:00:00Z"),
          event("invalid", "not-a-date"),
        ],
        movementDetails: [
          detail("known", null, "lot-b"),
          detail("invalid", "lot-b", "lot-c"),
        ],
      }),
    );

    expect(result.status).toBe("PARTIAL");
    expect(result.intervals).toEqual([
      expect.objectContaining({
        loteId: "lot-b",
        endBoundary: "RIGHT_BOUND_UNKNOWN",
      }),
    ]);
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_EVENT_DATE_IGNORED" }),
      ]),
    );
  });

  it("blocks an invalid referenceDate without consulting the clock", () => {
    expect(
      selectHistoricalLotOccupancy(input({ referenceDate: "invalid" })),
    ).toMatchObject({
      status: "CONFLICT",
      intervals: [],
      conflicts: [{ code: "INVALID_REFERENCE_DATE" }],
    });
  });

  it("does not infer a movement from an Evento with missing detail", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("known", "2026-01-10T12:00:00Z"),
          event("missing", "2026-02-10T12:00:00Z"),
        ],
        movementDetails: [detail("known", null, "lot-b")],
      }),
    );

    expect(result).toMatchObject({
      status: "PARTIAL",
      intervals: [{ loteId: "lot-b", endBoundary: "RIGHT_BOUND_UNKNOWN" }],
    });
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_MOVEMENT_DETAIL",
          eventIds: ["missing"],
        }),
      ]),
    );
  });

  it("does not resolve an ambiguous correction and stops beyond it", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("original", "2026-01-10T12:00:00Z"),
          event("correction", "2026-02-10T12:00:00Z", {
            corrige_evento_id: "original",
          }),
        ],
        movementDetails: [
          detail("original", null, "lot-b"),
          detail("correction", "lot-b", "lot-c"),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "CONFLICT",
      intervals: [{ loteId: "lot-b", endBoundary: "RIGHT_BOUND_UNKNOWN" }],
      conflicts: [{ code: "UNSUPPORTED_CORRECTION" }],
    });
  });

  it("excludes tombstoned facts with an explicit coverage limitation", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("known", "2026-01-10T12:00:00Z"),
          event("deleted", "2026-02-10T12:00:00Z", {
            deleted_at: "2026-02-11T12:00:00Z",
          }),
        ],
        movementDetails: [
          detail("known", null, "lot-b"),
          detail("deleted", "lot-b", "lot-c"),
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "PARTIAL",
      intervals: [{ loteId: "lot-b", endBoundary: "RIGHT_BOUND_UNKNOWN" }],
    });
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TOMBSTONED_EVENT_IGNORED" }),
      ]),
    );
  });

  it("closes A on a received A to null fact without creating a null lot", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [event("exit", "2026-01-10T12:00:00Z")],
        movementDetails: [detail("exit", "lot-a", null)],
      }),
    );

    expect(result).toMatchObject({
      status: "PARTIAL",
      intervals: [
        {
          loteId: "lot-a",
          enteredAt: null,
          leftAt: "2026-01-10T12:00:00Z",
          endBoundary: "KNOWN",
        },
      ],
    });
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "NON_CANONICAL_NULL_DESTINATION" }),
      ]),
    );
  });

  it("ignores pasture-only movement and exposes no pasture or state contract", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [
          event("pasture", "2026-01-10T12:00:00Z", {
            animal_id: null,
            lote_id: "lot-a",
            payload: { tipo_movimentacao: "lote_pasto" },
          }),
        ],
        movementDetails: [
          detail("pasture", "lot-a", "lot-a", {
            from_pasto_id: "pasture-a",
            to_pasto_id: "pasture-b",
          }),
        ],
      }),
    );

    expect(result).toMatchObject({ status: "NO_HISTORY", intervals: [] });
    expect(result).not.toHaveProperty("pastureIntervals");
    expect(result).not.toHaveProperty("currentState");
  });

  it("does not calculate duration fields", () => {
    const result = selectHistoricalLotOccupancy(
      input({
        events: [event("event-1", "2026-01-10T12:00:00Z")],
        movementDetails: [detail("event-1", null, "lot-b")],
      }),
    );

    const interval = result.intervals[0] as unknown as Record<string, unknown>;
    expect(interval).not.toHaveProperty("duration");
    expect(interval).not.toHaveProperty("durationDays");
    expect(interval).not.toHaveProperty("daysInLot");
  });

  it("does not mutate source arrays or records", () => {
    const source = chainInput();
    const before = structuredClone(source);

    selectHistoricalLotOccupancy(source);

    expect(source).toEqual(before);
  });
});
