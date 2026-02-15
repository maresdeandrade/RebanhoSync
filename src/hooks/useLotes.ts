import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";

/**
 * Centralized hook for loading lotes (lots/batches) optimized for performance.
 *
 * OPTIMIZATION:
 * - Uses `where("fazenda_id").equals(...)` to leverage the database index instead of scanning all records.
 * - Filters out soft-deleted items at the database level where possible (or efficiently after index lookup).
 *
 * Replaces duplicated queries across:
 * - Registrar.tsx
 * - Lotes.tsx
 * - Animais.tsx
 *
 * @param farmIdOverride Optional farm ID to override the active farm ID from context
 * @returns Array of lotes for the target farm, or undefined while loading
 */
export function useLotes(farmIdOverride?: string) {
  const { activeFarmId } = useAuth();
  const targetFarmId = farmIdOverride || activeFarmId;

  return useLiveQuery(() => {
    if (!targetFarmId) return [];

    // PERF: Use index on 'fazenda_id' to avoid full table scan
    // This reduces time complexity from O(N) to O(log N + M) where M is the number of lots in the farm
    return db.state_lotes
      .where("fazenda_id")
      .equals(targetFarmId)
      .filter((l) => !l.deleted_at)
      .toArray();
  }, [targetFarmId]);
}
