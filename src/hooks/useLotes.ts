import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";

/**
 * P2.4: Centralized hook for loading lotes (lots/batches)
 *
 * Optimization:
 * - Uses `fazenda_id` index to filter only relevant lots (O(log n) vs O(n)).
 * - Filters out soft-deleted records (`deleted_at`).
 * - Returns empty array if no farm is active.
 *
 * Replaces duplicated `useLiveQuery(() => db.state_lotes.toArray())` across:
 * - Registrar.tsx
 * - Lotes.tsx
 * - Animais.tsx
 *
 * @returns Array of all lotes for the current fazenda, or undefined if loading
 */
export function useLotes() {
  const { activeFarmId } = useAuth();

  return useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_lotes
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((l) => !l.deleted_at)
      .toArray();
  }, [activeFarmId]);
}
