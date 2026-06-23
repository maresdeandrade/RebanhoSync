/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  DEFAULT_REMOTE_TABLES,
  pullSanitarioProtocolCatalogV2,
  SANITARIO_PROTOCOL_CATALOG_V2_REMOTE_TABLES,
} from "../pull";
import { supabase } from "@/lib/supabase";
import { db } from "../db";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const { localStores } = vi.hoisted(() => ({
  localStores: [
    "catalog_sanitario_protocolos_v2",
    "catalog_sanitario_protocolo_itens_versions_v2",
    "catalog_sanitario_product_class_groups_v2",
  ] as const,
}));

vi.mock("../db", () => ({
  db: {
    tables: localStores.map((name) => ({ name })),
    table: vi.fn(),
    transaction: vi.fn(),
  },
}));

const rowsByTable: Record<string, unknown[]> = {};
const queryLog: Array<{
  queryId: number;
  table: string;
  op: "eq" | "is" | "in" | "select";
  column: string;
  value: unknown;
}> = [];
const writeLog: Array<{ store: string; rows: unknown[] }> = [];
const storesByName = new Map<string, { bulkPut: Mock; clear: Mock; toArray: Mock }>();
let queryId = 0;

function makeQuery(table: string) {
  const currentQueryId = ++queryId;
  const filters: Array<{ op: "eq" | "is" | "in"; column: string; value: unknown }> = [];
  const query = {
    select: vi.fn((column: string) => {
      queryLog.push({ queryId: currentQueryId, table, op: "select", column, value: null });
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "eq", column, value });
      queryLog.push({ queryId: currentQueryId, table, op: "eq", column, value });
      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "is", column, value });
      queryLog.push({ queryId: currentQueryId, table, op: "is", column, value });
      return query;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      filters.push({ op: "in", column, value });
      queryLog.push({ queryId: currentQueryId, table, op: "in", column, value });
      return query;
    }),
    then: (
      resolve: (value: { data: unknown[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: filterRows(table, filters), error: null }).then(resolve, reject),
  };

  return query;
}

function filterRows(
  table: string,
  filters: Array<{ op: "eq" | "is" | "in"; column: string; value: unknown }>,
) {
  return (rowsByTable[table] ?? []).filter((row) => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return filters.every((filter) => {
      if (filter.op === "eq" || filter.op === "is") {
        return record[filter.column] === filter.value;
      }
      return Array.isArray(filter.value) && filter.value.includes(record[filter.column]);
    });
  });
}

describe("pullSanitarioProtocolCatalogV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    queryLog.length = 0;
    writeLog.length = 0;
    storesByName.clear();
    queryId = 0;

    rowsByTable.sanitario_protocolos_v2 = Array.from({ length: 10 }, (_, index) => ({
      id: `protocol-${index}`,
      family_code: index === 0 ? "brucelose_b19" : `protocol_${index}`,
      scope: "global",
      fazenda_id: null,
      status: index === 1 ? "retired" : "draft",
      approval_status: "draft",
      updated_at: `2026-06-15T10:${String(index).padStart(2, "0")}:00.000Z`,
      deleted_at: index === 9 ? "2026-06-15T11:00:00.000Z" : null,
      metadata: { agenda_allowed: false, approved_for_catalog: false },
    }));
    rowsByTable.sanitario_protocolo_itens_versions_v2 = Array.from(
      { length: 20 },
      (_, index) => ({
        id: `item-${index}`,
        protocol_id: `protocol-${index % 10}`,
        logical_item_key:
          index === 0 ? "b19_femeas_3_8_meses" : `logical_item_${index}`,
        version: 1,
        product_requirement_kind: index >= 3 && index <= 8 ? "product_class_group" : "none",
        product_class_group_id: index >= 3 && index <= 8 ? "group-0" : null,
        allows_agenda_auto: false,
        updated_at: `2026-06-15T12:${String(index).padStart(2, "0")}:00.000Z`,
        deleted_at: index === 19 ? "2026-06-15T13:00:00.000Z" : null,
      }),
    );
    rowsByTable.sanitario_product_class_groups_v2 = Array.from(
      { length: 4 },
      (_, index) => ({
        id: `group-${index}`,
        group_key: `pcg_${index}`,
        scope: "global",
        fazenda_id: null,
        curation_status: "needs_review",
        automation_status: "blocked",
        updated_at: `2026-06-15T14:${String(index).padStart(2, "0")}:00.000Z`,
        deleted_at: null,
        metadata: { agenda_allowed: false, approved_for_catalog: false },
      }),
    );

    (supabase.from as unknown as Mock).mockImplementation((table: string) => makeQuery(table));
    (db.transaction as unknown as Mock).mockImplementation(
      async (_mode: string, _stores: string[], callback: () => Promise<void>) => {
        await callback();
      },
    );
    (db.table as unknown as Mock).mockImplementation((storeName: string) => {
      const store = {
        clear: vi.fn(),
        bulkPut: vi.fn((rows: unknown[]) => {
          writeLog.push({ store: storeName, rows });
          return Promise.resolve();
        }),
        toArray: vi.fn(() => Promise.resolve([])),
      };
      storesByName.set(storeName, store);
      return store;
    });
  });

  it("baixa protocolos, itens e grupos globais para stores locais sem push ou queue_ops", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await pullSanitarioProtocolCatalogV2();
    await pullSanitarioProtocolCatalogV2();

    expect(supabase.from).toHaveBeenCalledTimes(6);
    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_protocolos_v2",
          op: "eq",
          column: "scope",
          value: "global",
        }),
        expect.objectContaining({
          table: "sanitario_protocolos_v2",
          op: "is",
          column: "fazenda_id",
          value: null,
        }),
        expect.objectContaining({
          table: "sanitario_protocolo_itens_versions_v2",
          op: "in",
          column: "protocol_id",
        }),
        expect.objectContaining({
          table: "sanitario_product_class_groups_v2",
          op: "eq",
          column: "scope",
          value: "global",
        }),
        expect.objectContaining({
          table: "sanitario_product_class_groups_v2",
          op: "is",
          column: "fazenda_id",
          value: null,
        }),
      ]),
    );
    expect(db.transaction).toHaveBeenCalledWith("rw", localStores, expect.any(Function));
    expect(writeLog.filter((entry) => entry.store === localStores[0])[0].rows)
      .toHaveLength(10);
    expect(writeLog.filter((entry) => entry.store === localStores[1])[0].rows)
      .toHaveLength(20);
    expect(writeLog.filter((entry) => entry.store === localStores[2])[0].rows)
      .toHaveLength(4);
    expect(writeLog[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "protocol-9",
          deleted_at: "2026-06-15T11:00:00.000Z",
        }),
      ]),
    );
    expect(writeLog[1].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "item-19",
          deleted_at: "2026-06-15T13:00:00.000Z",
        }),
      ]),
    );

    expect(db.table).not.toHaveBeenCalledWith("queue_ops");
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const store of storesByName.values()) {
      expect(store.clear).not.toHaveBeenCalled();
    }
  });

  it("mantem catalogo de protocolos fora do pull generico tenant-scoped", () => {
    for (const table of SANITARIO_PROTOCOL_CATALOG_V2_REMOTE_TABLES) {
      expect(DEFAULT_REMOTE_TABLES).not.toContain(table);
    }
  });
});
