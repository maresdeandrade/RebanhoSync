import type { InsumoLote, OperationInput } from "@/lib/offline/types";
import type { InventoryCostSnapshot } from "@/lib/inventory/costing";
import type {
  ConsumptionForm,
  ManualMovementForm,
  SourceOption,
} from "../types";

type MovementIdentity = {
  id: string;
  occurredAt: string;
  quantidadeBase: number;
};
type MovementLot = Pick<InsumoLote, "id" | "insumo_id" | "unidade_base">;

export function buildManualMovementOperations({
  id,
  occurredAt,
  quantidadeBase,
  manualMovementForm,
  selectedManualMovementLot,
}: MovementIdentity & {
  manualMovementForm: Pick<ManualMovementForm, "tipo" | "observacoes">;
  selectedManualMovementLot: MovementLot;
}): OperationInput[] {
  return [
    {
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: id,
        insumo_id: selectedManualMovementLot.insumo_id,
        insumo_lote_id: selectedManualMovementLot.id,
        tipo: manualMovementForm.tipo,
        quantidade_base: quantidadeBase,
        unidade_base: selectedManualMovementLot.unidade_base,
        occurred_at: occurredAt,
        source_evento_id: null,
        source_evento_dominio: null,
        animal_id: null,
        rebanho_lote_id: null,
        pasto_id: null,
        observacoes: manualMovementForm.observacoes.trim() || null,
        payload: {
          origem: "inventario_ui_mvp",
          fluxo: "movimentacao_manual",
        },
      },
    },
  ];
}

export function buildConsumptionOperations({
  id,
  occurredAt,
  quantidadeBase,
  costSnapshot,
  consumptionForm,
  selectedLot,
  selectedSource,
}: MovementIdentity & {
  costSnapshot: InventoryCostSnapshot;
  consumptionForm: Pick<ConsumptionForm, "observacoes">;
  selectedLot: MovementLot;
  selectedSource: Pick<
    SourceOption,
    "dominio" | "eventoId" | "animalId" | "rebanhoLoteId" | "pastoId"
  >;
}): OperationInput[] {
  return [
    {
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: id,
        insumo_id: selectedLot.insumo_id,
        insumo_lote_id: selectedLot.id,
        tipo:
          selectedSource.dominio === "sanitario"
            ? "consumo_sanitario"
            : "consumo_nutricao",
        quantidade_base: quantidadeBase,
        unidade_base: selectedLot.unidade_base,
        occurred_at: occurredAt,
        source_evento_id: selectedSource.eventoId,
        source_evento_dominio: selectedSource.dominio,
        animal_id: selectedSource.animalId,
        rebanho_lote_id: selectedSource.rebanhoLoteId,
        pasto_id: selectedSource.pastoId,
        observacoes: consumptionForm.observacoes.trim() || null,
        custo_unitario_snapshot: costSnapshot.custo_unitario_snapshot,
        custo_total_snapshot: costSnapshot.custo_total_snapshot,
        payload: {
          origem: "inventario_ui_mvp",
          custo_status: costSnapshot.custo_status,
          ...(costSnapshot.limitacoes.length > 0
            ? { limitacoes: costSnapshot.limitacoes }
            : {}),
        },
      },
    },
  ];
}
