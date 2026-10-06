import { db } from "./db";
import { supabase } from "@/lib/supabase";
import { pullDataForFarm } from "./pull";
import { isMovementOperation } from "./movement";
import { upsertReconciliationObligations } from "./reconciliationObligations";
import { recordAcknowledgement, recordDrainCompletion } from "./syncDiagnostics";
import type { Gesture, Operation, SyncOperationResult } from "./types";

function assertMovementResultIdentity(
  gesture: Gesture,
  op: Operation,
  result: SyncOperationResult,
) {
  const identity = result.operation_identity;
  const expected = {
    event_id: op.record.event_id,
    client_op_id: op.client_op_id,
    client_tx_id: op.client_tx_id,
    fazenda_id: gesture.fazenda_id,
  };
  if (
    !identity ||
    op.record.fazenda_id !== gesture.fazenda_id ||
    Object.entries(expected).some(
      ([key, value]) => identity[key as keyof typeof identity] !== value,
    )
  )
    throw new Error("MOVEMENT_RECEIPT_IDENTITY_MISMATCH");
}

function assertMovementReceipt(
  gesture: Gesture,
  op: Operation,
  result: SyncOperationResult,
) {
  if (
    !["APPLIED", "CONFLICT", "REJECTED", "BLOCKED_DEPENDENCY"].includes(
      result.status,
    )
  )
    throw new Error("MOVEMENT_RESULT_INVALID");
  const receipt = result.canonical_result;
  if (!receipt && !["REJECTED", "CONFLICT"].includes(result.status))
    throw new Error("MOVEMENT_RECEIPT_REQUIRED");
  assertMovementResultIdentity(gesture, op, result);
  if (receipt && mismatchedReceiptFields(op, result))
    throw new Error("MOVEMENT_RECEIPT_IDENTITY_MISMATCH");
}

function mismatchedReceiptFields(op: Operation, result: SyncOperationResult) {
  const receipt = result.canonical_result!;
  const expected: Record<string, unknown> = {
    ...result.operation_identity,
    command_digest: op.command_digest,
  };
  return [
    "event_id",
    "fazenda_id",
    "client_op_id",
    "client_tx_id",
    "command_digest",
  ].some((key) => receipt[key] !== undefined && receipt[key] !== expected[key]);
}

function matchesCapturedMovement(
  op: Operation | undefined,
  captured: Operation,
): op is Operation {
  return !(
    !op ||
    op.sync_state !== "RECONCILE" ||
    op.client_tx_id !== captured.client_tx_id ||
    op.record.event_id !== captured.record.event_id ||
    op.command_digest !== captured.command_digest ||
    JSON.stringify(op.movement_result) !==
      JSON.stringify(captured.movement_result) ||
    op.movement_effective_result !== captured.movement_effective_result
  );
}

type RemoteMovementLookup = (
  table: string,
  key: string,
  id: unknown,
) => Record<string, unknown> | undefined;

function observedMovementFact(
  op: Operation,
  effective: string,
  event: Record<string, unknown> | undefined,
  detail: Record<string, unknown> | undefined,
  effect: Record<string, unknown> | undefined,
): effect is Record<string, unknown> {
  return !(
    !event ||
    !detail ||
    !effect ||
    effect.animal_id !== op.record.subject_id ||
    effect.command_digest !== op.command_digest ||
    effect.effective_result !== effective
  );
}

function protectsCapturedAnimal(op: Operation, captured: Operation) {
  return (
    (isMovementOperation(op) &&
      op.record.subject_id === captured.record.subject_id) ||
    (op.table === "animais" && op.record.id === captured.record.subject_id)
  );
}

function observedMovementDecision(
  op: Operation,
  effective: string,
  decision: Record<string, unknown> | undefined,
) {
  return !(
    op.movement_effective_result &&
    (!decision || decision.result !== effective)
  );
}

function hasUninstalledAnimalIntent(
  pending: Operation[],
  selected: Set<string>,
  farm: string,
  captured: Operation,
) {
  return pending.some(
    (op) =>
      !selected.has(op.client_op_id) &&
      op.sync_state !== "REJECTED" &&
      op.record.fazenda_id === farm &&
      protectsCapturedAnimal(op, captured),
  );
}

