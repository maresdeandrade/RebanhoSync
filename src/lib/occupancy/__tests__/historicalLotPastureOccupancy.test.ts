import { describe, expect, it } from "vitest";
import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import { selectHistoricalLotPastureOccupancy } from "../historicalLotPastureOccupancy";

const FAZENDA = "fazenda-1";
const LOTE = "lote-1";
const REFERENCE = "2026-07-01T00:00:00.000Z";

function event(
  id: string,
  occurredAt: string,
  overrides: Partial<Evento> = {},
): Evento {
  return {
    id,
    fazenda_id: FAZENDA,
    dominio: "movimentacao",
    occurred_at: occurredAt,
    animal_id: null,
    lote_id: LOTE,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: { tipo_movimentacao: "lote_pasto" },
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
  eventoId: string,
  fromPastoId: string | null,
  toPastoId: string | null,
  overrides: Partial<EventoMovimentacao> = {},
): EventoMovimentacao {
  return {
    evento_id: eventoId,
    fazenda_id: FAZENDA,
    from_lote_id: LOTE,
    to_lote_id: LOTE,
    from_pasto_id: fromPastoId,
    to_pasto_id: toPastoId,
    payload: { tipo_movimentacao: "lote_pasto" },
    client_id: "client-1",
    client_tx_id: null,
    client_recorded_at: "2026-01-01T00:00:00.000Z",
    server_received_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function select(
  events: readonly Evento[],
  movementDetails: readonly EventoMovimentacao[],
) {
  return selectHistoricalLotPastureOccupancy({
    loteId: LOTE,
    fazendaId: FAZENDA,
    referenceDate: REFERENCE,
    events,
    movementDetails,
  });
}

describe("selectHistoricalLotPastureOccupancy", () => {
  it("returns NO_HISTORY without treating absence as a pasture", () => {
    const result = select([], []);

    expect(result.status).toBe("NO_HISTORY");
    expect(result.intervals).toEqual([]);
  });

  it("identifies a whole-lot pasture movement and preserves the unknown origin boundary", () => {
    const movement = event("move-1", "2026-02-01T00:00:00.000Z");
    const result = select([movement], [detail("move-1", "pasto-1", "pasto-2")]);

    expect(result.status).toBe("PARTIAL");
    expect(result.intervals).toEqual([
      expect.objectContaining({
        loteId: LOTE,
        pastoId: "pasto-1",
        enteredAt: null,
        leftAt: movement.occurred_at,
        startBoundary: "LEFT_BOUND_UNKNOWN",
        endBoundary: "KNOWN",
      }),
      expect.objectContaining({
        loteId: LOTE,
        pastoId: "pasto-2",
        enteredAt: movement.occurred_at,
        leftAt: null,
        startBoundary: "KNOWN",
        endBoundary: "OPEN",
      }),
    ]);
  });

  it("creates a known start for null to pasture and no null-pasture interval", () => {
    const result = select(
      [event("move-1", "2026-02-01T00:00:00.000Z")],
      [detail("move-1", null, "pasto-2")],
    );

    expect(result.status).toBe("READY");
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]).toMatchObject({
      pastoId: "pasto-2",
      startBoundary: "KNOWN",
      endBoundary: "OPEN",
    });
  });

  it("reconstructs a chain independently of physical array order", () => {
    const first = event("move-1", "2026-02-01T00:00:00.000Z");
    const second = event("move-2", "2026-03-01T00:00:00.000Z");
    const ordered = select(
      [first, second],
      [detail("move-1", null, "pasto-1"), detail("move-2", "pasto-1", "pasto-2")],
    );
    const shuffled = select(
      [second, first],
      [detail("move-2", "pasto-1", "pasto-2"), detail("move-1", null, "pasto-1")],
    );

    expect(shuffled).toEqual(ordered);
    expect(ordered.intervals.map((interval) => interval.pastoId)).toEqual([
      "pasto-1",
      "pasto-2",
    ]);
  });

  it("deduplicates identical retries without duplicating occupancy", () => {
    const movement = event("move-1", "2026-02-01T00:00:00.000Z");
    const movementDetail = detail("move-1", null, "pasto-1");
    const result = select(
      [{ ...movement }, { ...movement }],
      [{ ...movementDetail }, { ...movementDetail }],
    );

    expect(result.status).toBe("READY");
    expect(result.intervals).toHaveLength(1);
    expect(result.coverage.deduplicatedEventCount).toBe(1);
    expect(result.coverage.deduplicatedDetailCount).toBe(1);
  });

  it("reports divergent event or detail identities as conflicts", () => {
    const base = event("move-1", "2026-02-01T00:00:00.000Z");
    const eventConflict = select(
      [base, { ...base, payload: { tipo_movimentacao: "lote_pasto", variant: true } }],
      [detail("move-1", null, "pasto-1")],
    );
    const detailConflict = select(
      [base],
      [detail("move-1", null, "pasto-1"), detail("move-1", null, "pasto-2")],
    );

    expect(eventConflict.conflicts[0].code).toBe("EVENT_IDENTITY_CONFLICT");
    expect(detailConflict.conflicts[0].code).toBe("DETAIL_IDENTITY_CONFLICT");
  });

  it("does not order incompatible movements at the same timestamp by ID", () => {
    const timestamp = "2026-02-01T00:00:00.000Z";
    const result = select(
      [event("move-z", timestamp), event("move-a", timestamp)],
      [
        detail("move-z", "pasto-1", "pasto-2"),
        detail("move-a", "pasto-1", "pasto-3"),
      ],
    );

    expect(result.status).toBe("CONFLICT");
    expect(result.conflicts[0]).toMatchObject({
      code: "SAME_TIMESTAMP_CONFLICT",
      eventIds: ["move-a", "move-z"],
    });
    expect(result.intervals).toEqual([]);
  });

  it("preserves the known prefix and stops at a broken chain", () => {
    const result = select(
      [
        event("move-1", "2026-02-01T00:00:00.000Z"),
        event("move-2", "2026-03-01T00:00:00.000Z"),
      ],
      [
        detail("move-1", null, "pasto-1"),
        detail("move-2", "pasto-x", "pasto-2"),
      ],
    );

    expect(result.status).toBe("CONFLICT");
    expect(result.conflicts[0].code).toBe("BROKEN_CHAIN");
    expect(result.intervals).toEqual([
      expect.objectContaining({
        pastoId: "pasto-1",
        endBoundary: "RIGHT_BOUND_UNKNOWN",
      }),
    ]);
  });

  it("isolates cross-farm and animal-lot movement facts", () => {
    const result = select(
      [
        event("other-farm", "2026-02-01T00:00:00.000Z", {
          fazenda_id: "fazenda-2",
        }),
        event("animal-move", "2026-02-02T00:00:00.000Z", {
          animal_id: "animal-1",
        }),
      ],
      [
        detail("other-farm", null, "pasto-x", { fazenda_id: "fazenda-2" }),
        detail("animal-move", null, "pasto-y"),
      ],
    );

    expect(result.status).toBe("NO_HISTORY");
    expect(result.coverage.scopedEventCount).toBe(0);
  });

  it("rejects a marked event whose detail identifies another lot", () => {
    const result = select(
      [event("move-1", "2026-02-01T00:00:00.000Z")],
      [
        detail("move-1", null, "pasto-1", {
          from_lote_id: "lote-2",
          to_lote_id: "lote-2",
        }),
      ],
    );

    expect(result.status).toBe("CONFLICT");
    expect(result.conflicts[0].code).toBe("LOT_IDENTITY_CONFLICT");
  });

  it("keeps correction, tombstone, and missing detail limitations explicit", () => {
    const correction = select(
      [
        event("move-1", "2026-02-01T00:00:00.000Z", {
          corrige_evento_id: "original",
        }),
      ],
      [detail("move-1", null, "pasto-1")],
    );
    const tombstone = select(
      [
        event("move-2", "2026-02-01T00:00:00.000Z", {
          deleted_at: "2026-02-02T00:00:00.000Z",
        }),
      ],
      [detail("move-2", null, "pasto-1")],
    );
    const missing = select(
      [event("move-3", "2026-02-01T00:00:00.000Z")],
      [],
    );

    expect(correction.conflicts[0].code).toBe("UNSUPPORTED_CORRECTION");
    expect(tombstone.limitations[0].code).toBe("TOMBSTONED_EVENT_IGNORED");
    expect(missing.limitations[0].code).toBe("MISSING_MOVEMENT_DETAIL");
    expect(correction.intervals).toEqual([]);
    expect(tombstone.intervals).toEqual([]);
    expect(missing.intervals).toEqual([]);
  });

  it("does not mutate event or detail inputs", () => {
    const events = [event("move-1", "2026-02-01T00:00:00.000Z")];
    const details = [detail("move-1", null, "pasto-1")];
    const snapshot = JSON.stringify({ events, details });

    select(events, details);

    expect(JSON.stringify({ events, details })).toBe(snapshot);
  });
});
