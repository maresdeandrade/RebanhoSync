/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: new Map<string, unknown[]>() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: async (_column: string, fazendaId: string) => ({
          data: (mocks.rows.get(table) ?? []).filter(
            (row) =>
              (row as { fazenda_id?: string }).fazenda_id === fazendaId,
          ),
          error: null,
        }),
      }),
    })),
  },
}));

import { buildWeightGainForOccupancy } from "@/features/occupancy/buildWeightGainForOccupancy";
import type { AnimalOccupancyPeriod } from "@/features/occupancy/occupancyTypes";
import { db } from "../db";
import {
  DEFAULT_REMOTE_TABLES,
  pullDataForFarm,
} from "../pull";
import { STANDARD_EVENT_DETAIL_REMOTE_TABLES } from "../tableMap";
import type { Evento, EventoPesagem, Operation } from "../types";

const farm = "10000000-0000-4000-8000-000000000001";
const otherFarm = "10000000-0000-4000-8000-000000000002";
const occurredAt = "2026-08-23T12:00:00.000Z";

function baseEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    fazenda_id: farm,
    dominio: "pesagem",
    occurred_at: occurredAt,
    animal_id: "animal-1",
    lote_id: "lote-1",
    payload: {},
    deleted_at: null,
    ...overrides,
  };
}

function pendingOperation(
  table: string,
  record: Record<string, unknown>,
): Operation {
  const clientOpId = crypto.randomUUID();
  const clientTxId = crypto.randomUUID();
  return {
    client_op_id: clientOpId,
    client_tx_id: clientTxId,
    table,
    action: "INSERT",
    record: {
      ...record,
      fazenda_id: farm,
      client_id: "client-local",
      client_op_id: clientOpId,
      client_tx_id: clientTxId,
      client_recorded_at: occurredAt,
    },
    sync_state: "PENDING",
    created_at: occurredAt,
  };
}

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.event_eventos,
      db.event_eventos_ecc,
      db.event_eventos_pesagem,
      db.event_eventos_financeiro,
    ],
    async () => {
      await db.queue_ops.clear();
      await db.event_eventos.clear();
      await db.event_eventos_ecc.clear();
      await db.event_eventos_pesagem.clear();
      await db.event_eventos_financeiro.clear();
    },
  );
}

