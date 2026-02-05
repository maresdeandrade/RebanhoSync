import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";

/**
 * P2.4: Centralized hook for loading lotes (lots/batches)
 * 
 * Replaces duplicated `useLiveQuery(() => db.state_lotes.toArray())` across:
 * - Registrar.tsx
 * - Lotes.tsx  
 * - Animais.tsx
 * 
 * @returns Array of all lotes for the current fazenda, or undefined if loading
 */
export function useLotes() {
  return useLiveQuery(() => db.state_lotes.toArray());
}
