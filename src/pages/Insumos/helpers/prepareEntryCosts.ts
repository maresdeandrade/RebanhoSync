import type { InventoryCostSummary } from "@/lib/inventory/inventoryFormPresets";
import type { EntryForm } from "../types";

type EntryCostPreparation =
  | { error: string }
  | {
      resolvedCustoTotal: number | null;
      resolvedCustoUnitario: number | null;
      resolvedCustoStatus: InventoryCostSummary["status"];
      resolvedOrigemCusto: EntryForm["origemCusto"];
    };

export function prepareEntryCosts({
  entryForm,
  entryCostSummary,
}: {
  entryForm: Pick<
    EntryForm,
    "costMode" | "custoTotal" | "custoUnitario" | "origemCusto"
  >;
  entryCostSummary: InventoryCostSummary;
}): EntryCostPreparation {
  if (entryForm.costMode === "custo_total" && entryForm.custoTotal.trim()) {
    const parsedCustoTotal = Number(entryForm.custoTotal.replace(",", "."));
    if (!Number.isFinite(parsedCustoTotal) || parsedCustoTotal < 0) {
      return { error: "Custo total informado e invalido." };
    }
  }
  if (
    entryForm.costMode === "custo_unitario" &&
    entryForm.custoUnitario.trim()
  ) {
    const parsedCustoUnitario = Number(
      entryForm.custoUnitario.replace(",", "."),
    );
    if (!Number.isFinite(parsedCustoUnitario) || parsedCustoUnitario < 0) {
      return { error: "Custo por entrada informado e invalido." };
    }
  }

  const resolvedCustoTotal = entryCostSummary.custoTotal;
  const resolvedCustoUnitario = entryCostSummary.custoUnitarioBase;
  const resolvedCustoStatus = entryCostSummary.status;
  const resolvedOrigemCusto =
    resolvedCustoStatus === "informado"
      ? entryForm.origemCusto === "ausente"
        ? "manual"
        : entryForm.origemCusto
      : "ausente";

  return {
    resolvedCustoTotal,
    resolvedCustoUnitario,
    resolvedCustoStatus,
    resolvedOrigemCusto,
  };
}
