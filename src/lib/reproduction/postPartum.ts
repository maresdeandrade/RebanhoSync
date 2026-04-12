import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import { parseWeightInput } from "@/lib/format/weight";
import type { AgendaItem, Animal, OperationInput } from "@/lib/offline/types";
import { buildCalfJourneyAgendaOps } from "@/lib/reproduction/calfJourney";
import {
  getAnimalPayloadRecord,
  getBirthEventId,
  getNeonatalSetup,
} from "@/lib/reproduction/neonatal";

export interface PostPartumCalfDraft {
  calfId: string;
  identificacao: string;
  nome: string;
  loteId: string | null;
  pesoKg: string;
  curaUmbigo: boolean;
}

interface BuildPostPartumOpsInput {
  fazendaId: string;
  weightUnit?: FarmWeightUnit;
  mother: Pick<Animal, "id" | "identificacao">;
  calves: Pick<
    Animal,
    | "id"
    | "identificacao"
    | "nome"
    | "lote_id"
    | "pai_id"
    | "payload"
    | "data_nascimento"
  >[];
  drafts: PostPartumCalfDraft[];
  occurredAt?: string;
  birthEventId?: string | null;
  existingAgendaItems?: Pick<
    AgendaItem,
    "id" | "animal_id" | "status" | "dedup_key" | "deleted_at"
  >[];
}

interface PostPartumBuildResult {
  ops: OperationInput[];
  weighedCount: number;
  umbigoCount: number;
  agendaCount: number;
}

export function buildPostPartumOps({
  fazendaId,
  weightUnit = "kg",
  mother,
  calves,
  drafts,
  occurredAt = new Date().toISOString(),
  birthEventId = null,
  existingAgendaItems = [],
}: BuildPostPartumOpsInput): PostPartumBuildResult {
  const calfMap = new Map(calves.map((calf) => [calf.id, calf]));
  const ops: OperationInput[] = [];
  let weighedCount = 0;
  let umbigoCount = 0;
  let agendaCount = 0;

  for (const draft of drafts) {
    const calf = calfMap.get(draft.calfId);
    if (!calf) continue;

    const currentPayload = getAnimalPayloadRecord(calf.payload);
    const currentNeonatalSetup = getNeonatalSetup(calf.payload) ?? {};
    const currentBirthEventId = getBirthEventId(calf.payload);
    const pesoKg = parseWeightInput(draft.pesoKg, weightUnit);
    const umbigoAlreadyRecorded =
      typeof currentNeonatalSetup.umbigo_curado_at === "string";
    const shouldRegisterUmbigo = draft.curaUmbigo && !umbigoAlreadyRecorded;
    let umbigoEventId: string | null = null;

    const loteChanged = draft.loteId !== calf.lote_id;
    const animalUpdateRecord: Record<string, unknown> = {
      id: calf.id,
      identificacao: draft.identificacao.trim() || calf.identificacao,
      nome: draft.nome.trim() || null,
      payload: {
        ...currentPayload,
        neonatal_setup: {
          ...currentNeonatalSetup,
          completed_at: occurredAt,
          birth_event_id: birthEventId ?? currentBirthEventId,
          mother_id: mother.id,
          father_id: calf.pai_id ?? null,
          initial_lote_id: draft.loteId,
          initial_weight_kg:
            pesoKg !== null
              ? pesoKg
              : (currentNeonatalSetup.initial_weight_kg ?? null),
          initial_weight_recorded_at:
            pesoKg !== null
              ? occurredAt
              : (currentNeonatalSetup.initial_weight_recorded_at ?? null),
          umbigo_curado_at:
            shouldRegisterUmbigo
              ? occurredAt
              : (currentNeonatalSetup.umbigo_curado_at ?? null),
        },
      },
    };

    if (loteChanged) {
      animalUpdateRecord.lote_id = draft.loteId;
      const movEvent = buildEventGesture({
        dominio: "movimentacao",
        fazendaId,
        animalId: calf.id,
        loteId: calf.lote_id,
        occurredAt,
        fromLoteId: calf.lote_id,
        toLoteId: draft.loteId,
        allowDestinationNull: true,
        applyAnimalStateUpdate: false, // We're already updating the animal in this loop
        observacoes: `Movimentacao inicial (pos-parto da matriz ${mother.identificacao})`,
      });
      ops.push(...movEvent.ops);
    }

    ops.push({
      table: "animais",
      action: "UPDATE",
      record: animalUpdateRecord,
    });

    if (pesoKg !== null) {
      const built = buildEventGesture({
        dominio: "pesagem",
        fazendaId,
        animalId: calf.id,
        loteId: draft.loteId,
        occurredAt,
        observacoes: `Pesagem neonatal apos parto da matriz ${mother.identificacao}`,
        pesoKg,
        payload: {
          fase: "neonatal",
          birth_event_id: birthEventId ?? currentBirthEventId,
          mother_id: mother.id,
          father_id: calf.pai_id,
        },
      });

      ops.push(...built.ops);
      weighedCount += 1;
    }

    if (shouldRegisterUmbigo) {
      const built = buildEventGesture({
        dominio: "sanitario",
        fazendaId,
        animalId: calf.id,
        loteId: draft.loteId,
        occurredAt,
        tipo: "medicamento",
        produto: "Cura de umbigo",
        observacoes: `Cura de umbigo registrada no pos-parto da matriz ${mother.identificacao}`,
        payload: {
          fase: "neonatal",
          procedimento: "cura_umbigo",
          birth_event_id: birthEventId ?? currentBirthEventId,
          mother_id: mother.id,
          father_id: calf.pai_id,
        },
      });

      ops.push(...built.ops);
      umbigoCount += 1;
      umbigoEventId = built.eventId;
    }

    const umbigoAgendaDedupKey = `calf_journey:${calf.id}:cura_umbigo`;
    const existingUmbigoAgenda = existingAgendaItems.find(
      (item) =>
        item.animal_id === calf.id &&
        item.dedup_key === umbigoAgendaDedupKey &&
        !item.deleted_at,
    );
    if (umbigoEventId && existingUmbigoAgenda && existingUmbigoAgenda.status === "agendado") {
      ops.push({
        table: "agenda_itens",
        action: "UPDATE",
        record: {
          id: existingUmbigoAgenda.id,
          status: "concluido",
          source_evento_id: umbigoEventId,
        },
      });
    }

    const agendaBuild = buildCalfJourneyAgendaOps({
      fazendaId,
      calf: {
        ...calf,
        payload: {
          ...currentPayload,
          neonatal_setup: {
            ...currentNeonatalSetup,
            umbigo_curado_at:
              shouldRegisterUmbigo
                ? occurredAt
                : (currentNeonatalSetup.umbigo_curado_at ?? null),
          },
        },
      },
      mother,
      existingAgendaItems,
    });
    ops.push(...agendaBuild.ops);
    agendaCount += agendaBuild.createdCount;
  }

  return {
    ops,
    weighedCount,
    umbigoCount,
    agendaCount,
  };
}
