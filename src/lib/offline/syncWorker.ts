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
import type {
  ReconciliationObligation,
  ReconciliationScope,
} from "./reconciliationTypes";
import {
  getRemoteTableName,
  STANDARD_EVENT_DETAIL_REMOTE_TABLES,
} from "./tableMap";
import { normalizeTableMutationRecord } from "./mutationRecord";
import { getAffectedStores, reapplyOpLocal, rollbackOpLocal } from "./ops";
import { sortOpsForSync } from "./syncOrder";
import {
  mergeOperationAudit,
  planOperationReconciliation,
  type OperationResultMatch,
  type TerminalBlockedDependencyClassifier,
} from "./syncReconciliation";
import {
  pullDataForFarm,
  pullInitialData,
  pullSanitarioAgendaV2,
  pullSanitarioV2CutoverState,
  DEFAULT_REMOTE_TABLES,
} from "./pull";
import {
  deleteReconciliationObligationIfGenerationMatches,
  listReconciliationObligations,
  upsertReconciliationObligations,
} from "./reconciliationObligations";
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
let activeRequestController: AbortController | null = null;

const localActiveGestureLocks = new Set<string>();
export const REQUEST_TIMEOUT_MS = 5_000;

export async function withGestureLock<T>(
  clientTxId: string,
  fn: (acquired: boolean) => Promise<T>,
): Promise<T> {
  const lockName = `rebanhosync:gesture:${clientTxId}`;

  if (localActiveGestureLocks.has(clientTxId)) {
    return fn(false);
  }

  if (typeof navigator !== "undefined" && navigator?.locks?.request) {
    return new Promise<T>((resolve, reject) => {
      navigator.locks
        .request(lockName, { ifAvailable: true }, async (lock) => {
          if (lock === null) {
            try {
              const res = await fn(false);
              resolve(res);
            } catch (err) {
              reject(err);
            }
            return;
          }

          localActiveGestureLocks.add(clientTxId);
          try {
            const res = await fn(true);
            resolve(res);
          } catch (err) {
            reject(err);
          } finally {
            localActiveGestureLocks.delete(clientTxId);
          }
        })
        .catch(reject);
    });
  }

  localActiveGestureLocks.add(clientTxId);
  try {
    return await fn(true);
  } finally {
    localActiveGestureLocks.delete(clientTxId);
  }
}

export async function isGestureLockActive(
  clientTxId: string,
): Promise<boolean> {
  if (localActiveGestureLocks.has(clientTxId)) {
    return true;
  }

  if (typeof navigator !== "undefined" && navigator?.locks?.request) {
    return new Promise<boolean>((resolve) => {
      navigator.locks
        .request(
          `rebanhosync:gesture:${clientTxId}`,
          { ifAvailable: true },
          async (lock) => {
            if (lock === null) {
              resolve(true);
              return;
            }
            resolve(false);
          },
        )
        .catch(() => resolve(false));
    });
  }

  return false;
}

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

// F24.2C3B — durable reconciliation obligations.
// Derivação compartilhada entre a obrigação persistida no ACK boundary e os
// pulls executados depois, para impedir divergência entre ambos.
interface ReconciliationRequirementInput {
  fazendaId: string;
  factualTables?: readonly string[];
  reproduction?: boolean;
  agendaV2?: boolean;
  sanitarioV2?: boolean;
}

interface ReconciliationRequirement {
  fazendaId: string;
  scope: ReconciliationScope;
  tables?: string[];
}

function deriveReconciliationRequirements(
  input: ReconciliationRequirementInput,
): ReconciliationRequirement[] {
  const requirements: ReconciliationRequirement[] = [];
  if (input.factualTables && input.factualTables.length > 0) {
    requirements.push({
      fazendaId: input.fazendaId,
      scope: "factual",
      tables: Array.from(new Set(input.factualTables)),
    });
  }
  if (input.reproduction) {
    requirements.push({ fazendaId: input.fazendaId, scope: "reproduction" });
  }
  if (input.agendaV2) {
    requirements.push({ fazendaId: input.fazendaId, scope: "agenda-v2" });
  }
  if (input.sanitarioV2) {
    requirements.push({ fazendaId: input.fazendaId, scope: "sanitario-v2" });
  }
  return requirements;
}

