import type { Operation } from "@/lib/offline/types";

export const COMMERCIAL_PURCHASE_SYNC_TABLE = "commercial_purchase_v1";

export interface CommercialPurchaseSyncEnvelope extends Record<
  string,
  unknown
> {
  domain: "commercial_purchase_v1";
  command: "apply_individual_purchase";
  contract_version: 1;
  client_op_id: string;
  client_tx_id: string;
  animal: Record<string, unknown>;
  event: Record<string, unknown>;
  detail: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCommercialPurchaseEnvelope(
  value: unknown,
): value is CommercialPurchaseSyncEnvelope {
  if (!isRecord(value)) return false;
  return (
    value.domain === "commercial_purchase_v1" &&
    value.command === "apply_individual_purchase" &&
    value.contract_version === 1 &&
    typeof value.client_op_id === "string" &&
    typeof value.client_tx_id === "string" &&
    isRecord(value.animal) &&
    isRecord(value.event) &&
    isRecord(value.detail)
  );
}

function purchaseCandidate(ops: readonly Operation[]) {
  return ops.some(
    (op) =>
      op.table === COMMERCIAL_PURCHASE_SYNC_TABLE ||
      (op.table === "animais" && op.record?.origem === "compra") ||
      (op.table === "eventos_comercial" &&
        op.record?.operation_type === "compra"),
  );
}

export function buildCommercialPurchaseEnvelope(
  ops: readonly Operation[],
  fazendaId: string,
): CommercialPurchaseSyncEnvelope | null {
  const queuedEnvelope = ops.find(
    (op) => op.table === COMMERCIAL_PURCHASE_SYNC_TABLE,
  );
  if (queuedEnvelope) {
    if (
      ops.length !== 1 ||
      !isCommercialPurchaseEnvelope(queuedEnvelope.record)
    ) {
      throw new Error("COMMERCIAL_PURCHASE_COMPOUND_QUEUE_INVALID");
    }
    if (
      queuedEnvelope.client_op_id !== queuedEnvelope.record.client_op_id ||
      queuedEnvelope.client_tx_id !== queuedEnvelope.record.client_tx_id
    ) {
      throw new Error("COMMERCIAL_PURCHASE_QUEUED_IDENTITY_MISMATCH");
    }
    return queuedEnvelope.record;
  }

  if (!purchaseCandidate(ops)) return null;
  const animalOp = ops.find((op) => op.table === "animais");
  const eventOp = ops.find((op) => op.table === "eventos");
  const detailOp = ops.find((op) => op.table === "eventos_comercial");
  if (
    ops.length !== 3 ||
    !animalOp ||
    !eventOp ||
    !detailOp ||
    [animalOp, eventOp, detailOp].some((op) => op.action !== "INSERT")
  ) {
    throw new Error("COMMERCIAL_PURCHASE_LEGACY_INCOMPLETE");
  }

  const animal = animalOp.record as Record<string, unknown>;
  const event = eventOp.record as Record<string, unknown>;
  const detail = detailOp.record as Record<string, unknown>;
  const animalIds = detail.animal_ids;
  const animalLoteId = animal.lote_id ?? null;
  const eventLoteId = event.lote_id ?? null;
  const detailLoteId = detail.lote_id ?? null;
  if (
    animal.fazenda_id !== fazendaId ||
    event.fazenda_id !== fazendaId ||
    detail.fazenda_id !== fazendaId ||
    animal.origem !== "compra" ||
    animal.status !== "ativo" ||
    event.dominio !== "comercial" ||
    typeof event.occurred_at !== "string" ||
    typeof detail.occurred_at !== "string" ||
    detail.operation_type !== "compra" ||
    detail.scope !== "animal" ||
    event.animal_id !== animal.id ||
    detail.evento_id !== event.id ||
    !Array.isArray(animalIds) ||
    animalIds.length !== 1 ||
    animalIds[0] !== animal.id ||
    detail.finance_transaction_id != null ||
    event.occurred_at !== detail.occurred_at ||
    animalLoteId !== eventLoteId ||
    eventLoteId !== detailLoteId
  ) {
    throw new Error("COMMERCIAL_PURCHASE_LEGACY_CONTENT_INVALID");
  }

  return {
    domain: "commercial_purchase_v1",
    command: "apply_individual_purchase",
    contract_version: 1,
    client_op_id: animalOp.client_op_id,
    client_tx_id: animalOp.client_tx_id,
    animal,
    event,
    detail,
  };
}

export function buildCommercialPurchaseQueueOperation(
  ops: readonly Operation[],
  fazendaId: string,
): Operation | null {
  const envelope = buildCommercialPurchaseEnvelope(ops, fazendaId);
  if (!envelope) return null;
  return {
    client_op_id: envelope.client_op_id,
    client_tx_id: envelope.client_tx_id,
    op_order: 0,
    table: COMMERCIAL_PURCHASE_SYNC_TABLE,
    action: "INSERT",
    record: envelope,
    sync_state: "PENDING",
    created_at: ops[0]?.created_at ?? new Date().toISOString(),
  };
}

export function getPendingCommercialPurchaseRecords(op: Operation) {
  if (!isCommercialPurchaseEnvelope(op.record)) return [];
  return [
    { table: "animais", record: op.record.animal },
    { table: "eventos", record: op.record.event },
    { table: "eventos_comercial", record: op.record.detail },
  ] as const;
}
