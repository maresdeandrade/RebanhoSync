import type { Insumo, InsumoLote, InsumoMovimentacao } from "@/lib/offline/types";
import type { SanitaryLocalAgendaListItemV2 } from "./sanitaryLocalAgendaManagementV2";

export type SanitaryForecastStatusV2 =
  | "insufficient_data"
  | "product_not_selected"
  | "stock_unknown"
  | "stock_insufficient"
  | "stock_sufficient";

export type SanitaryAgendaForecastV2 = {
  status: SanitaryForecastStatusV2;
  animalCount: number;
  dosePerAnimal: number | null;
  unit: string | null;
  estimatedQuantity: number | null;
  compatibleStock: number | null;
  deficit: number | null;
};

export type SanitaryPlanRealizedIndicatorsV2 = {
  plannedAnimals: number;
  executedAnimals: number;
  coverageRatio: number | null;
  estimatedQuantity: number | null;
  appliedQuantity: number | null;
  consumedQuantity: number | null;
  lossQuantity: number | null;
  variance: number | null;
  comparable: boolean;
  comparisonStatus: "comparable" | "partial_execution" | "incomplete_data" | "not_comparable";
};

export function buildSanitaryAgendaForecastV2(input: {
  fazendaId: string;
  asOf: string;
  item: Pick<SanitaryLocalAgendaListItemV2, "animalCount" | "plannedProductId" | "suggestedDose" | "suggestedDoseUnit" | "suggestedDoseBasis" | "suggestedDoseProductId">;
  stock?: { complete: boolean; supplies: Insumo[]; lots: InsumoLote[] };
}): SanitaryAgendaForecastV2 {
  const animalCount = Math.max(0, input.item.animalCount);
  if (!input.item.plannedProductId) {
    return { status: "product_not_selected", animalCount, dosePerAnimal: null, unit: null, estimatedQuantity: null, compatibleStock: null, deficit: null };
  }
  const dose = input.item.suggestedDose;
  const unit = input.item.suggestedDoseUnit?.trim() || null;
  if (!Number.isFinite(dose) || dose <= 0 || !unit || animalCount <= 0 || input.item.suggestedDoseBasis !== "animal" || input.item.suggestedDoseProductId !== input.item.plannedProductId) {
    return { status: "insufficient_data", animalCount, dosePerAnimal: dose ?? null, unit, estimatedQuantity: null, compatibleStock: null, deficit: null };
  }
  const estimatedQuantity = Number((animalCount * dose).toFixed(4));
  if (!input.stock) {
    return { status: "stock_unknown", animalCount, dosePerAnimal: dose, unit, estimatedQuantity, compatibleStock: null, deficit: null };
  }
  const linkedSupplyIds = new Set(input.stock.supplies
    .filter((supply) => supply.fazenda_id === input.fazendaId && supply.tipo === "sanitario" && supply.ativo && !supply.deleted_at && supply.sanitario_produto_v2_id === input.item.plannedProductId)
    .map((supply) => supply.id));
  const compatibleStock = input.stock.lots
    .filter((lot) => {
      const validDate = !lot.validade || lot.validade >= input.asOf;
      return lot.fazenda_id === input.fazendaId && !lot.deleted_at && lot.status === "ativo" && validDate && Number.isFinite(lot.saldo_atual_base) && lot.saldo_atual_base > 0 && lot.unidade_base === unit && linkedSupplyIds.has(lot.insumo_id);
    })
    .reduce((sum, lot) => sum + Math.max(0, lot.saldo_atual_base), 0);
  if (!input.stock.complete) {
    return { status: "stock_unknown", animalCount, dosePerAnimal: dose, unit, estimatedQuantity, compatibleStock: null, deficit: null };
  }
  const deficit = Math.max(0, Number((estimatedQuantity - compatibleStock).toFixed(4)));
  return {
    status: deficit > 0 ? "stock_insufficient" : "stock_sufficient",
    animalCount,
    dosePerAnimal: dose,
    unit,
    estimatedQuantity,
    compatibleStock,
    deficit,
  };
}

export function buildSanitaryPlanRealizedIndicatorsV2(input: {
  fazendaId: string;
  eventIds: string[];
  plannedAnimals: number;
  executedAnimalIds: string[];
  estimatedQuantity: number | null;
  appliedQuantities: Array<{ quantity: number | null; unit: string | null; productId?: string | null; expectedProductId?: string | null }>;
  movements: Array<Pick<InsumoMovimentacao, "id" | "fazenda_id" | "source_evento_id" | "quantidade_base" | "unidade_base" | "tipo" | "deleted_at">>;
  comparableUnit: string | null;
}): SanitaryPlanRealizedIndicatorsV2 {
  const plannedAnimals = Math.max(0, input.plannedAnimals);
  const executedAnimals = new Set(input.executedAnimalIds).size;
  const applied = input.appliedQuantities.filter((entry) => entry.quantity != null && Number.isFinite(entry.quantity) && entry.quantity >= 0 && entry.unit === input.comparableUnit);
  const productMismatch = input.appliedQuantities.some((entry) => entry.expectedProductId != null && entry.productId != null && entry.expectedProductId !== entry.productId);
  const seenMovements = new Set<string>();
  const uniqueMovements = input.movements.filter((movement) => {
    if (seenMovements.has(movement.id)) return false;
    seenMovements.add(movement.id);
    return true;
  });
  const consumed = uniqueMovements
    .filter((movement) => movement.fazenda_id === input.fazendaId && movement.source_evento_id != null && input.eventIds.includes(movement.source_evento_id) && movement.tipo === "consumo_sanitario" && !movement.deleted_at && Number.isFinite(movement.quantidade_base) && movement.quantidade_base >= 0 && movement.unidade_base === input.comparableUnit)
    .reduce((sum, movement) => sum + Math.max(0, movement.quantidade_base), 0);
  const appliedQuantity = applied.length ? Number(applied.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0).toFixed(4)) : null;
  const consumedQuantity = input.comparableUnit ? Number(consumed.toFixed(4)) : null;
  const loss = uniqueMovements
    .filter((movement) => movement.fazenda_id === input.fazendaId && movement.source_evento_id != null && input.eventIds.includes(movement.source_evento_id) && movement.tipo === "perda" && !movement.deleted_at && Number.isFinite(movement.quantidade_base) && movement.quantidade_base >= 0 && movement.unidade_base === input.comparableUnit)
    .reduce((sum, movement) => sum + Math.max(0, movement.quantidade_base), 0);
  const lossQuantity = input.comparableUnit ? Number(loss.toFixed(4)) : null;
  const comparable = !productMismatch && input.estimatedQuantity != null && consumedQuantity != null && plannedAnimals > 0 && executedAnimals >= plannedAnimals && input.comparableUnit != null;
  return {
    plannedAnimals,
    executedAnimals,
    coverageRatio: plannedAnimals > 0 ? Number((executedAnimals / plannedAnimals).toFixed(4)) : null,
    estimatedQuantity: input.estimatedQuantity,
    appliedQuantity,
    consumedQuantity,
    lossQuantity,
    variance: comparable ? Number((consumedQuantity! - input.estimatedQuantity!).toFixed(4)) : null,
    comparable,
    comparisonStatus: !input.comparableUnit || input.estimatedQuantity == null || consumedQuantity == null
      ? "incomplete_data"
      : productMismatch
        ? "not_comparable"
        : executedAnimals < plannedAnimals
        ? "partial_execution"
        : comparable
          ? "comparable"
          : "not_comparable",
  };
}