function capturedMovementOutcome(op: Operation) {
  return (
    op.movement_effective_result ??
    String(
      op.movement_result?.canonical_result?.status ??
        op.movement_result?.status,
    )
  );
}

function observedMovementResult(
  op: Operation,
  effective: string,
  remote: RemoteMovementLookup,
) {
  const state = remote("animais", "id", op.record.subject_id);
  if (!state) return false;
  if (!["REJECTED", "CONFLICT"].includes(effective)) {
    const effect = remote(
      "animal_lot_movement_effective_results",
      "event_id",
      op.record.event_id,
    );
    const event = remote("eventos", "id", op.record.event_id);
    const detail = remote(
      "eventos_movimentacao",
      "evento_id",
      op.record.event_id,
    );
    if (!observedMovementFact(op, effective, event, detail, effect))
      return false;
    const decision = remote(
      "animal_lot_movement_effect_decisions",
      "event_id",
      op.record.event_id,
    );
    if (!observedMovementDecision(op, effective, decision)) return false;
    const version = effect.effective_movement_version_after;
    if (
      version == null ||
      state.movement_version == null ||
      BigInt(String(state.movement_version)) < BigInt(String(version))
    )
      return false;
  }
  return true;
}

async function completeMovementGesture(
  gesture: Gesture,
  op: Operation,
  effective: string,
  rejected: boolean,
  remaining: number,
) {
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

function movementRejectionReason(
  op: Operation,
  result: SyncOperationResult,
  effective: string,
) {
  return String(
    op.movement_effective_decision?.reason_code ??
      result.reason_code ??
      effective,
  );
}

async function completeCapturedMovement(farm: string, op: Operation) {
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
      reason_code: movementRejectionReason(op, result, effective),
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
  if (gesture)
    await completeMovementGesture(gesture, op, effective, rejected, remaining);
}

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

async function recordMovementResult(
  gesture: Gesture,
  op: Operation,
  results: SyncOperationResult[],
  audit: NonNullable<Gesture["operation_results"]>,
) {
  const result = results.find((r) => r.op_id === op.client_op_id);
  if (result) assertMovementResultIdentity(gesture, op, result);
  if (!result || result.status === "RETRYABLE") {
    await db.queue_ops.update(op.client_op_id, {
      sync_state: "RETRYABLE",
      retry_count: (op.retry_count ?? 0) + 1,
      next_attempt_at: new Date(Date.now() + 5000).toISOString(),
    });
    return;
  }
  assertMovementReceipt(gesture, op, result);
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
      for (const op of movement)
        await recordMovementResult(gesture, op, results, audit);
      await upsertReconciliationObligations([
        { fazendaId: gesture.fazenda_id, scope: "movement-v1",
          origins: [{ client_tx_id: gesture.client_tx_id,
            client_op_ids: movement.filter(op => results.some(result => result.op_id === op.client_op_id))
              .map(op => op.client_op_id) }] },
      ]);
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: keepSyncing ? "SYNCING" : "PENDING",
        operation_results: audit,
      });
    },
  );
  await recordAcknowledgement(gesture.client_tx_id, gesture.fazenda_id);
  return true;
}

function assertResolvedMovementIdentity(
  op: Operation,
  farm: string,
  row: { command_digest: string; animal_id: string; effective_result: string },
  decision: Record<string, unknown> | undefined,
) {
  if (
    row.command_digest !== op.command_digest ||
    row.animal_id !== op.record.subject_id ||
    !["STATE_APPLIED", "PROJECTION_CONFLICT", "HISTORY_CONFLICT"].includes(
      row.effective_result,
    )
  )
    throw new Error("MOVEMENT_EFFECT_IDENTITY_MISMATCH");
  if (
    !decision ||
    decision.fazenda_id !== farm ||
    decision.result !== row.effective_result
  )
    throw new Error("MOVEMENT_EFFECT_DECISION_REQUIRED");
}

async function resolveBlockedMovements(farm: string, blocked: Operation[]) {
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
    if (!row || row.effective_result === "PENDING_CAUSAL_DEPENDENCY") continue;
    const decision = decisions.data?.find(
      (item) => item.event_id === op.record.event_id,
    );
    assertResolvedMovementIdentity(op, farm, row, decision);
    await db.queue_ops.update(op.client_op_id, {
      sync_state: "RECONCILE",
      movement_effective_result: row.effective_result,
      movement_effective_decision: decision,
    });
  }
}

