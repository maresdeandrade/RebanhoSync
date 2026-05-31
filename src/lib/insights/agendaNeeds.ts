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

export type AgendaNeedStatus =
  | "agendado"
  | "pendente"
  | "concluido"
  | "cancelado";

export type AgendaNeedQuestionKind = Extract<
  InsightQuestionKind,
  "future_need" | "current_pending"
>;

export type AgendaNeedScope =
  | "all_open"
  | "due_today"
  | "overdue"
  | "due_within_days";

export type AgendaNeedItemInput = {
  id: string;
  status: string;
  dueDate: string;
  deletedAt?: string | null;
  animalId?: string | null;
  loteId?: string | null;
  domain?: string | null;
  protocolId?: string | null;
  protocolItemVersionId?: string | null;
  productId?: string | null;
  productName?: string | null;
  title?: string | null;
};

export type CreateAgendaNeedsInsightInput = {
  questionKind: InsightQuestionKind;
  scope: AgendaNeedScope;
  question: string;
  generatedAt: string;
  items: readonly AgendaNeedItemInput[];
  referenceDate?: string;
  days?: number;
  filters?: InsightFilters;
  period?: InsightPeriod;
  requiresProductSource?: boolean;
};

const PRIMARY_SOURCE = "state_agenda_itens";
const OPEN_STATUSES: readonly AgendaNeedStatus[] = ["agendado", "pendente"];
const ALLOWED_QUESTION_KINDS: readonly AgendaNeedQuestionKind[] = [
  "future_need",
  "current_pending",
];

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function assertDateKey(value: string | undefined, fieldName: string): string {
  const normalized = (value ?? "").trim();

  if (!DATE_KEY_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date`);
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const parsedKey = [
    parsed.getUTCFullYear(),
    `${parsed.getUTCMonth() + 1}`.padStart(2, "0"),
    `${parsed.getUTCDate()}`.padStart(2, "0"),
  ].join("-");

  if (parsedKey !== normalized) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date`);
  }

  return normalized;
}

function isOpenAgendaStatus(status: string): boolean {
  return OPEN_STATUSES.includes(normalizeStatus(status) as AgendaNeedStatus);
}

function isDeleted(item: AgendaNeedItemInput): boolean {
  return Boolean(item.deletedAt);
}

function isAllowedQuestionKind(
  questionKind: InsightQuestionKind,
): questionKind is AgendaNeedQuestionKind {
  return ALLOWED_QUESTION_KINDS.includes(questionKind as AgendaNeedQuestionKind);
}

function assertAllowedQuestionKind(
  questionKind: InsightQuestionKind,
): asserts questionKind is AgendaNeedQuestionKind {
  if (!isAllowedQuestionKind(questionKind)) {
    throw new Error(
      "agendaNeeds supports only future_need or current_pending",
    );
  }
}

