import type { ReproductionCalfDraft } from "@/components/events/ReproductionForm";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import {
  EventValidationError,
  type EventValidationIssue,
} from "@/lib/events/validators";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { EventGestureBuildResult } from "@/lib/events/types";
import type {
  Evento,
  EventoReproducao,
  OperationInput,
  ReproTipoEnum,
  SanitarioAgendaCreateDraftV2,
} from "@/lib/offline/types";
import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import { buildUmbigoCareSanitarioAgendaV2 } from "@/lib/reproduction/calfJourney";
import { getBirthEventId } from "@/lib/reproduction/neonatal";
import { env } from "@/lib/env";
import { isSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
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
  dataPrevistaParto?: string | null;
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
  corrigeEventoId?: string | null;
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
  sanitarioAgendaV2: SanitarioAgendaCreateDraftV2[];
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

function throwReproIssue(code: string, field: string, message: string): never {
  return throwReproIssues([{ code, field, message }]);
}

const CORRECTABLE_REPRO_TYPES = new Set<ReproTipoEnum>([
  "diagnostico",
  "parto",
  "aborto",
]);

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isReproductiveCorrectionEvent(event: Evento) {
  const value = event.payload.reproduction_correction;
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).nature === "correction",
  );
}

async function validateCorrectionAncestry(
  corrected: Evento,
  correctedDetail: EventoReproducao,
) {
  const visited = new Set<string>();
  let event = corrected;
  let detail = correctedDetail;
  while (event.corrige_evento_id) {
    if (visited.has(event.id) || !isReproductiveCorrectionEvent(event)) {
      throwReproIssue(
        "REPRO_CORRECTION_CHAIN_INVALID",
        "corrigeEventoId",
        "A cadeia factual corrigida possui ciclo ou elo invalido.",
      );
    }
    visited.add(event.id);
    const [parent, parentDetail] = await Promise.all([
      db.event_eventos.get(event.corrige_evento_id),
      db.event_eventos_reproducao.get(event.corrige_evento_id),
    ]);
    if (
      !parent ||
      !parentDetail ||
      parent.deleted_at ||
      parentDetail.deleted_at ||
      parent.fazenda_id !== event.fazenda_id ||
      parentDetail.fazenda_id !== detail.fazenda_id ||
      parent.animal_id !== event.animal_id ||
      parentDetail.tipo !== detail.tipo
    ) {
      throwReproIssue(
        "REPRO_CORRECTION_CHAIN_INVALID",
        "corrigeEventoId",
        "A cadeia factual corrigida possui ciclo ou elo invalido.",
      );
    }
    event = parent;
    detail = parentDetail;
  }
}

function readDraftFromFact(event: Evento, detail: EventoReproducao) {
  const payload = detail.payload as Record<string, unknown>;
  return {
    tipo: detail.tipo,
    machoId: detail.macho_id,
    observacoes: event.observacoes ?? undefined,
    resultadoDiagnostico:
      typeof payload.resultado === "string" ? payload.resultado : undefined,
    dataPrevistaParto:
      typeof payload.data_prevista_parto === "string"
        ? payload.data_prevista_parto
        : undefined,
    dataParto:
      typeof payload.data_parto_real === "string"
        ? payload.data_parto_real
        : undefined,
    numeroCrias:
      typeof payload.numero_crias === "number" ? payload.numero_crias : undefined,
    tecnicaLivre:
      typeof payload.tecnica_livre === "string" ? payload.tecnica_livre : undefined,
    reprodutorTag:
      typeof payload.reprodutor_tag === "string" ? payload.reprodutor_tag : undefined,
    loteSemen:
      typeof payload.lote_semen === "string" ? payload.lote_semen : undefined,
    doseSemenRef:
      typeof payload.dose_semen_ref === "string" ? payload.dose_semen_ref : undefined,
    episodeEventoId:
      typeof payload.episode_evento_id === "string"
        ? payload.episode_evento_id
        : null,
    episodeLinkMethod:
      payload.episode_link_method === "manual" ||
      payload.episode_link_method === "auto_last_open_service" ||
      payload.episode_link_method === "unlinked"
        ? payload.episode_link_method
        : undefined,
  } satisfies ReproductionDraftInput;
}

