import { supabase } from "@/lib/supabase";
import { recomputeSanitaryComplianceAfterPullV2 } from "@/lib/sanitario/compliance/sanitaryComplianceV2";
import { isSanitaryEvidenceOperation } from "./sanitaryFoundationRecovery";
import { db } from "./db";
import {
  getLocalStoreName,
  getRemoteTableName,
  STANDARD_EVENT_DETAIL_REMOTE_TABLES,
} from "./tableMap";
import { getPendingCommercialPurchaseRecords } from "@/lib/comercial/animalPurchaseSync";
import { getPendingCommercialOperationRecords } from "@/lib/comercial/commercialOperationSync";
import type { IndexableType } from "dexie";
import type { Operation, PullCursor, PullCursorScope } from "./types";

export const DEFAULT_REMOTE_TABLES = [
  "pastos",
  "lotes",
  "animais",
  "agenda_itens",
  "eventos",
  "eventos_sanitario",
  ...STANDARD_EVENT_DETAIL_REMOTE_TABLES,
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
  "sanitario_produto_carencia_fontes_v2",
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
  "sanitario_participacoes",
  "sanitario_participacao_operacoes",
  "sanitario_agenda_resultados",
  "sanitario_continuidade_solicitacoes",
] as const;

export interface PullOptions {
  // replace: replace only this farm, preserving pending rows
  // merge: upsert remote rows without clearing local store
  mode?: "replace" | "merge";
  tableModes?: Record<string, "replace" | "merge">;
  observations?: Record<string, { key: string; ids: string[] }>;
  // Required raw snapshot coverage, before pending protection or any writes.
  requiredAnimalIds?: readonly string[];
  // Movement reconciliation releases protection and completes captured operations
  // in the same transaction that installs the remote observations.
  reconciliation?: {
    stores: string[];
    select: (
      results: Record<string, unknown[]>,
    ) => Promise<ReadonlySet<string>>;
    complete: (selected: ReadonlySet<string>) => Promise<void>;
  };
}

type RemoteRow = Record<string, unknown>;
type StoreUpdate = { remote: string; local: string };
type PullMode = NonNullable<PullOptions["mode"]>;

const PENDING_FACTUAL_REMOTE_TABLES = new Set<string>([
  "eventos",
  "eventos_sanitario",
  "eventos_reproducao",
  "eventos_comercial",
  "eventos_animais",
  "insumo_movimentacoes",
  ...STANDARD_EVENT_DETAIL_REMOTE_TABLES,
]);

function getFactualEventId(remoteTable: string, row: RemoteRow) {
  if (remoteTable === "eventos") return row.id;
  if (remoteTable === "insumo_movimentacoes") return row.source_evento_id;
  if (remoteTable === "eventos_ecc") return row.event_id;
  return row.evento_id;
}

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
  return (
    ((await db.table(PULL_CURSOR_STORE).get(key)) as PullCursor | undefined) ??
    null
  );
}

