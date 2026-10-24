import { projectInventoryLotBalance } from "@/lib/inventory/inventoryContracts";
import {
  evaluateInventoryResupply,
  parseInventoryResupplyPolicy,
  type InventoryResupplyEvaluation,
} from "@/lib/inventory/resupplyPolicy";
import type { InsumoLote, InsumoMovimentacao } from "@/lib/offline/types";
import type {
  InventoryProjectionInput,
  InventoryProjectionFilters,
  InventoryRowFilters,
  InventoryProjection,
  InventoryViewModel,
  LotRow,
  LotMovementSummary,
} from "../types";

const ALL_CATEGORIES_VALUE = "__all_categories__";
const ALL_TYPES_VALUE = "__all_types__";

function normalizeCategory(value: string | null | undefined) {
  const category = value?.trim();
  return category || "Sem categoria";
}

function isMovementInPeriod(
  movement: InsumoMovimentacao,
  periodDays: number | null,
  referenceTimeMs: number,
) {
  if (!periodDays) return true;
  const occurredAt = new Date(movement.occurred_at).getTime();
  if (!Number.isFinite(occurredAt)) return false;
  const cutoff = referenceTimeMs - periodDays * 24 * 60 * 60 * 1000;
  return occurredAt >= cutoff;
}

function summarizeLotMovements(
  lot: InsumoLote,
  movements: InsumoMovimentacao[],
  periodDays: number | null,
  referenceTimeMs: number,
): LotMovementSummary {
  return movements.reduce<LotMovementSummary>(
    (summary, movement) => {
      if (
        movement.insumo_lote_id !== lot.id ||
        !isMovementInPeriod(movement, periodDays, referenceTimeMs)
      ) {
        return summary;
      }

      if (
        movement.tipo === "entrada" ||
        movement.tipo === "ajuste_positivo" ||
        movement.tipo === "transferencia_entrada"
      ) {
        return {
          ...summary,
          entradas: summary.entradas + movement.quantidade_base,
        };
      }

      if (
        movement.tipo === "ajuste_negativo" ||
        movement.tipo === "consumo_sanitario" ||
        movement.tipo === "consumo_nutricao" ||
        movement.tipo === "perda" ||
        movement.tipo === "transferencia_saida"
      ) {
        return {
          ...summary,
          saidas: summary.saidas + movement.quantidade_base,
        };
      }

      return summary;
    },
    { entradas: 0, saidas: 0 },
  );
}

export function computeLotBalance(
  lot: InsumoLote,
  movements: InsumoMovimentacao[],
  pendingTxIds: Set<string>,
) {
  const pendingMovements = movements.filter(
    (movement) =>
      movement.insumo_lote_id === lot.id &&
      movement.client_tx_id &&
      pendingTxIds.has(movement.client_tx_id),
  );

  return projectInventoryLotBalance({
    saldoAtualBase: lot.saldo_atual_base,
    movements: pendingMovements,
  });
}

// Snapshot is already scoped by farm and tombstones at the query boundary.
export function buildInventoryProjection(
  snapshot: InventoryProjectionInput | null,
  { search, periodDays }: InventoryProjectionFilters,
  referenceTimeMs: number,
): InventoryProjection {
  const insumoById = new Map(
    (snapshot?.insumos ?? []).map((item) => [item.id, item]),
  );
  const apresentacaoById = new Map(
    (snapshot?.apresentacoes ?? []).map((item) => [item.id, item]),
  );
  const lotRows = (() => {
    if (!snapshot) return [];
    const searchLower = search.trim().toLowerCase();
    const saldoByInsumo = new Map<string, number>();

    for (const lot of snapshot.lotes) {
      saldoByInsumo.set(
        lot.insumo_id,
        (saldoByInsumo.get(lot.insumo_id) ?? 0) +
          computeLotBalance(lot, snapshot.movimentacoes, snapshot.pendingTxIds),
      );
    }

    return snapshot.lotes
      .map<LotRow>((lot) => {
        const insumo = insumoById.get(lot.insumo_id);
        const apresentacao = lot.apresentacao_id
          ? apresentacaoById.get(lot.apresentacao_id)
          : undefined;
        const saldoOperacional = computeLotBalance(
          lot,
          snapshot.movimentacoes,
          snapshot.pendingTxIds,
        );
        const saldoInsumo =
          saldoByInsumo.get(lot.insumo_id) ?? saldoOperacional;
        const category = normalizeCategory(insumo?.categoria);
        const movimentoPeriodo = summarizeLotMovements(
          lot,
          snapshot.movimentacoes,
          periodDays,
          referenceTimeMs,
        );
        return {
          lot,
          insumo,
          apresentacao,
          category,
          movimentoPeriodo,
          saldoOperacional,
          saldoInsumo,
          resupply: evaluateInventoryResupply(
            saldoInsumo,
            parseInventoryResupplyPolicy(insumo?.payload),
          ),
        };
      })
      .filter(({ lot, insumo, apresentacao }) => {
        if (!searchLower) return true;
        return [
          insumo?.nome ?? "",
          insumo?.categoria ?? "",
          apresentacao?.nome ?? "",
          apresentacao?.fabricante ?? "",
          lot.identificacao_lote ?? "",
          lot.fabricante ?? "",
          lot.local_armazenamento ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchLower);
      })
      .sort((a, b) =>
        (a.insumo?.nome ?? "").localeCompare(b.insumo?.nome ?? ""),
      );
  })();
  const categoryOptions = (() => {
    const categories = Array.from(new Set(lotRows.map((row) => row.category)));
    return categories.sort((a, b) => a.localeCompare(b));
  })();
  return { lotRows, categoryOptions };
}

// Category/type changes reuse the time-sensitive projection, as on the page.
export function buildInventoryViewModel(
  projection: InventoryProjection,
  { selectedCategory, selectedType }: InventoryRowFilters,
): InventoryViewModel {
  const { lotRows } = projection;
  const filteredLotRows = lotRows.filter(({ category, insumo }) => {
    const categoryMatches =
      selectedCategory === ALL_CATEGORIES_VALUE ||
      category === selectedCategory;
    const typeMatches =
      selectedType === ALL_TYPES_VALUE || insumo?.tipo === selectedType;
    return categoryMatches && typeMatches;
  });
  const filteredTotals = filteredLotRows.reduce(
    (totals, row) => ({
      saldo: totals.saldo + row.saldoOperacional,
      entradas: totals.entradas + row.movimentoPeriodo.entradas,
      saidas: totals.saidas + row.movimentoPeriodo.saidas,
    }),
    { saldo: 0, entradas: 0, saidas: 0 },
  );
  const filteredResupplyTotals = (() => {
    const byInsumo = new Map<string, InventoryResupplyEvaluation>();
    for (const row of filteredLotRows) {
      if (!row.insumo) continue;
      byInsumo.set(row.insumo.id, row.resupply);
    }

    return Array.from(byInsumo.values()).reduce(
      (acc, item) => {
        if (item.status !== "unconfigured") acc.configured += 1;
        if (item.status === "warning") acc.warning += 1;
        if (item.status === "critical") acc.critical += 1;
        return acc;
      },
      { configured: 0, warning: 0, critical: 0 },
    );
  })();
  return {
    ...projection,
    filteredLotRows,
    filteredTotals,
    filteredResupplyTotals,
  };
}
