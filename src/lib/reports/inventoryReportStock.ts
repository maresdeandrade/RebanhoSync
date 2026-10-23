import type { InsumoLote, InsumoMovimentacao } from "@/lib/offline/types";
import {
  evaluateInventoryResupply,
  parseInventoryResupplyPolicy,
} from "@/lib/inventory/resupplyPolicy";
import type {
  InventoryPartialCostSummary,
  InventoryReportItemRow,
  OperationalSummaryInput,
  ReportRange,
} from "./operationalSummaryTypes";
import {
  getTimestampDateKey,
  type resolveMetricTimezone,
} from "./operationalSummaryCalendar";
import { summarizeInventoryCategories } from "./inventoryReportCategories";

type InventoryStockInput = Pick<
  OperationalSummaryInput,
  "insumos" | "insumoApresentacoes" | "insumoLotes" | "insumoMovimentacoes"
>;

export function normalizeInventoryCategory(
  value: string | null | undefined,
): string {
  const category = value?.trim();
  return category || "Sem categoria";
}

export function getInventoryMovementSignal(
  tipo: InsumoMovimentacao["tipo"],
): "entrada" | "saida" | null {
  if (
    tipo === "entrada" ||
    tipo === "ajuste_positivo" ||
    tipo === "transferencia_entrada"
  ) {
    return "entrada";
  }

  if (
    tipo === "ajuste_negativo" ||
    tipo === "consumo_sanitario" ||
    tipo === "consumo_nutricao" ||
    tipo === "perda" ||
    tipo === "transferencia_saida"
  ) {
    return "saida";
  }

  return null;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(3));
}

function isKnownNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getLotUnitCostForPartialReport(lot: InsumoLote): number | null {
  if (isKnownNonNegative(lot.custo_unitario)) return lot.custo_unitario;
  if (
    isKnownNonNegative(lot.custo_total) &&
    isKnownNonNegative(lot.quantidade_inicial_base) &&
    lot.quantidade_inicial_base > 0
  ) {
    return lot.custo_total / lot.quantidade_inicial_base;
  }
  return null;
}

function summarizeInventoryPartialCost(
  inventoryMovements: InsumoMovimentacao[],
  activeInventoryLots: InsumoLote[],
): InventoryPartialCostSummary {
  const partialCost: InventoryPartialCostSummary = {
    entradasKnownCost: 0,
    entradasKnownQuantity: 0,
    entradasMissingCostQuantity: 0,
    entradasMissingCostMovements: 0,
    saidasKnownCost: 0,
    saidasKnownQuantity: 0,
    saidasMissingCostQuantity: 0,
    saidasMissingCostMovements: 0,
    saldoKnownCost: 0,
    saldoKnownQuantity: 0,
    saldoMissingCostQuantity: 0,
    activeLotsWithKnownCost: 0,
    activeLotsWithMissingCost: 0,
  };

  for (const movement of inventoryMovements) {
    const signal = getInventoryMovementSignal(movement.tipo);
    if (!signal) continue;

    if (isKnownNonNegative(movement.custo_total_snapshot)) {
      if (signal === "entrada") {
        partialCost.entradasKnownCost = roundCurrency(
          partialCost.entradasKnownCost + movement.custo_total_snapshot,
        );
        partialCost.entradasKnownQuantity = roundQuantity(
          partialCost.entradasKnownQuantity + movement.quantidade_base,
        );
      } else {
        partialCost.saidasKnownCost = roundCurrency(
          partialCost.saidasKnownCost + movement.custo_total_snapshot,
        );
        partialCost.saidasKnownQuantity = roundQuantity(
          partialCost.saidasKnownQuantity + movement.quantidade_base,
        );
      }
      continue;
    }

    if (signal === "entrada") {
      partialCost.entradasMissingCostQuantity = roundQuantity(
        partialCost.entradasMissingCostQuantity + movement.quantidade_base,
      );
      partialCost.entradasMissingCostMovements += 1;
    } else {
      partialCost.saidasMissingCostQuantity = roundQuantity(
        partialCost.saidasMissingCostQuantity + movement.quantidade_base,
      );
      partialCost.saidasMissingCostMovements += 1;
    }
  }

  for (const lot of activeInventoryLots) {
    const unitCost = getLotUnitCostForPartialReport(lot);
    if (unitCost === null) {
      partialCost.saldoMissingCostQuantity = roundQuantity(
        partialCost.saldoMissingCostQuantity + lot.saldo_atual_base,
      );
      partialCost.activeLotsWithMissingCost += 1;
      continue;
    }

    partialCost.saldoKnownCost = roundCurrency(
      partialCost.saldoKnownCost + unitCost * lot.saldo_atual_base,
    );
    partialCost.saldoKnownQuantity = roundQuantity(
      partialCost.saldoKnownQuantity + lot.saldo_atual_base,
    );
    partialCost.activeLotsWithKnownCost += 1;
  }

  return partialCost;
}

