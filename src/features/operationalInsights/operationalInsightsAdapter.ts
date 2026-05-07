import {
  createAgendaNeedsInsight,
  type AgendaNeedItemInput,
} from "@/lib/insights/agendaNeeds";
import {
  createHerdStageSummaryInsight,
  type HerdStageAnimalInput,
  type HerdStageFilter,
  type HerdStageSummary,
} from "@/lib/insights/herdStageSummary";
import {
  createMonthlyOperationalKpisInsight,
  type MonthlyOperationalKpiEventInput,
  type MonthlyOperationalKpiFilter,
  type MonthlyOperationalKpiSummary,
} from "@/lib/insights/monthlyOperationalKpis";
import {
  createSanitarySupplyNeedsInsight,
  type SanitarySupplyAgendaItemInput,
  type SanitarySupplyFilter,
  type SanitarySupplyNeedsSummary,
} from "@/lib/insights/sanitarySupplyNeeds";
import {
  createBlockedInsight,
  createBlockedSourceContract,
  isAnswerableInsight,
  isBlockedInsight,
} from "@/lib/insights/sourceContract";
import {
  createOperationalSignalsFromInsights,
  type OperationalSignal,
} from "@/lib/insights/tagSignals";
import type {
  InsightBlock,
  InsightFilters,
  InsightPeriod,
  InsightQuestionKind,
  InsightResultStatus,
  OperationalInsight,
} from "@/lib/insights/types";

export type OperationalInsightsAgendaRow = {
  id: string;
  status?: string | null;
  data_prevista?: string | null;
  dueDate?: string | null;
  deleted_at?: string | null;
  deletedAt?: string | null;
  dominio?: string | null;
  domain?: string | null;
  tipo?: string | null;
  title?: string | null;
  animal_id?: string | null;
  animalId?: string | null;
  lote_id?: string | null;
  loteId?: string | null;
  source_ref?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  protocol_item_version_id?: string | null;
  protocolItemVersionId?: string | null;
  protocolId?: string | null;
  protocolItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  productUnit?: string | null;
  quantityPerAnimal?: number | null;
  animalCount?: number | null;
};

export type OperationalInsightsAnimalRow = {
  id: string;
  status?: string | null;
  deleted_at?: string | null;
  deletedAt?: string | null;
  lote_id?: string | null;
  loteId?: string | null;
  sexo?: string | null;
  stage?: string | null;
  estagio?: string | null;
  estagio_vida?: string | null;
  category?: string | null;
  categoria?: string | null;
  reproductiveStatus?: string | null;
  reproductive_status?: string | null;
  payload?: Record<string, unknown> | null;
};

export type OperationalInsightsEventRow = {
  id: string;
  dominio?: string | null;
  domain?: string | null;
  occurred_at?: string | null;
  occurredAt?: string | null;
  occurred_on?: string | null;
  occurredOn?: string | null;
  animal_id?: string | null;
  animalId?: string | null;
  lote_id?: string | null;
  loteId?: string | null;
  lote_id_at_event?: string | null;
  loteIdAtEvent?: string | null;
  detail_type?: string | null;
  detailType?: string | null;
  tipo?: string | null;
  status?: string | null;
  deleted_at?: string | null;
  deletedAt?: string | null;
  payload?: Record<string, unknown> | null;
};

export type OperationalInsightsProtocolItemRow = {
  id: string;
  protocolo_id?: string | null;
  protocolId?: string | null;
  protocol_item_id?: string | null;
  protocolItemId?: string | null;
  produto?: string | null;
  productName?: string | null;
  productUnit?: string | null;
  payload?: Record<string, unknown> | null;
};

export type OperationalInsightsLoadedSources = {
  agendaItems?: readonly OperationalInsightsAgendaRow[] | null;
  animals?: readonly OperationalInsightsAnimalRow[] | null;
  events?: readonly OperationalInsightsEventRow[] | null;
  protocolItems?: readonly OperationalInsightsProtocolItemRow[] | null;
};

export type OperationalInsightsFilters = {
  agenda?: InsightFilters;
  sanitarySupply?: SanitarySupplyFilter;
  herdStage?: HerdStageFilter;
  monthlyOperationalKpis?: MonthlyOperationalKpiFilter;
};

