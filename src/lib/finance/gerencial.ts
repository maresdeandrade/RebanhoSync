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

export interface FinanceTemporalSummary extends FinanceGerencialSummary {
  entradasCompetencia: number;
  saidasCompetencia: number;
  vencidosAPagar: number;
  vencidosAReceber: number;
}

const VALID_DIRECTIONS = new Set(["entrada", "saida"]);
const VALID_STATUSES = new Set(["previsto", "realizado", "cancelado"]);
const VALID_COST_CENTER_TYPES = new Set(["fazenda", "animal", "lote", "pasto"]);
const VALID_ALLOCATION_METHODS = new Set([
  "direto",
  "por_cabeca",
  "por_peso_vivo",
  "por_dias",
  "por_area",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isValidDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(new Date(value).getTime())
  );
}

/**
 * Preserva a distinção entre ausência, valor inválido e zero na entrada textual.
 * A validação de domínio continua responsável por rejeitar NaN e valores semânticos inválidos.
 */
export function parseOptionalFinanceNumber(value: string): number | undefined {
  const normalized = value.trim();
  return normalized === "" ? undefined : Number(normalized);
}

/**
 * Valida uma transação financeira gerencial sem normalizar valores inválidos para zero.
 */
export function validateFinanceTransaction(
  tx: Partial<FinanceTransaction>,
): string[] {
  const issues: string[] = [];

  if (!tx.fazenda_id) {
    issues.push("fazenda_id é obrigatório.");
  }

  if (!tx.category_id) {
    issues.push("category_id é obrigatório.");
  }

  if (!tx.occurred_at) {
    issues.push("occurred_at é obrigatório.");
  } else if (!isValidDateTime(tx.occurred_at)) {
    issues.push("occurred_at deve ser uma data válida.");
  }

  if (!VALID_DIRECTIONS.has(tx.direction)) {
    issues.push("direction deve ser 'entrada' ou 'saida'.");
  }

  if (tx.valor_total === undefined || tx.valor_total === null) {
    issues.push("valor_total é obrigatório.");
  } else if (!isFiniteNumber(tx.valor_total)) {
    issues.push("valor_total deve ser um número finito.");
  } else if (tx.valor_total <= 0) {
    issues.push("valor_total deve ser estritamente positivo (maior que zero).");
  }

  if (tx.status !== undefined && !VALID_STATUSES.has(tx.status)) {
    issues.push("status deve ser 'previsto', 'realizado' ou 'cancelado'.");
  }

  if (tx.quantidade !== undefined && tx.quantidade !== null) {
    if (!isFiniteNumber(tx.quantidade)) {
      issues.push("quantidade deve ser um número finito.");
    } else if (tx.quantidade <= 0) {
      issues.push(
        "quantidade deve ser estritamente positiva quando informada.",
      );
    }
  }

  if (tx.valor_unitario !== undefined && tx.valor_unitario !== null) {
    if (!isFiniteNumber(tx.valor_unitario)) {
      issues.push("valor_unitario deve ser um número finito.");
    } else if (tx.valor_unitario < 0) {
      issues.push("valor_unitario não pode ser negativo.");
    }
  }

  if (
    tx.centro_custo_tipo !== undefined &&
    tx.centro_custo_tipo !== null &&
    !VALID_COST_CENTER_TYPES.has(tx.centro_custo_tipo)
  ) {
    issues.push("centro_custo_tipo inválido.");
  }

  if (
    tx.rateio_metodo !== undefined &&
    tx.rateio_metodo !== null &&
    !VALID_ALLOCATION_METHODS.has(tx.rateio_metodo)
  ) {
    issues.push("rateio_metodo inválido.");
  }

  return issues;
}

function isActiveRealizedTransaction(tx: FinanceTransaction): boolean {
  return (
    !tx.deleted_at &&
    tx.status === "realizado" &&
    isPositiveFiniteNumber(tx.valor_total)
  );
}

function isActiveTransactionWithValidValue(tx: FinanceTransaction): boolean {
  return (
    !tx.deleted_at &&
    tx.status !== "cancelado" &&
    isPositiveFiniteNumber(tx.valor_total)
  );
}

/**
 * Calcula o sumário gerencial separando explicitamente realizados e previstos.
 * Transações canceladas, excluídas ou com valor inválido não participam dos agregados.
 */