function getLatestUpdatedAtRow(rows: RemoteRow[]) {
  const rowsWithUpdatedAt = rows.filter(
    (row) => typeof row.updated_at === "string" && row.updated_at.length > 0,
  );

  if (rowsWithUpdatedAt.length === 0) return null;

  return (
    [...rowsWithUpdatedAt]
      .sort((a, b) => {
        const updatedDiff = String(a.updated_at).localeCompare(
          String(b.updated_at),
        );
        if (updatedDiff !== 0) return updatedDiff;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      })
      .at(-1) ?? null
  );
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

function sameEventoAnimal(left: RemoteRow, right: RemoteRow) {
  return (
    left.id === right.id &&
    left.fazenda_id === right.fazenda_id &&
    left.evento_id === right.evento_id &&
    left.animal_id === right.animal_id
  );
}

async function appendEventoAnimais(
  store: ReturnType<typeof db.table>,
  rows: RemoteRow[],
) {
  for (const row of rows) {
    if (
      typeof row.id !== "string" ||
      typeof row.fazenda_id !== "string" ||
      typeof row.evento_id !== "string" ||
      typeof row.animal_id !== "string"
    ) {
      throw new Error("SANITARIO_V2_EVENT_ANIMAL_INVALID");
    }
    const existingById = (await store.get(row.id)) as RemoteRow | undefined;
    if (existingById) {
      if (!sameEventoAnimal(existingById, row)) {
        throw new Error("SANITARIO_V2_EVENT_ANIMAL_APPEND_ONLY_VIOLATION");
      }
      if (existingById.created_at !== row.created_at) await store.put(row);
      continue;
    }
    const existingFact = (await store
      .where("[fazenda_id+evento_id+animal_id]")
      .equals([row.fazenda_id, row.evento_id, row.animal_id])
      .first()) as RemoteRow | undefined;
    if (existingFact) {
      if (!sameEventoAnimal(existingFact, row)) {
        throw new Error("SANITARIO_V2_EVENT_ANIMAL_FACT_COLLISION");
      }
      continue;
    }
    await store.add(row);
  }
}

async function getPendingFactualEventIds(
  reconciled = new Set<string>() as ReadonlySet<string>,
) {
  const operations = await db.queue_ops.toArray();
  return new Set(
    operations
      .filter(
        (operation) =>
          (operation.sync_state !== "REJECTED" ||
            isSanitaryEvidenceOperation(operation)) &&
          !reconciled.has(operation.client_op_id),
      )
      .flatMap((operation) => {
        if (operation.table === "movement_v1") {
          return [String(operation.record.event_id)];
        }
        const commercialRecords = [
          ...getPendingCommercialPurchaseRecords(operation),
          ...getPendingCommercialOperationRecords(operation),
        ];
        const commercialEvent = commercialRecords.find(
          ({ table }) => table === "eventos",
        )?.record;
        if (typeof commercialEvent?.id === "string") {
          return [commercialEvent.id];
        }
        const remoteTable = getRemoteTableName(operation.table);
        if (PENDING_FACTUAL_REMOTE_TABLES.has(remoteTable)) {
          const eventId = getFactualEventId(remoteTable, operation.record);
          return typeof eventId === "string" ? [eventId] : [];
        }
        if (operation.table !== "sanitario_v2") return [];
        const record = operation.record as RemoteRow;
        const payload = record?.payload;
        const event =
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? (payload as RemoteRow).event
            : null;
        return record?.command === "apply_factual_core" &&
          event &&
          typeof event === "object" &&
          !Array.isArray(event) &&
          typeof (event as RemoteRow).id === "string"
          ? [String((event as RemoteRow).id)]
          : [];
      }),
  );
}

function getMovementPendingCandidates(operation: Operation) {
  if (operation.table !== "movement_v1" || operation.sync_state === "REJECTED")
    return [];
  const record = operation.record;
  return [
    {
      table: "animais",
      record: { id: record.subject_id, fazenda_id: record.fazenda_id },
    },
    {
      table: "eventos",
      record: { id: record.event_id, fazenda_id: record.fazenda_id },
    },
    {
      table: "eventos_movimentacao",
      record: { evento_id: record.event_id, fazenda_id: record.fazenda_id },
    },
  ];
}

async function getPendingRecordIds(
  remoteTables: readonly string[],
  fazendaId: string,
  reconciled = new Set<string>() as ReadonlySet<string>,
) {
  const protectedTables = new Set(remoteTables);
  const pendingIds = new Map<string, Set<string>>();
  if (protectedTables.size === 0) return pendingIds;

  const operations = await db.queue_ops.toArray();
  const farmByTransaction = new Map(
    (await db.queue_gestures.toArray()).map((gesture) => [
      gesture.client_tx_id,
      gesture.fazenda_id,
    ]),
  );
  const sanitaryTransactions = new Set(
    operations.filter(isSanitaryEvidenceOperation).map((op) => op.client_tx_id),
  );
  for (const operation of operations) {
    if (isRejectedSanitaryRescheduleConflict(operation)) continue;
    if (
      (operation.sync_state === "REJECTED" &&
        !sanitaryTransactions.has(operation.client_tx_id)) ||
      reconciled.has(operation.client_op_id)
    )
      continue;
    const candidates = getOperationCandidates(
      operation,
      farmByTransaction.get(operation.client_tx_id),
    );
    for (const candidate of candidates) {
      const remoteTable = getRemoteTableName(candidate.table);
      if (!protectedTables.has(remoteTable)) continue;
      if (candidate.record?.fazenda_id !== fazendaId) continue;
      const id = pendingRecordId(remoteTable, candidate.record);
      if (typeof id !== "string") continue;
      const ids = pendingIds.get(remoteTable) ?? new Set<string>();
      ids.add(id);
      pendingIds.set(remoteTable, ids);
    }
  }
  return pendingIds;
}

function isRejectedSanitaryRescheduleConflict(operation: Operation) {
  return operation.sync_state === "REJECTED" &&
    operation.table === "sanitario_v2" &&
    operation.record?.command === "reschedule_agenda" &&
    operation.blocked_reason === "SANITARIO_AGENDA_REVISION_CONFLICT";
}

async function fetchConflictedSanitaryAgendas(fazendaId: string): Promise<RemoteRow[]> {
  const targets = (await db.queue_ops.toArray()).filter(op =>
    isRejectedSanitaryRescheduleConflict(op) && op.record.fazenda_id === fazendaId,
  ).map(op => ({
    id: asRemoteRow(op.record.payload)?.agenda_id,
    expectedRevision: op.record.expected_revision,
  }));
  if (targets.length === 0) return [];
  if (targets.some(target => typeof target.id !== "string" || typeof target.expectedRevision !== "number"))
    throw new Error("SANITARIO_CONFLICT_RECONCILIATION_INVALID_ENVELOPE");
  const ids = [...new Set(targets.map(target => target.id as string))];
  const { data, error } = await supabase.from("sanitario_agenda_v2").select("*")
    .eq("fazenda_id", fazendaId).in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as RemoteRow[];
  if (targets.some(target => !rows.some(row => row.id === target.id && row.fazenda_id === fazendaId &&
    typeof row.revision === "number" && row.revision > (target.expectedRevision as number))))
    throw new Error("SANITARIO_CONFLICT_RECONCILIATION_SNAPSHOT_UNAVAILABLE");
  return rows;
}

function mergeConflictedSanitaryAgendas(rows: RemoteRow[], targets: RemoteRow[]) {
  const targetedIds = new Set(targets.map(row => row.id));
  return [...rows.filter(row => !targetedIds.has(row.id)), ...targets];
}

function asRemoteRow(value: unknown): RemoteRow | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RemoteRow)
    : null;
}

function getSanitarioPendingEventId(
  operation: Awaited<ReturnType<typeof db.queue_ops.toArray>>[number],
): string | null {
  if (operation.table !== "sanitario_v2") return null;
  const record = operation.record as RemoteRow;
  if (record.command !== "apply_factual_core") return null;
  const payload = asRemoteRow(record.payload);
  const event = asRemoteRow(payload?.event);
  return typeof event?.id === "string" ? event.id : null;
}

function isPlanningEnvelope(envelope: Operation["record"]) {
  return envelope.domain === "sanitario_v2" && envelope.command !== "manage_agenda";
}

function pendingDeathParticipant(operation: Operation, payload: RemoteRow, farm: unknown) {
  return operation.sync_state === "REJECTED" ? [] : [{
    table: "sanitario_agenda_animais_v2",
    record: { agenda_id: payload.agenda_id, animal_id: payload.animal_id, fazenda_id: farm },
  }];
}

