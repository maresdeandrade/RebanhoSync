import { isRecord, type Operation } from "./rules.ts";

type ProcessedResult = {
  op_id: string;
  status: string;
};

type RemoteLookup = {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
};

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
    fields.map((field) => [field, record[field] ?? null]),
  )));
}

export function isDiagnosisDetailOperation(op: Operation) {
  return op.table === "eventos_reproducao" &&
    op.action === "INSERT" &&
    op.record?.tipo === "diagnostico";
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
  table: "eventos" | "eventos_reproducao",
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  const fields = table === "eventos" ? EVENT_FIELDS : DETAIL_FIELDS;
  return fingerprint(existing, fields) === fingerprint(incoming, fields);
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
