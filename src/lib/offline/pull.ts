import { supabase } from "@/lib/supabase";
import { db } from "./db";
import { getLocalStoreName } from "./tableMap";

export const DEFAULT_REMOTE_TABLES = [
  "pastos",
  "lotes",
  "animais",
  "agenda_itens",
  "eventos",
  "eventos_sanitario",
  "eventos_comercial",
  "eventos_nutricao",
  "eventos_pasto_avaliacao",
  "protocolos_sanitarios",
  "protocolos_sanitarios_itens",
  "fazenda_sanidade_config",
  "sanitario_casos",
  "insumos",
  "insumo_apresentacoes",
  "insumo_lotes",
  "insumo_movimentacoes",
  "contrapartes",
  "sociedades_pecuarias",
  "sociedade_animais",
  "finance_categories",
  "finance_transactions",
] as const;

export const SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES = [
  "sanitario_product_classes_v2",
  "sanitario_product_class_groups_v2",
  "sanitario_product_class_group_members_v2",
  "sanitario_product_class_default_rules_v2",
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

export const pullSanitarioProductClassV2Catalog = async (
  fazenda_id: string,
) => {
  console.log(`[pull] Starting sanitario ProductClass v2 catalog pull for farm ${fazenda_id}`);

  const results: Record<string, unknown[]> = {};

  for (const remoteTable of SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES) {
    const globalResult = await supabase
      .from(remoteTable)
      .select("*")
      .eq("scope", "global")
      .is("fazenda_id", null);

    if (globalResult.error) {
      console.error(`[pull] Error pulling global ${remoteTable}:`, globalResult.error);
      throw globalResult.error;
    }

    const tenantResult = await supabase
      .from(remoteTable)
      .select("*")
      .eq("scope", "tenant")
      .eq("fazenda_id", fazenda_id);

    if (tenantResult.error) {
      console.error(`[pull] Error pulling tenant ${remoteTable}:`, tenantResult.error);
      throw tenantResult.error;
    }

    results[remoteTable] = [
      ...(globalResult.data ?? []),
      ...(tenantResult.data ?? []),
    ];
  }

  const validTableNames = new Set(db.tables.map((t) => t.name));
  const storesToUpdate = SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES
    .map((rt) => ({ remote: rt, local: getLocalStoreName(rt) }))
    .filter(({ remote, local }) => {
      if (!validTableNames.has(local)) {
        console.warn(
          `[pull] Store ${local} not found for ProductClass v2 table ${remote}. Skipping.`,
        );
        return false;
      }
      return true;
    });

  if (storesToUpdate.length === 0) {
    console.warn("[pull] No valid ProductClass v2 catalog stores to update.");
    return;
  }

  await db.transaction("rw", storesToUpdate.map((s) => s.local), async () => {
    for (const { remote, local } of storesToUpdate) {
      const rows = results[remote];
      const store = db.table(local);

      if (rows.length > 0) {
        await store.bulkPut(rows);
      }

      console.log(
        `[pull] Synced ${rows.length} ProductClass v2 records for ${remote} -> ${local} (mode=merge)`,
      );
    }
  });
};

export const pullInitialData = async (fazenda_id: string) => {
  await pullDataForFarm(fazenda_id, DEFAULT_REMOTE_TABLES, { mode: "replace" });
  await pullSanitarioProductClassV2Catalog(fazenda_id);
};
