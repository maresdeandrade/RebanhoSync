import { db } from "@/lib/offline/db";
import { getLocalStoreName } from "@/lib/offline/tableMap";
import type { OperationInput } from "@/lib/offline/types";

const inventoryTables = new Set([
  "insumos",
  "insumo_apresentacoes",
  "insumo_lotes",
  "insumo_movimentacoes",
]);
const references = [
  ["insumo_id", "insumos"],
  ["apresentacao_id", "insumo_apresentacoes"],
  ["insumo_lote_id", "insumo_lotes"],
  ["source_evento_id", "eventos"],
] as const;
function inventoryOps(ops: OperationInput[]) {
  return ops.filter((op) => inventoryTables.has(op.table));
}
function assertFarm(record: Record<string, unknown>, farmId: string) {
  if (record.fazenda_id !== farmId)
    throw new Error("INVENTORY_ENTITY_FARM_MISMATCH");
}
export function getInventoryFarmContextStores(ops: OperationInput[]) {
  return inventoryOps(ops).length
    ? [...inventoryTables, "eventos"].map((table) =>
        db.table(getLocalStoreName(table)),
      )
    : [];
}
async function assertReference(
  table: string,
  id: unknown,
  farmId: string,
  ops: OperationInput[],
) {
  if (id == null) return;
  const existing = await db.table(getLocalStoreName(table)).get(id as string);
  if (existing) {
    assertFarm(existing, farmId);
    return;
  }
  const planned = ops.find(
    (op) => op.table === table && op.action === "INSERT" && op.record.id === id,
  );
  if (!planned) throw new Error("INVENTORY_REFERENCE_UNAVAILABLE");
  if (planned.record.fazenda_id != null) assertFarm(planned.record, farmId);
}
// Runs in createGesture's existing transaction, before any queue/local mutation.
export async function assertInventoryFarmContext(
  farmId: string,
  ops: OperationInput[],
) {
  for (const op of inventoryOps(ops)) {
    if (op.record.fazenda_id != null) assertFarm(op.record, farmId);
    const existing = await db
      .table(getLocalStoreName(op.table))
      .get(op.record.id as string);
    if (existing) assertFarm(existing, farmId);
    if (!existing && op.action !== "INSERT")
      throw new Error("INVENTORY_ENTITY_UNAVAILABLE");
    const record = { ...existing, ...op.record };
    for (const [field, table] of references)
      await assertReference(table, record[field], farmId, ops);
  }
}
