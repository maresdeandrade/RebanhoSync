import { db } from "./db";
import type { GestureDiagnostics, ReconciliationObligation } from "./reconciliationTypes";

/** Diagnostics never supply a functional decision or expose the original error. */
export function sanitizeDiagnosticError(error: unknown) {
  const value = error instanceof Error ? error.message : "";
  const status = /\b(?:HTTP\s+)(401|403|409|412|429|500|502|503|504)\b/i.exec(value)?.[1];
  if (status) return { code: `HTTP_${status}`, message: `Falha HTTP ${status}.` };
  if (error instanceof Error && (error.name === "AbortError" || value === "Requisição interrompida.")) {
    return { code: "REQUEST_ABORTED", message: "Requisição interrompida." };
  }
  if (/failed to fetch|network|offline|^Falha de rede\.$/i.test(value)) {
    return { code: "NETWORK_FAILURE", message: "Falha de rede." };
  }
  return { code: "RECONCILIATION_FAILURE", message: "Falha na reconciliação." };
}

async function observe(action: () => Promise<unknown>) {
  try { await action(); } catch {
    console.warn("[sync-diagnostics] Diagnostic persistence unavailable");
  }
}

export function recordGestureDiagnostic(
  tx: string,
  farm: string,
  update: Partial<GestureDiagnostics>,
) {
  return observe(() => db.transaction("rw", db.queue_gestures, async () => {
    const gesture = await db.queue_gestures.get(tx);
    if (!gesture || gesture.fazenda_id !== farm) return;
    await db.queue_gestures.update(tx, { diagnostics: { ...gesture.diagnostics, ...update } });
  }));
}

/** Called only after the result's local transaction has committed. */
export function recordAcknowledgement(tx: string, farm: string) {
  return observe(() => db.transaction("rw", db.queue_gestures, db.sync_reconcile_obligations, async () => {
    const gesture = await db.queue_gestures.get(tx);
    if (!gesture || gesture.fazenda_id !== farm) return;
    const obligations = await db.sync_reconcile_obligations.where("fazenda_id").equals(farm).toArray();
    const links = new Map(gesture.diagnostics?.reconciliation?.map(link => [link.key, link]) ?? []);
    const now = new Date().toISOString();
    for (const obligation of obligations) {
      if (!obligation.diagnostics?.origins.some(origin => origin.client_tx_id === tx)) continue;
      const old = links.get(obligation.key);
      links.set(obligation.key, {
        key: obligation.key, scope: obligation.scope, generation_id: obligation.generation_id,
        required_at: old?.required_at ?? now,
        // A new generation is pending, even if an older generation completed.
        completed_at: old?.generation_id === obligation.generation_id ? old.completed_at : undefined,
      });
    }
    await db.queue_gestures.update(tx, { diagnostics: {
      ...gesture.diagnostics, ack_installed_at: now, reconciliation: Array.from(links.values()),
    } });
  }));
}

export function recordDrainAttempt(snapshot: ReconciliationObligation) {
  return observe(() => db.transaction("rw", db.sync_reconcile_obligations, async () => {
    const current = await db.sync_reconcile_obligations.get(snapshot.key);
    if (!current || current.generation_id !== snapshot.generation_id) return;
    await db.sync_reconcile_obligations.update(snapshot.key, { diagnostics: {
      ...current.diagnostics, origins: current.diagnostics?.origins ?? [],
      drain_attempts: (current.diagnostics?.drain_attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    } });
  }));
}

export function recordDrainFailure(snapshot: ReconciliationObligation, error: unknown) {
  return observe(() => db.transaction("rw", db.sync_reconcile_obligations, async () => {
    const current = await db.sync_reconcile_obligations.get(snapshot.key);
    if (!current || current.generation_id !== snapshot.generation_id) return;
    await db.sync_reconcile_obligations.update(snapshot.key, { diagnostics: {
      ...current.diagnostics, origins: current.diagnostics?.origins ?? [],
      last_error_at: new Date().toISOString(), last_error: sanitizeDiagnosticError(error),
    } });
  }));
}

export function recordDrainCompletion(snapshot: ReconciliationObligation, deletedByCommittedInstallation = false) {
  return observe(() => db.transaction("rw", db.queue_gestures, db.sync_reconcile_obligations, async () => {
    const current = await db.sync_reconcile_obligations.get(snapshot.key);
    // Conservative coverage: a generation changed during pull is never declared complete.
    if (current ? current.generation_id !== snapshot.generation_id : !deletedByCommittedInstallation) return;
    for (const origin of snapshot.diagnostics?.origins ?? []) {
      const gesture = await db.queue_gestures.get(origin.client_tx_id);
      if (!gesture || gesture.fazenda_id !== snapshot.fazenda_id) continue;
      const links = gesture.diagnostics?.reconciliation ?? [];
      const completed = { key: snapshot.key, scope: snapshot.scope,
        generation_id: snapshot.generation_id, required_at: snapshot.created_at,
        completed_at: new Date().toISOString() };
      await db.queue_gestures.update(gesture.client_tx_id, { diagnostics: {
        ...gesture.diagnostics,
        reconciliation: [...links.filter(link => link.key !== snapshot.key), completed],
      } });
    }
  }));
}
