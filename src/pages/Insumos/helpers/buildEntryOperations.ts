import type { OperationInput } from "@/lib/offline/types";
import type { EntryForm } from "../types";
import { formatNumber } from "./formatting";
import type { validateEntryForm } from "./validateEntryForm";
import type { prepareEntryCosts } from "./prepareEntryCosts";

type EntryOperationInput = {
  entryForm: EntryForm;
  quantities: Exclude<ReturnType<typeof validateEntryForm>, { error: string }>;
  costs: Exclude<ReturnType<typeof prepareEntryCosts>, { error: string }>;
  resolvedEntryPresentationName: string;
  noneValue: string;
  generated: {
    now: string;
    insumoId: string;
    apresentacaoId: string;
    loteId: string;
    movimentoId: string;
  };
};

export function buildEntryOperations({
  entryForm,
  quantities,
  costs,
  resolvedEntryPresentationName,
  noneValue,
  generated,
}: EntryOperationInput): OperationInput[] {
  const { quantidadePorApresentacao, quantidadeEntrada, quantidadeBase } =
    quantities;
  const {
    resolvedCustoTotal,
    resolvedCustoUnitario,
    resolvedCustoStatus,
    resolvedOrigemCusto,
  } = costs;
  const { now, insumoId, apresentacaoId, loteId, movimentoId } = generated;
  return [
    {
      table: "insumos",
      action: "INSERT",
      record: {
        id: insumoId,
        nome: entryForm.nome.trim(),
        tipo: entryForm.tipo,
        categoria: entryForm.categoria.trim() || null,
        produto_veterinario_id:
          entryForm.tipo === "sanitario" &&
          entryForm.produtoVeterinarioId !== noneValue
            ? entryForm.produtoVeterinarioId
            : null,
        unidade_base: entryForm.unidadeBase,
        ativo: true,
        payload: { origem: "inventario_ui_mvp" },
      },
    },
    {
      table: "insumo_apresentacoes",
      action: "INSERT",
      record: {
        id: apresentacaoId,
        insumo_id: insumoId,
        nome:
          resolvedEntryPresentationName ||
          `${entryForm.unidadeCompra} ${formatNumber(quantidadePorApresentacao)} ${entryForm.unidadeBase}`,
        unidade_compra: entryForm.unidadeCompra,
        quantidade_base: quantidadePorApresentacao,
        unidade_base: entryForm.unidadeBase,
        codigo_barras: null,
        fabricante: entryForm.fabricante.trim() || null,
        payload: { origem: "inventario_ui_mvp" },
      },
    },
    {
      table: "insumo_lotes",
      action: "INSERT",
      record: {
        id: loteId,
        insumo_id: insumoId,
        apresentacao_id: apresentacaoId,
        identificacao_lote: entryForm.identificacaoLote.trim() || null,
        validade: entryForm.validade || null,
        fabricante: entryForm.fabricante.trim() || null,
        local_armazenamento: entryForm.localArmazenamento.trim() || null,
        quantidade_inicial_base: quantidadeBase,
        saldo_atual_base: 0,
        unidade_base: entryForm.unidadeBase,
        status: "ativo",
        custo_total: resolvedCustoTotal,
        custo_unitario: resolvedCustoUnitario,
        payload: {
          origem: "inventario_ui_mvp",
          custo_status: resolvedCustoStatus,
          origem_custo: resolvedOrigemCusto,
          finance_transaction_id: null,
          custo_total_informado:
            entryForm.costMode === "custo_total"
              ? entryForm.custoTotal.trim() || null
              : null,
          custo_unitario_informado:
            entryForm.costMode === "custo_unitario"
              ? entryForm.custoUnitario.trim() || null
              : null,
        },
      },
    },
    {
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: movimentoId,
        insumo_id: insumoId,
        insumo_lote_id: loteId,
        tipo: "entrada",
        quantidade_base: quantidadeBase,
        unidade_base: entryForm.unidadeBase,
        occurred_at: now,
        source_evento_id: null,
        source_evento_dominio: null,
        animal_id: null,
        rebanho_lote_id: null,
        pasto_id: null,
        observacoes: "Entrada inicial",
        custo_unitario_snapshot: resolvedCustoUnitario,
        custo_total_snapshot: resolvedCustoTotal,
        payload: {
          origem: "inventario_ui_mvp",
          quantidade_apresentacoes: quantidadeEntrada,
          unidade_compra: entryForm.unidadeCompra,
          quantidade_por_apresentacao: quantidadePorApresentacao,
          custo_status: resolvedCustoStatus,
          origem_custo: resolvedOrigemCusto,
        },
      },
    },
  ];
}