async function loadSyncingGestureAndPersistRequirements(
  clientTxId: string,
  requirements: ReconciliationRequirement[],
): Promise<Gesture | undefined> {
  const current = await db.queue_gestures.get(clientTxId);
  if (!current || current.status !== "SYNCING") {
    return undefined;
  }
  if (requirements.length > 0) {
    await upsertReconciliationObligations(requirements);
  }
  return current;
}

// Decisão pura de scopes para resultados canônicos sanitário v2 (caminho P4).
// Reutilizada tanto pela persistência da obrigação quanto pela reconciliação
// de fato, para que a obrigação reflita exatamente o pull que seria executado.
function isSanitarioAgendaCutoverRequired(
  command: SanitarioSyncV2Command | undefined,
  canonical: Record<string, unknown>,
): boolean {
  return (
    command === "create_agenda" ||
    command === "replace_agenda_animals" ||
    command === "close_agenda" ||
    typeof canonical.agenda_id === "string" ||
    typeof canonical.closure_id === "string"
  );
}

function isSanitarioFactualCutoverRequired(
  command: SanitarioSyncV2Command | undefined,
  canonical: Record<string, unknown>,
): boolean {
  return (
    command === "apply_factual_core" || typeof canonical.evento_id === "string"
  );
}

function isUnresolvedSanitarioConflict(
  result: SyncOperationResult & { status: SanitarioSyncV2ResultStatus },
  command: SanitarioSyncV2Command | undefined,
  hasAgendaEntity: boolean,
  hasFactualEntity: boolean,
): boolean {
  return (
    result.status === "CONFLICT" &&
    !hasAgendaEntity &&
    !hasFactualEntity &&
    (!result.canonical_entity_id || !command)
  );
}

