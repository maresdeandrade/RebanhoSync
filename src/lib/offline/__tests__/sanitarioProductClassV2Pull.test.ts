/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  DEFAULT_REMOTE_TABLES,
  pullSanitarioProductClassV2Catalog,
  SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES,
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
  "catalog_sanitario_product_classes_v2",
  "catalog_sanitario_product_class_groups_v2",
  "catalog_sanitario_product_class_group_members_v2",
  "catalog_sanitario_product_class_default_rules_v2",
] as const,
}));

vi.mock("../db", () => ({
  db: {
    tables: localStores.map((name) => ({ name })),
    table: vi.fn(),
    transaction: vi.fn(),
  },
}));

type ScopeKey = "global" | "tenant";

const rowsByTable: Record<string, Record<ScopeKey, unknown[]>> = {};
const queryLog: Array<{
  queryId: number;
  table: string;
  op: "eq" | "is";
  column: string;
  value: unknown;
}> = [];
const writeLog: Array<{ store: string; rows: unknown[] }> = [];
const storesByName = new Map<string, { clear: Mock; bulkPut: Mock }>();
let queryId = 0;

const makeQuery = (table: string) => {
  const currentQueryId = ++queryId;
  const filters: Array<{ column: string; value: unknown }> = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      queryLog.push({ queryId: currentQueryId, table, op: "eq", column, value });
      filters.push({ column, value });

      if (column === "fazenda_id") {
        const scope = filters.find((filter) => filter.column === "scope")?.value as ScopeKey;
        return Promise.resolve({ data: rowsByTable[table]?.[scope] ?? [], error: null });
      }

      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      queryLog.push({ queryId: currentQueryId, table, op: "is", column, value });
      filters.push({ column, value });
      const scope = filters.find((filter) => filter.column === "scope")?.value as ScopeKey;
      return Promise.resolve({ data: rowsByTable[table]?.[scope] ?? [], error: null });
    }),
  };

  return query;
};

describe("pullSanitarioProductClassV2Catalog", () => {
  const fazendaId = "fazenda-tenant-1";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    queryLog.length = 0;
    writeLog.length = 0;
    storesByName.clear();
    queryId = 0;

    for (const table of SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES) {
      rowsByTable[table] = { global: [], tenant: [] };
    }

    rowsByTable.sanitario_product_classes_v2 = {
      global: [
        {
          id: "class-global",
          scope: "global",
          fazenda_id: null,
          class_key: "vaccine",
          updated_at: "2026-06-01T00:00:00Z",
          deleted_at: "2026-06-02T00:00:00Z",
          metadata: { source: "official" },
          limitations: ["read-only"],
        },
      ],
      tenant: [
        {
          id: "class-tenant",
          scope: "tenant",
          fazenda_id: fazendaId,
          class_key: "tenant-vaccine",
          updated_at: "2026-06-03T00:00:00Z",
          deleted_at: null,
          metadata: { source: "tenant" },
          limitations: ["local-cache"],
        },
      ],
    };
    rowsByTable.sanitario_product_class_groups_v2 = {
      global: [{ id: "group-global", scope: "global", fazenda_id: null, group_key: "immunization" }],
      tenant: [{ id: "group-tenant", scope: "tenant", fazenda_id: fazendaId, group_key: "farm-group" }],
    };
    rowsByTable.sanitario_product_class_group_members_v2 = {
      global: [
        {
          id: "member-global",
          scope: "global",
          fazenda_id: null,
          group_id: "group-global",
          class_id: "class-global",
        },
      ],
      tenant: [],
    };
    rowsByTable.sanitario_product_class_default_rules_v2 = {
      global: [
        {
          id: "rule-global",
          scope: "global",
          fazenda_id: null,
          class_id: "class-global",
          species_code: "bovine",
          aptitude: "corte",
        },
      ],
      tenant: [],
    };

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
      };
      storesByName.set(storeName, store);
      return store;
    });
  });

  it("pulls global and tenant ProductClass v2 into catalog stores without queueing push ops", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await pullSanitarioProductClassV2Catalog(fazendaId);

    expect(supabase.from).toHaveBeenCalledTimes(8);
    for (const table of SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES) {
      const queryGroups = Object.values(
        queryLog
          .filter((entry) => entry.table === table)
          .reduce<Record<number, typeof queryLog>>((groups, entry) => {
            groups[entry.queryId] = groups[entry.queryId] ?? [];
            groups[entry.queryId].push(entry);
            return groups;
          }, {}),
      );

      expect(queryGroups).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ op: "eq", column: "scope", value: "global" }),
            expect.objectContaining({ op: "is", column: "fazenda_id", value: null }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ op: "eq", column: "scope", value: "tenant" }),
            expect.objectContaining({ op: "eq", column: "fazenda_id", value: fazendaId }),
          ]),
        ]),
      );
    }

    expect(db.transaction).toHaveBeenCalledWith("rw", localStores, expect.any(Function));
    expect(writeLog.map((entry) => entry.store)).toEqual(localStores);
    expect(writeLog[0].rows).toEqual([
      expect.objectContaining({
        id: "class-global",
        scope: "global",
        fazenda_id: null,
        updated_at: "2026-06-01T00:00:00Z",
        deleted_at: "2026-06-02T00:00:00Z",
        metadata: { source: "official" },
        limitations: ["read-only"],
      }),
      expect.objectContaining({
        id: "class-tenant",
        scope: "tenant",
        fazenda_id: fazendaId,
        updated_at: "2026-06-03T00:00:00Z",
        deleted_at: null,
        metadata: { source: "tenant" },
        limitations: ["local-cache"],
      }),
    ]);
    expect(writeLog[2].rows).toEqual([
      expect.objectContaining({ id: "member-global", group_id: "group-global", class_id: "class-global" }),
    ]);
    expect(writeLog[3].rows).toEqual([
      expect.objectContaining({ id: "rule-global", class_id: "class-global" }),
    ]);

    expect(db.table).not.toHaveBeenCalledWith("queue_ops");
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const store of storesByName.values()) {
      expect(store.clear).not.toHaveBeenCalled();
    }
  });

  it("keeps ProductClass v2 out of the generic tenant pull list", () => {
    expect(DEFAULT_REMOTE_TABLES).not.toEqual(
      expect.arrayContaining([...SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES]),
    );
  });
});
