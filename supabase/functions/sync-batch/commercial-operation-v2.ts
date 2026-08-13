export const COMMERCIAL_OPERATION_MAX_ANIMALS = 500;
export const COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES = 1024 * 1024;

export interface CommercialOperationV2 {
  domain: "commercial_operation_v2";
  command: "apply_commercial_operation";
  contract_version: 2;
  client_op_id: string;
  client_tx_id: string;
  operation_id: string;
  operation_type: "compra" | "venda";
  scope: "animal" | "lote";
  fazenda_id: string;
  occurred_at: string;
  animal_ids: string[];
  animals: Record<string, unknown>[];
  event: Record<string, unknown>;
  detail: Record<string, unknown>;
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function payloadBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function isCommercialOperationV2(
  value: unknown,
): value is CommercialOperationV2 {
  return record(value) && value.domain === "commercial_operation_v2";
}

export function validateCommercialOperationV2(
  op: CommercialOperationV2,
  context: { fazendaId: string; clientTxId: string },
): string | null {
  if (
    op.command !== "apply_commercial_operation" ||
    op.contract_version !== 2 ||
    typeof op.client_op_id !== "string" ||
    op.client_tx_id !== context.clientTxId ||
    typeof op.operation_id !== "string" ||
    !record(op.event) ||
    !record(op.detail) ||
    !Array.isArray(op.animals) ||
    !Array.isArray(op.animal_ids)
  )
    return "COMMERCIAL_OPERATION_ENVELOPE_INVALID";
  if (payloadBytes(op) > COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES)
    return "COMMERCIAL_OPERATION_PAYLOAD_TOO_LARGE";
  if (
    op.animal_ids.length < 1 ||
    op.animal_ids.length > COMMERCIAL_OPERATION_MAX_ANIMALS ||
    op.animals.length !== op.animal_ids.length ||
    new Set(op.animal_ids).size !== op.animal_ids.length
  ) {
    return "COMMERCIAL_OPERATION_ANIMAL_COUNT_INVALID";
  }
  if (
    op.fazenda_id !== context.fazendaId ||
    op.event.fazenda_id !== context.fazendaId ||
    op.detail.fazenda_id !== context.fazendaId ||
    op.animals.some((animal) => animal.fazenda_id !== context.fazendaId)
  )
    return "COMMERCIAL_OPERATION_FARM_MISMATCH";
  if (
    (op.operation_type !== "compra" && op.operation_type !== "venda") ||
    (op.scope !== "animal" && op.scope !== "lote") ||
    op.event.id !== op.operation_id ||
    op.event.dominio !== "comercial" ||
    op.detail.evento_id !== op.operation_id ||
    op.detail.operation_type !== op.operation_type ||
    op.detail.scope !== op.scope ||
    op.detail.quantidade_animais !== op.animal_ids.length ||
    op.event.occurred_at !== op.occurred_at ||
    op.detail.occurred_at !== op.occurred_at
  )
    return "COMMERCIAL_OPERATION_DOMAIN_INVALID";
  const recordIds = op.animals.map((animal) => String(animal.id ?? "")).sort();
  if (JSON.stringify(recordIds) !== JSON.stringify([...op.animal_ids].sort()))
    return "COMMERCIAL_OPERATION_ANIMAL_LINK_INVALID";
  const detailIds = Array.isArray(op.detail.animal_ids)
    ? op.detail.animal_ids.filter((id): id is string => typeof id === "string")
    : [];
  const canonicalIds = [...op.animal_ids].sort();
  if (
    JSON.stringify(op.animal_ids) !== JSON.stringify(canonicalIds) ||
    JSON.stringify(detailIds) !== JSON.stringify(canonicalIds) ||
    (op.scope === "animal" &&
      op.animal_ids.length === 1 &&
      op.event.animal_id !== op.animal_ids[0]) ||
    (op.scope === "lote" && op.event.animal_id != null) ||
    op.event.lote_id !== op.detail.lote_id ||
    (op.scope === "lote" && typeof op.detail.lote_id !== "string") ||
    (op.operation_type === "compra" &&
      op.scope === "animal" &&
      op.animal_ids.length !== 1)
  ) {
    return "COMMERCIAL_OPERATION_LINK_INVALID";
  }
  if (
    op.operation_type === "compra" &&
    op.animals.some(
      (animal) => animal.status !== "ativo" || animal.origem !== "compra",
    )
  ) {
    return "COMMERCIAL_OPERATION_PURCHASE_STATE_INVALID";
  }
  if (op.operation_type === "compra") {
    const identifications = op.animals.map((animal) =>
      typeof animal.identificacao === "string"
        ? animal.identificacao.trim().toLocaleLowerCase()
        : "",
    );
    if (
      identifications.some((identification) => !identification) ||
      new Set(identifications).size !== identifications.length
    ) {
      return "COMMERCIAL_OPERATION_IDENTIFICATION_INVALID";
    }
  }
  if (
    op.operation_type === "venda" &&
    op.animals.some(
      (animal) =>
        animal.status !== "vendido" ||
        animal.lote_id != null ||
        animal.data_saida !== op.occurred_at.slice(0, 10),
    )
  ) {
    return "COMMERCIAL_OPERATION_SALE_STATE_INVALID";
  }
  return null;
}

export async function executeCommercialOperationV2(
  client: RpcClient,
  op: CommercialOperationV2,
  context: { fazendaId: string; clientTxId: string },
) {
  const issue = validateCommercialOperationV2(op, context);
  if (issue)
    return { op_id: op.client_op_id, status: "REJECTED", reason_code: issue };
  const { data, error } = await client.rpc("apply_commercial_operation_v2", {
    p_fazenda_id: context.fazendaId,
    p_client_op_id: op.client_op_id,
    p_client_tx_id: op.client_tx_id,
    p_operation: op,
  });
  if (error)
    return {
      op_id: op.client_op_id,
      status: "RETRYABLE",
      reason_code: "COMMERCIAL_OPERATION_RPC_ERROR",
      reason_message: error.message,
      retryable: true,
    };
  const result = record(data) ? data : {};
  if (
    result.status !== "APPLIED" &&
    result.status !== "CONFLICT" &&
    result.status !== "REJECTED"
  ) {
    return {
      op_id: op.client_op_id,
      status: "RETRYABLE",
      reason_code: "COMMERCIAL_OPERATION_RPC_RESULT_INVALID",
      retryable: true,
    };
  }
  return {
    op_id: op.client_op_id,
    status: result.status,
    ...(typeof result.reason_code === "string"
      ? { reason_code: result.reason_code }
      : {}),
    ...(typeof result.reason_message === "string"
      ? { reason_message: result.reason_message }
      : {}),
    canonical_result: result,
  };
}
