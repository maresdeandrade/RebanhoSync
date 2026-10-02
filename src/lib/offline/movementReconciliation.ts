import { db } from "./db";
import { supabase } from "@/lib/supabase";
import { pullDataForFarm } from "./pull";
import { isMovementOperation } from "./movement";
import { upsertReconciliationObligations } from "./reconciliationObligations";
import type { Gesture, Operation, SyncOperationResult } from "./types";

export function hasRejectedMovement(gesture: Gesture) {
  return (
    gesture.operation_results?.some(
      (row) =>
        (row.movement_effective_result ||
          row.canonical_result?.command_digest) &&
        [
          "PROJECTION_CONFLICT",
          "HISTORY_CONFLICT",
          "CONFLICT",
          "REJECTED",
        ].includes(
          row.movement_effective_result ??
            String(row.canonical_result?.status ?? row.status),
        ),
    ) ?? false
  );
}

export async function recordMovementResults(
  gesture: Gesture,
  ops: Operation[],
  results: SyncOperationResult[],
  keepSyncing = false,
) {
  const movement = ops.filter(isMovementOperation);
  if (!movement.length) return false;
  await db.transaction(
    "rw",
    db.queue_ops,
    db.queue_gestures,
    db.sync_reconcile_obligations,
    async () => {
      const audit =
        (await db.queue_gestures.get(gesture.client_tx_id))
          ?.operation_results ?? [];
      for (const op of movement) {
        const result = results.find((r) => r.op_id === op.client_op_id);
        if (!result || result.status === "RETRYABLE") {
          await db.queue_ops.update(op.client_op_id, {
            sync_state: "RETRYABLE",
            retry_count: (op.retry_count ?? 0) + 1,
            next_attempt_at: new Date(Date.now() + 5000).toISOString(),
          });
          continue;
        }
        if (
          !["APPLIED", "CONFLICT", "REJECTED", "BLOCKED_DEPENDENCY"].includes(
            result.status,
          )
        )
          throw new Error("MOVEMENT_RESULT_INVALID");
        const receipt = result.canonical_result;
        if (!receipt && result.status !== "REJECTED")
          throw new Error("MOVEMENT_RECEIPT_REQUIRED");
        if (
          receipt &&
          (receipt.event_id !== op.record.event_id ||
            receipt.client_op_id !== op.client_op_id ||
            receipt.client_tx_id !== op.client_tx_id ||
            receipt.fazenda_id !== gesture.fazenda_id ||
            receipt.command_digest !== op.command_digest)
        )
          throw new Error("MOVEMENT_RECEIPT_IDENTITY_MISMATCH");
        await db.queue_ops.update(op.client_op_id, {
          movement_result: op.movement_result ?? result,
          sync_state:
            result.status === "BLOCKED_DEPENDENCY"
              ? "BLOCKED_DEPENDENCY"
              : "RECONCILE",
          next_attempt_at: undefined,
        });
        if (!audit.some((r) => r.op_id === op.client_op_id))
          audit.push({
            ...result,
            matched: true,
            recorded_at: new Date().toISOString(),
          });
      }
      await upsertReconciliationObligations([
        { fazendaId: gesture.fazenda_id, scope: "movement-v1" },
      ]);
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: keepSyncing ? "SYNCING" : "PENDING",
        operation_results: audit,
      });
    },
  );
  return true;
}

