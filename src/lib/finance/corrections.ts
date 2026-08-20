import type { FinanceTransaction, OperationInput } from "@/lib/offline/types";

export const FINANCE_REVERSAL_MARKER = "rebanhosync.finance_reversal.v1";

type FinanceReversalPayload = {
  marker: typeof FINANCE_REVERSAL_MARKER;
  original_transaction_id: string;
  reason: string;
};

import { sha256Sync } from "./sha256";

export function getFinanceReversalId(originalTransactionId: string): string {
  const hash = sha256Sync(`finance-reversal:${originalTransactionId}`);
  const chars = hash.split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x03) | 0x08).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

export function parseFinanceReversal(
  observacoes: string | null | undefined,
): FinanceReversalPayload | null {
  if (!observacoes) return null;
  try {
    const parsed = JSON.parse(observacoes) as Partial<FinanceReversalPayload>;
    if (
      parsed.marker !== FINANCE_REVERSAL_MARKER ||
      typeof parsed.original_transaction_id !== "string" ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return parsed as FinanceReversalPayload;
  } catch {
    return null;
  }
}

export function validateFinanceReversal(
  original: FinanceTransaction,
  existingTransactions: readonly FinanceTransaction[] = [],
): string[] {
  const issues: string[] = [];
  if (original.status !== "realizado") {
    issues.push("Somente lançamentos realizados podem ser estornados.");
  }
  if (original.deleted_at) {
    issues.push("Lançamento excluído não pode ser estornado.");
  }
  if (!Number.isFinite(original.valor_total) || original.valor_total <= 0) {
    issues.push("O lançamento original precisa ter valor positivo e finito.");
  }
  const previousReversal = existingTransactions.find(
    (transaction) =>
      (transaction.reverses_transaction_id === original.id ||
        parseFinanceReversal(transaction.observacoes)?.original_transaction_id === original.id) &&
      !transaction.deleted_at,
  );
  if (previousReversal) {
    issues.push("Este lançamento já possui estorno registrado.");
  }
  return issues;
}

export function buildFinanceReversalOperation(input: {
  original: FinanceTransaction;
  occurredAt: string;
  reason: string;
  existingTransactions?: readonly FinanceTransaction[];
}): OperationInput {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Informe o motivo do estorno.");
  const issues = validateFinanceReversal(
    input.original,
    input.existingTransactions,
  );
  if (issues.length > 0) throw new Error(issues[0]);

  const reversalId = getFinanceReversalId(input.original.id);
  const payload: FinanceReversalPayload = {
    marker: FINANCE_REVERSAL_MARKER,
    original_transaction_id: input.original.id,
    reason,
  };
  const occurredAt = new Date(input.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error("A data do estorno deve ser válida.");
  }

  return {
    table: "finance_transactions",
    action: "INSERT",
    record: {
      id: reversalId,
      fazenda_id: input.original.fazenda_id,
      occurred_at: occurredAt.toISOString(),
      competence_date: input.original.competence_date,
      due_date: null,
      paid_at: occurredAt.toISOString(),
      direction: input.original.direction === "entrada" ? "saida" : "entrada",
      status: "realizado",
      category_id: input.original.category_id,
      valor_total: input.original.valor_total,
      quantidade: input.original.quantidade,
      unidade: input.original.unidade,
      valor_unitario: input.original.valor_unitario,
      contraparte_id: input.original.contraparte_id,
      animal_id: input.original.animal_id,
      lote_id: input.original.lote_id,
      pasto_id: input.original.pasto_id,
      centro_custo_tipo: input.original.centro_custo_tipo,
      centro_custo_id: input.original.centro_custo_id,
      rateio_metodo: input.original.rateio_metodo,
      origem: "estorno",
      source_event_id: null,
      source_inventory_movement_id: null,
      observacoes: JSON.stringify(payload),
      reverses_transaction_id: input.original.id,
      deleted_at: null,
    },
  };
}
