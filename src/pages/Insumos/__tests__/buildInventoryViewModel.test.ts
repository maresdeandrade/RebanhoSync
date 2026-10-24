// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { act, renderHook } from "@testing-library/react";
import { useMemo, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInventoryProjection,
  buildInventoryViewModel,
  computeLotBalance,
} from "../helpers/buildInventoryViewModel";
import {
  all,
  fixture,
  referenceTimeMs,
  type Snapshot,
  type Filters,
} from "./fixtures/inventoryProjection.inputs";

afterEach(() => vi.restoreAllMocks());
describe("pure inventory view model", () => {
  it("uses only the explicit clock and never mutates inputs", () => {
    const snapshot = fixture();
    const before = structuredClone(snapshot);
    snapshot.insumos.forEach(Object.freeze);
    snapshot.lotes.forEach(Object.freeze);
    snapshot.movimentacoes.forEach(Object.freeze);
    Object.freeze(snapshot.insumos);
    Object.freeze(snapshot.lotes);
    Object.freeze(snapshot.movimentacoes);
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("global clock read");
    });
    const projection = buildInventoryProjection(
      snapshot,
      { ...all, periodDays: 7 },
      referenceTimeMs,
    );
    expect(
      buildInventoryProjection(
        snapshot,
        { ...all, periodDays: 7 },
        referenceTimeMs,
      ),
    ).toEqual(projection);
    expect(buildInventoryViewModel(projection, all).filteredTotals).toEqual({
      saldo: 16,
      entradas: 3,
      saidas: 0,
    });
    expect(snapshot).toEqual(before);
  });
  it("reuses period results when filtering and honors a newly supplied cutoff", () => {
    const snapshot = fixture();
    const projection = buildInventoryProjection(
      snapshot,
      { ...all, periodDays: 7 },
      referenceTimeMs,
    );
    const view = buildInventoryViewModel(projection, {
      ...all,
      selectedType: "nutricional",
    });
    expect(view.lotRows).toBe(projection.lotRows);
    expect(view.categoryOptions).toBe(projection.categoryOptions);
    expect(view.filteredTotals).toEqual({ saldo: 15, entradas: 3, saidas: 0 });
    const later = buildInventoryProjection(
      snapshot,
      { ...all, periodDays: 7 },
      referenceTimeMs + 8 * 86400000,
    );
    expect(buildInventoryViewModel(later, all).filteredTotals).toEqual({
      saldo: 16,
      entradas: 0,
      saidas: 0,
    });
  });
  it("ignores other lots, absent transaction IDs and confirmed transactions", () => {
    const snapshot = fixture();
    const movement = snapshot.movimentacoes[0];
    expect(
      computeLotBalance(
        snapshot.lotes[0],
        [
          movement,
          { ...movement, insumo_lote_id: "other", quantidade_base: 100 },
          { ...movement, client_tx_id: null, quantidade_base: 200 },
          { ...movement, client_tx_id: "confirmed", quantidade_base: 400 },
        ],
        snapshot.pendingTxIds,
      ),
    ).toBe(13);
  });
});

// Run the page's actual memo/effect wiring with React, excluding all I/O and UI.
function pageProjectionHook() {
  const source = readFileSync(
    resolve(process.cwd(), "src/pages/Insumos.tsx"),
    "utf8",
  );
  const file = ts.createSourceFile(
    "Insumos.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      [
        "inventoryProjection",
        "{ lotRows, categoryOptions }",
        "{ filteredLotRows, filteredTotals, filteredResupplyTotals }",
      ].includes(node.name.getText(file))
    )
      declarations.push("const " + node.getText(file) + ";");
    if (
      ts.isExpressionStatement(node) &&
      node.getText(file).startsWith("useEffect(") &&
      node.getText(file).includes("!categoryOptions.includes(selectedCategory)")
    )
      declarations.push(node.getText(file));
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (declarations.length !== 4)
    throw new Error("Incomplete page projection wiring");
  const js = ts.transpile(declarations.join("\n"), {
    target: ts.ScriptTarget.ES2020,
  });
  return new Function(
    "context",
    "const { snapshot, search, periodDays, selectedCategory, selectedType, setSelectedCategory, buildInventoryProjection, buildInventoryViewModel, useMemo, useEffect } = context; const ALL_CATEGORIES_VALUE = '__all_categories__'; " +
      js +
      " return { lotRows, categoryOptions, filteredTotals, filteredResupplyTotals };",
  );
}
it("preserves page memo cadence and resets a category invalidated by search", () => {
  let now = referenceTimeMs;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const project = vi.fn(buildInventoryProjection);
  const filter = vi.fn(buildInventoryViewModel);
  const setSelectedCategory = vi.fn();
  const run = pageProjectionHook();
  const snapshot = fixture();
  const { result, rerender } = renderHook(
    (props: { snapshot: Snapshot; filters: Filters }) =>
      run({
        ...props.filters,
        snapshot: props.snapshot,
        setSelectedCategory,
        buildInventoryProjection: project,
        buildInventoryViewModel: filter,
        useMemo,
        useEffect,
      }),
    { initialProps: { snapshot, filters: { ...all, periodDays: 7 } } },
  );
  expect(result.current.filteredTotals.entradas).toBe(3);
  now += 8 * 86400000;
  act(() =>
    rerender({
      snapshot,
      filters: {
        ...all,
        periodDays: 7,
        selectedCategory: "Nutrição",
        selectedType: "nutricional",
      },
    }),
  );
  expect(project).toHaveBeenCalledTimes(1);
  expect(result.current.filteredTotals.entradas).toBe(3);
  act(() =>
    rerender({
      snapshot,
      filters: {
        ...all,
        periodDays: 7,
        selectedCategory: "Nutrição",
        search: "agulha",
      },
    }),
  );
  expect(project).toHaveBeenCalledTimes(2);
  expect(result.current.categoryOptions).toEqual(["Sanitário"]);
  expect(setSelectedCategory).toHaveBeenCalledWith("__all_categories__");
  act(() => rerender({ snapshot, filters: { ...all, periodDays: 7 } }));
  expect(result.current.filteredTotals.entradas).toBe(0);
});