async function resolveCorrectionInput(
  input: BuildReproductionGestureInput,
): Promise<BuildReproductionGestureInput> {
  if (!input.corrigeEventoId) return input;
  if (!input.eventId) {
    throwReproIssue(
      "REPRO_CORRECTION_ID_REQUIRED",
      "eventId",
      "A correcao exige identidade estavel propria.",
    );
  }
  if (input.eventId === input.corrigeEventoId) {
    throwReproIssue(
      "REPRO_CORRECTION_CYCLE",
      "corrigeEventoId",
      "A correcao nao pode apontar para si mesma.",
    );
  }

  const [corrected, correctedDetail, directChildren] = await Promise.all([
    db.event_eventos.get(input.corrigeEventoId),
    db.event_eventos_reproducao.get(input.corrigeEventoId),
    db.event_eventos
      .filter(
        (event) =>
          event.corrige_evento_id === input.corrigeEventoId &&
          event.id !== input.eventId &&
          !event.deleted_at,
      )
      .toArray(),
  ]);
  if (!corrected || !correctedDetail || corrected.deleted_at || correctedDetail.deleted_at) {
    throwReproIssue(
      "REPRO_CORRECTION_SOURCE_NOT_FOUND",
      "corrigeEventoId",
      "O fato reprodutivo corrigido nao existe.",
    );
  }
  if (
    corrected.fazenda_id !== input.fazendaId ||
    correctedDetail.fazenda_id !== input.fazendaId
  ) {
    throwReproIssue(
      "REPRO_CORRECTION_FARM_MISMATCH",
      "corrigeEventoId",
      "O fato corrigido pertence a outra fazenda.",
    );
  }
  if (corrected.animal_id !== input.animalId) {
    throwReproIssue(
      "REPRO_CORRECTION_ANIMAL_MISMATCH",
      "corrigeEventoId",
      "O fato corrigido pertence a outra matriz.",
    );
  }
  if (
    corrected.dominio !== "reproducao" ||
    !CORRECTABLE_REPRO_TYPES.has(correctedDetail.tipo) ||
    correctedDetail.tipo !== input.data.tipo
  ) {
    throwReproIssue(
      "REPRO_CORRECTION_TYPE_UNSUPPORTED",
      "corrigeEventoId",
      "A correcao exige diagnostico, parto ou aborto do mesmo tipo.",
    );
  }
  if (directChildren.length > 0) {
    throwReproIssue(
      "REPRO_CORRECTION_CHAIN_BRANCH_CONFLICT",
      "corrigeEventoId",
      "O ponto factual ja possui uma correcao vigente.",
    );
  }
  await validateCorrectionAncestry(corrected, correctedDetail);
  const sourceData = readDraftFromFact(corrected, correctedDetail);
  if (correctedDetail.tipo === "parto") {
    const immutableFields: Array<keyof ReproductionDraftInput> = [
      "dataParto",
      "numeroCrias",
      "episodeEventoId",
      "machoId",
    ];
    const changedField = immutableFields.find(
      (field) =>
        hasOwn(input.data, field) &&
        canonicalize(input.data[field]) !== canonicalize(sourceData[field]),
    );
    if (
      changedField ||
      (input.occurredAt && input.occurredAt !== corrected.occurred_at)
    ) {
      throwReproIssue(
        "REPRO_CORRECTION_BIRTH_FIELDS_UNSUPPORTED",
        changedField ?? "occurredAt",
        "Parto permite corrigir apenas observacao sem reescrever crias.",
      );
    }
    return {
      ...input,
      occurredAt: corrected.occurred_at,
      data: {
        ...sourceData,
        observacoes: hasOwn(input.data, "observacoes")
          ? input.data.observacoes
          : sourceData.observacoes,
      },
    };
  }

  return {
    ...input,
    occurredAt: input.occurredAt ?? corrected.occurred_at,
    data: {
      ...sourceData,
      ...input.data,
      dataPrevistaParto: hasOwn(input.data, "dataPrevistaParto")
        ? input.data.dataPrevistaParto
        : sourceData.dataPrevistaParto,
      episodeEventoId: hasOwn(input.data, "episodeEventoId")
        ? input.data.episodeEventoId
        : sourceData.episodeEventoId,
    },
  };
}

