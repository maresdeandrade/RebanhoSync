import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { AgendaItem, Animal, OperationInput } from "@/lib/offline/types";
import {
  getAnimalPayloadRecord,
  getBirthEventId,
  getNeonatalSetup,
} from "@/lib/reproduction/neonatal";

export type CalfJourneyMilestoneKey =
  | "cura_umbigo"
  | "revisao_neonatal"
  | "pesagem_d7"
  | "pesagem_d30"
  | "desmame";

export interface CalfJourneyMilestoneDefinition {
  key: CalfJourneyMilestoneKey;
  title: string;
  tipo: string;
  daysFromBirth: number;
  dominio: AgendaItem["dominio"];
}

export const CALF_JOURNEY_MILESTONES: CalfJourneyMilestoneDefinition[] = [
  {
    key: "cura_umbigo",
    title: "Cura do umbigo",
    tipo: "cura_umbigo",
    daysFromBirth: 0,
    dominio: "sanitario",
  },
  {
    key: "revisao_neonatal",
    title: "Revisao neonatal",
    tipo: "revisao_neonatal",
    daysFromBirth: 3,
    dominio: "sanitario",
  },
  {
    key: "pesagem_d7",
    title: "Pesagem D7",
    tipo: "pesagem_d7",
    daysFromBirth: 7,
    dominio: "pesagem",
  },
  {
    key: "pesagem_d30",
    title: "Pesagem D30",
    tipo: "pesagem_d30",
    daysFromBirth: 30,
    dominio: "pesagem",
  },
  {
    key: "desmame",
    title: "Desmame",
    tipo: "desmame",
    daysFromBirth: 210,
    dominio: "nutricao",
  },
];

export interface BuildCalfJourneyAgendaOpsInput {
  fazendaId: string;
  calf: Pick<
    Animal,
    "id" | "identificacao" | "lote_id" | "data_nascimento" | "payload"
  >;
  mother: Pick<Animal, "id" | "identificacao">;
  existingAgendaItems?: Pick<
    AgendaItem,
    "id" | "animal_id" | "status" | "dedup_key" | "deleted_at"
  >[];
}

export interface BuildCalfJourneyCompletionOpsInput {
  fazendaId: string;
  calf: Pick<Animal, "id" | "identificacao" | "lote_id" | "payload">;
  mother: Pick<Animal, "id" | "identificacao"> | null;
  agendaItem: Pick<
    AgendaItem,
    "id" | "tipo" | "dominio" | "payload" | "source_ref" | "animal_id" | "lote_id"
  >;
  occurredAt?: string;
  pesoKg?: number | null;
  destinationLoteId?: string | null;
}

export interface CalfJourneyStage {
  key:
    | "neonatal"
    | "aleitamento_inicial"
    | "aleitamento"
    | "pre_desmame"
    | "desmame_pendente"
    | "desmamado";
  label: string;
  helper: string;
}

