/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { OfflineDB } from "../db";

describe("v34 withdrawal provenance is additive and pull-only", () => {
  it("preserves v33 records, pending operations and old-client reopen without inventing links", async () => {
    const name = `P38-provenance-${crypto.randomUUID()}`;
    const current = new OfflineDB(name);
    const addedStores = ["catalog_sanitario_produto_carencia_fontes_v2", "ops_sanitario_participacoes",
      "ops_sanitario_participacao_operacoes", "ops_sanitario_agenda_resultados",
      "ops_sanitario_continuidade_solicitacoes", "local_sanitario_participacoes"];
    const stores = Object.fromEntries(current.tables.filter(t => !addedStores.includes(t.name))
      .map(t => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map(i => i.src)].join(",")]));
    const old = new Dexie(name);
    old.version(33).stores(stores);
    try {
      await old.open();
      expect(old.verno).toBe(33);
      expect(old.tables.map(table => table.name).sort()).toEqual(Object.keys(stores).sort());
      const pending = { client_op_id: "pending", client_tx_id: "tx", table: "animais", action: "UPDATE", record: { id: "animal", fazenda_id: "farm-A" }, sync_state: "PENDING" };
      await old.table("queue_ops").put(pending);
      await old.table("catalog_sanitario_produto_carencia_rules_v2").put({ id: "old-rule", product_id: "product", deleted_at: null });
      old.close();
      await current.open();
      expect(current.verno).toBe(35);
      expect(current.tables.map(table => table.name).sort()).toEqual([...Object.keys(stores), ...addedStores].sort());
      for (const table of addedStores) expect(await current.table(table).count()).toBe(0);
      expect(await current.queue_ops.toArray()).toEqual([pending]);
      expect(await current.catalog_sanitario_produto_carencia_rules_v2.get("old-rule")).toMatchObject({ product_id: "product" });
      expect(await current.catalog_sanitario_produto_carencia_fontes_v2.count()).toBe(0);
      const link = { withdrawal_rule_id: "old-rule", source_id: "source", field_key: "withdrawal", created_at: "2026-10-29" };
      await current.catalog_sanitario_produto_carencia_fontes_v2.put(link);
      current.close();
      await old.open();
      expect(await old.table("queue_ops").toArray()).toEqual([pending]);
      expect(await old.table("catalog_sanitario_produto_carencia_rules_v2").get("old-rule")).toMatchObject({ product_id: "product" });
      old.close();
      await current.open();
      expect(await current.queue_ops.toArray()).toEqual([pending]);
      expect(await current.catalog_sanitario_produto_carencia_fontes_v2.toArray()).toEqual([link]);
    } finally {
      old.close(); current.close(); await Dexie.delete(name);
    }
  });
});
