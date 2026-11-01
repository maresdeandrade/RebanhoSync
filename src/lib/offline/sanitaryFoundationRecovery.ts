import { db, LOCAL_OWNERSHIP_KEY } from "./db";
import { getCurrentLocalReadOwnership } from "./localReadBoundary";
import { supabase } from "@/lib/supabase";
import { mapQueuedSanitaryPlanV2 } from "@/lib/sanitario/agenda/sanitaryPlanningSyncV2";
import { upsertReconciliationObligations } from "./reconciliationObligations";
import type { LocalOwnershipDecision } from "./ownership";
import type { Operation, Gesture, SyncOperationResult } from "./types";

export type ReceiptLookupV3 = {
  status: "found" | "absent" | "unavailable" | "not_covered";
  canonicalResult?: Record<string, unknown>;
};
export type RecoveryDependenciesV3 = {
  ownership: () => Promise<LocalOwnershipDecision>;
  lookup: (op: Operation, gesture: Gesture) => Promise<ReceiptLookupV3>;
  onInventory?: (inventory: {
    byCommand: Record<string, number>;
    byState: Record<string, number>;
    ownership: string;
  }) => void;
};
export function classifySanitaryRecovery(input: {
  ownerMatches: boolean;
  originalEnvelope: Operation;
  receiptLookup: ReceiptLookupV3;
  correspondence: "exact" | "ambiguous" | "missing";
  incompatiblePendingProven: boolean;
}): "install_receipt" | "preserve" | "convert_candidate" {
  if (!input.ownerMatches || input.correspondence !== "exact")
    return "preserve";
  if (
    input.receiptLookup.status === "found" &&
    input.receiptLookup.canonicalResult
  )
    return "install_receipt";
  if (
    input.receiptLookup.status === "absent" &&
    input.incompatiblePendingProven
  )
    return "convert_candidate";
  return "preserve";
}

export function isSanitaryEvidenceOperation(op: Operation): boolean {
  return (
    op.table === "sanitario_v2" ||
    op.record?.domain === "sanitario_v2" ||
    !!mapQueuedSanitaryPlanV2(op, String(op.record?.fazenda_id ?? "")) ||
    op.table.replace(/^event_/, "") === "eventos_sanitario" ||
    op.record?.dominio === "sanitario" ||
    op.record?.tipo === "consumo_sanitario"
  );
}
function entityId(envelope: Record<string, unknown>): string | undefined {
  const payload = envelope.payload as
    | Record<string, Record<string, unknown> | string>
    | undefined;
  if (envelope.command === "set_automation_plan")
    return envelope.fazenda_id as string;
  const entityKey = new Map<unknown, string>([
    ["create_agenda", "agenda"],
    ["apply_factual_core", "event"],
    ["close_agenda", "closure"],
  ]).get(envelope.command);
  if (!entityKey) return payload?.agenda_id as string;
  return (payload?.[entityKey] as Record<string, unknown>)?.id as string;
}
function canonicalEntity(command: unknown, result: Record<string, unknown>) {
  if (command === "apply_factual_core") return result.evento_id;
  if (command === "close_agenda") return result.closure_id;
  if (command === "set_automation_plan") return result.fazenda_id;
  return result.agenda_id;
}
function originalEnvelope(
  op: Operation,
  gesture: Gesture,
): Record<string, unknown> | null {
  const mapped = mapQueuedSanitaryPlanV2(op, gesture.fazenda_id);
  const envelope =
    mapped ?? (op.record?.domain === "sanitario_v2" ? op.record : null);
  if (!envelope || !matchesOriginalEnvelope(envelope, op, gesture)) return null;
  return { ...envelope, fazenda_id: gesture.fazenda_id };
}
function matchesOriginalEnvelope(
  envelope: Record<string, unknown>,
  op: Operation,
  gesture: Gesture,
) {
  return (
    envelope.client_op_id === op.client_op_id &&
    envelope.client_tx_id === op.client_tx_id &&
    (!envelope.fazenda_id || envelope.fazenda_id === gesture.fazenda_id) &&
    (!op.domain_op_id || envelope.domain_op_id === op.domain_op_id)
  );
}
async function lookupReceipt(
  op: Operation,
  gesture: Gesture,
): Promise<ReceiptLookupV3> {
  const envelope = originalEnvelope(op, gesture);
  if (!envelope) return { status: "not_covered" };
  // The transport flag is not added to the persisted original envelope.
  const { data, error } = await supabase.functions.invoke("sync-batch", {
    body: {
      fazenda_id: gesture.fazenda_id,
      client_id: gesture.client_id,
      client_tx_id: gesture.client_tx_id,
      ops: [{ ...envelope, receipt_only: true }],
    },
  });
  if (error || !Array.isArray(data?.results) || data.results.length !== 1)
    return { status: "unavailable" };
  return receiptLookupResult(
    data.results[0] as SyncOperationResult,
    op,
    envelope,
  );
}
function receiptLookupResult(
  result: SyncOperationResult,
  op: Operation,
  envelope: Record<string, unknown>,
): ReceiptLookupV3 {
  if (
    result.op_id !== op.client_op_id ||
    result.client_op_id !== op.client_op_id ||
    result.domain_op_id !== envelope.domain_op_id
  )
    return { status: "unavailable" };
  if (
    (result.status === "APPLIED" ||
      (result.status === "CONFLICT" &&
        result.reason_code === "SANITARIO_OBLIGATION_COLLISION")) &&
    result.canonical_result
  )
    return { status: "found", canonicalResult: result.canonical_result };
  if (result.reason_code === "SANITARIO_RECEIPT_ABSENT")
    return { status: "absent" };
  return { status: "unavailable" };
}

