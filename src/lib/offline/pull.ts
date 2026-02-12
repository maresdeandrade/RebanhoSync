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
  console.log(
    `[pull] Starting pull for farm ${fazenda_id} (mode=${mode})`,
  );

  for (const remoteTable of remoteTables) {
    const { data, error } = await supabase
      .from(remoteTable)
      .select("*")
      .eq("fazenda_id", fazenda_id); // includes tombstones via deleted_at

    if (error) {
      console.error(`[pull] Error pulling ${remoteTable}:`, error);
      continue;
    }

    const rows = data ?? [];
    const localStore = getLocalStoreName(remoteTable);
    const store = db.table(localStore);

    if (!store) {
      console.error(
        `[pull] Store ${localStore} not found for table ${remoteTable}`,
      );
      continue;
    }

    if (mode === "replace") {
      await store.clear();
    }

    await store.bulkPut(rows);
    console.log(
      `[pull] Synced ${rows.length} records for ${remoteTable} -> ${localStore} (mode=${mode})`,
    );
  }
};

export const pullInitialData = async (fazenda_id: string) => {
  await pullDataForFarm(fazenda_id, DEFAULT_REMOTE_TABLES, { mode: "replace" });
};
