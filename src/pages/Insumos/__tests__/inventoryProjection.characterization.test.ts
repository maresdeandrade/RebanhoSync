import {
  buildInventoryProjection,
  buildInventoryViewModel,
} from "../helpers/buildInventoryViewModel";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { projectInventoryLotBalance } from "@/lib/inventory/inventoryContracts";
import {
  evaluateInventoryResupply,
  parseInventoryResupplyPolicy,
} from "@/lib/inventory/resupplyPolicy";
import type { InsumoMovimentacao } from "@/lib/offline/types";

import {
  fixture,
  referenceTimeMs,
  all,
  type Snapshot,
  type Filters,
} from "./fixtures/inventoryProjection.inputs";

// Execute the real pre-extraction functions and memo callbacks; no React or I/O.
function legacyProjection(source: string) {
  const file = ts.createSourceFile(
    "baseline.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const functions: string[] = [];
  const memos: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      [
        "normalizeCategory",
        "isMovementInPeriod",
        "summarizeLotMovements",
        "computeLotBalance",
      ].includes(node.name?.text ?? "")
    )
      functions.push(node.getText(file));
    if (
      ts.isVariableDeclaration(node) &&
      [
        "lotRows",
        "categoryOptions",
        "filteredLotRows",
        "filteredTotals",
        "filteredResupplyTotals",
      ].includes(node.name.getText(file))
    )
      memos.push("const " + node.getText(file) + ";");
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (functions.length !== 4 || memos.length !== 5)
    throw new Error("Incomplete legacy projection");
  const js = ts.transpile(functions.join("\n") + "\n" + memos.join("\n"), {
    target: ts.ScriptTarget.ES2020,
  });
  const run = new Function(
    "context",
    "const {snapshot, search, periodDays, selectedCategory, selectedType, insumoById, apresentacaoById, projectInventoryLotBalance, evaluateInventoryResupply, parseInventoryResupplyPolicy} = context; const ALL_CATEGORIES_VALUE = '__all_categories__'; const ALL_TYPES_VALUE = '__all_types__'; const useMemo = (fn) => fn(); " +
      js +
      " return {lotRows, categoryOptions, filteredLotRows, filteredTotals, filteredResupplyTotals};",
  );
  return (snapshot: Snapshot | null, filters: Partial<Filters> = {}) =>
    run({
      snapshot,
      ...all,
      ...filters,
      insumoById: new Map(snapshot?.insumos.map((i) => [i.id, i])),
      apresentacaoById: new Map(snapshot?.apresentacoes.map((i) => [i.id, i])),
      projectInventoryLotBalance,
      evaluateInventoryResupply,
      parseInventoryResupplyPolicy,
    });
}
const before = legacyProjection(
  readFileSync(
    new URL("./fixtures/inventoryProjection.baseline.txt", import.meta.url),
    "utf8",
  ),
);
const current = (snapshot: Snapshot | null, filters: Partial<Filters> = {}) => {
  const selected = { ...all, ...filters };
  return buildInventoryViewModel(
    buildInventoryProjection(snapshot, selected, referenceTimeMs),
    selected,
  );
};
afterEach(() => vi.restoreAllMocks());

