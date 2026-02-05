import { db } from "./db";
import { env } from "@/lib/env";
import type { Gesture } from "./types";
import { getRemoteTableName } from "./tableMap";
import { rollbackOpLocal, getAffectedStores } from "./ops";

// Usando o tipo de retorno do setInterval do navegador
let intervalId: ReturnType<typeof setInterval> | null = null;

export const startSyncWorker = () => {
  if (intervalId) return;

  console.log("[sync-worker] Starting sync worker");
  intervalId = setInterval(async () => {
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
  }, 5000);
};

export const stopSyncWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

async function processGesture(gesture: Gesture) {
  await db.queue_gestures.update(gesture.client_tx_id, { status: "SYNCING" });

  const ops = await db.queue_ops
    .where("client_tx_id")
    .equals(gesture.client_tx_id)
    .toArray();

  try {
    // ✅ Get current session for JWT
    const { supabase } = await import("@/lib/supabase");
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("Não autenticado - sessão expirada");
    }

    const response = await fetch(`${env.supabaseFunctionsUrl}/sync-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`, // ✅ JWT
      },
      body: JSON.stringify({
        client_id: gesture.client_id,
        fazenda_id: gesture.fazenda_id,
        client_tx_id: gesture.client_tx_id,
        ops: ops.map((o) => ({
          client_op_id: o.client_op_id,
          table: getRemoteTableName(o.table),
          action: o.action,
          record: o.record,
        })),
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    const allApplied = result.results.every(
      (r: any) => r.status === "APPLIED" || r.status === "APPLIED_ALTERED",
    );
    const hasRejected = result.results.some((r: any) => r.status === "REJECTED");

    if (allApplied) {
      await db.queue_gestures.update(gesture.client_tx_id, { status: "DONE" });
      await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).delete();
      console.log(`[sync-worker] TX ${gesture.client_tx_id} synced successfully`);
    } else if (hasRejected) {
      await db.queue_gestures.update(gesture.client_tx_id, { status: "REJECTED" });

      for (const res of result.results.filter((r: any) => r.status === "REJECTED")) {
        const originalOp = ops.find((o) => o.client_op_id === res.op_id);
        if (originalOp) {
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
      }

      // ✅ ROLLBACK local (reverts state_*/event_* to maintain UI integrity)
      await db.transaction("rw", [...getAffectedStores(ops)], async () => {
        // Rollback in reverse order to handle dependencies (e.g., INSERT evento → INSERT detalhe → UPDATE animal)
        for (const op of [...ops].reverse()) {
          await rollbackOpLocal(op);
        }
      });

      console.warn(`[sync-worker] TX ${gesture.client_tx_id} had rejections (rolled back locally)`);
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));

    const retryCount = gesture.retry_count || 0;
    if (retryCount < 3) {
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "PENDING",
        retry_count: retryCount + 1,
        last_error: error.message,
      });
    } else {
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "ERROR",
        last_error: `Max retries: ${error.message}`,
      });
    }
  }
}