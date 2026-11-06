import { db } from "@/lib/offline/db";

/** Resume only the seed's single rejected animal update, never a CAS conflict. */
export async function resumeTestFarmMissingRevision(
  farmId: string,
  txId: string,
  validateContext: () => Promise<void>,
) {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture || gesture.fazenda_id !== farmId) throw new Error("TEST_FARM_TX_FARM_MISMATCH");
  if (gesture.status !== "REJECTED" || !gesture.last_error?.startsWith("STATE_EXPECTED_REVISION_REQUIRED:")) return;
  const operations = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
  const op = operations[0];
  if (operations.length !== 1 || op.table !== "animais" || op.action !== "UPDATE" ||
      op.sync_state !== "REJECTED" || op.expected_revision !== undefined ||
      typeof op.record.id !== "string" ||
      (op.record.fazenda_id !== undefined && op.record.fazenda_id !== farmId)) return;
  const rejections = await db.queue_rejections.where("client_tx_id").equals(txId).toArray();
  const rejection = rejections.find(row => row.client_op_id === op.client_op_id && row.fazenda_id === farmId &&
    row.table === "animais" && row.action === "UPDATE" && row.reason_code === "STATE_EXPECTED_REVISION_REQUIRED");
  if (!rejection) return;

  await validateContext();
  const { pullDataForFarm } = await import("@/lib/offline/pull");
  await pullDataForFarm(farmId, ["animais"], {
    mode: "merge", observations: { animais: { key: "id", ids: [op.record.id] } }, requiredAnimalIds: [op.record.id],
  });
  await validateContext();
  const animal = await db.state_animais.get(op.record.id);
  if (!animal || animal.fazenda_id !== farmId || animal.deleted_at ||
      !Number.isSafeInteger(animal.revision) || Number(animal.revision) < 1) {
    throw new Error("TEST_FARM_REVISION_SNAPSHOT_REQUIRED");
  }
  const { retryRejectedOperation } = await import("@/lib/offline/ops");
  await validateContext();
  await retryRejectedOperation(rejection);
}

export function matchesPersistedSeedCalf(calf: object, expected: Record<string, unknown>) {
  const record = calf as Record<string, unknown>;
  const payload = record.payload as Record<string, unknown> | undefined;
  return payload?.generated_from === "evento_parto" && Object.entries(expected).every(([key, value]) =>
    (key === "birth_event_id" ? payload[key] : record[key]) === value,
  );
}

/** Read persisted canonical outcomes; a local optimistic row is not an ACK. */
export async function waitForTestFarmGesture(farmId: string, txId: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture || gesture.fazenda_id !== farmId) throw new Error("TEST_FARM_TX_FARM_MISMATCH");
    if (gesture.status === "ERROR" || gesture.status === "REJECTED") {
      throw new Error(`TEST_FARM_SYNC_STOP:${txId}:${gesture.last_error ?? gesture.status}`);
    }
    if (gesture.status === "DONE" &&
        (gesture.sync_result === "APPLIED" || gesture.sync_result === "APPLIED_ALTERED") &&
        gesture.diagnostics?.ack_installed_at &&
        await db.queue_ops.where("client_tx_id").equals(txId).count() === 0 &&
        await db.sync_reconcile_obligations.where("fazenda_id").equals(farmId).count() === 0) return gesture;
    if (Date.now() >= deadline) throw new Error(`TEST_FARM_SYNC_UNCONFIRMED:${txId}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}


/** Compare expected seed facts, allowing server fields and omitted optional JSON keys. */
export function matchesPersistedSeedReproduction(
  actual: { tipo?: unknown; macho_id?: unknown; payload?: Record<string, unknown> },
  expected: { tipo: string; macho_id: string | null; payload: Record<string, unknown> },
) {
  return actual.tipo === expected.tipo && (actual.macho_id ?? null) === expected.macho_id &&
    Object.entries(expected.payload).every(([key, value]) => value === undefined ||
      (actual.payload?.[key] ?? null) === (value ?? null));
}
