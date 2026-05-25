import { describe, it, expect } from "vitest";
import { buildWeightGainForOccupancy } from "../buildWeightGainForOccupancy";
import type { AnimalOccupancyPeriod } from "../occupancyTypes";
import type { Evento, EventoPesagem } from "@/lib/offline/types";

describe("buildWeightGainForOccupancy", () => {
  const animalId = "animal-1";
  const farmId = "farm-1";

  it("should calculate weight gain correctly with two valid weighings", () => {
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
        id: "event-pesagem-1",
        fazenda_id: farmId,
        dominio: "pesagem",
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
        id: "event-pesagem-2",
        fazenda_id: farmId,
        dominio: "pesagem",
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
    const pesagens = new Map<string, EventoPesagem>([
      [
        "event-pesagem-1",
        {
          evento_id: "event-pesagem-1",
          fazenda_id: farmId,
          peso_kg: 100,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-05T00:00:00.000Z",
          server_received_at: "2026-01-05T00:00:00.000Z",
          created_at: "2026-01-05T00:00:00.000Z",
          updated_at: "2026-01-05T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      [
        "event-pesagem-2",
        {
          evento_id: "event-pesagem-2",
          fazenda_id: farmId,
          peso_kg: 130,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-2",
          client_recorded_at: "2026-01-25T00:00:00.000Z",
          server_received_at: "2026-01-25T00:00:00.000Z",
          created_at: "2026-01-25T00:00:00.000Z",
          updated_at: "2026-01-25T00:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildWeightGainForOccupancy({ period, events, pesagens });

    expect(result.pesoInicial).toBe(100);
    expect(result.pesoFinal).toBe(130);
    expect(result.ganho).toBe(30);
    expect(result.gmd).toBeCloseTo(1.5); // 30kg / 20 days
    expect(result.weightStatus.status).toBe("complete");
  });

  it("should return empty status if less than two weighings", () => {
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
        id: "event-pesagem-1",
        fazenda_id: farmId,
        dominio: "pesagem",
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
    const pesagens = new Map<string, EventoPesagem>([
      [
        "event-pesagem-1",
        {
          evento_id: "event-pesagem-1",
          fazenda_id: farmId,
          peso_kg: 110,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-15T00:00:00.000Z",
          server_received_at: "2026-01-15T00:00:00.000Z",
          created_at: "2026-01-15T00:00:00.000Z",
          updated_at: "2026-01-15T00:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildWeightGainForOccupancy({ period, events, pesagens });

    expect(result.weightStatus.status).toBe("partial");
    expect(result.weightStatus.reason).toBe("Apenas uma pesagem valida no periodo.");
  });

  it("should return partial status if only one valid weighing is used for both initial and final", () => {
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
        id: "event-pesagem-1",
        fazenda_id: farmId,
        dominio: "pesagem",
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
    const pesagens = new Map<string, EventoPesagem>([
      [
        "event-pesagem-1",
        {
          evento_id: "event-pesagem-1",
          fazenda_id: farmId,
          peso_kg: 110,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-15T00:00:00.000Z",
          server_received_at: "2026-01-15T00:00:00.000Z",
          created_at: "2026-01-15T00:00:00.000Z",
          updated_at: "2026-01-15T00:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildWeightGainForOccupancy({ period, events, pesagens });

    expect(result.weightStatus.status).toBe("partial");
    expect(result.weightStatus.reason).toBe("Apenas uma pesagem valida no periodo.");
  });

  it("should handle weighings outside the period", () => {
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
        id: "event-pesagem-1",
        fazenda_id: farmId,
        dominio: "pesagem",
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
        id: "event-pesagem-2",
        fazenda_id: farmId,
        dominio: "pesagem",
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
    const pesagens = new Map<string, EventoPesagem>([
      [
        "event-pesagem-1",
        {
          evento_id: "event-pesagem-1",
          fazenda_id: farmId,
          peso_kg: 100,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_recorded_at: "2026-01-05T00:00:00.000Z",
          server_received_at: "2026-01-05T00:00:00.000Z",
          created_at: "2026-01-05T00:00:00.000Z",
          updated_at: "2026-01-05T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      [
        "event-pesagem-2",
        {
          evento_id: "event-pesagem-2",
          fazenda_id: farmId,
          peso_kg: 130,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-2",
          client_recorded_at: "2026-01-25T00:00:00.000Z",
          server_received_at: "2026-01-25T00:00:00.000Z",
          created_at: "2026-01-25T00:00:00.000Z",
          updated_at: "2026-01-25T00:00:00.000Z",
          deleted_at: null,
        },
      ],
    ]);

    const result = buildWeightGainForOccupancy({ period, events, pesagens });

    expect(result.pesoInicial).toBe(100);
    expect(result.pesoFinal).toBe(130);
    expect(result.ganho).toBe(30);
    expect(result.gmd).toBeCloseTo(30 / 20); // 30kg / 20 days between weighings
    expect(result.weightStatus.status).toBe("complete");
  });
});
