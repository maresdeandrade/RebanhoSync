import {
  createAnswerableInsight,
  createAnswerableSourceContract,
} from "@/lib/insights/sourceContract";
import type { InsightQuestionKind, OperationalInsight } from "@/lib/insights/types";

export type HerdStageAnimalInput = {
  id: string;
  status?: string | null;
  deletedAt?: string | null;
  loteId?: string | null;
  sexo?: string | null;
  stage?: string | null;
  category?: string | null;
  reproductiveStatus?: string | null;
};

export type HerdStageQuestionKind = Extract<InsightQuestionKind, "current_state">;

export type HerdStageFilter = {
  loteIds?: readonly string[];
  statuses?: readonly string[];
  sexos?: readonly string[];
  stages?: readonly string[];
  categories?: readonly string[];
};

export type HerdStageCountGroup = {
  count: number;
};

export type HerdStageSummary = {
  totalAnimals: number;
  byStage: Array<{ stage: string; count: number }>;
  byLote: Array<{ loteId: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  unknownStageCount: number;
};

export type CreateHerdStageSummaryInsightInput = {
  questionKind: InsightQuestionKind;
  question: string;
  generatedAt: string;
  animals: readonly HerdStageAnimalInput[];
  filters?: HerdStageFilter;
  primarySource?: string;
};

const PRIMARY_SOURCE = "state_animais";
const ACTIVE_STATUS = "ativo";
const UNKNOWN_STAGE = "estagio_desconhecido";
const MISSING_LOTE = "sem_lote";

function assertCurrentStateQuestionKind(
  questionKind: InsightQuestionKind,
): asserts questionKind is HerdStageQuestionKind {
  if (questionKind !== "current_state") {
    throw new Error("herdStageSummary supports only current_state");
  }
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeFilterValues(values: readonly string[] | undefined): string[] {
  const normalized = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed) {
      normalized.add(trimmed);
    }
  }

  return Array.from(normalized);
}

function normalizeHerdStageFilter(filter: HerdStageFilter | undefined): HerdStageFilter {
  const normalized: HerdStageFilter = {};
  const loteIds = normalizeFilterValues(filter?.loteIds);
  const statuses = normalizeFilterValues(filter?.statuses);
  const sexos = normalizeFilterValues(filter?.sexos);
  const stages = normalizeFilterValues(filter?.stages);
  const categories = normalizeFilterValues(filter?.categories);

  if (loteIds.length > 0) normalized.loteIds = loteIds;
  normalized.statuses = statuses.length > 0 ? statuses : [ACTIVE_STATUS];
  if (sexos.length > 0) normalized.sexos = sexos;
  if (stages.length > 0) normalized.stages = stages;
  if (categories.length > 0) normalized.categories = categories;

  return normalized;
}

function matchesFilterValue(
  value: string | null | undefined,
  allowedValues: readonly string[] | undefined,
): boolean {
  if (!allowedValues || allowedValues.length === 0) {
    return true;
  }

  const normalized = normalizeString(value);
  return Boolean(normalized && allowedValues.includes(normalized));
}

function stageKey(animal: HerdStageAnimalInput): string {
  return normalizeString(animal.stage) ?? UNKNOWN_STAGE;
}

function loteKey(animal: HerdStageAnimalInput): string {
  return normalizeString(animal.loteId) ?? MISSING_LOTE;
}

function statusKey(animal: HerdStageAnimalInput): string {
  return normalizeString(animal.status) ?? "status_desconhecido";
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toSortedCountArray<T extends string>(
  map: Map<string, number>,
  keyName: T,
): Array<Record<T, string> & { count: number }> {
  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({ [keyName]: key, count }) as Record<T, string> & {
      count: number;
    });
}

export function getCurrentHerdAnimals(input: {
  animals: readonly HerdStageAnimalInput[];
  filters?: HerdStageFilter;
}): HerdStageAnimalInput[] {
  const filters = normalizeHerdStageFilter(input.filters);

  return input.animals.filter(
    (animal) =>
      !animal.deletedAt &&
      matchesFilterValue(statusKey(animal), filters.statuses) &&
      matchesFilterValue(loteKey(animal), filters.loteIds) &&
      matchesFilterValue(animal.sexo, filters.sexos) &&
      matchesFilterValue(stageKey(animal), filters.stages) &&
      matchesFilterValue(animal.category, filters.categories),
  );
}

export function groupHerdByStage(
  animals: readonly HerdStageAnimalInput[],
): Array<{ stage: string; count: number }> {
  const byStage = new Map<string, number>();

  for (const animal of animals) {
    incrementCount(byStage, stageKey(animal));
  }

  return toSortedCountArray(byStage, "stage");
}

export function groupHerdByLote(
  animals: readonly HerdStageAnimalInput[],
): Array<{ loteId: string; count: number }> {
  const byLote = new Map<string, number>();

  for (const animal of animals) {
    incrementCount(byLote, loteKey(animal));
  }

  return toSortedCountArray(byLote, "loteId");
}

export function groupHerdByStatus(
  animals: readonly HerdStageAnimalInput[],
): Array<{ status: string; count: number }> {
  const byStatus = new Map<string, number>();

  for (const animal of animals) {
    incrementCount(byStatus, statusKey(animal));
  }

  return toSortedCountArray(byStatus, "status");
}

function summarizeCurrentHerd(animals: readonly HerdStageAnimalInput[]): HerdStageSummary {
  return {
    totalAnimals: animals.length,
    byStage: groupHerdByStage(animals),
    byLote: groupHerdByLote(animals),
    byStatus: groupHerdByStatus(animals),
    unknownStageCount: animals.filter((animal) => stageKey(animal) === UNKNOWN_STAGE).length,
  };
}

function buildLimitations(summary: HerdStageSummary): string[] {
  const limitations = [
    "Resumo usa estado atual de state_animais/read model atual; nao responde historico de mudanca de categoria no periodo.",
    "Nao infere estagio por idade, peso ou eventos.",
    "Sem filtro de status explicito, apenas status ativo entra no resumo.",
  ];

  if (summary.unknownStageCount > 0) {
    limitations.push(
      "Animais sem stage informado foram agrupados em estagio_desconhecido.",
    );
  }

  return limitations;
}

export function createHerdStageSummaryInsight(
  input: CreateHerdStageSummaryInsightInput,
): OperationalInsight<HerdStageSummary> {
  assertCurrentStateQuestionKind(input.questionKind);
  const filters = normalizeHerdStageFilter(input.filters);
  const animals = getCurrentHerdAnimals({
    animals: input.animals,
    filters,
  });
  const summary = summarizeCurrentHerd(animals);

  return createAnswerableInsight({
    questionKind: input.questionKind,
    question: input.question,
    generatedAt: input.generatedAt,
    filters,
    source: createAnswerableSourceContract({
      primarySource: input.primarySource ?? PRIMARY_SOURCE,
      auxiliarySources: [],
      excludedSources: ["eventos", "eventos_*", "agenda", "agenda_itens", "tags/marcadores"],
      limitations: buildLimitations(summary),
      evidenceStatus: summary.unknownStageCount > 0 ? "depende_validacao" : "comprovado",
    }),
    resultStatus:
      summary.totalAnimals === 0
        ? "empty"
        : summary.unknownStageCount > 0
          ? "partial"
          : "complete",
    partialReason:
      summary.unknownStageCount > 0
        ? "Existem animais sem stage informado no estado atual."
        : undefined,
    data: summary,
  });
}