export function buildInventoryStock({
  input,
  metricTimezone,
  range,
}: {
  input: InventoryStockInput;
  metricTimezone: ReturnType<typeof resolveMetricTimezone>;
  range: ReportRange;
}) {
  const insumos = (input.insumos ?? []).filter((item) => !item.deleted_at);
  const insumoById = new Map(insumos.map((item) => [item.id, item]));
  const apresentacaoById = new Map(
    (input.insumoApresentacoes ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.id, item]),
  );
  const inventoryMovements = (input.insumoMovimentacoes ?? []).filter(
    (movement) =>
      !movement.deleted_at &&
      getTimestampDateKey(movement.occurred_at, metricTimezone.timezone) >=
        range.from &&
      getTimestampDateKey(movement.occurred_at, metricTimezone.timezone) <=
        range.to,
  );
  const movementsByLot = new Map<string, InsumoMovimentacao[]>();
  const inventorySaldoByInsumo = new Map<string, number>();

  for (const lot of input.insumoLotes ?? []) {
    if (lot.deleted_at) continue;
    inventorySaldoByInsumo.set(
      lot.insumo_id,
      (inventorySaldoByInsumo.get(lot.insumo_id) ?? 0) + lot.saldo_atual_base,
    );
  }
  const activeInventoryLots = (input.insumoLotes ?? []).filter(
    (lot) => !lot.deleted_at && lot.status === "ativo",
  );

  for (const movement of inventoryMovements) {
    const current = movementsByLot.get(movement.insumo_lote_id) ?? [];
    current.push(movement);
    movementsByLot.set(movement.insumo_lote_id, current);
  }

  const inventoryItems = (input.insumoLotes ?? [])
    .filter((lot) => !lot.deleted_at)
    .map<InventoryReportItemRow>((lot) => {
      const insumo = insumoById.get(lot.insumo_id);
      const apresentacao = lot.apresentacao_id
        ? apresentacaoById.get(lot.apresentacao_id)
        : undefined;
      const movements = movementsByLot.get(lot.id) ?? [];
      const movementTotals = movements.reduce(
        (acc, movement) => {
          const signal = getInventoryMovementSignal(movement.tipo);
          if (signal === "entrada") acc.entradas += movement.quantidade_base;
          if (signal === "saida") acc.saidas += movement.quantidade_base;
          return acc;
        },
        { entradas: 0, saidas: 0 },
      );
      const resupply = evaluateInventoryResupply(
        inventorySaldoByInsumo.get(lot.insumo_id) ?? lot.saldo_atual_base,
        parseInventoryResupplyPolicy(insumo?.payload),
      );

      return {
        id: lot.id,
        insumoId: insumo?.id ?? null,
        productId: insumo?.produto_veterinario_id ?? null,
        categoria: normalizeInventoryCategory(insumo?.categoria),
        insumo: insumo?.nome ?? "Insumo sem cadastro",
        tipo:
          insumo?.tipo === "sanitario"
            ? "Sanitario"
            : insumo?.tipo === "nutricional"
              ? "Nutricional"
              : "Outro",
        lote: lot.identificacao_lote ?? "Sem identificacao",
        apresentacao: apresentacao?.nome ?? "Sem apresentacao",
        unidadeBase: lot.unidade_base,
        saldo: lot.saldo_atual_base,
        entradas: movementTotals.entradas,
        saidas: movementTotals.saidas,
        status: lot.status,
        validade: lot.validade,
        local: lot.local_armazenamento,
        resupplyStatus: resupply.status,
        minimumStockBase: resupply.minimumStockBase,
        reorderPointBase: resupply.reorderPointBase,
        resupplyGap:
          resupply.status === "critical"
            ? resupply.gapToMinimum
            : resupply.status === "warning"
              ? resupply.gapToReorderPoint
              : 0,
      };
    })
    .sort((left, right) =>
      `${left.categoria} ${left.insumo} ${left.lote}`.localeCompare(
        `${right.categoria} ${right.insumo} ${right.lote}`,
      ),
    );

  const inventoryCategories = summarizeInventoryCategories(inventoryItems);
  const partialCost = summarizeInventoryPartialCost(
    inventoryMovements,
    activeInventoryLots,
  );
  const inventoryLotById = new Map(
    (input.insumoLotes ?? [])
      .filter((lot) => !lot.deleted_at)
      .map((lot) => [lot.id, lot]),
  );

  return {
    insumos,
    insumoById,
    apresentacaoById,
    inventoryMovements,
    inventorySaldoByInsumo,
    activeInventoryLots,
    inventoryItems,
    inventoryCategories,
    partialCost,
    inventoryLotById,
  };
}
