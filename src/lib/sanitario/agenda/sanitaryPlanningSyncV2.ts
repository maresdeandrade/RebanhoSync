import { getClientId } from "@/lib/offline/clientIdentity";
import {
  isSanitarioV2PushEnabled,
  createSanitarioV2Identity,
  type SanitarioV2QueuedOperation,
} from "@/lib/offline/sanitarioV2Cutover";
import type { Operation, SyncOperationResult } from "@/lib/offline/types";

export type SanitaryPlanningSyncContextV2 = {
  projectRef: string;
  clientId: string;
};

export function readSanitaryPlanningSyncContextV2():
  | SanitaryPlanningSyncContextV2
  | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return;
  const host = new URL(url).hostname;
  const projectRef = ["localhost", "127.0.0.1"].includes(host)
    ? "local"
    : host.split(".")[0];
  if (isSanitarioV2PushEnabled(projectRef))
    return { projectRef, clientId: getClientId() };
}

export function buildRescheduleAgendaV2(
  fazendaId: string,
  agendaId: string,
  revision: number,
  date: string,
): SanitarioV2QueuedOperation {
  const identity = createSanitarioV2Identity();
  return {
    domain: "sanitario_v2",
    contract_version: 3,
    command: "reschedule_agenda",
    fazenda_id: fazendaId,
    client_op_id: identity.clientOpId,
    client_tx_id: identity.clientTxId,
    domain_op_id: identity.domainOpId,
    expected_revision: revision,
    payload: { agenda_id: agendaId, data_programada: date },
  };
}

function planningEnvelope(op: Operation) {
  return op.record;
}
function agendaTarget(envelope: Operation["record"]) {
  return envelope.payload?.agenda_id ?? envelope.payload?.closure?.agenda_id ??
    (envelope.command === "apply_factual_core" ? envelope.payload?.event?.source_sanitario_agenda_v2_id : undefined);
}
function dependsOnAgenda(
  envelope: Operation["record"],
  pending: Operation["record"],
) {
  const target = agendaTarget(envelope);
  if (!target) return false;
  if (pending.command === "create_agenda")
    return pending.payload?.agenda?.id === target;
  return (
    agendaTarget(pending) === target &&
    Number(pending.expected_revision) < Number(envelope.expected_revision)
  );
}
export function findTerminalSanitaryPlanningDependencyV2(
  op: Operation,
  others: readonly Operation[],
  results: readonly SyncOperationResult[],
): string | undefined {
  const envelope = planningEnvelope(op);
  if (envelope.domain !== "sanitario_v2" || envelope.command !== "reschedule_agenda") return;
  return others.find(other => {
    const pending = planningEnvelope(other);
    if (other.client_op_id === op.client_op_id || other.client_tx_id !== op.client_tx_id ||
      pending.domain !== "sanitario_v2" || !envelope.fazenda_id || pending.fazenda_id !== envelope.fazenda_id ||
      !["create_agenda", "reschedule_agenda"].includes(String(pending.command)) || !dependsOnAgenda(envelope, pending)) return false;
    return results.some(result => result.op_id === other.client_op_id &&
      (!result.client_op_id || result.client_op_id === other.client_op_id) &&
      result.domain_op_id === other.domain_op_id && ["REJECTED", "CONFLICT"].includes(result.status));
  })?.client_op_id;
}

// Wait for local predecessors; cross-device conflicts still use server CAS without rebase.
export function hasPendingSanitaryPlanningDependencyV2(
  op: Operation,
  others: readonly Operation[],
): boolean {
  const envelope = planningEnvelope(op);
  if (envelope.domain !== "sanitario_v2") return false;
  return others.some((other) => {
    if (
      other.client_tx_id === op.client_tx_id ||
      other.sync_state === "REJECTED"
    )
      return false;
    const pending = planningEnvelope(other);
    return (
      pending.domain === "sanitario_v2" &&
      dependsOnAgenda(envelope, pending)
    );
  });
}
