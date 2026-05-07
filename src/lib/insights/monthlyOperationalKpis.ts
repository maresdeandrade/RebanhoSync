import {
  createAnswerableInsight,
  createAnswerableSourceContract,
  createBlockedInsight,
  createBlockedSourceContract,
} from "@/lib/insights/sourceContract";
import type {
  InsightFilters,
  InsightPeriod,
  InsightQuestionKind,
  OperationalInsight,
} from "@/lib/insights/types";

export type MonthlyOperationalKpiEventInput = {
  id: string;
  domain: string;
  occurredAt: string;
  animalId?: string | null;
  loteIdAtEvent?: string | null;
  detailType?: string | null;
  status?: string | null;
  deletedAt?: string | null;
};

export type MonthlyOperationalKpiQuestionKind = Extract<
  InsightQuestionKind,
  "historical_kpi"
>;

export type MonthlyOperationalKpiFilter = {
  domains?: readonly string[];
  detailTypes?: readonly string[];
  loteIdsAtEvent?: readonly string[];
  animalIds?: readonly string[];
};

export type MonthlyOperationalKpiGroup = {
  count: number;
};

export type MonthlyOperationalKpiSummary = {
  month: string;
  totalEvents: number;
  uniqueAnimalCount: number;
  byDomain: Array<{ domain: string; count: number }>;
  byLote: Array<{ loteId: string; count: number }>;
  byAnimal: Array<{ animalId: string; count: number }>;
};

export type CreateMonthlyOperationalKpisInsightInput = {
  questionKind: InsightQuestionKind;
  question: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  events: readonly MonthlyOperationalKpiEventInput[];
  filters?: MonthlyOperationalKpiFilter;
  primarySource?: string | null;
  groupByLote?: boolean;
  groupByAnimal?: boolean;
};

const PRIMARY_SOURCE = "eventos";
const ALLOWED_QUESTION_KIND: MonthlyOperationalKpiQuestionKind = "historical_kpi";
const DATE_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const MISSING_DOMAIN = "sem_dominio";
const MISSING_LOTE_ID = "sem_lote";

function assertHistoricalQuestionKind(
  questionKind: InsightQuestionKind,
): asserts questionKind is MonthlyOperationalKpiQuestionKind {
  if (questionKind !== ALLOWED_QUESTION_KIND) {
    throw new Error("monthlyOperationalKpis supports only historical_kpi");
  }
}

function assertDateKey(value: string | undefined, fieldName: string): string {
  const trimmed = (value ?? "").trim();
  const match = DATE_KEY_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date or ISO datetime`);
  }

  const dateKey = match[1];
  const [year, month, day] = dateKey.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const parsedKey = [
    parsed.getUTCFullYear(),
    `${parsed.getUTCMonth() + 1}`.padStart(2, "0"),
    `${parsed.getUTCDate()}`.padStart(2, "0"),
  ].join("-");

  if (parsedKey !== dateKey) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date or ISO datetime`);
  }

  return dateKey;
}

function assertMonthlyPeriod(input: {
  periodStart: string;
  periodEnd: string;
}): InsightPeriod & { month: string } {
  const start = assertDateKey(input.periodStart, "periodStart");
  const end = assertDateKey(input.periodEnd, "periodEnd");

  if (end < start) {
    throw new Error("periodEnd must be greater than or equal to periodStart");
  }

  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);

  if (startMonth !== endMonth) {
    throw new Error("monthlyOperationalKpis requires periodStart and periodEnd in the same month");
  }

  return { start, end, month: startMonth };
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

