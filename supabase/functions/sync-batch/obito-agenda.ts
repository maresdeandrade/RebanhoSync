export interface ObitoAgendaOperation {
  domain: "obito_agenda_v1";
  client_op_id: string;
  agenda_id: string;
  animal_id: string;
  death_event_id: string;
  fazenda_id: string;
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};
type Context = { fazendaId: string; clientTxId: string; clientId: string; actorUserId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keys = new Set(["domain", "client_op_id", "agenda_id", "animal_id", "death_event_id", "fazenda_id"]);

export function isObitoAgendaOperation(value: unknown): value is ObitoAgendaOperation {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (value as Record<string, unknown>).domain === "obito_agenda_v1";
}

function invalidEnvelope(operation: ObitoAgendaOperation, context: Context) {
  return Object.keys(operation).some((key) => !keys.has(key)) ||
    [operation.client_op_id, operation.agenda_id, operation.animal_id, operation.death_event_id,
      operation.fazenda_id, context.actorUserId, context.clientTxId].some((id) => typeof id !== "string" || !uuid.test(id)) ||
    operation.fazenda_id !== context.fazendaId || typeof context.clientId !== "string" ||
    context.clientId.trim().length === 0 || context.clientId.length > 128;
}

export async function executeObitoAgenda(client: RpcClient, operation: ObitoAgendaOperation, context: Context) {
  const base = { op_id: operation.client_op_id };
  if (invalidEnvelope(operation, context)) {
    return { ...base, status: "REJECTED", retryable: false, reason_code: "OBITO_AGENDA_ENVELOPE_INVALID" };
  }
  let response: { data: unknown; error: { code?: string; message?: string } | null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    response = await Promise.race([
      Promise.resolve(client.rpc("internal_obito_agenda_cancel", {
        actor_user_id: context.actorUserId, fazenda_id: context.fazendaId,
        agenda_id: operation.agenda_id, animal_id: operation.animal_id, death_event_id: operation.death_event_id,
        client_op_id: operation.client_op_id, client_tx_id: context.clientTxId, client_id: context.clientId,
      })),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("OBITO_AGENDA_TIMEOUT")), 12000); }),
    ]);
  } catch {
    return { ...base, status: "RETRYABLE", retryable: true, reason_code: "OBITO_AGENDA_UNCONFIRMED" };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  if (response.error?.code === "23505") {
    return { ...base, status: "CONFLICT", retryable: false, reason_code: "OBITO_AGENDA_IDENTITY_CONFLICT" };
  }
  if (response.error?.code === "42501" || response.error?.code?.startsWith("22")) {
    return { ...base, status: "REJECTED", retryable: false, reason_code: "OBITO_AGENDA_COMMAND_REJECTED" };
  }
  if (response.error || !response.data || typeof response.data !== "object" || Array.isArray(response.data)) {
    return { ...base, status: "RETRYABLE", retryable: true, reason_code: "OBITO_AGENDA_UNCONFIRMED" };
  }
  const result = response.data as Record<string, unknown>;
  const outcomes: Record<string, string> = { applied: "APPLIED", conflict: "CONFLICT", not_found: "REJECTED", dependency: "RETRYABLE" };
  const outcome = typeof result.outcome === "string" ? result.outcome : "";
  if (!Object.prototype.hasOwnProperty.call(outcomes, outcome) || result.agenda_id !== operation.agenda_id) {
    return { ...base, status: "RETRYABLE", retryable: true, reason_code: "OBITO_AGENDA_RESULT_INVALID" };
  }
  return { ...base, status: outcomes[outcome], retryable: outcome === "dependency", reason_code: `OBITO_AGENDA_${outcome.toUpperCase()}`, canonical_result: result };
}