function getPendingPlanningRecords(
  operation: Operation,
  legacyFarmId?: string,
) {
  const envelope = operation.record;
  // Management commands preserve their queue/draft but do not optimistically
  // mutate Agenda rows. A pending/rejected decision must not hide another
  // operator's confirmed barrier, closure or revised result from pull.
  if (!isPlanningEnvelope(envelope)) return [];
  const payload = remoteRecord(envelope.payload);
  const agenda = remoteRecord(payload.agenda);
  const closure = remoteRecord(payload.closure);
  const farm = envelope.fazenda_id ?? legacyFarmId;
  if (envelope.command === "death_participant") return pendingDeathParticipant(operation, payload, farm);
  const agendaId = agenda.id ?? payload.agenda_id ?? closure.agenda_id;
  const candidates: Array<{ table: string; record: RemoteRow }> = [];
  if (typeof agendaId === "string") {
    candidates.push({
      table: "sanitario_agenda_v2",
      record: { id: agendaId, fazenda_id: farm },
    });
    candidates.push(...pendingAgendaAnimals(payload, agendaId, farm));
  }
  if (typeof closure.id === "string")
    candidates.push({
      table: "sanitario_agenda_closures_v2",
      record: { ...closure, fazenda_id: farm },
    });
  return candidates;
}
function remoteRecord(value: unknown) {
  return asRemoteRow(value) ?? {};
}
function pendingAgendaAnimals(
  payload: RemoteRow,
  agendaId: string,
  farm: unknown,
) {
  if (!Array.isArray(payload.animal_ids)) return [];
  return payload.animal_ids.map((animalId) => ({
    table: "sanitario_agenda_animais_v2",
    record: { agenda_id: agendaId, animal_id: animalId, fazenda_id: farm },
  }));
}

function getOperationCandidates(
  operation: Awaited<ReturnType<typeof db.queue_ops.toArray>>[number],
  legacyFarmId?: string,
) {
  const candidates: Array<{ table: string; record: RemoteRow }> = [
    { table: operation.table, record: operation.record },
    ...getMovementPendingCandidates(operation),
    ...getPendingCommercialPurchaseRecords(operation),
    ...getPendingCommercialOperationRecords(operation),
  ];
  const eventId = getSanitarioPendingEventId(operation);
  candidates.push(...getPendingPlanningRecords(operation, legacyFarmId));

  if (eventId) {
    candidates.push(
      { table: "eventos", record: { id: eventId } },
      { table: "eventos_sanitario", record: { evento_id: eventId } },
    );
  }

  return candidates;
}

function getLocalPrimaryKey(
  localStore: string,
  record: RemoteRow,
): IndexableType | null {
  const keyPath = db.table(localStore).schema.primKey.keyPath;
  if (typeof keyPath === "string") {
    return (record[keyPath] as IndexableType | undefined) ?? null;
  }
  if (Array.isArray(keyPath)) {
    const values = keyPath.map((key) => record[key]);
    return values.every((value) => value !== undefined && value !== null)
      ? (values as IndexableType[])
      : null;
  }
  return null;
}

async function getPendingLocalRecordKeys(storesToUpdate: StoreUpdate[]) {
  const storesByRemote = new Map(
    storesToUpdate.map(({ remote, local }) => [remote, local]),
  );
  const keys = new Map<string, Map<string, IndexableType>>();
  const operations = await db.queue_ops.toArray();

  const sanitaryTransactions = new Set(
    operations.filter(isSanitaryEvidenceOperation).map((op) => op.client_tx_id),
  );
  for (const operation of operations) {
    if (
      operation.sync_state === "REJECTED" &&
      !sanitaryTransactions.has(operation.client_tx_id)
    )
      continue;
    for (const candidate of getOperationCandidates(operation)) {
      const remoteTable = getRemoteTableName(candidate.table);
      const localStore = storesByRemote.get(remoteTable);
      if (!localStore) continue;
      const key = getLocalPrimaryKey(localStore, candidate.record);
      if (key === null) continue;
      const tableKeys =
        keys.get(remoteTable) ?? new Map<string, IndexableType>();
      tableKeys.set(JSON.stringify(key), key);
      keys.set(remoteTable, tableKeys);
    }
  }

  return new Map(
    [...keys].map(([remoteTable, tableKeys]) => [
      remoteTable,
      [...tableKeys.values()],
    ]),
  );
}

async function getPendingLocalRows(
  storesToUpdate: StoreUpdate[],
  modes: ReadonlyMap<string, PullMode>,
) {
  const pendingRows = new Map<string, RemoteRow[]>();
  const replacementStores = storesToUpdate.filter(
    ({ remote }) => modes.get(remote) === "replace",
  );
  if (replacementStores.length === 0) return pendingRows;
  const pendingKeys = await getPendingLocalRecordKeys(replacementStores);
  for (const { remote, local } of replacementStores) {
    const keys = pendingKeys.get(remote);
    if (!keys?.length) continue;
    const rows = await db.table(local).bulkGet(keys);
    pendingRows.set(
      remote,
      rows.filter((row): row is RemoteRow => Boolean(row)),
    );
  }
  return pendingRows;
}

function pendingRecordId(remoteTable: string, record: RemoteRow) {
  if (remoteTable === "sanitario_agenda_animais_v2") {
    return typeof record.agenda_id === "string" && typeof record.animal_id === "string"
      ? JSON.stringify([record.agenda_id, record.animal_id]) : null;
  }
  return remoteTable === "fazenda_sanidade_config" ? record.fazenda_id
    : PENDING_FACTUAL_REMOTE_TABLES.has(remoteTable) ? getFactualEventId(remoteTable, record) : record.id;
}