export async function reconcileMovementForFarm(farm: string) {
  const operations = (await db.queue_ops.toArray()).filter(
    (op) => isMovementOperation(op) && op.record.fazenda_id === farm,
  );
  const blocked = operations.filter(
    (op) => op.sync_state === "BLOCKED_DEPENDENCY",
  );
  if (blocked.length) {
    // Targeted lookup of obligations, not a receipt timestamp cursor: sees late decisions.
    const { data, error } = await supabase
      .from("animal_lot_movement_effective_results")
      .select("*")
      .eq("fazenda_id", farm)
      .in(
        "event_id",
        blocked.map((op) => op.record.event_id),
      );
    if (error) throw error;
    const decisions = await supabase
      .from("animal_lot_movement_effect_decisions")
      .select("*")
      .eq("fazenda_id", farm)
      .in(
        "event_id",
        blocked.map((op) => op.record.event_id),
      );
    if (decisions.error) throw decisions.error;
    for (const op of blocked) {
      const row = data?.find((item) => item.event_id === op.record.event_id);
      if (!row || row.effective_result === "PENDING_CAUSAL_DEPENDENCY")
        continue;
      if (
        row.command_digest !== op.command_digest ||
        row.animal_id !== op.record.subject_id ||
        !["STATE_APPLIED", "PROJECTION_CONFLICT", "HISTORY_CONFLICT"].includes(
          row.effective_result,
        )
      )
        throw new Error("MOVEMENT_EFFECT_IDENTITY_MISMATCH");
      const decision = decisions.data?.find(
        (item) => item.event_id === op.record.event_id,
      );
      if (
        !decision ||
        decision.fazenda_id !== farm ||
        decision.result !== row.effective_result
      )
        throw new Error("MOVEMENT_EFFECT_DECISION_REQUIRED");
      await db.queue_ops.update(op.client_op_id, {
        sync_state: "RECONCILE",
        movement_effective_result: row.effective_result,
        movement_effective_decision: decision,
      });
    }
  }
  // Terminal ACKs stop protecting optimistic rows; unsent/retryable/pending intents stay protected.
  await pullDataForFarm(farm, ["animais", "eventos", "eventos_movimentacao"], {
    mode: "merge",
  });
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.queue_gestures,
      db.queue_rejections,
      db.event_eventos,
      db.event_eventos_movimentacao,
    ],
    async () => {
      const current = (await db.queue_ops.toArray()).filter(
        (op) =>
          isMovementOperation(op) &&
          op.record.fazenda_id === farm &&
          op.sync_state === "RECONCILE",
      );
      for (const op of current) {
        const result = op.movement_result!;
        const effective =
          op.movement_effective_result ??
          String(result.canonical_result?.status ?? result.status);
        const rejected = [
          "PROJECTION_CONFLICT",
          "HISTORY_CONFLICT",
          "CONFLICT",
          "REJECTED",
        ].includes(effective);
        if (effective === "REJECTED") {
          await db.event_eventos.delete(op.record.event_id);
          await db.event_eventos_movimentacao.delete(op.record.event_id);
        }
        if (rejected)
          await db.queue_rejections.add({
            client_tx_id: op.client_tx_id,
            client_op_id: op.client_op_id,
            fazenda_id: farm,
            table: "movement_v1",
            action: "INSERT",
            reason_code: String(
              op.movement_effective_decision?.reason_code ??
                result.reason_code ??
                effective,
            ),
            reason_message:
              "Movimentação reconciliada; nova intenção exige ação explícita",
            created_at: new Date().toISOString(),
            payload: { original_result: result, effective_result: effective },
          });
        const gesture = await db.queue_gestures.get(op.client_tx_id);
        await db.queue_ops.delete(op.client_op_id);
        const remaining = await db.queue_ops
          .where("client_tx_id")
          .equals(op.client_tx_id)
          .count();
        if (gesture) {
          const operationResults = gesture.operation_results?.map((row) =>
            row.op_id === op.client_op_id
              ? {
                  ...row,
                  movement_effective_result: effective,
                  movement_effective_decision: op.movement_effective_decision,
                }
              : row,
          );
          const gestureRejected =
            rejected ||
            hasRejectedMovement({
              ...gesture,
              operation_results: operationResults,
            });
          await db.queue_gestures.update(op.client_tx_id, {
            operation_results: operationResults,
            ...(remaining === 0
              ? {
                  status: gestureRejected ? "REJECTED" : "DONE",
                  sync_result: gestureRejected ? "REJECTED" : "APPLIED",
                  completed_at: new Date().toISOString(),
                }
              : {}),
          });
        }
      }
    },
  );
  if (
    (await db.queue_ops.toArray()).some(
      (op) => isMovementOperation(op) && op.record.fazenda_id === farm,
    )
  )
    throw new Error("MOVEMENT_RECONCILIATION_PENDING");
}
