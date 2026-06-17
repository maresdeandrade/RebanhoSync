/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { db } from "../db";
import {
  pullSanitarioAgendaV2,
  pullSanitarioProductClassV2Catalog,
  pullSanitarioProtocolCatalogV2,
  pullSanitarioTechnicalCatalogV2,
} from "../pull";

type FilterOp = "eq" | "is" | "gte" | "in";

const remoteRows: Record<string, Array<Record<string, unknown>>> = {};
const queryLog: Array<{
  table: string;
  op: FilterOp | "select";
  column: string;
  value: unknown;
}> = [];
const resultLog: Array<{ table: string; count: number }> = [];

function makeQuery(table: string) {
  const filters: Array<{ op: FilterOp; column: string; value: unknown }> = [];
  const query = {
    select: vi.fn((column = "*") => {
      queryLog.push({ table, op: "select", column, value: null });
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "eq", column, value });
      queryLog.push({ table, op: "eq", column, value });
      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "is", column, value });
      queryLog.push({ table, op: "is", column, value });
      return query;
    }),
    gte: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "gte", column, value });
      queryLog.push({ table, op: "gte", column, value });
      return query;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      filters.push({ op: "in", column, value });
      queryLog.push({ table, op: "in", column, value });
      return query;
    }),
    then: (
      resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      return Promise.resolve({ data: filterRows(table, filters), error: null })
        .then(resolve, reject);
    },
  };

  return query;
}

function filterRows(table: string, filters: Array<{ op: FilterOp; column: string; value: unknown }>) {
  const rows = remoteRows[table] ?? [];
  const result = rows.filter((row) =>
    filters.every((filter) => {
      if (filter.op === "eq") return row[filter.column] === filter.value;
      if (filter.op === "is") return row[filter.column] === filter.value;
      if (filter.op === "gte") {
        const value = row[filter.column];
        return typeof value === "string" && value >= String(filter.value);
      }
      if (filter.op === "in") {
        return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
      }
      return true;
    }),
  );
  resultLog.push({ table, count: result.length });
  return result;
}

