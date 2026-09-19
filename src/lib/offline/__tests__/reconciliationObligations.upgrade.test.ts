/**
 * @vitest-environment jsdom
 *
 * F24.2C3B — Dexie upgrade v29 -> v30 (sync_reconcile_obligations).
 * Proves: previous store data preserved, new store available, no destructive change.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import Dexie from "dexie";

describe("Dexie upgrade v29 -> v30", () => {
  it("preserves existing data and exposes the new obligations store", async () => {
    const legacy = new Dexie("RebanhoSync");
    legacy.version(1).stores({ state_finance_transactions: "id" });
    legacy.version(29).stores({
      state_finance_transactions:
        "id, fazenda_id, category_id, status, direction, occurred_at, source_event_id, reverses_transaction_id, deleted_at, [fazenda_id+status], [fazenda_id+category_id]",
    });
    await legacy.open();
    await legacy.table("state_finance_transactions").bulkPut([
      { id: "tx-upgrade-1", fazenda_id: "farm-upgrade" },
      { id: "tx-upgrade-2", fazenda_id: "farm-upgrade" },
    ]);
    legacy.close();

    const { db } = await import("../db");

    expect(db.tables.map((table) => table.name)).toContain(
      "sync_reconcile_obligations",
    );
    expect(db.tables.map((table) => table.name)).toContain(
      "state_finance_transactions",
    );
    expect(await db.state_finance_transactions.count()).toBe(2);
    expect(
      await db.state_finance_transactions.get("tx-upgrade-1"),
    ).toMatchObject({ fazenda_id: "farm-upgrade" });
    expect(await db.sync_reconcile_obligations.count()).toBe(0);

    await db.sync_reconcile_obligations.put({
      key: "farm-upgrade:factual",
      fazenda_id: "farm-upgrade",
      scope: "factual",
      tables: ["eventos"],
      generation_id: "gen-upgrade",
      created_at: "2026-09-18T00:00:00.000Z",
      updated_at: "2026-09-18T00:00:00.000Z",
    });
    expect(
      await db.sync_reconcile_obligations.get("farm-upgrade:factual"),
    ).toMatchObject({ scope: "factual" });

    db.close();
  });
});