function parseDateKey(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey: string, days: number) {
  const base = parseDateKey(dateKey);
  if (!base) {
    return new Date().toISOString().slice(0, 10);
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function getAgeInDays(dateKey: string | null | undefined) {
  const base = parseDateKey(dateKey);
  if (!base) return null;
  const today = new Date();
  const diffMs = today.getTime() - base.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getMilestoneDefinition(key: CalfJourneyMilestoneKey | null) {
  if (!key) return null;
  return CALF_JOURNEY_MILESTONES.find((item) => item.key === key) ?? null;
}

export function getCalfJourneyDedupKey(calfId: string, key: CalfJourneyMilestoneKey) {
  return `calf_journey:${calfId}:${key}`;
}

export function getCalfJourneyMilestoneKey(item: Pick<AgendaItem, "tipo" | "payload" | "source_ref">) {
  const payloadMilestone =
    item.payload && typeof item.payload.milestone_key === "string"
      ? item.payload.milestone_key
      : null;
  const sourceMilestone =
    item.source_ref && typeof item.source_ref.milestone_key === "string"
      ? item.source_ref.milestone_key
      : null;
  const value = payloadMilestone ?? sourceMilestone ?? item.tipo;

  return CALF_JOURNEY_MILESTONES.some((milestone) => milestone.key === value)
    ? (value as CalfJourneyMilestoneKey)
    : null;
}

export function isCalfJourneyAgendaItem(
  item: Pick<AgendaItem, "tipo" | "payload" | "source_ref">,
) {
  return getCalfJourneyMilestoneKey(item) !== null;
}

export function buildCalfJourneyAgendaOps({
  calf,
  mother,
  existingAgendaItems = [],
}: BuildCalfJourneyAgendaOpsInput) {
  const birthDate = calf.data_nascimento ?? new Date().toISOString().slice(0, 10);
  const birthEventId = getBirthEventId(calf.payload);
  const neonatalSetup = getNeonatalSetup(calf.payload);
  const existingDedupKeys = new Set(
    existingAgendaItems
      .filter((item) => item.animal_id === calf.id && !item.deleted_at)
      .map((item) => item.dedup_key)
      .filter((value): value is string => Boolean(value)),
  );

  const ops: OperationInput[] = [];

  for (const milestone of CALF_JOURNEY_MILESTONES) {
    if (
      milestone.key === "cura_umbigo" &&
      typeof neonatalSetup?.umbigo_curado_at === "string"
    ) {
      continue;
    }
    const dedupKey = getCalfJourneyDedupKey(calf.id, milestone.key);
    if (existingDedupKeys.has(dedupKey)) continue;

    ops.push({
      table: "agenda_itens",
      action: "INSERT",
      record: {
        id: crypto.randomUUID(),
        dominio: milestone.dominio,
        tipo: milestone.tipo,
        status: "agendado",
        data_prevista: addDays(birthDate, milestone.daysFromBirth),
        animal_id: calf.id,
        lote_id: calf.lote_id ?? null,
        dedup_key: dedupKey,
        source_kind: "automatico",
        source_ref: {
          journey: "cria",
          milestone_key: milestone.key,
          milestone_label: milestone.title,
          mother_id: mother.id,
          mother_identificacao: mother.identificacao,
          birth_event_id: birthEventId,
          produto: milestone.title,
        },
        source_evento_id: birthEventId,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        protocol_item_version_id: null,
        interval_days_applied:
          milestone.daysFromBirth > 0 ? milestone.daysFromBirth : null,
        payload: {
          journey: "cria",
          milestone_key: milestone.key,
          milestone_label: milestone.title,
          mother_id: mother.id,
          birth_event_id: birthEventId,
        },
      },
    });
  }

  return {
    ops,
    createdCount: ops.length,
  };
}

export function buildCalfJourneyCompletionOps({
  fazendaId,
  calf,
  mother,
  agendaItem,
  occurredAt = new Date().toISOString(),
  pesoKg = null,
  destinationLoteId = null,
}: BuildCalfJourneyCompletionOpsInput) {
  const milestoneKey = getCalfJourneyMilestoneKey(agendaItem);
  const milestone = getMilestoneDefinition(milestoneKey);
  if (!milestone) {
    throw new Error("Marco da jornada da cria nao reconhecido.");
  }

  const birthEventId = getBirthEventId(calf.payload);
  const basePayload = {
    journey: "cria",
    milestone_key: milestone.key,
    milestone_label: milestone.title,
    birth_event_id: birthEventId,
    mother_id: mother?.id ?? null,
  };

  const ops: OperationInput[] = [];
  let linkedEventId: string | null = null;

  if (milestone.key === "cura_umbigo") {
    const built = buildEventGesture({
      dominio: "sanitario",
      fazendaId,
      animalId: calf.id,
      loteId: calf.lote_id ?? null,
      sourceTaskId: agendaItem.id,
      occurredAt,
      observacoes: `Cura do umbigo da cria ${calf.identificacao}`,
      tipo: "medicamento",
      produto: "Cura de umbigo",
      payload: {
        ...basePayload,
        procedimento: "cura_umbigo",
      },
    });
    linkedEventId = built.eventId;
    ops.push(...built.ops);
  } else if (milestone.key === "revisao_neonatal") {
    const built = buildEventGesture({
      dominio: "sanitario",
      fazendaId,
      animalId: calf.id,
      loteId: calf.lote_id ?? null,
      sourceTaskId: agendaItem.id,
      occurredAt,
      observacoes: `Revisao neonatal da cria ${calf.identificacao}`,
      tipo: "medicamento",
      produto: "Revisao neonatal",
      payload: {
        ...basePayload,
        procedimento: "revisao_neonatal",
      },
    });
    linkedEventId = built.eventId;
    ops.push(...built.ops);
  } else if (milestone.key === "pesagem_d7" || milestone.key === "pesagem_d30") {
    if (!Number.isFinite(pesoKg) || (pesoKg ?? 0) <= 0) {
      throw new Error("Informe um peso valido para concluir a pesagem.");
    }
    const built = buildEventGesture({
      dominio: "pesagem",
      fazendaId,
      animalId: calf.id,
      loteId: calf.lote_id ?? null,
      sourceTaskId: agendaItem.id,
      occurredAt,
      observacoes: `${milestone.title} da cria ${calf.identificacao}`,
      pesoKg,
      payload: {
        ...basePayload,
      },
    });
    linkedEventId = built.eventId;
    ops.push(...built.ops);
  } else if (milestone.key === "desmame") {
    const built = buildEventGesture({
      dominio: "nutricao",
      fazendaId,
      animalId: calf.id,
      loteId: destinationLoteId ?? calf.lote_id ?? null,
      sourceTaskId: agendaItem.id,
      occurredAt,
      observacoes: `Desmame da cria ${calf.identificacao}`,
      alimentoNome: "Desmame",
      quantidadeKg: 1,
      payload: {
        ...basePayload,
        procedimento: "desmame",
        destination_lote_id: destinationLoteId,
      },
    });
    linkedEventId = built.eventId;
    ops.push(...built.ops);

    const currentPayload = getAnimalPayloadRecord(calf.payload);
    ops.push({
      table: "animais",
      action: "UPDATE",
      record: {
        id: calf.id,
        lote_id: destinationLoteId ?? calf.lote_id ?? null,
        payload: {
          ...currentPayload,
          weaning: {
            completed_at: occurredAt,
            event_id: built.eventId,
            destination_lote_id: destinationLoteId ?? calf.lote_id ?? null,
          },
        },
      },
    });
  }

  ops.push({
    table: "agenda_itens",
    action: "UPDATE",
    record: {
      id: agendaItem.id,
      status: "concluido",
      source_evento_id: linkedEventId,
    },
  });

  return {
    milestone,
    linkedEventId,
    ops,
  };
}

export function getCalfJourneyStage(
  animal: Pick<Animal, "data_nascimento" | "payload">,
  agendaItems: Pick<AgendaItem, "status" | "tipo" | "payload" | "source_ref">[],
): CalfJourneyStage {
  const payload = getAnimalPayloadRecord(animal.payload);
  const weaning =
    payload.weaning && typeof payload.weaning === "object" && !Array.isArray(payload.weaning)
      ? (payload.weaning as Record<string, unknown>)
      : null;

  if (typeof weaning?.completed_at === "string") {
    return {
      key: "desmamado",
      label: "Desmamado",
      helper: "A cria concluiu a jornada inicial e saiu do aleitamento.",
    };
  }

  const desmameConcluido = agendaItems.some((item) => {
    return item.status === "concluido" && getCalfJourneyMilestoneKey(item) === "desmame";
  });
  if (desmameConcluido) {
    return {
      key: "desmamado",
      label: "Desmamado",
      helper: "Desmame registrado na agenda da cria.",
    };
  }

  const ageInDays = getAgeInDays(animal.data_nascimento);
  if (ageInDays === null || ageInDays <= 7) {
    return {
      key: "neonatal",
      label: "Neonatal",
      helper: "Primeira semana, foco em umbigo, revisao e pesagem curta.",
    };
  }
  if (ageInDays <= 30) {
    return {
      key: "aleitamento_inicial",
      label: "Aleitamento inicial",
      helper: "Monitorar peso de largada e consolidar os cuidados do primeiro mes.",
    };
  }
  if (ageInDays < 180) {
    return {
      key: "aleitamento",
      label: "Aleitamento",
      helper: "A cria segue em crescimento antes da preparacao para o desmame.",
    };
  }
  if (ageInDays < 210) {
    return {
      key: "pre_desmame",
      label: "Pre-desmame",
      helper: "Janela final para preparar o desmame e conferir o lote de destino.",
    };
  }
  return {
    key: "desmame_pendente",
    label: "Desmame pendente",
    helper: "A idade ja entrou na faixa de desmame e a conclusao segue em aberto.",
  };
}
