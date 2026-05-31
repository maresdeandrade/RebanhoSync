import {
  createAnswerableInsight,
  createAnswerableSourceContract,
} from "@/lib/insights/sourceContract";
import type {
  InsightFilters,
  InsightPeriod,
  InsightQuestionKind,
  OperationalInsight,
} from "@/lib/insights/types";

export type HistoricalActivityEventInput = {
  id: string;
  domain: string;
  occurredAt: string;
  animalId?: string | null;
  loteIdAtEvent?: string | null;
  currentLoteId?: string | null;
  detailType?: string | null;
  protocolId?: string | null;
  protocolItemVersionId?: string | null;
  productId?: string | null;
  productName?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  deletedAt?: string | null;
};

export type HistoricalActivityQuestionKind = Extract<
  InsightQuestionKind,
  "historical_kpi"
>;

export type HistoricalActivityFilter = {
  domains?: readonly string[];
  detailTypes?: readonly string[];
  animalIds?: readonly string[];
  loteIdsAtEvent?: readonly string[];
  productIds?: readonly string[];
  protocolIds?: readonly string[];
};

export type HistoricalActivityDomainGroup = {
  domain: string;
  count: number;
};

export type HistoricalActivityLoteGroup = {
  loteId: string;
  count: number;
  source: "event" | "current_state" | "missing";
};

export type HistoricalActivityAnimalGroup = {
  animalId: string;
  count: number;
};

export type HistoricalActivitySummary = {
  totalEvents: number;
  uniqueAnimalCount: number;
  byDomain: HistoricalActivityDomainGroup[];
  byLote: HistoricalActivityLoteGroup[];
  byAnimal: HistoricalActivityAnimalGroup[];
};

export type CreateHistoricalActivityInsightInput = {
  questionKind: InsightQuestionKind;
  question: string;
  generatedAt: string;
  period: InsightPeriod;
  events: readonly HistoricalActivityEventInput[];
  filters?: HistoricalActivityFilter;
  primarySource?: string;
};

const PRIMARY_SOURCE = "eventos";
const ALLOWED_QUESTION_KIND: HistoricalActivityQuestionKind = "historical_kpi";
const DATE_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const MISSING_LOTE_ID = "sem_lote";

