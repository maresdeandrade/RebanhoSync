// @vitest-environment jsdom
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { db } from "@/lib/offline/db";
import {
  assertInventoryCommandContext,
  type InventoryCommandContext,
} from "@/lib/inventory/inventoryCommandContext";
import type { OperationInput } from "@/lib/offline/types";
import { createGesture } from "@/lib/offline/ops";

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await db.open();
  await db.state_insumos.put({
    id: "input-A",
    fazenda_id: "A",
    nome: "Sal A",
  } as never);
  await db.state_insumo_lotes.put({
    id: "lot-A",
    fazenda_id: "A",
    insumo_id: "input-A",
    saldo_atual_base: 10,
    unidade_base: "kg",
    status: "ativo",
  } as never);
});
afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("canonical inventory writer farm boundary", () => {
  it("rejects an UPDATE of A using farm B, without changing the row or queue", async () => {
    const before = await db.state_insumo_lotes.get("lot-A");
    const result = await createGesture("B", [
      {
        table: "insumo_lotes",
        action: "UPDATE",
        record: { id: "lot-A", status: "bloqueado" },
      },
    ]).then(
      () => "accepted",
      () => "rejected",
    );
    expect(result).toBe("rejected");
    expect(await db.state_insumo_lotes.get("lot-A")).toEqual(before);
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("rejects a new movement in B referencing the lot and input of A", async () => {
    const result = await createGesture("B", [
      {
        table: "insumo_movimentacoes",
        action: "INSERT",
        record: {
          id: "movement-B",
          insumo_id: "input-A",
          insumo_lote_id: "lot-A",
          tipo: "entrada",
          quantidade_base: 1,
          unidade_base: "kg",
        },
      },
    ]).then(
      () => "accepted",
      () => "rejected",
    );
    expect(result).toBe("rejected");
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.queue_gestures.count()).toBe(0);
  });
  it("rechecks the command context inside the transaction after an async lookup", async () => {
    let valid = true;
    const original = db.queue_gestures.get.bind(db.queue_gestures);
    vi.spyOn(db.queue_gestures, "get").mockImplementationOnce((key) =>
      Dexie.Promise.resolve(original(key)).then((row) => {
        valid = false;
        return row;
      }),
    );
    const result = await createGesture(
      "A",
      [
        {
          table: "insumo_lotes",
          action: "UPDATE",
          record: { id: "lot-A", status: "bloqueado" },
        },
      ],
      {
        validateContext: () => {
          if (!valid) throw new Error("context changed");
        },
      } as Parameters<typeof createGesture>[2],
    ).then(
      () => "accepted",
      () => "rejected",
    );
    expect(result).toBe("rejected");
    expect((await db.state_insumo_lotes.get("lot-A"))!.status).toBe("ativo");
    expect(await db.queue_gestures.count()).toBe(0);
  });
});

const update: OperationInput[] = [
  {
    table: "insumo_lotes",
    action: "UPDATE",
    record: { id: "lot-A", status: "bloqueado" },
  },
];
const owner: InventoryCommandContext = {
  farmId: "A",
  userId: "user-1",
  role: "owner",
  authenticated: true,
};
function guarded(
  captured: InventoryCommandContext,
  current: () => InventoryCommandContext | null,
  ops = update,
) {
  return createGesture("A", ops, {
    validateContext: () =>
      assertInventoryCommandContext(captured, current(), "A", ops),
  });
}
it.each(["owner", "manager"])(
  "accepts a valid same-farm edit for %s offline",
  async (role) => {
    const context = { ...owner, role };
    await guarded(context, () => context);
    expect((await db.state_insumo_lotes.get("lot-A"))!.status).toBe(
      "bloqueado",
    );
    expect(await db.queue_gestures.count()).toBe(1);
  },
);
it("accepts a same-command input, presentation, lot and movement without existing references", async () => {
  await createGesture("B", [
    {
      table: "insumos",
      action: "INSERT",
      record: { id: "input-B", nome: "Sal B" },
    },
    {
      table: "insumo_apresentacoes",
      action: "INSERT",
      record: { id: "presentation-B", insumo_id: "input-B" },
    },
    {
      table: "insumo_lotes",
      action: "INSERT",
      record: {
        id: "lot-B",
        insumo_id: "input-B",
        apresentacao_id: "presentation-B",
      },
    },
    {
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: "movement-B",
        insumo_id: "input-B",
        insumo_lote_id: "lot-B",
        tipo: "entrada",
        quantidade_base: 2,
      },
    },
  ]);
  expect((await db.state_insumo_lotes.get("lot-B"))!.fazenda_id).toBe("B");
  expect(await db.queue_ops.count()).toBe(4);
});
it("rolls back local writes and queue when the context changes during optimistic application", async () => {
  let current: InventoryCommandContext | null = owner;
  const invalidate = () => {
    current = { ...owner, farmId: "B" };
  };
  db.state_insumo_lotes.hook("updating", invalidate);
  await expect(guarded(owner, () => current)).rejects.toThrow(
    "INVENTORY_CONTEXT_CHANGED",
  );
  db.state_insumo_lotes.hook("updating").unsubscribe(invalidate);
  expect((await db.state_insumo_lotes.get("lot-A"))!.status).toBe("ativo");
  expect(await db.queue_ops.count()).toBe(0);
  expect(await db.queue_gestures.count()).toBe(0);
});
it.each([
  ["farm switch", { ...owner, farmId: "B" }],
  ["rapid A-B-A", { ...owner }],
  ["role revoked", { ...owner, role: "cowboy" }],
  ["session expired", { ...owner, authenticated: false }],
  ["unmount", null],
])("rejects an old async command after %s", async (_, current) => {
  await expect(guarded(owner, () => current)).rejects.toThrow(
    "INVENTORY_CONTEXT_CHANGED",
  );
  expect(await db.queue_gestures.count()).toBe(0);
});
it.each([
  { ...owner, farmId: null },
  { ...owner, userId: null },
  { ...owner, authenticated: false },
  { ...owner, role: null },
  { ...owner, role: "cowboy" },
])("rejects an unavailable operational context %j", async (context) => {
  await expect(guarded(context, () => context)).rejects.toThrow(
    /INVENTORY_(CONTEXT_CHANGED|ROLE_UNAVAILABLE)/,
  );
  expect(await db.queue_gestures.count()).toBe(0);
});
it("preserves cowboy consumption policy but denies manual movements", async () => {
  const context = { ...owner, role: "cowboy" };
  const ops: OperationInput[] = [
    {
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: "consumption-A",
        insumo_id: "input-A",
        insumo_lote_id: "lot-A",
        tipo: "consumo_nutricao",
        quantidade_base: 1,
      },
    },
  ];
  await guarded(context, () => context, ops);
  await expect(
    guarded(context, () => context, [
      {
        ...ops[0],
        record: { ...ops[0].record, id: "manual-A", tipo: "entrada" },
      },
    ]),
  ).rejects.toThrow("INVENTORY_ROLE_UNAVAILABLE");
  expect(await db.queue_gestures.count()).toBe(1);
});

