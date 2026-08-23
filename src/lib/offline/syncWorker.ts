import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type {
  Gesture,
  Operation,
  Rejection,
  SanitarioSyncV2Command,
  SanitarioSyncV2ResultStatus,
  SyncOperationAuditResult,
  SyncOperationResult,
} from "./types";
import { getRemoteTableName } from "./tableMap";
import { normalizeTableMutationRecord } from "./mutationRecord";
import { getAffectedStores, reapplyOpLocal, rollbackOpLocal } from "./ops";
import { sortOpsForSync } from "./syncOrder";
import {
  mergeOperationAudit,
  planOperationReconciliation,
} from "./syncReconciliation";
import {
  pullDataForFarm,
  pullInitialData,
  pullSanitarioAgendaV2,
  pullSanitarioV2CutoverState,
} from "./pull";
import { purgeRejections } from "./rejections";
import {
  flushPilotMetrics,
  trackPilotMetric,
} from "@/lib/telemetry/pilotMetrics";
import { getActiveFarmId } from "@/lib/storage";
import { pullReproductionDiagnosisState } from "@/lib/reproduction/remoteSync";
import {
  buildCommercialPurchaseEnvelope,
  isCommercialPurchaseEnvelope,
} from "@/lib/comercial/animalPurchaseSync";
import {
  buildCommercialOperationEnvelope,
  isCommercialOperationEnvelope,
} from "@/lib/comercial/commercialOperationSync";

let intervalId: ReturnType<typeof setInterval> | null = null;
let isTickRunning = false;
let startupRecoveryDone = false;
let initialPullFarmId: string | null = null;
let isInitialPullRunning = false;

const WORKER_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;
const RECOVERABLE_ERROR_MARKERS = [
  "HTTP 401",
  "Invalid JWT",
  "Unauthorized - invalid JWT",
  "HTTP 502",
  "HTTP 503",
  "HTTP 504",
  "Failed to fetch",
  "NetworkError",
  "fetch failed",
  "name resolution failed",
];
const AGENDA_ALREADY_COMPLETED_REASON = "agenda_already_completed_by_event";
const SANITARIO_AGENDA_CLOSURE_CONFLICT_REASON =
  "sanitario_agenda_closure_already_exists";
const SANITARIO_AGENDA_V2_REMOTE_TABLES = new Set([
  "sanitario_agenda_v2",
  "sanitario_agenda_animais_v2",
  "sanitario_agenda_closures_v2",
]);
const SANITARIO_CANONICAL_STATUSES = new Set<SanitarioSyncV2ResultStatus>([
  "APPLIED",
  "RETRYABLE",
  "REJECTED",
  "CONFLICT",
  "BLOCKED_DEPENDENCY",
]);
const SYNCED_REPRODUCTION_TYPES = new Set(["diagnostico", "parto", "aborto"]);
const SANITARIO_RETRY_BASE_MS = 5_000;
const SANITARIO_RETRY_MAX_MS = 5 * 60_000;

// Auto-purge: run at most once every 6 hours, persisted across reloads
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PURGE_LS_KEY = "rebanhosync:lastRejectionPurgeAt";

interface SyncBatchResponse {
  results: SyncOperationResult[];
}

export const startSyncWorker = () => {
  if (intervalId) return;

  if (import.meta.env.DEV) {
    console.debug("[sync-worker] Starting sync worker");
  }
  void runInitialOfflinePullForActiveFarmOnce();
  intervalId = setInterval(async () => {
    if (isTickRunning) return;
    isTickRunning = true;

    try {
      await runInitialOfflinePullForActiveFarmOnce();

      if (!startupRecoveryDone) {
        await recoverErroredGesturesOnce();
        await recoverBlockedSanitarioV2Operations("app_startup");
        startupRecoveryDone = true;
      }

      const pending = await db.queue_gestures
        .where("status")
        .equals("PENDING")
        .sortBy("created_at");

      for (const gesture of pending) {
        try {
          await processGesture(gesture);
        } catch (e: unknown) {
          const error = e instanceof Error ? e : new Error(String(e));
          console.error("[sync-worker] Error processing gesture:", error);

          await db.queue_gestures.update(gesture.client_tx_id, {
            status: "ERROR",
            sync_result: "ERROR",
            completed_at: new Date().toISOString(),
            last_error: error.message,
          });
        }
      }

      // Flush pilot metrics (non-blocking)
      try {
        const pendingCount = pending.length;
        if (pendingCount > 0) {
          // Pick the fazenda_id of the first pending gesture (if there are multiple, it's fine, it's just telemetry)
          await trackPilotMetric({
            fazendaId: pending[0].fazenda_id,
            eventName: "sync_backlog",
            status: "info",
            quantity: pendingCount,
          });
        }
        await flushPilotMetrics();
      } catch (e) {
        console.warn("[sync-worker] telemetry flush error", e);
      }

      // Auto-purge old rejections (>7d) at most once per 6h
      await tryPurgeOldRejections();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error("[sync-worker] Worker tick failed:", error.message);
    } finally {
      isTickRunning = false;
    }
  }, WORKER_INTERVAL_MS);
};

export const stopSyncWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  isTickRunning = false;
  startupRecoveryDone = false;
};

export async function runInitialOfflinePullForActiveFarmOnce() {
  const activeFarmId = getActiveFarmId();
  if (
    !activeFarmId ||
    initialPullFarmId === activeFarmId ||
    isInitialPullRunning
  ) {
    return;
  }

  isInitialPullRunning = true;
  try {
    await pullInitialData(activeFarmId);
    await pullReproductionDiagnosisState(activeFarmId);
    initialPullFarmId = activeFarmId;
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.warn("[sync-worker] Initial offline pull failed:", error.message);
  } finally {
    isInitialPullRunning = false;
  }
}