export type BuildOperationalInsightsInput = {
  generatedAt: string;
  referenceDate: string;
  monthlyPeriod: InsightPeriod;
  sources: OperationalInsightsLoadedSources;
  upcomingDays?: number;
  filters?: OperationalInsightsFilters;
  requireSanitaryProductSource?: boolean;
  monthlyEventsPrimarySource?: string | null;
  groupMonthlyKpisByLote?: boolean;
  groupMonthlyKpisByAnimal?: boolean;
};

export type OperationalInsightCardId =
  | "agendaNeeds.allOpen"
  | "agendaNeeds.dueToday"
  | "agendaNeeds.overdue"
  | "agendaNeeds.dueWithinDays"
  | "sanitarySupplyNeeds"
  | "herdStageSummary"
  | "monthlyOperationalKpis";

export type OperationalInsightCard<T> = {
  id: OperationalInsightCardId;
  title: string;
  insight: OperationalInsight<T>;
};

export type OperationalInsightResultStatus = InsightResultStatus | "blocked";

export type OperationalInsightSourceSummary = {
  id: OperationalInsightCardId;
  title: string;
  answerability: "answerable" | "blocked";
  resultStatus: OperationalInsightResultStatus;
  primarySource: string | null;
  limitations: readonly string[];
  block?: InsightBlock;
};

export type OperationalSignalsView = {
  id: "tagSignals";
  title: string;
  generatedAt: string;
  resultStatus: InsightResultStatus;
  signals: OperationalSignal[];
  sourceInsightIds: OperationalInsightCardId[];
  skippedBlockedInsightIds: OperationalInsightCardId[];
  sourceSummaries: OperationalInsightSourceSummary[];
  limitations: readonly string[];
};

export type OperationalInsightsViewModel = {
  generatedAt: string;
  referenceDate: string;
  upcomingDays: number;
  monthlyPeriod: InsightPeriod;
  agendaNeeds: {
    allOpen: OperationalInsightCard<AgendaNeedItemInput[]>;
    dueToday: OperationalInsightCard<AgendaNeedItemInput[]>;
    overdue: OperationalInsightCard<AgendaNeedItemInput[]>;
    dueWithinDays: OperationalInsightCard<AgendaNeedItemInput[]>;
  };
  sanitarySupplyNeeds: OperationalInsightCard<SanitarySupplyNeedsSummary>;
  herdStageSummary: OperationalInsightCard<HerdStageSummary>;
  monthlyOperationalKpis: OperationalInsightCard<MonthlyOperationalKpiSummary>;
  tagSignals: OperationalSignalsView;
  sections: OperationalInsightCard<unknown>[];
};

type NormalizedAgendaInsightItem =
  AgendaNeedItemInput &
  SanitarySupplyAgendaItemInput;

type ProtocolItemIndexes = {
  byId: Map<string, OperationalInsightsProtocolItemRow>;
  byProtocolItemId: Map<string, OperationalInsightsProtocolItemRow>;
};

const DEFAULT_UPCOMING_DAYS = 7;

