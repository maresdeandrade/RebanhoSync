/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  DEFAULT_REMOTE_TABLES,
  pullSanitarioTechnicalCatalogV2,
  SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES,
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
    "catalog_sanitario_fontes_tecnicas_v2",
    "catalog_sanitario_fonte_cobertura_campos_v2",
    "catalog_sanitario_produtos_v2",
    "catalog_sanitario_produto_especie_autorizacao_v2",
    "catalog_sanitario_produto_fontes_v2",
    "catalog_sanitario_produto_dose_rules_v2",
    "catalog_sanitario_produto_carencia_rules_v2",
  ] as const,
}));

vi.mock("../db", () => ({
  db: {
    tables: localStores.map((name) => ({ name })),
    table: vi.fn(),
    transaction: vi.fn(),
  },
}));

type SourceScope = "global" | "fazenda";

const sourceRowsByScope: Record<SourceScope, unknown[]> = {
  global: [],
  fazenda: [],
};
const rowsByTable: Record<string, unknown[]> = {};
const queryLog: Array<{
  queryId: number;
  table: string;
  op: "eq" | "is" | "select";
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
    select: vi.fn((column: string) => {
      queryLog.push({
        queryId: currentQueryId,
        table,
        op: "select",
        column,
        value: null,
      });

      if (table !== "sanitario_fontes_tecnicas_v2") {
        return Promise.resolve({ data: rowsByTable[table] ?? [], error: null });
      }

      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      queryLog.push({
        queryId: currentQueryId,
        table,
        op: "eq",
        column,
        value,
      });
      filters.push({ column, value });

      if (column === "fazenda_id") {
        const scope = filters.find((filter) => filter.column === "scope")
          ?.value as SourceScope;
        return Promise.resolve({
          data: sourceRowsByScope[scope] ?? [],
          error: null,
        });
      }

      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      queryLog.push({
        queryId: currentQueryId,
        table,
        op: "is",
        column,
        value,
      });
      filters.push({ column, value });
      const scope = filters.find((filter) => filter.column === "scope")
        ?.value as SourceScope;
      return Promise.resolve({
        data: sourceRowsByScope[scope] ?? [],
        error: null,
      });
    }),
  };

  return query;
};

