/**
 * @vitest-environment jsdom
 *
 * F24.3A — caracterizacao do replace A -> B -> A.
 *
 * Este teste registra o comportamento atual. Ele nao prescreve a correcao:
 * caches sincronizados de outra fazenda sao descartados e o trabalho pendente
 * continua na fila, mas a linha otimista da fazenda nao ativa nao sobrevive ao
 * clear global da store.
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
    db.queue_ops.clear(),
    db.sync_pull_cursors.clear(),
    db.sync_reconcile_obligations.clear(),
    db.local_ownership.clear(),
  ]);
}

describe("F24.3A — farm switch replace characterization", () => {
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
        created_at: "2026-09-21T10:00:00.000Z",
      },
      {
        client_op_id: "op-b-pending",
        client_tx_id: "tx-b-pending",
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-b-pending", fazenda_id: farmB },
        sync_state: "PENDING",
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

  it("mantem filas e metadados, mas perde a linha otimista pendente da fazenda nao ativa", async () => {
    await pullDataForFarm(farmB, ["animais"], { mode: "replace" });

    expect(
      (await db.state_animais.toArray()).map((row) => row.id).sort(),
    ).toEqual(["animal-b-pending", "animal-b-synced"]);
    expect(await db.queue_ops.get("op-a-pending")).toBeDefined();
    expect(await db.queue_ops.get("op-b-pending")).toBeDefined();

    await pullDataForFarm(farmA, ["animais"], { mode: "replace" });

    expect(
      (await db.state_animais.toArray()).map((row) => row.id).sort(),
    ).toEqual(["animal-a-synced"]);
    expect(await db.state_animais.get("animal-a-pending")).toBeUndefined();
    expect(await db.queue_ops.get("op-a-pending")).toMatchObject({
      client_tx_id: "tx-a-pending",
      sync_state: "PENDING",
    });
    expect(await db.queue_ops.get("op-b-pending")).toMatchObject({
      client_tx_id: "tx-b-pending",
      sync_state: "PENDING",
    });

    expect(await db.sync_pull_cursors.count()).toBe(2);
    expect(await db.sync_reconcile_obligations.count()).toBe(2);
    expect(await db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).toMatchObject({
      owner_user_id: "user-farm-switch",
    });
  });
});