function installedReceiptFor(
  op: Operation,
  envelope: Record<string, unknown>,
  receipt: ReceiptLookupV3,
): SyncOperationResult {
  const collision =
    receipt.canonicalResult?.confirmed === false &&
    receipt.canonicalResult?.outcome === "collision";
  return {
    op_id: op.client_op_id,
    client_op_id: op.client_op_id,
    domain_op_id: String(envelope.domain_op_id),
    status: collision ? "CONFLICT" : "APPLIED",
    ...(collision ? { reason_code: "SANITARIO_OBLIGATION_COLLISION" } : {}),
    retryable: false,
    canonical_entity_id: entityId(envelope),
    canonical_result: receipt.canonicalResult,
  };
}

/** Read-only classification plus receipt installation; never converts or sends a new write. */
export async function recoverSanitaryFoundation(
  fazendaId: string,
  dependencies: RecoveryDependenciesV3 = {
    ownership: getCurrentLocalReadOwnership,
    lookup: lookupReceipt,
  },
): Promise<{
  reconciled: number;
  preserved: number;
  conversionCandidates: number;
}> {
  const result = { reconciled: 0, preserved: 0, conversionCandidates: 0 };
  const ownership = await dependencies.ownership();
  const gestures = await db.queue_gestures
    .where("fazenda_id")
    .equals(fazendaId)
    .toArray();
  const byTx = new Map(gestures.map((g) => [g.client_tx_id, g]));
  const operations = (await db.queue_ops.toArray()).filter(
    (op) =>
      (byTx.has(op.client_tx_id) || op.record.fazenda_id === fazendaId) &&
      isSanitaryEvidenceOperation(op),
  );
  const inventory = {
    byCommand: {} as Record<string, number>,
    byState: {} as Record<string, number>,
    ownership: ownership.status,
  };
  for (const op of operations) {
    const command = String(op.record.command ?? "not_covered");
    const state = op.sync_state ?? "PENDING";
    inventory.byCommand[command] = (inventory.byCommand[command] ?? 0) + 1;
    inventory.byState[state] = (inventory.byState[state] ?? 0) + 1;
  }
  dependencies.onInventory?.(inventory);
  const queuedEvents = new Set(
    operations.map((op) => op.record?.payload?.event?.id).filter(Boolean),
  );
  const facts = await db.event_eventos
    .where("fazenda_id")
    .equals(fazendaId)
    .filter((e) => e.dominio === "sanitario")
    .toArray();
  // Local fact without its original queue/receipt is evidence, never a new send candidate.
  const acknowledged = new Set(
    gestures.flatMap((g) =>
      (g.operation_results ?? [])
        .filter((r) => r.status === "APPLIED")
        .map((r) => r.canonical_result?.evento_id),
    ),
  );
  result.preserved += facts.filter(
    (e) => !queuedEvents.has(e.id) && !acknowledged.has(e.id),
  ).length;
  for (const op of operations) {
    if (
      await recoverQueuedReceipt(op, byTx, ownership, fazendaId, dependencies)
    )
      result.reconciled++;
    else result.preserved++;
  }
  return result;
}

