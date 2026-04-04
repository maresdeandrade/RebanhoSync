import type { Animal, Lote, ReproTipoEnum } from "@/lib/offline/types";
import { computeReproStatus, type AnimalReproStatus } from "./status";
import type { ReproEventJoined } from "./selectors";
import type { ReproStatus } from "./types";

export type ReproCycleLane = "vazias" | "servidas" | "prenhas" | "paridas";
export type ReproDashboardFilter = "todas" | "atencao" | ReproCycleLane;
export type ReproActionUrgency = "atencao" | "planejado" | "estavel";

export interface ReproDashboardAnimal extends Animal {
  loteNome: string | null;
  lane: ReproCycleLane;
  urgency: ReproActionUrgency;
  reproStatus: AnimalReproStatus;
  lastEventLabel: string;
  lastEventDateLabel: string | null;
  nextActionLabel: string;
  nextActionDate: string | null;
  actionLabel: string;
  actionHref: string;
}

export interface ReproDashboardAgendaItem {
  id: string;
  animalId: string;
  animalIdentificacao: string;
  lane: ReproCycleLane;
  urgency: ReproActionUrgency;
  title: string;
  helper: string;
  date: string | null;
  actionLabel: string;
  actionHref: string;
}

export interface ReproDashboardData {
  animals: ReproDashboardAnimal[];
  agenda: ReproDashboardAgendaItem[];
  totals: {
    femeasAtivas: number;
    servidas: number;
    prenhas: number;
    paridas: number;
    abertas: number;
    atencao: number;
  };
  focus: {
    diagnosticosPendentes: number;
    partosProximos: number;
    puerperioAtivo: number;
    femeasAptas: number;
  };
}

type BuildReproductionDashboardInput = {
  animals: Animal[];
  lotes: Lote[];
  events: ReproEventJoined[];
  now?: Date;
};

const LAST_EVENT_LABELS: Record<ReproTipoEnum, string> = {
  cobertura: "Cobertura",
  IA: "IA",
  diagnostico: "Diagnostico",
  parto: "Parto",
};

function toDateKey(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return toDateKey(copy);
}

function addDaysFromValue(value: string, days: number): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return addDays(date, days);
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function compareOptionalDates(left: string | null, right: string | null): number {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}

function getLane(status: ReproStatus): ReproCycleLane {
  switch (status) {
    case "SERVIDA":
      return "servidas";
    case "PRENHA":
      return "prenhas";
    case "PARIDA_PUERPERIO":
    case "PARIDA_ABERTA":
      return "paridas";
    case "VAZIA":
    default:
      return "vazias";
  }
}

function getUrgency(
  status: ReproStatus,
  nextActionDate: string | null,
  todayKey: string,
  nearBirthKey: string,
): ReproActionUrgency {
  if (status === "SERVIDA") {
    return nextActionDate && nextActionDate <= todayKey ? "atencao" : "planejado";
  }

  if (status === "PRENHA") {
    return nextActionDate && nextActionDate <= nearBirthKey
      ? "atencao"
      : "planejado";
  }

  if (status === "PARIDA_ABERTA") {
    return "atencao";
  }

  if (status === "PARIDA_PUERPERIO") {
    return nextActionDate && nextActionDate <= todayKey ? "atencao" : "planejado";
  }

  return "estavel";
}

function getActionForStatus(animalId: string, status: ReproStatus) {
  if (status === "SERVIDA") {
    return {
      actionLabel: "Registrar diagnostico",
      actionHref: `/animais/${animalId}/reproducao?tipo=diagnostico`,
      nextActionLabel: "Diagnostico previsto",
    };
  }

  if (status === "PRENHA") {
    return {
      actionLabel: "Registrar parto",
      actionHref: `/animais/${animalId}/reproducao?tipo=parto`,
      nextActionLabel: "Parto previsto",
    };
  }

  if (status === "PARIDA_PUERPERIO") {
    return {
      actionLabel: "Ver animal",
      actionHref: `/animais/${animalId}`,
      nextActionLabel: "Fim do puerperio",
    };
  }

  return {
    actionLabel: "Registrar cobertura / IA",
    actionHref: `/animais/${animalId}/reproducao?tipo=cobertura`,
    nextActionLabel:
      status === "PARIDA_ABERTA"
        ? "Nova cobertura recomendada"
        : "Apta para cobertura / IA",
  };
}

function getLastEventLabel(reproStatus: AnimalReproStatus): string {
  if (!reproStatus.lastEventType) {
    return "Sem historico reprodutivo";
  }

  return LAST_EVENT_LABELS[reproStatus.lastEventType];
}

function compareUrgency(left: ReproActionUrgency, right: ReproActionUrgency): number {
  const priority: Record<ReproActionUrgency, number> = {
    atencao: 0,
    planejado: 1,
    estavel: 2,
  };

  return priority[left] - priority[right];
}

