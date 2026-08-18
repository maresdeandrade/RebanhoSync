export interface CommercialPurchaseOperation {
  client_op_id: string;
  domain: "commercial_purchase_v1";
  command: "apply_individual_purchase";
  contract_version: 1;
  client_tx_id: string;
  animal: Record<string, unknown>;
  event: Record<string, unknown>;
  detail: Record<string, unknown>;
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCommercialPurchaseOperation(
  value: unknown,
): value is CommercialPurchaseOperation {
  if (!isRecord(value)) return false;
  return value.domain === "commercial_purchase_v1";
}

export function validateCommercialPurchaseOperation(
  op: CommercialPurchaseOperation,
  context: { fazendaId: string; clientTxId: string },
): string | null {
  if (
    op.command !== "apply_individual_purchase" || op.contract_version !== 1 ||
    typeof op.client_op_id !== "string" ||
    op.client_tx_id !== context.clientTxId || !isRecord(op.animal) ||
    !isRecord(op.event) || !isRecord(op.detail)
  ) return "COMMERCIAL_PURCHASE_ENVELOPE_INVALID";

  const { animal, event, detail } = op;
  const animalIds = detail.animal_ids;
  const animalLoteId = animal.lote_id ?? null;
  const eventLoteId = event.lote_id ?? null;
  const detailLoteId = detail.lote_id ?? null;
  if (
    typeof animal.id !== "string" || typeof event.id !== "string" ||
    typeof detail.evento_id !== "string"
  ) return "COMMERCIAL_PURCHASE_PARENT_REQUIRED";
  if (
    animal.fazenda_id !== context.fazendaId ||
    event.fazenda_id !== context.fazendaId ||
    detail.fazenda_id !== context.fazendaId
  ) return "COMMERCIAL_PURCHASE_FARM_MISMATCH";
  if (
    animal.origem !== "compra" || animal.status !== "ativo" ||
    event.dominio !== "comercial" ||
    typeof event.occurred_at !== "string" ||
    typeof detail.occurred_at !== "string" ||
    detail.operation_type !== "compra" ||
    detail.scope !== "animal" || detail.quantidade_animais !== 1 ||
    detail.finance_transaction_id != null
  ) return "COMMERCIAL_PURCHASE_DOMAIN_INVALID";
  if (
    event.animal_id !== animal.id || detail.evento_id !== event.id ||
    !Array.isArray(animalIds) || animalIds.length !== 1 ||
    animalIds[0] !== animal.id || event.occurred_at !== detail.occurred_at ||
    animalLoteId !== eventLoteId || eventLoteId !== detailLoteId
  ) return "COMMERCIAL_PURCHASE_LINK_MISMATCH";
  return null;
}

export async function executeCommercialPurchaseOperation(
  client: RpcClient,
  op: CommercialPurchaseOperation,
  context: { fazendaId: string; clientTxId: string },
) {
  const issue = validateCommercialPurchaseOperation(op, context);
  if (issue) {
    return { op_id: op.client_op_id, status: "REJECTED", reason_code: issue };
  }
  const { data, error } = await client.rpc("apply_individual_animal_purchase", {
    p_fazenda_id: context.fazendaId,
    p_client_op_id: op.client_op_id,
    p_client_tx_id: op.client_tx_id,
    p_animal: op.animal,
    p_evento: op.event,
    p_comercial: op.detail,
  });
  if (error) {
    return {
      op_id: op.client_op_id,
      status: "RETRYABLE",
      reason_code: "COMMERCIAL_PURCHASE_RPC_ERROR",
      reason_message: error.message ?? "Commercial purchase RPC failed",
      retryable: true,
    };
  }
  const result = isRecord(data) ? data : {};
  const status = result.status;
  if (status !== "APPLIED" && status !== "CONFLICT" && status !== "REJECTED") {
    return {
      op_id: op.client_op_id,
      status: "RETRYABLE",
      reason_code: "COMMERCIAL_PURCHASE_RPC_RESULT_INVALID",
      retryable: true,
    };
  }
  return {
    op_id: op.client_op_id,
    status,
    ...(typeof result.reason_code === "string"
      ? { reason_code: result.reason_code }
      : {}),
    ...(typeof result.reason_message === "string"
      ? { reason_message: result.reason_message }
      : {}),
    canonical_result: result,
  };
}