for (const [label, project] of [
  ["baseline", before],
  ["current", current],
] as const) {
  describe(`inventory projection: ${label}`, () => {
    it("projects pending balance and counts resupply once per input", () => {
      vi.spyOn(Date, "now").mockReturnValue(referenceTimeMs);
      const view = project(fixture());
      expect(
        view.lotRows.map((r) => [
          r.lot.id,
          r.saldoOperacional,
          r.saldoInsumo,
          r.resupply.status,
        ]),
      ).toEqual([
        ["b1", 1, 1, "critical"],
        ["a1", 13, 15, "warning"],
        ["a2", 2, 15, "warning"],
      ]);
      expect(view.filteredTotals).toEqual({
        saldo: 16,
        entradas: 3,
        saidas: 0,
      });
      expect(view.filteredResupplyTotals).toEqual({
        configured: 2,
        critical: 1,
        warning: 1,
      });
    });
    it.each(["DONE", "SYNCED"])("does not recount a %s movement", () => {
      const snapshot = fixture();
      snapshot.pendingTxIds.clear(); // The unchanged query excludes both statuses.
      snapshot.lotes[0].saldo_atual_base = 13;
      expect(
        project(snapshot).lotRows.find((r) => r.lot.id === "a1")
          .saldoOperacional,
      ).toBe(13);
    });
    it("preserves all movement signs, inclusive cutoff and invalid dates", () => {
      vi.spyOn(Date, "now").mockReturnValue(referenceTimeMs);
      const snapshot = fixture();
      const types: InsumoMovimentacao["tipo"][] = [
        "entrada",
        "ajuste_positivo",
        "transferencia_entrada",
        "ajuste_negativo",
        "consumo_sanitario",
        "consumo_nutricao",
        "perda",
        "transferencia_saida",
      ];
      snapshot.movimentacoes = types.map((tipo, i) => ({
        ...snapshot.movimentacoes[0],
        id: String(i),
        tipo,
        quantidade_base: i + 1,
        occurred_at: new Date(referenceTimeMs - 7 * 86400000).toISOString(),
      }));
      snapshot.movimentacoes.push(
        {
          ...snapshot.movimentacoes[0],
          id: "old",
          quantidade_base: 100,
          occurred_at: new Date(
            referenceTimeMs - 7 * 86400000 - 1,
          ).toISOString(),
        },
        {
          ...snapshot.movimentacoes[0],
          id: "bad",
          quantidade_base: 200,
          occurred_at: "invalid",
        },
      );
      expect(project(snapshot, { periodDays: 7 }).filteredTotals).toEqual({
        saldo: 289,
        entradas: 6,
        saidas: 30,
      });
      expect(project(snapshot).filteredTotals).toEqual({
        saldo: 289,
        entradas: 306,
        saidas: 30,
      });
    });
    it("applies search before categories, then category and type", () => {
      const snapshot = fixture();
      expect(project(snapshot).categoryOptions).toEqual([
        "Nutrição",
        "Sanitário",
      ]);
      const view = project(snapshot, {
        search: "  saco ESPECIAL ",
        selectedCategory: "Nutrição",
        selectedType: "nutricional",
      });
      expect(view.categoryOptions).toEqual(["Nutrição"]);
      expect(view.filteredLotRows.map((r) => r.lot.id)).toEqual(["a2"]);
      expect(view.filteredTotals.saldo).toBe(2);
      expect(view.filteredResupplyTotals).toEqual({
        configured: 1,
        critical: 0,
        warning: 1,
      });
      expect(
        project(snapshot, { search: "sal", selectedType: "sanitario" })
          .filteredLotRows,
      ).toEqual([]);
      expect(
        project(snapshot, { selectedCategory: "absent" }).filteredLotRows,
      ).toEqual([]);
    });
    it.each([
      ["insumo name", "sal", ["a1", "a2"]],
      ["category", "nutrição", ["a1", "a2"]],
      ["presentation name", "especial", ["a2"]],
      ["presentation manufacturer", "fornecedor", ["a2"]],
      ["lot identification", "primeiro", ["a1"]],
      ["lot manufacturer", "fábrica", ["a1"]],
      ["lot storage", "galpão", ["a1"]],
      ["missing field", "undefined", []],
    ])(
      "searches %s without changing missing-field normalization",
      (_, search, ids) => {
        expect(
          project(fixture(), { search: search as string }).lotRows.map(
            (r) => r.lot.id,
          ),
        ).toEqual(ids);
      },
    );
    it.each([
      ["entrada", 3, 0],
      ["ajuste_positivo", 3, 0],
      ["transferencia_entrada", 3, 0],
      ["ajuste_negativo", 0, 3],
      ["consumo_sanitario", 0, 3],
      ["consumo_nutricao", 0, 3],
      ["perda", 0, 3],
      ["transferencia_saida", 0, 3],
    ] as const)(
      "keeps %s in its original period direction",
      (tipo, entradas, saidas) => {
        const snapshot = fixture();
        snapshot.movimentacoes[0].tipo = tipo;
        const view = project(snapshot);
        expect(view.filteredTotals.entradas).toBe(entradas);
        expect(view.filteredTotals.saidas).toBe(saidas);
      },
    );
    it("handles missing inputs, presentations, categories and empty lists", () => {
      const snapshot = fixture();
      snapshot.insumos = [];
      snapshot.apresentacoes = [];
      const view = project(snapshot);
      expect(view.categoryOptions).toEqual(["Sem categoria"]);
      expect(view.lotRows.map((r) => r.lot.id)).toEqual(["a1", "a2", "b1"]);
      expect(view.filteredResupplyTotals).toEqual({
        configured: 0,
        warning: 0,
        critical: 0,
      });
      expect(project(null)).toEqual({
        lotRows: [],
        categoryOptions: [],
        filteredLotRows: [],
        filteredTotals: { saldo: 0, entradas: 0, saidas: 0 },
        filteredResupplyTotals: { configured: 0, warning: 0, critical: 0 },
      });
      snapshot.lotes = [];
      expect(project(snapshot)).toEqual(project(null));
    });
  });
}
