import { describe, expect, it } from "vitest";
import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import { selectHistoricalPastureOccupancy } from "../historicalPastureOccupancy";

const FAZENDA = "fazenda-1";
const ANIMAL = "animal-1";
const REFERENCE = "2026-07-01T00:00:00.000Z";

function event(
  id: string,
  occurredAt: string,
  options: {
    animalId?: string | null;
    loteId?: string | null;
    fazendaId?: string;
    correctionId?: string | null;
    deletedAt?: string | null;
    payload?: Record<string, unknown>;
  } = {},
): Evento {
  return {
    id,
    fazenda_id: options.fazendaId ?? FAZENDA,
    dominio: "movimentacao",
    occurred_at: occurredAt,
    animal_id: options.animalId === undefined ? ANIMAL : options.animalId,
    lote_id: options.loteId ?? null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: options.correctionId ?? null,
    observacoes: null,
    payload: options.payload ?? {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: null,
    client_recorded_at: occurredAt,
    server_received_at: occurredAt,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: options.deletedAt ?? null,
  };
}

function animalMove(
  id: string,
  occurredAt: string,
  fromLoteId: string | null,
  toLoteId: string | null,
): { event: Evento; detail: EventoMovimentacao } {
  return {
    event: event(id, occurredAt),
    detail: detail(id, fromLoteId, toLoteId, null, null),
  };
}

function pastureMove(
  id: string,
  occurredAt: string,
  loteId: string,
  fromPastoId: string | null,
  toPastoId: string | null,
  overrides: {
    fazendaId?: string;
    correctionId?: string | null;
    deletedAt?: string | null;
  } = {},
): { event: Evento; detail: EventoMovimentacao } {
  const fazendaId = overrides.fazendaId ?? FAZENDA;
  return {
    event: event(id, occurredAt, {
      animalId: null,
      loteId,
      fazendaId,
      correctionId: overrides.correctionId,
      deletedAt: overrides.deletedAt,
      payload: { tipo_movimentacao: "lote_pasto" },
    }),
    detail: detail(
      id,
      loteId,
      loteId,
      fromPastoId,
      toPastoId,
      { fazenda_id: fazendaId },
    ),
  };
}

function detail(
  eventoId: string,
  fromLoteId: string | null,
  toLoteId: string | null,
  fromPastoId: string | null,
  toPastoId: string | null,
  overrides: Partial<EventoMovimentacao> = {},
): EventoMovimentacao {
  return {
    evento_id: eventoId,
    fazenda_id: FAZENDA,
    from_lote_id: fromLoteId,
    to_lote_id: toLoteId,
    from_pasto_id: fromPastoId,
    to_pasto_id: toPastoId,
    payload: {},
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
  facts: readonly { event: Evento; detail: EventoMovimentacao }[],
) {
  return selectHistoricalPastureOccupancy({
    animalId: ANIMAL,
    fazendaId: FAZENDA,
    referenceDate: REFERENCE,
    events: facts.map((fact) => fact.event),
    movementDetails: facts.map((fact) => fact.detail),
  });
}

describe("selectHistoricalPastureOccupancy", () => {
  it("composes a stable animal lot with a lot pasture change", () => {
    const result = select([
      animalMove("animal-in", "2026-02-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("pasture-in", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove(
        "pasture-change",
        "2026-03-01T00:00:00.000Z",
        "lote-1",
        "pasto-1",
        "pasto-2",
      ),
    ]);

    expect(result.status).toBe("READY");
    expect(result.intervals).toEqual([
      expect.objectContaining({
        loteId: "lote-1",
        pastoId: "pasto-1",
        enteredAt: "2026-02-01T00:00:00.000Z",
        leftAt: "2026-03-01T00:00:00.000Z",
      }),
      expect.objectContaining({
        loteId: "lote-1",
        pastoId: "pasto-2",
        enteredAt: "2026-03-01T00:00:00.000Z",
        leftAt: null,
        endBoundary: "OPEN",
      }),
    ]);
  });

  it("changes pasture only through factual intersections when the animal changes lot", () => {
    const result = select([
      animalMove("animal-in", "2026-01-10T00:00:00.000Z", null, "lote-1"),
      animalMove("animal-change", "2026-03-01T00:00:00.000Z", "lote-1", "lote-2"),
      pastureMove("l1-p1", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("l2-p2", "2026-02-01T00:00:00.000Z", "lote-2", null, "pasto-2"),
    ]);

    expect(result.intervals.map((interval) => [interval.loteId, interval.pastoId])).toEqual([
      ["lote-1", "pasto-1"],
      ["lote-2", "pasto-2"],
    ]);
    expect(result.intervals[0].leftAt).toBe("2026-03-01T00:00:00.000Z");
    expect(result.intervals[1].enteredAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("preserves separate provenance when two lots occupy the same pasture", () => {
    const result = select([
      animalMove("animal-in", "2026-01-10T00:00:00.000Z", null, "lote-1"),
      animalMove("animal-change", "2026-03-01T00:00:00.000Z", "lote-1", "lote-2"),
      pastureMove("l1-p1", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("l2-p1", "2026-02-01T00:00:00.000Z", "lote-2", null, "pasto-1"),
    ]);

    expect(result.intervals).toHaveLength(2);
    expect(result.intervals[0].lotOccupancySourceEventIds).toContain("animal-change");
    expect(result.intervals[0].pastureSourceEventIds).toContain("l1-p1");
    expect(result.intervals[1].lotOccupancySourceEventIds).toContain("animal-change");
    expect(result.intervals[1].pastureSourceEventIds).toContain("l2-p1");
  });

  it("keeps a pasture gap explicit instead of backfilling it", () => {
    const result = select([
      animalMove("animal-in", "2026-01-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("pasture-in", "2026-02-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
    ]);

    expect(result.status).toBe("PARTIAL");
    expect(result.intervals[0].enteredAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.coverage.unknownPasturePeriods).toEqual([
      expect.objectContaining({
        loteId: "lote-1",
        enteredAt: "2026-01-01T00:00:00.000Z",
        leftAt: "2026-02-01T00:00:00.000Z",
      }),
    ]);
    expect(result.limitations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "PASTURE_UNKNOWN" })]),
    );
  });

  it("does not create pasture occupancy where animal lot history has a gap", () => {
    const result = select([
      animalMove("animal-in", "2026-02-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("old-pasture", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
    ]);

    expect(result.intervals[0].enteredAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.intervals.some((interval) => interval.enteredAt === "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("never promotes LEFT_BOUND_UNKNOWN coverage", () => {
    const result = select([
      animalMove("animal-change", "2026-03-01T00:00:00.000Z", "lote-1", "lote-2"),
      pastureMove("l1-p1", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("l2-p2", "2026-02-01T00:00:00.000Z", "lote-2", null, "pasto-2"),
    ]);

    expect(result.status).toBe("PARTIAL");
    expect(result.coverage.leftBoundary).toBe("LEFT_BOUND_UNKNOWN");
    expect(result.intervals[0].startBoundary).toBe("LEFT_BOUND_UNKNOWN");
  });

  it("keeps a fully supported final interval open without writing referenceDate as an exit", () => {
    const result = select([
      animalMove("animal-in", "2026-02-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("pasture-in", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
    ]);

    expect(result.coverage.rightBoundary).toBe("OPEN_RIGHT_BOUND");
    expect(result.intervals[0]).toMatchObject({ leftAt: null, endBoundary: "OPEN" });
  });

  it("propagates an F22C.1 conflict without using current state to repair it", () => {
    const result = select([
      animalMove("animal-in", "2026-01-01T00:00:00.000Z", null, "lote-1"),
      animalMove("broken", "2026-03-01T00:00:00.000Z", "lote-x", "lote-2"),
      pastureMove("l1-p1", "2025-12-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
    ]);

    expect(result.status).toBe("CONFLICT");
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "ANIMAL_LOT", code: "BROKEN_CHAIN" }),
      ]),
    );
  });

  it("propagates same-time, broken-chain, correction, and tombstone pasture evidence", () => {
    const animal = animalMove("animal-in", "2026-01-01T00:00:00.000Z", null, "lote-1");
    const sameTime = select([
      animal,
      pastureMove("pasture-a", "2026-02-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("pasture-b", "2026-02-01T00:00:00.000Z", "lote-1", null, "pasto-2"),
    ]);
    const broken = select([
      animal,
      pastureMove("pasture-in", "2026-01-02T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("pasture-broken", "2026-02-01T00:00:00.000Z", "lote-1", "pasto-x", "pasto-2"),
    ]);
    const correction = select([
      animal,
      pastureMove("pasture-correction", "2026-02-01T00:00:00.000Z", "lote-1", null, "pasto-1", {
        correctionId: "original",
      }),
    ]);
    const tombstone = select([
      animal,
      pastureMove("pasture-deleted", "2026-02-01T00:00:00.000Z", "lote-1", null, "pasto-1", {
        deletedAt: "2026-02-02T00:00:00.000Z",
      }),
    ]);

    expect(sameTime.conflicts[0].code).toBe("SAME_TIMESTAMP_CONFLICT");
    expect(broken.conflicts[0].code).toBe("BROKEN_CHAIN");
    expect(correction.conflicts[0].code).toBe("UNSUPPORTED_CORRECTION");
    expect(tombstone.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TOMBSTONED_EVENT_IGNORED" }),
      ]),
    );
  });

  it("isolates cross-farm pasture evidence even when lot IDs match", () => {
    const result = select([
      animalMove("animal-in", "2026-01-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("other-farm", "2026-01-02T00:00:00.000Z", "lote-1", null, "pasto-x", {
        fazendaId: "fazenda-2",
      }),
    ]);

    expect(result.status).toBe("PARTIAL");
    expect(result.intervals).toEqual([]);
    expect(result.coverage.unknownPasturePeriods).toHaveLength(1);
  });

  it("is deterministic for shuffled facts and identical retries", () => {
    const facts = [
      animalMove("animal-in", "2026-02-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("pasture-in", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("pasture-change", "2026-03-01T00:00:00.000Z", "lote-1", "pasto-1", "pasto-2"),
    ];
    const retry = {
      event: { ...facts[1].event },
      detail: { ...facts[1].detail },
    };

    expect(select([facts[2], retry, facts[0], facts[1]])).toEqual(select(facts));
  });

  it("reports divergent duplicate pasture details as conflict", () => {
    const animal = animalMove("animal-in", "2026-01-01T00:00:00.000Z", null, "lote-1");
    const pasture = pastureMove("pasture-in", "2026-01-02T00:00:00.000Z", "lote-1", null, "pasto-1");
    const divergent = {
      event: { ...pasture.event },
      detail: { ...pasture.detail, to_pasto_id: "pasto-2" },
    };
    const result = select([animal, pasture, divergent]);

    expect(result.status).toBe("CONFLICT");
    expect(result.conflicts[0].code).toBe("DETAIL_IDENTITY_CONFLICT");
  });

  it("keeps every composed interval contained in both factual source intervals", () => {
    const facts = [
      animalMove("animal-in", "2026-02-01T00:00:00.000Z", null, "lote-1"),
      animalMove("animal-out", "2026-05-01T00:00:00.000Z", "lote-1", "lote-2"),
      pastureMove("pasture-in", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
      pastureMove("pasture-change", "2026-03-01T00:00:00.000Z", "lote-1", "pasto-1", "pasto-2"),
      pastureMove("l2-p3", "2026-04-01T00:00:00.000Z", "lote-2", null, "pasto-3"),
    ];
    const result = select(facts);

    expect(result.intervals).toHaveLength(3);
    expect(result.intervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          loteId: "lote-1",
          pastoId: "pasto-1",
          enteredAt: "2026-02-01T00:00:00.000Z",
          leftAt: "2026-03-01T00:00:00.000Z",
        }),
        expect.objectContaining({
          loteId: "lote-1",
          pastoId: "pasto-2",
          enteredAt: "2026-03-01T00:00:00.000Z",
          leftAt: "2026-05-01T00:00:00.000Z",
        }),
        expect.objectContaining({
          loteId: "lote-2",
          pastoId: "pasto-3",
          enteredAt: "2026-05-01T00:00:00.000Z",
          leftAt: null,
        }),
      ]),
    );
  });

  it("does not expose duration or current-pasture state and does not mutate inputs", () => {
    const facts = [
      animalMove("animal-in", "2026-02-01T00:00:00.000Z", null, "lote-1"),
      pastureMove("pasture-in", "2026-01-01T00:00:00.000Z", "lote-1", null, "pasto-1"),
    ];
    const before = JSON.stringify(facts);
    const result = select(facts);
    const interval = result.intervals[0] as unknown as Record<string, unknown>;

    expect(interval.duration).toBeUndefined();
    expect(interval.durationDays).toBeUndefined();
    expect(interval.daysInPasture).toBeUndefined();
    expect(interval.currentPastoId).toBeUndefined();
    expect(JSON.stringify(facts)).toBe(before);
  });
});
