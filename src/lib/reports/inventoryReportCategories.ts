import type {
  InventoryReportCategoryRow,
  InventoryReportItemRow,
} from "./operationalSummaryTypes";

export function summarizeInventoryCategories(
  items: readonly InventoryReportItemRow[],
): InventoryReportCategoryRow[] {
  const inventoryCategoryMap = new Map<string, InventoryReportCategoryRow>();
  for (const item of items) {
    const row =
      inventoryCategoryMap.get(item.categoria) ??
      ({
        categoria: item.categoria,
        itens: 0,
        lotes: 0,
        saldo: 0,
        entradas: 0,
        saidas: 0,
        resupplyWarningCount: 0,
        resupplyCriticalCount: 0,
      } satisfies InventoryReportCategoryRow);

    row.itens += 1;
    row.lotes += 1;
    row.saldo += item.saldo;
    row.entradas += item.entradas;
    row.saidas += item.saidas;
    if (item.resupplyStatus === "warning") row.resupplyWarningCount += 1;
    if (item.resupplyStatus === "critical") row.resupplyCriticalCount += 1;
    inventoryCategoryMap.set(item.categoria, row);
  }
  return Array.from(inventoryCategoryMap.values()).sort((left, right) =>
    left.categoria.localeCompare(right.categoria),
  );
}