function assertHistoricalQuestionKind(
  questionKind: InsightQuestionKind,
): asserts questionKind is HistoricalActivityQuestionKind {
  if (questionKind !== ALLOWED_QUESTION_KIND) {
    throw new Error("historicalActivitySummary supports only historical_kpi");
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

function assertPeriod(period: InsightPeriod | undefined): InsightPeriod {
  if (!period) {
    throw new Error("historical_kpi requires period.start and period.end");
  }

  const start = assertDateKey(period.start, "period.start");
  const end = assertDateKey(period.end, "period.end");

  if (end < start) {
    throw new Error("period.end must be greater than or equal to period.start");
  }

  return { start, end };
}

function isDeleted(event: HistoricalActivityEventInput): boolean {
  return Boolean(event.deletedAt);
}

function normalizeGroupKey(value: string | null | undefined): string | null {
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

function normalizeHistoricalActivityFilter(
  filter: HistoricalActivityFilter | undefined,
): HistoricalActivityFilter {
  const normalized: HistoricalActivityFilter = {};
  const domains = normalizeFilterValues(filter?.domains);
  const detailTypes = normalizeFilterValues(filter?.detailTypes);
  const animalIds = normalizeFilterValues(filter?.animalIds);
  const loteIdsAtEvent = normalizeFilterValues(filter?.loteIdsAtEvent);
  const productIds = normalizeFilterValues(filter?.productIds);
  const protocolIds = normalizeFilterValues(filter?.protocolIds);

  if (domains.length > 0) normalized.domains = domains;
  if (detailTypes.length > 0) normalized.detailTypes = detailTypes;
  if (animalIds.length > 0) normalized.animalIds = animalIds;
  if (loteIdsAtEvent.length > 0) normalized.loteIdsAtEvent = loteIdsAtEvent;
  if (productIds.length > 0) normalized.productIds = productIds;
  if (protocolIds.length > 0) normalized.protocolIds = protocolIds;

  return normalized;
}

function matchesFilterValue(
  value: string | null | undefined,
  allowedValues: readonly string[] | undefined,
): boolean {
  if (!allowedValues || allowedValues.length === 0) {
    return true;
  }

  const normalized = normalizeGroupKey(value);
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

export function getHistoricalEventsInPeriod(input: {
  events: readonly HistoricalActivityEventInput[];
  period: InsightPeriod;
}): HistoricalActivityEventInput[] {
  const period = assertPeriod(input.period);

  return input.events.filter((event) => {
    if (isDeleted(event)) {
      return false;
    }

    const occurredDate = assertDateKey(event.occurredAt, "occurredAt");
    return occurredDate >= period.start && occurredDate <= period.end;
  });
}

export function filterHistoricalActivityEvents(input: {
  events: readonly HistoricalActivityEventInput[];
  filters?: HistoricalActivityFilter;
}): HistoricalActivityEventInput[] {
  const filters = normalizeHistoricalActivityFilter(input.filters);

  return input.events.filter(
    (event) =>
      matchesFilterValue(event.domain, filters.domains) &&
      matchesFilterValue(event.detailType, filters.detailTypes) &&
      matchesFilterValue(event.animalId, filters.animalIds) &&
      matchesFilterValue(event.loteIdAtEvent, filters.loteIdsAtEvent) &&
      matchesFilterValue(event.productId, filters.productIds) &&
      matchesFilterValue(event.protocolId, filters.protocolIds),
  );
}

export function groupHistoricalEventsByDomain(
  events: readonly HistoricalActivityEventInput[],
): HistoricalActivityDomainGroup[] {
  const byDomain = new Map<string, number>();

  for (const event of events) {
    const domain = normalizeGroupKey(event.domain) ?? "sem_dominio";
    incrementCount(byDomain, domain);
  }

  return toSortedCountArray(byDomain, "domain");
}

export function groupHistoricalEventsByLote(
  events: readonly HistoricalActivityEventInput[],
): HistoricalActivityLoteGroup[] {
  const byLote = new Map<string, HistoricalActivityLoteGroup>();

  for (const event of events) {
    const loteIdAtEvent = normalizeGroupKey(event.loteIdAtEvent);
    const currentLoteId = normalizeGroupKey(event.currentLoteId);
    const loteId = loteIdAtEvent ?? currentLoteId ?? MISSING_LOTE_ID;

    const source = loteIdAtEvent ? "event" : currentLoteId ? "current_state" : "missing";
    const existing = byLote.get(loteId);

    if (existing) {
      existing.count += 1;
      if (source === "current_state") {
        existing.source = "current_state";
      }
      if (source === "missing" && existing.source === "event") {
        existing.source = "missing";
      }
      continue;
    }

    byLote.set(loteId, {
      loteId,
      count: 1,
      source,
    });
  }

  return Array.from(byLote.values()).sort((left, right) =>
    left.loteId.localeCompare(right.loteId),
  );
}

export function groupHistoricalEventsByAnimal(
  events: readonly HistoricalActivityEventInput[],
): HistoricalActivityAnimalGroup[] {
  const byAnimal = new Map<string, number>();

  for (const event of events) {
    const animalId = normalizeGroupKey(event.animalId);

    if (animalId) {
      incrementCount(byAnimal, animalId);
    }
  }

  return toSortedCountArray(byAnimal, "animalId");
}

function summarizeHistoricalActivity(
  events: readonly HistoricalActivityEventInput[],
): HistoricalActivitySummary {
  return {
    totalEvents: events.length,
    uniqueAnimalCount: groupHistoricalEventsByAnimal(events).length,
    byDomain: groupHistoricalEventsByDomain(events),
    byLote: groupHistoricalEventsByLote(events),
    byAnimal: groupHistoricalEventsByAnimal(events),
  };
}

function usesCurrentLoteFallback(summary: HistoricalActivitySummary): boolean {
  return summary.byLote.some((lote) => lote.source === "current_state");
}

function hasMissingLote(summary: HistoricalActivitySummary): boolean {
  return summary.byLote.some((lote) => lote.source === "missing");
}

function buildAuxiliarySources(usesCurrentStateFallback: boolean): string[] {
  return usesCurrentStateFallback ? ["state_animais", "state_lotes"] : [];
}

function buildLimitations(input: {
  usesCurrentStateFallback: boolean;
  includesMissingLote: boolean;
}): string[] {
  const limitations = [
    "KPI historico usa eventos factuais; agenda nao e fonte primaria de execucao historica.",
    "Eventos deletados nao entram no resumo historico.",
  ];

  if (input.usesCurrentStateFallback) {
    limitations.push(
      "Agrupamento por lote usou currentLoteId como fallback para eventos sem loteIdAtEvent; isso representa estado atual, nao snapshot historico do evento.",
    );
  }

  if (input.includesMissingLote) {
    limitations.push(
      "Eventos sem loteIdAtEvent e sem currentLoteId sao agrupados em sem_lote para nao serem omitidos do KPI por lote.",
    );
  }

  return limitations;
}

export function createHistoricalActivityInsight(
  input: CreateHistoricalActivityInsightInput,
): OperationalInsight<HistoricalActivitySummary> {
  assertHistoricalQuestionKind(input.questionKind);
  const period = assertPeriod(input.period);
  const filters = normalizeHistoricalActivityFilter(input.filters);
  const eventsInPeriod = getHistoricalEventsInPeriod({
    events: input.events,
    period,
  });
  const events = filterHistoricalActivityEvents({
    events: eventsInPeriod,
    filters,
  });
  const summary = summarizeHistoricalActivity(events);
  const hasCurrentStateFallback = usesCurrentLoteFallback(summary);
  const includesMissingLote = hasMissingLote(summary);

  return createAnswerableInsight({
    questionKind: input.questionKind,
    question: input.question,
    generatedAt: input.generatedAt,
    period,
    filters: filters as InsightFilters,
    source: createAnswerableSourceContract({
      primarySource: input.primarySource ?? PRIMARY_SOURCE,
      auxiliarySources: buildAuxiliarySources(hasCurrentStateFallback),
      excludedSources: ["agenda", "agenda_itens", "state_agenda_itens", "tags/marcadores"],
      limitations: buildLimitations({
        usesCurrentStateFallback: hasCurrentStateFallback,
        includesMissingLote,
      }),
      evidenceStatus: hasCurrentStateFallback ? "depende_validacao" : "comprovado",
    }),
    resultStatus:
      summary.totalEvents === 0
        ? "empty"
        : hasCurrentStateFallback
          ? "partial"
          : "complete",
    partialReason: hasCurrentStateFallback
      ? "Agrupamento por lote dependeu de currentLoteId para eventos sem lote historico no evento."
      : undefined,
    data: summary,
  });
}
