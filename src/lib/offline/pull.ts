import { supabase } from "@/lib/supabase";
import { db } from "./db";
import { getLocalStoreName } from "./tableMap";
import type { PullCursor, PullCursorScope } from "./types";

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

export const SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES = [
  "sanitario_fontes_tecnicas_v2",
  "sanitario_fonte_cobertura_campos_v2",
  "sanitario_produtos_v2",
  "sanitario_produto_especie_autorizacao_v2",
  "sanitario_produto_fontes_v2",
  "sanitario_produto_dose_rules_v2",
  "sanitario_produto_carencia_rules_v2",
] as const;

export const SANITARIO_PROTOCOL_CATALOG_V2_REMOTE_TABLES = [
  "sanitario_protocolos_v2",
  "sanitario_protocolo_itens_versions_v2",
  "sanitario_product_class_groups_v2",
] as const;

export const SANITARIO_AGENDA_V2_REMOTE_TABLES = [
  "sanitario_agenda_v2",
  "sanitario_agenda_animais_v2",
  "sanitario_agenda_closures_v2",
] as const;

export interface PullOptions {
  // replace: clear local store then write remote snapshot
  // merge: upsert remote rows without clearing local store
  mode?: "replace" | "merge";
}

type RemoteRow = Record<string, unknown>;

interface CursorUpdate {
  key: string;
  remoteTable: string;
  localStore: string;
  scope: PullCursorScope;
  fazendaId: string | null;
  rows: RemoteRow[];
}

const PULL_CURSOR_STORE = "sync_pull_cursors";

function hasPullCursorStore() {
  return db.tables.some((table) => table.name === PULL_CURSOR_STORE);
}

function buildPullCursorKey(
  remoteTable: string,
  scope: PullCursorScope,
  fazendaId: string | null,
) {
  return `${remoteTable}:${scope}:${fazendaId ?? "null"}`;
}

async function getPullCursor(key: string): Promise<PullCursor | null> {
  if (!hasPullCursorStore()) return null;
  return ((await db.table(PULL_CURSOR_STORE).get(key)) as PullCursor | undefined) ?? null;
}

function getLatestUpdatedAtRow(rows: RemoteRow[]) {
  const rowsWithUpdatedAt = rows.filter(
    (row) => typeof row.updated_at === "string" && row.updated_at.length > 0,
  );

  if (rowsWithUpdatedAt.length === 0) return null;

  return [...rowsWithUpdatedAt].sort((a, b) => {
    const updatedDiff = String(a.updated_at).localeCompare(String(b.updated_at));
    if (updatedDiff !== 0) return updatedDiff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  }).at(-1) ?? null;
}

async function savePullCursor(update: CursorUpdate) {
  if (!hasPullCursorStore()) return;

  const latestRow = getLatestUpdatedAtRow(update.rows);
  if (!latestRow) return;

  const cursor: PullCursor = {
    key: update.key,
    remote_table: update.remoteTable,
    local_store: update.localStore,
    scope: update.scope,
    fazenda_id: update.fazendaId,
    last_updated_at: String(latestRow.updated_at),
    last_id: typeof latestRow.id === "string" ? latestRow.id : null,
    updated_at: new Date().toISOString(),
  };

  await db.table(PULL_CURSOR_STORE).put(cursor);
}

async function applyUpdatedAtCursor<TQuery>(
  query: TQuery,
  cursorKey: string,
): Promise<TQuery> {
  const cursor = await getPullCursor(cursorKey);
  if (!cursor?.last_updated_at) return query;

  const queryWithCursor = query as TQuery & {
    gte?: (column: string, value: string) => TQuery;
  };

  if (typeof queryWithCursor.gte !== "function") return query;

  // Rebusca o ultimo timestamp conhecido para nao perder empates de updated_at.
  return queryWithCursor.gte("updated_at", cursor.last_updated_at);
}

async function getLocalSanitarioProtocolIdsV2(): Promise<string[]> {
  const localStore = getLocalStoreName("sanitario_protocolos_v2");
  if (!db.tables.some((table) => table.name === localStore)) return [];

  const rows = (await db.table(localStore).toArray()) as RemoteRow[];
  return rows
    .filter(
      (row) =>
        row.scope === "global" &&
        row.fazenda_id === null &&
        typeof row.id === "string",
    )
    .map((row) => String(row.id));
}