function protectPendingRecordRows(
  remoteTable: string,
  rows: RemoteRow[],
  pendingRecordIds: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const ids = pendingRecordIds.get(remoteTable);
  if (!ids || ids.size === 0) return { rows, skipped: false };
  const safeRows = rows.filter((row) => {
    const id = pendingRecordId(remoteTable, row);
    return typeof id !== "string" || !ids.has(id);
  });
  return { rows: safeRows, skipped: safeRows.length !== rows.length };
}

function protectPendingFactualRows(
  remoteTable: string,
  rows: RemoteRow[],
  pendingEventIds: ReadonlySet<string>,
) {
  if (
    pendingEventIds.size === 0 ||
    !PENDING_FACTUAL_REMOTE_TABLES.has(remoteTable)
  ) {
    return { rows, skipped: false };
  }
  const safeRows = rows.filter((row) => {
    const eventId = getFactualEventId(remoteTable, row);
    return typeof eventId !== "string" || !pendingEventIds.has(eventId);
  });
  return { rows: safeRows, skipped: safeRows.length !== rows.length };
}

function buildEffectiveResults(
  remoteTables: readonly string[],
  results: Record<string, unknown[]>,
  pendingEventIds: ReadonlySet<string>,
  pendingRecordIds: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const effectiveResults: Record<string, RemoteRow[]> = {};
  for (const remoteTable of remoteTables) {
    const protectedFacts = protectPendingFactualRows(
      remoteTable,
      (results[remoteTable] ?? []) as RemoteRow[],
      pendingEventIds,
    );
    effectiveResults[remoteTable] = protectPendingRecordRows(
      remoteTable,
      protectedFacts.rows,
      pendingRecordIds,
    ).rows;
  }
  return effectiveResults;
}

function normalizeCatalogAgendaRows(remote: string, rows: RemoteRow[]) {
  if (remote !== "sanitario_agenda_v2") return rows;
  return rows.map((row) => ({
    ...row,
    protocolo_id: row.catalog_protocolo_v2_id ?? row.protocolo_id,
    protocol_item_version_id:
      row.catalog_protocol_item_version_v2_id ?? row.protocol_item_version_id,
  }));
}

async function writeFarmPullStore(
  update: StoreUpdate,
  rows: RemoteRow[],
  pendingRows: RemoteRow[],
  mode: PullMode,
  fazendaId: string,
) {
  const { remote, local } = update;
  const store = db.table(local);
  if (
    mode === "replace" &&
    remote !== "eventos" &&
    remote !== "eventos_animais"
  ) {
    const pendingKeys = new Set(
      pendingRows.map((row) => JSON.stringify(getLocalPrimaryKey(local, row))),
    );
    await store
      .filter(
        (row) =>
          row.fazenda_id === fazendaId &&
          !pendingKeys.has(JSON.stringify(getLocalPrimaryKey(local, row))),
      )
      .delete();
  }
  if (rows.length > 0) {
    if (remote === "eventos_animais") await appendEventoAnimais(store, rows);
    else await store.bulkPut(normalizeCatalogAgendaRows(remote, rows));
  }
  if (pendingRows.length > 0) await store.bulkPut(pendingRows);
  console.log(
    `[pull] Synced ${rows.length} records for ${remote} -> ${local} (mode=${mode})`,
  );
}

async function validateSanitaryConflictReconciliation(
  storesToUpdate: Array<{ remote: string; local: string }>,
  results: Record<string, RemoteRow[]>,
  pendingRecordIds: ReadonlyMap<string, ReadonlySet<string>>,
  fazendaId: string,
) {
  if (!storesToUpdate.some(({ remote }) => remote === "sanitario_agenda_v2"))
    return;

  const conflicts = (await db.queue_ops.toArray()).filter(
    (op) =>
      isRejectedSanitaryRescheduleConflict(op) &&
      op.record.fazenda_id === fazendaId,
  );
  if (conflicts.length === 0) return;

  const [rejections, gestures] = await Promise.all([
    db.queue_rejections.toArray(),
    db.queue_gestures.toArray(),
  ]);
  for (const op of conflicts) {
    validateSanitaryConflictOperation(
      op,
      results,
      pendingRecordIds,
      rejections,
      gestures,
      fazendaId,
    );
  }
}

function validateSanitaryConflictOperation(
  op: Operation,
  results: Record<string, RemoteRow[]>,
  pendingRecordIds: ReadonlyMap<string, ReadonlySet<string>>,
  rejections: Awaited<ReturnType<typeof db.queue_rejections.toArray>>,
  gestures: Awaited<ReturnType<typeof db.queue_gestures.toArray>>,
  fazendaId: string,
) {
  const id = asRemoteRow(op.record.payload)?.agenda_id;
  const expected = op.record.expected_revision;
  const revisions = getSanitaryConflictRevisions(
    op,
    rejections,
    gestures,
    fazendaId,
  );
    if (
      typeof id === "string" &&
      pendingRecordIds.get("sanitario_agenda_v2")?.has(id)
    ) {
      throw new Error("SANITARIO_CONFLICT_RECONCILIATION_PENDING_OPERATION");
    }
    const hasWinner = (results.sanitario_agenda_v2 ?? []).some(
      (row) =>
        row.id === id &&
        row.fazenda_id === fazendaId &&
        typeof row.revision === "number" &&
        typeof expected === "number" &&
        row.revision > expected &&
        revisions.length > 0 &&
        row.revision >= Math.max(...revisions),
    );
    if (typeof id !== "string" || typeof expected !== "number" || !hasWinner) {
      throw new Error("SANITARIO_CONFLICT_RECONCILIATION_SNAPSHOT_UNAVAILABLE");
    }
}

