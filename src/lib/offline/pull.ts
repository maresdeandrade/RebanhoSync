import { supabase } from "@/lib/supabase";
import { db } from "./db";
import { getLocalStoreName } from "./tableMap";

const DEFAULT_REMOTE_TABLES = [
  "pastos",
  "lotes",
  "animais",
  "agenda_itens",
  "protocolos_sanitarios",
  "protocolos_sanitarios_itens",
  "fazenda_sanidade_config",
  "contrapartes",
] as const;

export interface PullOptions {
  // replace: clear local store then write remote snapshot
  // merge: upsert remote rows without clearing local store
  mode?: "replace" | "merge";
}

export const pullDataForFarm = async (
  fazenda_id: string,
  remoteTables: readonly string[] = DEFAULT_REMOTE_TABLES,
  options: PullOptions = {},
) => {
  const mode = options.mode ?? "replace";
  console.log(`[pull] Starting pull for farm ${fazenda_id} (mode=${mode})`);

  // 1. Fetch all data first (fail fast)
  const results: Record<string, unknown[]> = {};

  for (const remoteTable of remoteTables) {
    const { data, error } = await supabase
      .from(remoteTable)
      .select("*")
      .eq("fazenda_id", fazenda_id); // includes tombstones via deleted_at

    if (error) {
      console.error(`[pull] Error pulling ${remoteTable}:`, error);
      throw error; // Abort immediately on critical failure
    }

    results[remoteTable] = data ?? [];
  }

  // 2. Determine valid local stores involved
  // We filter out invalid stores to prevent transaction failure, but log warning
  const validTableNames = new Set(db.tables.map((t) => t.name));
  const storesToUpdate = remoteTables
    .map((rt) => ({ remote: rt, local: getLocalStoreName(rt) }))
    .filter(({ remote, local }) => {
      if (!validTableNames.has(local)) {
        console.warn(
          `[pull] Store ${local} not found for table ${remote}. Skipping.`,
        );
        return false;
      }
      return true;
    });

  if (storesToUpdate.length === 0) {
    console.warn("[pull] No valid stores to update.");
    return;
  }

  const storeNames = storesToUpdate.map((s) => s.local);

  // 3. Write in a single transaction
  await db.transaction("rw", storeNames, async () => {
    for (const { remote, local } of storesToUpdate) {
      const rows = results[remote];
      const store = db.table(local);

      if (mode === "replace") {
        await store.clear();
      }

      if (rows.length > 0) {
        await store.bulkPut(rows);
      }

      console.log(
        `[pull] Synced ${rows.length} records for ${remote} -> ${local} (mode=${mode})`,
      );
    }
  });
};

export const pullInitialData = async (fazenda_id: string) => {
  await pullDataForFarm(fazenda_id, DEFAULT_REMOTE_TABLES, { mode: "replace" });
};
