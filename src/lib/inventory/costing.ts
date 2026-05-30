import type { InsumoLote } from "@/lib/offline/types";

export interface InventoryCostSnapshot {
  custo_unitario_snapshot: number | null;
  custo_total_snapshot: number | null;
  custo_status: "informado" | "ausente";
  limitacoes: string[];
}

/**
 * Resolves the unit cost for a lot.
 * Prioritizes direct custo_unitario if it exists and is >= 0.
 * Otherwise, derives it from custo_total / quantidade_inicial_base (if quantidade_inicial_base > 0).
 */
export function resolveInventoryLotUnitCost(
  lot?: Pick<InsumoLote, "custo_unitario" | "custo_total" | "quantidade_inicial_base"> | null
): number | null {
  if (!lot) return null;
  if (typeof lot.custo_unitario === "number" && lot.custo_unitario >= 0) {
    return lot.custo_unitario;
  }
  if (
    typeof lot.custo_total === "number" &&
    lot.custo_total >= 0 &&
    typeof lot.quantidade_inicial_base === "number" &&
    lot.quantidade_inicial_base > 0
  ) {
    return parseFloat((lot.custo_total / lot.quantidade_inicial_base).toFixed(4));
  }
  return null;
}

/**
 * Builds a stable economic cost snapshot for inventory movements or event payloads.
 */
export function buildInventoryCostSnapshot(input: {
  lot?: Pick<InsumoLote, "custo_unitario" | "custo_total" | "quantidade_inicial_base"> | null;
  quantidadeBase: number;
}): InventoryCostSnapshot {
  const { lot, quantidadeBase } = input;
  const unitCost = resolveInventoryLotUnitCost(lot);

  if (unitCost !== null && typeof quantidadeBase === "number" && quantidadeBase >= 0) {
    const totalCost = parseFloat((unitCost * quantidadeBase).toFixed(2));
    return {
      custo_unitario_snapshot: unitCost,
      custo_total_snapshot: totalCost,
      custo_status: "informado",
      limitacoes: [],
    };
  }

  return {
    custo_unitario_snapshot: null,
    custo_total_snapshot: null,
    custo_status: "ausente",
    limitacoes: ["Sem custo unitario cadastrado no lote"],
  };
}