async function tryPurgeOldRejections() {
  try {
    // Guard: skip in environments without localStorage (SSR, some workers)
    if (typeof localStorage === "undefined") return;

    const lastPurge = Number(localStorage.getItem(PURGE_LS_KEY) || "0");
    if (Date.now() - lastPurge < PURGE_INTERVAL_MS) return;

    const result = await purgeRejections({ olderThanDays: 7 });

    localStorage.setItem(PURGE_LS_KEY, String(Date.now()));

    if (import.meta.env.DEV && result.deletedCount > 0) {
      console.debug(
        `[sync-worker] Purged ${result.deletedCount} old rejection(s)`,
      );
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.warn("[sync-worker] Auto-purge failed (non-fatal):", error.message);
  }
}

function isRecoverableSyncError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  const normalizedMessage = errorMessage.toLowerCase();
  return RECOVERABLE_ERROR_MARKERS.some((marker) =>
    normalizedMessage.includes(marker.toLowerCase()),
  );
}

function isNonRetryableSyncError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  const normalizedMessage = errorMessage.toLowerCase();
  return (
    normalizedMessage.includes("http 403") ||
    normalizedMessage.includes("forbidden - no access to this farm")
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSanitarioCanonicalResult(
  result: SyncOperationResult,
): result is SyncOperationResult & { status: SanitarioSyncV2ResultStatus } {
  if (
    !SANITARIO_CANONICAL_STATUSES.has(
      result.status as SanitarioSyncV2ResultStatus,
    )
  ) {
    return false;
  }

  return (
    typeof result.domain_op_id === "string" ||
    typeof result.canonical_entity_id === "string" ||
    typeof result.current_revision === "number" ||
    typeof result.canonical_status === "string" ||
    isRecord(result.canonical_result)
  );
}

function readSanitarioCommand(
  op: Operation,
  result: SyncOperationResult,
): SanitarioSyncV2Command | undefined {
  const record = isRecord(op.record) ? op.record : {};
  const canonical = isRecord(result.canonical_result)
    ? result.canonical_result
    : {};
  const candidate = record.command ?? canonical.command;

  return candidate === "create_agenda" ||
    candidate === "replace_agenda_animals" ||
    candidate === "apply_factual_core" ||
    candidate === "close_agenda"
    ? candidate
    : undefined;
}

function getSanitarioRetryUpdate(op: Operation, nowMs: number, reason: string) {
  const retryCount = (op.retry_count ?? 0) + 1;
  const backoffMs = Math.min(
    SANITARIO_RETRY_BASE_MS * 2 ** Math.min(retryCount - 1, 8),
    SANITARIO_RETRY_MAX_MS,
  );

  return {
    domain_op_id: op.domain_op_id,
    sync_state: "RETRYABLE" as const,
    retry_count: retryCount,
    next_attempt_at: new Date(nowMs + backoffMs).toISOString(),
    blocked_reason: reason,
  };
}

function isOperationReadyForSync(op: Operation, nowMs = Date.now()) {
  if (op.sync_state === "BLOCKED_DEPENDENCY") return false;
  if (!op.next_attempt_at) return true;

  const nextAttemptAt = Date.parse(op.next_attempt_at);
  return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= nowMs;
}

function buildMinimalRejectionPayload(result: SyncOperationResult) {
  return {
    status: result.status,
    ...(result.domain_op_id ? { domain_op_id: result.domain_op_id } : {}),
    ...(result.canonical_entity_id
      ? { canonical_entity_id: result.canonical_entity_id }
      : {}),
    ...(typeof result.current_revision === "number"
      ? { current_revision: result.current_revision }
      : {}),
    ...(result.canonical_status
      ? { canonical_status: result.canonical_status }
      : {}),
  };
}

async function reconcileSanitarioV2Results(
  fazendaId: string,
  matched: Array<{
    op: Operation;
    result: SyncOperationResult & { status: SanitarioSyncV2ResultStatus };
  }>,
) {
  let pullAgenda = false;
  let pullFactual = false;

  for (const { op, result } of matched) {
    if (result.status !== "APPLIED" && result.status !== "CONFLICT") continue;

    const command = readSanitarioCommand(op, result);
    const canonical = isRecord(result.canonical_result)
      ? result.canonical_result
      : {};
    const hasAgendaEntity =
      typeof canonical.agenda_id === "string" ||
      typeof canonical.closure_id === "string";
    const hasFactualEntity = typeof canonical.evento_id === "string";

    if (
      command === "create_agenda" ||
      command === "replace_agenda_animals" ||
      command === "close_agenda" ||
      hasAgendaEntity
    ) {
      pullAgenda = true;
    }
    if (command === "apply_factual_core" || hasFactualEntity) {
      pullFactual = true;
      pullAgenda = true;
    }
    if (
      result.status === "CONFLICT" &&
      !hasAgendaEntity &&
      !hasFactualEntity &&
      (!result.canonical_entity_id || !command)
    ) {
      pullAgenda = true;
      pullFactual = true;
    }
  }

  if (pullAgenda || pullFactual) {
    try {
      await pullSanitarioV2CutoverState(fazendaId);
      const justBlocked = new Set(
        matched
          .filter(({ result }) => result.status === "BLOCKED_DEPENDENCY")
          .map(({ op }) => op.client_op_id),
      );
      await recoverBlockedSanitarioV2Operations(
        "reconcile_completed",
        justBlocked,
      );
    } catch (error) {
      console.warn(
        "[sync-worker] sanitario v2 ordered reconcile failed:",
        error,
      );
    }
  }
}

async function processSanitarioCanonicalResults(
  gesture: Gesture,
  sentOps: Operation[],
  results: SyncOperationResult[],
) {
  const sanitarioOpIds = new Set(
    sentOps
      .filter(
        (op) => isRecord(op.record) && op.record.domain === "sanitario_v2",
      )
      .map((op) => op.client_op_id),
  );
  const canonicalResults = results.filter(isSanitarioCanonicalResult);
  if (canonicalResults.length === 0) return false;

  const nowMs = Date.now();
  const recordedAt = new Date(nowMs).toISOString();
  const deleteIds = new Set<string>();
  const matchedOpIds = new Set<string>();
  const audits: SyncOperationAuditResult[] = [];
  const rejections: Rejection[] = [];
  const matchedForReconcile: Array<{
    op: Operation;
    result: SyncOperationResult & { status: SanitarioSyncV2ResultStatus };
  }> = [];
  const operationUpdates = new Map<string, Record<string, unknown>>();
  let terminalRejection = false;

  for (const result of canonicalResults) {
    const resultOpId = typeof result.op_id === "string" ? result.op_id : "";
    const identifiersDiverge =
      typeof result.client_op_id === "string" &&
      result.client_op_id !== resultOpId;
    const op = identifiersDiverge
      ? undefined
      : sentOps.find((candidate) => candidate.client_op_id === resultOpId);
    const command = op ? readSanitarioCommand(op, result) : undefined;

    audits.push({
      ...result,
      op_id: resultOpId,
      matched: Boolean(op),
      recorded_at: recordedAt,
      command,
      local_reason_code: op
        ? undefined
        : identifiersDiverge
          ? "SYNC_RESULT_ID_MISMATCH"
          : "SYNC_RESULT_OP_NOT_FOUND",
    });

    if (!op) {
      console.warn("[sync-worker] Ignoring unmatched sanitario v2 result", {
        op_id: resultOpId,
        client_op_id: result.client_op_id,
        domain_op_id: result.domain_op_id,
        status: result.status,
      });
      continue;
    }

    matchedOpIds.add(op.client_op_id);
    matchedForReconcile.push({ op, result });

    if (result.status === "APPLIED") {
      deleteIds.add(op.client_op_id);
      continue;
    }

    if (result.status === "RETRYABLE") {
      operationUpdates.set(op.client_op_id, {
        ...getSanitarioRetryUpdate(
          {
            ...op,
            domain_op_id: result.domain_op_id ?? op.domain_op_id,
          },
          nowMs,
          result.reason_code ?? "SANITARIO_SYNC_V2_RETRYABLE",
        ),
        domain_op_id: result.domain_op_id ?? op.domain_op_id,
      });
      continue;
    }

    if (result.status === "BLOCKED_DEPENDENCY") {
      operationUpdates.set(op.client_op_id, {
        domain_op_id: result.domain_op_id ?? op.domain_op_id,
        sync_state: "BLOCKED_DEPENDENCY",
        next_attempt_at: undefined,
        blocked_reason:
          result.reason_code ?? "SANITARIO_SYNC_V2_DEPENDENCY_UNAVAILABLE",
      });
      continue;
    }

    terminalRejection = true;
    deleteIds.add(op.client_op_id);
    rejections.push({
      client_tx_id: gesture.client_tx_id,
      client_op_id: op.client_op_id,
      fazenda_id: gesture.fazenda_id,
      table: op.table,
      action: op.action,
      reason_code: result.reason_code ?? `SANITARIO_SYNC_V2_${result.status}`,
      reason_message:
        result.reason_message ?? `sanitario_v2 result: ${result.status}`,
      domain_op_id: result.domain_op_id,
      result_status: result.status,
      current_revision: result.current_revision,
      canonical_status: result.canonical_status,
      canonical_entity_id: result.canonical_entity_id,
      payload: buildMinimalRejectionPayload(result),
      created_at: recordedAt,
    });
  }

  for (const op of sentOps) {
    if (!sanitarioOpIds.has(op.client_op_id)) {
      const result = results.find((entry) => entry.op_id === op.client_op_id);
      if (
        result?.status === "APPLIED" ||
        result?.status === "APPLIED_ALTERED"
      ) {
        deleteIds.add(op.client_op_id);
      } else {
        operationUpdates.set(
          op.client_op_id,
          getSanitarioRetryUpdate(
            op,
            nowMs,
            result?.reason_code ?? "SYNC_MIXED_RESULT_NOT_APPLIED",
          ),
        );
      }
      continue;
    }
    if (matchedOpIds.has(op.client_op_id)) continue;

    operationUpdates.set(
      op.client_op_id,
      getSanitarioRetryUpdate(op, nowMs, "SYNC_RESULT_MISSING"),
    );
  }

  await db.transaction(
    "rw",
    [db.queue_gestures, db.queue_ops, db.queue_rejections],
    async () => {
      if (deleteIds.size > 0) {
        await db.queue_ops.bulkDelete(Array.from(deleteIds));
      }
      for (const [clientOpId, update] of operationUpdates) {
        await db.queue_ops.update(clientOpId, update);
      }
      if (rejections.length > 0) {
        await db.queue_rejections.bulkAdd(rejections);
      }

      const remaining = await db.queue_ops
        .where("client_tx_id")
        .equals(gesture.client_tx_id)
        .toArray();
      const hasRetryable = remaining.some(
        (op) => op.sync_state === "RETRYABLE",
      );
      const hasBlocked = remaining.some(
        (op) => op.sync_state === "BLOCKED_DEPENDENCY",
      );
      const operationResults = mergeOperationAudit(
        gesture.operation_results,
        audits,
      );

      if (remaining.length === 0) {
        await db.queue_gestures.update(gesture.client_tx_id, {
          status: terminalRejection ? "REJECTED" : "DONE",
          sync_result: terminalRejection ? "REJECTED" : "APPLIED",
          completed_at: recordedAt,
          last_error: terminalRejection
            ? "sanitario_v2 completed with rejection or conflict"
            : undefined,
          operation_results: operationResults,
        });
      } else if (hasRetryable) {
        await db.queue_gestures.update(gesture.client_tx_id, {
          status: "PENDING",
          sync_result: undefined,
          completed_at: undefined,
          retry_count: (gesture.retry_count ?? 0) + 1,
          last_error: "sanitario_v2 retry scheduled with backoff",
          operation_results: operationResults,
        });
      } else if (hasBlocked) {
        await db.queue_gestures.update(gesture.client_tx_id, {
          status: "ERROR",
          sync_result: "ERROR",
          completed_at: recordedAt,
          last_error: "sanitario_v2 blocked by unavailable dependency",
          operation_results: operationResults,
        });
      }
    },
  );

  await reconcileSanitarioV2Results(gesture.fazenda_id, matchedForReconcile);
  return true;
}

export async function recoverErroredGesturesOnce() {
  const errored = await db.queue_gestures
    .where("status")
    .equals("ERROR")
    .toArray();
  const recoverable = errored.filter((gesture) =>
    isRecoverableSyncError(gesture.last_error),
  );

  if (recoverable.length === 0) return;

  for (const gesture of recoverable) {
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "PENDING",
      sync_result: undefined,
      completed_at: undefined,
      retry_count: 0,
      last_error:
        "Recovered transient sync error; retrying after worker startup",
    });
  }

  console.warn(
    `[sync-worker] Re-queued ${recoverable.length} recoverable ERROR gesture(s)`,
  );
}

