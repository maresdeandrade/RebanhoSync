import type {
  AnswerableInsightEvidenceStatus,
  AnswerableInsightSourceContract,
  AnswerableOperationalInsight,
  BlockedInsightEvidenceStatus,
  BlockedInsightSourceContract,
  BlockedOperationalInsight,
  CreateAnswerableInsightInput,
  CreateAnswerableSourceContractInput,
  CreateBlockedInsightInput,
  CreateBlockedSourceContractInput,
  InsightBlockCode,
  InsightEvidenceStatus,
  InsightPeriod,
  InsightQuestionKind,
  InsightSourceContract,
  OperationalInsight,
} from "@/lib/insights/types";

const ANSWERABLE_EVIDENCE_STATUSES: readonly AnswerableInsightEvidenceStatus[] = [
  "comprovado",
  "inferido",
  "recomendado",
  "depende_validacao",
];

const BLOCKED_EVIDENCE_STATUSES: readonly BlockedInsightEvidenceStatus[] = [
  "bloqueado",
  "nao_confirmado",
  "depende_validacao",
];

const BLOCK_CODES_REQUIRING_SOURCES: readonly InsightBlockCode[] = [
  "missing_primary_source",
  "unvalidated_read_model",
  "requires_code_validation",
];

const QUESTION_KINDS: readonly InsightQuestionKind[] = [
  "future_need",
  "current_pending",
  "current_state",
  "historical_kpi",
  "workflow_kpi",
  "configured_rule",
  "operational_report",
];

type SourceKind =
  | "agenda"
  | "current_pending"
  | "current_state"
  | "historical_fact"
  | "configured_rule"
  | "unknown";