function getSanitaryConflictRevisions(
  op: Operation,
  rejections: Awaited<ReturnType<typeof db.queue_rejections.toArray>>,
  gestures: Awaited<ReturnType<typeof db.queue_gestures.toArray>>,
  fazendaId: string,
) {
  const rejectionRevisions = rejections
    .filter(
      (entry) =>
        entry.client_op_id === op.client_op_id &&
        entry.client_tx_id === op.client_tx_id &&
        entry.fazenda_id === fazendaId &&
        entry.result_status === "CONFLICT",
    )
    .map((entry) => entry.current_revision);
  const auditRevisions = gestures
    .filter(
      (entry) =>
        entry.client_tx_id === op.client_tx_id &&
        entry.fazenda_id === fazendaId,
    )
    .flatMap((entry) => entry.operation_results ?? [])
    .filter(
      (result) =>
        result.op_id === op.client_op_id && result.status === "CONFLICT",
    )
    .map((result) => result.current_revision);
  return [...rejectionRevisions, ...auditRevisions].filter(
    (revision): revision is number => typeof revision === "number",
  );
}

async function filterObsoleteSanitaryAgendaRows(
  store: ReturnType<typeof db.table>,
  rows: RemoteRow[],
  cursorBlockedTables: Set<string>,
) {
  const safeRows: RemoteRow[] = [];
  for (const row of rows) {
    const existing =
      typeof row.id === "string" && typeof row.revision === "number"
        ? ((await store.get(row.id)) as RemoteRow | undefined)
        : undefined;
    if (
      typeof existing?.revision === "number" &&
      existing.revision > (row.revision as number)
    ) {
      cursorBlockedTables.add("sanitario_agenda_v2");
    } else {
      safeRows.push(row);
    }
  }
  return safeRows;
}

function prepareMergeResults(
  storesToUpdate: Array<{ remote: string; local: string }>,
  results: Record<string, RemoteRow[]>,
  pendingEventIds: ReadonlySet<string>,
  pendingRecordIds: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const effectiveResults: Record<string, RemoteRow[]> = { ...results };
  const cursorBlockedTables = new Set<string>();
  for (const { remote } of storesToUpdate) {
    const protectedResult = protectPendingFactualRows(
      remote,
      results[remote] ?? [],
      pendingEventIds,
    );
    const protectedRecords = protectPendingRecordRows(
      remote,
      protectedResult.rows,
      pendingRecordIds,
    );
    effectiveResults[remote] = protectedRecords.rows;
    if (protectedResult.skipped || protectedRecords.skipped)
      cursorBlockedTables.add(remote);
  }
  return { effectiveResults, cursorBlockedTables };
}

async function writeMergeStore(
  update: { remote: string; local: string },
  rows: RemoteRow[],
  cursorBlockedTables: Set<string>,
) {
  const store = db.table(update.local);
  if (update.remote === "sanitario_agenda_v2") {
    rows = await filterObsoleteSanitaryAgendaRows(
      store,
      rows,
      cursorBlockedTables,
    );
  }

  if (update.remote === "sanitario_produto_carencia_fontes_v2")
    await store.clear();

  if (rows.length > 0) {
    if (update.remote === "eventos_animais")
      await appendEventoAnimais(store, rows);
    else await store.bulkPut(normalizeCatalogAgendaRows(update.remote, rows));
  }

  console.log(
    `[pull] Synced ${rows.length} records for ${update.remote} -> ${update.local} (mode=merge)`,
  );
}

async function applyFarmPull(
  fazendaId: string,
  remoteTables: readonly string[],
  storesToUpdate: StoreUpdate[],
  results: Record<string, unknown[]>,
  modes: ReadonlyMap<string, PullMode>,
  reconciled = new Set<string>() as ReadonlySet<string>,
) {
  const pendingEventIds = remoteTables.some((table) =>
    PENDING_FACTUAL_REMOTE_TABLES.has(table),
  )
    ? await getPendingFactualEventIds(reconciled)
    : new Set<string>();
  const pendingRecordIds = await getPendingRecordIds(
    remoteTables,
    fazendaId,
    reconciled,
  );
  const pendingLocalRows = await getPendingLocalRows(storesToUpdate, modes);
  const effectiveResults = buildEffectiveResults(
    remoteTables,
    results,
    pendingEventIds,
    pendingRecordIds,
  );
  for (const update of storesToUpdate) {
    await writeFarmPullStore(
      update,
      effectiveResults[update.remote] ?? [],
      pendingLocalRows.get(update.remote) ?? [],
      modes.get(update.remote)!,
      fazendaId,
    );
  }
}

async function writeMergeResults(
  storesToUpdate: Array<{ remote: string; local: string }>,
  results: Record<string, RemoteRow[]>,
  cursorUpdates: CursorUpdate[],
  fazendaId: string,
) {
  const storeNames = storesToUpdate.map((s) => s.local);
  const transactionStores = hasPullCursorStore()
    ? [...storeNames, PULL_CURSOR_STORE, "queue_ops", "queue_gestures", "queue_rejections"]
    : [...storeNames, "queue_ops", "queue_gestures", "queue_rejections"];

  await db.transaction("rw", transactionStores, async () => {
    const protectsFactualRows = storesToUpdate.some(({ remote }) => PENDING_FACTUAL_REMOTE_TABLES.has(remote));
    const pendingEventIds = protectsFactualRows ? await getPendingFactualEventIds() : new Set<string>();
    const pendingRecordIds = await getPendingRecordIds(storesToUpdate.map(({ remote }) => remote), fazendaId);
    const { effectiveResults, cursorBlockedTables } = prepareMergeResults(
      storesToUpdate,
      results,
      pendingEventIds,
      pendingRecordIds,
    );
    await validateSanitaryConflictReconciliation(
      storesToUpdate,
      results,
      pendingRecordIds,
      fazendaId,
    );
    for (const { remote, local } of storesToUpdate) {
      await writeMergeStore(
        { remote, local },
        effectiveResults[remote] ?? [],
        cursorBlockedTables,
      );
    }

    for (const cursorUpdate of cursorUpdates) {
      if (cursorBlockedTables.has(cursorUpdate.remoteTable)) continue;
      await savePullCursor(cursorUpdate);
    }
  });
}

