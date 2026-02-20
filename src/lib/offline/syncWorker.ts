import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { env } from "@/lib/env";
import type { Gesture } from "./types";
import { getRemoteTableName } from "./tableMap";
import { rollbackOpLocal, getAffectedStores } from "./ops";
import { sortOpsForSync } from "./syncOrder";
import { pullDataForFarm } from "./pull";

let intervalId: ReturnType<typeof setInterval> | null = null;
let isTickRunning = false;
let startupRecoveryDone = false;

const WORKER_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;
const AUTH_ERROR_MARKERS = ["HTTP 401", "Invalid JWT", "Unauthorized - invalid JWT"];

interface SyncBatchResult {
  status: string;
  op_id?: string;
  reason_code?: string;
  reason_message?: string;
}

interface SyncBatchResponse {
  results: SyncBatchResult[];
}

export const startSyncWorker = () => {
  if (intervalId) return;

  if (import.meta.env.DEV) {
    console.debug("[sync-worker] Starting sync worker");
  }
  intervalId = setInterval(async () => {
    if (isTickRunning) return;
    isTickRunning = true;

    try {
      if (!startupRecoveryDone) {
        await recoverAuthErroredGesturesOnce();
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
            last_error: error.message,
          });
        }
      }
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

function isRecoverableAuthError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  return AUTH_ERROR_MARKERS.some((marker) => errorMessage.includes(marker));
}

async function recoverAuthErroredGesturesOnce() {
  const errored = await db.queue_gestures.where("status").equals("ERROR").toArray();
  const recoverable = errored.filter((gesture) =>
    isRecoverableAuthError(gesture.last_error),
  );

  if (recoverable.length === 0) return;

  for (const gesture of recoverable) {
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "PENDING",
      retry_count: 0,
      last_error: "Recovered auth error; retrying after worker startup",
    });
  }

  console.warn(
    `[sync-worker] Re-queued ${recoverable.length} auth-related ERROR gesture(s)`,
  );
}

function logTokenExpiry(session: Session) {
  if (!import.meta.env.DEV) return;

  if (!session.expires_at) {
    console.debug("[sync-worker] Token expiry unavailable");
    return;
  }

  const tokenExpiry = new Date(session.expires_at * 1000);
  const now = new Date();
  const timeLeft = Math.floor((tokenExpiry.getTime() - now.getTime()) / 1000 / 60);
  console.debug("[sync-worker] Token expira em:", timeLeft, "minutos");
}

async function getValidSession() {
  const { supabase } = await import("@/lib/supabase");

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
      refreshError?.message ?? sessionError?.message ?? "session null after refresh";
    throw new Error(`Nao autenticado - sessao expirada (${reason})`);
  }

  return { supabase, session: refreshedSession };
}

async function sendBatchRequest(
  accessToken: string,
  gesture: Gesture,
  ops: Array<{
    client_op_id: string;
    table: string;
    action: "INSERT" | "UPDATE" | "DELETE";
    record: Record<string, unknown>;
  }>,
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

async function processGesture(gesture: Gesture) {
  await db.queue_gestures.update(gesture.client_tx_id, { status: "SYNCING" });

  const queuedOps = await db.queue_ops
    .where("client_tx_id")
    .equals(gesture.client_tx_id)
    .toArray();
  const ops = sortOpsForSync(queuedOps);

  try {
    const { supabase, session } = await getValidSession();
    const mappedOps = ops.map((o) => ({
      client_op_id: o.client_op_id,
      table: getRemoteTableName(o.table),
      action: o.action,
      record: o.record,
    }));

    if (import.meta.env.DEV) {
      console.debug(
        "[sync-worker] Tentando sync do TX:",
        gesture.client_tx_id.substring(0, 8),
      );
    }
    logTokenExpiry(session);

    let response = await sendBatchRequest(session.access_token, gesture, mappedOps);

    if (response.status === 401) {
      console.warn(
        "[sync-worker] HTTP 401 on sync-batch, attempting refresh + single retry",
      );

      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        throw new Error(`HTTP 401 - refresh failed: ${refreshError?.message ?? "no session"}`);
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
      throw new Error(`HTTP ${response.status}`);
    }

    const result = (await response.json()) as SyncBatchResponse;
    if (!Array.isArray(result.results)) {
      throw new Error("Invalid sync-batch response: results missing");
    }

    const allApplied = result.results.every(
      (r) => r.status === "APPLIED" || r.status === "APPLIED_ALTERED",
    );
    const hasRejected = result.results.some((r) => r.status === "REJECTED");

    if (allApplied) {
      const remoteTablesTouched = new Set(mappedOps.map((op) => op.table));
      const refreshTables = new Set<string>();

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

      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "DONE",
        last_error: undefined,
      });
      await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).delete();

      if (import.meta.env.DEV) {
        console.debug(`[sync-worker] TX ${gesture.client_tx_id} synced successfully`);
      }
      return;
    }

    if (hasRejected) {
      const rejectedResults = result.results.filter((r) => r.status === "REJECTED");
      const rejectionSummary = rejectedResults
        .map((r) => `${r.reason_code ?? "UNKNOWN"}: ${r.reason_message ?? "-"}`)
        .join(" | ");

      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "REJECTED",
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

      await db.transaction("rw", [...getAffectedStores(ops)], async () => {
        for (const op of [...ops].reverse()) {
          await rollbackOpLocal(op);
        }
      });

      console.warn(
        `[sync-worker] TX ${gesture.client_tx_id} had rejections (rolled back locally)`,
      );
      return;
    }

    throw new Error("Invalid sync-batch response: no APPLIED or REJECTED statuses");
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const retryCount = gesture.retry_count || 0;

    if (retryCount < MAX_RETRIES) {
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "PENDING",
        retry_count: retryCount + 1,
        last_error: error.message,
      });
      return;
    }

    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "ERROR",
      last_error: `Max retries: ${error.message}`,
    });
  }
}
