import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import { db } from "@/lib/offline/db";
import type { PullCursor, ReproTipoEnum } from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import {
  rebuildReproductiveProjection,
  type ReproductiveProjectionEvent,
} from "@/lib/reproduction/status";

type RemoteRow = Record<string, unknown>;

const SUPPORTED_TYPES = [
  "cobertura",
  "IA",
  "diagnostico",
  "parto",
  "aborto",
] as const;
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
const CALF_FACT_FIELDS = [
  "id",
  "fazenda_id",
  "identificacao",
  "sexo",
  "status",
  "lote_id",
  "data_nascimento",
  "data_entrada",
  "data_saida",
  "pai_id",
  "mae_id",
  "nome",
  "rfid",
  "especie",
  "origem",
  "raca",
  "papel_macho",
  "habilitado_monta",
  "observacoes",
  "payload",
  "client_id",
  "client_op_id",
  "client_tx_id",
  "client_recorded_at",
] as const;
const AGENDA_FACT_FIELDS = [
  "id",
  "fazenda_id",
  "dominio",
  "tipo",
  "status",
  "data_prevista",
  "animal_id",
  "lote_id",
  "dedup_key",
  "source_kind",
  "source_ref",
  "source_evento_id",
  "source_tx_id",
  "source_client_op_id",
  "protocol_item_version_id",
  "interval_days_applied",
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

async function getPendingReproductionIds(ignoreClientTxId?: string) {
  const operations = await db.queue_ops.toArray();
  const eventIds = new Set<string>();
  const animalIds = new Set<string>();
  const agendaIds = new Set<string>();
  for (const operation of operations) {
    if (operation.client_tx_id === ignoreClientTxId) continue;
    if (operation.table === "eventos" && operation.record?.dominio === "reproducao") {
      if (typeof operation.record.id === "string") {
        eventIds.add(operation.record.id);
      }
    }
    if (operation.table === "eventos_reproducao") {
      if (typeof operation.record?.evento_id === "string") {
        eventIds.add(operation.record.evento_id);
      }
    }
    if (operation.table === "animais" && typeof operation.record?.id === "string") {
      animalIds.add(operation.record.id);
    }
    if (operation.table === "agenda_itens" && typeof operation.record?.id === "string") {
      agendaIds.add(operation.record.id);
    }
  }
  return { eventIds, animalIds, agendaIds };
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
    if (
      detail.tipo !== "diagnostico" &&
      detail.tipo !== "parto" &&
      detail.tipo !== "aborto"
    ) continue;
    const episodeId = readEpisodeId(detail);
    if (!episodeId && detail.tipo !== "diagnostico") continue;
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
  const correctionChildren = new Map<string, string[]>();
  for (const event of events) {
    if (typeof event.corrige_evento_id !== "string") continue;
    const corrected = eventsById.get(event.corrige_evento_id);
    const correctionDetail = detailsById.get(String(event.id));
    const correctedDetail = detailsById.get(event.corrige_evento_id);
    const eventPayload = isRecord(event.payload) ? event.payload : {};
    const correction = isRecord(eventPayload.reproduction_correction)
      ? eventPayload.reproduction_correction
      : null;
    if (
      !corrected ||
      !correctionDetail ||
      !correctedDetail ||
      corrected.fazenda_id !== event.fazenda_id ||
      corrected.animal_id !== event.animal_id ||
      correctedDetail.tipo !== correctionDetail.tipo ||
      !correction ||
      correction.nature !== "correction" ||
      correction.corrected_event_id !== event.corrige_evento_id
    ) {
      throw new Error("REPRO_PULL_CORRECTION_CONTRACT_INVALID");
    }
    const children = correctionChildren.get(event.corrige_evento_id) ?? [];
    children.push(String(event.id));
    correctionChildren.set(event.corrige_evento_id, children);
  }
  if ([...correctionChildren.values()].some((children) => children.length > 1)) {
    throw new Error("REPRO_PULL_CORRECTION_BRANCH_CONFLICT");
  }
}

async function assertNoDivergentLocalFact(
  events: RemoteRow[],
  details: RemoteRow[],
  calves: RemoteRow[],
  agendas: RemoteRow[],
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
  for (const calf of calves) {
    const existing = await db.state_animais.get(String(calf.id));
    if (
      existing &&
      !sameFact(existing as unknown as RemoteRow, calf, CALF_FACT_FIELDS)
    ) {
      throw new Error("REPRO_PULL_CALF_CONFLICT");
    }
  }
  for (const agenda of agendas) {
    const existing = await db.state_agenda_itens.get(String(agenda.id));
    if (
      existing &&
      !sameFact(existing as unknown as RemoteRow, agenda, AGENDA_FACT_FIELDS)
    ) {
      throw new Error("REPRO_PULL_AGENDA_CONFLICT");
    }
  }
}

async function rebuildReproductionCaches(animalIds: Set<string>) {
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
    const cacheableIncompleteHistory =
      projection.inconsistency === "PARTO_WITHOUT_EPISODE" ||
      projection.inconsistency === "ABORTO_WITHOUT_EPISODE";
    if (projection.inconsistency && !cacheableIncompleteHistory) continue;
    const animal = await db.state_animais.get(animalId);
    if (!animal || animal.deleted_at) continue;
    const patch = projection.status === "PRENHA"
      ? {
        prenhez_confirmada: true,
        data_prevista_parto: projection.dpp,
      }
      : projection.status === "SERVIDA"
      ? {
        prenhez_confirmada: null,
        data_prevista_parto: null,
      }
      : projection.status === "PARIDA_PUERPERIO" ||
          projection.status === "PARIDA_ABERTA"
      ? {
        prenhez_confirmada: false,
        data_prevista_parto: null,
        data_ultimo_parto: projection.lastBirthDate,
        em_lactacao: true,
        secagem_realizada: false,
        puberdade_confirmada: true,
      }
      : {
        prenhez_confirmada: false,
        data_prevista_parto: null,
      };
    await db.state_animais.update(animalId, {
      payload: buildAnimalTaxonomyFactsPayload(
        animal.payload,
        patch,
        "reproduction_event",
      ),
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

  const changedEventIds = changedDetails.map((detail) =>
    String(detail.evento_id)
  );
  const { data: changedEventData, error: changedEventError } = await supabase
    .from("eventos")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .eq("dominio", "reproducao")
    .in("id", changedEventIds);
  if (changedEventError) throw changedEventError;
  const affectedAnimalIds = new Set(
    ((changedEventData ?? []) as RemoteRow[])
      .map((event) => event.animal_id)
      .filter((animalId): animalId is string => typeof animalId === "string"),
  );
  if (affectedAnimalIds.size === 0) {
    throw new Error("REPRO_PULL_FACT_CONTRACT_INVALID");
  }
  const { data: eventData, error: eventError } = await supabase
    .from("eventos")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .eq("dominio", "reproducao")
    .in("animal_id", Array.from(affectedAnimalIds));
  if (eventError) throw eventError;
  const events = (eventData ?? []) as RemoteRow[];
  const eventIds = events.map((event) => String(event.id));
  const { data: detailData, error: allDetailsError } = await supabase
    .from("eventos_reproducao")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .in("evento_id", eventIds)
    .in("tipo", [...SUPPORTED_TYPES]);
  if (allDetailsError) throw allDetailsError;
  const details = (detailData ?? []) as RemoteRow[];
  assertRemoteBatch(fazendaId, events, details);

  const partoEventIds = new Set(
    details
      .filter((detail) => detail.tipo === "parto")
      .map((detail) => String(detail.evento_id)),
  );
  let calves: RemoteRow[] = [];
  if (affectedAnimalIds.size > 0 && partoEventIds.size > 0) {
    const { data, error } = await supabase
      .from("animais")
      .select("*")
      .eq("fazenda_id", fazendaId)
      .in("mae_id", Array.from(affectedAnimalIds));
    if (error) throw error;
    calves = ((data ?? []) as RemoteRow[]).filter((calf) => {
      const payload = isRecord(calf.payload) ? calf.payload : {};
      return payload.generated_from === "evento_parto" &&
        partoEventIds.has(String(payload.birth_event_id));
    });
  }
  let agendas: RemoteRow[] = [];
  if (partoEventIds.size > 0) {
    const { data, error } = await supabase
      .from("agenda_itens")
      .select("*")
      .eq("fazenda_id", fazendaId)
      .in("source_evento_id", Array.from(partoEventIds));
    if (error) throw error;
    agendas = (data ?? []) as RemoteRow[];
  }

  const pendingIds = await getPendingReproductionIds(
    options.ignorePendingClientTxId,
  );
  const safeDetails = details.filter((detail) =>
    !pendingIds.eventIds.has(String(detail.evento_id))
  );
  const protectedRows = safeDetails.length !== details.length ||
    calves.some((calf) => pendingIds.animalIds.has(String(calf.id))) ||
    agendas.some((agenda) => pendingIds.agendaIds.has(String(agenda.id)));
  const safeIds = new Set(safeDetails.map((detail) => String(detail.evento_id)));
  const safeEvents = events.filter((event) =>
    safeIds.has(String(event.id)) &&
    !pendingIds.eventIds.has(String(event.id))
  );
  const safeCalves = calves.filter((calf) =>
    !pendingIds.animalIds.has(String(calf.id))
  );
  const safeAgendas = agendas.filter((agenda) =>
    !pendingIds.agendaIds.has(String(agenda.id))
  );
  await assertNoDivergentLocalFact(
    safeEvents,
    safeDetails,
    safeCalves,
    safeAgendas,
  );

  const safeProjectionAnimalIds = new Set(
    safeEvents
      .map((event) => event.animal_id)
      .filter((animalId): animalId is string => typeof animalId === "string"),
  );
  const transactionStores = [
    db.event_eventos,
    db.event_eventos_reproducao,
    db.state_animais,
    db.state_agenda_itens,
    db.sync_pull_cursors,
  ];
  await db.transaction("rw", transactionStores, async () => {
    if (safeEvents.length > 0) await db.event_eventos.bulkPut(safeEvents);
    if (safeDetails.length > 0) {
      await db.event_eventos_reproducao.bulkPut(safeDetails);
    }
    if (safeCalves.length > 0) await db.state_animais.bulkPut(safeCalves);
    if (safeAgendas.length > 0) {
      await db.state_agenda_itens.bulkPut(safeAgendas);
    }
    await rebuildReproductionCaches(safeProjectionAnimalIds);
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
    pulled: safeDetails.length + safeCalves.length + safeAgendas.length,
    projections: Array.from(safeProjectionAnimalIds),
  };
}

export const REPRODUCTION_DIAGNOSIS_SUPPORTED_TYPES: readonly ReproTipoEnum[] =
  SUPPORTED_TYPES;
