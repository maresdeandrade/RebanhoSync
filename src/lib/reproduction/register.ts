import type { ReproductionCalfDraft } from "@/components/events/ReproductionForm";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import {
  EventValidationError,
  type EventValidationIssue,
} from "@/lib/events/validators";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { EventGestureBuildResult } from "@/lib/events/types";
import type { OperationInput, ReproTipoEnum } from "@/lib/offline/types";
import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import { buildUmbigoCareAgendaOps } from "@/lib/reproduction/calfJourney";
import {
  rebuildReproductiveProjection,
  type ReproductiveProjection,
  type ReproductiveProjectionEvent,
} from "@/lib/reproduction/status";

export interface ReproductionDraftInput {
  tipo: ReproTipoEnum;
  machoId?: string | null;
  observacoes?: string;
  resultadoDiagnostico?: string;
  dataPrevistaParto?: string;
  dataParto?: string;
  numeroCrias?: number;
  crias?: ReproductionCalfDraft[];
  tecnicaLivre?: string;
  reprodutorTag?: string;
  loteSemen?: string;
  doseSemenRef?: string;
  episodeEventoId?: string | null;
  episodeLinkMethod?: "manual" | "auto_last_open_service" | "unlinked";
}

export interface BuildReproductionGestureInput {
  fazendaId: string;
  animalId: string;
  eventId?: string;
  sourceTaskId?: string | null;
  occurredAt?: string;
  data: ReproductionDraftInput;
  animalIdentificacao?: string;
  loteId?: string | null;
  paiId?: string | null;
  maeRaca?: string | null;
}

