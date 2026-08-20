import type { Evento, EventoComercial } from "@/lib/offline/types";
import {
  isCommercialOperationV2,
  isCommercialSimulation,
} from "@/lib/finance/classification";

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

type CommercialFinanceDetail = Pick<
  EventoComercial,
  | "evento_id"
  | "operation_type"
  | "scope"
  | "occurred_at"
  | "lote_id"
  | "quantidade_animais"
  | "animal_ids"
  | "contraparte_nome"
  | "valor_bruto"
  | "valor_liquido_derivado"
  | "finance_transaction_id"
  | "snapshot"
>;

export function buildCommercialFinanceRows(input: {
  events: Array<Pick<Evento, "id" | "dominio" | "payload">>;
  details: CommercialFinanceDetail[];
  lots: Array<{ id: string; nome: string }>;
}): CommercialFinanceRow[] {
  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const lotNames = new Map(input.lots.map((lot) => [lot.id, lot.nome]));
  return input.details
    .filter((detail) => {
      const event = eventById.get(detail.evento_id);
      return (
        Boolean(event) &&
        event.dominio === "comercial" &&
        isCommercialOperationV2(event as Evento) &&
        !isCommercialSimulation(event as Evento, detail as EventoComercial)
      );
    })
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
