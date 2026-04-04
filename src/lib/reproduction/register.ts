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

interface BuildReproductionGestureInput {
  fazendaId: string;
  animalId: string;
  sourceTaskId?: string | null;
  occurredAt?: string;
  data: ReproductionDraftInput;
  animalIdentificacao?: string;
  loteId?: string | null;
  paiId?: string | null;
}

export interface ReproductionGestureBuildResult
  extends EventGestureBuildResult {
  calfIds: string[];
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
    data,
  }: Pick<
    BuildReproductionGestureInput,
    "animalId" | "animalIdentificacao" | "loteId" | "paiId" | "data"
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

  const calves = Array.from({ length: requestedCount }, (_, index) => {
    const cria = data.crias?.[index];
    const criaId = cria?.localId || crypto.randomUUID();
    const sexo = cria?.sexo || (index === 0 ? "F" : "M");

    return {
      table: "animais",
      action: "INSERT",
      record: {
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
        raca: null,
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
      },
    };
  });

  return {
    calfIds: calves.map((calf) => String(calf.record.id)),
    ops: calves,
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

export function buildReproductionGesture({
  fazendaId,
  animalId,
  sourceTaskId = null,
  occurredAt = new Date().toISOString(),
  animalIdentificacao,
  loteId = null,
  paiId = null,
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
      data_prevista_parto: data.dataPrevistaParto,
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
  const paiId = await resolvePartoFatherId(input);
  return buildReproductionGesture({
    ...input,
    paiId,
  });
}

export async function registerReproductionGesture(
  input: BuildReproductionGestureInput,
) {
  const built = await prepareReproductionGesture(input);
  const txId = await createGesture(input.fazendaId, built.ops);

  return {
    txId,
    eventId: built.eventId,
    calfIds: built.calfIds,
  };
}
