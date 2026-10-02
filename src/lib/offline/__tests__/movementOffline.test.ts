/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { db, OfflineDB } from "../db";
import { createGesture } from "../ops";
import { prepareMovementIntents } from "../movement";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { Animal } from "../types";

const farm = "aaaaaaaa-0000-4000-8000-000000000001",
  animal = "aaaaaaaa-0000-4000-8000-000000000002";
const lots = [3, 4, 5, 6].map((n) => `aaaaaaaa-0000-4000-8000-00000000000${n}`);
async function move(to: string, historical = false) {
  return createGesture(
    farm,
    buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farm,
      animalId: animal,
      fromLoteId: lots[0],
      toLoteId: to,
      occurredAt: "2026-10-01T12:00:00.000Z",
      applyAnimalStateUpdate: !historical,
    }).ops,
  );
}
describe("movement shared queue and cutover", () => {
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    await db.open();
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.state_animais.put({
      id: animal,
      fazenda_id: farm,
      lote_id: lots[0],
      movement_version: "0",
      movement_head_event_id: null,
    } as Animal);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("never queues a generic animal location update and persists factual intent once", async () => {
    const tx = await move(lots[1]);
    const ops = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].table).toBe("movement_v1");
    expect(ops[0].record.movement_base).toEqual({
      kind: "snapshot",
      movement_version: "0",
      head_event_id: null,
    });
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);
    expect((await db.state_animais.get(animal))?.movement_version).toBe("0");
  });
  it("chains persisted predecessors regardless of UUID key order, including reopen", async () => {
    const first = await move(lots[1]);
    const one = (
      await db.queue_ops.where("client_tx_id").equals(first).toArray()
    )[0];
    db.close();
    await db.open();
    const second = await move(lots[2]);
    const two = (
      await db.queue_ops.where("client_tx_id").equals(second).toArray()
    )[0];
    expect(two.record.movement_base).toEqual({
      kind: "after_movement",
      event_id: one.record.event_id,
      command_digest: one.command_digest,
    });
    expect((await db.queue_ops.get(one.client_op_id))?.record).toEqual(
      one.record,
    );
  });
  it("history-only does not mutate state or require a token", async () => {
    await db.state_animais.update(animal, { movement_version: undefined });
    const tx = await move(lots[1], true);
    expect((await db.state_animais.get(animal))?.lote_id).toBe(lots[0]);
    expect(
      (await db.queue_ops.where("client_tx_id").equals(tx).toArray())[0].record
        .movement_base,
    ).toBeNull();
  });
  it("missing snapshot fails before queue or optimistic effect", async () => {
    await db.state_animais.update(animal, { movement_version: undefined });
    await expect(move(lots[1])).rejects.toThrow(
      "MOVEMENT_SNAPSHOT_REQUIRED_PULL",
    );
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("unsafe numeric server token fails closed", async () => {
    await db.state_animais.update(animal, { movement_version: Number.MAX_SAFE_INTEGER + 1 });
    await expect(move(lots[1])).rejects.toThrow("MOVEMENT_SNAPSHOT_TOKEN_UNSAFE");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("preserves supplied transport identity when materializing the command", async () => {
    const tx = crypto.randomUUID(), opId = crypto.randomUUID();
    const built = buildEventGesture({ dominio: "movimentacao", fazendaId: farm, animalId: animal, fromLoteId: lots[0], toLoteId: lots[1] });
    await createGesture(farm, built.ops, { clientTxId: tx, clientOpIds: [opId] });
    expect((await db.queue_ops.get(opId))?.record).toMatchObject({ client_tx_id: tx, client_op_id: opId, event_id: built.eventId });
  });
  it("detects concurrent local snapshot change before any queue commit", async () => {
    const built = buildEventGesture({ dominio: "movimentacao", fazendaId: farm, animalId: animal, fromLoteId: lots[0], toLoteId: lots[1] });
    const prepared = await prepareMovementIntents(farm, built.ops, crypto.randomUUID());
    await db.state_animais.update(animal, { movement_version: "1" });
    await expect(prepared.verify()).rejects.toThrow("MOVEMENT_LOCAL_SNAPSHOT_CHANGED_RESUBMIT");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("blocks old generic bundles and direct location writer", async () => {
    await expect(
      createGesture(farm, [
        {
          table: "eventos",
          action: "INSERT",
          record: { dominio: "movimentacao", animal_id: animal },
        },
      ]),
    ).rejects.toThrow("LEGACY_ANIMAL_MOVEMENT_WRITER_DISABLED");
    await expect(
      createGesture(farm, [
        {
          table: "animais",
          action: "UPDATE",
          record: { id: animal, lote_id: lots[1] },
        },
      ]),
    ).rejects.toThrow("GENERIC_ANIMAL_LOCATION_WRITER_DISABLED");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("preserves generic non-location operations in a mixed gesture", async () => {
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farm,
      animalId: animal,
      fromLoteId: lots[0],
      toLoteId: lots[1],
    });
    const tx = await createGesture(farm, [
      ...built.ops,
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animal, observacoes: "retained" },
      },
    ]);
    expect(
      (await db.queue_ops.where("client_tx_id").equals(tx).toArray())
        .map((op) => op.table)
        .sort(),
    ).toEqual(["animais", "movement_v1"]);
  });
  it("v32 invalidates incompatible local movement only; never manufactures a command", async () => {
    const name = `movement-upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old
      .version(31)
      .stores({
        queue_ops: "client_op_id,client_tx_id",
        queue_gestures: "client_tx_id",
        queue_rejections: "++id",
        event_eventos: "id",
        event_eventos_movimentacao: "evento_id",
        state_animais: "id",
      });
    await old.open();
    await old
      .table("queue_gestures")
      .put({ client_tx_id: "old", status: "PENDING" });
    await old.table("queue_ops").bulkPut([
      {
        client_op_id: "old-event",
        client_tx_id: "old",
        table: "eventos",
        record: {
          id: "event",
          fazenda_id: farm,
          dominio: "movimentacao",
          animal_id: animal,
        },
      },
      {
        client_op_id: "unrelated",
        client_tx_id: "other",
        table: "animais",
        record: { id: animal, observacoes: "safe" },
      },
    ]);
    old.close();
    const upgraded = new OfflineDB(name);
    try {
      await upgraded.open();
      expect(await upgraded.queue_ops.get("old-event")).toBeUndefined();
      expect(await upgraded.queue_ops.get("unrelated")).toBeDefined();
      expect((await upgraded.queue_gestures.get("old"))?.status).toBe(
        "REJECTED",
      );
      expect(await upgraded.queue_rejections.count()).toBe(1);
    } finally {
      upgraded.close();
      await Dexie.delete(name);
    }
  });
});
