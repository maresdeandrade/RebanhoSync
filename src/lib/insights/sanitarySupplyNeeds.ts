import {
  getAgendaNeedsDueToday,
  getAgendaNeedsDueWithinDays,
  getOpenAgendaNeeds,
  getOverdueAgendaNeeds,
  type AgendaNeedScope,
} from "@/lib/insights/agendaNeeds";
import {
  createAnswerableInsight,
  createAnswerableSourceContract,
  createBlockedInsight,
  createBlockedSourceContract,
} from "@/lib/insights/sourceContract";
import type { InsightQuestionKind, OperationalInsight } from "@/lib/insights/types";

export type SanitarySupplyAgendaItemInput = {
  id: string;
  status: string;
  dueDate: string;
  deletedAt?: string | null;

  domain?: string | null;
  animalId?: string | null;
  loteId?: string | null;

  protocolId?: string | null;
  protocolItemId?: string | null;

  productId?: string | null;
  productName?: string | null;
  productUnit?: string | null;

  quantityPerAnimal?: number | null;
  animalCount?: number | null;
};

export type SanitarySupplyQuestionKind = Extract<
  InsightQuestionKind,
  "future_need" | "current_pending"
>;

export type SanitarySupplyFilter = {
  loteIds?: readonly string[];
  animalIds?: readonly string[];
  domains?: readonly string[];
  protocolIds?: readonly string[];
  protocolItemIds?: readonly string[];
  productIds?: readonly string[];
  productNames?: readonly string[];
};

export type SanitarySupplyNeedGroup = {
  productKey: string;
  productId?: string;
  productName?: string;
  productUnit?: string;
  agendaItemCount: number;
  animalCount: number;
  estimatedQuantity?: number;
  missingQuantityCount: number;
  agendaItemIds: string[];
};

export type SanitarySupplyNeedsSummary = {
  groups: SanitarySupplyNeedGroup[];
  incompleteAgendaItemIds: string[];
};

export type CreateSanitarySupplyNeedsInsightInput = {
  questionKind: InsightQuestionKind;
  question: string;
  generatedAt: string;
  items: readonly SanitarySupplyAgendaItemInput[];
  scope: AgendaNeedScope;
  referenceDate?: string;
  days?: number;
  filters?: SanitarySupplyFilter;
  requireProductSource?: boolean;
};

const PRIMARY_SOURCE = "state_agenda_itens";
const SANITARY_DOMAIN = "sanitario";
const ALLOWED_QUESTION_KINDS: readonly SanitarySupplyQuestionKind[] = [
  "future_need",
  "current_pending",
];

