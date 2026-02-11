import { supabase } from "@/lib/supabase";
import { db } from "./db";
import { getLocalStoreName } from "./tableMap";

export const pullInitialData = async (fazenda_id: string) => {
  console.log(`[pull] Starting initial pull for farm ${fazenda_id}`);

  const remoteTables = [
    "pastos",
    "lotes",
    "animais",
    "agenda_itens",
    "protocolos_sanitarios",
    "protocolos_sanitarios_itens",
    "contrapartes",
  ];

  for (const remoteTable of remoteTables) {
    const { data, error } = await supabase
      .from(remoteTable)
      .select("*")
      .eq("fazenda_id", fazenda_id); // ✅ inclui tombstones (deleted_at)

    if (error) {
      console.error(`[pull] Error pulling ${remoteTable}:`, error);
      continue;
    }

    const rows = data ?? [];
    const localStore = getLocalStoreName(remoteTable);
    const store = (db as any)[localStore];

    if (!store) {
      console.error(
        `[pull] Store ${localStore} not found for table ${remoteTable}`,
      );
      continue;
    }

    await store.clear();
    await store.bulkPut(rows); // ✅ idempotente
    console.log(
      `[pull] Synced ${rows.length} records for ${remoteTable} → ${localStore}`,
    );
  }
};
