import { describe, it, expect } from "vitest";
import { buildAnimalOccupancyTimeline } from "../buildAnimalOccupancyTimeline";
import type { Evento, EventoMovimentacao } from "@/lib/offline/types";

describe("buildAnimalOccupancyTimeline", () => {
  const animalId = "animal-1";
  const farmId = "farm-1";
  const referenceDate = "2026-05-25T12:00:00.000Z";

  it("should build a timeline for an animal with single movement", () => {
    const events: Evento[] = [
      {
        id: "event-1",
        fazenda_id: farmId,
        dominio: "movimentacao",
        occurred_at: "2026-01-01T08:00:00.000Z",
        animal_id: animalId,
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-01T08:00:00.000Z",
        server_received_at: "2026-01-01T08:00:00.000Z",
        created_at: "2026-01-01T08:00:00.000Z",
        updated_at: "2026-01-01T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    const movimentacoes = new Map<string, EventoMovimentacao>([
      [
        "event-1",
        {
          evento_id: "event-1",
          fazenda_id: farmId,
          from_lote_id: null,
          to_lote_id: "lote-A",
          from_pasto_id: null,
          to_pasto_id: "pasto-X",
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-01T08:00:00.000Z",
          server_received_at: "2026-01-01T08:00:00.000Z",
          created_at: "2026-01-01T08:00:00.000Z",
          updated_at: "2026-01-01T08:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildAnimalOccupancyTimeline({
      animalId,
      events,
      movimentacoes,
      referenceDate,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      animalId,
      loteId: "lote-A",
      pastoId: "pasto-X",
      entradaAt: "2026-01-01T08:00:00.000Z",
      saidaAt: null,
      dias: 144, // Days from 2026-01-01 to 2026-05-25
    });
  });

  it("should handle multiple movements correctly", () => {
    const events: Evento[] = [
      {
        id: "event-1",
        fazenda_id: farmId,
        dominio: "movimentacao",
        occurred_at: "2026-01-01T08:00:00.000Z",
        animal_id: animalId,
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-01T08:00:00.000Z",
        server_received_at: "2026-01-01T08:00:00.000Z",
        created_at: "2026-01-01T08:00:00.000Z",
        updated_at: "2026-01-01T08:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "event-2",
        fazenda_id: farmId,
        dominio: "movimentacao",
        occurred_at: "2026-03-01T08:00:00.000Z",
        animal_id: animalId,
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-2",
        client_recorded_at: "2026-03-01T08:00:00.000Z",
        server_received_at: "2026-03-01T08:00:00.000Z",
        created_at: "2026-03-01T08:00:00.000Z",
        updated_at: "2026-03-01T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    const movimentacoes = new Map<string, EventoMovimentacao>([
      [
        "event-1",
        {
          evento_id: "event-1",
          fazenda_id: farmId,
          from_lote_id: null,
          to_lote_id: "lote-A",
          from_pasto_id: null,
          to_pasto_id: "pasto-X",
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-01T08:00:00.000Z",
          server_received_at: "2026-01-01T08:00:00.000Z",
          created_at: "2026-01-01T08:00:00.000Z",
          updated_at: "2026-01-01T08:00:00.000Z",
          deleted_at: null,
        },
      ],
      [
        "event-2",
        {
          evento_id: "event-2",
          fazenda_id: farmId,
          from_lote_id: "lote-A",
          to_lote_id: "lote-B",
          from_pasto_id: "pasto-X",
          to_pasto_id: "pasto-Y",
          payload: {},
          client_id: "client-1",
          client_op_id: "op-2",
          client_recorded_at: "2026-03-01T08:00:00.000Z",
          server_received_at: "2026-03-01T08:00:00.000Z",
          created_at: "2026-03-01T08:00:00.000Z",
          updated_at: "2026-03-01T08:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildAnimalOccupancyTimeline({
      animalId,
      events,
      movimentacoes,
      referenceDate,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      animalId,
      loteId: "lote-A",
      pastoId: "pasto-X",
      entradaAt: "2026-01-01T08:00:00.000Z",
      saidaAt: "2026-03-01T08:00:00.000Z",
      dias: 59, // Days from 2026-01-01 to 2026-03-01
    });
    expect(result[1]).toMatchObject({
      animalId,
      loteId: "lote-B",
      pastoId: "pasto-Y",
      entradaAt: "2026-03-01T08:00:00.000Z",
      saidaAt: null,
      dias: 85, // Days from 2026-03-01 to 2026-05-25
    });
  });

  it("should handle no movements", () => {
    const events: Evento[] = [];
    const movimentacoes = new Map<string, EventoMovimentacao>();

    const result = buildAnimalOccupancyTimeline({
      animalId,
      events,
      movimentacoes,
      referenceDate,
    });

    expect(result).toHaveLength(0);
  });

  it("should ignore movements for other animals", () => {
    const events: Evento[] = [
      {
        id: "event-1",
        fazenda_id: farmId,
        dominio: "movimentacao",
        occurred_at: "2026-01-01T08:00:00.000Z",
        animal_id: "other-animal",
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-01T08:00:00.000Z",
        server_received_at: "2026-01-01T08:00:00.000Z",
        created_at: "2026-01-01T08:00:00.000Z",
        updated_at: "2026-01-01T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    const movimentacoes = new Map<string, EventoMovimentacao>([
      [
        "event-1",
        {
          evento_id: "event-1",
          fazenda_id: farmId,
          from_lote_id: null,
          to_lote_id: "lote-A",
          from_pasto_id: null,
          to_pasto_id: "pasto-X",
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-01T08:00:00.000Z",
          server_received_at: "2026-01-01T08:00:00.000Z",
          created_at: "2026-01-01T08:00:00.000Z",
          updated_at: "2026-01-01T08:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildAnimalOccupancyTimeline({
      animalId,
      events,
      movimentacoes,
      referenceDate,
    });

    expect(result).toHaveLength(0);
  });

  it("should handle events with deleted_at", () => {
    const events: Evento[] = [
      {
        id: "event-1",
        fazenda_id: farmId,
        dominio: "movimentacao",
        occurred_at: "2026-01-01T08:00:00.000Z",
        animal_id: animalId,
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-01T08:00:00.000Z",
        server_received_at: "2026-01-01T08:00:00.000Z",
        created_at: "2026-01-01T08:00:00.000Z",
        updated_at: "2026-01-01T08:00:00.000Z",
        deleted_at: "2026-01-02T08:00:00.000Z",
      },
    ];
    const movimentacoes = new Map<string, EventoMovimentacao>([
      [
        "event-1",
        {
          evento_id: "event-1",
          fazenda_id: farmId,
          from_lote_id: null,
          to_lote_id: "lote-A",
          from_pasto_id: null,
          to_pasto_id: "pasto-X",
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-01T08:00:00.000Z",
          server_received_at: "2026-01-01T08:00:00.000Z",
          created_at: "2026-01-01T08:00:00.000Z",
          updated_at: "2026-01-01T08:00:00.000Z",
          deleted_at: "2026-01-02T08:00:00.000Z",
        },
      ],
    ]);

    const result = buildAnimalOccupancyTimeline({
      animalId,
      events,
      movimentacoes,
      referenceDate,
    });

    expect(result).toHaveLength(0);
  });
});