describe("pullSanitarioTechnicalCatalogV2", () => {
  const fazendaId = "fazenda-12e3";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    queryLog.length = 0;
    writeLog.length = 0;
    storesByName.clear();
    queryId = 0;

    sourceRowsByScope.global = [
      {
        id: "source-global",
        scope: "global",
        fazenda_id: null,
        kind: "bula",
        title: "Bula global",
        updated_at: "2026-06-12T10:00:00Z",
        deleted_at: "2026-06-12T11:00:00Z",
        metadata: { source: "official" },
        limitations: ["catalog-only"],
      },
    ];
    sourceRowsByScope.fazenda = [
      {
        id: "source-farm",
        scope: "fazenda",
        fazenda_id: fazendaId,
        kind: "mv_responsavel",
        title: "Fonte tecnica da fazenda",
        updated_at: "2026-06-12T12:00:00Z",
        deleted_at: null,
        metadata: { source: "farm" },
        limitations: ["requires-validation"],
      },
    ];
    rowsByTable.sanitario_fonte_cobertura_campos_v2 = [
      {
        id: "coverage-1",
        source_id: "source-global",
        field_key: "withdrawal",
        coverage_status: "covers",
        deleted_at: null,
        updated_at: "2026-06-12T12:30:00Z",
      },
    ];
    rowsByTable.sanitario_produtos_v2 = [
      {
        id: "product-1",
        nome_comercial: "Produto Tecnico X",
        classe: "vacina",
        tipo_produto: "vacinacao",
        status_curatorial: "precisa_validar",
        metadata: { catalogOnly: true },
        updated_at: "2026-06-12T13:00:00Z",
        deleted_at: null,
      },
    ];
    rowsByTable.sanitario_produto_especie_autorizacao_v2 = [
      {
        id: "auth-1",
        product_id: "product-1",
        species_code: "bovino",
        aptitude: "corte",
        authorization_status: "SIM_BULA",
        limitations: ["bubalino exige linha propria"],
        metadata: { explicitSpecies: true },
        updated_at: "2026-06-12T13:30:00Z",
        deleted_at: null,
      },
    ];
    rowsByTable.sanitario_produto_fontes_v2 = [
      {
        product_id: "product-1",
        source_id: "source-global",
        field_key: "withdrawal",
        created_at: "2026-06-12T14:00:00Z",
      },
    ];
    rowsByTable.sanitario_produto_dose_rules_v2 = [
      {
        id: "dose-1",
        product_id: "product-1",
        species_code: "bovino",
        aptitude: "corte",
        route: "subcutanea",
        dose_basis: "animal",
        updated_at: "2026-06-12T14:30:00Z",
        deleted_at: null,
      },
    ];
    rowsByTable.sanitario_produto_carencia_rules_v2 = [
      {
        id: "withdrawal-1",
        product_id: "product-1",
        species_code: "bovino",
        aptitude: "corte",
        applicability: "period",
        meat_days: 30,
        metadata: { source: "label" },
        limitations: ["carencia ativa depende de evento"],
        updated_at: "2026-06-12T15:00:00Z",
        deleted_at: "2026-06-12T16:00:00Z",
      },
    ];

    (supabase.from as unknown as Mock).mockImplementation((table: string) =>
      makeQuery(table),
    );
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

  it("pulls global and farm technical catalog rows into local catalog stores without push ops", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await pullSanitarioTechnicalCatalogV2(fazendaId);

    expect(supabase.from).toHaveBeenCalledTimes(8);
    const sourceQueryGroups = Object.values(
      queryLog
        .filter((entry) => entry.table === "sanitario_fontes_tecnicas_v2")
        .reduce<Record<number, typeof queryLog>>((groups, entry) => {
          groups[entry.queryId] = groups[entry.queryId] ?? [];
          groups[entry.queryId].push(entry);
          return groups;
        }, {}),
    );

    expect(sourceQueryGroups).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            column: "scope",
            value: "global",
          }),
          expect.objectContaining({
            op: "is",
            column: "fazenda_id",
            value: null,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            op: "eq",
            column: "scope",
            value: "fazenda",
          }),
          expect.objectContaining({
            op: "eq",
            column: "fazenda_id",
            value: fazendaId,
          }),
        ]),
      ]),
    );

    for (const table of SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES.filter(
      (table) => table !== "sanitario_fontes_tecnicas_v2",
    )) {
      expect(
        queryLog.some(
          (entry) =>
            entry.table === table &&
            entry.op !== "select" &&
            entry.column === "fazenda_id",
        ),
      ).toBe(false);
    }

    expect(db.transaction).toHaveBeenCalledWith(
      "rw",
      localStores,
      expect.any(Function),
    );
    expect(writeLog.map((entry) => entry.store)).toEqual(localStores);
    expect(writeLog[0].rows).toEqual([
      expect.objectContaining({
        id: "source-global",
        scope: "global",
        fazenda_id: null,
        deleted_at: "2026-06-12T11:00:00Z",
        updated_at: "2026-06-12T10:00:00Z",
        metadata: { source: "official" },
        limitations: ["catalog-only"],
      }),
      expect.objectContaining({
        id: "source-farm",
        scope: "fazenda",
        fazenda_id: fazendaId,
        metadata: { source: "farm" },
      }),
    ]);
    expect(writeLog[1].rows).toEqual([
      expect.objectContaining({
        id: "coverage-1",
        source_id: "source-global",
        field_key: "withdrawal",
      }),
    ]);
    expect(writeLog[2].rows).toEqual([
      expect.objectContaining({
        id: "product-1",
        metadata: { catalogOnly: true },
      }),
    ]);
    expect(writeLog[3].rows).toEqual([
      expect.objectContaining({
        id: "auth-1",
        product_id: "product-1",
        species_code: "bovino",
        aptitude: "corte",
      }),
    ]);
    expect(writeLog[4].rows).toEqual([
      expect.objectContaining({
        product_id: "product-1",
        source_id: "source-global",
        field_key: "withdrawal",
      }),
    ]);
    expect(writeLog[5].rows).toEqual([
      expect.objectContaining({
        id: "dose-1",
        product_id: "product-1",
        species_code: "bovino",
      }),
    ]);
    expect(writeLog[6].rows).toEqual([
      expect.objectContaining({
        id: "withdrawal-1",
        product_id: "product-1",
        species_code: "bovino",
        meat_days: 30,
        deleted_at: "2026-06-12T16:00:00Z",
      }),
    ]);

    expect(db.table).not.toHaveBeenCalledWith("queue_ops");
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const store of storesByName.values()) {
      expect(store.clear).not.toHaveBeenCalled();
    }
  });

  it("keeps technical catalog v2 out of the generic tenant pull list", () => {
    for (const table of SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES) {
      expect(DEFAULT_REMOTE_TABLES).not.toContain(table);
    }
  });
});
