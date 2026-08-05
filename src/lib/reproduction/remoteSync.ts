import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import { db } from "@/lib/offline/db";
import type { PullCursor, ReproTipoEnum } from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import {
  rebuildReproductiveProjection,
  type ReproductiveProjectionEvent,
} from "@/lib/reproduction/status";

type RemoteRow = Record<string, unknown>;

const SUPPORTED_TYPES = ["cobertura", "IA", "diagnostico"] as const;
const CURSOR_KEY_PREFIX = "reproduction_diagnosis";
const EVENT_FACT_FIELDS = [
  "id",
  "fazenda_id",
  "dominio",
  "occurred_at",
  "animal_id",
  "lote_id",
  "source_task_id",
  "corrige_evento_id",
  "observacoes",
  "payload",
  "client_id",
  "client_op_id",
  "client_tx_id",
  "client_recorded_at",
] as const;
const DETAIL_FACT_FIELDS = [
  "evento_id",
  "fazenda_id",
  "tipo",
  "macho_id",
  "payload",
  "client_id",
  "client_op_id",
  "client_tx_id",
  "client_recorded_at",
] as const;

function isRecord(value: unknown): value is RemoteRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value ?? null;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

function sameFact(
  left: RemoteRow,
  right: RemoteRow,
  fields: readonly string[],
) {
  const select = (row: RemoteRow) => Object.fromEntries(
    fields.map((field) => [field, row[field] ?? null]),
  );
  return JSON.stringify(canonicalize(select(left))) ===
    JSON.stringify(canonicalize(select(right)));
}

function getCursorKey(fazendaId: string) {
  return `${CURSOR_KEY_PREFIX}:eventos_reproducao:fazenda:${fazendaId}`;
}

async function getPendingReproductionEventIds(ignoreClientTxId?: string) {
  const operations = await db.queue_ops.toArray();
  return new Set(operations.flatMap((operation) => {
    if (operation.client_tx_id === ignoreClientTxId) return [];
    if (operation.table === "eventos" && operation.record?.dominio === "reproducao") {
      return typeof operation.record.id === "string" ? [operation.record.id] : [];
    }
    if (operation.table === "eventos_reproducao") {
      return typeof operation.record?.evento_id === "string"
        ? [operation.record.evento_id]
        : [];
    }
    return [];
  }));
}

function readEpisodeId(detail: RemoteRow) {
  const payload = isRecord(detail.payload) ? detail.payload : {};
  return typeof payload.episode_evento_id === "string"
    ? payload.episode_evento_id
    : null;
}

function assertRemoteBatch(
  fazendaId: string,
  events: RemoteRow[],
  details: RemoteRow[],
) {
  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const detailsById = new Map(
    details.map((detail) => [String(detail.evento_id), detail]),
  );
  for (const detail of details) {
    const event = eventsById.get(String(detail.evento_id));
    if (
      detail.fazenda_id !== fazendaId ||
      !SUPPORTED_TYPES.includes(detail.tipo as (typeof SUPPORTED_TYPES)[number]) ||
      detail.deleted_at != null ||
      !event ||
      event.fazenda_id !== fazendaId ||
      event.dominio !== "reproducao" ||
      event.deleted_at != null
    ) {
      throw new Error("REPRO_PULL_FACT_CONTRACT_INVALID");
    }
    if (detail.tipo !== "diagnostico") continue;
    const episodeId = readEpisodeId(detail);
    const episode = episodeId ? eventsById.get(episodeId) : null;
    const episodeDetail = episodeId ? detailsById.get(episodeId) : null;
    if (
      !episodeId ||
      !episode ||
      !episodeDetail ||
      episode.fazenda_id !== fazendaId ||
      episode.animal_id !== event.animal_id ||
      (episodeDetail.tipo !== "cobertura" && episodeDetail.tipo !== "IA") ||
      String(episode.occurred_at) > String(event.occurred_at)
    ) {
      throw new Error("REPRO_PULL_EPISODE_CONTRACT_INVALID");
    }
  }
}

async function assertNoDivergentLocalFact(
  events: RemoteRow[],
  details: RemoteRow[],
) {
  for (const event of events) {
    const existing = await db.event_eventos.get(String(event.id));
    if (existing && !sameFact(existing as unknown as RemoteRow, event, EVENT_FACT_FIELDS)) {
      throw new Error("REPRO_PULL_EVENT_CONFLICT");
    }
  }
  for (const detail of details) {
    const existing = await db.event_eventos_reproducao.get(String(detail.evento_id));
    if (
      existing &&
      !sameFact(existing as unknown as RemoteRow, detail, DETAIL_FACT_FIELDS)
    ) {
      throw new Error("REPRO_PULL_DETAIL_CONFLICT");
    }
  }
}

