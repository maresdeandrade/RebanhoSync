export type InsightEvidenceStatus =
  | "comprovado"
  | "inferido"
  | "nao_confirmado"
  | "recomendado"
  | "bloqueado"
  | "depende_validacao";

export type AnswerableInsightEvidenceStatus = Exclude<
  InsightEvidenceStatus,
  "bloqueado" | "nao_confirmado"
>;

export type BlockedInsightEvidenceStatus = Extract<
  InsightEvidenceStatus,
  "bloqueado" | "nao_confirmado" | "depende_validacao"
>;

export type InsightAnswerability = "answerable" | "blocked";

export type InsightResultStatus = "complete" | "partial" | "empty";

export type InsightQuestionKind =
  | "future_need"
  | "current_pending"
  | "current_state"
  | "historical_kpi"
  | "workflow_kpi"
  | "configured_rule"
  | "operational_report";

export type InsightBlockCode =
  | "missing_primary_source"
  | "blocked_domain"
  | "unvalidated_read_model"
  | "prohibited_source"
  | "requires_code_validation";

export interface InsightBlock {
  code: InsightBlockCode;
  reason: string;
  requiredSources: readonly string[];
}

export interface InsightPeriod {
  start: string;
  end: string;
}

export type InsightFilters = Record<string, unknown>;

export interface InsightSourceBase {
  auxiliarySources: readonly string[];
  excludedSources: readonly string[];
  limitations: readonly string[];
}

export interface AnswerableInsightSourceContract extends InsightSourceBase {
  answerability: "answerable";
  primarySource: string;
  evidenceStatus: AnswerableInsightEvidenceStatus;
  block?: never;
}

export interface BlockedInsightSourceContract extends InsightSourceBase {
  answerability: "blocked";
  primarySource: null;
  evidenceStatus: BlockedInsightEvidenceStatus;
  block: InsightBlock;
}

export type InsightSourceContract =
  | AnswerableInsightSourceContract
  | BlockedInsightSourceContract;

export interface OperationalInsightBase {
  questionKind: InsightQuestionKind;
  question: string;
  period?: InsightPeriod;
  filters: InsightFilters;
  generatedAt: string;
}

export interface AnswerableOperationalInsight<T> extends OperationalInsightBase {
  answerability: "answerable";
  resultStatus: InsightResultStatus;
  partialReason?: string;
  source: AnswerableInsightSourceContract;
  data: T;
}

export interface BlockedOperationalInsight extends OperationalInsightBase {
  answerability: "blocked";
  resultStatus: "blocked";
  source: BlockedInsightSourceContract;
  data?: never;
  partialReason?: never;
}

export type OperationalInsight<T> =
  | AnswerableOperationalInsight<T>
  | BlockedOperationalInsight;

export interface CreateAnswerableSourceContractInput {
  primarySource: string;
  auxiliarySources?: readonly string[];
  excludedSources?: readonly string[];
  limitations?: readonly string[];
  evidenceStatus?: AnswerableInsightEvidenceStatus;
}

export interface CreateBlockedSourceContractInput {
  block: {
    code: InsightBlockCode;
    reason: string;
    requiredSources?: readonly string[];
  };
  auxiliarySources?: readonly string[];
  excludedSources?: readonly string[];
  limitations?: readonly string[];
  evidenceStatus?: BlockedInsightEvidenceStatus;
}

export interface CreateAnswerableInsightInput<T> extends OperationalInsightBase {
  source: AnswerableInsightSourceContract;
  data: T;
  resultStatus?: InsightResultStatus;
  partialReason?: string;
}

export interface CreateBlockedInsightInput extends OperationalInsightBase {
  source: BlockedInsightSourceContract;
}
