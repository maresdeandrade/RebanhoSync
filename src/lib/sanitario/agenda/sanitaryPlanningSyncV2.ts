import { getClientId } from "@/lib/offline/ops";
import {
  isSanitarioV2PushEnabled,
  createSanitarioV2Identity,
  type SanitarioV2QueuedOperation,
} from "@/lib/offline/sanitarioV2Cutover";
import type { Operation } from "@/lib/offline/types";

export type SanitaryPlanningSyncContextV2 = {
  projectRef: string;
  clientId: string;
};
export const SANITARY_PLAN_PAYLOAD_KEY = "sanitary_agenda_automation_v2";

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

// Recognizes the immutable legacy queue shape emitted by saveSanitaryAutomationPlanV2.
// No rewriting/migration of pending operations or recalculation from current state.
export function queuedSanitaryPlanV2(
  op: Pick<Operation, "table" | "action" | "record" | "before_snapshot">,
): Record<string, unknown> | null {
  if (op.table !== "fazenda_sanidade_config" || op.action !== "UPDATE")
    return null;
  const record = op.record;
  if (
    !record ||
    Object.keys(record).some(
      (key) =>
        ![
          "id",
          "fazenda_id",
          "payload",
          "client_id",
          "client_op_id",
          "client_tx_id",
          "client_recorded_at",
        ].includes(key),
    )
  )
    return null;
  const plan = record.payload?.[SANITARY_PLAN_PAYLOAD_KEY];
  if (
    !plan ||
    !Number.isSafeInteger(plan.revision) ||
    plan.revision < 1 ||
    !op.before_snapshot
  )
    return null;
  const before = op.before_snapshot.payload ?? {};
  if ((before[SANITARY_PLAN_PAYLOAD_KEY]?.revision ?? 0) !== plan.revision - 1)
    return null;
  const withoutPlan = (payload: Record<string, unknown>) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(payload)
          .filter(([key]) => key !== SANITARY_PLAN_PAYLOAD_KEY)
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
  // A profile edit that happens to contain a plan must keep its original transport.
  return withoutPlan(before) === withoutPlan(record.payload) ? plan : null;
}

export function mapQueuedSanitaryPlanV2(
  op: Operation,
  fazendaId: string,
): SanitarioV2QueuedOperation | null {
  const plan = queuedSanitaryPlanV2(op);
  if (!plan) return null;
  return {
    domain: "sanitario_v2",
    contract_version: 2,
    command: "set_automation_plan",
    fazenda_id: fazendaId,
    client_op_id: op.client_op_id,
    client_tx_id: op.client_tx_id,
    domain_op_id: op.client_op_id,
    expected_revision: Number(plan.revision) - 1,
    payload: {
      plan,
      expected_plan:
        op.before_snapshot?.payload?.[SANITARY_PLAN_PAYLOAD_KEY] ?? null,
    },
  };
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
    contract_version: 2,
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
  return mapQueuedSanitaryPlanV2(op, op.record.fazenda_id) ?? op.record;
}
function agendaTarget(envelope: Operation["record"]) {
  return envelope.payload?.agenda_id ?? envelope.payload?.closure?.agenda_id;
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
function dependsOnPlan(
  envelope: Operation["record"],
  pending: Operation["record"],
) {
  if (
    pending.command !== "set_automation_plan" ||
    pending.fazenda_id !== envelope.fazenda_id
  )
    return false;
  const revision = pending.payload.plan.revision;
  if (envelope.command === "set_automation_plan")
    return revision <= Number(envelope.expected_revision);
  return (
    envelope.command === "create_agenda" &&
    revision <=
      Number(envelope.payload?.agenda?.metadata?.automationPlanRevision)
  );
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
      (dependsOnAgenda(envelope, pending) || dependsOnPlan(envelope, pending))
    );
  });
}