describe("sanitario v2 incremental pull cursors", () => {
  const fazendaId = "farm-cursor-12e5";

  beforeEach(async () => {
    vi.clearAllMocks();
    queryLog.length = 0;
    resultLog.length = 0;
    for (const key of Object.keys(remoteRows)) delete remoteRows[key];

    await Promise.all([
      db.sync_pull_cursors.clear(),
      db.catalog_sanitario_product_classes_v2.clear(),
      db.catalog_sanitario_product_class_groups_v2.clear(),
      db.catalog_sanitario_product_class_group_members_v2.clear(),
      db.catalog_sanitario_product_class_default_rules_v2.clear(),
      db.catalog_sanitario_fontes_tecnicas_v2.clear(),
      db.catalog_sanitario_fonte_cobertura_campos_v2.clear(),
      db.catalog_sanitario_produtos_v2.clear(),
      db.catalog_sanitario_produto_especie_autorizacao_v2.clear(),
      db.catalog_sanitario_produto_fontes_v2.clear(),
      db.catalog_sanitario_produto_dose_rules_v2.clear(),
      db.catalog_sanitario_produto_carencia_rules_v2.clear(),
      db.catalog_sanitario_protocolos_v2.clear(),
      db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.ops_sanitario_agenda_closures_v2.clear(),
    ]);

    vi.mocked(supabase.from).mockImplementation((table: string) => makeQuery(table) as never);
  });

  afterEach(async () => {
    await db.sync_pull_cursors.clear();
  });

  it("faz full fetch inicial, salva cursor por tabela e depois usa updated_at incremental na Agenda v2", async () => {
    remoteRows.sanitario_agenda_v2 = [
      {
        id: "agenda-old",
        fazenda_id: fazendaId,
        status: "programada",
        updated_at: "2026-06-13T10:00:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_agenda_animais_v2 = [
      {
        agenda_id: "agenda-old",
        animal_id: "animal-1",
        fazenda_id: fazendaId,
        planned_status: "planejado",
        updated_at: "2026-06-13T10:01:00.000Z",
      },
    ];
    remoteRows.sanitario_agenda_closures_v2 = [
      {
        id: "closure-old",
        fazenda_id: fazendaId,
        agenda_id: "agenda-old",
        closure_type: "cancelled",
        execution_evento_id: null,
        updated_at: "2026-06-13T10:02:00.000Z",
        deleted_at: null,
      },
    ];

    await pullSanitarioAgendaV2(fazendaId);

    expect(queryLog.some((entry) => entry.op === "gte")).toBe(false);
    expect(await db.sync_pull_cursors.count()).toBe(3);
    expect(await db.ops_sanitario_agenda_v2.get("agenda-old")).toMatchObject({
      updated_at: "2026-06-13T10:00:00.000Z",
      deleted_at: null,
    });

    remoteRows.sanitario_agenda_v2.push({
      id: "agenda-deleted",
      fazenda_id: fazendaId,
      status: "cancelada",
      updated_at: "2026-06-13T11:00:00.000Z",
      deleted_at: "2026-06-13T11:05:00.000Z",
    });
    queryLog.length = 0;
    resultLog.length = 0;

    await pullSanitarioAgendaV2(fazendaId);

    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_agenda_v2",
          op: "eq",
          column: "fazenda_id",
          value: fazendaId,
        }),
        expect.objectContaining({
          table: "sanitario_agenda_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-13T10:00:00.000Z",
        }),
      ]),
    );
    expect(resultLog.find((entry) => entry.table === "sanitario_agenda_v2")?.count).toBe(2);
    expect(await db.ops_sanitario_agenda_v2.get("agenda-deleted")).toMatchObject({
      deleted_at: "2026-06-13T11:05:00.000Z",
      updated_at: "2026-06-13T11:00:00.000Z",
    });
    expect(await db.sync_pull_cursors.get("sanitario_agenda_v2:fazenda:farm-cursor-12e5"))
      .toMatchObject({
        remote_table: "sanitario_agenda_v2",
        local_store: "ops_sanitario_agenda_v2",
        scope: "fazenda",
        fazenda_id: fazendaId,
        last_updated_at: "2026-06-13T11:00:00.000Z",
        last_id: "agenda-deleted",
      });
  });

  it("nao faz catalogo global depender de fazenda_id e mantem tenant separado", async () => {
    remoteRows.sanitario_product_classes_v2 = [
      {
        id: "class-global",
        scope: "global",
        fazenda_id: null,
        class_key: "vacina",
        updated_at: "2026-06-13T09:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "class-tenant",
        scope: "tenant",
        fazenda_id: fazendaId,
        class_key: "vacina-fazenda",
        updated_at: "2026-06-13T09:30:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_product_class_groups_v2 = [];
    remoteRows.sanitario_product_class_group_members_v2 = [];
    remoteRows.sanitario_product_class_default_rules_v2 = [];

    await pullSanitarioProductClassV2Catalog(fazendaId);

    const globalClassQuery = queryLog.filter(
      (entry) =>
        entry.table === "sanitario_product_classes_v2" &&
        queryLog.indexOf(entry) <= queryLog.findIndex(
          (candidate) =>
            candidate.table === "sanitario_product_classes_v2" &&
            candidate.op === "is" &&
            candidate.column === "fazenda_id",
        ),
    );
    expect(globalClassQuery).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "eq", column: "scope", value: "global" }),
        expect.objectContaining({ op: "is", column: "fazenda_id", value: null }),
      ]),
    );
    expect(globalClassQuery).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "eq", column: "fazenda_id", value: fazendaId }),
      ]),
    );
    expect(await db.catalog_sanitario_product_classes_v2.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "class-global", fazenda_id: null }),
        expect.objectContaining({ id: "class-tenant", fazenda_id: fazendaId }),
      ]),
    );
  });

  it("usa cursor nos catalogos tecnicos com updated_at e mantem produto_fontes em full fetch por nao ter updated_at", async () => {
    remoteRows.sanitario_fontes_tecnicas_v2 = [
      {
        id: "source-global",
        scope: "global",
        fazenda_id: null,
        updated_at: "2026-06-13T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_fonte_cobertura_campos_v2 = [
      {
        id: "coverage-1",
        source_id: "source-global",
        field_key: "dose",
        updated_at: "2026-06-13T08:01:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_produtos_v2 = [];
    remoteRows.sanitario_produto_especie_autorizacao_v2 = [];
    remoteRows.sanitario_produto_fontes_v2 = [
      {
        product_id: "product-1",
        source_id: "source-global",
        field_key: "dose",
        created_at: "2026-06-13T08:02:00.000Z",
      },
    ];
    remoteRows.sanitario_produto_dose_rules_v2 = [];
    remoteRows.sanitario_produto_carencia_rules_v2 = [];

    await pullSanitarioTechnicalCatalogV2(fazendaId);
    queryLog.length = 0;

    await pullSanitarioTechnicalCatalogV2(fazendaId);

    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_fontes_tecnicas_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-13T08:00:00.000Z",
        }),
        expect.objectContaining({
          table: "sanitario_fonte_cobertura_campos_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-13T08:01:00.000Z",
        }),
      ]),
    );
    expect(
      queryLog.some(
        (entry) =>
          entry.table === "sanitario_produto_fontes_v2" &&
          entry.op === "gte",
      ),
    ).toBe(false);
    expect(await db.sync_pull_cursors.get("sanitario_produto_fontes_v2:unscoped:null"))
      .toBeUndefined();
  });

  it("usa cursor incremental no catalogo de protocolos sanitarios v2 e preserva tombstones", async () => {
    remoteRows.sanitario_protocolos_v2 = [
      {
        id: "protocol-b19",
        family_code: "brucelose_b19",
        scope: "global",
        fazenda_id: null,
        status: "draft",
        approval_status: "draft",
        updated_at: "2026-06-15T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_protocolo_itens_versions_v2 = [
      {
        id: "item-b19",
        protocol_id: "protocol-b19",
        logical_item_key: "b19_femeas_3_8_meses",
        version: 1,
        allows_agenda_auto: false,
        updated_at: "2026-06-15T08:01:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_product_class_groups_v2 = [
      {
        id: "group-antiparasitario",
        group_key: "pcg_antiparasitarios_recria_estrategicos",
        scope: "global",
        fazenda_id: null,
        curation_status: "needs_review",
        automation_status: "blocked",
        updated_at: "2026-06-15T08:02:00.000Z",
        deleted_at: null,
      },
    ];

    await pullSanitarioProtocolCatalogV2();

    expect(queryLog.some((entry) => entry.op === "gte")).toBe(false);
    expect(await db.catalog_sanitario_protocolos_v2.get("protocol-b19"))
      .toMatchObject({
        family_code: "brucelose_b19",
        deleted_at: null,
      });

    remoteRows.sanitario_protocolos_v2.push({
      id: "protocol-aftosa",
      family_code: "febre_aftosa",
      scope: "global",
      fazenda_id: null,
      status: "retired",
      approval_status: "draft",
      updated_at: "2026-06-15T09:00:00.000Z",
      deleted_at: "2026-06-15T09:05:00.000Z",
    });
    queryLog.length = 0;

    await pullSanitarioProtocolCatalogV2();

    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_protocolos_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-15T08:00:00.000Z",
        }),
        expect.objectContaining({
          table: "sanitario_protocolo_itens_versions_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-15T08:01:00.000Z",
        }),
        expect.objectContaining({
          table: "sanitario_product_class_groups_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-15T08:02:00.000Z",
        }),
      ]),
    );
    expect(await db.catalog_sanitario_protocolos_v2.get("protocol-aftosa"))
      .toMatchObject({
        status: "retired",
        deleted_at: "2026-06-15T09:05:00.000Z",
      });
    expect(await db.sync_pull_cursors.get("sanitario_protocolos_v2:global:null"))
      .toMatchObject({
        remote_table: "sanitario_protocolos_v2",
        local_store: "catalog_sanitario_protocolos_v2",
        scope: "global",
        fazenda_id: null,
        last_updated_at: "2026-06-15T09:00:00.000Z",
        last_id: "protocol-aftosa",
      });
  });
});