function deriveSanitarioV2CutoverRequired(
  matched: Array<{
    op: Operation;
    result: SyncOperationResult & { status: SanitarioSyncV2ResultStatus };
  }>,
): boolean {
  return matched.some(({ op, result }) => {
    if (result.status !== "APPLIED" && result.status !== "CONFLICT") {
      return false;
    }
    const command = readSanitarioCommand(op, result);
    const canonical = isRecord(result.canonical_result)
      ? result.canonical_result
      : {};
    const hasAgendaEntity =
      typeof canonical.agenda_id === "string" ||
      typeof canonical.closure_id === "string";
    const hasFactualEntity = typeof canonical.evento_id === "string";

    return (
      isSanitarioAgendaCutoverRequired(command, canonical) ||
      isSanitarioFactualCutoverRequired(command, canonical) ||
      isUnresolvedSanitarioConflict(
        result,
        command,
        hasAgendaEntity,
        hasFactualEntity,
      )
    );
  });
}

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
  void drainReconciliationObligations(getActiveFarmId());

  if (!onlineWakeUpListener && typeof window !== "undefined") {
    onlineWakeUpListener = () => {
      wakeUpDurableSyncWork();
    };
    window.addEventListener("online", onlineWakeUpListener);
  }

  intervalId = setInterval(async () => {
    if (isTickRunning) return;
    isTickRunning = true;

    try {
      await runInitialOfflinePullForActiveFarmOnce();

      if (!startupRecoveryDone) {
        await recoverErroredGesturesOnce();
        await recoverBlockedSanitarioV2Operations("app_startup");
        await recoverStaleSyncingGesturesOnce();
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

          await db.transaction("rw", [db.queue_gestures], async () => {
            const current = await db.queue_gestures.get(gesture.client_tx_id);
            if (
              !current ||
              current.status === "DONE" ||
              current.status === "REJECTED"
            ) {
              return;
            }
            if (current.status !== "SYNCING") {
              return;
            }
            await db.queue_gestures.update(gesture.client_tx_id, {
              status: "ERROR",
              sync_result: "ERROR",
              completed_at: new Date().toISOString(),
              last_error: error.message,
            });
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

      // F24.2C3B: drena obrigacoes de reconciliacao apos o processamento da
      // fila de escrita, sem bloquear push novo.
      await drainReconciliationObligations(getActiveFarmId());
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

  if (onlineWakeUpListener && typeof window !== "undefined") {
    window.removeEventListener("online", onlineWakeUpListener);
    onlineWakeUpListener = null;
  }

  isTickRunning = false;
  startupRecoveryDone = false;
  activeRequestController?.abort();
  activeRequestController = null;
  localActiveGestureLocks.clear();
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

// F24.2C3B — drain de obrigacoes duraveis de reconciliacao.
const RECONCILIATION_DRAIN_LOCK_NAME = "rebanhosync:reconciliation-drain";
let isReconciliationDrainRunning = false;
let onlineWakeUpListener: (() => void) | null = null;

// Lock global de drain: um dreno por processo; correctness nao depende dele
// (pulls idempotentes + conditional delete por generation_id).
async function withReconciliationDrainLock<T>(
  fn: (acquired: boolean) => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator?.locks?.request) {
    return new Promise<T>((resolve, reject) => {
      navigator.locks
        .request(RECONCILIATION_DRAIN_LOCK_NAME, { ifAvailable: true }, async (lock) => {
          if (lock === null) {
            try {
              resolve(await fn(false));
            } catch (err) {
              reject(err);
            }
            return;
          }
          try {
            resolve(await fn(true));
          } catch (err) {
            reject(err);
          }
        })
        .catch(reject);
    });
  }
  return fn(true);
}

async function executeReconciliationForScope(
  obligation: ReconciliationObligation,
) {
  const fazendaId = obligation.fazenda_id;
  switch (obligation.scope) {
    case "factual":
      await pullDataForFarm(
        fazendaId,
        obligation.tables && obligation.tables.length > 0
          ? obligation.tables
          : DEFAULT_REMOTE_TABLES,
      );
      return;
    case "reproduction":
      await pullReproductionDiagnosisState(fazendaId);
      return;
    case "agenda-v2":
      await pullSanitarioAgendaV2(fazendaId);
      return;
    case "sanitario-v2":
      await pullSanitarioV2CutoverState(fazendaId);
      await recoverBlockedSanitarioV2Operations("reconciliation_drain");
      return;
  }
}

export async function drainReconciliationObligations(
  fazendaId: string | null,
) {
  if (!fazendaId || isReconciliationDrainRunning) return;

  isReconciliationDrainRunning = true;
  try {
    await withReconciliationDrainLock(async (acquired) => {
      if (!acquired) return;

      const obligations = await listReconciliationObligations(fazendaId);
      for (const obligation of obligations) {
        try {
          await executeReconciliationForScope(obligation);
          await deleteReconciliationObligationIfGenerationMatches(
            obligation.key,
            obligation.generation_id,
          );
        } catch (e: unknown) {
          const error = e instanceof Error ? e : new Error(String(e));
          console.warn(
            `[sync-worker] reconciliation drain failed for ${obligation.key}:`,
            error.message,
          );
        }
      }
    });
  } finally {
    isReconciliationDrainRunning = false;
  }
}

function wakeUpDurableSyncWork() {
  void runInitialOfflinePullForActiveFarmOnce();
  void drainReconciliationObligations(getActiveFarmId());
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

type QueueOperationUpdate = Partial<
  Pick<
    Operation,
    | "domain_op_id"
    | "sync_state"
    | "retry_count"
    | "next_attempt_at"
    | "blocked_reason"
  >
>;

function getSanitarioRetryUpdate(
  op: Operation,
  nowMs: number,
  reason: string,
): QueueOperationUpdate {
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
  const cutoverRequired = deriveSanitarioV2CutoverRequired(matched);

  if (cutoverRequired) {
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
  const operationUpdates = new Map<string, QueueOperationUpdate>();
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

  const sanitarioV2CutoverRequired =
    deriveSanitarioV2CutoverRequired(matchedForReconcile);

  await db.transaction(
    "rw",
    [
      db.queue_gestures,
      db.queue_ops,
      db.queue_rejections,
      db.sync_reconcile_obligations,
    ],
    // fallow-ignore-next-line complexity
    async () => {
      const current = await db.queue_gestures.get(gesture.client_tx_id);
      if (!current || current.status !== "SYNCING") {
        return;
      }

      if (sanitarioV2CutoverRequired) {
        await upsertReconciliationObligations([
          { fazendaId: gesture.fazenda_id, scope: "sanitario-v2" },
        ]);
      }

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
        current.operation_results ?? gesture.operation_results,
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
          retry_count: (current.retry_count ?? gesture.retry_count ?? 0) + 1,
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

export async function recoverStaleSyncingGesturesOnce() {
  const syncing = await db.queue_gestures
    .where("status")
    .equals("SYNCING")
    .toArray();
  if (syncing.length === 0) return 0;

  const activeLockTxIds = new Set<string>();
  for (const gesture of syncing) {
    if (await isGestureLockActive(gesture.client_tx_id)) {
      activeLockTxIds.add(gesture.client_tx_id);
    }
  }

  let recovered = 0;
  await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
    for (const gesture of syncing) {
      if (activeLockTxIds.has(gesture.client_tx_id)) {
        continue;
      }

      const current = await db.queue_gestures.get(gesture.client_tx_id);
      if (current?.status !== "SYNCING") continue;

      const operations = await db.queue_ops
        .where("client_tx_id")
        .equals(gesture.client_tx_id)
        .toArray();
      const hasNonTerminalOperation = operations.some(
        (operation) =>
          operation.sync_state !== "REJECTED" &&
          operation.sync_state !== "BLOCKED_DEPENDENCY",
      );
      if (!hasNonTerminalOperation) continue;

      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "PENDING",
        sync_result: undefined,
        completed_at: undefined,
        last_error:
          "Recovered interrupted sync; retrying with persisted identity",
      });
      recovered += 1;
    }
  });

  if (recovered > 0) {
    console.warn(
      `[sync-worker] Re-queued ${recovered} interrupted SYNCING gesture(s)`,
    );
  }
  return recovered;
}

export type SanitarioV2RecoveryTrigger =
  | "app_startup"
  | "reconcile_completed"
  | "reconciliation_drain"
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
  const controller = new AbortController();
  activeRequestController = controller;
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${env.supabaseFunctionsUrl}/sync-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        client_id: gesture.client_id,
        fazenda_id: gesture.fazenda_id,
        client_tx_id: gesture.client_tx_id,
        ops,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (activeRequestController === controller) {
      activeRequestController = null;
    }
  }
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
  isTerminalBlockedDependency?: TerminalBlockedDependencyClassifier,
) {
  const recordedAt = new Date().toISOString();
  const plan = planOperationReconciliation(
    operations,
    results,
    recordedAt,
    isTerminalBlockedDependency,
  );
  if (plan.rejected.length === 0) return false;

  const rejectedOps = plan.rejected.map(({ op }) => op);
  const appliedOps = plan.applied.map(({ op }) => op);
  const retryableOps = [
    ...plan.retryable.map(({ op }) => op),
    ...plan.missing,
  ];
  const factualRefreshTables = new Set<string>(
    [...appliedOps, ...rejectedOps].map((operation) =>
      getRemoteTableName(operation.table),
    ),
  );
  if (
    plan.rejected.some(
      ({ result }) => result.reason_code === AGENDA_ALREADY_COMPLETED_REASON,
    )
  ) {
    factualRefreshTables.add("agenda_itens");
    factualRefreshTables.add("eventos");
    factualRefreshTables.add("eventos_sanitario");
  }
  const agendaV2Required = plan.rejected.some(
    ({ op }) => getRemoteTableName(op.table) === "sanitario_agenda_closures_v2",
  );
  const reconciliationRequirements = deriveReconciliationRequirements({
    fazendaId: gesture.fazenda_id,
    factualTables: Array.from(factualRefreshTables),
    agendaV2: agendaV2Required,
  });
  const transactionStores = Array.from(
    new Set([
      db.queue_gestures,
      db.queue_ops,
      db.queue_rejections,
      db.sync_reconcile_obligations,
      ...getAffectedStores([...rejectedOps, ...appliedOps]),
    ]),
  );

  // fallow-ignore-next-line complexity
  await db.transaction("rw", transactionStores, async () => {
    const current = await loadSyncingGestureAndPersistRequirements(
      gesture.client_tx_id,
      reconciliationRequirements,
    );
    if (!current) {
      return;
    }

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
        current.operation_results ?? gesture.operation_results,
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

function buildTerminalBlockedDependencyClassifier(
  operations: Operation[],
  results: SyncOperationResult[],
): TerminalBlockedDependencyClassifier {
  const resultsByOpId = new Map(
    results
      .filter(
        (result) =>
          !result.client_op_id || result.client_op_id === result.op_id,
      )
      .map((result) => [result.op_id, result]),
  );
  const eventOperationsById = new Map(
    operations
      .filter((operation) => getRemoteTableName(operation.table) === "eventos")
      .map((operation) => [String(operation.record?.id ?? ""), operation]),
  );

  return ({ op, result }: OperationResultMatch) => {
    if (
      result.status !== "BLOCKED_DEPENDENCY" ||
      result.retryable === true ||
      getRemoteTableName(op.table) !== "eventos_reproducao"
    ) {
      return false;
    }

    const dependency = eventOperationsById.get(
      String(op.record?.evento_id ?? ""),
    );
    if (!dependency) return false;

    const dependencyResult = resultsByOpId.get(dependency.client_op_id);
    return (
      dependencyResult?.status === "REJECTED" ||
      dependencyResult?.status === "CONFLICT"
    );
  };
}

export async function processGesture(gesture: Gesture) {
  // fallow-ignore-next-line complexity
  return withGestureLock(gesture.client_tx_id, async (acquired) => {
    if (!acquired) {
      // Loser worker: another processor is actively holding the lock for this gesture
      return;
    }

    // PATCH 1: Atomic claim inside exclusive Dexie transaction
    const claimAcquired = await db.transaction(
      "rw",
      [db.queue_gestures],
      async () => {
        const current = await db.queue_gestures.get(gesture.client_tx_id);
        if (!current || current.status !== "PENDING") {
          return false;
        }
        await db.queue_gestures.update(gesture.client_tx_id, {
          status: "SYNCING",
          sync_result: undefined,
          completed_at: undefined,
        });
        return true;
      },
    );

    if (!claimAcquired) {
      // Gesture is not PENDING (already claimed, terminal, or completed)
      return;
    }

    // PATCH 2: Revalidate work AFTER successful claim
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

      // fallow-ignore-next-line complexity
      await db.transaction("rw", [db.queue_gestures], async () => {
        const current = await db.queue_gestures.get(gesture.client_tx_id);
        if (current?.status !== "SYNCING") return;

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
      });
      return;
    }

    const ops = sortOpsForSync(readyOps);

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
    const isTerminalBlockedDependency =
      buildTerminalBlockedDependencyClassifier(ops, result.results);
    const genericPlan = planOperationReconciliation(
      ops,
      result.results,
      genericRecordedAt,
      isTerminalBlockedDependency,
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
        entry.status === "CONFLICT") ||
      genericPlan.rejected.some(
        ({ result: rejectedResult }) =>
          rejectedResult.op_id === entry.op_id &&
          rejectedResult.status === "BLOCKED_DEPENDENCY",
      );
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
      for (const detailTable of STANDARD_EVENT_DETAIL_REMOTE_TABLES) {
        if (remoteTablesTouched.has(detailTable)) {
          refreshTables.add(detailTable);
        }
      }

      const hasReproductionDetail = ops.some(
        (op) =>
          getRemoteTableName(op.table) === "eventos_reproducao" &&
          op.action === "INSERT" &&
          SYNCED_REPRODUCTION_TYPES.has(String(op.record?.tipo)),
      );
      const agendaV2Touched = Array.from(remoteTablesTouched).some((table) =>
        SANITARIO_AGENDA_V2_REMOTE_TABLES.has(table),
      );
      const reconciliationRequirements = deriveReconciliationRequirements({
        fazendaId: gesture.fazenda_id,
        factualTables: Array.from(refreshTables),
        reproduction: hasReproductionDetail,
        agendaV2: agendaV2Touched,
      });

      await db.transaction(
        "rw",
        [db.queue_gestures, db.queue_ops, db.sync_reconcile_obligations],
        async () => {
          const current = await loadSyncingGestureAndPersistRequirements(
            gesture.client_tx_id,
            reconciliationRequirements,
          );
          if (!current) {
            return;
          }

          await db.queue_ops.bulkDelete(
            ops.map((operation) => operation.client_op_id),
          );
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
              current.operation_results ?? gesture.operation_results,
              genericPlan.audits,
            ),
          });
        },
      );

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
      if (agendaV2Touched) {
        try {
          await pullSanitarioAgendaV2(gesture.fazenda_id);
        } catch (refreshError) {
          console.warn(
            `[sync-worker] post-sync agenda v2 pull failed for TX ${gesture.client_tx_id}:`,
            refreshError,
          );
        }
      }

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
      (await reconcileGenericOperationResults(
        gesture,
        ops,
        result.results,
        isTerminalBlockedDependency,
      ))
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

      const hasAgendaAlreadyCompletedRejection = rejectedResults.some(
        (r) => r.reason_code === AGENDA_ALREADY_COMPLETED_REASON,
      );
      const hasAgendaClosureConflictRejection = rejectedResults.some(
        (r) => r.reason_code === SANITARIO_AGENDA_CLOSURE_CONFLICT_REASON,
      );
      const isAgendaClosureOnlyGesture =
        mappedOps.length > 0 &&
        ops.every(
          (op) =>
            getRemoteTableName(op.table) === "sanitario_agenda_closures_v2",
        );
      const hasAppliedResults = result.results.some(
        (entry) => entry.status === "APPLIED" || entry.status === "APPLIED_ALTERED",
      );
      const rejectionReconciliationRequirements =
        deriveReconciliationRequirements({
          fazendaId: gesture.fazenda_id,
          factualTables: hasAgendaAlreadyCompletedRejection
            ? ["agenda_itens", "eventos", "eventos_sanitario"]
            : undefined,
          agendaV2:
            hasAgendaClosureConflictRejection ||
            (isAgendaClosureOnlyGesture && hasAppliedResults),
        });

      await db.transaction(
        "rw",
        [db.queue_gestures, db.sync_reconcile_obligations],
        async () => {
          const current = await db.queue_gestures.get(gesture.client_tx_id);
          if (!current || current.status !== "SYNCING") {
            return;
          }
          if (rejectionReconciliationRequirements.length > 0) {
            await upsertReconciliationObligations(
              rejectionReconciliationRequirements,
            );
          }
        await db.queue_gestures.update(gesture.client_tx_id, {
          status: "REJECTED",
          sync_result: "REJECTED",
          completed_at: completedAt,
          last_error: rejectionSummary || "TX rejected by sync-batch",
        });
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

    const isStale = await db.transaction(
      "rw",
      [db.queue_gestures],
      async () => {
        const current = await db.queue_gestures.get(gesture.client_tx_id);
        if (
          !current ||
          current.status === "DONE" ||
          current.status === "REJECTED" ||
          current.status !== "SYNCING"
        ) {
          return true;
        }

        const retryCount = current.retry_count ?? gesture.retry_count ?? 0;

        if (isNonRetryableSyncError(error.message)) {
          await db.queue_gestures.update(gesture.client_tx_id, {
            status: "ERROR",
            sync_result: "ERROR",
            completed_at: new Date().toISOString(),
            last_error: error.message,
          });
          return false;
        }

        if (retryCount < MAX_RETRIES) {
          await db.queue_gestures.update(gesture.client_tx_id, {
            status: "PENDING",
            sync_result: undefined,
            completed_at: undefined,
            retry_count: retryCount + 1,
            last_error: error.message,
          });
          return false;
        }

        await db.queue_gestures.update(gesture.client_tx_id, {
          status: "ERROR",
          sync_result: "ERROR",
          completed_at: new Date().toISOString(),
          last_error: `Max retries: ${error.message}`,
        });
        return false;
      },
    );

    if (isStale) {
      return;
    }

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
  });
}