async function writeMergeResults(
  storesToUpdate: Array<{ remote: string; local: string }>,
  results: Record<string, RemoteRow[]>,
  cursorUpdates: CursorUpdate[],
) {
  const storeNames = storesToUpdate.map((s) => s.local);
  const transactionStores = hasPullCursorStore()
    ? [...storeNames, PULL_CURSOR_STORE]
    : storeNames;

  await db.transaction("rw", transactionStores, async () => {
    for (const { remote, local } of storesToUpdate) {
      const rows = results[remote] ?? [];
      const store = db.table(local);

      if (rows.length > 0) {
        await store.bulkPut(rows);
      }

      console.log(
        `[pull] Synced ${rows.length} records for ${remote} -> ${local} (mode=merge)`,
      );
    }

    for (const cursorUpdate of cursorUpdates) {
      await savePullCursor(cursorUpdate);
    }
  });
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

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES) {
    const localStore = getLocalStoreName(remoteTable);
    const globalCursorKey = buildPullCursorKey(remoteTable, "global", null);
    const tenantCursorKey = buildPullCursorKey(remoteTable, "tenant", fazenda_id);

    const globalQuery = await applyUpdatedAtCursor(
      supabase
      .from(remoteTable)
      .select("*")
      .eq("scope", "global")
        .is("fazenda_id", null),
      globalCursorKey,
    );
    const globalResult = await globalQuery;

    if (globalResult.error) {
      console.error(`[pull] Error pulling global ${remoteTable}:`, globalResult.error);
      throw globalResult.error;
    }

    const tenantQuery = await applyUpdatedAtCursor(
      supabase
      .from(remoteTable)
      .select("*")
      .eq("scope", "tenant")
        .eq("fazenda_id", fazenda_id),
      tenantCursorKey,
    );
    const tenantResult = await tenantQuery;

    if (tenantResult.error) {
      console.error(`[pull] Error pulling tenant ${remoteTable}:`, tenantResult.error);
      throw tenantResult.error;
    }

    const globalRows = (globalResult.data ?? []) as RemoteRow[];
    const tenantRows = (tenantResult.data ?? []) as RemoteRow[];
    results[remoteTable] = [
      ...globalRows,
      ...tenantRows,
    ];
    cursorUpdates.push(
      {
        key: globalCursorKey,
        remoteTable,
        localStore,
        scope: "global",
        fazendaId: null,
        rows: globalRows,
      },
      {
        key: tenantCursorKey,
        remoteTable,
        localStore,
        scope: "tenant",
        fazendaId: fazenda_id,
        rows: tenantRows,
      },
    );
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

  await writeMergeResults(storesToUpdate, results, cursorUpdates);
};