function deterministicUuidFromText(value: string) {
  const bytes: number[] = [];
  for (let block = 0; block < 4; block += 1) {
    let hash = 0x811c9dc5 ^ (block * 0x9e3779b1);
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    bytes.push(
      (hash >>> 24) & 0xff,
      (hash >>> 16) & 0xff,
      (hash >>> 8) & 0xff,
      hash & 0xff,
    );
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
): {
  calfIds: string[];
  ops: OperationInput[];
  sanitarioAgendaV2: SanitarioAgendaCreateDraftV2[];
} {
  if (data.tipo !== "parto") {
    return { calfIds: [], ops: [], sanitarioAgendaV2: [] };
  }

  const requestedCount = Math.max(
    1,
    data.numeroCrias ?? data.crias?.length ?? 1,
  );
  const birthDate = (data.dataParto || occurredAt).slice(0, 10);
  const baseIdentificacao = animalIdentificacao || animalId.slice(0, 8);
  const token = birthDate.replaceAll("-", "").slice(2);

  const calfOps = Array.from(
    { length: requestedCount },
    (_, index): {
      calfId: string;
      ops: OperationInput[];
      sanitarioAgendaV2: SanitarioAgendaCreateDraftV2[];
    } => {
      const cria = data.crias?.[index];
      const criaId =
        cria?.localId || deterministicUuidFromText(`${eventId}:calf:${index + 1}`);
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
      const umbigoAgenda = buildUmbigoCareSanitarioAgendaV2({
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
        createAgendaId: (dayOffset, slot) =>
          deterministicUuidFromText(
            `${eventId}:calf:${criaId}:cura_umbigo:d${dayOffset}:${slot}`,
          ),
      });

      return {
        calfId: criaId,
        ops: [
          {
            table: "animais",
            action: "INSERT",
            record: calfRecord,
          },
        ],
        sanitarioAgendaV2: umbigoAgenda,
      };
    },
  );

  return {
    calfIds: calfOps.map((calf) => calf.calfId),
    ops: calfOps.flatMap((calf) => calf.ops),
    sanitarioAgendaV2: calfOps.flatMap((calf) => calf.sanitarioAgendaV2),
  };
}

async function resolvePartoContext(
  input: BuildReproductionGestureInput,
  occurredAt: string,
) {
  if (input.data.tipo !== "parto") {
    return {
      episodeEventoId: input.data.episodeEventoId ?? null,
      episodeLinkMethod: input.data.episodeLinkMethod,
      paiId: input.data.machoId ?? null,
      maeRaca: null,
    };
  }

  const mother = await db.state_animais.get(input.animalId);
  if (!mother || mother.deleted_at) {
    throwReproIssues([
      {
        code: "REPRO_PARTO_MOTHER_NOT_FOUND",
        field: "animalId",
        message: "A matriz do parto nao foi encontrada localmente.",
      },
    ]);
  }
  if (mother.fazenda_id !== input.fazendaId) {
    throwReproIssues([
      {
        code: "REPRO_PARTO_MOTHER_FARM_MISMATCH",
        field: "animalId",
        message: "A matriz do parto pertence a outra fazenda.",
      },
    ]);
  }

  const history = await loadReproductiveHistory(
    input.fazendaId,
    input.animalId,
    input.eventId ?? "",
  );
  const currentProjection = rebuildReproductiveProjection(history);
  const existingPartoDetail = input.eventId
    ? await db.event_eventos_reproducao.get(input.eventId)
    : null;
  const existingPartoPayload =
    existingPartoDetail?.tipo === "parto" &&
    existingPartoDetail.payload &&
    typeof existingPartoDetail.payload === "object"
      ? existingPartoDetail.payload
      : null;
  const existingEpisodeId =
    existingPartoPayload &&
    typeof existingPartoPayload.episode_evento_id === "string"
      ? existingPartoPayload.episode_evento_id
      : null;
  const existingLinkMethod =
    existingPartoPayload &&
    (existingPartoPayload.episode_link_method === "manual" ||
      existingPartoPayload.episode_link_method === "auto_last_open_service" ||
      existingPartoPayload.episode_link_method === "unlinked")
      ? existingPartoPayload.episode_link_method
      : null;
  const replaysExistingParto = Boolean(
    existingPartoDetail && !input.data.episodeEventoId,
  );
  const requestedEpisodeId = input.data.episodeEventoId ?? null;
  const episodeId =
    requestedEpisodeId ??
    (replaysExistingParto ? existingEpisodeId : currentProjection.currentEpisodeId);

  if (!episodeId) {
    return {
      episodeEventoId: null,
      episodeLinkMethod: "unlinked" as const,
      paiId: input.data.machoId ?? existingPartoDetail?.macho_id ?? null,
      maeRaca: mother.raca,
    };
  }

  const [serviceEvent, serviceDetail] = await Promise.all([
    db.event_eventos.get(episodeId),
    db.event_eventos_reproducao.get(episodeId),
  ]);
  const issue = !serviceEvent || !serviceDetail
    ? "REPRO_PARTO_EPISODE_NOT_FOUND"
    : serviceEvent.fazenda_id !== input.fazendaId ||
        serviceDetail.fazenda_id !== input.fazendaId
      ? "REPRO_PARTO_EPISODE_FARM_MISMATCH"
      : serviceEvent.animal_id !== input.animalId
        ? "REPRO_PARTO_EPISODE_ANIMAL_MISMATCH"
        : serviceEvent.dominio !== "reproducao" ||
            (serviceDetail.tipo !== "cobertura" && serviceDetail.tipo !== "IA")
          ? "REPRO_PARTO_EPISODE_TYPE_INVALID"
          : serviceEvent.deleted_at || serviceDetail.deleted_at
            ? "REPRO_PARTO_EPISODE_DELETED"
            : serviceEvent.occurred_at > occurredAt
              ? "REPRO_PARTO_EPISODE_AFTER_BIRTH"
              : requestedEpisodeId &&
                  !replaysExistingParto &&
                  currentProjection.currentEpisodeId &&
                  currentProjection.currentEpisodeId !== requestedEpisodeId
                ? "REPRO_PARTO_EPISODE_NOT_CURRENT"
                : null;

  if (issue) {
    throwReproIssues([
      {
        code: issue,
        field: "episodeEventoId",
        message: "O episodio informado nao e compativel com este parto.",
      },
    ]);
  }

  return {
    episodeEventoId: episodeId,
    episodeLinkMethod: replaysExistingParto
      ? existingLinkMethod ?? "manual"
      : requestedEpisodeId
        ? "manual" as const
        : "auto_last_open_service" as const,
    paiId: input.data.machoId ?? serviceDetail!.macho_id ?? null,
    maeRaca: mother.raca,
  };
}

async function resolveAbortoContext(
  input: BuildReproductionGestureInput,
  occurredAt: string,
) {
  if (input.data.tipo !== "aborto") {
    return {
      episodeEventoId: input.data.episodeEventoId ?? null,
      episodeLinkMethod: input.data.episodeLinkMethod,
    };
  }

  const matrix = await db.state_animais.get(input.animalId);
  if (!matrix || matrix.deleted_at) {
    throwReproIssues([
      {
        code: "REPRO_ABORTO_MATRIX_NOT_FOUND",
        field: "animalId",
        message: "A matriz da perda gestacional nao foi encontrada localmente.",
      },
    ]);
  }
  if (matrix.fazenda_id !== input.fazendaId) {
    throwReproIssues([
      {
        code: "REPRO_ABORTO_MATRIX_FARM_MISMATCH",
        field: "animalId",
        message: "A matriz da perda gestacional pertence a outra fazenda.",
      },
    ]);
  }

  const history = await loadReproductiveHistory(
    input.fazendaId,
    input.animalId,
    input.eventId ?? "",
  );
  const currentProjection = rebuildReproductiveProjection(history);
  const existingDetail = input.eventId
    ? await db.event_eventos_reproducao.get(input.eventId)
    : null;
  const existingPayload =
    existingDetail?.tipo === "aborto" &&
    existingDetail.payload &&
    typeof existingDetail.payload === "object"
      ? existingDetail.payload
      : null;
  const existingEpisodeId =
    existingPayload && typeof existingPayload.episode_evento_id === "string"
      ? existingPayload.episode_evento_id
      : null;
  const existingLinkMethod =
    existingPayload &&
    (existingPayload.episode_link_method === "manual" ||
      existingPayload.episode_link_method === "auto_last_open_service" ||
      existingPayload.episode_link_method === "unlinked")
      ? existingPayload.episode_link_method
      : null;
  const replaysExisting = Boolean(existingDetail && !input.data.episodeEventoId);
  const requestedEpisodeId = input.data.episodeEventoId ?? null;
  const episodeId =
    requestedEpisodeId ??
    (replaysExisting ? existingEpisodeId : currentProjection.currentEpisodeId);

  if (!episodeId) {
    return {
      episodeEventoId: null,
      episodeLinkMethod: "unlinked" as const,
    };
  }

  const [serviceEvent, serviceDetail] = await Promise.all([
    db.event_eventos.get(episodeId),
    db.event_eventos_reproducao.get(episodeId),
  ]);
  const issue = !serviceEvent || !serviceDetail
    ? "REPRO_ABORTO_EPISODE_NOT_FOUND"
    : serviceEvent.fazenda_id !== input.fazendaId ||
        serviceDetail.fazenda_id !== input.fazendaId
      ? "REPRO_ABORTO_EPISODE_FARM_MISMATCH"
      : serviceEvent.animal_id !== input.animalId
        ? "REPRO_ABORTO_EPISODE_ANIMAL_MISMATCH"
        : serviceEvent.dominio !== "reproducao" ||
            (serviceDetail.tipo !== "cobertura" && serviceDetail.tipo !== "IA")
          ? "REPRO_ABORTO_EPISODE_TYPE_INVALID"
          : serviceEvent.deleted_at || serviceDetail.deleted_at
            ? "REPRO_ABORTO_EPISODE_DELETED"
            : serviceEvent.occurred_at > occurredAt
              ? "REPRO_ABORTO_EPISODE_AFTER_LOSS"
              : null;

  if (issue) {
    throwReproIssues([
      {
        code: issue,
        field: "episodeEventoId",
        message: "O episodio informado nao e compativel com esta perda gestacional.",
      },
    ]);
  }

  return {
    episodeEventoId: episodeId,
    episodeLinkMethod: replaysExisting
      ? existingLinkMethod ?? "manual"
      : requestedEpisodeId
        ? "manual" as const
        : "auto_last_open_service" as const,
  };
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

async function rebuildProjectionWithPendingEvent(
  input: BuildReproductionGestureInput,
  built: ReproductionGestureBuildResult,
) {
  const history = await loadReproductiveHistory(
    input.fazendaId,
    input.animalId,
    built.eventId,
  );
  const eventOp = built.ops.find(
    (op) => op.table === "eventos" && op.record.id === built.eventId,
  );
  const detailOp = built.ops.find(
    (op) =>
      op.table === "eventos_reproducao" &&
      op.record.evento_id === built.eventId,
  );
  if (!eventOp || !detailOp) {
    throw new Error("REPRO_PENDING_EVENT_INCOMPLETE");
  }

  history.push({
    id: built.eventId,
    fazenda_id: input.fazendaId,
    animal_id: input.animalId,
    occurred_at: eventOp.record.occurred_at,
    corrige_evento_id: eventOp.record.corrige_evento_id ?? null,
    payload: eventOp.record.payload ?? {},
    deleted_at: null,
    details: {
      tipo: detailOp.record.tipo,
      deleted_at: null,
      payload: detailOp.record.payload,
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
    if (projection?.status !== "PARIDA_PUERPERIO" || !projection.lastBirthDate) {
      return null;
    }
    payload = buildAnimalTaxonomyFactsPayload(payload, {
      prenhez_confirmada: false,
      data_prevista_parto: null,
      data_ultimo_parto: projection.lastBirthDate,
      em_lactacao: true,
      secagem_realizada: false,
      puberdade_confirmada: true,
    }, "reproduction_event");
  }

  if (input.data.tipo === "aborto") {
    if (!projection) return null;
    if (projection.status === "PRENHA") {
      payload = buildAnimalTaxonomyFactsPayload(payload, {
        prenhez_confirmada: true,
        data_prevista_parto: projection.dpp,
      }, "reproduction_event");
    } else if (projection.status === "SERVIDA") {
      payload = buildAnimalTaxonomyFactsPayload(payload, {
        prenhez_confirmada: null,
        data_prevista_parto: null,
      }, "reproduction_event");
    } else if (projection.status === "VAZIA") {
      payload = buildAnimalTaxonomyFactsPayload(payload, {
        prenhez_confirmada: false,
        data_prevista_parto: null,
      }, "reproduction_event");
    } else {
      return null;
    }
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
  corrigeEventoId = null,
  sourceTaskId = null,
  occurredAt = new Date().toISOString(),
  animalIdentificacao,
  loteId = null,
  paiId = null,
  maeRaca = null,
  data,
}: BuildReproductionGestureInput): ReproductionGestureBuildResult {
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
    corrigeEventoId,
    payload: corrigeEventoId
      ? {
          reproduction_correction: {
            schema_version: 1,
            nature: "correction",
            corrected_event_id: corrigeEventoId,
          },
        }
      : {},
    tipo: data.tipo,
    machoId: data.tipo === "aborto" ? null : data.machoId ?? paiId ?? null,
    observacoes: data.observacoes ?? "",
    payloadData: {
      schema_version: 1,
      ...(data.episodeEventoId
        ? { episode_evento_id: data.episodeEventoId }
        : {}),
      ...(data.episodeLinkMethod
        ? { episode_link_method: data.episodeLinkMethod }
        : {}),
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

  const { calfIds, ops: calfOps, sanitarioAgendaV2 } = corrigeEventoId
    ? { calfIds: [], ops: [], sanitarioAgendaV2: [] }
    : buildGeneratedCalves(built.eventId, occurredAt, {
        animalId,
        animalIdentificacao,
        loteId,
        paiId,
        maeRaca,
        data,
      });

  built.ops.push(...calfOps);
  return {
    ...built,
    calfIds,
    sanitarioAgendaV2,
  };
}

export async function prepareReproductionGesture(
  input: BuildReproductionGestureInput,
) {
  input = await resolveCorrectionInput(input);
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const diagnostic = await validateDiagnosticEpisodeAndResolveDpp(
    input,
    occurredAt,
  );
  const partoContext = await resolvePartoContext(input, occurredAt);
  const abortoContext = await resolveAbortoContext(input, occurredAt);
  const expectedBirthDate = diagnostic
    ? diagnostic.expectedBirthDate
    : await resolveExpectedBirthDate({ ...input, occurredAt });

  const built = buildReproductionGesture({
    ...input,
    occurredAt,
    paiId: partoContext.paiId,
    maeRaca: partoContext.maeRaca,
    data: {
      ...input.data,
      ...(input.data.tipo === "diagnostico"
        ? { episodeLinkMethod: input.data.episodeLinkMethod ?? "manual" }
        : {}),
      ...(input.data.tipo === "parto"
        ? {
            episodeEventoId: partoContext.episodeEventoId,
            episodeLinkMethod: partoContext.episodeLinkMethod,
          }
        : {}),
      ...(input.data.tipo === "aborto"
        ? {
            machoId: null,
            episodeEventoId: abortoContext.episodeEventoId,
            episodeLinkMethod: abortoContext.episodeLinkMethod,
          }
        : {}),
      dataPrevistaParto:
        input.data.tipo === "diagnostico"
          ? expectedBirthDate ?? undefined
          : expectedBirthDate ?? input.data.dataPrevistaParto,
    },
  });
  const projection =
    input.data.tipo === "diagnostico" ||
    input.data.tipo === "parto" ||
    input.data.tipo === "aborto"
    ? await rebuildProjectionWithPendingEvent(input, built)
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

function calfIdentity(record: Record<string, unknown>) {
  return {
    id: record.id,
    identificacao: record.identificacao,
    sexo: record.sexo,
    status: record.status,
    lote_id: record.lote_id,
    data_nascimento: record.data_nascimento,
    pai_id: record.pai_id,
    mae_id: record.mae_id,
    nome: record.nome,
    origem: record.origem,
    raca: record.raca,
    payload: record.payload,
  };
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
      event.corrige_evento_id === eventOp.record.corrige_evento_id &&
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

  const expectedCalfOps = built.ops.filter(
    (op) =>
      op.table === "animais" &&
      op.action === "INSERT" &&
      getBirthEventId(op.record.payload) === built.eventId,
  );
  const persistedCalves = await db.state_animais.bulkGet(
    expectedCalfOps.map((op) => op.record.id),
  );
  const sameCalves = expectedCalfOps.every((op, index) => {
    const persisted = persistedCalves[index];
    return Boolean(
      persisted &&
        persisted.fazenda_id === input.fazendaId &&
        sameCanonicalValue(calfIdentity(persisted), calfIdentity(op.record)),
    );
  });
  if (!sameCalves) {
    throwReproIssues([
      {
        code: "REPRO_OPERATION_IDENTITY_CONFLICT",
        field: "eventId",
        message: "A identidade do parto ja existe com crias diferentes.",
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

  return {
    txId: event.client_tx_id,
    calfIds: persistedCalves
      .filter(
        (calf): calf is NonNullable<(typeof persistedCalves)[number]> =>
          Boolean(calf),
      )
      .map((calf) => calf.id),
  };
}

export async function registerReproductionGesture(
  input: BuildReproductionGestureInput,
) {
  const built = await prepareReproductionGesture(input);
  const existing = await resolveExistingOperation(input, built);
  if (existing) {
    return {
      txId: existing.txId,
      eventId: built.eventId,
      calfIds: existing.calfIds,
      projection: built.projection,
    };
  }
  let enqueueSanitarioAgendaV2 = false;
  try {
    const projectRef = new URL(env.supabaseUrl).hostname.split(".")[0] ?? "";
    enqueueSanitarioAgendaV2 = isSanitarioV2PushEnabled(projectRef);
  } catch {
    enqueueSanitarioAgendaV2 = false;
  }
  const txId = await createGesture(input.fazendaId, built.ops, {
    sanitarioAgendaV2: built.sanitarioAgendaV2,
    enqueueSanitarioAgendaV2,
  });

  return {
    txId,
    eventId: built.eventId,
    calfIds: built.calfIds,
    projection: built.projection,
  };
}
