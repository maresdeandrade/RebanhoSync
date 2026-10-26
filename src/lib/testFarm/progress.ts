import { db } from "@/lib/offline/db";

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