export const pullSanitarioTechnicalCatalogV2 = async (
  fazenda_id: string,
) => {
  console.log(`[pull] Starting sanitario technical catalog v2 pull for farm ${fazenda_id}`);

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES) {
    const localStore = getLocalStoreName(remoteTable);
    if (remoteTable === "sanitario_fontes_tecnicas_v2") {
      const globalCursorKey = buildPullCursorKey(remoteTable, "global", null);
      const farmCursorKey = buildPullCursorKey(remoteTable, "fazenda", fazenda_id);
      const globalQuery = await applyUpdatedAtCursor(
        supabase
        .from(remoteTable)
        .select("*")
        .eq("scope", "global")
          .is("fazenda_id", null),
        globalCursorKey,
      );
      const globalResult = await globalQuery;

      if (globalResult.error) {
        console.error(`[pull] Error pulling global ${remoteTable}:`, globalResult.error);
        throw globalResult.error;
      }

      const farmQuery = await applyUpdatedAtCursor(
        supabase
        .from(remoteTable)
        .select("*")
        .eq("scope", "fazenda")
          .eq("fazenda_id", fazenda_id),
        farmCursorKey,
      );
      const farmResult = await farmQuery;

      if (farmResult.error) {
        console.error(`[pull] Error pulling farm-scoped ${remoteTable}:`, farmResult.error);
        throw farmResult.error;
      }

      const globalRows = (globalResult.data ?? []) as RemoteRow[];
      const farmRows = (farmResult.data ?? []) as RemoteRow[];
      results[remoteTable] = [
        ...globalRows,
        ...farmRows,
      ];
      cursorUpdates.push(
        {
          key: globalCursorKey,
          remoteTable,
          localStore,
          scope: "global",
          fazendaId: null,
          rows: globalRows,
        },
        {
          key: farmCursorKey,
          remoteTable,
          localStore,
          scope: "fazenda",
          fazendaId: fazenda_id,
          rows: farmRows,
        },
      );
      continue;
    }

    const cursorKey = buildPullCursorKey(remoteTable, "unscoped", null);
    const baseQuery = supabase.from(remoteTable).select("*");
    const query =
      remoteTable === "sanitario_produto_fontes_v2"
        ? baseQuery
        : await applyUpdatedAtCursor(baseQuery, cursorKey);
    const { data, error } = await query;

    if (error) {
      console.error(`[pull] Error pulling ${remoteTable}:`, error);
      throw error;
    }

    const rows = (data ?? []) as RemoteRow[];
    results[remoteTable] = rows;
    if (remoteTable !== "sanitario_produto_fontes_v2") {
      cursorUpdates.push({
        key: cursorKey,
        remoteTable,
        localStore,
        scope: "unscoped",
        fazendaId: null,
        rows,
      });
    }
  }

  const validTableNames = new Set(db.tables.map((t) => t.name));
  const storesToUpdate = SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES
    .map((rt) => ({ remote: rt, local: getLocalStoreName(rt) }))
    .filter(({ remote, local }) => {
      if (!validTableNames.has(local)) {
        console.warn(
          `[pull] Store ${local} not found for technical catalog v2 table ${remote}. Skipping.`,
        );
        return false;
      }
      return true;
    });

  if (storesToUpdate.length === 0) {
    console.warn("[pull] No valid technical catalog v2 stores to update.");
    return;
  }

  await writeMergeResults(storesToUpdate, results, cursorUpdates);
};

export const pullSanitarioProtocolCatalogV2 = async () => {
  console.log("[pull] Starting sanitario protocol catalog v2 pull");

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  const protocolsTable = "sanitario_protocolos_v2";
  const protocolLocalStore = getLocalStoreName(protocolsTable);
  const protocolCursorKey = buildPullCursorKey(protocolsTable, "global", null);
  const protocolQuery = await applyUpdatedAtCursor(
    supabase
      .from(protocolsTable)
      .select("*")
      .eq("scope", "global")
      .is("fazenda_id", null),
    protocolCursorKey,
  );
  const protocolResult = await protocolQuery;

  if (protocolResult.error) {
    console.error(`[pull] Error pulling ${protocolsTable}:`, protocolResult.error);
    throw protocolResult.error;
  }

  const protocolRows = (protocolResult.data ?? []) as RemoteRow[];
  results[protocolsTable] = protocolRows;
  cursorUpdates.push({
    key: protocolCursorKey,
    remoteTable: protocolsTable,
    localStore: protocolLocalStore,
    scope: "global",
    fazendaId: null,
    rows: protocolRows,
  });

  const protocolIds = Array.from(
    new Set([
      ...protocolRows
        .map((row) => row.id)
        .filter((id): id is string => typeof id === "string"),
      ...(await getLocalSanitarioProtocolIdsV2()),
    ]),
  ).sort();

  const itemsTable = "sanitario_protocolo_itens_versions_v2";
  const itemLocalStore = getLocalStoreName(itemsTable);
  const itemCursorKey = buildPullCursorKey(itemsTable, "global", null);
  let itemRows: RemoteRow[] = [];

  if (protocolIds.length > 0) {
    const itemQueryBase = supabase.from(itemsTable).select("*");
    const itemQueryWithProtocols = (
      itemQueryBase as typeof itemQueryBase & {
        in: (column: string, values: string[]) => typeof itemQueryBase;
      }
    ).in("protocol_id", protocolIds);
    const itemQuery = await applyUpdatedAtCursor(
      itemQueryWithProtocols,
      itemCursorKey,
    );
    const itemResult = await itemQuery;

    if (itemResult.error) {
      console.error(`[pull] Error pulling ${itemsTable}:`, itemResult.error);
      throw itemResult.error;
    }

    itemRows = (itemResult.data ?? []) as RemoteRow[];
  }

  results[itemsTable] = itemRows;
  cursorUpdates.push({
    key: itemCursorKey,
    remoteTable: itemsTable,
    localStore: itemLocalStore,
    scope: "global",
    fazendaId: null,
    rows: itemRows,
  });

  const groupsTable = "sanitario_product_class_groups_v2";
  const groupLocalStore = getLocalStoreName(groupsTable);
  const groupCursorKey = buildPullCursorKey(groupsTable, "global", null);
  const groupQuery = await applyUpdatedAtCursor(
    supabase
      .from(groupsTable)
      .select("*")
      .eq("scope", "global")
      .is("fazenda_id", null),
    groupCursorKey,
  );
  const groupResult = await groupQuery;

  if (groupResult.error) {
    console.error(`[pull] Error pulling ${groupsTable}:`, groupResult.error);
    throw groupResult.error;
  }

  const groupRows = (groupResult.data ?? []) as RemoteRow[];
  results[groupsTable] = groupRows;
  cursorUpdates.push({
    key: groupCursorKey,
    remoteTable: groupsTable,
    localStore: groupLocalStore,
    scope: "global",
    fazendaId: null,
    rows: groupRows,
  });

  const validTableNames = new Set(db.tables.map((t) => t.name));
  const storesToUpdate = SANITARIO_PROTOCOL_CATALOG_V2_REMOTE_TABLES
    .map((rt) => ({ remote: rt, local: getLocalStoreName(rt) }))
    .filter(({ remote, local }) => {
      if (!validTableNames.has(local)) {
        console.warn(
          `[pull] Store ${local} not found for protocol catalog v2 table ${remote}. Skipping.`,
        );
        return false;
      }
      return true;
    });

  if (storesToUpdate.length === 0) {
    console.warn("[pull] No valid protocol catalog v2 stores to update.");
    return;
  }

  await writeMergeResults(storesToUpdate, results, cursorUpdates);
};