it("preserves idempotent client transaction replay without duplicate operations", async () => {
  const options = { clientTxId: "tx-replay", clientOpIds: ["op-replay"] };
  await createGesture("A", update, options);
  await createGesture("A", update, options);
  expect(await db.queue_gestures.count()).toBe(1);
  expect(await db.queue_ops.count()).toBe(1);
});
it("rejects a foreign source event even with an own-farm lot", async () => {
  await db.event_eventos.put({ id: "event-B", fazenda_id: "B" } as never);
  await expect(
    createGesture("A", [
      {
        table: "insumo_movimentacoes",
        action: "INSERT",
        record: {
          id: "invalid-event",
          insumo_id: "input-A",
          insumo_lote_id: "lot-A",
          source_evento_id: "event-B",
          tipo: "consumo_nutricao",
          quantidade_base: 1,
        },
      },
    ]),
  ).rejects.toThrow("INVENTORY_ENTITY_FARM_MISMATCH");
  expect(await db.queue_ops.count()).toBe(0);
});

it("accepts a source event created atomically with its inventory consumption", async () => {
  await createGesture("A", [
    {
      table: "eventos",
      action: "INSERT",
      record: {
        id: "event-new",
        dominio: "nutricao",
        status: "confirmed",
        occurred_at: new Date().toISOString(),
      },
    },
    {
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: "consumption-new",
        insumo_id: "input-A",
        insumo_lote_id: "lot-A",
        source_evento_id: "event-new",
        tipo: "consumo_nutricao",
        quantidade_base: 1,
      },
    },
  ]);
  expect((await db.event_eventos.get("event-new"))!.fazenda_id).toBe("A");
  expect(
    (await db.state_insumo_movimentacoes.get("consumption-new"))!.fazenda_id,
  ).toBe("A");
  expect(await db.queue_ops.count()).toBe(2);
});
