import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import { formatWeightInput, parseWeightInput } from "@/lib/format/weight";
import type { AgendaItem, Animal, OperationInput, SanitarioAgendaCreateDraftV2 } from "@/lib/offline/types";
import {
  buildCalfJourneyAgendaOps,
  type CalfJourneyExistingAgendaItem,
} from "@/lib/reproduction/calfJourney";
import {
  getAnimalPayloadRecord,
  getBirthEventId,
  getNeonatalSetup,
  type NeonatalSetup,
} from "@/lib/reproduction/neonatal";

export interface PostPartumCalfDraft {
  calfId: string;
  identificacao: string;
  nome: string;
  loteId: string | null;
  pesoKg: string;
  curaUmbigo: boolean;
}

export interface BuildPostPartumOpsInput {
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
  existingAgendaItems?: CalfJourneyExistingAgendaItem[];
}

interface PostPartumBuildResult {
  ops: OperationInput[];
  sanitarioAgendaV2: SanitarioAgendaCreateDraftV2[];
  weighedCount: number;
  umbigoCount: number;
  agendaCount: number;
}

function initialWeightFields(setup: NeonatalSetup, pesoKg: number | null, occurredAt: string) {
  return {
    initial_weight_kg: pesoKg !== null ? pesoKg : (setup.initial_weight_kg ?? null),
    initial_weight_recorded_at: pesoKg !== null ? occurredAt : (setup.initial_weight_recorded_at ?? null),
  };
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
  const sanitarioAgendaV2: SanitarioAgendaCreateDraftV2[] = [];
  let weighedCount = 0;
  const umbigoCount = 0;
  let agendaCount = 0;

  for (const draft of drafts) {
    const calf = calfMap.get(draft.calfId);
    if (!calf) continue;

    const currentPayload = getAnimalPayloadRecord(calf.payload);
    const currentNeonatalSetup = getNeonatalSetup(calf.payload) ?? {};
    const currentBirthEventId = getBirthEventId(calf.payload);
    const pesoKg = parseWeightInput(draft.pesoKg, weightUnit);
    // Reopening the initial chart is not a new measurement. The persisted
    // neonatal snapshot is re-read inside registerPostPartumGesture's Dexie tx.
    const recordedWeightKg = currentNeonatalSetup.initial_weight_kg;
    const hasRecordedInitialWeight =
      typeof recordedWeightKg === "number" ||
      Boolean(currentNeonatalSetup.initial_weight_recorded_at);
    if (
      hasRecordedInitialWeight && pesoKg !== null &&
      (typeof recordedWeightKg !== "number" ||
        formatWeightInput(recordedWeightKg, weightUnit) !==
          formatWeightInput(pesoKg, weightUnit))
    ) {
      throw new Error("POSTPARTUM_INITIAL_WEIGHT_CORRECTION_REQUIRED");
    }
    const newWeightKg = hasRecordedInitialWeight ? null : pesoKg;

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
          ...initialWeightFields(currentNeonatalSetup, newWeightKg, occurredAt),
        },
      },
    };

    if (loteChanged) {
      const movEvent = buildEventGesture({
        dominio: "movimentacao",
        fazendaId,
        animalId: calf.id,
        loteId: calf.lote_id,
        occurredAt,
        fromLoteId: calf.lote_id,
        toLoteId: draft.loteId,
        observacoes: `Movimentacao inicial (pos-parto da matriz ${mother.identificacao})`,
      });
      ops.push(...movEvent.ops);
    }

    ops.push({
      table: "animais",
      action: "UPDATE",
      record: animalUpdateRecord,
    });

    if (newWeightKg !== null) {
      const built = buildEventGesture({
        dominio: "pesagem",
        fazendaId,
        animalId: calf.id,
        loteId: draft.loteId,
        occurredAt,
        observacoes: `Pesagem neonatal apos parto da matriz ${mother.identificacao}`,
        pesoKg: newWeightKg,
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

    // Sanitary facts belong to the Central's canonical executor, including old callers
    // still submitting curaUmbigo. Saving the initial chart never executes a cycle.

    const agendaBuild = buildCalfJourneyAgendaOps({
      fazendaId,
      calf: {
        ...calf,
        payload: {
          ...currentPayload,
          neonatal_setup: {
            ...currentNeonatalSetup,
          },
        },
      },
      mother,
      existingAgendaItems,
    });
    ops.push(...agendaBuild.ops);
    sanitarioAgendaV2.push(...agendaBuild.sanitarioAgendaV2);
    agendaCount += agendaBuild.createdCount;
  }

  return {
    ops,
    sanitarioAgendaV2,
    weighedCount,
    umbigoCount,
    agendaCount,
  };
}