export function buildReproductionDashboard({
  animals,
  lotes,
  events,
  now = new Date(),
}: BuildReproductionDashboardInput): ReproDashboardData {
  const loteNames = new Map(
    lotes.filter((lote) => !lote.deleted_at).map((lote) => [lote.id, lote.nome]),
  );
  const eventsByAnimal = new Map<string, ReproEventJoined[]>();

  events.forEach((event) => {
    if (!event.animal_id || event.deleted_at) return;

    const current = eventsByAnimal.get(event.animal_id) ?? [];
    current.push(event);
    eventsByAnimal.set(event.animal_id, current);
  });

  const todayKey = toDateKey(now);
  const nearBirthKey = addDays(now, 30);

  const dashboardAnimals = animals
    .filter(
      (animal) =>
        animal.sexo === "F" &&
        animal.status === "ativo" &&
        (!animal.deleted_at || animal.deleted_at === null),
    )
    .map<ReproDashboardAnimal>((animal) => {
      const history = [...(eventsByAnimal.get(animal.id) ?? [])].sort((left, right) =>
        right.occurred_at.localeCompare(left.occurred_at),
      );
      const reproStatus = computeReproStatus(history);
      const lane = getLane(reproStatus.status);
      let nextActionDate = normalizeDate(reproStatus.predictionDate);
      if (
        reproStatus.status === "PARIDA_PUERPERIO" &&
        reproStatus.lastEventDate
      ) {
        nextActionDate = addDaysFromValue(reproStatus.lastEventDate, 60);
      }
      const { actionHref, actionLabel, nextActionLabel } = getActionForStatus(
        animal.id,
        reproStatus.status,
      );
      const urgency = getUrgency(
        reproStatus.status,
        nextActionDate,
        todayKey,
        nearBirthKey,
      );

      return {
        ...animal,
        loteNome: animal.lote_id ? loteNames.get(animal.lote_id) ?? null : null,
        lane,
        urgency,
        reproStatus,
        lastEventLabel: getLastEventLabel(reproStatus),
        lastEventDateLabel: normalizeDate(reproStatus.lastEventDate),
        nextActionLabel,
        nextActionDate,
        actionLabel,
        actionHref,
      };
    })
    .sort((left, right) => {
      const urgencyCompare = compareUrgency(left.urgency, right.urgency);
      if (urgencyCompare !== 0) return urgencyCompare;

      const actionDateCompare = compareOptionalDates(
        left.nextActionDate,
        right.nextActionDate,
      );
      if (actionDateCompare !== 0) return actionDateCompare;

      return left.identificacao.localeCompare(right.identificacao);
    });

  const agenda = dashboardAnimals
    .map<ReproDashboardAgendaItem>((animal) => ({
      id: `${animal.id}:${animal.reproStatus.status}`,
      animalId: animal.id,
      animalIdentificacao: animal.identificacao,
      lane: animal.lane,
      urgency: animal.urgency,
      title: animal.nextActionLabel,
      helper: `Status atual: ${animal.reproStatus.status.replaceAll("_", " ").toLowerCase()}`,
      date: animal.nextActionDate,
      actionLabel: animal.actionLabel,
      actionHref: animal.actionHref,
    }))
    .sort((left, right) => {
      const urgencyCompare = compareUrgency(left.urgency, right.urgency);
      if (urgencyCompare !== 0) return urgencyCompare;

      const dateCompare = compareOptionalDates(left.date, right.date);
      if (dateCompare !== 0) return dateCompare;

      return left.animalIdentificacao.localeCompare(right.animalIdentificacao);
    });

  const totals = {
    femeasAtivas: dashboardAnimals.length,
    servidas: dashboardAnimals.filter((animal) => animal.reproStatus.status === "SERVIDA")
      .length,
    prenhas: dashboardAnimals.filter((animal) => animal.reproStatus.status === "PRENHA")
      .length,
    paridas: dashboardAnimals.filter((animal) =>
      ["PARIDA_PUERPERIO", "PARIDA_ABERTA"].includes(animal.reproStatus.status),
    ).length,
    abertas: dashboardAnimals.filter((animal) =>
      ["VAZIA", "PARIDA_ABERTA"].includes(animal.reproStatus.status),
    ).length,
    atencao: dashboardAnimals.filter((animal) => animal.urgency === "atencao").length,
  };

  const focus = {
    diagnosticosPendentes: dashboardAnimals.filter(
      (animal) =>
        animal.reproStatus.status === "SERVIDA" &&
        Boolean(animal.nextActionDate) &&
        animal.nextActionDate <= todayKey,
    ).length,
    partosProximos: dashboardAnimals.filter(
      (animal) =>
        animal.reproStatus.status === "PRENHA" &&
        Boolean(animal.nextActionDate) &&
        animal.nextActionDate <= nearBirthKey,
    ).length,
    puerperioAtivo: dashboardAnimals.filter(
      (animal) => animal.reproStatus.status === "PARIDA_PUERPERIO",
    ).length,
    femeasAptas: dashboardAnimals.filter((animal) =>
      ["VAZIA", "PARIDA_ABERTA"].includes(animal.reproStatus.status),
    ).length,
  };

  return {
    animals: dashboardAnimals,
    agenda,
    totals,
    focus,
  };
}
