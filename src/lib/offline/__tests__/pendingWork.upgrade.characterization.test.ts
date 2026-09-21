/**
 * @vitest-environment jsdom
 *
 * F24.3A — upgrade Dexie com trabalho pendente.
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { LOCAL_OWNERSHIP_KEY, OfflineDB } from "../db";

const databaseNames = new Set<string>();

async function openLegacyDatabase(
  version: number,
  stores: Record<string, string>,
) {
  const name = `RebanhoSync-F24-3A-${version}-${crypto.randomUUID()}`;
  databaseNames.add(name);
  const legacy = new Dexie(name);
  legacy.version(version).stores(stores);
  await legacy.open();
  return { legacy, name };
}

afterEach(async () => {
  for (const name of databaseNames) await Dexie.delete(name);
  databaseNames.clear();
});

describe("F24.3A — upgrade with pending work characterization", () => {
  it("preserva PENDING, ERROR recuperavel e SYNCING com as identidades desde v1 ate v31", async () => {
    const { legacy, name } = await openLegacyDatabase(1, {
      queue_gestures: "client_tx_id, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections: "++id, client_tx_id, fazenda_id",
    });

    await legacy.table("queue_gestures").bulkPut([
      {
        client_tx_id: "tx-upgrade-pending",
        fazenda_id: "farm-upgrade",
        client_id: "client-upgrade",
        status: "PENDING",
        retry_count: 2,
        created_at: "2026-09-21T08:00:00.000Z",
      },
      {
        client_tx_id: "tx-upgrade-error",
        fazenda_id: "farm-upgrade",
        client_id: "client-upgrade",
        status: "ERROR",
        sync_result: "ERROR",
        retry_count: 3,
        last_error: "HTTP 503 - offline prolongado",
        created_at: "2026-09-21T08:01:00.000Z",
      },
      {
        client_tx_id: "tx-upgrade-syncing",
        fazenda_id: "farm-upgrade",
        client_id: "client-upgrade",
        status: "SYNCING",
        retry_count: 1,
        created_at: "2026-09-21T08:02:00.000Z",
      },
    ]);
    await legacy.table("queue_ops").bulkPut([
      {
        client_op_id: "op-upgrade-pending",
        client_tx_id: "tx-upgrade-pending",
        fazenda_id: "farm-upgrade",
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-upgrade-pending", fazenda_id: "farm-upgrade" },
        created_at: "2026-09-21T08:00:00.000Z",
      },
      {
        client_op_id: "op-upgrade-error",
        client_tx_id: "tx-upgrade-error",
        fazenda_id: "farm-upgrade",
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-upgrade-error", fazenda_id: "farm-upgrade" },
        created_at: "2026-09-21T08:01:00.000Z",
      },
      {
        client_op_id: "op-upgrade-syncing",
        client_tx_id: "tx-upgrade-syncing",
        fazenda_id: "farm-upgrade",
        table: "eventos",
        action: "INSERT",
        record: { id: "evento-upgrade-syncing", fazenda_id: "farm-upgrade" },
        created_at: "2026-09-21T08:02:00.000Z",
      },
    ]);
    legacy.close();

    const upgraded = new OfflineDB(name);
    await upgraded.open();

    expect(await upgraded.queue_gestures.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          client_tx_id: "tx-upgrade-pending",
          status: "PENDING",
          retry_count: 2,
        }),
        expect.objectContaining({
          client_tx_id: "tx-upgrade-error",
          status: "ERROR",
          retry_count: 3,
        }),
        expect.objectContaining({
          client_tx_id: "tx-upgrade-syncing",
          status: "SYNCING",
          retry_count: 1,
        }),
      ]),
    );
    expect(
      (await upgraded.queue_ops.toArray()).map(
        (operation) => operation.client_op_id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "op-upgrade-pending",
        "op-upgrade-error",
        "op-upgrade-syncing",
      ]),
    );
    expect(
      await upgraded.local_ownership.get(LOCAL_OWNERSHIP_KEY),
    ).toMatchObject({
      owner_user_id: null,
    });
    expect(await upgraded.sync_reconcile_obligations.count()).toBe(0);

    upgraded.close();
  });

  it("preserva obligation e fila no upgrade v30 para v31", async () => {
    const { legacy, name } = await openLegacyDatabase(30, {
      queue_gestures: "client_tx_id, status, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      sync_reconcile_obligations:
        "key, fazenda_id, scope, generation_id, updated_at, [fazenda_id+scope]",
    });

    await legacy.table("queue_gestures").put({
      client_tx_id: "tx-v30",
      fazenda_id: "farm-v30",
      client_id: "client-v30",
      status: "PENDING",
      retry_count: 1,
      created_at: "2026-09-21T09:00:00.000Z",
    });
    await legacy.table("queue_ops").put({
      client_op_id: "op-v30",
      client_tx_id: "tx-v30",
      fazenda_id: "farm-v30",
      table: "animais",
      action: "UPDATE",
      record: { id: "animal-v30", fazenda_id: "farm-v30" },
      created_at: "2026-09-21T09:00:00.000Z",
    });
    await legacy.table("sync_reconcile_obligations").put({
      key: "farm-v30:factual",
      fazenda_id: "farm-v30",
      scope: "factual",
      tables: ["animais"],
      generation_id: "generation-v30",
      created_at: "2026-09-21T09:00:00.000Z",
      updated_at: "2026-09-21T09:00:00.000Z",
    });
    legacy.close();

    const upgraded = new OfflineDB(name);
    await upgraded.open();

    expect(await upgraded.queue_gestures.get("tx-v30")).toMatchObject({
      status: "PENDING",
      retry_count: 1,
    });
    expect(await upgraded.queue_ops.get("op-v30")).toMatchObject({
      client_tx_id: "tx-v30",
    });
    expect(
      await upgraded.sync_reconcile_obligations.get("farm-v30:factual"),
    ).toMatchObject({
      generation_id: "generation-v30",
      tables: ["animais"],
    });
    expect(
      await upgraded.local_ownership.get(LOCAL_OWNERSHIP_KEY),
    ).toMatchObject({
      owner_user_id: null,
    });

    upgraded.close();
  });
});