export type SanitarioV2RecoveryTrigger =
  | "app_startup"
  | "reconcile_completed"
  | "contract_version_updated"
  | "remote_dependency_recovered";

export async function recoverBlockedSanitarioV2Operations(
  trigger: SanitarioV2RecoveryTrigger,
  excludedOpIds: ReadonlySet<string> = new Set(),
) {
  const blocked = await db.queue_ops
    .filter(
      (op) =>
        op.sync_state === "BLOCKED_DEPENDENCY" &&
        !excludedOpIds.has(op.client_op_id),
    )
    .toArray();
  if (blocked.length === 0) return 0;

  const transactionIds = Array.from(
    new Set(blocked.map((op) => op.client_tx_id)),
  );
  const now = new Date().toISOString();
  await db.transaction("rw", [db.queue_ops, db.queue_gestures], async () => {
    for (const op of blocked) {
      await db.queue_ops
        .where("client_op_id")
        .equals(op.client_op_id)
        .modify((queued) => {
          queued.sync_state = "PENDING";
          delete queued.next_attempt_at;
          delete queued.blocked_reason;
        });
    }
    for (const clientTxId of transactionIds) {
      await db.queue_gestures
        .where("client_tx_id")
        .equals(clientTxId)
        .modify((gesture) => {
          gesture.status = "PENDING";
          delete gesture.sync_result;
          delete gesture.completed_at;
          gesture.last_error = `sanitario_v2 dependency recovery: ${trigger} at ${now}`;
        });
    }
  });
  return blocked.length;
}

