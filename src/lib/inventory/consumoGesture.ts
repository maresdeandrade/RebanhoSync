import type { OperationInput, InsumoUnidadeBaseEnum, InsumoLote } from "@/lib/offline/types";
import { buildInventoryCostSnapshot } from "./costing";

export interface BuildConsumoMovimentacaoOpInput {
  eventId: string;
  dominio: "sanitario" | "nutricao";
  insumoId: string;
  insumoLoteId: string;
  quantidadeBase: number;
  unidadeBase: InsumoUnidadeBaseEnum;
  occurredAt: string;
  lotRef?: Pick<InsumoLote, "custo_unitario" | "custo_total" | "quantidade_inicial_base"> | null;
  animalId?: string | null;
  loteId?: string | null;
  pastoId?: string | null;
  observacoes?: string | null;
}

/**
 * Cria a operacao de INSERT na tabela insumo_movimentacoes associada a uma baixa assistida no evento.
 */
export function buildConsumoMovimentacaoOp(input: BuildConsumoMovimentacaoOpInput): OperationInput {
  const {
    eventId,
    dominio,
    insumoId,
    insumoLoteId,
    quantidadeBase,
    unidadeBase,
    occurredAt,
    lotRef,
    animalId,
    loteId,
    pastoId,
    observacoes,
  } = input;

  if (!eventId) throw new Error("Consumo de estoque exige vinculo com evento (eventId nao informado).");
  if (!insumoId) throw new Error("Consumo de estoque exige insumo associado.");
  if (!insumoLoteId) throw new Error("Consumo de estoque exige lote associado.");
  if (!quantidadeBase || quantidadeBase <= 0) {
    throw new Error("Quantidade de consumo de estoque deve ser maior que zero.");
  }

  const tipo = dominio === "sanitario" ? "consumo_sanitario" : "consumo_nutricao";

  // Calcular custos de snapshot usando o helper centralizado
  const costSnapshot = buildInventoryCostSnapshot({
    lot: lotRef,
    quantidadeBase,
  });

  return {
    table: "insumo_movimentacoes",
    action: "INSERT",
    record: {
      id: eventId,
      insumo_id: insumoId,
      insumo_lote_id: insumoLoteId,
      tipo,
      quantidade_base: quantidadeBase,
      unidade_base: unidadeBase,
      occurred_at: occurredAt,
      source_evento_id: eventId,
      source_evento_dominio: dominio,
      animal_id: animalId || null,
      rebanho_lote_id: loteId || null,
      pasto_id: pastoId || null,
      observacoes: observacoes || null,
      custo_unitario_snapshot: costSnapshot.custo_unitario_snapshot,
      custo_total_snapshot: costSnapshot.custo_total_snapshot,
      payload: {
        origem_movimentacao: "baixa_automatica_evento",
        custo_status: costSnapshot.custo_status,
        ...(costSnapshot.limitacoes.length > 0 ? { limitacoes: costSnapshot.limitacoes } : {}),
      },
    },
  };
}