function addDays(dateKey: string, days: number): string {
  const normalized = assertDateKey(dateKey, "referenceDate");
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const nextDay = `${date.getUTCDate()}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function assertDays(value: number | undefined): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("days must be an integer greater than or equal to 0");
  }

  return value;
}

function hasProductSource(item: AgendaNeedItemInput): boolean {
  return Boolean(item.productId?.trim() || item.productName?.trim());
}

function assertItemDueDate(item: AgendaNeedItemInput): string {
  return assertDateKey(item.dueDate, "dueDate");
}

function buildLimitations(scope: AgendaNeedScope): string[] {
  const limitations = [
    "Agenda aberta/materializada e fonte de necessidade futura; agenda concluida/cancelada nao entra como necessidade.",
    "Agenda concluida genericamente nao comprova execucao factual.",
    "Protocolo isolado nao e contado como necessidade sem agenda materializada.",
  ];

  if (scope === "due_within_days") {
    limitations.push("Escopo due_within_days exclui agendas vencidas; atrasadas ficam em overdue.");
  }

  return limitations;
}

export function getOpenAgendaNeeds(
  items: readonly AgendaNeedItemInput[],
): AgendaNeedItemInput[] {
  return items.filter((item) => !isDeleted(item) && isOpenAgendaStatus(item.status));
}

export function getAgendaNeedsDueToday(
  items: readonly AgendaNeedItemInput[],
  referenceDate: string,
): AgendaNeedItemInput[] {
  const referenceDateKey = assertDateKey(referenceDate, "referenceDate");
  return getOpenAgendaNeeds(items).filter(
    (item) => assertItemDueDate(item) === referenceDateKey,
  );
}

export function getOverdueAgendaNeeds(
  items: readonly AgendaNeedItemInput[],
  referenceDate: string,
): AgendaNeedItemInput[] {
  const referenceDateKey = assertDateKey(referenceDate, "referenceDate");
  return getOpenAgendaNeeds(items).filter(
    (item) => assertItemDueDate(item) < referenceDateKey,
  );
}

export function getAgendaNeedsDueWithinDays(
  items: readonly AgendaNeedItemInput[],
  referenceDate: string,
  days: number,
): AgendaNeedItemInput[] {
  const referenceDateKey = assertDateKey(referenceDate, "referenceDate");
  const validDays = assertDays(days);
  const endDateKey = addDays(referenceDateKey, validDays);

  return getOpenAgendaNeeds(items).filter((item) => {
    const dueDateKey = assertItemDueDate(item);
    return dueDateKey >= referenceDateKey && dueDateKey <= endDateKey;
  });
}

function getAgendaNeedsByScope(input: CreateAgendaNeedsInsightInput): AgendaNeedItemInput[] {
  switch (input.scope) {
    case "all_open":
      return getOpenAgendaNeeds(input.items);

    case "due_today":
      return getAgendaNeedsDueToday(
        input.items,
        assertDateKey(input.referenceDate, "referenceDate"),
      );

    case "overdue":
      return getOverdueAgendaNeeds(
        input.items,
        assertDateKey(input.referenceDate, "referenceDate"),
      );

    case "due_within_days":
      return getAgendaNeedsDueWithinDays(
        input.items,
        assertDateKey(input.referenceDate, "referenceDate"),
        assertDays(input.days),
      );
  }
}

export function createAgendaNeedsInsight(
  input: CreateAgendaNeedsInsightInput,
): OperationalInsight<AgendaNeedItemInput[]> {
  assertAllowedQuestionKind(input.questionKind);

  const data = getAgendaNeedsByScope(input);

  if (
    input.requiresProductSource &&
    data.some((item) => !hasProductSource(item))
  ) {
    return createBlockedInsight({
      questionKind: input.questionKind,
      question: input.question,
      generatedAt: input.generatedAt,
      filters: input.filters ?? {},
      period: input.period,
      source: createBlockedSourceContract({
        block: {
          code: "missing_primary_source",
          reason: "Agenda item requires product source to answer this need safely.",
          requiredSources: ["produto/protocolo carregado"],
        },
        auxiliarySources: ["protocolos_sanitarios", "produtos_veterinarios"],
        excludedSources: ["eventos", "eventos_*", "tags/marcadores"],
        evidenceStatus: "bloqueado",
      }),
    });
  }

  return createAnswerableInsight({
    questionKind: input.questionKind,
    question: input.question,
    generatedAt: input.generatedAt,
    filters: input.filters ?? {},
    period: input.period,
    source: createAnswerableSourceContract({
      primarySource: PRIMARY_SOURCE,
      auxiliarySources: ["state_animais", "state_lotes"],
      excludedSources: ["eventos", "eventos_*", "protocolos_isolados", "tags/marcadores"],
      limitations: buildLimitations(input.scope),
      evidenceStatus: "comprovado",
    }),
    resultStatus: data.length > 0 ? "complete" : "empty",
    data,
  });
}
