/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const backend = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  fail: false,
  beforeDetail: undefined as undefined | (() => Promise<void>),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          const query = {
            in: () => query,
            then: async (resolve: (v: unknown) => void) => {
              if (table === "eventos_movimentacao" && backend.beforeDetail) {
                const hook = backend.beforeDetail;
                backend.beforeDetail = undefined;
                await hook();
              }
              resolve({
                data: backend.rows[table] ?? [],
                error: backend.fail ? { message: "offline" } : null,
              });
            },
          };
          return query;
        },
      }),
    }),
  },
}));
import { db, OfflineDB } from "../db";
import Dexie from "dexie";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { createGesture } from "../ops";
import {
  recordMovementResults,
  reconcileMovementForFarm,
} from "../movementReconciliation";
import { pullDataForFarm } from "../pull";
import type { Operation, SyncOperationResult } from "../types";
const farm = "aaaaaaaa-0000-4000-8000-000000000001",
  animal = "aaaaaaaa-0000-4000-8000-000000000002";
const lots = [3, 4, 5].map((n) => `aaaaaaaa-0000-4000-8000-00000000000${n}`);
async function enqueue(to = lots[1]) {
  const built = buildEventGesture({
    dominio: "movimentacao",
    fazendaId: farm,
    animalId: animal,
    fromLoteId: lots[0],
    toLoteId: to,
    occurredAt: "2026-10-01T12:00:00.000Z",
  });
  const tx = await createGesture(farm, built.ops);
  return (await db.queue_ops.where("client_tx_id").equals(tx).toArray())[0];
}
function identity(op: Operation) {
  return {
    fazenda_id: farm,
    event_id: String(op.record.event_id),
    client_op_id: op.client_op_id,
    client_tx_id: op.client_tx_id,
  };
}
function applied(op: Operation): SyncOperationResult {
  return {
    operation_identity: identity(op),
    op_id: op.client_op_id,
    status: "APPLIED",
    canonical_result: {
      status: "STATE_APPLIED",
      event_id: op.record.event_id,
      fazenda_id: farm,
      client_op_id: op.client_op_id,
      client_tx_id: op.client_tx_id,
      command_digest: op.command_digest,
    },
  };
}
async function ack(op: Operation, result = applied(op)) {
  await recordMovementResults(
    (await db.queue_gestures.get(op.client_tx_id))!,
    [op],
    [result],
  );
}
function observe(op: Operation, lot: string, version: string, reset = true) {
  if (reset) backend.rows = {};
  if (reset)
    backend.rows.animais = [
      {
        id: animal,
        fazenda_id: farm,
        lote_id: lot,
        movement_version: version,
        movement_head_event_id: op.record.event_id,
      },
    ];
  for (const [table, row] of Object.entries({
    eventos: { id: op.record.event_id, animal_id: animal },
    eventos_movimentacao: { evento_id: op.record.event_id },
    animal_lot_movement_effective_results: {
      event_id: op.record.event_id,
      animal_id: animal,
      command_digest: op.command_digest,
      effective_result: "STATE_APPLIED",
      effective_movement_version_after: version,
    },
  })) {
    backend.rows[table] = [
      ...(backend.rows[table] ?? []),
      { ...row, fazenda_id: farm },
    ];
  }
}
beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  backend.rows = {};
  backend.fail = false;
  backend.beforeDetail = undefined;
  await db.state_animais.put({
    id: animal,
    fazenda_id: farm,
    lote_id: lots[0],
    movement_version: "0",
    movement_head_event_id: null,
  } as never);
});
afterEach(() => vi.unstubAllGlobals());
it("R1 accepts the actual durable REJECTED RPC receipt as terminal", async () => {
  const op = await enqueue();
  const rpcResult: SyncOperationResult = {
    operation_identity: identity(op),
    op_id: op.client_op_id,
    status: "REJECTED",
    retryable: false,
    canonical_result: {
      status: "REJECTED",
      reason_code: "MOVEMENT_LOT_INVALID",
      event_id: op.record.event_id,
      fazenda_id: farm,
      animal_id: animal,
      command_digest: op.command_digest,
      replayed: false,
    },
  };
  await expect(ack(op, rpcResult)).resolves.toBeUndefined();
});
it("R2 ACK then failed pull then restart then replace B preserves unreconciled A", async () => {
  const op = await enqueue();
  await ack(op);
  backend.fail = true;
  await expect(reconcileMovementForFarm(farm)).rejects.toMatchObject({
    message: "offline",
  });
  db.close();
  await db.open();
  backend.fail = false;
  await pullDataForFarm(
    "bbbbbbbb-0000-4000-8000-000000000001",
    ["animais", "eventos", "eventos_movimentacao"],
    { mode: "replace" },
  );
  expect(await db.sync_reconcile_obligations.count()).toBe(1);
  expect(await db.state_animais.get(animal)).toBeDefined();
  expect(
    await db.event_eventos_movimentacao.get(op.record.event_id),
  ).toBeDefined();
  expect((await db.state_animais.get(animal))?.lote_id).toBe(lots[1]);
  observe(op, lots[1], "1");
  await reconcileMovementForFarm(farm);
  expect(await db.queue_ops.get(op.client_op_id)).toBeUndefined();
  expect(await db.sync_reconcile_obligations.count()).toBe(0);
});
it("R3 an ACK arriving after animal fetch cannot be terminalized by an older pull", async () => {
  const first = await enqueue();
  await ack(first);
  observe(first, lots[1], "1");
  let second: Operation;
  backend.beforeDetail = async () => {
    second = await enqueue(lots[2]);
    await ack(second);
  };
  await expect(reconcileMovementForFarm(farm)).rejects.toThrow(
    "MOVEMENT_RECONCILIATION_PENDING",
  );
  expect((await db.queue_gestures.get(second!.client_tx_id))?.status).toBe(
    "PENDING",
  );
  expect((await db.queue_ops.get(second!.client_op_id))?.sync_state).toBe(
    "RECONCILE",
  );
  expect(await db.sync_reconcile_obligations.count()).toBe(1);
  observe(second!, lots[2], "2");
  observe(first, lots[2], "1", false);
  await reconcileMovementForFarm(farm);
  expect((await db.queue_gestures.get(second!.client_tx_id))?.status).toBe(
    "DONE",
  );
});
it("R8 v32 abort rolls back atomically, restart invalidates legacy only and preserves another farm", async () => {
  const name = "closure-upgrade-" + crypto.randomUUID();
  const old = new Dexie(name);
  old.version(31).stores({
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
    .put({ client_tx_id: "old", fazenda_id: farm, status: "PENDING" });
  await old.table("queue_ops").bulkPut([
    {
      client_op_id: "old-event",
      client_tx_id: "old",
      table: "eventos",
      record: {
        id: "legacy",
        fazenda_id: farm,
        animal_id: animal,
        dominio: "movimentacao",
      },
    },
    {
      client_op_id: "other-farm",
      client_tx_id: "other",
      table: "animais",
      record: {
        id: "other-animal",
        fazenda_id: "farm-B",
        observacoes: "preserved",
      },
    },
  ]);
  old.close();
  const interrupted = new OfflineDB(name);
  interrupted
    .version(33)
    .stores({})
    .upgrade(() => {
      throw new Error("SIMULATED_UPGRADE_ABORT");
    });
  await expect(interrupted.open()).rejects.toThrow("SIMULATED_UPGRADE_ABORT");
  interrupted.close();
  await old.open();
  expect(await old.table("queue_ops").count()).toBe(2);
  old.close();
  const reopened = new OfflineDB(name);
  await reopened.open();
  expect(await reopened.queue_ops.get("old-event")).toBeUndefined();
  expect(await reopened.queue_ops.get("other-farm")).toMatchObject({
    record: { fazenda_id: "farm-B", observacoes: "preserved" },
  });
  expect(
    (await reopened.queue_ops.toArray()).some(
      (op) => op.table === "movement_v1",
    ),
  ).toBe(false);
  expect(
    await reopened.sync_reconcile_obligations.get(farm + ":movement-v1"),
  ).toBeDefined();
  reopened.close();
  await reopened.open();
  expect(await reopened.queue_rejections.count()).toBe(1);
  reopened.close();
  await Dexie.delete(name);
});

it.each(["event_id", "fazenda_id", "client_op_id", "client_tx_id"] as const)(
  "R1 rejects a response associated with another %s",
  async (key) => {
    const op = await enqueue();
    const response = applied(op);
    response.operation_identity![key] = crypto.randomUUID();
    await expect(ack(op, response)).rejects.toThrow(
      "MOVEMENT_RECEIPT_IDENTITY_MISMATCH",
    );
    expect((await db.queue_ops.get(op.client_op_id))?.sync_state).toBe(
      "PENDING",
    );
    expect(await db.sync_reconcile_obligations.count()).toBe(0);
  },
);
it("R3 a captured ACK without its remote facts/effect cannot complete", async () => {
  const op = await enqueue();
  await ack(op);
  backend.rows.animais = [
    { id: animal, fazenda_id: farm, lote_id: lots[0], movement_version: "0" },
  ];
  await expect(reconcileMovementForFarm(farm)).rejects.toThrow(
    "MOVEMENT_RECONCILIATION_PENDING",
  );
  expect((await db.queue_ops.get(op.client_op_id))?.sync_state).toBe(
    "RECONCILE",
  );
  expect((await db.state_animais.get(animal))?.lote_id).toBe(lots[1]);
});