function normalizeFilter(
  filter: MonthlyOperationalKpiFilter | undefined,
): MonthlyOperationalKpiFilter {
  const normalized: MonthlyOperationalKpiFilter = {};
  const domains = normalizeFilterValues(filter?.domains);
  const detailTypes = normalizeFilterValues(filter?.detailTypes);
  const loteIdsAtEvent = normalizeFilterValues(filter?.loteIdsAtEvent);
  const animalIds = normalizeFilterValues(filter?.animalIds);

  if (domains.length > 0) normalized.domains = domains;
  if (detailTypes.length > 0) normalized.detailTypes = detailTypes;
  if (loteIdsAtEvent.length > 0) normalized.loteIdsAtEvent = loteIdsAtEvent;
  if (animalIds.length > 0) normalized.animalIds = animalIds;

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

function isDeleted(event: MonthlyOperationalKpiEventInput): boolean {
  return Boolean(event.deletedAt);
}

function resolvePrimarySource(
  primarySource: string | null | undefined,
): string | null {
  if (primarySource === undefined) {
    return PRIMARY_SOURCE;
  }

  const normalized = primarySource?.trim();
  return normalized ? normalized : null;
}

export function getMonthlyOperationalEventsInPeriod(input: {
  events: readonly MonthlyOperationalKpiEventInput[];
  periodStart: string;
  periodEnd: string;
}): MonthlyOperationalKpiEventInput[] {
  const period = assertMonthlyPeriod(input);

  return input.events.filter((event) => {
    if (isDeleted(event)) {
      return false;
    }

    const occurredDate = assertDateKey(event.occurredAt, "occurredAt");
    return occurredDate >= period.start && occurredDate <= period.end;
  });
}

export function filterMonthlyOperationalKpiEvents(input: {
  events: readonly MonthlyOperationalKpiEventInput[];
  filters?: MonthlyOperationalKpiFilter;
}): MonthlyOperationalKpiEventInput[] {
  const filters = normalizeFilter(input.filters);

  return input.events.filter(
    (event) =>
      matchesFilterValue(event.domain, filters.domains) &&
      matchesFilterValue(event.detailType, filters.detailTypes) &&
      matchesFilterValue(event.loteIdAtEvent, filters.loteIdsAtEvent) &&
      matchesFilterValue(event.animalId, filters.animalIds),
  );
}

export function groupMonthlyOperationalKpisByDomain(
  events: readonly MonthlyOperationalKpiEventInput[],
): Array<{ domain: string; count: number }> {
  const byDomain = new Map<string, number>();

  for (const event of events) {
    incrementCount(byDomain, normalizeString(event.domain) ?? MISSING_DOMAIN);
  }

  return toSortedCountArray(byDomain, "domain");
}

export function groupMonthlyOperationalKpisByLote(
  events: readonly MonthlyOperationalKpiEventInput[],
): Array<{ loteId: string; count: number }> {
  const byLote = new Map<string, number>();

  for (const event of events) {
    incrementCount(byLote, normalizeString(event.loteIdAtEvent) ?? MISSING_LOTE_ID);
  }

  return toSortedCountArray(byLote, "loteId");
}

export function groupMonthlyOperationalKpisByAnimal(
  events: readonly MonthlyOperationalKpiEventInput[],
): Array<{ animalId: string; count: number }> {
  const byAnimal = new Map<string, number>();

  for (const event of events) {
    const animalId = normalizeString(event.animalId);
    if (animalId) {
      incrementCount(byAnimal, animalId);
    }
  }

  return toSortedCountArray(byAnimal, "animalId");
}

function summarizeMonthlyOperationalKpis(input: {
  month: string;
  events: readonly MonthlyOperationalKpiEventInput[];
  groupByLote: boolean;
  groupByAnimal: boolean;
}): MonthlyOperationalKpiSummary {
  const byAnimal = input.groupByAnimal
    ? groupMonthlyOperationalKpisByAnimal(input.events)
    : [];

  return {
    month: input.month,
    totalEvents: input.events.length,
    uniqueAnimalCount: groupMonthlyOperationalKpisByAnimal(input.events).length,
    byDomain: groupMonthlyOperationalKpisByDomain(input.events),
    byLote: input.groupByLote
      ? groupMonthlyOperationalKpisByLote(input.events)
      : [],
    byAnimal,
  };
}

function buildLimitations(input: {
  groupByLote: boolean;
  groupByAnimal: boolean;
}): string[] {
  const limitations = [
    "KPI mensal historico usa eventos factuais ja carregados; agenda nao e fonte primaria de execucao historica.",
    "Eventos deletados nao entram no KPI mensal.",
    "Protocolos configurados nao comprovam execucao e nao entram como fonte primaria.",
    "Nao usa state_animais para inferir historico; agrupamento por lote usa loteIdAtEvent registrado no evento.",
    "Nao calcula carencia, pronto para venda, apto para abate, peso atual confiavel ou IATF pendente amplo.",
  ];

  if (!input.groupByLote) {
    limitations.push("Agrupamento por lote nao foi solicitado nesta saida.");
  }

  if (!input.groupByAnimal) {
    limitations.push("Agrupamento por animal nao foi solicitado nesta saida.");
  }

  return limitations;
}

export function createMonthlyOperationalKpisInsight(
  input: CreateMonthlyOperationalKpisInsightInput,
): OperationalInsight<MonthlyOperationalKpiSummary> {
  assertHistoricalQuestionKind(input.questionKind);
  const period = assertMonthlyPeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const primarySource = resolvePrimarySource(input.primarySource);
  const filters = normalizeFilter(input.filters);

  if (!primarySource) {
    return createBlockedInsight({
      questionKind: input.questionKind,
      question: input.question,
      generatedAt: input.generatedAt,
      period: { start: period.start, end: period.end },
      filters: filters as InsightFilters,
      source: createBlockedSourceContract({
        block: {
          code: "missing_primary_source",
          reason: "KPI historico mensal exige fonte primaria factual de eventos.",
          requiredSources: ["eventos"],
        },
        excludedSources: [
          "agenda",
          "agenda_itens",
          "state_agenda_itens",
          "state_animais",
          "protocolos",
          "tags/marcadores",
        ],
      }),
    });
  }

  const eventsInPeriod = getMonthlyOperationalEventsInPeriod({
    events: input.events,
    periodStart: period.start,
    periodEnd: period.end,
  });
  const events = filterMonthlyOperationalKpiEvents({
    events: eventsInPeriod,
    filters,
  });
  const groupByLote = input.groupByLote ?? true;
  const groupByAnimal = input.groupByAnimal ?? true;
  const summary = summarizeMonthlyOperationalKpis({
    month: period.month,
    events,
    groupByLote,
    groupByAnimal,
  });

  return createAnswerableInsight({
    questionKind: input.questionKind,
    question: input.question,
    generatedAt: input.generatedAt,
    period: { start: period.start, end: period.end },
    filters: filters as InsightFilters,
    source: createAnswerableSourceContract({
      primarySource,
      auxiliarySources: [],
      excludedSources: [
        "agenda",
        "agenda_itens",
        "state_agenda_itens",
        "state_animais",
        "protocolos",
        "tags/marcadores",
      ],
      limitations: buildLimitations({ groupByLote, groupByAnimal }),
      evidenceStatus: "comprovado",
    }),
    resultStatus: summary.totalEvents > 0 ? "complete" : "empty",
    data: summary,
  });
}