function assertRecord(value: unknown, fieldName: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${fieldName} is required`);
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeStringList(values: readonly string[] | undefined): string[] {
  const normalized = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      normalized.add(trimmed);
    }
  }

  return Array.from(normalized);
}

function isAnswerableEvidenceStatus(
  value: InsightEvidenceStatus,
): value is AnswerableInsightEvidenceStatus {
  return ANSWERABLE_EVIDENCE_STATUSES.includes(value as AnswerableInsightEvidenceStatus);
}

function isBlockedEvidenceStatus(
  value: InsightEvidenceStatus,
): value is BlockedInsightEvidenceStatus {
  return BLOCKED_EVIDENCE_STATUSES.includes(value as BlockedInsightEvidenceStatus);
}

function isInsightQuestionKind(value: unknown): value is InsightQuestionKind {
  return QUESTION_KINDS.includes(value as InsightQuestionKind);
}

function blockCodeRequiresSources(code: InsightBlockCode): boolean {
  return BLOCK_CODES_REQUIRING_SOURCES.includes(code);
}

function assertRequiredSourcesForBlock(
  code: InsightBlockCode,
  requiredSources: readonly string[],
): void {
  if (blockCodeRequiresSources(code) && requiredSources.length === 0) {
    throw new Error(`${code} requires at least one requiredSources item`);
  }
}

function normalizeSourceName(source: string): string {
  return source.trim().toLowerCase();
}

function classifySourceKind(source: string): SourceKind {
  const normalized = normalizeSourceName(source);

  if (
    normalized === "agenda" ||
    normalized === "agenda_itens" ||
    normalized === "state_agenda_itens" ||
    normalized.includes("agenda_itens") ||
    normalized.startsWith("agenda_") ||
    normalized.startsWith("vw_agenda")
  ) {
    return "agenda";
  }

  if (
    normalized === "eventos" ||
    normalized.startsWith("eventos_") ||
    normalized.startsWith("event_") ||
    normalized.includes("eventos.") ||
    normalized.includes("eventos_") ||
    (normalized.includes("historico") && normalized.includes("evento"))
  ) {
    return "historical_fact";
  }

  if (normalized.includes("pendencia") || normalized.includes("pendencias")) {
    return "current_pending";
  }

  if (
    normalized.includes("protocolo") ||
    normalized.includes("protocol") ||
    normalized.includes("config")
  ) {
    return "configured_rule";
  }

  if (normalized.startsWith("state_") || normalized.startsWith("vw_")) {
    return "current_state";
  }

  return "unknown";
}

function hasCompletePeriod(period: InsightPeriod | undefined): boolean {
  return Boolean(period?.start?.trim() && period?.end?.trim());
}

function hasCurrentStateAuxiliarySource(source: AnswerableInsightSourceContract): boolean {
  return source.auxiliarySources.some(
    (auxiliarySource) => classifySourceKind(auxiliarySource) === "current_state",
  );
}

function assertOperationalBase(input: {
  questionKind: InsightQuestionKind;
  question: string;
  generatedAt: string;
  filters: Record<string, unknown>;
}) {
  if (!isInsightQuestionKind(input.questionKind)) {
    throw new Error("questionKind must be a valid InsightQuestionKind");
  }

  assertNonEmptyString(input.question, "question");
  assertNonEmptyString(input.generatedAt, "generatedAt");
  assertRecord(input.filters, "filters");
}

export function validateSourceForQuestionKind(input: {
  questionKind: InsightQuestionKind;
  source: InsightSourceContract;
  period?: InsightPeriod;
}): void {
  if (input.source.answerability === "blocked") {
    return;
  }

  const primarySourceKind = classifySourceKind(input.source.primarySource);

  switch (input.questionKind) {
    case "future_need":
      if (primarySourceKind !== "agenda") {
        throw new Error("future_need requires agenda as primary source");
      }
      return;

    case "current_pending":
      if (primarySourceKind !== "agenda" && primarySourceKind !== "current_pending") {
        throw new Error("current_pending requires open agenda or current pending read model");
      }
      return;

    case "current_state":
      if (input.period) {
        throw new Error("current_state must not answer period history");
      }

      if (primarySourceKind !== "current_state") {
        throw new Error("current_state requires state_* or current read model as primary source");
      }
      return;

    case "historical_kpi":
      if (!hasCompletePeriod(input.period)) {
        throw new Error("historical_kpi requires period.start and period.end");
      }

      if (primarySourceKind !== "historical_fact") {
        throw new Error("historical_kpi requires events or historical event read model as primary source");
      }

      if (
        hasCurrentStateAuxiliarySource(input.source) &&
        input.source.limitations.length === 0
      ) {
        throw new Error("historical_kpi with current state auxiliary source requires limitations");
      }
      return;

    case "workflow_kpi":
      if (primarySourceKind !== "agenda" && primarySourceKind !== "current_pending") {
        throw new Error("workflow_kpi requires agenda or workflow read model as primary source");
      }
      return;

    case "configured_rule":
      if (primarySourceKind !== "configured_rule") {
        throw new Error("configured_rule requires protocol or configuration as primary source");
      }
      return;

    case "operational_report":
      throw new Error(
        "operational_report requires composed section insights and cannot be answerable directly",
      );
  }
}

export function createAnswerableSourceContract(
  input: CreateAnswerableSourceContractInput,
): AnswerableInsightSourceContract {
  const evidenceStatus = input.evidenceStatus ?? "comprovado";

  if (!isAnswerableEvidenceStatus(evidenceStatus)) {
    throw new Error("evidenceStatus is not valid for an answerable insight");
  }

  return {
    answerability: "answerable",
    primarySource: assertNonEmptyString(input.primarySource, "primarySource"),
    auxiliarySources: normalizeStringList(input.auxiliarySources),
    excludedSources: normalizeStringList(input.excludedSources),
    limitations: normalizeStringList(input.limitations),
    evidenceStatus,
  };
}

export function createBlockedSourceContract(
  input: CreateBlockedSourceContractInput,
): BlockedInsightSourceContract {
  const evidenceStatus = input.evidenceStatus ?? "bloqueado";
  const requiredSources = normalizeStringList(input.block.requiredSources);

  if (!isBlockedEvidenceStatus(evidenceStatus)) {
    throw new Error("evidenceStatus is not valid for a blocked insight");
  }

  assertRequiredSourcesForBlock(input.block.code, requiredSources);

  return {
    answerability: "blocked",
    primarySource: null,
    auxiliarySources: normalizeStringList(input.auxiliarySources),
    excludedSources: normalizeStringList(input.excludedSources),
    limitations: normalizeStringList(input.limitations),
    evidenceStatus,
    block: {
      code: input.block.code,
      reason: assertNonEmptyString(input.block.reason, "block.reason"),
      requiredSources,
    },
  };
}

export function assertAnswerableSourceContract(
  source: unknown,
): asserts source is AnswerableInsightSourceContract {
  assertRecord(source, "source");

  if (source.answerability !== "answerable") {
    throw new Error("source.answerability must be answerable");
  }

  assertNonEmptyString(source.primarySource, "source.primarySource");

  if (!isAnswerableEvidenceStatus(source.evidenceStatus as InsightEvidenceStatus)) {
    throw new Error("source.evidenceStatus is not valid for an answerable insight");
  }

  if ("block" in source) {
    throw new Error("answerable source cannot include block");
  }
}

export function assertBlockedSourceContract(
  source: unknown,
): asserts source is BlockedInsightSourceContract {
  assertRecord(source, "source");

  if (source.answerability !== "blocked") {
    throw new Error("source.answerability must be blocked");
  }

  if (source.primarySource !== null) {
    throw new Error("blocked source must not include a primary source");
  }

  if (!isBlockedEvidenceStatus(source.evidenceStatus as InsightEvidenceStatus)) {
    throw new Error("source.evidenceStatus is not valid for a blocked insight");
  }

  assertRecord(source.block, "source.block");
  assertNonEmptyString(source.block.reason, "source.block.reason");

  assertRequiredSourcesForBlock(
    source.block.code as InsightBlockCode,
    normalizeStringList(source.block.requiredSources as readonly string[] | undefined),
  );
}

export function assertSourceContract(
  source: unknown,
): asserts source is InsightSourceContract {
  assertRecord(source, "source");

  if (source.answerability === "answerable") {
    assertAnswerableSourceContract(source);
    return;
  }

  if (source.answerability === "blocked") {
    assertBlockedSourceContract(source);
    return;
  }

  throw new Error("source.answerability must be answerable or blocked");
}

export function hasPrimarySource(
  source: InsightSourceContract,
): source is AnswerableInsightSourceContract {
  return source.answerability === "answerable" && source.primarySource.trim().length > 0;
}

export function isBlockedInsight(
  insight: OperationalInsight<unknown>,
): insight is BlockedOperationalInsight {
  return insight.answerability === "blocked";
}

export function isAnswerableInsight<T>(
  insight: OperationalInsight<T>,
): insight is AnswerableOperationalInsight<T> {
  return insight.answerability === "answerable";
}

export function createAnswerableInsight<T>(
  input: CreateAnswerableInsightInput<T>,
): AnswerableOperationalInsight<T> {
  assertOperationalBase(input);
  assertAnswerableSourceContract(input.source);
  validateSourceForQuestionKind({
    questionKind: input.questionKind,
    period: input.period,
    source: input.source,
  });

  const resultStatus =
    input.resultStatus ?? (input.partialReason ? "partial" : "complete");
  const partialReason = input.partialReason?.trim();

  if (resultStatus === "partial" && !partialReason && input.source.limitations.length === 0) {
    throw new Error("partial insight requires partialReason or source limitations");
  }

  return {
    answerability: "answerable",
    questionKind: input.questionKind,
    question: input.question.trim(),
    period: input.period,
    filters: input.filters,
    generatedAt: input.generatedAt.trim(),
    resultStatus,
    partialReason: partialReason || undefined,
    source: input.source,
    data: input.data,
  };
}

export function createBlockedInsight(
  input: CreateBlockedInsightInput,
): BlockedOperationalInsight {
  assertOperationalBase(input);
  assertBlockedSourceContract(input.source);

  return {
    answerability: "blocked",
    questionKind: input.questionKind,
    question: input.question.trim(),
    period: input.period,
    filters: input.filters,
    generatedAt: input.generatedAt.trim(),
    resultStatus: "blocked",
    source: input.source,
  };
}

export function assertOperationalInsight<T>(
  insight: unknown,
): asserts insight is OperationalInsight<T> {
  assertRecord(insight, "insight");
  assertOperationalBase({
    questionKind: insight.questionKind as InsightQuestionKind,
    question: insight.question as string,
    generatedAt: insight.generatedAt as string,
    filters: insight.filters as Record<string, unknown>,
  });

  if (insight.answerability === "answerable") {
    if (insight.resultStatus === "blocked") {
      throw new Error("answerable insight cannot have blocked resultStatus");
    }

    assertAnswerableSourceContract(insight.source);
    validateSourceForQuestionKind({
      questionKind: insight.questionKind as InsightQuestionKind,
      period: insight.period as InsightPeriod | undefined,
      source: insight.source,
    });
    return;
  }

  if (insight.answerability === "blocked") {
    if (insight.resultStatus !== "blocked") {
      throw new Error("blocked insight must have blocked resultStatus");
    }

    if ("data" in insight) {
      throw new Error("blocked insight cannot include data");
    }

    assertBlockedSourceContract(insight.source);
    return;
  }

  throw new Error("insight.answerability must be answerable or blocked");
}
