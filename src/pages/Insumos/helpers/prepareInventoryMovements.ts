import {
  evaluateInventoryLotManualMovement,
  evaluateInventoryLotConsumption,
} from "@/lib/inventory/inventoryContracts";
import {
  buildInventoryCostSnapshot,
  type InventoryCostSnapshot,
} from "@/lib/inventory/costing";
import type { InsumoLote } from "@/lib/offline/types";
import type { ManualMovementForm, ConsumptionForm } from "../types";

type MovementLot = Pick<
  InsumoLote,
  "id" | "saldo_atual_base" | "unidade_base" | "status" | "deleted_at"
>;
type QuantityResult = { error: string } | { quantidadeBase: number };
type ConsumptionResult =
  | { error: string }
  | { quantidadeBase: number; costSnapshot: InventoryCostSnapshot };

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateManualMovement({
  manualMovementForm,
  selectedManualMovementLot,
  selectedManualMovementLotBalance,
}: {
  manualMovementForm: Pick<ManualMovementForm, "tipo" | "quantidadeBase">;
  selectedManualMovementLot: MovementLot;
  selectedManualMovementLotBalance: number | null;
}): QuantityResult {
  const quantidadeBase = parsePositiveNumber(manualMovementForm.quantidadeBase);
  if (!quantidadeBase) {
    return { error: "Quantidade da movimentacao deve ser maior que zero." };
  }

  const saldoAtualBase =
    selectedManualMovementLotBalance ??
    selectedManualMovementLot.saldo_atual_base;
  const movementCheck = evaluateInventoryLotManualMovement({
    lot: {
      ...selectedManualMovementLot,
      saldo_atual_base: saldoAtualBase,
    },
    tipo: manualMovementForm.tipo,
    quantidadeBase,
    unidadeBase: selectedManualMovementLot.unidade_base,
  });

  if (!movementCheck.canRegister) {
    return { error: movementCheck.reason };
  }

  return { quantidadeBase };
}

export function prepareConsumption({
  consumptionForm,
  selectedLot,
  selectedLotBalance,
}: {
  consumptionForm: Pick<ConsumptionForm, "quantidadeBase">;
  selectedLot: MovementLot &
    Pick<
      InsumoLote,
      "custo_unitario" | "custo_total" | "quantidade_inicial_base"
    >;
  selectedLotBalance: number | null;
}): ConsumptionResult {
  const quantidadeBase = parsePositiveNumber(consumptionForm.quantidadeBase);
  if (!quantidadeBase) {
    return { error: "Quantidade de consumo deve ser maior que zero." };
  }

  const saldoAtualBase = selectedLotBalance ?? selectedLot.saldo_atual_base;
  const lotCheck = evaluateInventoryLotConsumption({
    lot: { ...selectedLot, saldo_atual_base: saldoAtualBase },
    quantidadeBase,
    unidadeBase: selectedLot.unidade_base,
  });

  if (!lotCheck.canConsume) {
    return { error: lotCheck.reason };
  }

  const costSnapshot = buildInventoryCostSnapshot({
    lot: selectedLot,
    quantidadeBase,
  });

  return { quantidadeBase, costSnapshot };
}
