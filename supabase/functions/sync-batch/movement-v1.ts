// Transport only: PostgreSQL owns selectors, digest, eligibility, CAS and causal drain.
export interface MovementV1 extends Record<string, unknown> {
  domain: "movement_v1";
  command: "apply_animal_lot";
  contract_version: 1;
  fazenda_id: string;
  subject_type: "animal";
  subject_id: string;
  event_id: string;
  client_op_id: string;
  client_tx_id: string;
  movement_mode: "operational" | "history_only";
  from_lote_id: string | null;
  to_lote_id: string;
  occurred_at: string;
  movement_base: Record<string, unknown> | null;
}

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};
const inputKeys = new Set([
  "contract_version",
  "fazenda_id",
  "subject_type",
  "subject_id",
  "event_id",
  "client_op_id",
  "client_tx_id",
  "movement_mode",
  "from_lote_id",
  "to_lote_id",
  "occurred_at",
  "movement_base",
  "source_task_id",
  "corrige_evento_id",
  "observacoes",
  "payload",
  "detail_payload",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Recognize partial declarations BEFORE generic dispatch; validation is separate.
export function isMovementV1Operation(value: unknown): value is MovementV1 {
  return (
    record(value) &&
    ((typeof value.domain === "string" &&
      /^movement(?:_|$)/.test(value.domain)) ||
      value.command === "apply_animal_lot")
  );
}

export function validateMovementV1(
  op: MovementV1,
  context: { fazendaId: string; clientTxId: string },
): string | null {
  if (
    op.domain !== "movement_v1" ||
    op.command !== "apply_animal_lot" ||
    op.contract_version !== 1 ||
    op.subject_type !== "animal" ||
    Object.keys(op).some(
      (key) => !inputKeys.has(key) && key !== "domain" && key !== "command",
    ) ||
    [
      op.fazenda_id,
      op.subject_id,
      op.event_id,
      op.client_op_id,
      op.client_tx_id,
      op.to_lote_id,
    ].some((value) => typeof value !== "string" || !uuid.test(value)) ||
    !Object.hasOwn(op, "from_lote_id") ||
    (op.from_lote_id !== null &&
      (typeof op.from_lote_id !== "string" || !uuid.test(op.from_lote_id))) ||
    typeof op.occurred_at !== "string" ||
    !["operational", "history_only"].includes(op.movement_mode) ||
    !Object.hasOwn(op, "movement_base") ||
    (op.movement_mode === "operational" && !record(op.movement_base)) ||
    (op.movement_mode === "history_only" && op.movement_base !== null) ||
    (op.payload !== undefined && !record(op.payload)) ||
    (op.detail_payload !== undefined && !record(op.detail_payload))
  ) {
    return "MOVEMENT_ENVELOPE_INVALID";
  }
  if (op.fazenda_id !== context.fazendaId) return "MOVEMENT_FARM_MISMATCH";
  if (op.client_tx_id !== context.clientTxId) return "MOVEMENT_TX_MISMATCH";
  if (new TextEncoder().encode(JSON.stringify(op)).byteLength > 65536) {
    return "MOVEMENT_PAYLOAD_TOO_LARGE";
  }
  return null;
}

function unknownResult(op: MovementV1, reason: string) {
  return {
    operation_identity: operationIdentity(op),
    op_id: op.client_op_id,
    status: "RETRYABLE",
    retryable: true,
    terminal: false,
    reconciliation_required: true,
    commit_unknown: true,
    reason_code: reason,
  };
}

function operationIdentity(op: MovementV1) {
  return {
    fazenda_id: op.fazenda_id,
    event_id: op.event_id,
    client_op_id: op.client_op_id,
    client_tx_id: op.client_tx_id,
  };
}

export async function executeMovementV1(
  client: RpcClient,
  op: MovementV1,
  context: { fazendaId: string; clientTxId: string },
) {
  const issue = validateMovementV1(op, context);
  if (issue) {
    return {
      operation_identity: operationIdentity(op),
      op_id: op.client_op_id,
      status: "REJECTED",
      retryable: false,
      terminal: true,
      reconciliation_required: true,
      reason_code: issue,
    };
  }
  const input = Object.fromEntries(
    Object.entries(op).filter(([key]) => inputKeys.has(key)),
  );
  let response;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Await the PostgREST transaction response. No pre-commit ACK or TS child retries.
    response = await Promise.race([
      Promise.resolve(
        client.rpc("apply_animal_lot_movement_v1", { p_command: input }),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("MOVEMENT_RPC_TIMEOUT")),
          12_000,
        );
      }),
    ]);
  } catch {
    return unknownResult(op, "MOVEMENT_RPC_UNCONFIRMED");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  if (response.error) return unknownResult(op, "MOVEMENT_RPC_ERROR");
  const receipt = response.data;
  if (
    !record(receipt) ||
    ![
      "STATE_APPLIED",
      "HISTORY_ONLY",
      "HISTORY_CONFLICT",
      "PENDING_CAUSAL_DEPENDENCY",
      "PROJECTION_CONFLICT",
      "REJECTED",
      "CONFLICT",
    ].includes(String(receipt.status))
  )
    return unknownResult(op, "MOVEMENT_RPC_RESULT_INVALID");
  const status =
    receipt.status === "STATE_APPLIED" || receipt.status === "HISTORY_ONLY"
      ? "APPLIED"
      : receipt.status === "PENDING_CAUSAL_DEPENDENCY"
        ? "BLOCKED_DEPENDENCY"
        : receipt.status === "REJECTED"
          ? "REJECTED"
          : "CONFLICT";
  return {
    operation_identity: operationIdentity(op),
    op_id: op.client_op_id,
    status,
    retryable: false,
    terminal: receipt.status !== "PENDING_CAUSAL_DEPENDENCY",
    reconciliation_required: true,
    state_effect: receipt.status === "STATE_APPLIED",
    reason_code:
      typeof receipt.reason_code === "string"
        ? receipt.reason_code
        : `MOVEMENT_${receipt.status}`,
    // Original receipt, including original PENDING, even after a later effect decision.
    canonical_result: receipt,
  };
}
