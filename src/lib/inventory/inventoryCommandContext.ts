import type { OperationInput } from "@/lib/offline/types";

// Ephemeral command identity derived exclusively from the current AuthProvider.
export type InventoryCommandContext = {
  farmId: string | null;
  userId: string | null;
  role: string | null;
  authenticated: boolean;
};
function isConsumption(op: OperationInput) {
  return (
    op.table === "insumo_movimentacoes" &&
    ["consumo_sanitario", "consumo_nutricao"].includes(String(op.record.tipo))
  );
}
function canWrite(context: InventoryCommandContext, ops: OperationInput[]) {
  if (context.role === "owner" || context.role === "manager") return true;
  return context.role === "cowboy" && ops.every(isConsumption);
}
export function assertInventoryCommandContext(
  captured: InventoryCommandContext,
  current: InventoryCommandContext | null,
  farmId: string,
  ops: OperationInput[],
) {
  if (
    current !== captured ||
    !captured.authenticated ||
    !captured.userId ||
    captured.farmId !== farmId ||
    !farmId
  ) {
    throw new Error("INVENTORY_CONTEXT_CHANGED");
  }
  if (!canWrite(captured, ops)) throw new Error("INVENTORY_ROLE_UNAVAILABLE");
}