function logTokenExpiry(session: Session) {
  if (!import.meta.env.DEV) return;

  if (!session.expires_at) {
    console.debug("[sync-worker] Token expiry unavailable");
    return;
  }

  const tokenExpiry = new Date(session.expires_at * 1000);
  const now = new Date();
  const timeLeft = Math.floor(
    (tokenExpiry.getTime() - now.getTime()) / 1000 / 60,
  );
  console.debug("[sync-worker] Token expira em:", timeLeft, "minutos");
}

async function getValidSession() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!sessionError && session) {
    return { supabase, session };
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !refreshedSession) {
    const reason =
      refreshError?.message ??
      sessionError?.message ??
      "session null after refresh";
    throw new Error(`Nao autenticado - sessao expirada (${reason})`);
  }

  return { supabase, session: refreshedSession };
}

async function sendBatchRequest(
  accessToken: string,
  gesture: Gesture,
  ops: Record<string, unknown>[],
) {
  return fetch(`${env.supabaseFunctionsUrl}/sync-batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      client_id: gesture.client_id,
      fazenda_id: gesture.fazenda_id,
      client_tx_id: gesture.client_tx_id,
      ops,
    }),
  });
}

export function mapOperationForSync(
  op: Operation,
  fazendaId: string,
): Record<string, unknown> {
  if (isRecord(op.record) && op.record.domain === "sanitario_v2") {
    if (
      op.record.client_op_id !== op.client_op_id ||
      op.record.client_tx_id !== op.client_tx_id ||
      op.record.domain_op_id !== op.domain_op_id
    ) {
      throw new Error("SANITARIO_V2_QUEUED_IDENTITY_MISMATCH");
    }
    return { ...op.record };
  }
  if (isCommercialPurchaseEnvelope(op.record)) {
    if (
      op.record.client_op_id !== op.client_op_id ||
      op.record.client_tx_id !== op.client_tx_id
    )
      throw new Error("COMMERCIAL_PURCHASE_QUEUED_IDENTITY_MISMATCH");
    return { ...op.record };
  }
  if (isCommercialOperationEnvelope(op.record)) {
    if (
      op.record.client_op_id !== op.client_op_id ||
      op.record.client_tx_id !== op.client_tx_id
    ) {
      throw new Error("COMMERCIAL_OPERATION_QUEUED_IDENTITY_MISMATCH");
    }
    return { ...op.record };
  }
  const remoteTable = getRemoteTableName(op.table);
  return {
    client_op_id: op.client_op_id,
    table: remoteTable,
    action: op.action,
    record: normalizeTableMutationRecord(remoteTable, op.record, fazendaId),
  };
}

async function reconcileGenericOperationResults(
  gesture: Gesture,
  operations: Operation[],
  results: SyncOperationResult[],
) {
  const recordedAt = new Date().toISOString();
  const plan = planOperationReconciliation(operations, results, recordedAt);
  if (plan.rejected.length === 0) return false;

  const rejectedOps = plan.rejected.map(({ op }) => op);
  const appliedOps = plan.applied.map(({ op }) => op);
  const retryableOps = [
    ...plan.retryable.map(({ op }) => op),
    ...plan.missing,
  ];
  const transactionStores = Array.from(
    new Set([
      db.queue_gestures,
      db.queue_ops,
      db.queue_rejections,
      ...getAffectedStores([...rejectedOps, ...appliedOps]),
    ]),
  );

  await db.transaction("rw", transactionStores, async () => {
    for (const op of [...rejectedOps].reverse()) {
      await rollbackOpLocal(op);
    }
    for (const op of sortOpsForSync(appliedOps)) {
      await reapplyOpLocal(op);
    }

    if (appliedOps.length > 0) {
      await db.queue_ops.bulkDelete(
        appliedOps.map((operation) => operation.client_op_id),
      );
    }

    for (const { op, result } of plan.rejected) {
      await db.queue_ops.update(op.client_op_id, {
        sync_state: "REJECTED",
        next_attempt_at: undefined,
        blocked_reason: result.reason_code ?? "SYNC_OPERATION_REJECTED",
      });
      await db.queue_rejections.add({
        client_tx_id: gesture.client_tx_id,
        client_op_id: op.client_op_id,
        fazenda_id: gesture.fazenda_id,
        table: op.table,
        action: op.action,
        reason_code: result.reason_code ?? "SYNC_OPERATION_REJECTED",
        reason_message:
          result.reason_message ?? `Operation result: ${result.status}`,
        created_at: recordedAt,
      });
    }

    for (const { op, result } of plan.retryable) {
      await db.queue_ops.update(
        op.client_op_id,
        getSanitarioRetryUpdate(
          op,
          Date.parse(recordedAt),
          result.reason_code ?? "SYNC_OPERATION_RETRYABLE",
        ),
      );
    }
    for (const op of plan.missing) {
      await db.queue_ops.update(
        op.client_op_id,
        getSanitarioRetryUpdate(
          op,
          Date.parse(recordedAt),
          "SYNC_RESULT_MISSING",
        ),
      );
    }

    const rejectionSummary = plan.rejected
      .map(
        ({ result }) =>
          `${result.reason_code ?? "UNKNOWN"}: ${result.reason_message ?? "-"}`,
      )
      .join(" | ");
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: retryableOps.length > 0 ? "PENDING" : "REJECTED",
      sync_result: retryableOps.length > 0 ? undefined : "REJECTED",
      completed_at: retryableOps.length > 0 ? undefined : recordedAt,
      last_error: rejectionSummary || "Gesture has rejected operations",
      operation_results: mergeOperationAudit(
        gesture.operation_results,
        plan.audits,
      ),
    });
  });

  const remoteTables = Array.from(
    new Set(
      [...appliedOps, ...rejectedOps].map((operation) =>
        getRemoteTableName(operation.table),
      ),
    ),
  );
  if (remoteTables.length > 0) {
    try {
      await pullDataForFarm(gesture.fazenda_id, remoteTables);
    } catch (error) {
      console.warn(
        `[sync-worker] mixed-result pull failed for TX ${gesture.client_tx_id}:`,
        error,
      );
    }
  }

  if (
    plan.rejected.some(
      ({ result }) => result.reason_code === AGENDA_ALREADY_COMPLETED_REASON,
    )
  ) {
    try {
      await pullDataForFarm(gesture.fazenda_id, [
        "agenda_itens",
        "eventos",
        "eventos_sanitario",
      ]);
    } catch (error) {
      console.warn(
        `[sync-worker] agenda reconciliation pull failed for TX ${gesture.client_tx_id}:`,
        error,
      );
    }
  }

  if (
    plan.rejected.some(
      ({ op }) =>
        getRemoteTableName(op.table) === "sanitario_agenda_closures_v2",
    )
  ) {
    try {
      await pullSanitarioAgendaV2(gesture.fazenda_id);
    } catch (error) {
      console.warn(
        `[sync-worker] agenda v2 operation reconciliation pull failed for TX ${gesture.client_tx_id}:`,
        error,
      );
    }
  }

  return true;
}

export async function processGesture(gesture: Gesture) {
  const queuedOps = await db.queue_ops
    .where("client_tx_id")
    .equals(gesture.client_tx_id)
    .toArray();
  const readyOps = queuedOps.filter(
    (op) => op.sync_state !== "REJECTED" && isOperationReadyForSync(op),
  );

  if (readyOps.length === 0) {
    const hasDeferredRetry = queuedOps.some(
      (op) => op.sync_state === "RETRYABLE",
    );
    const hasBlockedDependency = queuedOps.some(
      (op) => op.sync_state === "BLOCKED_DEPENDENCY",
    );
    const hasRejectedOperation = queuedOps.some(
      (op) => op.sync_state === "REJECTED",
    );

    await db.queue_gestures.update(gesture.client_tx_id, {
      status: hasDeferredRetry
        ? "PENDING"
        : hasRejectedOperation
          ? "REJECTED"
          : hasBlockedDependency
            ? "ERROR"
            : "DONE",
      sync_result:
        hasRejectedOperation && !hasDeferredRetry
          ? "REJECTED"
          : hasBlockedDependency && !hasDeferredRetry
            ? "ERROR"
            : undefined,
      completed_at:
        (hasRejectedOperation || hasBlockedDependency) && !hasDeferredRetry
          ? new Date().toISOString()
          : undefined,
      last_error: hasDeferredRetry
        ? "sanitario_v2 retry waiting for backoff"
        : hasRejectedOperation
          ? "Gesture possui operações rejeitadas aguardando reconciliação"
          : hasBlockedDependency
            ? "sanitario_v2 blocked by unavailable dependency"
            : undefined,
    });
    return;
  }

  const ops = sortOpsForSync(readyOps);
  await db.queue_gestures.update(gesture.client_tx_id, {
    status: "SYNCING",
    sync_result: undefined,
    completed_at: undefined,
  });

  try {
    const { supabase, session } = await getValidSession();
    const commercialOperation = buildCommercialOperationEnvelope(
      ops,
      gesture.fazenda_id,
    );
    const commercialPurchase = commercialOperation
      ? null
      : buildCommercialPurchaseEnvelope(ops, gesture.fazenda_id);
    const commercialCommand = commercialOperation ?? commercialPurchase;
    const mappedOps = commercialCommand
      ? [{ ...commercialCommand }]
      : ops.map((op) => mapOperationForSync(op, gesture.fazenda_id));

    if (import.meta.env.DEV) {
      console.debug(
        "[sync-worker] Tentando sync do TX:",
        gesture.client_tx_id.substring(0, 8),
      );
    }
    logTokenExpiry(session);

    let response = await sendBatchRequest(
      session.access_token,
      gesture,
      mappedOps,
    );

    if (response.status === 401) {
      console.warn(
        "[sync-worker] HTTP 401 on sync-batch, attempting refresh + single retry",
      );

      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        throw new Error(
          `HTTP 401 - refresh failed: ${refreshError?.message ?? "no session"}`,
        );
      }

      logTokenExpiry(refreshedSession);
      response = await sendBatchRequest(
        refreshedSession.access_token,
        gesture,
        mappedOps,
      );
    }

    if (!response.ok) {
      let errorBody: string | null = null;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = null;
      }

      console.error(
        "[sync-worker] HTTP Error:",
        response.status,
        response.statusText,
        errorBody ? `- ${errorBody}` : "",
      );
      throw new Error(
        `HTTP ${response.status}${errorBody ? ` - ${errorBody}` : ""}`,
      );
    }

    const result = (await response.json()) as SyncBatchResponse;
    if (!Array.isArray(result.results)) {
      throw new Error("Invalid sync-batch response: results missing");
    }
    const handledSanitarioV2 = await processSanitarioCanonicalResults(
      gesture,
      ops,
      result.results,
    );
    if (handledSanitarioV2) return;

    const genericRecordedAt = new Date().toISOString();
    const genericPlan = planOperationReconciliation(
      ops,
      result.results,
      genericRecordedAt,
    );
    const hasCommercialPurchase = commercialCommand !== null;
    const allApplied = hasCommercialPurchase
      ? result.results.every(
          (r) => r.status === "APPLIED" || r.status === "APPLIED_ALTERED",
        )
      : genericPlan.applied.length === ops.length &&
        genericPlan.rejected.length === 0 &&
        genericPlan.retryable.length === 0 &&
        genericPlan.missing.length === 0;
    const hasReproductionOperation = ops.some(
      (op) =>
        getRemoteTableName(op.table) === "eventos_reproducao" &&
        SYNCED_REPRODUCTION_TYPES.has(String(op.record?.tipo)),
    );
    const isTerminalReproductionResult = (entry: SyncOperationResult) =>
      entry.status === "REJECTED" ||
      (hasReproductionOperation &&
        (entry.status === "CONFLICT" || entry.status === "BLOCKED_DEPENDENCY"));
    const isTerminalResult = (entry: SyncOperationResult) =>
      isTerminalReproductionResult(entry) ||
      (hasCommercialPurchase &&
        (entry.status === "REJECTED" || entry.status === "CONFLICT"));
    const hasRejected = hasCommercialPurchase
      ? result.results.some(isTerminalResult)
      : genericPlan.rejected.length > 0;

    if (allApplied) {
      const completedAt = new Date().toISOString();
      const syncResult = result.results.some(
        (entry) => entry.status === "APPLIED_ALTERED",
      )
        ? "APPLIED_ALTERED"
        : "APPLIED";
      const remoteTablesTouched = new Set(
        ops.map((op) => getRemoteTableName(op.table)),
      );
      const refreshTables = new Set<string>();

      await db.queue_ops.bulkDelete(
        ops.map((operation) => operation.client_op_id),
      );

      if (hasCommercialPurchase) {
        refreshTables.add("animais");
        refreshTables.add("eventos");
        refreshTables.add("eventos_comercial");
      }

      // Agenda pode ser gerada automaticamente por trigger ao inserir/atualizar animais.
      if (remoteTablesTouched.has("animais")) {
        refreshTables.add("agenda_itens");
      }
      // Conclusao de pendencia sanitária altera evento e agenda no servidor.
      if (
        remoteTablesTouched.has("eventos") ||
        remoteTablesTouched.has("eventos_sanitario") ||
        remoteTablesTouched.has("agenda_itens")
      ) {
        refreshTables.add("agenda_itens");
        refreshTables.add("eventos");
        refreshTables.add("eventos_sanitario");
      }
      if (
        remoteTablesTouched.has("protocolos_sanitarios") ||
        remoteTablesTouched.has("protocolos_sanitarios_itens") ||
        remoteTablesTouched.has("fazenda_sanidade_config")
      ) {
        refreshTables.add("protocolos_sanitarios");
        refreshTables.add("protocolos_sanitarios_itens");
        refreshTables.add("agenda_itens");
        refreshTables.add("fazenda_sanidade_config");
      }
      if (remoteTablesTouched.has("insumo_movimentacoes")) {
        refreshTables.add("insumo_lotes");
        refreshTables.add("insumo_movimentacoes");
      }

      if (refreshTables.size > 0) {
        try {
          await pullDataForFarm(gesture.fazenda_id, Array.from(refreshTables));
        } catch (refreshError) {
          console.warn(
            `[sync-worker] post-sync pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }
      }
      const hasReproductionDetail = ops.some(
        (op) =>
          getRemoteTableName(op.table) === "eventos_reproducao" &&
          op.action === "INSERT" &&
          SYNCED_REPRODUCTION_TYPES.has(String(op.record?.tipo)),
      );
      if (hasReproductionDetail) {
        try {
          await pullReproductionDiagnosisState(gesture.fazenda_id, {
            ignorePendingClientTxId: gesture.client_tx_id,
          });
        } catch (refreshError) {
          console.warn(
            `[sync-worker] post-sync reproduction pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }
      }
      if (
        Array.from(remoteTablesTouched).some((table) =>
          SANITARIO_AGENDA_V2_REMOTE_TABLES.has(table),
        )
      ) {
        try {
          await pullSanitarioAgendaV2(gesture.fazenda_id);
        } catch (refreshError) {
          console.warn(
            `[sync-worker] post-sync agenda v2 pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }
      }

      await db.transaction(
        "rw",
        [db.queue_gestures, db.queue_ops],
        async () => {
          const remaining = await db.queue_ops
            .where("client_tx_id")
            .equals(gesture.client_tx_id)
            .toArray();
          const hasRemainingRejected = remaining.some(
            (operation) => operation.sync_state === "REJECTED",
          );
          await db.queue_gestures.update(gesture.client_tx_id, {
            status:
              remaining.length === 0
                ? "DONE"
                : hasRemainingRejected
                  ? "REJECTED"
                  : "PENDING",
            sync_result:
              remaining.length === 0
                ? syncResult
                : hasRemainingRejected
                  ? "REJECTED"
                  : undefined,
            completed_at:
              remaining.length === 0 || hasRemainingRejected
                ? completedAt
                : undefined,
            last_error: hasRemainingRejected
              ? "Gesture ainda possui operações rejeitadas"
              : undefined,
            operation_results: mergeOperationAudit(
              gesture.operation_results,
              genericPlan.audits,
            ),
          });
        },
      );
      await trackPilotMetric({
        fazendaId: gesture.fazenda_id,
        eventName: "sync_success",
        status: "success",
        entity: "sync-batch",
        quantity: ops.length,
        payload: {
          tables: Array.from(remoteTablesTouched),
          op_count: ops.length,
        },
      });

      if (import.meta.env.DEV) {
        console.debug(
          `[sync-worker] TX ${gesture.client_tx_id} synced successfully`,
        );
      }
      return;
    }

    if (
      hasRejected &&
      !hasCommercialPurchase &&
      (await reconcileGenericOperationResults(gesture, ops, result.results))
    ) {
      await trackPilotMetric({
        fazendaId: gesture.fazenda_id,
        eventName: "sync_rejected",
        status: "error",
        entity: "sync-batch",
        quantity: genericPlan.rejected.length,
        reasonCode: genericPlan.rejected[0]?.result.reason_code,
        payload: {
          op_count: ops.length,
          applied_count: genericPlan.applied.length,
          rejected_count: genericPlan.rejected.length,
          retryable_count:
            genericPlan.retryable.length + genericPlan.missing.length,
        },
      });
      return;
    }

    if (hasRejected) {
      const completedAt = new Date().toISOString();
      const rejectedResults = result.results.filter(isTerminalResult);
      const rejectionSummary = rejectedResults
        .map((r) => `${r.reason_code ?? "UNKNOWN"}: ${r.reason_message ?? "-"}`)
        .join(" | ");

      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "REJECTED",
        sync_result: "REJECTED",
        completed_at: completedAt,
        last_error: rejectionSummary || "TX rejected by sync-batch",
      });
      console.warn(
        `[sync-worker] TX ${gesture.client_tx_id} rejected:`,
        rejectedResults.map((r) => ({
          op_id: r.op_id,
          reason_code: r.reason_code,
          reason_message: r.reason_message,
        })),
      );
      console.warn(
        `[sync-worker] TX ${gesture.client_tx_id} rejected (json): ${JSON.stringify(
          rejectedResults,
        )}`,
      );

      for (const res of rejectedResults) {
        const originalOp = ops.find((o) => o.client_op_id === res.op_id);
        if (!originalOp) continue;

        await db.queue_rejections.add({
          client_tx_id: gesture.client_tx_id,
          client_op_id: res.op_id,
          fazenda_id: gesture.fazenda_id,
          table: originalOp.table,
          action: originalOp.action,
          reason_code: res.reason_code,
          reason_message: res.reason_message,
          created_at: new Date().toISOString(),
        });
      }

      const appliedResults = result.results.filter(
        (r) => r.status === "APPLIED" || r.status === "APPLIED_ALTERED",
      );
      const isAgendaClosureOnlyGesture =
        mappedOps.length > 0 &&
        ops.every(
          (op) =>
            getRemoteTableName(op.table) === "sanitario_agenda_closures_v2",
        );

      if (isAgendaClosureOnlyGesture && appliedResults.length > 0) {
        const appliedOpIds = new Set(
          appliedResults
            .map((entry) => entry.op_id)
            .filter((opId): opId is string => typeof opId === "string"),
        );
        const rejectedOpIds = new Set(
          rejectedResults
            .map((entry) => entry.op_id)
            .filter((opId): opId is string => typeof opId === "string"),
        );
        const rejectedOps = ops.filter((op) =>
          rejectedOpIds.has(op.client_op_id),
        );

        if (rejectedOps.length > 0) {
          await db.transaction(
            "rw",
            [...getAffectedStores(rejectedOps)],
            async () => {
              for (const op of [...rejectedOps].reverse()) {
                await rollbackOpLocal(op);
              }
            },
          );
        }

        if (appliedOpIds.size > 0) {
          await db.queue_ops.bulkDelete(Array.from(appliedOpIds));
        }

        try {
          await pullSanitarioAgendaV2(gesture.fazenda_id);
        } catch (refreshError) {
          console.warn(
            `[sync-worker] partial agenda v2 reconciliation pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }

        console.warn(
          `[sync-worker] TX ${gesture.client_tx_id} had agenda closure partial success`,
        );
        await trackPilotMetric({
          fazendaId: gesture.fazenda_id,
          eventName: "sync_rejected",
          status: "error",
          entity: "sync-batch",
          quantity: rejectedResults.length,
          reasonCode: rejectedResults[0]?.reason_code,
          payload: {
            op_count: ops.length,
            applied_count: appliedOpIds.size,
            rejected_count: rejectedResults.length,
            tables: ["sanitario_agenda_closures_v2"],
            reasons: rejectedResults.map(
              (result) => result.reason_code ?? "UNKNOWN",
            ),
          },
        });
        return;
      }

      if (!hasCommercialPurchase) {
        await db.transaction("rw", [...getAffectedStores(ops)], async () => {
          for (const op of [...ops].reverse()) {
            await rollbackOpLocal(op);
          }
        });
      }

      if (
        rejectedResults.some(
          (result) => result.reason_code === AGENDA_ALREADY_COMPLETED_REASON,
        )
      ) {
        try {
          await pullDataForFarm(gesture.fazenda_id, [
            "agenda_itens",
            "eventos",
            "eventos_sanitario",
          ]);
        } catch (refreshError) {
          console.warn(
            `[sync-worker] reconciliation pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }
      }
      if (
        rejectedResults.some(
          (result) =>
            result.reason_code === SANITARIO_AGENDA_CLOSURE_CONFLICT_REASON,
        )
      ) {
        try {
          await pullSanitarioAgendaV2(gesture.fazenda_id);
        } catch (refreshError) {
          console.warn(
            `[sync-worker] agenda v2 conflict reconciliation pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }
      }

      console.warn(
        `[sync-worker] TX ${gesture.client_tx_id} had rejections (${hasCommercialPurchase ? "local purchase preserved for conflict resolution" : "rolled back locally"})`,
      );
      await trackPilotMetric({
        fazendaId: gesture.fazenda_id,
        eventName: "sync_rejected",
        status: "error",
        entity: "sync-batch",
        quantity: rejectedResults.length,
        reasonCode: rejectedResults[0]?.reason_code,
        payload: {
          op_count: ops.length,
          reasons: rejectedResults.map(
            (result) => result.reason_code ?? "UNKNOWN",
          ),
        },
      });
      return;
    }

    throw new Error(
      "Invalid sync-batch response: no APPLIED or REJECTED statuses",
    );
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const retryCount = gesture.retry_count || 0;

    if (isNonRetryableSyncError(error.message)) {
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "ERROR",
        sync_result: "ERROR",
        completed_at: new Date().toISOString(),
        last_error: error.message,
      });
      await trackPilotMetric({
        fazendaId: gesture.fazenda_id,
        eventName: "sync_error",
        status: "error",
        entity: "sync-batch",
        quantity: ops.length,
        payload: {
          op_count: ops.length,
          message: error.message,
          retryable: false,
        },
      });
      return;
    }

    if (retryCount < MAX_RETRIES) {
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "PENDING",
        sync_result: undefined,
        completed_at: undefined,
        retry_count: retryCount + 1,
        last_error: error.message,
      });
      return;
    }

    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "ERROR",
      sync_result: "ERROR",
      completed_at: new Date().toISOString(),
      last_error: `Max retries: ${error.message}`,
    });
    await trackPilotMetric({
      fazendaId: gesture.fazenda_id,
      eventName: "sync_error",
      status: "error",
      entity: "sync-batch",
      quantity: ops.length,
      payload: {
        op_count: ops.length,
        message: error.message,
      },
    });
  }
}
