import type { AgendaItem, Animal } from "@/lib/offline/types";
import { getAgendaScheduleBucket } from "@/lib/agenda/groupOrdering";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface AgendaGroupSummaryRow {
  item: Pick<AgendaItem, "id" | "tipo" | "status" | "data_prevista" | "animal_id">;
  animal: Pick<Animal, "sexo"> | null;
}

export interface AgendaSummaryBadge {
  key: string;
  label: string;
  count: number;
  tone: BadgeTone;
}

export interface AgendaAnimalGroupSummary {
  typeBadges: AgendaSummaryBadge[];
  scheduleBadges: AgendaSummaryBadge[];
}

export interface AgendaEventGroupSummary {
  animalBadges: AgendaSummaryBadge[];
}

const TYPE_TONE_BY_KEY: Record<string, BadgeTone> = {
  vacinacao: "info",
  vermifugacao: "success",
  medicamento: "warning",
  pesagem: "neutral",
  movimentacao: "info",
  nutricao: "success",
  financeiro: "neutral",
  reproducao: "warning",
};

function formatTypeLabel(value: string): string {
  if (!value.trim()) return "Tipo";
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildTypeBadge(tipo: string, count: number): AgendaSummaryBadge {
  return {
    key: tipo,
    label: formatTypeLabel(tipo),
    count,
    tone: TYPE_TONE_BY_KEY[tipo] ?? "neutral",
  };
}

function sortBadges(left: AgendaSummaryBadge, right: AgendaSummaryBadge) {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  return left.label.localeCompare(right.label);
}

export function summarizeAgendaGroupByAnimal(
  rows: AgendaGroupSummaryRow[],
  today: Date = new Date(),
): AgendaAnimalGroupSummary {
  const typeCounts = new Map<string, number>();
  let overdueCount = 0;
  let todayCount = 0;
  let futureCount = 0;

  for (const row of rows) {
    const nextTypeCount = (typeCounts.get(row.item.tipo) ?? 0) + 1;
    typeCounts.set(row.item.tipo, nextTypeCount);

    const bucket = getAgendaScheduleBucket(row.item, today);
    if (bucket === "closed") continue;

    if (bucket === "overdue") {
      overdueCount += 1;
      continue;
    }

    if (bucket === "today") {
      todayCount += 1;
      continue;
    }

    futureCount += 1;
  }

  const typeBadges = Array.from(typeCounts.entries())
    .map(([tipo, count]) => buildTypeBadge(tipo, count))
    .sort(sortBadges);

  const scheduleBadges: AgendaSummaryBadge[] = [];
  if (overdueCount > 0) {
    scheduleBadges.push({
      key: "overdue",
      label: "Atrasado",
      count: overdueCount,
      tone: "danger",
    });
  }
  if (todayCount > 0) {
    scheduleBadges.push({
      key: "today",
      label: "Hoje",
      count: todayCount,
      tone: "warning",
    });
  }
  if (futureCount > 0) {
    scheduleBadges.push({
      key: "future",
      label: "Futuro",
      count: futureCount,
      tone: "info",
    });
  }

  return {
    typeBadges,
    scheduleBadges,
  };
}

export function summarizeAgendaGroupByEvent(
  rows: AgendaGroupSummaryRow[],
): AgendaEventGroupSummary {
  const uniqueAnimals = new Set<string>();
  const femaleAnimals = new Set<string>();
  const maleAnimals = new Set<string>();
  const unknownSexAnimals = new Set<string>();
  let withoutAnimalCount = 0;

  for (const row of rows) {
    if (!row.item.animal_id) {
      withoutAnimalCount += 1;
      continue;
    }

    uniqueAnimals.add(row.item.animal_id);

    if (row.animal?.sexo === "F") {
      femaleAnimals.add(row.item.animal_id);
      continue;
    }

    if (row.animal?.sexo === "M") {
      maleAnimals.add(row.item.animal_id);
      continue;
    }

    unknownSexAnimals.add(row.item.animal_id);
  }

  const animalBadges: AgendaSummaryBadge[] = [];

  if (uniqueAnimals.size > 0) {
    animalBadges.push({
      key: "animals",
      label: "Animais",
      count: uniqueAnimals.size,
      tone: "neutral",
    });
  }

  if (femaleAnimals.size > 0) {
    animalBadges.push({
      key: "female",
      label: "Femeas",
      count: femaleAnimals.size,
      tone: "info",
    });
  }

  if (maleAnimals.size > 0) {
    animalBadges.push({
      key: "male",
      label: "Machos",
      count: maleAnimals.size,
      tone: "warning",
    });
  }

  if (unknownSexAnimals.size > 0) {
    animalBadges.push({
      key: "unknown",
      label: "Sexo n/d",
      count: unknownSexAnimals.size,
      tone: "neutral",
    });
  }

  if (withoutAnimalCount > 0) {
    animalBadges.push({
      key: "without-animal",
      label: "Sem animal",
      count: withoutAnimalCount,
      tone: "danger",
    });
  }

  return {
    animalBadges,
  };
}
