import { isRecord, type Operation } from "./rules.ts";

type ProcessedResult = {
  op_id: string;
  status: string;
};

type RemoteLookup = {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
};

const SYNCED_REPRODUCTION_TYPES = new Set([
  "diagnostico",
  "parto",
  "aborto",
]);

export type ReproductionDiagnosisDependency =
  | { status: "READY"; event: Record<string, unknown> }
  | {
      status: "BLOCKED_DEPENDENCY";
      reason_code: "REPRODUCTION_EVENT_NOT_APPLIED";
      reason_message: string;
    }
  | {
      status: "RETRYABLE";
      reason_code: "REPRODUCTION_EVENT_LOOKUP_FAILED";
      reason_message: string;
    };

const EVENT_FIELDS = [
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

const DETAIL_FIELDS = [
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

const CALF_FIELDS = [
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

const AGENDA_FIELDS = [
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

const TEMPORAL_FINGERPRINT_FIELDS = new Set([
  "occurred_at",
  "client_recorded_at",
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value ?? null;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

function fingerprint(
  record: Record<string, unknown>,
  fields: readonly string[],
) {
  return JSON.stringify(canonicalize(Object.fromEntries(
    fields.map((field) => {
      const value = record[field] ?? null;
      if (TEMPORAL_FINGERPRINT_FIELDS.has(field) && typeof value === "string") {
        const timestamp = Date.parse(value);
        return [field, Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString()];
      }
      return [field, value];
    }),
  )));
}

export function isDiagnosisDetailOperation(op: Operation) {
  return op.table === "eventos_reproducao" &&
    op.action === "INSERT" &&
    op.record?.tipo === "diagnostico";
}

export function isSyncedReproductionDetailOperation(op: Operation) {
  return op.table === "eventos_reproducao" &&
    op.action === "INSERT" &&
    SYNCED_REPRODUCTION_TYPES.has(String(op.record?.tipo));
}

export function findSyncedReproductionDetailForEvent(
  eventId: string,
  operations: Operation[],
) {
  return operations.find((candidate) =>
    isSyncedReproductionDetailOperation(candidate) &&
    candidate.record?.evento_id === eventId
  ) ?? null;
}

export function readBirthEventId(record: Record<string, unknown>) {
  const payload = isRecord(record.payload) ? record.payload : {};
  return typeof payload.birth_event_id === "string"
    ? payload.birth_event_id
    : null;
}

export function isBirthCalfOperation(op: Operation) {
  const payload = isRecord(op.record?.payload) ? op.record.payload : {};
  return op.table === "animais" &&
    op.action === "INSERT" &&
    payload.generated_from === "evento_parto" &&
    typeof payload.birth_event_id === "string";
}

export function readAgendaBirthEventId(record: Record<string, unknown>) {
  if (typeof record.source_evento_id === "string") {
    return record.source_evento_id;
  }
  const sourceRef = isRecord(record.source_ref) ? record.source_ref : {};
  if (typeof sourceRef.birth_event_id === "string") {
    return sourceRef.birth_event_id;
  }
  return readBirthEventId(record);
}

export function isBirthAgendaOperation(op: Operation) {
  return op.table === "agenda_itens" &&
    op.action === "INSERT" &&
    typeof readAgendaBirthEventId(op.record) === "string";
}

export function isAppliedResult(
  processedResults: ProcessedResult[],
  clientOpId: string,
) {
  const status = processedResults.find((entry) => entry.op_id === clientOpId)
    ?.status;
  return status === "APPLIED" || status === "APPLIED_ALTERED";
}

export function findDiagnosisDetailForEvent(
  eventId: string,
  operations: Operation[],
) {
  return operations.find((candidate) =>
    isDiagnosisDetailOperation(candidate) &&
    candidate.record?.evento_id === eventId
  ) ?? null;
}

export function sameReproductionDiagnosisRecord(
  table: "eventos" | "eventos_reproducao" | "animais" | "agenda_itens",
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  const fields = table === "eventos"
    ? EVENT_FIELDS
    : table === "eventos_reproducao"
    ? DETAIL_FIELDS
    : table === "animais"
    ? CALF_FIELDS
    : AGENDA_FIELDS;
  return fingerprint(existing, fields) === fingerprint(incoming, fields);
}

export function validateReproductionCorrection(input: {
  event: Record<string, unknown>;
  detail: Record<string, unknown>;
  correctedEvent: Record<string, unknown> | null;
  correctedType: string | null;
  directChildren: Array<Record<string, unknown>>;
  fazendaId: string;
}): string | null {
  const correction = isRecord(input.event.payload)
    ? input.event.payload.reproduction_correction
    : null;
  const correctionPayload = isRecord(correction) ? correction : null;
  const correctedId = input.event.corrige_evento_id;
  if (
    typeof correctedId !== "string" ||
    !correctionPayload ||
    correctionPayload.nature !== "correction" ||
    correctionPayload.corrected_event_id !== correctedId
  ) {
    return "REPRODUCTION_CORRECTION_CONTRACT_INVALID";
  }
  if (
    !input.correctedEvent ||
    input.correctedEvent.fazenda_id !== input.fazendaId ||
    input.correctedEvent.animal_id !== input.event.animal_id ||
    input.correctedEvent.dominio !== "reproducao" ||
    !SYNCED_REPRODUCTION_TYPES.has(String(input.correctedType)) ||
    input.correctedType !== input.detail.tipo
  ) {
    return "REPRODUCTION_CORRECTION_TARGET_INVALID";
  }
  if (
    input.directChildren.some((child) => child.id !== input.event.id)
  ) {
    return "REPRODUCTION_CORRECTION_BRANCH_CONFLICT";
  }
  return null;
}

export function validateOptionalReproductionEpisode(input: {
  detail: Record<string, unknown>;
  event: Record<string, unknown>;
  episode: Record<string, unknown> | null;
  episodeType: string | null;
  fazendaId: string;
}): string | null {
  const payload = isRecord(input.detail.payload) ? input.detail.payload : {};
  const episodeId = payload.episode_evento_id;
  if (episodeId == null || episodeId === "") return null;
  if (
    typeof episodeId !== "string" ||
    !input.episode ||
    input.episode.id !== episodeId ||
    input.episode.fazenda_id !== input.fazendaId ||
    input.episode.animal_id !== input.event.animal_id ||
    (input.episodeType !== "cobertura" && input.episodeType !== "IA")
  ) {
    return "INVALID_EPISODE_REFERENCE";
  }
  if (
    typeof input.episode.occurred_at !== "string" ||
    typeof input.event.occurred_at !== "string" ||
    input.episode.occurred_at > input.event.occurred_at
  ) {
    return "INVALID_EPISODE_CHRONOLOGY";
  }
  return null;
}

export async function resolveReproductionDiagnosisDependency(input: {
  operation: Operation;
  operations: Operation[];
  processedResults: ProcessedResult[];
  fazendaId: string;
  loadRemoteEvent: (fazendaId: string, eventId: string) => Promise<RemoteLookup>;
}): Promise<ReproductionDiagnosisDependency> {
  const eventId = input.operation.record?.evento_id;
  if (typeof eventId !== "string" || eventId.length === 0) {
    return {
      status: "BLOCKED_DEPENDENCY",
      reason_code: "REPRODUCTION_EVENT_NOT_APPLIED",
      reason_message: "Reproduction detail requires a factual base event",
    };
  }

  const parentOperation = input.operations.find((candidate) =>
    candidate.table === "eventos" &&
    candidate.action === "INSERT" &&
    candidate.record?.id === eventId
  );
  if (parentOperation) {
    const result = input.processedResults.find((entry) =>
      entry.op_id === parentOperation.client_op_id
    );
    if (result?.status === "APPLIED" || result?.status === "APPLIED_ALTERED") {
      return {
        status: "READY",
        event: { ...parentOperation.record, fazenda_id: input.fazendaId },
      };
    }
    return {
      status: "BLOCKED_DEPENDENCY",
      reason_code: "REPRODUCTION_EVENT_NOT_APPLIED",
      reason_message: "Reproduction detail is blocked until its base event is applied",
    };
  }

  const lookup = await input.loadRemoteEvent(input.fazendaId, eventId);
  if (lookup.error) {
    return {
      status: "RETRYABLE",
      reason_code: "REPRODUCTION_EVENT_LOOKUP_FAILED",
      reason_message: lookup.error.message ?? "Failed to load reproduction event",
    };
  }
  if (
    !lookup.data ||
    lookup.data.fazenda_id !== input.fazendaId ||
    lookup.data.dominio !== "reproducao"
  ) {
    return {
      status: "BLOCKED_DEPENDENCY",
      reason_code: "REPRODUCTION_EVENT_NOT_APPLIED",
      reason_message: "Reproduction base event is missing or belongs to another tenant",
    };
  }
  return { status: "READY", event: lookup.data };
}

export function validatePregnancyDiagnosis(input: {
  detail: Record<string, unknown>;
  event: Record<string, unknown>;
  episode: Record<string, unknown> | null;
  episodeType: string | null;
  fazendaId: string;
}): string | null {
  const payload = isRecord(input.detail.payload) ? input.detail.payload : {};
  const result = payload.resultado;
  const episodeId = payload.episode_evento_id;
  if (result !== "positivo" && result !== "negativo") {
    return "REPRODUCTION_DIAGNOSIS_RESULT_INVALID";
  }
  if (typeof episodeId !== "string" || episodeId.length === 0) {
    return "REPRODUCTION_DIAGNOSIS_EPISODE_REQUIRED";
  }
  if (
    !input.episode ||
    input.episode.id !== episodeId ||
    input.episode.fazenda_id !== input.fazendaId ||
    input.episode.animal_id !== input.event.animal_id ||
    (input.episodeType !== "cobertura" && input.episodeType !== "IA")
  ) {
    return "INVALID_EPISODE_REFERENCE";
  }
  if (
    typeof input.episode.occurred_at !== "string" ||
    typeof input.event.occurred_at !== "string" ||
    input.episode.occurred_at > input.event.occurred_at
  ) {
    return "INVALID_EPISODE_CHRONOLOGY";
  }
  const dpp = payload.data_prevista_parto;
  if (
    dpp != null &&
    (typeof dpp !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dpp))
  ) {
    return "REPRODUCTION_DIAGNOSIS_DPP_INVALID";
  }
  return null;
}
