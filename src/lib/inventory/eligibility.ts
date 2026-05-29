import type { InsumoLote } from "@/lib/offline/types";

export interface LotEligibilityResult {
  eligible: boolean;
  warning?: string;
  error?: string;
}

/**
 * Ordena os lotes usando a politica FEFO (First Expired, First Out) de forma pura:
 * - Lotes ativos e nao deletados primeiro.
 * - Lotes com validade definida vem antes de lotes sem validade.
 * - Lotes com menor validade (mais proximos do vencimento) vem primeiro.
 * - Criterio de desempate: ordem alfabetica do identificador do lote.
 */
export function sortLotsFEFO(lots: InsumoLote[]): InsumoLote[] {
  const activeLots = lots.filter(
    (l) => l.status === "ativo" && !l.deleted_at && l.saldo_atual_base > 0
  );

  return [...activeLots].sort((a, b) => {
    if (a.validade && b.validade) {
      if (a.validade !== b.validade) {
        return a.validade.localeCompare(b.validade);
      }
    } else if (a.validade) {
      return -1; // Com validade tem prioridade FEFO para consumo
    } else if (b.validade) {
      return 1;
    }

    // Desempate
    const idA = a.identificacao_lote || "";
    const idB = b.identificacao_lote || "";
    return idA.localeCompare(idB);
  });
}

/**
 * Sugere o melhor lote para consumo de acordo com a ordenacao FEFO.
 */
export function findSuggestedLot(lots: InsumoLote[]): InsumoLote | null {
  const sorted = sortLotsFEFO(lots);
  return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Valida se um lote especifico esta elegivel para o consumo desejado.
 * 
 * @param lot Lote a ser validado
 * @param quantityNeeded Quantidade base necessaria
 * @param currentDateStr Data atual em formato YYYY-MM-DD para checar vencimento
 */
export function validateLotEligibility(
  lot: InsumoLote | null | undefined,
  quantityNeeded: number,
  currentDateStr?: string
): LotEligibilityResult {
  if (!lot) {
    return {
      eligible: false,
      error: "Nenhum lote selecionado.",
    };
  }

  if (lot.deleted_at) {
    return {
      eligible: false,
      error: "O lote selecionado foi deletado.",
    };
  }

  if (lot.status !== "ativo") {
    return {
      eligible: false,
      error: `O lote selecionado nao esta ativo (Status: ${lot.status}).`,
    };
  }

  const result: LotEligibilityResult = { eligible: true };

  // 1. Validar saldo
  if (lot.saldo_atual_base < quantityNeeded) {
    result.eligible = false;
    result.error = `Saldo insuficiente no lote (${lot.saldo_atual_base} ${lot.unidade_base} disponivel, ${quantityNeeded} necessario).`;
    return result;
  }

  // 2. Validar vencimento
  if (lot.validade) {
    const today = currentDateStr || new Date().toISOString().split("T")[0];
    if (lot.validade < today) {
      result.warning = `Lote vencido em ${lot.validade}.`;
    }
  }

  return result;
}
