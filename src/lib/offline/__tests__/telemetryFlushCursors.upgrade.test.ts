/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { LOCAL_OWNERSHIP_KEY, OfflineDB } from "../db";

describe("F24.5E1 — additive v32 to v33 telemetry checkpoint", () => {
  it.each(["original-owner", null])("preserves all functional records and owner %s without fabricating ACK", async owner => {
    const name = `RebanhoSync-F24-5E1-${crypto.randomUUID()}`;
    const upgraded = new OfflineDB(name);
    // Full product schema; v33 adds only the new store, excluded from v32 fixture.
    const stores = Object.fromEntries(upgraded.tables
      .filter(table => table.name !== "telemetry_flush_cursors")
      .map(table => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(", ")]));
    const legacy = new Dexie(name);
    legacy.version(32).stores(stores);
    const time = "2026-10-07T10:00:00.000Z";
    const failure = { code: "RETRY_EXHAUSTED", cause_code: "NETWORK_FAILURE", observed_at: time, retry_count: 3 };
    const fixtures: Record<string, object[]> = {
      queue_gestures: [
        { client_tx_id: "pending-tx", fazenda_id: "farm-A", status: "PENDING", retry_count: 2, next_attempt_at: time, created_at: time, diagnostics: { client_op_ids: ["pending-op"] } },
        { client_tx_id: "error-tx", fazenda_id: "farm-B", status: "ERROR", retry_count: 3, created_at: time, diagnostics: { last_failure: failure } },
      ],
      queue_ops: [{ client_op_id: "pending-op", client_tx_id: "pending-tx", fazenda_id: "farm-A", table: "lotes", action: "INSERT", record: { id: "lot", fazenda_id: "farm-A" } }],
      queue_rejections: [{ id: 1, client_tx_id: "error-tx", fazenda_id: "farm-B", reason_code: "HTTP_403" }],
      sync_reconcile_obligations: [{ key: "farm-A:factual", fazenda_id: "farm-A", scope: "factual", generation_id: "original-generation", created_at: time, updated_at: time, diagnostics: { origins: [{ client_tx_id: "pending-tx", client_op_ids: ["pending-op"] }], last_error: { code: "NETWORK_FAILURE", message: "Falha de rede." } } }],
      metrics_events: [{ id: "original-metric", fazenda_id: "farm-A", event_name: "sync_error", created_at: time, payload: {} }],
      local_ownership: [{ key: LOCAL_OWNERSHIP_KEY, owner_user_id: owner, updated_at: time }],
      sync_pull_cursors: [{ key: "farm-A:animais", fazenda_id: "farm-A", table_name: "animais", updated_at: time }],
      state_lotes: [{ id: "lot", fazenda_id: "farm-A", nome: "pending local state" }],
    };
    const legacyKey = "rebanhosync:telemetry-flush:farm-A";
    const legacyCursor = JSON.stringify({ createdAt: time, idsAtCursor: ["original-metric"] });
    localStorage.setItem(legacyKey, legacyCursor);
    try {
      await legacy.open();
      expect(legacy.verno).toBe(32);
      for (const [table, rows] of Object.entries(fixtures)) await legacy.table(table).bulkPut(rows);
      const snapshots = Object.fromEntries(await Promise.all(Object.keys(fixtures).map(async table => [table, await legacy.table(table).toArray()])));
      legacy.close();
      await upgraded.open();
      expect(upgraded.verno).toBe(33);
      expect(upgraded.tables.map(table => table.name).sort()).toEqual([...Object.keys(stores), "telemetry_flush_cursors"].sort());
      for (const [table, rows] of Object.entries(snapshots)) expect(await upgraded.table(table).toArray()).toEqual(rows);
      expect(await upgraded.telemetry_flush_cursors.count()).toBe(0);
      expect(localStorage.getItem(legacyKey)).toBe(legacyCursor);
      // Schema upgrade is additive and separate from authenticated, lazy legacy import.
      const checkpoint = { fazenda_id: "farm-A", created_at: time, ids_at_cursor: ["fixture-confirmed"], updated_at: time };
      await upgraded.telemetry_flush_cursors.put(checkpoint);
      upgraded.close();
      // Installed Dexie 4.3 tolerates reopening a higher-version additive schema.
      // This characterizes this library, not an invented downgrade mechanism.
      await legacy.open();
      expect(await legacy.table("queue_gestures").toArray()).toEqual(snapshots.queue_gestures);
      legacy.close();
      await upgraded.open();
      expect(await upgraded.telemetry_flush_cursors.get("farm-A")).toEqual(checkpoint);
    } finally {
      legacy.close();
      upgraded.close();
      await Dexie.delete(name);
      localStorage.removeItem(legacyKey);
    }
  });
});
