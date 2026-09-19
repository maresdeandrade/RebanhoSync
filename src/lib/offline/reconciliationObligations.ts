import Dexie from "dexie";
import { db } from "./db";
import type {
  ReconciliationObligation,
  ReconciliationScope,
} from "./types";

export const RECONCILIATION_OBLIGATIONS_STORE = "sync_reconcile_obligations";

export function reconciliationObligationKey(
  fazendaId: string,
  scope: ReconciliationScope,
): string {
  return `${fazendaId}:${scope}`;
}

function newGenerationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `gen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface ReconciliationObligationUpsert {
  fazendaId: string;
  scope: ReconciliationScope;
  tables?: string[];
}

/**
 * Upsert idempotente por (fazenda_id, scope). Cada chamada gera um novo
 * generation_id para que um drain antigo não apague trabalho novo criado
 * por um ACK posterior. Mescla (união) a lista de tables quando presente.
 *
 * Pode ser chamada dentro de uma transação Dexie que inclua a store
 * `sync_reconcile_obligations`, preservando atomicidade com o ACK.
 */
export async function upsertReconciliationObligations(
  entries: readonly ReconciliationObligationUpsert[],
): Promise<void> {
  const now = new Date().toISOString();

  for (const entry of entries) {
    const key = reconciliationObligationKey(entry.fazendaId, entry.scope);
    const current = await db.sync_reconcile_obligations.get(key);

    const mergedTables =
      entry.tables && entry.tables.length > 0
        ? Array.from(
            new Set([...(current?.tables ?? []), ...entry.tables]),
          ).sort()
        : current?.tables;

    const obligation: ReconciliationObligation = {
      key,
      fazenda_id: entry.fazendaId,
      scope: entry.scope,
      tables: mergedTables,
      generation_id: newGenerationId(),
      created_at: current?.created_at ?? now,
      updated_at: now,
    };

    await db.sync_reconcile_obligations.put(obligation);
  }
}

export function listReconciliationObligations(
  fazendaId: string,
): Promise<ReconciliationObligation[]> {
  return db.sync_reconcile_obligations
    .where("[fazenda_id+scope]")
    .between([fazendaId, Dexie.minKey], [fazendaId, Dexie.maxKey])
    .toArray();
}

export async function deleteReconciliationObligationIfGenerationMatches(
  key: string,
  generationId: string,
): Promise<boolean> {
  return db.transaction("rw", [db.sync_reconcile_obligations], async () => {
    const current = await db.sync_reconcile_obligations.get(key);
    if (!current || current.generation_id !== generationId) {
      return false;
    }
    await db.sync_reconcile_obligations.delete(key);
    return true;
  });
}