async function rebuildDiagnosisCaches(animalIds: Set<string>) {
  for (const animalId of animalIds) {
    const events = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .toArray();
    const details = await db.event_eventos_reproducao.bulkGet(
      events.map((event) => event.id),
    );
    const history: ReproductiveProjectionEvent[] = events.map((event, index) => ({
      ...event,
      details: details[index],
    }));
    const projection = rebuildReproductiveProjection(history);
    if (
      projection.inconsistency ||
      projection.definingEventType !== "diagnostico" ||
      (projection.status !== "PRENHA" && projection.status !== "VAZIA")
    ) continue;
    const animal = await db.state_animais.get(animalId);
    if (!animal || animal.deleted_at) continue;
    await db.state_animais.update(animalId, {
      payload: buildAnimalTaxonomyFactsPayload(animal.payload, {
        prenhez_confirmada: projection.status === "PRENHA",
        data_prevista_parto: projection.status === "PRENHA" ? projection.dpp : null,
      }, "reproduction_event"),
    });
  }
}

export async function pullReproductionDiagnosisState(
  fazendaId: string,
  options: { ignorePendingClientTxId?: string } = {},
) {
  const cursorKey = getCursorKey(fazendaId);
  const cursor = await db.sync_pull_cursors.get(cursorKey);
  let detailQuery = supabase
    .from("eventos_reproducao")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .in("tipo", [...SUPPORTED_TYPES]);
  if (cursor?.last_updated_at) {
    detailQuery = detailQuery.gte("updated_at", cursor.last_updated_at);
  }
  const { data: changedData, error: detailError } = await detailQuery;
  if (detailError) throw detailError;
  const changedDetails = (changedData ?? []) as RemoteRow[];
  if (changedDetails.length === 0) return { pulled: 0, projections: [] };

  const episodeIds = changedDetails.flatMap((detail) => {
    const id = readEpisodeId(detail);
    return id ? [id] : [];
  });
  let details = changedDetails;
  if (episodeIds.length > 0) {
    const { data, error } = await supabase
      .from("eventos_reproducao")
      .select("*")
      .eq("fazenda_id", fazendaId)
      .in("evento_id", episodeIds);
    if (error) throw error;
    details = Array.from(new Map(
      [...changedDetails, ...((data ?? []) as RemoteRow[])].map((row) => [
        String(row.evento_id),
        row,
      ]),
    ).values());
  }

  const eventIds = details.map((detail) => String(detail.evento_id));
  const { data: eventData, error: eventError } = await supabase
    .from("eventos")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .eq("dominio", "reproducao")
    .in("id", eventIds);
  if (eventError) throw eventError;
  const fetchedEvents = (eventData ?? []) as RemoteRow[];
  const fetchedEventsById = new Map(
    fetchedEvents.map((event) => [String(event.id), event]),
  );
  const detailsInScope = details.filter((detail) =>
    fetchedEventsById.get(String(detail.evento_id))?.corrige_evento_id == null
  );
  const inScopeIds = new Set(
    detailsInScope.map((detail) => String(detail.evento_id)),
  );
  const events = fetchedEvents.filter((event) => inScopeIds.has(String(event.id)));
  assertRemoteBatch(fazendaId, events, detailsInScope);

  const pendingIds = await getPendingReproductionEventIds(
    options.ignorePendingClientTxId,
  );
  const safeDetails = detailsInScope.filter((detail) =>
    !pendingIds.has(String(detail.evento_id))
  );
  const protectedRows = safeDetails.length !== detailsInScope.length;
  const safeIds = new Set(safeDetails.map((detail) => String(detail.evento_id)));
  const safeEvents = events.filter((event) => safeIds.has(String(event.id)));
  await assertNoDivergentLocalFact(safeEvents, safeDetails);

  const diagnosisAnimalIds = new Set(
    safeDetails
      .filter((detail) => detail.tipo === "diagnostico")
      .map((detail) => safeEvents.find((event) => event.id === detail.evento_id)?.animal_id)
      .filter((animalId): animalId is string => typeof animalId === "string"),
  );
  const transactionStores = [
    db.event_eventos,
    db.event_eventos_reproducao,
    db.state_animais,
    db.sync_pull_cursors,
  ];
  await db.transaction("rw", transactionStores, async () => {
    if (safeEvents.length > 0) await db.event_eventos.bulkPut(safeEvents);
    if (safeDetails.length > 0) {
      await db.event_eventos_reproducao.bulkPut(safeDetails);
    }
    await rebuildDiagnosisCaches(diagnosisAnimalIds);
    if (!protectedRows) {
      const latest = [...changedDetails].sort((left, right) =>
        String(left.updated_at).localeCompare(String(right.updated_at)) ||
        String(left.evento_id).localeCompare(String(right.evento_id))
      ).at(-1);
      if (latest && typeof latest.updated_at === "string") {
        const nextCursor: PullCursor = {
          key: cursorKey,
          remote_table: "eventos_reproducao",
          local_store: "event_eventos_reproducao",
          scope: "fazenda",
          fazenda_id: fazendaId,
          last_updated_at: latest.updated_at,
          last_id: String(latest.evento_id),
          updated_at: new Date().toISOString(),
        };
        await db.sync_pull_cursors.put(nextCursor);
      }
    }
  });

  return {
    pulled: safeDetails.length,
    projections: Array.from(diagnosisAnimalIds),
  };
}

export const REPRODUCTION_DIAGNOSIS_SUPPORTED_TYPES: readonly ReproTipoEnum[] =
  SUPPORTED_TYPES;
