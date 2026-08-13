export interface CommercialFinanceRow {
  id: string;
  operationType: string;
  scope: string;
  occurredAt: string;
  lote: string;
  quantidade: number;
  animals: string[];
  contraparte: string;
  valorBruto: number | null;
  valorLiquido: number | null;
  financeTransactionId: string | null;
}

export function buildCommercialFinanceRows(input: {
  events: Array<{ id: string }>;
  details: Array<{
    evento_id: string;
    operation_type: string;
    scope: string;
    occurred_at: string;
    lote_id: string | null;
    quantidade_animais: number;
    animal_ids: string[] | null;
    contraparte_nome: string | null;
    valor_bruto: number | null;
    valor_liquido_derivado: number | null;
    finance_transaction_id: string | null;
  }>;
  lots: Array<{ id: string; nome: string }>;
}): CommercialFinanceRow[] {
  const eventIds = new Set(input.events.map((event) => event.id));
  const lotNames = new Map(input.lots.map((lot) => [lot.id, lot.nome]));
  return input.details
    .filter((detail) => eventIds.has(detail.evento_id))
    .map((detail) => ({
      id: detail.evento_id,
      operationType: detail.operation_type,
      scope: detail.scope,
      occurredAt: detail.occurred_at,
      lote: detail.lote_id
        ? (lotNames.get(detail.lote_id) ?? detail.lote_id)
        : "Sem lote",
      quantidade: detail.animal_ids?.length ?? detail.quantidade_animais,
      animals: detail.animal_ids ?? [],
      contraparte: detail.contraparte_nome ?? "Sem contraparte",
      valorBruto: detail.valor_bruto,
      valorLiquido: detail.valor_liquido_derivado,
      financeTransactionId: detail.finance_transaction_id,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
