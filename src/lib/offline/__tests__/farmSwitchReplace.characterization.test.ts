/**
 * @vitest-environment jsdom
 *
 * F24.3B1 — regressao do replace A -> B -> A.
 * O cache sincronizado continua descartavel, mas toda projecao local sustentada
 * por operacao nao terminal deve sobreviver ao replace global da store.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const remoteRows = vi.hoisted(() => ({
  byFarm: new Map<string, Array<Record<string, unknown>>>(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async (_column: string, farmId: string) => ({
          data: remoteRows.byFarm.get(farmId) ?? [],
          error: null,
        })),
      })),
    })),
  },
}));

import { db, LOCAL_OWNERSHIP_KEY } from "../db";
import { pullDataForFarm } from "../pull";

const farmA = "farm-switch-a";
const farmB = "farm-switch-b";

async function clearStores() {
  await Promise.all([
    db.state_animais.clear(),
    db.queue_gestures.clear(),
    db.queue_ops.clear(),
    db.sync_pull_cursors.clear(),
    db.sync_reconcile_obligations.clear(),
    db.local_ownership.clear(),
  ]);
}

describe("F24.3B1 — farm-aware replace", () => {
  beforeEach(async () => {
    await clearStores();
    remoteRows.byFarm.clear();

    remoteRows.byFarm.set(farmA, [
      { id: "animal-a-synced", fazenda_id: farmA, status: "ativo" },
      { id: "animal-a-pending", fazenda_id: farmA, status: "ativo" },
    ]);
    remoteRows.byFarm.set(farmB, [
      { id: "animal-b-synced", fazenda_id: farmB, status: "ativo" },
      { id: "animal-b-pending", fazenda_id: farmB, status: "ativo" },
    ]);

    await db.table("state_animais").bulkPut([
      { id: "animal-a-synced", fazenda_id: farmA, status: "ativo" },
      { id: "animal-a-pending", fazenda_id: farmA, status: "ativo" },
      { id: "animal-b-synced", fazenda_id: farmB, status: "ativo" },
      { id: "animal-b-pending", fazenda_id: farmB, status: "ativo" },
    ]);
    await db.queue_ops.bulkPut([
      {
        client_op_id: "op-a-pending",
        client_tx_id: "tx-a-pending",
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-a-pending", fazenda_id: farmA },
        sync_state: "PENDING",
        retry_count: 3,
        next_attempt_at: "2026-09-21T10:10:00.000Z",
        domain_op_id: "domain-op-a",
        created_at: "2026-09-21T10:00:00.000Z",
      },
      {
        client_op_id: "op-b-pending",
        client_tx_id: "tx-b-pending",
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-b-pending", fazenda_id: farmB },
        sync_state: "RETRYABLE",
        retry_count: 2,
        next_attempt_at: "2026-09-21T10:05:00.000Z",
        domain_op_id: "domain-op-b",
        created_at: "2026-09-21T10:00:01.000Z",
      },
    ]);
    await db.queue_gestures.bulkPut([
      {
        client_tx_id: "tx-a-pending",
        fazenda_id: farmA,
        client_id: "client-a",
        status: "PENDING",
        retry_count: 3,
        created_at: "2026-09-21T10:00:00.000Z",
      },
      {
        client_tx_id: "tx-b-pending",
        fazenda_id: farmB,
        client_id: "client-b",
        status: "PENDING",
        retry_count: 2,
        created_at: "2026-09-21T10:00:01.000Z",
      },
    ]);
    await db.sync_pull_cursors.bulkPut([
      {
        key: "animais:fazenda:farm-switch-a",
        remote_table: "animais",
        local_store: "state_animais",
        scope: "fazenda",
        fazenda_id: farmA,
        last_updated_at: "2026-09-20T00:00:00.000Z",
        last_id: "animal-a-synced",
        updated_at: "2026-09-20T00:00:00.000Z",
      },
      {
        key: "animais:fazenda:farm-switch-b",
        remote_table: "animais",
        local_store: "state_animais",
        scope: "fazenda",
        fazenda_id: farmB,
        last_updated_at: "2026-09-20T00:00:00.000Z",
        last_id: "animal-b-synced",
        updated_at: "2026-09-20T00:00:00.000Z",
      },
    ]);
    await db.sync_reconcile_obligations.bulkPut([
      {
        key: `${farmA}:factual`,
        fazenda_id: farmA,
        scope: "factual",
        tables: ["animais"],
        generation_id: "generation-a",
        created_at: "2026-09-20T00:00:00.000Z",
        updated_at: "2026-09-20T00:00:00.000Z",
      },
      {
        key: `${farmB}:factual`,
        fazenda_id: farmB,
        scope: "factual",
        tables: ["animais"],
        generation_id: "generation-b",
        created_at: "2026-09-20T00:00:00.000Z",
        updated_at: "2026-09-20T00:00:00.000Z",
      },
    ]);
    await db.local_ownership.put({
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: "user-farm-switch",
      updated_at: "2026-09-20T00:00:00.000Z",
    });
  });

  afterEach(async () => {
    await clearStores();
  });

  it("preserva pending A e B no ciclo A -> B -> A sem preservar cache descartavel", async () => {
    await pullDataForFarm(farmB, ["animais"], { mode: "replace" });

    expect(
      (await db.state_animais.toArray()).map((row) => row.id).sort(),
    ).toEqual(["animal-a-pending", "animal-b-pending", "animal-b-synced"]);
    expect(await db.queue_ops.get("op-a-pending")).toBeDefined();
    expect(await db.queue_ops.get("op-b-pending")).toBeDefined();

    await pullDataForFarm(farmA, ["animais"], { mode: "replace" });

    expect(
      (await db.state_animais.toArray()).map((row) => row.id).sort(),
    ).toEqual(["animal-a-pending", "animal-a-synced", "animal-b-pending"]);
    expect(await db.queue_ops.get("op-a-pending")).toMatchObject({
      client_tx_id: "tx-a-pending",
      sync_state: "PENDING",
      retry_count: 3,
      next_attempt_at: "2026-09-21T10:10:00.000Z",
      domain_op_id: "domain-op-a",
    });
    expect(await db.queue_ops.get("op-b-pending")).toMatchObject({
      client_tx_id: "tx-b-pending",
      sync_state: "RETRYABLE",
      retry_count: 2,
      next_attempt_at: "2026-09-21T10:05:00.000Z",
      domain_op_id: "domain-op-b",
    });
    expect(await db.queue_gestures.get("tx-a-pending")).toMatchObject({
      status: "PENDING",
      retry_count: 3,
    });
    expect(await db.queue_gestures.get("tx-b-pending")).toMatchObject({
      status: "PENDING",
      retry_count: 2,
    });

    expect(await db.sync_pull_cursors.count()).toBe(2);
    expect(await db.sync_reconcile_obligations.count()).toBe(2);
    expect(await db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).toMatchObject({
      owner_user_id: "user-farm-switch",
    });
  });

  it("merge de fazenda nao ativa nao limpa dados da fazenda ativa", async () => {
    await pullDataForFarm(farmA, ["animais"], { mode: "merge" });

    expect(
      (await db.state_animais.toArray()).map((row) => row.id).sort(),
    ).toEqual([
      "animal-a-pending",
      "animal-a-synced",
      "animal-b-pending",
      "animal-b-synced",
    ]);
  });
});
