import { db } from "./db";
import { reapplyOpLocal } from "./ops";
import type { Animal, Operation } from "./types";

function animalUpdateBeforeSnapshot(
  snapshot: Animal,
  op: Operation | undefined,
) {
  if (!op || op.table !== "animais" || op.action !== "UPDATE") return;
  if (
    op.record.id !== snapshot.id ||
    op.record.fazenda_id !== snapshot.fazenda_id
  )
    return;
  const before = op.before_snapshot as Animal | undefined;
  if (
    !before ||
    before.id !== snapshot.id ||
    before.fazenda_id !== snapshot.fazenda_id
  )
    return;
  return before;
}

function resolveAnimalRollbackSnapshot(
  snapshot: Animal,
  operations: ReadonlyMap<string, Operation>,
  rejectedIds: ReadonlySet<string>,
): Animal {
  const chain: Operation[] = [];
  const visited = new Set<string>();
  let base = snapshot;
  while (true) {
    const op = operations.get(base.client_op_id);
    const before = animalUpdateBeforeSnapshot(snapshot, op);
    if (!op || !before) break;
    if (visited.has(op.client_op_id))
      throw new Error("ANIMAL_ROLLBACK_CHAIN_CYCLE");
    visited.add(op.client_op_id);
    chain.push(op);
    base = before;
  }
  if (!chain.some((op) => rejectedIds.has(op.client_op_id))) return snapshot;
  for (const op of chain.reverse()) {
    if (!rejectedIds.has(op.client_op_id)) base = { ...base, ...op.record };
  }
  return base;
}

export async function preservePendingAnimalDeletesAfterRollback(
  fazendaId: string,
  rejectedOps: Operation[],
) {
  const animalIds = new Set<string>(
    rejectedOps
      .filter(
        (op) =>
          op.table === "animais" &&
          (op.action === "UPDATE" || op.action === "DELETE") &&
          op.record.fazenda_id === fazendaId,
      )
      .map((op) => op.record.id),
  );
  if (animalIds.size === 0) return;

  // Read and materialize inside the ACK transaction. Original queue snapshots
  // stay intact: a rejected UPDATE may later be accepted by an explicit retry.
  const queued = await db.queue_ops.toArray();
  const deletionAnimalIds = new Set<string>(
    queued
      .filter(
        (op) =>
          op.table === "animais" &&
          op.action === "DELETE" &&
          op.record.fazenda_id === fazendaId &&
          animalIds.has(op.record.id),
      )
      .map((op) => op.record.id),
  );
  if (deletionAnimalIds.size === 0) return;
  const operations = new Map(queued.map((op) => [op.client_op_id, op]));
  const rejectedIds = new Set([
    ...rejectedOps.map((op) => op.client_op_id),
    ...queued
      .filter((op) => op.sync_state === "REJECTED")
      .map((op) => op.client_op_id),
  ]);
  const pendingDeletes = queued.filter(
    (op) =>
      op.table === "animais" &&
      op.action === "DELETE" &&
      op.record.fazenda_id === fazendaId &&
      animalIds.has(op.record.id) &&
      !rejectedIds.has(op.client_op_id),
  );
  for (const animalId of animalIds) {
    if (!deletionAnimalIds.has(animalId)) continue;
    const restored = await db.state_animais.get(animalId);
    if (!restored || restored.fazenda_id !== fazendaId) continue;
    const resolved = resolveAnimalRollbackSnapshot(
      restored,
      operations,
      rejectedIds,
    );
    if (resolved !== restored) await db.state_animais.put(resolved);
  }
  for (const pending of pendingDeletes) await reapplyOpLocal(pending);
}
