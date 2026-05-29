import type {
  FinanceTransaction,
  FinanceCategory,
  Contraparte,
} from "@/lib/offline/types";

export interface FinanceGerencialSummary {
  entradasRealizadas: number;
  saidasRealizadas: number;
  saldoRealizado: number;
  previstosAPagar: number;
  previstosAReceber: number;
}

/**
 * Valida uma transação financeira gerencial de acordo com as regras rígidas da Fase 8.
 */
export function validateFinanceTransaction(tx: Partial<FinanceTransaction>): string[] {
  const issues: string[] = [];

  if (!tx.fazenda_id) {
    issues.push("fazenda_id é obrigatório.");
  }

  if (!tx.category_id) {
    issues.push("category_id é obrigatório.");
  }

  if (!tx.occurred_at) {
    issues.push("occurred_at é obrigatório.");
  }

  if (!tx.direction || (tx.direction !== "entrada" && tx.direction !== "saida")) {
    issues.push("direction deve ser 'entrada' ou 'saida'.");
  }

  if (tx.valor_total === undefined || tx.valor_total === null) {
    issues.push("valor_total é obrigatório.");
  } else if (tx.valor_total <= 0) {
    issues.push("valor_total deve ser estritamente positivo (maior que zero).");
  }

  if (tx.status && tx.status !== "previsto" && tx.status !== "realizado" && tx.status !== "cancelado") {
    issues.push("status deve ser 'previsto', 'realizado' ou 'cancelado'.");
  }

  if (tx.centro_custo_tipo) {
    if (!["fazenda", "animal", "lote", "pasto"].includes(tx.centro_custo_tipo)) {
      issues.push("centro_custo_tipo inválido.");
    }
  }

  if (tx.rateio_metodo) {
    if (!["direto", "por_cabeca", "por_peso_vivo", "por_dias", "por_area"].includes(tx.rateio_metodo)) {
      issues.push("rateio_metodo inválido.");
    }
  }

  return issues;
}

/**
 * Calcula o sumário gerencial de transações autorizadas para a Fase 8.
 * Desconsidera cancelados. Separa previstos e realizados.
 */
export function calculateGerencialSummary(transactions: FinanceTransaction[]): FinanceGerencialSummary {
  let entradasRealizadas = 0;
  let saidasRealizadas = 0;
  let previstosAPagar = 0;
  let previstosAReceber = 0;

  for (const tx of transactions) {
    if (tx.deleted_at || tx.status === "cancelado") {
      continue;
    }

    const valor = Number(tx.valor_total) || 0;

    if (tx.status === "realizado") {
      if (tx.direction === "entrada") {
        entradasRealizadas += valor;
      } else if (tx.direction === "saida") {
        saidasRealizadas += valor;
      }
    } else if (tx.status === "previsto") {
      if (tx.direction === "saida") {
        previstosAPagar += valor;
      } else if (tx.direction === "entrada") {
        previstosAReceber += valor;
      }
    }
  }

  return {
    entradasRealizadas,
    saidasRealizadas,
    saldoRealizado: entradasRealizadas - saidasRealizadas,
    previstosAPagar,
    previstosAReceber,
  };
}

/**
 * Agrupa transações realizadas por categoria financeira.
 */
export function groupGerencialByCategory(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[]
): Record<string, number> {
  const categoryMap = new Map(categories.map((c) => [c.id, c.nome]));
  const groups: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.deleted_at || tx.status === "cancelado") {
      continue;
    }
    const catNome = categoryMap.get(tx.category_id) || "Sem Categoria";
    groups[catNome] = (groups[catNome] || 0) + (Number(tx.valor_total) || 0);
  }

  return groups;
}

/**
 * Agrupa transações realizadas por contraparte.
 */
export function groupGerencialByContraparte(
  transactions: FinanceTransaction[],
  contrapartes: Contraparte[]
): Record<string, number> {
  const counterpartMap = new Map(contrapartes.map((c) => [c.id, c.nome]));
  const groups: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.deleted_at || tx.status === "cancelado") {
      continue;
    }
    const cpNome = tx.contraparte_id ? (counterpartMap.get(tx.contraparte_id) || "Sem parceiro") : "Sem parceiro";
    groups[cpNome] = (groups[cpNome] || 0) + (Number(tx.valor_total) || 0);
  }

  return groups;
}

/**
 * Agrupa transações realizadas por centro de custo.
 */
export function groupGerencialByCentroCusto(
  transactions: FinanceTransaction[]
): Record<string, number> {
  const groups: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.deleted_at || tx.status === "cancelado") {
      continue;
    }
    const ccKey = tx.centro_custo_tipo
      ? `${tx.centro_custo_tipo}${tx.centro_custo_id ? `:${tx.centro_custo_id}` : ""}`
      : "Geral Fazenda";
    groups[ccKey] = (groups[ccKey] || 0) + (Number(tx.valor_total) || 0);
  }

  return groups;
}
