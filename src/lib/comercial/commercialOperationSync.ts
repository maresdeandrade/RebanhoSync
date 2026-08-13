import type { Operation } from "@/lib/offline/types";
import {
  COMMERCIAL_OPERATION_MAX_ANIMALS,
  COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES,
} from "@/lib/comercial/commercialOperationCommand";

export const COMMERCIAL_OPERATION_SYNC_TABLE = "commercial_operation_v2";

export interface CommercialOperationSyncEnvelope extends Record<
  string,
  unknown
> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function isCommercialOperationEnvelope(
  value: unknown,
): value is CommercialOperationSyncEnvelope {
  return (
    isRecord(value) &&
    value.domain === "commercial_operation_v2" &&
    value.command === "apply_commercial_operation" &&
    value.contract_version === 2 &&
    typeof value.client_op_id === "string" &&
    typeof value.client_tx_id === "string" &&
    typeof value.operation_id === "string" &&
    typeof value.fazenda_id === "string" &&
    Array.isArray(value.animal_ids) &&
    Array.isArray(value.animals) &&
    isRecord(value.event) &&
    isRecord(value.detail)
  );
}

export function buildCommercialOperationEnvelope(
  ops: readonly Operation[],
  fazendaId: string,
): CommercialOperationSyncEnvelope | null {
  const queued = ops.find((op) => op.table === COMMERCIAL_OPERATION_SYNC_TABLE);
  if (queued) {
    if (ops.length !== 1 || !isCommercialOperationEnvelope(queued.record)) {
      throw new Error("COMMERCIAL_OPERATION_COMPOUND_QUEUE_INVALID");
    }
    if (
      queued.client_op_id !== queued.record.client_op_id ||
      queued.client_tx_id !== queued.record.client_tx_id
    ) {
      throw new Error("COMMERCIAL_OPERATION_QUEUED_IDENTITY_MISMATCH");
    }
    return queued.record;
  }

  const eventOps = ops.filter(
    (op) => op.table === "eventos" && op.record?.dominio === "comercial",
  );
  const detailOps = ops.filter((op) => op.table === "eventos_comercial");
  if (eventOps.length !== 1 || detailOps.length !== 1) return null;
  const event = eventOps[0]!.record as Record<string, unknown>;
  const detail = detailOps[0]!.record as Record<string, unknown>;
  const payload = isRecord(event.payload) ? event.payload : {};
  const snapshot = isRecord(detail.snapshot) ? detail.snapshot : {};
  if (
    payload.kind !== "commercial_operation_v2" &&
    snapshot.contract_version !== 2
  )
    return null;

  const operationType = detail.operation_type;
  const scope = detail.scope;
  const animalIds = Array.isArray(detail.animal_ids)
    ? detail.animal_ids
        .filter((id): id is string => typeof id === "string")
        .sort((a, b) => a.localeCompare(b))
    : [];
  const animalOps = ops.filter((op) => op.table === "animais");
  const animals = animalOps.map((op) => op.record as Record<string, unknown>);
  if (
    (operationType !== "compra" && operationType !== "venda") ||
    (scope !== "animal" && scope !== "lote") ||
    animalIds.length < 1 ||
    new Set(animalIds).size !== animalIds.length ||
    animals.length !== animalIds.length ||
    event.fazenda_id !== fazendaId ||
    detail.fazenda_id !== fazendaId ||
    detail.evento_id !== event.id ||
    event.occurred_at !== detail.occurred_at ||
    detail.quantidade_animais !== animalIds.length
  ) {
    throw new Error("COMMERCIAL_OPERATION_CONTENT_INVALID");
  }
  for (const op of animalOps) {
    const id = String(op.record.id ?? "");
    if (!animalIds.includes(id) || op.record.fazenda_id !== fazendaId)
      throw new Error("COMMERCIAL_OPERATION_ANIMAL_LINK_INVALID");
    if (
      operationType === "compra" &&
      (op.action !== "INSERT" ||
        op.record.status !== "ativo" ||
        op.record.origem !== "compra")
    ) {
      throw new Error("COMMERCIAL_OPERATION_PURCHASE_STATE_INVALID");
    }
    if (
      operationType === "venda" &&
      (op.action !== "UPDATE" || op.record.status !== "vendido")
    ) {
      throw new Error("COMMERCIAL_OPERATION_SALE_STATE_INVALID");
    }
  }
  const envelope: CommercialOperationSyncEnvelope = {
    domain: "commercial_operation_v2",
    command: "apply_commercial_operation",
    contract_version: 2,
    client_op_id: eventOps[0]!.client_op_id,
    client_tx_id: eventOps[0]!.client_tx_id,
    operation_id: String(event.id),
    operation_type: operationType,
    scope,
    fazenda_id: fazendaId,
    occurred_at: String(event.occurred_at),
    animal_ids: animalIds,
    animals,
    event,
    detail,
  };
  if (animalIds.length > COMMERCIAL_OPERATION_MAX_ANIMALS) {
    throw new Error("COMMERCIAL_OPERATION_ANIMAL_LIMIT_EXCEEDED");
  }
  if (payloadBytes(envelope) > COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES) {
    throw new Error("COMMERCIAL_OPERATION_PAYLOAD_TOO_LARGE");
  }
  return envelope;
}

export function buildCommercialOperationQueueOperation(
  ops: readonly Operation[],
  fazendaId: string,
): Operation | null {
  const envelope = buildCommercialOperationEnvelope(ops, fazendaId);
  if (!envelope) return null;
  return {
    client_op_id: envelope.client_op_id,
    client_tx_id: envelope.client_tx_id,
    op_order: 0,
    table: COMMERCIAL_OPERATION_SYNC_TABLE,
    action: "INSERT",
    record: envelope,
    sync_state: "PENDING",
    created_at: ops[0]?.created_at ?? new Date().toISOString(),
  };
}

export function getPendingCommercialOperationRecords(op: Operation) {
  if (!isCommercialOperationEnvelope(op.record)) return [];
  return [
    ...op.record.animals.map((record) => ({ table: "animais", record })),
    { table: "eventos", record: op.record.event },
    { table: "eventos_comercial", record: op.record.detail },
  ] as const;
}