async function recoverQueuedReceipt(
  op: Operation,
  byTx: Map<string, Gesture>,
  ownership: LocalOwnershipDecision,
  fazendaId: string,
  dependencies: RecoveryDependenciesV3,
): Promise<boolean> {
  const gesture = byTx.get(op.client_tx_id);
  if (!gesture) {
    return false;
  }
  const envelope = originalEnvelope(op, gesture);
  const ownerMatches = ownership.status === "OWNED" && !!ownership.ownerUserId;
  if (!ownerMatches || !envelope) {
    return false;
  }
  const receipt = await readRecoveryReceipt(op, gesture, dependencies);
  const correspondence = receiptCorrespondence(envelope, receipt);
  const disposition = classifySanitaryRecovery({
    ownerMatches,
    originalEnvelope: op,
    receiptLookup: receipt,
    correspondence,
    incompatiblePendingProven: false,
  });
  if (disposition !== "install_receipt") {
    return false;
  }
  const currentOwnership = await dependencies.ownership();
  if (
    currentOwnership.status !== "OWNED" ||
    currentOwnership.ownerUserId !== ownership.ownerUserId
  ) {
    return false;
  }
  const installed = await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.queue_gestures,
      db.local_ownership,
      db.sync_reconcile_obligations,
    ],
    async () => {
      const current = await db.queue_ops.get(op.client_op_id);
      const currentGesture = await db.queue_gestures.get(op.client_tx_id);
      const owner = await db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
      if (
        owner?.owner_user_id !== ownership.ownerUserId ||
        currentGesture?.fazenda_id !== fazendaId ||
        currentGesture.status === "SYNCING" ||
        !current ||
        JSON.stringify(current) !== JSON.stringify(op)
      )
        return false;
      const installedReceipt = installedReceiptFor(op, envelope, receipt);
      await db.queue_ops.update(op.client_op_id, {
        sanitary_receipt: installedReceipt,
        sync_state: "RECONCILE",
        next_attempt_at: undefined,
      });
      await db.queue_gestures.update(op.client_tx_id, {
        status: "PENDING",
        completed_at: undefined,
        next_attempt_at: undefined,
      });
      await upsertReconciliationObligations([
        {
          fazendaId,
          scope: "sanitario-v2",
          origins: [
            {
              client_tx_id: op.client_tx_id,
              client_op_ids: [op.client_op_id],
            },
          ],
        },
      ]);
      return true;
    },
  );
  return installed;
}

async function readRecoveryReceipt(
  op: Operation,
  gesture: Gesture,
  dependencies: RecoveryDependenciesV3,
): Promise<ReceiptLookupV3> {
  try {
    return op.sanitary_receipt?.canonical_result
      ? {
          status: "found",
          canonicalResult: op.sanitary_receipt.canonical_result,
        }
      : await dependencies.lookup(op, gesture);
  } catch {
    return { status: "unavailable" };
  }
}
function receiptCorrespondence(
  envelope: Record<string, unknown>,
  receipt: ReceiptLookupV3,
) {
  return receipt.status === "found" &&
    canonicalEntity(envelope.command, receipt.canonicalResult ?? {}) !==
      entityId(envelope)
    ? "ambiguous"
    : "exact";
}