function validateTablePullMode(
  mode: PullMode,
  options: PullOptions,
  table: string,
) {
  if (mode !== "merge" && mode !== "replace")
    throw new Error("INVALID_PULL_MODE");
  if (options.observations?.[table] && mode !== "merge")
    throw new Error("PARTIAL_PULL_REPLACE_FORBIDDEN");
}

function resolvePullModes(
  remoteTables: readonly string[],
  options: PullOptions,
  mode: PullMode,
) {
  const modes = new Map<string, PullMode>();
  for (const table of remoteTables) {
    const resolved = options.tableModes?.[table] ?? mode;
    validateTablePullMode(resolved, options, table);
    modes.set(table, resolved);
  }
  if (
    Object.keys(options.tableModes ?? {}).some((table) => !modes.has(table))
  ) {
    throw new Error("UNKNOWN_PULL_TABLE_MODE");
  }
  return modes;
}

function hasRequiredAnimalIdObservation(
  requiredIds: readonly string[],
  observedIds: readonly string[],
) {
  return (
    requiredIds.length === 1 &&
    observedIds.length === 1 &&
    requiredIds[0] === observedIds[0] &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      requiredIds[0],
    )
  );
}

function validateRequiredAnimalObservation(
  modes: ReadonlyMap<string, PullMode>,
  options: PullOptions,
) {
  if (options.requiredAnimalIds) {
    const observation = options.observations?.animais;
    if (
      !modes.has("animais") ||
      !observation ||
      observation.key !== "id" ||
      !hasRequiredAnimalIdObservation(
        options.requiredAnimalIds,
        observation.ids,
      )
    ) {
      throw new Error("INVALID_REQUIRED_ANIMAL_OBSERVATION");
    }
  }
}

function validateRequiredAnimalSnapshot(
  fazenda_id: string,
  results: Record<string, unknown[]>,
  options: PullOptions,
) {
  if (options.requiredAnimalIds) {
    const rows = results.animais as RemoteRow[];
    if (
      rows.length !== 1 ||
      rows[0].id !== options.requiredAnimalIds[0] ||
      rows[0].fazenda_id !== fazenda_id ||
      !Number.isSafeInteger(rows[0].revision) ||
      (rows[0].revision as number) < 1
    ) {
      throw new Error("REQUIRED_ANIMAL_SNAPSHOT_NOT_COVERED");
    }
  }
}

type FarmPullQuery = ReturnType<ReturnType<typeof supabase.from>["select"]>;

async function fetchFarmPullRows(query: FarmPullQuery, table: string, reconciliation: boolean) {
  if (!reconciliation || !["insumo_movimentacoes", "insumo_lotes"].includes(table)) return await query;
  const rows: unknown[] = [];
  query = query.order("id");
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return { data: rows, error: null };
  }
}

export const pullDataForFarm = async (
  fazenda_id: string,
  remoteTables: readonly string[] = DEFAULT_REMOTE_TABLES,
  options: PullOptions = {},
) => {
  const mode = options.mode ?? "replace";
  const modes = resolvePullModes(remoteTables, options, mode);
  validateRequiredAnimalObservation(modes, options);
  console.log(`[pull] Starting pull for farm ${fazenda_id} (mode=${mode})`);

  // 1. Fetch all data first (fail fast)
  const results: Record<string, unknown[]> = {};

  for (const remoteTable of new Set([
    ...remoteTables,
    ...Object.keys(options.observations ?? {}),
  ])) {
    let query = supabase
      .from(remoteTable)
      .select("*")
      .eq("fazenda_id", fazenda_id); // includes tombstones via deleted_at
    const observation = options.observations?.[remoteTable];
    if (observation) query = query.in(observation.key, observation.ids);
    const { data, error } = await fetchFarmPullRows(query, remoteTable, Boolean(options.reconciliation));

    if (error) {
      console.error(`[pull] Error pulling ${remoteTable}:`, error);
      throw error; // Abort immediately on critical failure
    }

    results[remoteTable] = data ?? [];
  }

  validateRequiredAnimalSnapshot(fazenda_id, results, options);

  // 2. Determine valid local stores involved
  // We filter out invalid stores to prevent transaction failure, but log warning
  const validTableNames = new Set(db.tables.map((t) => t.name));
  if (
    options.requiredAnimalIds &&
    remoteTables.some((table) => !validTableNames.has(getLocalStoreName(table)))
  ) {
    throw new Error("REQUIRED_PULL_STORE_MISSING");
  }
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
  const transactionStores = [
    ...new Set([
      ...storeNames,
      "queue_ops",
      "queue_gestures",
      ...(options.reconciliation?.stores ?? []),
    ]),
  ];

  // 3. Write in a single transaction
  await db.transaction("rw", transactionStores, async () => {
    const reconciled =
      (await options.reconciliation?.select(results)) ?? new Set<string>();
    await applyFarmPull(
      fazenda_id,
      remoteTables,
      storesToUpdate,
      results,
      modes,
      reconciled,
    );
    await options.reconciliation?.complete(reconciled);
  });
};