export const pullSanitarioAgendaV2 = async (fazenda_id: string) => {
  console.log(`[pull] Starting sanitario agenda v2 pull for farm ${fazenda_id}`);

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of SANITARIO_AGENDA_V2_REMOTE_TABLES) {
    const localStore = getLocalStoreName(remoteTable);
    const cursorKey = buildPullCursorKey(remoteTable, "fazenda", fazenda_id);
    const query = await applyUpdatedAtCursor(
      supabase
      .from(remoteTable)
      .select("*")
        .eq("fazenda_id", fazenda_id),
      cursorKey,
    );
    const { data, error } = await query;

    if (error) {
      console.error(`[pull] Error pulling agenda v2 ${remoteTable}:`, error);
      throw error;
    }

    const rows = (data ?? []) as RemoteRow[];
    results[remoteTable] = rows;
    cursorUpdates.push({
      key: cursorKey,
      remoteTable,
      localStore,
      scope: "fazenda",
      fazendaId: fazenda_id,
      rows,
    });
  }

  const validTableNames = new Set(db.tables.map((t) => t.name));
  const storesToUpdate = SANITARIO_AGENDA_V2_REMOTE_TABLES
    .map((rt) => ({ remote: rt, local: getLocalStoreName(rt) }))
    .filter(({ remote, local }) => {
      if (!validTableNames.has(local)) {
        console.warn(
          `[pull] Store ${local} not found for agenda v2 table ${remote}. Skipping.`,
        );
        return false;
      }
      return true;
    });

  if (storesToUpdate.length === 0) {
    console.warn("[pull] No valid agenda v2 stores to update.");
    return;
  }

  await writeMergeResults(storesToUpdate, results, cursorUpdates);
};

export const pullInitialData = async (fazenda_id: string) => {
  await pullDataForFarm(fazenda_id, DEFAULT_REMOTE_TABLES, { mode: "replace" });
  await pullSanitarioProductClassV2Catalog(fazenda_id);
  await pullSanitarioTechnicalCatalogV2(fazenda_id);
  await pullSanitarioProtocolCatalogV2();
  await pullSanitarioAgendaV2(fazenda_id);
};
