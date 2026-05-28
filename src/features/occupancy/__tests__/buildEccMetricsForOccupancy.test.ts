import { describe, it, expect } from "vitest";
import { buildEccMetricsForOccupancy } from "../buildEccMetricsForOccupancy";
import type { AnimalOccupancyPeriod } from "../occupancyTypes";
import type { Evento, EventoEcc } from "@/lib/offline/types";

describe("buildEccMetricsForOccupancy", () => {
  const animalId = "animal-1";
  const farmId = "farm-1";

  it("should calculate ECC metrics correctly with two valid ECC events", () => {
    const period: AnimalOccupancyPeriod = {
      animalId,
      loteId: "lote-A",
      pastoId: "pasto-X",
      entradaAt: "2026-01-01T00:00:00.000Z",
      saidaAt: "2026-01-31T00:00:00.000Z",
      dias: 30,
      weightStatus: { status: "empty" },
      eccStatus: { status: "empty" },
    };
    const events: Evento[] = [
      {
        id: "event-ecc-1",
        fazenda_id: farmId,
        dominio: "ecc",
        occurred_at: "2026-01-05T00:00:00.000Z",
        animal_id: animalId,
        lote_id: "lote-A",
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-05T00:00:00.000Z",
        server_received_at: "2026-01-05T00:00:00.000Z",
        created_at: "2026-01-05T00:00:00.000Z",
        updated_at: "2026-01-05T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "event-ecc-2",
        fazenda_id: farmId,
        dominio: "ecc",
        occurred_at: "2026-01-25T00:00:00.000Z",
        animal_id: animalId,
        lote_id: "lote-A",
        payload: {},
        client_id: "client-1",
        client_op_id: "op-2",
        client_recorded_at: "2026-01-25T00:00:00.000Z",
        server_received_at: "2026-01-25T00:00:00.000Z",
        created_at: "2026-01-25T00:00:00.000Z",
        updated_at: "2026-01-25T00:00:00.000Z",
        deleted_at: null,
      },
    ];
    const eccs = new Map<string, EventoEcc>([
      [
        "event-ecc-1",
        {
          event_id: "event-ecc-1",
          fazenda_id: farmId,
          animal_id: animalId,
          ecc: 3,
          escala_min: 1,
          escala_max: 5,
          escala_passo: 0.25,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-05T00:00:00.000Z",
          created_at: "2026-01-05T00:00:00.000Z",
          updated_at: "2026-01-05T00:00:00.000Z",
          deleted_at: null,
          client_tx_id: null,
        },
      ],
      [
        "event-ecc-2",
        {
          event_id: "event-ecc-2",
          fazenda_id: farmId,
          animal_id: animalId,
          ecc: 4,
          escala_min: 1,
          escala_max: 5,
          escala_passo: 0.25,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-2",
          client_recorded_at: "2026-01-25T00:00:00.000Z",
          created_at: "2026-01-25T00:00:00.000Z",
          updated_at: "2026-01-25T00:00:00.000Z",
          deleted_at: null,
          client_tx_id: null,
        },
      ],
    ]);

    const result = buildEccMetricsForOccupancy({ period, events, eccs });

    expect(result.eccInicial).toBe(3);
    expect(result.eccFinal).toBe(4);
    expect(result.variacaoEcc).toBe(1);
    expect(result.eccStatus.status).toBe("complete");
  });

  it("should return empty status if no ECC events", () => {
    const period: AnimalOccupancyPeriod = {
      animalId,
      loteId: "lote-A",
      pastoId: "pasto-X",
      entradaAt: "2026-01-01T00:00:00.000Z",
      saidaAt: "2026-01-31T00:00:00.000Z",
      dias: 30,
      weightStatus: { status: "empty" },
      eccStatus: { status: "empty" },
    };
    const events: Evento[] = [];
    const eccs = new Map<string, EventoEcc>();

    const result = buildEccMetricsForOccupancy({ period, events, eccs });

    expect(result.eccStatus.status).toBe("empty");
    expect(result.eccStatus.reason).toBe("Sem ECC individual registrado para o animal no periodo.");
  });

  it("should return partial status if only one ECC event", () => {
    const period: AnimalOccupancyPeriod = {
      animalId,
      loteId: "lote-A",
      pastoId: "pasto-X",
      entradaAt: "2026-01-01T00:00:00.000Z",
      saidaAt: "2026-01-31T00:00:00.000Z",
      dias: 30,
      weightStatus: { status: "empty" },
      eccStatus: { status: "empty" },
    };
    const events: Evento[] = [
      {
        id: "event-ecc-1",
        fazenda_id: farmId,
        dominio: "ecc",
        occurred_at: "2026-01-15T00:00:00.000Z",
        animal_id: animalId,
        lote_id: "lote-A",
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-15T00:00:00.000Z",
        server_received_at: "2026-01-15T00:00:00.000Z",
        created_at: "2026-01-15T00:00:00.000Z",
        updated_at: "2026-01-15T00:00:00.000Z",
        deleted_at: null,
      },
    ];
    const eccs = new Map<string, EventoEcc>([
      [
        "event-ecc-1",
        {
          event_id: "event-ecc-1",
          fazenda_id: farmId,
          animal_id: animalId,
          ecc: 3.5,
          escala_min: 1,
          escala_max: 5,
          escala_passo: 0.25,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-15T00:00:00.000Z",
          created_at: "2026-01-15T00:00:00.000Z",
          updated_at: "2026-01-15T00:00:00.000Z",
          deleted_at: null,
          client_tx_id: null,
        },
      ],
    ]);

    const result = buildEccMetricsForOccupancy({ period, events, eccs });

    expect(result.eccInicial).toBe(3.5);
    expect(result.eccFinal).toBeUndefined();
    expect(result.variacaoEcc).toBeUndefined();
    expect(result.eccStatus.status).toBe("partial");
    expect(result.eccStatus.reason).toBe("Apenas uma avaliacao de ECC disponivel no periodo.");
  });

  it("should handle ECC events outside the period", () => {
    const period: AnimalOccupancyPeriod = {
      animalId,
      loteId: "lote-A",
      pastoId: "pasto-X",
      entradaAt: "2026-01-10T00:00:00.000Z",
      saidaAt: "2026-01-20T00:00:00.000Z",
      dias: 10,
      weightStatus: { status: "empty" },
      eccStatus: { status: "empty" },
    };
    const events: Evento[] = [
      {
        id: "event-ecc-1",
        fazenda_id: farmId,
        dominio: "ecc",
        occurred_at: "2026-01-05T00:00:00.000Z", // Before entry
        animal_id: animalId,
        lote_id: "lote-A",
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_recorded_at: "2026-01-05T00:00:00.000Z",
        server_received_at: "2026-01-05T00:00:00.000Z",
        created_at: "2026-01-05T00:00:00.000Z",
        updated_at: "2026-01-05T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "event-ecc-2",
        fazenda_id: farmId,
        dominio: "ecc",
        occurred_at: "2026-01-25T00:00:00.000Z", // After exit
        animal_id: animalId,
        lote_id: "lote-A",
        payload: {},
        client_id: "client-1",
        client_op_id: "op-2",
        client_recorded_at: "2026-01-25T00:00:00.000Z",
        server_received_at: "2026-01-25T00:00:00.000Z",
        created_at: "2026-01-25T00:00:00.000Z",
        updated_at: "2026-01-25T00:00:00.000Z",
        deleted_at: null,
      },
    ];
    const eccs = new Map<string, EventoEcc>([
      [
        "event-ecc-1",
        {
          event_id: "event-ecc-1",
          fazenda_id: farmId,
          animal_id: animalId,
          ecc: 3,
          escala_min: 1,
          escala_max: 5,
          escala_passo: 0.25,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-05T00:00:00.000Z",
          created_at: "2026-01-05T00:00:00.000Z",
          updated_at: "2026-01-05T00:00:00.000Z",
          deleted_at: null,
          client_tx_id: null,
        },
      ],
      [
        "event-ecc-2",
        {
          event_id: "event-ecc-2",
          fazenda_id: farmId,
          animal_id: animalId,
          ecc: 4,
          escala_min: 1,
          escala_max: 5,
          escala_passo: 0.25,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-2",
          client_recorded_at: "2026-01-25T00:00:00.000Z",
          created_at: "2026-01-25T00:00:00.000Z",
          updated_at: "2026-01-25T00:00:00.000Z",
          deleted_at: null,
          client_tx_id: null,
        },
      ],
    ]);

    const result = buildEccMetricsForOccupancy({ period, events, eccs });

    expect(result.eccInicial).toBe(3);
    expect(result.eccFinal).toBe(4);
    expect(result.variacaoEcc).toBe(1);
    expect(result.eccStatus.status).toBe("complete");
  });
});