export const pullSanitarioProductClassV2Catalog = async (
  fazenda_id: string,
) => {
  console.log(
    `[pull] Starting sanitario ProductClass v2 catalog pull for farm ${fazenda_id}`,
  );

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES) {
    const localStore = getLocalStoreName(remoteTable);
    const globalCursorKey = buildPullCursorKey(remoteTable, "global", null);
    const tenantCursorKey = buildPullCursorKey(
      remoteTable,
      "tenant",
      fazenda_id,
    );

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
      console.error(
        `[pull] Error pulling global ${remoteTable}:`,
        globalResult.error,
      );
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
      console.error(
        `[pull] Error pulling tenant ${remoteTable}:`,
        tenantResult.error,
      );
      throw tenantResult.error;
    }

    const globalRows = (globalResult.data ?? []) as RemoteRow[];
    const tenantRows = (tenantResult.data ?? []) as RemoteRow[];
    results[remoteTable] = [...globalRows, ...tenantRows];
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
  const storesToUpdate = SANITARIO_PRODUCT_CLASS_V2_REMOTE_TABLES.map((rt) => ({
    remote: rt,
    local: getLocalStoreName(rt),
  })).filter(({ remote, local }) => {
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

export const pullSanitarioTechnicalCatalogV2 = async (fazenda_id: string) => {
  console.log(
    `[pull] Starting sanitario technical catalog v2 pull for farm ${fazenda_id}`,
  );

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES) {
    const localStore = getLocalStoreName(remoteTable);
    if (remoteTable === "sanitario_produto_carencia_fontes_v2") {
      const rows: RemoteRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from(remoteTable)
          .select("*")
          .order("withdrawal_rule_id")
          .order("source_id")
          .order("field_key")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      results[remoteTable] = rows;
      continue;
    }
    if (remoteTable === "sanitario_fontes_tecnicas_v2") {
      const globalCursorKey = buildPullCursorKey(remoteTable, "global", null);
      const farmCursorKey = buildPullCursorKey(
        remoteTable,
        "fazenda",
        fazenda_id,
      );
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
        console.error(
          `[pull] Error pulling global ${remoteTable}:`,
          globalResult.error,
        );
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
        console.error(
          `[pull] Error pulling farm-scoped ${remoteTable}:`,
          farmResult.error,
        );
        throw farmResult.error;
      }

      const globalRows = (globalResult.data ?? []) as RemoteRow[];
      const farmRows = (farmResult.data ?? []) as RemoteRow[];
      results[remoteTable] = [...globalRows, ...farmRows];
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
  const storesToUpdate = SANITARIO_TECHNICAL_CATALOG_V2_REMOTE_TABLES.map(
    (rt) => ({ remote: rt, local: getLocalStoreName(rt) }),
  ).filter(({ remote, local }) => {
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

export interface SanitarioProtocolCatalogPullResultV2 {
  protocolsFullFetch: boolean;
  remoteEmpty: boolean;
}

function hasGlobalProtocolCatalogRows(rows: RemoteRow[]) {
  return rows.some(
    (row) => row.scope === "global" && row.fazenda_id === null && row.deleted_at == null,
  );
}

function hasProtocolCatalogItems(rows: RemoteRow[], protocolIds: string[]) {
  return rows.some(
    (row) => row.deleted_at == null && protocolIds.includes(String(row.protocol_id)),
  );
}

function buildProtocolCatalogPullResult(
  protocolsFullFetch: boolean,
  protocolRows: RemoteRow[],
  storeCount: number,
): SanitarioProtocolCatalogPullResultV2 {
  return {
    protocolsFullFetch,
    remoteEmpty: storeCount === SANITARIO_PROTOCOL_CATALOG_V2_REMOTE_TABLES.length &&
      protocolsFullFetch && !protocolRows.some((row) => row.deleted_at == null),
  };
}

let protocolCatalogPullV2: Promise<SanitarioProtocolCatalogPullResultV2> | null =
  null;

// Only this global catalog shares in-flight requests. Other sync flows are unchanged.
export const pullSanitarioProtocolCatalogV2 = () => {
  if (!protocolCatalogPullV2) {
    protocolCatalogPullV2 = pullSanitarioProtocolCatalogSnapshotV2().finally(
      () => {
        protocolCatalogPullV2 = null;
      },
    );
  }
  return protocolCatalogPullV2;
};

async function pullSanitarioProtocolCatalogSnapshotV2(): Promise<SanitarioProtocolCatalogPullResultV2> {
  console.log("[pull] Starting sanitario protocol catalog v2 pull");

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  const protocolsTable = "sanitario_protocolos_v2";
  const protocolLocalStore = getLocalStoreName(protocolsTable);
  const protocolCursorKey = buildPullCursorKey(
    protocolsTable,
    "global",
    null,
  );
  const cachedProtocols = (await db
    .table(protocolLocalStore)
    .toArray()) as RemoteRow[];
  const protocolCursor = await getPullCursor(protocolCursorKey);
  // A cursor without its cache cannot bootstrap a catalog from incremental deltas.
  const protocolsFullFetch = shouldFetchFullProtocolCatalog(protocolCursor, cachedProtocols);
  const protocolQueryBase = supabase
    .from(protocolsTable)
    .select("*")
    .eq("scope", "global")
    .is("fazenda_id", null);
  const protocolQuery = protocolsFullFetch
    ? protocolQueryBase
    : await applyUpdatedAtCursor(protocolQueryBase, protocolCursorKey);
  const protocolResult = await protocolQuery;

  if (protocolResult.error) {
    console.error(
      `[pull] Error pulling ${protocolsTable}:`,
      protocolResult.error,
    );
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
  const itemRows = await pullProtocolCatalogItemsV2(protocolIds, protocolsFullFetch, itemsTable);

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
  const cachedGroups = (await db
    .table(groupLocalStore)
    .toArray()) as RemoteRow[];
  const groupsFullFetch = !hasGlobalProtocolCatalogRows(cachedGroups);
  const groupQueryBase = supabase
    .from(groupsTable)
    .select("*")
    .eq("scope", "global")
    .is("fazenda_id", null);
  const groupQuery = groupsFullFetch
    ? groupQueryBase
    : await applyUpdatedAtCursor(groupQueryBase, groupCursorKey);
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
  const storesToUpdate = SANITARIO_PROTOCOL_CATALOG_V2_REMOTE_TABLES.map(
    (rt) => ({ remote: rt, local: getLocalStoreName(rt) }),
  ).filter(({ remote, local }) => {
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
    return { protocolsFullFetch: false, remoteEmpty: false };
  }

  await writeMergeResults(storesToUpdate, results, cursorUpdates);
  return buildProtocolCatalogPullResult(protocolsFullFetch, protocolRows, storesToUpdate.length);
}

async function readPullRows<T extends { data: unknown[] | null; error: unknown | null }>(
  query: PromiseLike<T>,
  label: string,
): Promise<RemoteRow[]> {
  const { data, error } = await query;
  if (error) {
    console.error(`[pull] Error pulling ${label}:`, error);
    throw error;
  }
  return (data ?? []) as RemoteRow[];
}

export const pullSanitarioAgendaV2 = async (fazenda_id: string) => {
  console.log(
    `[pull] Starting sanitario agenda v2 pull for farm ${fazenda_id}`,
  );

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of SANITARIO_AGENDA_V2_REMOTE_TABLES) {
    const localStore = getLocalStoreName(remoteTable);
    const cursorKey = buildPullCursorKey(remoteTable, "fazenda", fazenda_id);
    const query = await applyUpdatedAtCursor(
      supabase.from(remoteTable).select("*").eq("fazenda_id", fazenda_id),
      cursorKey,
    );
    const rows = await readPullRows(query, `agenda v2 ${remoteTable}`);
    results[remoteTable] = remoteTable === "sanitario_agenda_v2"
      ? mergeConflictedSanitaryAgendas(rows, await fetchConflictedSanitaryAgendas(fazenda_id))
      : rows;
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
  const storesToUpdate = SANITARIO_AGENDA_V2_REMOTE_TABLES.map((rt) => ({
    remote: rt,
    local: getLocalStoreName(rt),
  })).filter(({ remote, local }) => {
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

  await writeMergeResults(storesToUpdate, results, cursorUpdates, fazenda_id);
};

export const pullSanitarioV2CutoverState = async (fazendaId: string) => {
  const orderedTables = [
    "fazenda_sanidade_config",
    "sanitario_agenda_v2",
    "sanitario_agenda_animais_v2",
    "eventos",
    "eventos_sanitario",
    "eventos_animais",
    "insumo_movimentacoes",
    "insumo_lotes",
    "sanitario_agenda_closures_v2",
  "sanitario_participacoes",
  "sanitario_participacao_operacoes",
  "sanitario_agenda_resultados",
  "sanitario_continuidade_solicitacoes",
  ] as const;

  const results: Record<string, RemoteRow[]> = {};
  const cursorUpdates: CursorUpdate[] = [];

  for (const remoteTable of orderedTables) {
    const localStore = getLocalStoreName(remoteTable);
    const cursorKey = buildPullCursorKey(remoteTable, "fazenda", fazendaId);
    const baseQuery = supabase
      .from(remoteTable)
      .select("*")
      .eq("fazenda_id", fazendaId);
    const query =
      remoteTable === "eventos_animais"
        ? baseQuery
        : await applyUpdatedAtCursor(baseQuery, cursorKey);
    const rows = await readPullRows(query, `sanitario v2 ${remoteTable}`);
    results[remoteTable] = remoteTable === "sanitario_agenda_v2"
      ? mergeConflictedSanitaryAgendas(rows, await fetchConflictedSanitaryAgendas(fazendaId))
      : rows;
    if (remoteTable !== "eventos_animais") {
      cursorUpdates.push({
        key: cursorKey,
        remoteTable,
        localStore,
        scope: "fazenda",
        fazendaId,
        rows,
      });
    }
  }

  await writeMergeResults(
    orderedTables.map((remote) => ({
      remote,
      local: getLocalStoreName(remote),
    })),
    results,
    cursorUpdates,
    fazendaId,
  );

  return recomputeSanitaryComplianceAfterPullV2({ fazendaId });
};

export const pullInitialData = async (fazenda_id: string) => {
  await pullDataForFarm(fazenda_id, DEFAULT_REMOTE_TABLES, { mode: "replace" });
  await pullSanitarioProductClassV2Catalog(fazenda_id);
  await pullSanitarioTechnicalCatalogV2(fazenda_id);
  await pullSanitarioProtocolCatalogV2();
  await pullSanitarioV2CutoverState(fazenda_id);
};

async function pullProtocolCatalogItemsV2(protocolIds: string[], protocolsFullFetch: boolean, itemsTable: string): Promise<RemoteRow[]> {
  if (protocolIds.length === 0) return [];
  const itemLocalStore = getLocalStoreName(itemsTable);
  const itemCursorKey = buildPullCursorKey(itemsTable, "global", null);
  const itemQueryBase = supabase.from(itemsTable).select("*");
  const itemQueryWithProtocols = (
    itemQueryBase as typeof itemQueryBase & {
      in: (column: string, values: string[]) => typeof itemQueryBase;
    }
  ).in("protocol_id", protocolIds);
  const cachedItems = (await db
    .table(itemLocalStore)
    .toArray()) as RemoteRow[];
  const itemsFullFetch =
    protocolsFullFetch ||
    !hasProtocolCatalogItems(cachedItems, protocolIds);
  const itemQuery = itemsFullFetch
    ? itemQueryWithProtocols
    : await applyUpdatedAtCursor(itemQueryWithProtocols, itemCursorKey);
  const itemResult = await itemQuery;

  if (itemResult.error) {
    console.error(`[pull] Error pulling ${itemsTable}:`, itemResult.error);
    throw itemResult.error;
  }

  return (itemResult.data ?? []) as RemoteRow[];
}

function shouldFetchFullProtocolCatalog(cursor: PullCursor | null, cachedProtocols: RemoteRow[]) {
  return !cursor?.last_updated_at || !hasGlobalProtocolCatalogRows(cachedProtocols);
}