function isLoaded<T>(value: readonly T[] | null | undefined): value is readonly T[] {
  return value !== null && value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(
  source: Record<string, unknown> | null | undefined,
  ...keys: readonly string[]
): string | null {
  if (!source) return null;

  for (const key of keys) {
    const normalized = normalizeString(source[key]);
    if (normalized) return normalized;
  }

  return null;
}

function readNumber(
  source: Record<string, unknown> | null | undefined,
  ...keys: readonly string[]
): number | null {
  if (!source) return null;

  for (const key of keys) {
    const normalized = normalizeNumber(source[key]);
    if (normalized !== null) return normalized;
  }

  return null;
}

function readNestedRecord(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  return asRecord(source?.[key]);
}

function normalizeFilter(filters: InsightFilters | undefined): InsightFilters {
  return filters ?? {};
}

function buildProtocolItemIndexes(
  protocolItems: readonly OperationalInsightsProtocolItemRow[] | null | undefined,
): ProtocolItemIndexes {
  const byId = new Map<string, OperationalInsightsProtocolItemRow>();
  const byProtocolItemId = new Map<string, OperationalInsightsProtocolItemRow>();

  for (const item of protocolItems ?? []) {
    const id = normalizeString(item.id);
    const protocolItemId =
      normalizeString(item.protocol_item_id) ?? normalizeString(item.protocolItemId);

    if (id) byId.set(id, item);
    if (protocolItemId) byProtocolItemId.set(protocolItemId, item);
  }

  return { byId, byProtocolItemId };
}

function resolveProtocolItem(
  item: OperationalInsightsAgendaRow,
  indexes: ProtocolItemIndexes,
): OperationalInsightsProtocolItemRow | null {
  const sourceRef = asRecord(item.source_ref);
  const versionId =
    normalizeString(item.protocol_item_version_id) ??
    normalizeString(item.protocolItemVersionId);
  const sourceProtocolItemId =
    normalizeString(item.protocolItemId) ??
    readString(sourceRef, "protocolo_item_id", "protocol_item_id", "protocolItemId");

  if (versionId && indexes.byId.has(versionId)) {
    return indexes.byId.get(versionId) ?? null;
  }

  if (sourceProtocolItemId && indexes.byProtocolItemId.has(sourceProtocolItemId)) {
    return indexes.byProtocolItemId.get(sourceProtocolItemId) ?? null;
  }

  return null;
}

function normalizeAgendaItems(input: {
  items: readonly OperationalInsightsAgendaRow[];
  protocolItems?: readonly OperationalInsightsProtocolItemRow[] | null;
}): NormalizedAgendaInsightItem[] {
  const protocolIndexes = buildProtocolItemIndexes(input.protocolItems);

  return input.items.map((item) => {
    const sourceRef = asRecord(item.source_ref);
    const payload = asRecord(item.payload);
    const protocolItem = resolveProtocolItem(item, protocolIndexes);
    const protocolItemPayload = asRecord(protocolItem?.payload);
    const protocolId =
      normalizeString(item.protocolId) ??
      readString(sourceRef, "protocolo_id", "protocol_id", "protocolId") ??
      normalizeString(protocolItem?.protocolo_id) ??
      normalizeString(protocolItem?.protocolId);
    const protocolItemId =
      normalizeString(item.protocolItemId) ??
      readString(sourceRef, "protocolo_item_id", "protocol_item_id", "protocolItemId") ??
      normalizeString(protocolItem?.protocol_item_id) ??
      normalizeString(protocolItem?.protocolItemId) ??
      normalizeString(item.protocol_item_version_id) ??
      normalizeString(item.protocolItemVersionId);
    const productId =
      normalizeString(item.productId) ??
      readString(
        sourceRef,
        "produto_veterinario_id",
        "product_id",
        "productId",
      ) ??
      readString(payload, "produto_veterinario_id", "product_id", "productId");
    const productName =
      normalizeString(item.productName) ??
      readString(
        sourceRef,
        "produto",
        "produto_nome_catalogo",
        "product_name",
        "productName",
      ) ??
      readString(
        payload,
        "produto",
        "produto_nome_catalogo",
        "product_name",
        "productName",
      ) ??
      normalizeString(protocolItem?.produto) ??
      normalizeString(protocolItem?.productName);
    const productUnit =
      normalizeString(item.productUnit) ??
      readString(sourceRef, "produto_unidade", "product_unit", "productUnit") ??
      readString(payload, "produto_unidade", "product_unit", "productUnit") ??
      readString(protocolItemPayload, "produto_unidade", "product_unit", "productUnit");

    return {
      id: item.id,
      status: normalizeString(item.status) ?? "",
      dueDate: normalizeString(item.dueDate) ?? normalizeString(item.data_prevista) ?? "",
      deletedAt: normalizeString(item.deletedAt) ?? normalizeString(item.deleted_at),
      animalId: normalizeString(item.animalId) ?? normalizeString(item.animal_id),
      loteId: normalizeString(item.loteId) ?? normalizeString(item.lote_id),
      domain: normalizeString(item.domain) ?? normalizeString(item.dominio),
      protocolId,
      protocolItemId,
      productId,
      productName,
      productUnit,
      quantityPerAnimal:
        normalizeNumber(item.quantityPerAnimal) ??
        readNumber(
          sourceRef,
          "quantityPerAnimal",
          "quantity_per_animal",
          "quantidade_por_animal",
          "dose_quantidade",
        ) ??
        readNumber(
          payload,
          "quantityPerAnimal",
          "quantity_per_animal",
          "quantidade_por_animal",
          "dose_quantidade",
        ),
      animalCount:
        normalizeNumber(item.animalCount) ??
        readNumber(sourceRef, "animalCount", "animal_count", "quantidade_animais") ??
        readNumber(payload, "animalCount", "animal_count", "quantidade_animais"),
      title:
        normalizeString(item.title) ??
        normalizeString(item.tipo) ??
        productName,
    };
  });
}

function normalizeAnimals(
  animals: readonly OperationalInsightsAnimalRow[],
): HerdStageAnimalInput[] {
  return animals.map((animal) => {
    const payload = asRecord(animal.payload);
    const taxonomyFacts = readNestedRecord(payload, "taxonomy_facts");
    const lifecycle = readNestedRecord(payload, "lifecycle");
    const stage =
      normalizeString(animal.stage) ??
      normalizeString(animal.estagio) ??
      normalizeString(animal.estagio_vida) ??
      readString(lifecycle, "estagio_vida", "stage") ??
      readString(taxonomyFacts, "categoria_zootecnica", "category");
    const category =
      normalizeString(animal.category) ??
      normalizeString(animal.categoria) ??
      readString(taxonomyFacts, "categoria_zootecnica", "category") ??
      readString(payload, "categoria_produtiva", "categoria", "category");
    const reproductiveStatus =
      normalizeString(animal.reproductiveStatus) ??
      normalizeString(animal.reproductive_status) ??
      readString(
        taxonomyFacts,
        "estado_produtivo_reprodutivo",
        "reproductive_status",
        "reproductiveStatus",
      ) ??
      readString(payload, "status_reprodutivo", "reproductive_status");

    return {
      id: animal.id,
      status: normalizeString(animal.status),
      deletedAt: normalizeString(animal.deletedAt) ?? normalizeString(animal.deleted_at),
      loteId: normalizeString(animal.loteId) ?? normalizeString(animal.lote_id),
      sexo: normalizeString(animal.sexo),
      stage,
      category,
      reproductiveStatus,
    };
  });
}

function normalizeEvents(
  events: readonly OperationalInsightsEventRow[],
): MonthlyOperationalKpiEventInput[] {
  return events.map((event) => {
    const payload = asRecord(event.payload);

    return {
      id: event.id,
      domain: normalizeString(event.domain) ?? normalizeString(event.dominio) ?? "",
      occurredAt:
        normalizeString(event.occurredAt) ??
        normalizeString(event.occurred_at) ??
        normalizeString(event.occurredOn) ??
        normalizeString(event.occurred_on) ??
        "",
      animalId: normalizeString(event.animalId) ?? normalizeString(event.animal_id),
      loteIdAtEvent:
        normalizeString(event.loteIdAtEvent) ??
        normalizeString(event.lote_id_at_event) ??
        normalizeString(event.loteId) ??
        normalizeString(event.lote_id),
      detailType:
        normalizeString(event.detailType) ??
        normalizeString(event.detail_type) ??
        normalizeString(event.tipo) ??
        readString(payload, "detail_type", "tipo"),
      status: normalizeString(event.status),
      deletedAt: normalizeString(event.deletedAt) ?? normalizeString(event.deleted_at),
    };
  });
}

function createMissingSourceInsight<T>(input: {
  questionKind: InsightQuestionKind;
  question: string;
  generatedAt: string;
  filters?: InsightFilters;
  period?: InsightPeriod;
  requiredSources: readonly string[];
  reason: string;
  excludedSources: readonly string[];
  limitations?: readonly string[];
}): OperationalInsight<T> {
  return createBlockedInsight({
    questionKind: input.questionKind,
    question: input.question,
    generatedAt: input.generatedAt,
    filters: normalizeFilter(input.filters),
    period: input.period,
    source: createBlockedSourceContract({
      block: {
        code: "missing_primary_source",
        reason: input.reason,
        requiredSources: input.requiredSources,
      },
      excludedSources: input.excludedSources,
      limitations: input.limitations,
      evidenceStatus: "bloqueado",
    }),
  }) as OperationalInsight<T>;
}

function createCard<T>(
  id: OperationalInsightCardId,
  title: string,
  insight: OperationalInsight<T>,
): OperationalInsightCard<T> {
  return { id, title, insight };
}

function summarizeSource<T>(
  card: OperationalInsightCard<T>,
): OperationalInsightSourceSummary {
  const { source } = card.insight;

  return {
    id: card.id,
    title: card.title,
    answerability: card.insight.answerability,
    resultStatus: card.insight.resultStatus,
    primarySource: source.primarySource,
    limitations: source.limitations,
    block: source.answerability === "blocked" ? source.block : undefined,
  };
}

function toUnknownCard<T>(
  card: OperationalInsightCard<T>,
): OperationalInsightCard<unknown> {
  return card as OperationalInsightCard<unknown>;
}

function uniqueStrings(values: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) normalized.add(trimmed);
  }

  return Array.from(normalized);
}