describe("standard factual detail pull", () => {
  beforeEach(async () => {
    mocks.rows.clear();
    await clearStores();
  });

  afterEach(clearStores);

  it("includes ECC, pesagem and financeiro in the default pull contract", () => {
    expect(DEFAULT_REMOTE_TABLES).toEqual(
      expect.arrayContaining([...STANDARD_EVENT_DETAIL_REMOTE_TABLES]),
    );
  });

  it("rebuilds a remote base event and ECC detail in a clean database", async () => {
    const eventId = "event-ecc-remote";
    mocks.rows.set("eventos", [baseEvent(eventId, { dominio: "ecc" })]);
    mocks.rows.set("eventos_ecc", [
      {
        event_id: eventId,
        fazenda_id: farm,
        animal_id: "animal-1",
        ecc: 3.5,
        deleted_at: null,
      },
    ]);

    await pullDataForFarm(farm, ["eventos", "eventos_ecc"]);

    expect(await db.event_eventos.get(eventId)).toBeDefined();
    expect(await db.event_eventos_ecc.get(eventId)).toMatchObject({
      event_id: eventId,
      ecc: 3.5,
    });
  });

  it("rebuilds remote weighings into the occupancy weight read model", async () => {
    const firstEventId = "event-weight-remote-1";
    const secondEventId = "event-weight-remote-2";
    mocks.rows.set("eventos", [
      baseEvent(firstEventId, { occurred_at: "2026-08-01T12:00:00.000Z" }),
      baseEvent(secondEventId, { occurred_at: "2026-08-21T12:00:00.000Z" }),
    ]);
    mocks.rows.set("eventos_pesagem", [
      { evento_id: firstEventId, fazenda_id: farm, peso_kg: 100, payload: {} },
      { evento_id: secondEventId, fazenda_id: farm, peso_kg: 130, payload: {} },
    ]);

    await pullDataForFarm(farm, ["eventos", "eventos_pesagem"]);

    const events = (await db.event_eventos.toArray()) as Evento[];
    const details = (await db.event_eventos_pesagem.toArray()) as EventoPesagem[];
    const period: AnimalOccupancyPeriod = {
      animalId: "animal-1",
      loteId: "lote-1",
      pastoId: null,
      entradaAt: "2026-08-01T00:00:00.000Z",
      saidaAt: "2026-08-31T00:00:00.000Z",
      dias: 30,
      weightStatus: { status: "empty" },
      eccStatus: { status: "empty" },
    };
    const readModel = buildWeightGainForOccupancy({
      period,
      events,
      pesagens: new Map(details.map((detail) => [detail.evento_id, detail])),
    });

    expect(readModel).toMatchObject({
      pesoInicial: 100,
      pesoFinal: 130,
      ganho: 30,
      weightStatus: { status: "complete" },
    });
  });

  it("rebuilds a remote base event and financeiro detail in a clean database", async () => {
    const eventId = "event-finance-remote";
    mocks.rows.set("eventos", [
      baseEvent(eventId, { dominio: "financeiro", animal_id: null }),
    ]);
    mocks.rows.set("eventos_financeiro", [
      {
        evento_id: eventId,
        fazenda_id: farm,
        tipo: "venda",
        valor_total: 7500,
        contraparte_id: null,
        payload: {},
        deleted_at: null,
      },
    ]);

    await pullDataForFarm(farm, ["eventos", "eventos_financeiro"]);

    expect(await db.event_eventos.get(eventId)).toBeDefined();
    expect(await db.event_eventos_financeiro.get(eventId)).toMatchObject({
      evento_id: eventId,
      valor_total: 7500,
    });
  });

  it.each([
    {
      table: "eventos_ecc",
      store: "event_eventos_ecc",
      key: "event_id",
      valueKey: "ecc",
      localValue: 4,
      remoteValue: 2,
    },
    {
      table: "eventos_pesagem",
      store: "event_eventos_pesagem",
      key: "evento_id",
      valueKey: "peso_kg",
      localValue: 420,
      remoteValue: 300,
    },
    {
      table: "eventos_financeiro",
      store: "event_eventos_financeiro",
      key: "evento_id",
      valueKey: "valor_total",
      localValue: 9000,
      remoteValue: 1000,
    },
  ])(
    "does not overwrite a pending local $table detail during replace pull",
    async ({ table, store, key, valueKey, localValue, remoteValue }) => {
      const eventId = `pending-${table}`;
      const local = {
        [key]: eventId,
        fazenda_id: farm,
        [valueKey]: localValue,
        payload: { source: "local" },
      };
      const operation = pendingOperation(table, local);
      await db.queue_ops.add(operation);
      await db.table(store).put(operation.record);
      mocks.rows.set(table, [
        {
          ...local,
          [valueKey]: remoteValue,
          payload: { source: "remote" },
        },
      ]);

      await pullDataForFarm(farm, [table], { mode: "replace" });

      expect(await db.table(store).get(eventId)).toMatchObject({
        [valueKey]: localValue,
        payload: { source: "local" },
      });
      expect(await db.queue_ops.get(operation.client_op_id)).toBeDefined();
    },
  );

  it("keeps another farm's factual details out of the active Dexie projection", async () => {
    const activeEventId = "event-active-farm";
    const foreignEventId = "event-other-farm";
    mocks.rows.set("eventos", [
      baseEvent(activeEventId, { dominio: "ecc" }),
      baseEvent(foreignEventId, { fazenda_id: otherFarm, dominio: "ecc" }),
    ]);
    mocks.rows.set("eventos_ecc", [
      { event_id: activeEventId, fazenda_id: farm, animal_id: "animal-1", ecc: 3 },
      { event_id: foreignEventId, fazenda_id: otherFarm, animal_id: "animal-2", ecc: 5 },
    ]);

    await pullDataForFarm(farm, ["eventos", "eventos_ecc"]);

    expect(await db.event_eventos.get(activeEventId)).toBeDefined();
    expect(await db.event_eventos_ecc.get(activeEventId)).toBeDefined();
    expect(await db.event_eventos.get(foreignEventId)).toBeUndefined();
    expect(await db.event_eventos_ecc.get(foreignEventId)).toBeUndefined();
  });
});