function assertAllowedQuestionKind(
  questionKind: InsightQuestionKind,
): asserts questionKind is SanitarySupplyQuestionKind {
  if (!ALLOWED_QUESTION_KINDS.includes(questionKind as SanitarySupplyQuestionKind)) {
    throw new Error("sanitarySupplyNeeds supports only future_need or current_pending");
  }
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePositiveCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
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

function normalizeSanitarySupplyFilter(
  filter: SanitarySupplyFilter | undefined,
): SanitarySupplyFilter {
  const normalized: SanitarySupplyFilter = {};
  const loteIds = normalizeFilterValues(filter?.loteIds);
  const animalIds = normalizeFilterValues(filter?.animalIds);
  const domains = normalizeFilterValues(filter?.domains);
  const protocolIds = normalizeFilterValues(filter?.protocolIds);
  const protocolItemIds = normalizeFilterValues(filter?.protocolItemIds);
  const productIds = normalizeFilterValues(filter?.productIds);
  const productNames = normalizeFilterValues(filter?.productNames);

  if (loteIds.length > 0) normalized.loteIds = loteIds;
  if (animalIds.length > 0) normalized.animalIds = animalIds;
  normalized.domains = domains.length > 0 ? domains : [SANITARY_DOMAIN];
  if (protocolIds.length > 0) normalized.protocolIds = protocolIds;
  if (protocolItemIds.length > 0) normalized.protocolItemIds = protocolItemIds;
  if (productIds.length > 0) normalized.productIds = productIds;
  if (productNames.length > 0) normalized.productNames = productNames;

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

function isSanitaryAgendaItem(item: SanitarySupplyAgendaItemInput): boolean {
  return normalizeString(item.domain) === SANITARY_DOMAIN;
}

function isValidQuantityPerAnimal(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getProductKey(item: SanitarySupplyAgendaItemInput): string | null {
  const productId = normalizeString(item.productId);
  const productName = normalizeString(item.productName);

  if (productId) {
    return `id:${productId}`;
  }

  if (productName) {
    return `name:${productName}`;
  }

  return null;
}

function hasEstimatedQuantity(group: SanitarySupplyNeedGroup): boolean {
  return typeof group.estimatedQuantity === "number";
}

function buildLimitations(input: {
  hasMissingProduct: boolean;
  hasMissingQuantity: boolean;
}): string[] {
  const limitations = [
    "Necessidade sanitaria futura usa agenda aberta/materializada; agenda concluida, cancelada ou deletada nao entra.",
    "Protocolo isolado nao e contado como necessidade sem agenda materializada.",
    "Agenda nao comprova execucao historica; este modulo nao responde KPI historico de aplicacao.",
    "Nao aplica margem de perda e nao deduplica por protocolo sem regra explicita.",
  ];

  if (input.hasMissingProduct) {
    limitations.push("Existem agendas sem produto identificado; elas nao foram inferidas.");
  }

  if (input.hasMissingQuantity) {
    limitations.push(
      "Agendas sem quantityPerAnimal valido maior que zero nao contribuem para estimatedQuantity; missingQuantityCount inclui quantidade ausente ou invalida.",
    );
  }

  return limitations;
}

export function getSanitarySupplyAgendaItems(input: {
  items: readonly SanitarySupplyAgendaItemInput[];
  scope: AgendaNeedScope;
  referenceDate?: string;
  days?: number;
  filters?: SanitarySupplyFilter;
}): SanitarySupplyAgendaItemInput[] {
  let scopedItems: SanitarySupplyAgendaItemInput[];

  switch (input.scope) {
    case "all_open":
      scopedItems = getOpenAgendaNeeds(input.items);
      break;

    case "due_today":
      scopedItems = getAgendaNeedsDueToday(input.items, input.referenceDate ?? "");
      break;

    case "overdue":
      scopedItems = getOverdueAgendaNeeds(input.items, input.referenceDate ?? "");
      break;

    case "due_within_days":
      scopedItems = getAgendaNeedsDueWithinDays(
        input.items,
        input.referenceDate ?? "",
        input.days as number,
      );
      break;
  }

  return filterSanitarySupplyAgendaItems({
    items: scopedItems,
    filters: input.filters,
  });
}

export function filterSanitarySupplyAgendaItems(input: {
  items: readonly SanitarySupplyAgendaItemInput[];
  filters?: SanitarySupplyFilter;
}): SanitarySupplyAgendaItemInput[] {
  const filters = normalizeSanitarySupplyFilter(input.filters);

  return input.items.filter(
    (item) =>
      isSanitaryAgendaItem(item) &&
      matchesFilterValue(item.domain, filters.domains) &&
      matchesFilterValue(item.loteId, filters.loteIds) &&
      matchesFilterValue(item.animalId, filters.animalIds) &&
      matchesFilterValue(item.protocolId, filters.protocolIds) &&
      matchesFilterValue(item.protocolItemId, filters.protocolItemIds) &&
      matchesFilterValue(item.productId, filters.productIds) &&
      matchesFilterValue(item.productName, filters.productNames),
  );
}

export function groupSanitarySupplyNeeds(
  items: readonly SanitarySupplyAgendaItemInput[],
): SanitarySupplyNeedsSummary {
  const groups = new Map<string, SanitarySupplyNeedGroup>();
  const incompleteAgendaItemIds: string[] = [];

  for (const item of items) {
    const productKey = getProductKey(item);

    if (!productKey) {
      incompleteAgendaItemIds.push(item.id);
      continue;
    }

    const animalCount = normalizePositiveCount(item.animalCount);
    const quantityPerAnimal = item.quantityPerAnimal;
    const existing = groups.get(productKey);
    const hasValidQuantity = isValidQuantityPerAnimal(quantityPerAnimal);

    if (!existing) {
      groups.set(productKey, {
        productKey,
        productId: normalizeString(item.productId) ?? undefined,
        productName: normalizeString(item.productName) ?? undefined,
        productUnit: normalizeString(item.productUnit) ?? undefined,
        agendaItemCount: 1,
        animalCount,
        estimatedQuantity: hasValidQuantity ? quantityPerAnimal * animalCount : undefined,
        missingQuantityCount: hasValidQuantity ? 0 : 1,
        agendaItemIds: [item.id],
      });
      continue;
    }

    existing.agendaItemCount += 1;
    existing.animalCount += animalCount;
    existing.agendaItemIds.push(item.id);

    if (hasValidQuantity) {
      existing.estimatedQuantity =
        (existing.estimatedQuantity ?? 0) + quantityPerAnimal * animalCount;
    } else {
      existing.missingQuantityCount += 1;
    }

    if (!existing.productUnit) {
      existing.productUnit = normalizeString(item.productUnit) ?? undefined;
    }
  }

  return {
    groups: Array.from(groups.values()).sort((left, right) =>
      left.productKey.localeCompare(right.productKey),
    ),
    incompleteAgendaItemIds,
  };
}

export function createSanitarySupplyNeedsInsight(
  input: CreateSanitarySupplyNeedsInsightInput,
): OperationalInsight<SanitarySupplyNeedsSummary> {
  assertAllowedQuestionKind(input.questionKind);

  const agendaItems = getSanitarySupplyAgendaItems({
    items: input.items,
    scope: input.scope,
    referenceDate: input.referenceDate,
    days: input.days,
    filters: input.filters,
  });
  const filters = normalizeSanitarySupplyFilter(input.filters);
  const summary = groupSanitarySupplyNeeds(agendaItems);
  const hasMissingProduct = summary.incompleteAgendaItemIds.length > 0;
  const hasMissingQuantity = summary.groups.some((group) => group.missingQuantityCount > 0);

  if (input.requireProductSource && summary.groups.length === 0 && hasMissingProduct) {
    return createBlockedInsight({
      questionKind: input.questionKind,
      question: input.question,
      generatedAt: input.generatedAt,
      filters,
      source: createBlockedSourceContract({
        block: {
          code: "missing_primary_source",
          reason: "Necessidade por produto exige produto identificado na agenda.",
          requiredSources: ["produto identificado em agenda sanitaria materializada"],
        },
        auxiliarySources: ["protocolos_sanitarios", "produtos_veterinarios"],
        excludedSources: ["eventos", "eventos_*", "agenda_concluida", "tags/marcadores"],
        limitations: ["Existem agendas sem produto identificado; elas nao foram inferidas."],
        evidenceStatus: "bloqueado",
      }),
    });
  }

  return createAnswerableInsight({
    questionKind: input.questionKind,
    question: input.question,
    generatedAt: input.generatedAt,
    filters,
    source: createAnswerableSourceContract({
      primarySource: PRIMARY_SOURCE,
      auxiliarySources: [
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "produtos_veterinarios",
        "state_animais",
        "state_lotes",
      ],
      excludedSources: ["eventos", "eventos_*", "agenda_concluida", "tags/marcadores"],
      limitations: buildLimitations({
        hasMissingProduct,
        hasMissingQuantity,
      }),
      evidenceStatus: hasMissingProduct || hasMissingQuantity ? "depende_validacao" : "comprovado",
    }),
    resultStatus:
      summary.groups.length === 0
        ? "empty"
        : hasMissingProduct
          ? "partial"
          : "complete",
    partialReason: hasMissingProduct
      ? "Existem agendas sem produto identificado; resultado por produto e parcial."
      : undefined,
    data: {
      groups: summary.groups.map((group) => ({
        ...group,
        estimatedQuantity: hasEstimatedQuantity(group) ? group.estimatedQuantity : undefined,
        agendaItemIds: [...group.agendaItemIds],
      })),
      incompleteAgendaItemIds: [...summary.incompleteAgendaItemIds],
    },
  });
}
