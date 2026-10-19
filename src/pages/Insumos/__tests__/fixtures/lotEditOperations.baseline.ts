// Independent reference copied from handleSaveLotEdit at
// ad07b9cc42a55fae95342ecc88fa3e4e5c72a2df (PR #205).
// Keep this frozen characterization reference independent of the new builder.
import { buildInventoryResupplyPayload } from "@/lib/inventory/resupplyPolicy";
import type {
  Insumo,
  InsumoApresentacao,
  InsumoLote,
  OperationInput,
} from "@/lib/offline/types";
import type { LotEditForm } from "../../types";
import type { resolveLotEditCosts } from "../../helpers/resolveLotEditCosts";

type LotEditOperationInput = {
  insumo: Pick<Insumo, "id" | "payload">;
  lot: Pick<InsumoLote, "id" | "payload">;
  apresentacao: Pick<InsumoApresentacao, "id" | "payload"> | undefined;
  editForm: LotEditForm;
  estoqueMinimoBase: number | null;
  pontoRessuprimentoBase: number | null;
  costResolution: Exclude<
    ReturnType<typeof resolveLotEditCosts>,
    { error: string }
  >;
};

export function buildBaselineLotEditOperations({
  insumo,
  lot,
  apresentacao,
  editForm,
  estoqueMinimoBase,
  pontoRessuprimentoBase,
  costResolution,
}: LotEditOperationInput): OperationInput[] {
  const {
    hasCustoTotal,
    hasCustoUnitario,
    resolvedCustoTotal,
    resolvedCustoUnitario,
    resolvedCustoStatus,
    resolvedOrigemCusto,
  } = costResolution;

  const ops: OperationInput[] = [
    {
      table: "insumos",
      action: "UPDATE" as const,
      record: {
        id: insumo.id,
        nome: editForm.insumoNome.trim(),
        categoria: editForm.categoria.trim() || null,
        ativo: editForm.ativo,
        payload: buildInventoryResupplyPayload(
          {
            ...insumo.payload,
            origem_ultima_edicao: "inventario_ui_cadastro",
          },
          {
            minimumStockBase: estoqueMinimoBase,
            reorderPointBase: pontoRessuprimentoBase,
          },
        ),
      },
    },
    {
      table: "insumo_lotes",
      action: "UPDATE" as const,
      record: {
        id: lot.id,
        identificacao_lote: editForm.identificacaoLote.trim() || null,
        validade: editForm.validade || null,
        fabricante: editForm.fabricante.trim() || null,
        local_armazenamento: editForm.localArmazenamento.trim() || null,
        status: editForm.status,
        custo_total: resolvedCustoTotal,
        custo_unitario: resolvedCustoUnitario,
        payload: {
          ...lot.payload,
          origem_ultima_edicao: "inventario_ui_cadastro",
          custo_status: resolvedCustoStatus,
          origem_custo: resolvedOrigemCusto,
          finance_transaction_id: lot.payload?.finance_transaction_id ?? null,
          custo_total_informado: hasCustoTotal
            ? editForm.custoTotal.trim()
            : null,
          custo_unitario_informado: hasCustoUnitario
            ? editForm.custoUnitario.trim()
            : null,
        },
      },
    },
  ];

  if (apresentacao && editForm.apresentacaoNome.trim()) {
    ops.splice(1, 0, {
      table: "insumo_apresentacoes",
      action: "UPDATE" as const,
      record: {
        id: apresentacao.id,
        nome: editForm.apresentacaoNome.trim(),
        fabricante: editForm.apresentacaoFabricante.trim() || null,
        payload: {
          ...apresentacao.payload,
          origem_ultima_edicao: "inventario_ui_cadastro",
        },
      },
    });
  }

  return ops;
}
