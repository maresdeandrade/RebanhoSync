import type { SanitarioSyncV2Operation } from "../../../../supabase/functions/sync-batch/sanitario-v2";
import { validateSanitarioSyncV2Operation } from "../../../../supabase/functions/sync-batch/sanitario-v2";

export type SanitarioV3Envelope = SanitarioSyncV2Operation & {
  contract_version: 3;
};
export type SanitaryAdmissionInputV3 = {
  intent: "agenda_execution" | "external_history" | "factual_correction";
  fazendaId: string;
  agendaId?: string;
  sourceEventId?: string;
  clientOpId: string;
  clientTxId: string;
  domainOpId: string;
  payload: Record<string, unknown>;
};
export type SanitaryAdmissionV3 = {
  disposition: "prepared" | "blocked";
  reason?: "SANITARIO_V3_EXECUTION_NOT_ENABLED";
  envelope?: SanitarioV3Envelope;
};
export const SANITARIO_V3_EXECUTION_NOT_ENABLED =
  "SANITARIO_V3_EXECUTION_NOT_ENABLED";
export const SANITARIO_V3_EXECUTION_ENABLED = true;
export function prepareSanitaryAdmissionV3(
  input: SanitaryAdmissionInputV3,
): SanitaryAdmissionV3 {
  const event = input.payload.event;
  const factualExecution =
    event &&
    typeof event === "object" &&
    !Array.isArray(event) &&
    ((event as Record<string, unknown>).natureza === "primary_execution" ||
      (event as Record<string, unknown>).source_sanitario_agenda_v2_id);
  if (input.intent === "external_history" && factualExecution) {
    return {
      disposition: "blocked",
      reason: SANITARIO_V3_EXECUTION_NOT_ENABLED,
    };
  }
  const envelope = {
    domain: "sanitario_v2",
    contract_version: 3,
    command: "apply_factual_core",
    fazenda_id: input.fazendaId,
    client_op_id: input.clientOpId,
    client_tx_id: input.clientTxId,
    domain_op_id: input.domainOpId,
    payload: input.payload,
  };
  const validation = validateSanitarioSyncV2Operation(envelope, {
    fazendaId: input.fazendaId,
    clientTxId: input.clientTxId,
    clientId: "local",
    actorUserId: "local",
    membershipRole: "owner",
  });
  if (validation.ok === false) throw new Error(validation.result.reason_code);
  return {
    disposition: "prepared",
    envelope: { ...validation.operation, contract_version: 3 },
  };
}

export function requireSanitaryAdmissionV3(input: SanitaryAdmissionInputV3) {
  const result = prepareSanitaryAdmissionV3(input);
  if (result.disposition === "blocked")
    throw new Error(
      `Execução sanitária indisponível nesta etapa. ${result.reason}`,
    );
  return result.envelope!;
}

/** Common preparation for all six commands; identities are supplied by the caller. */
export function prepareSanitaryCommandV3(
  operation: Record<string, unknown>,
): SanitarioV3Envelope {
  const validation = validateSanitarioSyncV2Operation(
    { ...operation, contract_version: 3 },
    {
      fazendaId: String(operation.fazenda_id),
      clientTxId: String(operation.client_tx_id),
      clientId: "local",
      actorUserId: "local",
      membershipRole: "owner",
    },
  );
  if (validation.ok === false) throw new Error(validation.result.reason_code);
  const envelope = validation.operation;
  if (
    envelope.command === "apply_factual_core" &&
    (envelope.payload.event.natureza === "primary_execution" ||
      envelope.payload.event.source_sanitario_agenda_v2_id) &&
    (envelope.payload.event.natureza !== "primary_execution" ||
      !envelope.payload.event.source_sanitario_agenda_v2_id)
  ) {
    throw new Error(
      `Execução sanitária indisponível nesta etapa. ${SANITARIO_V3_EXECUTION_NOT_ENABLED}`,
    );
  }
  return { ...envelope, contract_version: 3 };
}
