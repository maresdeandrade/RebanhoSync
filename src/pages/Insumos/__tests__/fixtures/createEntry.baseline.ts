// Independent characterization reference from main@52a6ddbe8d92230d70bfcde0f88ef31beed679a9.
// Original blocks copied from handleCreateEntry; no imports of the new helpers.
import { convertPresentationQuantityToBase } from "@/lib/inventory/inventoryContracts";
import type { InventoryCostSummary } from "@/lib/inventory/inventoryFormPresets";
import type { OperationInput } from "@/lib/offline/types";
import type { EntryForm } from "../../types";
import { formatNumber } from "../../helpers/formatting";

type EntryFormValidation =
  | { error: string }
  | {
      quantidadePorApresentacao: number;
      quantidadeEntrada: number;
      quantidadeBase: number;
    };
type EntryCostPreparation =
  | { error: string }
  | {
      resolvedCustoTotal: number | null;
      resolvedCustoUnitario: number | null;
      resolvedCustoStatus: InventoryCostSummary["status"];
      resolvedOrigemCusto: EntryForm["origemCusto"];
    };
function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateBaselineFields({
  entryForm,
  entryRequiresVeterinaryProduct,
  noneValue,
}: {
  entryForm: Pick<
    EntryForm,
    | "nome"
    | "produtoVeterinarioId"
    | "quantidadePorApresentacao"
    | "quantidadeEntrada"
  >;
  entryRequiresVeterinaryProduct: boolean;
  noneValue: string;
}): EntryFormValidation {
  if (!entryForm.nome.trim()) {
    return { error: "Nome do insumo e obrigatorio." };
  }
  if (
    entryRequiresVeterinaryProduct &&
    entryForm.produtoVeterinarioId === noneValue
  ) {
    return {
      error:
        "Categoria sanitaria clinica exige produto veterinario catalogado.",
    };
  }

  const quantidadePorApresentacao = parsePositiveNumber(
    entryForm.quantidadePorApresentacao,
  );
  const quantidadeEntrada = parsePositiveNumber(entryForm.quantidadeEntrada);

  if (!quantidadePorApresentacao || !quantidadeEntrada) {
    return {
      error: "Quantidade de entrada e apresentacao devem ser maiores que zero.",
    };
  }

  const quantidadeBase = convertPresentationQuantityToBase({
    presentationQuantity: quantidadeEntrada,
    presentationBaseQuantity: quantidadePorApresentacao,
  });

  return { quantidadePorApresentacao, quantidadeEntrada, quantidadeBase };
}

export function prepareBaselineCosts({
  entryForm,
  entryCostSummary,
}: {
  entryForm: Pick<
    EntryForm,
    "costMode" | "custoTotal" | "custoUnitario" | "origemCusto"
  >;
  entryCostSummary: InventoryCostSummary;
}): EntryCostPreparation {
  if (entryForm.costMode === "custo_total" && entryForm.custoTotal.trim()) {
    const parsedCustoTotal = Number(entryForm.custoTotal.replace(",", "."));
    if (!Number.isFinite(parsedCustoTotal) || parsedCustoTotal < 0) {
      return { error: "Custo total informado e invalido." };
    }
  }
  if (
    entryForm.costMode === "custo_unitario" &&
    entryForm.custoUnitario.trim()
  ) {
    const parsedCustoUnitario = Number(
      entryForm.custoUnitario.replace(",", "."),
    );
    if (!Number.isFinite(parsedCustoUnitario) || parsedCustoUnitario < 0) {
      return { error: "Custo por entrada informado e invalido." };
    }
  }

  const resolvedCustoTotal = entryCostSummary.custoTotal;
  const resolvedCustoUnitario = entryCostSummary.custoUnitarioBase;
  const resolvedCustoStatus = entryCostSummary.status;
  const resolvedOrigemCusto =
    resolvedCustoStatus === "informado"
      ? entryForm.origemCusto === "ausente"
        ? "manual"
        : entryForm.origemCusto
      : "ausente";

  return {
    resolvedCustoTotal,
    resolvedCustoUnitario,
    resolvedCustoStatus,
    resolvedOrigemCusto,
  };
}

type EntryOperationInput = {
  entryForm: EntryForm;
  quantities: Exclude<
    ReturnType<typeof validateBaselineFields>,
    { error: string }
  >;
  costs: Exclude<ReturnType<typeof prepareBaselineCosts>, { error: string }>;
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
export function buildBaselineOperations({
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

export function planBaselineEntry(input: {
  entryForm: EntryForm;
  entryCostSummary: InventoryCostSummary;
  entryRequiresVeterinaryProduct: boolean;
  noneValue: string;
  resolvedEntryPresentationName: string;
  generated: {
    now: string;
    insumoId: string;
    apresentacaoId: string;
    loteId: string;
    movimentoId: string;
  };
}): { error: string } | OperationInput[] {
  const quantities = validateBaselineFields(input);
  if ("error" in quantities) return quantities;
  const costs = prepareBaselineCosts(input);
  if ("error" in costs) return costs;
  return buildBaselineOperations({ ...input, quantities, costs });
}
