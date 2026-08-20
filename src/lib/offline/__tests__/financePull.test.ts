import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: new Map<string, unknown[]>(),
  errors: new Map<string, unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: async () => ({
          data: mocks.rows.get(table) ?? [],
          error: mocks.errors.get(table) ?? null,
        }),
      }),
    })),
  },
}));

import { db } from "../db";
import { pullDataForFarm } from "../pull";
import type { Operation } from "../types";

const farmA = "10000000-0000-4000-8000-000000000001";
const farmB = "10000000-0000-4000-8000-000000000002";
const transactionId = "20000000-0000-4000-8000-000000000001";
const transactionIdB = "20000000-0000-4000-8000-000000000002";
const categoryId = "30000000-0000-4000-8000-000000000001";

function pendingOperation(
  table: "finance_transactions" | "finance_categories",
  fazendaId: string,
  id: string,
): Operation {
  const clientOpId = `op-${table}-${fazendaId}-${id}`;
  const clientTxId = `tx-${table}-${fazendaId}-${id}`;
  return {
    client_op_id: clientOpId,
    client_tx_id: clientTxId,
    op_order: 0,
    table,
    action: "INSERT",
    record: {
      id,
      fazenda_id: fazendaId,
      client_op_id: clientOpId,
      client_tx_id: clientTxId,
      client_recorded_at: "2026-08-20T12:00:00.000Z",
      valor_total: table === "finance_transactions" ? 100 : undefined,
      nome: table === "finance_categories" ? "Categoria local" : undefined,
    },
    created_at: "2026-08-20T12:00:00.000Z",
  };
}

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.state_finance_transactions,
      db.state_finance_categories,
      db.state_animais,
    ],
    async () => {
      await db.queue_ops.clear();
      await db.state_finance_transactions.clear();
      await db.state_finance_categories.clear();
      await db.state_animais.clear();
    },
  );
}

describe("finance pull pending protection", () => {
  beforeEach(async () => {
    mocks.rows.clear();
    mocks.errors.clear();
    await clearStores();
  });

  afterEach(clearStores);

  it("preserves a pending transaction during replace when remote has no row", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.queue_ops.add(operation);
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
      status: "previsto",
    });
    mocks.rows.set("finance_transactions", []);

    await pullDataForFarm(farmA, ["finance_transactions"], {
      mode: "replace",
    });

    expect(
      await db.state_finance_transactions.get(transactionId),
    ).toMatchObject({
      fazenda_id: farmA,
      valor_total: 100,
      status: "previsto",
    });
  });

  it("preserves a pending transaction against an older remote row", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.queue_ops.add(operation);
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
      updated_at: "2026-08-20T12:00:00.000Z",
    });
    mocks.rows.set("finance_transactions", [
      {
        ...operation.record,
        valor_total: 50,
        updated_at: "2026-08-19T12:00:00.000Z",
      },
    ]);

    await pullDataForFarm(farmA, ["finance_transactions"], {
      mode: "replace",
    });

    expect(
      (await db.state_finance_transactions.get(transactionId))?.valor_total,
    ).toBe(100);
  });

  it("preserves a pending transaction against a remote tombstone", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.queue_ops.add(operation);
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
      deleted_at: null,
    });
    mocks.rows.set("finance_transactions", [
      {
        ...operation.record,
        deleted_at: "2026-08-20T12:01:00.000Z",
      },
    ]);

    await pullDataForFarm(farmA, ["finance_transactions"], {
      mode: "replace",
    });

    expect(
      (await db.state_finance_transactions.get(transactionId))?.deleted_at,
    ).toBe(null);
  });

  it("preserves a pending category during replace", async () => {
    const operation = pendingOperation("finance_categories", farmA, categoryId);
    await db.queue_ops.add(operation);
    await db.state_finance_categories.put({
      ...operation.record,
      nome: "Categoria local",
      slug: "categoria-local",
    });
    mocks.rows.set("finance_categories", []);

    await pullDataForFarm(farmA, ["finance_categories"], {
      mode: "replace",
    });

    expect(await db.state_finance_categories.get(categoryId)).toMatchObject({
      fazenda_id: farmA,
      nome: "Categoria local",
      slug: "categoria-local",
    });
  });

  it("does not protect another farm's row and preserves merge behavior", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.queue_ops.add(operation);
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
    });
    mocks.rows.set("finance_transactions", [
      {
        id: transactionIdB,
        fazenda_id: farmB,
        valor_total: 200,
        status: "realizado",
      },
    ]);

    await pullDataForFarm(farmB, ["finance_transactions"], { mode: "merge" });

    expect(
      (await db.state_finance_transactions.get(transactionId))?.fazenda_id,
    ).toBe(farmA);
    expect(
      (await db.state_finance_transactions.get(transactionIdB))?.fazenda_id,
    ).toBe(farmB);
    expect(
      (await db.state_finance_transactions.get(transactionIdB))?.valor_total,
    ).toBe(200);
  });

  it("stops protecting a transaction after its queue operation is consumed", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.queue_ops.add(operation);
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
    });
    mocks.rows.set("finance_transactions", [
      {
        ...operation.record,
        valor_total: 200,
      },
    ]);

    await pullDataForFarm(farmA, ["finance_transactions"], { mode: "replace" });
    expect(
      (await db.state_finance_transactions.get(transactionId))?.valor_total,
    ).toBe(100);

    await db.queue_ops.delete(operation.client_op_id);
    await pullDataForFarm(farmA, ["finance_transactions"], { mode: "replace" });
    expect(
      (await db.state_finance_transactions.get(transactionId))?.valor_total,
    ).toBe(200);
  });

  it("preserves pending finance rows during merge without advancing through overwrite", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.queue_ops.add(operation);
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
    });
    mocks.rows.set("finance_transactions", [
      {
        ...operation.record,
        valor_total: 250,
      },
    ]);

    await pullDataForFarm(farmA, ["finance_transactions"], { mode: "merge" });

    expect(
      (await db.state_finance_transactions.get(transactionId))?.valor_total,
    ).toBe(100);
  });

  it("does not partially write when a later finance pull fails", async () => {
    const operation = pendingOperation(
      "finance_transactions",
      farmA,
      transactionId,
    );
    await db.state_finance_transactions.put({
      ...operation.record,
      valor_total: 100,
    });
    mocks.rows.set("finance_transactions", [
      {
        ...operation.record,
        valor_total: 200,
      },
    ]);
    mocks.errors.set("finance_categories", new Error("network failure"));

    await expect(
      pullDataForFarm(farmA, ["finance_transactions", "finance_categories"], {
        mode: "replace",
      }),
    ).rejects.toThrow("network failure");

    expect(
      (await db.state_finance_transactions.get(transactionId))?.valor_total,
    ).toBe(100);
    expect(await db.state_finance_categories.count()).toBe(0);
  });
});