export async function reconcileMovementForFarm(farm: string) {
  const operations = (await db.queue_ops.toArray()).filter(
    (op) => isMovementOperation(op) && op.record.fazenda_id === farm,
  );
  const blocked = operations.filter(
    (op) => op.sync_state === "BLOCKED_DEPENDENCY",
  );
  if (blocked.length) await resolveBlockedMovements(farm, blocked);
  // Capture durable identities before any remote reads. A later ACK changes the
  // obligation generation and cannot be completed or installed by this pull.
  const snapshot = await db.transaction(
    "r",
    [db.queue_ops, db.sync_reconcile_obligations],
    async () => ({
      obligation: await db.sync_reconcile_obligations.get(
        `${farm}:movement-v1`,
      ),
      ops: (await db.queue_ops.toArray()).filter(
        (op) =>
          isMovementOperation(op) &&
          op.record.fazenda_id === farm &&
          op.sync_state === "RECONCILE",
      ),
    }),
  );
  const observations = {
    animais: {
      key: "id",
      ids: [...new Set(snapshot.ops.map((op) => String(op.record.subject_id)))],
    },
    eventos: {
      key: "id",
      ids: snapshot.ops.map((op) => String(op.record.event_id)),
    },
    eventos_movimentacao: {
      key: "evento_id",
      ids: snapshot.ops.map((op) => String(op.record.event_id)),
    },
    animal_lot_movement_effective_results: {
      key: "event_id",
      ids: snapshot.ops.map((op) => String(op.record.event_id)),
    },
    animal_lot_movement_effect_decisions: {
      key: "event_id",
      ids: snapshot.ops.map((op) => String(op.record.event_id)),
    },
  };
  let deletedByInstallation = false;
  await pullDataForFarm(farm, ["animais", "eventos", "eventos_movimentacao"], {
    mode: "merge",
    observations,
    reconciliation: {
      stores: [
        "queue_gestures",
        "queue_rejections",
        "sync_reconcile_obligations",
      ],
      async select(rows) {
        const selected = new Set<string>();
        const obligation = await db.sync_reconcile_obligations.get(
          `${farm}:movement-v1`,
        );
        if (
          !snapshot.obligation ||
          obligation?.generation_id !== snapshot.obligation.generation_id
        )
          return selected;
        const remote = (table: string, key: string, id: unknown) =>
          (rows[table] as Record<string, unknown>[]).find(
            (row) => row[key] === id && row.fazenda_id === farm,
          );
        for (const captured of snapshot.ops) {
          const op = await db.queue_ops.get(captured.client_op_id);
          if (!matchesCapturedMovement(op, captured)) continue;
          const effective = capturedMovementOutcome(op);
          if (!observedMovementResult(op, effective, remote)) continue;
          selected.add(op.client_op_id);
        }
        // A newer intent for the same animal still protects its optimistic row.
        // Do not complete an ACK if that protection prevents installing its state.
        const pending = await db.queue_ops.toArray();
        for (const captured of snapshot.ops) {
          if (hasUninstalledAnimalIntent(pending, selected, farm, captured))
            selected.delete(captured.client_op_id);
        }
        return selected;
      },
      async complete(selected) {
        const current = snapshot.ops.filter((op) =>
          selected.has(op.client_op_id),
        );
        for (const op of current) await completeCapturedMovement(farm, op);
        if (
          !(await db.queue_ops.toArray()).some(
            (op) => isMovementOperation(op) && op.record.fazenda_id === farm,
          )
        ) {
          const obligation = await db.sync_reconcile_obligations.get(
            `${farm}:movement-v1`,
          );
          if (
            snapshot.obligation &&
            obligation?.generation_id === snapshot.obligation.generation_id
          ) {
            await db.sync_reconcile_obligations.delete(obligation.key);
            deletedByInstallation = true;
          }
        }
      },
    },
  });
  // The pull promise resolves only after the local installation has committed.
  if (deletedByInstallation && snapshot.obligation)
    await recordDrainCompletion(snapshot.obligation, true);
  if (
    (await db.queue_ops.toArray()).some(
      (op) => isMovementOperation(op) && op.record.fazenda_id === farm,
    )
  )
    throw new Error("MOVEMENT_RECONCILIATION_PENDING");
}