function buildTagSignalsView(input: {
  generatedAt: string;
  sourceCards: readonly OperationalInsightCard<unknown>[];
}): OperationalSignalsView {
  const answerableInsights: OperationalInsight<unknown>[] = [];
  const sourceInsightIds: OperationalInsightCardId[] = [];
  const skippedBlockedInsightIds: OperationalInsightCardId[] = [];

  for (const card of input.sourceCards) {
    if (isBlockedInsight(card.insight)) {
      skippedBlockedInsightIds.push(card.id);
      continue;
    }

    if (isAnswerableInsight(card.insight)) {
      answerableInsights.push(card.insight);
      sourceInsightIds.push(card.id);
    }
  }

  const signals =
    answerableInsights.length > 0
      ? createOperationalSignalsFromInsights(answerableInsights)
      : [];
  const limitations = uniqueStrings([
    ...signals.flatMap((signal) => signal.limitations),
    "Sinais operacionais sao derivados apenas de insights answerable e nao persistem tags ou marcadores.",
    "Insights bloqueados permanecem em sourceSummaries e nao emitem sinais.",
  ]);
  const resultStatus: InsightResultStatus =
    signals.length > 0
      ? skippedBlockedInsightIds.length > 0
        ? "partial"
        : "complete"
      : skippedBlockedInsightIds.length > 0
        ? "partial"
        : "empty";

  return {
    id: "tagSignals",
    title: "Sinais operacionais auxiliares",
    generatedAt: input.generatedAt,
    resultStatus,
    signals,
    sourceInsightIds,
    skippedBlockedInsightIds,
    sourceSummaries: input.sourceCards.map(summarizeSource),
    limitations,
  };
}