export function calculateGerencialSummary(
  transactions: FinanceTransaction[],
): FinanceGerencialSummary {
  const temporal = calculateGerencialTemporalSummary(transactions);
  return {
    entradasRealizadas: temporal.entradasRealizadas,
    saidasRealizadas: temporal.saidasRealizadas,
    saldoRealizado: temporal.saldoRealizado,
    previstosAPagar: temporal.previstosAPagar,
    previstosAReceber: temporal.previstosAReceber,
  };
}

export function calculateGerencialTemporalSummary(
  transactions: FinanceTransaction[],
  referenceDate = new Date(),
): FinanceTemporalSummary {
  const today = referenceDate.toISOString().slice(0, 10);
  let entradasRealizadas = 0;
  let saidasRealizadas = 0;
  let entradasCompetencia = 0;
  let saidasCompetencia = 0;
  let previstosAPagar = 0;
  let previstosAReceber = 0;
  let vencidosAPagar = 0;
  let vencidosAReceber = 0;

  for (const tx of transactions) {
    if (!isActiveTransactionWithValidValue(tx)) continue;
    const valor = tx.valor_total;

    if (tx.status === "realizado") {
      if (tx.paid_at) {
        if (tx.direction === "entrada") entradasRealizadas += valor;
        else if (tx.direction === "saida") saidasRealizadas += valor;
      }
      if (tx.competence_date) {
        if (tx.direction === "entrada") entradasCompetencia += valor;
        else if (tx.direction === "saida") saidasCompetencia += valor;
      }
      continue;
    }

    if (tx.status !== "previsto") continue;
    if (tx.direction === "entrada") previstosAReceber += valor;
    else if (tx.direction === "saida") previstosAPagar += valor;

    if (tx.due_date && tx.due_date < today) {
      if (tx.direction === "entrada") vencidosAReceber += valor;
      else if (tx.direction === "saida") vencidosAPagar += valor;
    }
    if (tx.competence_date) {
      if (tx.direction === "entrada") entradasCompetencia += valor;
      else if (tx.direction === "saida") saidasCompetencia += valor;
    }
  }

  return {
    entradasRealizadas,
    saidasRealizadas,
    saldoRealizado: entradasRealizadas - saidasRealizadas,
    previstosAPagar,
    previstosAReceber,
    entradasCompetencia,
    saidasCompetencia,
    vencidosAPagar,
    vencidosAReceber,
  };
}

/**
 * Agrupa transações realizadas por categoria financeira.
 */
export function groupGerencialByCategory(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
): Record<string, number> {
  const categoryMap = new Map(categories.map((c) => [c.id, c.nome]));
  const groups: Record<string, number> = {};

  for (const tx of transactions) {
    if (!isActiveRealizedTransaction(tx)) {
      continue;
    }
    const catNome = categoryMap.get(tx.category_id) || "Sem Categoria";
    groups[catNome] = (groups[catNome] ?? 0) + tx.valor_total;
  }

  return groups;
}

/**
 * Agrupa transações realizadas por contraparte.
 */
export function groupGerencialByContraparte(
  transactions: FinanceTransaction[],
  contrapartes: Contraparte[],
): Record<string, number> {
  const counterpartMap = new Map(contrapartes.map((c) => [c.id, c.nome]));
  const groups: Record<string, number> = {};

  for (const tx of transactions) {
    if (!isActiveRealizedTransaction(tx)) {
      continue;
    }
    const cpNome = tx.contraparte_id
      ? counterpartMap.get(tx.contraparte_id) || "Sem parceiro"
      : "Sem parceiro";
    groups[cpNome] = (groups[cpNome] ?? 0) + tx.valor_total;
  }

  return groups;
}

/**
 * Agrupa transações realizadas por centro de custo.
 */
export function groupGerencialByCentroCusto(
  transactions: FinanceTransaction[],
): Record<string, number> {
  const groups: Record<string, number> = {};

  for (const tx of transactions) {
    if (!isActiveRealizedTransaction(tx)) {
      continue;
    }
    const ccKey = tx.centro_custo_tipo
      ? `${tx.centro_custo_tipo}${tx.centro_custo_id ? `:${tx.centro_custo_id}` : ""}`
      : "Geral Fazenda";
    groups[ccKey] = (groups[ccKey] ?? 0) + tx.valor_total;
  }

  return groups;
}
