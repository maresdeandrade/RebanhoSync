import { db } from "./db";
import type { GestureDiagnostics, ReconciliationObligation } from "./reconciliationTypes";

/** Diagnostics never supply a functional decision or expose the original error. */
export function sanitizeDiagnosticError(error: unknown, fallbackCode = "RECONCILIATION_FAILURE") {
  const value = error instanceof Error ? error.message : "";
  const status = /\b(?:HTTP\s+)(401|403|409|412|429|5\d{2})\b/i.exec(value)?.[1];
  if (status) return { code: `HTTP_${status}`, message: `Falha HTTP ${status}.` };
  const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
  if (name === "AbortError" || name === "TimeoutError" || value === "Requisição interrompida.") {
    return { code: "REQUEST_ABORTED", message: "Requisição interrompida." };
  }
  if (/failed to fetch|fetch failed|network|offline|name resolution fail|^Falha de rede\.$/i.test(value)) {
    return { code: "NETWORK_FAILURE", message: "Falha de rede." };
  }
  return { code: fallbackCode, message: fallbackCode === "RECONCILIATION_FAILURE"
    ? "Falha na reconciliação." : "Falha na sincronização." };
}

export function backlogByFarm(pending: readonly { fazenda_id: string }[]) {
  const counts = new Map<string, number>();
  for (const gesture of pending) {
    counts.set(gesture.fazenda_id, (counts.get(gesture.fazenda_id) ?? 0) + 1);
  }
  return Array.from(counts, ([fazendaId, quantity]) => ({ fazendaId, quantity }));
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
      links.set(obligation.key, acknowledgementLink(obligation, old, now));
    }
    await db.queue_gestures.update(tx, { diagnostics: {
      ...gesture.diagnostics, ack_installed_at: now, reconciliation: Array.from(links.values()),
    } });
  }));
}

type ReconciliationLink = NonNullable<GestureDiagnostics["reconciliation"]>[number];

function acknowledgementLink(obligation: ReconciliationObligation, old: ReconciliationLink | undefined, now: string): ReconciliationLink {
  return {
    key: obligation.key, scope: obligation.scope, generation_id: obligation.generation_id,
    required_at: old?.required_at ?? now,
    // A new generation is pending, even if an older generation completed.
    completed_at: old?.generation_id === obligation.generation_id ? old.completed_at : undefined,
  };
}

export async function recordAcknowledgementIfCommitted(committed: boolean, tx: string, farm: string) {
  if (committed) await recordAcknowledgement(tx, farm);
}

function updateDrainDiagnostic(snapshot: ReconciliationObligation,
  update: (current: ReconciliationObligation) => Partial<NonNullable<ReconciliationObligation["diagnostics"]>>,
) {
  return observe(() => db.transaction("rw", db.sync_reconcile_obligations, async () => {
    const current = await db.sync_reconcile_obligations.get(snapshot.key);
    if (!current || current.generation_id !== snapshot.generation_id) return;
    await db.sync_reconcile_obligations.update(snapshot.key, { diagnostics: {
      ...current.diagnostics, origins: current.diagnostics?.origins ?? [],
      ...update(current),
    } });
  }));
}

export function recordDrainAttempt(snapshot: ReconciliationObligation) {
  return updateDrainDiagnostic(snapshot, current => ({
    drain_attempts: (current.diagnostics?.drain_attempts ?? 0) + 1,
    last_attempt_at: new Date().toISOString(),
  }));
}

export function recordDrainFailure(snapshot: ReconciliationObligation, error: unknown) {
  return updateDrainDiagnostic(snapshot, () => ({
    last_error_at: new Date().toISOString(), last_error: sanitizeDiagnosticError(error),
  }));
}

function completionGenerationMatches(current: ReconciliationObligation | undefined,
  snapshot: ReconciliationObligation, deletedByCommittedInstallation: boolean) {
  return current ? current.generation_id === snapshot.generation_id : deletedByCommittedInstallation;
}

export function recordDrainCompletion(snapshot: ReconciliationObligation, deletedByCommittedInstallation = false) {
  return observe(() => db.transaction("rw", db.queue_gestures, db.sync_reconcile_obligations, async () => {
    const current = await db.sync_reconcile_obligations.get(snapshot.key);
    // Conservative coverage: a generation changed during pull is never declared complete.
    if (!completionGenerationMatches(current, snapshot, deletedByCommittedInstallation)) return;
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