export interface ReproductionGestureBuildResult
  extends EventGestureBuildResult {
  calfIds: string[];
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function addGestationDays(value: string | null | undefined, days: number) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function throwReproIssues(issues: EventValidationIssue[]): never {
  throw new EventValidationError(issues);
}

function buildGeneratedCalves(
  eventId: string,
  occurredAt: string,
  {
    animalId,
    animalIdentificacao,
    loteId = null,
    paiId = null,
    maeRaca = null,
    data,
  }: Pick<
    BuildReproductionGestureInput,
    "animalId" | "animalIdentificacao" | "loteId" | "paiId" | "maeRaca" | "data"
  >,
): { calfIds: string[]; ops: OperationInput[] } {
  if (data.tipo !== "parto") return { calfIds: [], ops: [] };

  const requestedCount = Math.max(
    1,
    data.numeroCrias ?? data.crias?.length ?? 1,
  );
  const birthDate = (data.dataParto || occurredAt).slice(0, 10);
  const baseIdentificacao = animalIdentificacao || animalId.slice(0, 8);
  const token = birthDate.replaceAll("-", "").slice(2);

  const calfOps = Array.from(
    { length: requestedCount },
    (_, index): { calfId: string; ops: OperationInput[] } => {
      const cria = data.crias?.[index];
      const criaId = cria?.localId || crypto.randomUUID();
      const sexo = cria?.sexo || (index === 0 ? "F" : "M");
      const calfRecord = {
        id: criaId,
        identificacao:
          cria?.identificacao?.trim() || `${baseIdentificacao}-${token}-C${index + 1}`,
        sexo,
        status: "ativo",
        lote_id: loteId,
        data_nascimento: birthDate,
        data_entrada: null,
        data_saida: null,
        pai_id: paiId,
        mae_id: animalId,
        nome: cria?.nome?.trim() || null,
        rfid: null,
        origem: "nascimento",
        raca: maeRaca,
        papel_macho: null,
        habilitado_monta: false,
        observacoes: null,
        payload: {
          generated_from: "evento_parto",
          birth_event_id: eventId,
          ordem_cria: index + 1,
        },
        created_at: occurredAt,
        updated_at: occurredAt,
      };
      const umbigoAgenda = buildUmbigoCareAgendaOps({
        calf: {
          id: calfRecord.id,
          identificacao: calfRecord.identificacao,
          lote_id: calfRecord.lote_id,
          data_nascimento: calfRecord.data_nascimento,
          payload: calfRecord.payload,
        },
        mother: {
          id: animalId,
          identificacao: animalIdentificacao || animalId.slice(0, 8),
        },
      });

      return {
        calfId: criaId,
        ops: [
          {
            table: "animais",
            action: "INSERT",
            record: calfRecord,
          },
          ...umbigoAgenda.ops,
        ],
      };
    },
  );

  return {
    calfIds: calfOps.map((calf) => calf.calfId),
    ops: calfOps.flatMap((calf) => calf.ops),
  };
}

async function resolvePartoFatherId({
  animalId,
  data,
}: Pick<BuildReproductionGestureInput, "animalId" | "data">) {
  if (data.tipo !== "parto") return data.machoId ?? null;
  if (data.machoId) return data.machoId;

  if (data.episodeLinkMethod === "manual" && data.episodeEventoId) {
    const details = await db.event_eventos_reproducao.get(data.episodeEventoId);
    return details?.macho_id ?? null;
  }

  if (
    data.episodeLinkMethod === "auto_last_open_service" ||
    !data.episodeLinkMethod
  ) {
    const history = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .reverse()
      .sortBy("occurred_at");

    for (const event of history) {
      const details = await db.event_eventos_reproducao.get(event.id);
      if (details && (details.tipo === "cobertura" || details.tipo === "IA")) {
        return details.macho_id ?? null;
      }
    }
  }

  return null;
}

async function resolveExpectedBirthDate({
  animalId,
  occurredAt,
  data,
}: Pick<BuildReproductionGestureInput, "animalId" | "occurredAt" | "data">) {
  if (data.dataPrevistaParto) {
    return normalizeDateKey(data.dataPrevistaParto);
  }

  if (data.tipo === "cobertura" || data.tipo === "IA") {
    return addGestationDays(occurredAt, 283);
  }

  if (data.tipo !== "diagnostico" || data.resultadoDiagnostico !== "positivo") {
    return null;
  }

  if (data.episodeLinkMethod === "manual" && data.episodeEventoId) {
    const sourceEvent = await db.event_eventos.get(data.episodeEventoId);
    return addGestationDays(sourceEvent?.occurred_at ?? null, 283);
  }

  if (
    data.episodeLinkMethod === "auto_last_open_service" ||
    !data.episodeLinkMethod
  ) {
    const history = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .reverse()
      .sortBy("occurred_at");

    for (const event of history) {
      const details = await db.event_eventos_reproducao.get(event.id);
      if (details && (details.tipo === "cobertura" || details.tipo === "IA")) {
        return addGestationDays(event.occurred_at, 283);
      }
    }
  }

  return null;
}

async function validateDiagnosticEpisodeAndResolveDpp(
  input: BuildReproductionGestureInput,
  occurredAt: string,
) {
  if (input.data.tipo !== "diagnostico") return null;

  const result = input.data.resultadoDiagnostico;
  if (result !== "positivo" && result !== "negativo") {
    throwReproIssues([
      {
        code: "REPRO_DIAGNOSIS_RESULT_REQUIRED",
        field: "resultadoDiagnostico",
        message: "Diagnostico exige resultado positivo ou negativo.",
      },
    ]);
  }

  const episodeId = input.data.episodeEventoId;
  if (!episodeId) {
    throwReproIssues([
      {
        code: "REPRO_DIAGNOSIS_EPISODE_REQUIRED",
        field: "episodeEventoId",
        message: "Diagnostico exige vinculo com uma cobertura ou IA.",
      },
    ]);
  }

  const [serviceEvent, serviceDetail] = await Promise.all([
    db.event_eventos.get(episodeId),
    db.event_eventos_reproducao.get(episodeId),
  ]);
  const issue = !serviceEvent || !serviceDetail
    ? {
        code: "REPRO_DIAGNOSIS_EPISODE_NOT_FOUND",
        message: "Cobertura ou IA vinculada nao foi encontrada.",
      }
    : serviceEvent.fazenda_id !== input.fazendaId ||
        serviceDetail.fazenda_id !== input.fazendaId
      ? {
          code: "REPRO_DIAGNOSIS_EPISODE_FARM_MISMATCH",
          message: "O episodio vinculado pertence a outra fazenda.",
        }
      : serviceEvent.animal_id !== input.animalId
        ? {
            code: "REPRO_DIAGNOSIS_EPISODE_ANIMAL_MISMATCH",
            message: "O episodio vinculado pertence a outra matriz.",
          }
        : serviceEvent.dominio !== "reproducao" ||
            (serviceDetail.tipo !== "cobertura" && serviceDetail.tipo !== "IA")
          ? {
              code: "REPRO_DIAGNOSIS_EPISODE_TYPE_INVALID",
              message: "Diagnostico so pode vincular cobertura ou IA.",
            }
          : serviceEvent.deleted_at || serviceDetail.deleted_at
            ? {
                code: "REPRO_DIAGNOSIS_EPISODE_DELETED",
                message: "O episodio vinculado nao esta ativo.",
              }
            : serviceEvent.occurred_at > occurredAt
              ? {
                  code: "REPRO_DIAGNOSIS_EPISODE_AFTER_DIAGNOSIS",
                  message: "O servico vinculado nao pode ocorrer depois do diagnostico.",
                }
              : null;

  if (issue) {
    throwReproIssues([
      {
        code: issue.code,
        field: "episodeEventoId",
        message: issue.message,
      },
    ]);
  }

  if (result === "negativo") {
    return { expectedBirthDate: null };
  }

  if (input.data.dataPrevistaParto) {
    if (!isValidDateKey(input.data.dataPrevistaParto)) {
      throwReproIssues([
        {
          code: "REPRO_DIAGNOSIS_DPP_INVALID",
          field: "dataPrevistaParto",
          message: "Data prevista de parto deve ser uma data valida.",
        },
      ]);
    }
    return { expectedBirthDate: input.data.dataPrevistaParto };
  }

  return {
    expectedBirthDate: addGestationDays(serviceEvent!.occurred_at, 283),
  };
}

async function loadReproductiveHistory(
  fazendaId: string,
  animalId: string,
  excludedEventId: string,
): Promise<ReproductiveProjectionEvent[]> {
  const events = await db.event_eventos
    .where("animal_id")
    .equals(animalId)
    .filter(
      (event) =>
        event.fazenda_id === fazendaId &&
        event.dominio === "reproducao" &&
        event.id !== excludedEventId &&
        !event.deleted_at,
    )
    .toArray();
  const details = await db.event_eventos_reproducao.bulkGet(
    events.map((event) => event.id),
  );

  return events.map((event, index) => ({
    ...event,
    details: details[index],
  }));
}

async function rebuildProjectionWithPendingDiagnosis(
  input: BuildReproductionGestureInput,
  eventId: string,
  occurredAt: string,
  expectedBirthDate: string | null,
) {
  const history = await loadReproductiveHistory(
    input.fazendaId,
    input.animalId,
    eventId,
  );
  history.push({
    id: eventId,
    fazenda_id: input.fazendaId,
    animal_id: input.animalId,
    occurred_at: occurredAt,
    deleted_at: null,
    details: {
      tipo: "diagnostico",
      deleted_at: null,
      payload: {
        schema_version: 1,
        episode_evento_id: input.data.episodeEventoId,
        episode_link_method: input.data.episodeLinkMethod ?? "manual",
        resultado: input.data.resultadoDiagnostico,
        ...(expectedBirthDate ? { data_prevista_parto: expectedBirthDate } : {}),
      },
    },
  });

  return rebuildReproductiveProjection(history);
}

async function buildAnimalTaxonomyUpdateOp(
  input: BuildReproductionGestureInput,
  occurredAt: string,
  projection: ReproductiveProjection | null,
): Promise<OperationInput | null> {
  const animal = await db.state_animais.get(input.animalId);
  if (!animal) return null;

  const partoDate = normalizeDateKey(input.data.dataParto) ?? occurredAt.slice(0, 10);
  let payload = animal.payload;

  if (input.data.tipo === "diagnostico") {
    if (projection?.status === "PRENHA" && !projection.inconsistency) {
      payload = buildAnimalTaxonomyFactsPayload(payload, {
        prenhez_confirmada: true,
        data_prevista_parto: projection.dpp,
      }, "reproduction_event");
    } else if (projection?.status === "VAZIA" && !projection.inconsistency) {
      payload = buildAnimalTaxonomyFactsPayload(payload, {
        prenhez_confirmada: false,
        data_prevista_parto: null,
      }, "reproduction_event");
    } else {
      return null;
    }
  }

  if (input.data.tipo === "parto") {
    payload = buildAnimalTaxonomyFactsPayload(payload, {
      prenhez_confirmada: false,
      data_prevista_parto: null,
      data_ultimo_parto: partoDate,
      em_lactacao: true,
      secagem_realizada: false,
      puberdade_confirmada: true,
    }, "reproduction_event");
  }

  if (payload === animal.payload) {
    return null;
  }

  return {
    table: "animais",
    action: "UPDATE",
    record: {
      id: animal.id,
      payload,
      updated_at: occurredAt,
    },
  };
}

export function buildReproductionGesture({
  fazendaId,
  animalId,
  eventId,
  sourceTaskId = null,
  occurredAt = new Date().toISOString(),
  animalIdentificacao,
  loteId = null,
  paiId = null,
  maeRaca = null,
  data,
}: BuildReproductionGestureInput): ReproductionGestureBuildResult {
  if (data.tipo === "parto") {
    if (data.episodeLinkMethod === "unlinked") {
      throwReproIssues([
        {
          code: "REPRO_PARTO_REQUIRES_EPISODE",
          field: "episodeLinkMethod",
          message:
            "Parto exige vinculo com servico anterior. Selecione o episodio correspondente.",
        },
      ]);
    }

    if (data.episodeLinkMethod === "manual" && !data.episodeEventoId) {
      throwReproIssues([
        {
          code: "REPRO_PARTO_MANUAL_EPISODE_REQUIRED",
          field: "episodeEventoId",
          message: "Selecione o evento de servico para vincular o parto.",
        },
      ]);
    }
  }

  if ((data.tipo === "cobertura" || data.tipo === "IA") && !data.machoId) {
    throwReproIssues([
      {
        code: "REPRO_MALE_REQUIRED",
        field: "machoId",
        message: "Macho e obrigatorio para cobertura e IA.",
      },
    ]);
  }

  const built = buildEventGesture({
    dominio: "reproducao",
    fazendaId,
    eventId,
    animalId,
    occurredAt,
    sourceTaskId,
    tipo: data.tipo,
    machoId: data.machoId ?? paiId ?? null,
    observacoes: data.observacoes ?? "",
    payloadData: {
      schema_version: 1,
      episode_evento_id: data.episodeEventoId || undefined,
      episode_link_method: data.episodeLinkMethod || undefined,
      tecnica_livre: data.tecnicaLivre,
      reprodutor_tag: data.reprodutorTag,
      lote_semen: data.loteSemen,
      dose_semen_ref: data.doseSemenRef,
      resultado: data.resultadoDiagnostico,
      ...(data.dataPrevistaParto
        ? { data_prevista_parto: data.dataPrevistaParto }
        : {}),
      data_parto_real: data.dataParto,
      numero_crias: data.numeroCrias,
    },
  });

  const { calfIds, ops: calfOps } = buildGeneratedCalves(
    built.eventId,
    occurredAt,
    {
      animalId,
      animalIdentificacao,
      loteId,
      paiId,
      maeRaca,
      data,
    },
  );

  built.ops.push(...calfOps);
  return {
    ...built,
    calfIds,
  };
}

export async function prepareReproductionGesture(
  input: BuildReproductionGestureInput,
) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const diagnostic = await validateDiagnosticEpisodeAndResolveDpp(
    input,
    occurredAt,
  );
  const paiId = await resolvePartoFatherId(input);
  const expectedBirthDate = diagnostic
    ? diagnostic.expectedBirthDate
    : await resolveExpectedBirthDate({ ...input, occurredAt });
  const animal = await db.state_animais.get(input.animalId);
  const maeRaca = animal?.raca ?? null;

  const built = buildReproductionGesture({
    ...input,
    occurredAt,
    paiId,
    maeRaca,
    data: {
      ...input.data,
      ...(input.data.tipo === "diagnostico"
        ? { episodeLinkMethod: input.data.episodeLinkMethod ?? "manual" }
        : {}),
      dataPrevistaParto:
        input.data.tipo === "diagnostico"
          ? expectedBirthDate ?? undefined
          : expectedBirthDate ?? input.data.dataPrevistaParto,
    },
  });
  const projection = input.data.tipo === "diagnostico"
    ? await rebuildProjectionWithPendingDiagnosis(
        input,
        built.eventId,
        occurredAt,
        expectedBirthDate,
      )
    : null;
  const taxonomyUpdateOp = await buildAnimalTaxonomyUpdateOp(
    input,
    occurredAt,
    projection,
  );

  if (taxonomyUpdateOp) {
    built.ops.push(taxonomyUpdateOp);
  }

  return { ...built, projection };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function sameCanonicalValue(left: unknown, right: unknown) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

async function resolveExistingOperation(
  input: BuildReproductionGestureInput,
  built: Awaited<ReturnType<typeof prepareReproductionGesture>>,
) {
  if (!input.eventId) return null;
  const [event, detail] = await Promise.all([
    db.event_eventos.get(input.eventId),
    db.event_eventos_reproducao.get(input.eventId),
  ]);
  if (!event && !detail) return null;

  const eventOp = built.ops.find(
    (op) => op.table === "eventos" && op.record.id === input.eventId,
  );
  const detailOp = built.ops.find(
    (op) => op.table === "eventos_reproducao" && op.record.evento_id === input.eventId,
  );
  const sameEvent = Boolean(
    event &&
      eventOp &&
      event.fazenda_id === input.fazendaId &&
      event.animal_id === eventOp.record.animal_id &&
      event.occurred_at === eventOp.record.occurred_at &&
      event.source_task_id === eventOp.record.source_task_id &&
      event.observacoes === eventOp.record.observacoes &&
      sameCanonicalValue(event.payload, eventOp.record.payload),
  );
  const sameDetail = Boolean(
    detail &&
      detailOp &&
      detail.fazenda_id === input.fazendaId &&
      detail.tipo === detailOp.record.tipo &&
      detail.macho_id === detailOp.record.macho_id &&
      sameCanonicalValue(detail.payload, detailOp.record.payload),
  );

  if (!sameEvent || !sameDetail) {
    throwReproIssues([
      {
        code: "REPRO_OPERATION_IDENTITY_CONFLICT",
        field: "eventId",
        message: "A identidade da operacao ja existe com conteudo diferente.",
      },
    ]);
  }

  if (!event?.client_tx_id) {
    throwReproIssues([
      {
        code: "REPRO_OPERATION_QUEUE_INCONSISTENT",
        field: "eventId",
        message: "O fato existe sem a identidade da transacao local.",
      },
    ]);
  }

  return event.client_tx_id;
}

export async function registerReproductionGesture(
  input: BuildReproductionGestureInput,
) {
  const built = await prepareReproductionGesture(input);
  const existingTxId = await resolveExistingOperation(input, built);
  if (existingTxId) {
    return {
      txId: existingTxId,
      eventId: built.eventId,
      calfIds: built.calfIds,
      projection: built.projection,
    };
  }
  const txId = await createGesture(input.fazendaId, built.ops);

  return {
    txId,
    eventId: built.eventId,
    calfIds: built.calfIds,
    projection: built.projection,
  };
}