export function buildOperationalInsights(
  input: BuildOperationalInsightsInput,
): OperationalInsightsViewModel {
  const upcomingDays = input.upcomingDays ?? DEFAULT_UPCOMING_DAYS;
  const agendaItems = isLoaded(input.sources.agendaItems)
    ? normalizeAgendaItems({
        items: input.sources.agendaItems,
        protocolItems: input.sources.protocolItems,
      })
    : null;
  const animals = isLoaded(input.sources.animals)
    ? normalizeAnimals(input.sources.animals)
    : null;
  const events = isLoaded(input.sources.events)
    ? normalizeEvents(input.sources.events)
    : null;
  const agendaFilters = normalizeFilter(input.filters?.agenda);

  const allOpenAgendaInsight = agendaItems
    ? createAgendaNeedsInsight({
        questionKind: "current_pending",
        scope: "all_open",
        question: "O que esta pendente agora?",
        generatedAt: input.generatedAt,
        items: agendaItems,
        filters: agendaFilters,
      })
    : createMissingSourceInsight<AgendaNeedItemInput[]>({
        questionKind: "current_pending",
        question: "O que esta pendente agora?",
        generatedAt: input.generatedAt,
        filters: agendaFilters,
        requiredSources: ["state_agenda_itens"],
        reason: "Pendencias atuais exigem agenda aberta ja carregada.",
        excludedSources: ["eventos", "protocolos_isolados", "tags/marcadores"],
        limitations: [
          "Sem state_agenda_itens carregado, a Central Operacional nao deve inferir pendencia por evento, protocolo ou tag.",
        ],
      });

  const dueTodayAgendaInsight = agendaItems
    ? createAgendaNeedsInsight({
        questionKind: "current_pending",
        scope: "due_today",
        question: "Quais agendas vencem hoje?",
        generatedAt: input.generatedAt,
        referenceDate: input.referenceDate,
        items: agendaItems,
        filters: agendaFilters,
      })
    : createMissingSourceInsight<AgendaNeedItemInput[]>({
        questionKind: "current_pending",
        question: "Quais agendas vencem hoje?",
        generatedAt: input.generatedAt,
        filters: agendaFilters,
        requiredSources: ["state_agenda_itens"],
        reason: "Agendas vencendo hoje exigem agenda aberta ja carregada.",
        excludedSources: ["eventos", "protocolos_isolados", "tags/marcadores"],
      });

  const overdueAgendaInsight = agendaItems
    ? createAgendaNeedsInsight({
        questionKind: "current_pending",
        scope: "overdue",
        question: "Quais agendas estao atrasadas?",
        generatedAt: input.generatedAt,
        referenceDate: input.referenceDate,
        items: agendaItems,
        filters: agendaFilters,
      })
    : createMissingSourceInsight<AgendaNeedItemInput[]>({
        questionKind: "current_pending",
        question: "Quais agendas estao atrasadas?",
        generatedAt: input.generatedAt,
        filters: agendaFilters,
        requiredSources: ["state_agenda_itens"],
        reason: "Agendas atrasadas exigem agenda aberta ja carregada.",
        excludedSources: ["eventos", "protocolos_isolados", "tags/marcadores"],
      });

  const dueWithinDaysAgendaInsight = agendaItems
    ? createAgendaNeedsInsight({
        questionKind: "future_need",
        scope: "due_within_days",
        question: `O que vence nos proximos ${upcomingDays} dias?`,
        generatedAt: input.generatedAt,
        referenceDate: input.referenceDate,
        days: upcomingDays,
        items: agendaItems,
        filters: agendaFilters,
      })
    : createMissingSourceInsight<AgendaNeedItemInput[]>({
        questionKind: "future_need",
        question: `O que vence nos proximos ${upcomingDays} dias?`,
        generatedAt: input.generatedAt,
        filters: agendaFilters,
        requiredSources: ["state_agenda_itens"],
        reason: "Necessidades futuras exigem agenda materializada ja carregada.",
        excludedSources: ["eventos", "protocolos_isolados", "tags/marcadores"],
      });

  const sanitarySupplyInsight = agendaItems
    ? createSanitarySupplyNeedsInsight({
        questionKind: "future_need",
        question: `Quais insumos sanitarios vencem nos proximos ${upcomingDays} dias?`,
        generatedAt: input.generatedAt,
        scope: "due_within_days",
        referenceDate: input.referenceDate,
        days: upcomingDays,
        items: agendaItems,
        filters: input.filters?.sanitarySupply,
        requireProductSource: input.requireSanitaryProductSource ?? true,
      })
    : createMissingSourceInsight<SanitarySupplyNeedsSummary>({
        questionKind: "future_need",
        question: `Quais insumos sanitarios vencem nos proximos ${upcomingDays} dias?`,
        generatedAt: input.generatedAt,
        filters: input.filters?.sanitarySupply as InsightFilters | undefined,
        requiredSources: [
          "state_agenda_itens",
          "produto identificado em agenda sanitaria materializada",
        ],
        reason: "Necessidade de insumo sanitario exige agenda sanitaria ja carregada.",
        excludedSources: ["eventos", "agenda_concluida", "protocolos_isolados", "tags/marcadores"],
        limitations: [
          "O adapter nao infere produto por evento, protocolo isolado ou historico.",
        ],
      });

  const herdStageInsight = animals
    ? createHerdStageSummaryInsight({
        questionKind: "current_state",
        question: "Resumo atual do rebanho por estagio",
        generatedAt: input.generatedAt,
        animals,
        filters: input.filters?.herdStage,
      })
    : createMissingSourceInsight<HerdStageSummary>({
        questionKind: "current_state",
        question: "Resumo atual do rebanho por estagio",
        generatedAt: input.generatedAt,
        filters: input.filters?.herdStage as InsightFilters | undefined,
        requiredSources: ["state_animais"],
        reason: "Resumo por estagio exige state_animais ou read model atual ja carregado.",
        excludedSources: ["eventos", "agenda", "protocolos", "tags/marcadores"],
        limitations: [
          "Sem state_animais carregado, a Central Operacional nao deve inferir estagio por agenda, evento, peso ou tag.",
        ],
      });

  const monthlyKpisInsight = events
    ? createMonthlyOperationalKpisInsight({
        questionKind: "historical_kpi",
        question: "KPIs operacionais mensais",
        generatedAt: input.generatedAt,
        periodStart: input.monthlyPeriod.start,
        periodEnd: input.monthlyPeriod.end,
        events,
        filters: input.filters?.monthlyOperationalKpis,
        primarySource: input.monthlyEventsPrimarySource,
        groupByLote: input.groupMonthlyKpisByLote,
        groupByAnimal: input.groupMonthlyKpisByAnimal,
      })
    : createMissingSourceInsight<MonthlyOperationalKpiSummary>({
        questionKind: "historical_kpi",
        question: "KPIs operacionais mensais",
        generatedAt: input.generatedAt,
        period: input.monthlyPeriod,
        filters: input.filters?.monthlyOperationalKpis as InsightFilters | undefined,
        requiredSources: ["eventos"],
        reason: "KPI mensal historico exige eventos factuais ja carregados no periodo.",
        excludedSources: [
          "agenda",
          "state_agenda_itens",
          "state_animais",
          "protocolos",
          "tags/marcadores",
        ],
        limitations: [
          "Agenda nao comprova execucao historica; protocolo configurado nao comprova evento.",
        ],
      });

  const agendaNeeds = {
    allOpen: createCard(
      "agendaNeeds.allOpen",
      "Pendencias abertas",
      allOpenAgendaInsight,
    ),
    dueToday: createCard(
      "agendaNeeds.dueToday",
      "Vencendo hoje",
      dueTodayAgendaInsight,
    ),
    overdue: createCard(
      "agendaNeeds.overdue",
      "Atrasadas",
      overdueAgendaInsight,
    ),
    dueWithinDays: createCard(
      "agendaNeeds.dueWithinDays",
      `Proximos ${upcomingDays} dias`,
      dueWithinDaysAgendaInsight,
    ),
  };
  const sanitarySupplyNeeds = createCard(
    "sanitarySupplyNeeds",
    "Pendencias sanitarias",
    sanitarySupplyInsight,
  );
  const herdStageSummary = createCard(
    "herdStageSummary",
    "Resumo por estagio",
    herdStageInsight,
  );
  const monthlyOperationalKpis = createCard(
    "monthlyOperationalKpis",
    "KPIs mensais",
    monthlyKpisInsight,
  );
  const sections = [
    agendaNeeds.allOpen,
    agendaNeeds.overdue,
    agendaNeeds.dueToday,
    agendaNeeds.dueWithinDays,
    sanitarySupplyNeeds,
    herdStageSummary,
    monthlyOperationalKpis,
  ].map(toUnknownCard);

  return {
    generatedAt: input.generatedAt,
    referenceDate: input.referenceDate,
    upcomingDays,
    monthlyPeriod: input.monthlyPeriod,
    agendaNeeds,
    sanitarySupplyNeeds,
    herdStageSummary,
    monthlyOperationalKpis,
    tagSignals: buildTagSignalsView({
      generatedAt: input.generatedAt,
      sourceCards: [
        toUnknownCard(agendaNeeds.allOpen),
        toUnknownCard(agendaNeeds.dueToday),
        toUnknownCard(agendaNeeds.overdue),
        toUnknownCard(herdStageSummary),
      ],
    }),
    sections,
  };
}
