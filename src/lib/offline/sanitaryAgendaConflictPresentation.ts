import type { Operation } from "./types";
import type { ReconciliationObligation } from "./reconciliationTypes";

/** Derives warnings from the durable operation and its outstanding pull obligation. */
export function findUnreconciledSanitaryAgendaConflicts(
  farm: string,
  operations: readonly Operation[],
  obligations: readonly ReconciliationObligation[],
): Map<string, string> {
  const result = new Map<string, string>();
  const origins = obligations.filter(entry => entry.fazenda_id === farm && entry.scope === "sanitario-v2")
    .flatMap(entry => entry.diagnostics?.origins ?? []);
  for (const op of operations) {
    if (op.table !== "sanitario_v2" || op.sync_state !== "REJECTED" ||
      op.blocked_reason !== "SANITARIO_AGENDA_REVISION_CONFLICT" ||
      op.record?.domain !== "sanitario_v2" || op.record?.command !== "reschedule_agenda" ||
      op.record?.fazenda_id !== farm || typeof op.record?.payload?.agenda_id !== "string") continue;
    if (origins.some(origin => origin.client_tx_id === op.client_tx_id && origin.client_op_ids.includes(op.client_op_id)))
      result.set(op.record.payload.agenda_id, op.client_tx_id);
  }
  return result;
}
