import type { AgendaNeedItemInput } from "@/lib/insights/agendaNeeds";
import {
  isAnswerableInsight,
  isBlockedInsight,
} from "@/lib/insights/sourceContract";
import type { HerdStageSummary } from "@/lib/insights/herdStageSummary";
import type {
  AnswerableOperationalInsight,
  BlockedOperationalInsight,
  InsightQuestionKind,
  OperationalInsight,
} from "@/lib/insights/types";

export type OperationalSignalSeverity = "info" | "warning" | "critical";

export type AllowedOperationalSignalCode =
  | "agenda:pendente"
  | "agenda:vence_hoje"
  | "agenda:atrasada"
  | "sanitario:pendencia_aberta"
  | "sanitario:pendencia_atrasada"
  | "animal:ativo"
  | "animal:vendido"
  | "animal:morto"
  | "lote:sem_lote"
  | "estagio:desconhecido";

export type BlockedOperationalSignalCode =
  | "sanitario:livre_carencia"
  | "sanitario:carencia_ativa"
  | "comercial:pronto_venda"
  | "comercial:apto_abate"
  | "peso:atual_confiavel"
  | "protocolo:executado"
  | "agenda:concluida_como_fato"
  | "reproducao:iatf_pendente";

export type OperationalSignalCode =
  | AllowedOperationalSignalCode
  | BlockedOperationalSignalCode;

export type OperationalSignal = {
  code: AllowedOperationalSignalCode;
  label: string;
  severity?: OperationalSignalSeverity;
  primarySource: string;
  questionKind: InsightQuestionKind;
  limitations: readonly string[];
  generatedAt: string;
  count?: number;
  sourceInsightQuestion: string;
};

export type CreateOperationalSignalInput = {
  code: OperationalSignalCode;
  label: string;
  severity?: OperationalSignalSeverity;
  primarySource: string;
  questionKind: InsightQuestionKind;
  limitations?: readonly string[];
  generatedAt: string;
  count?: number;
  sourceInsightQuestion: string;
};

const BLOCKED_SIGNAL_CODES: readonly BlockedOperationalSignalCode[] = [
  "sanitario:livre_carencia",
  "sanitario:carencia_ativa",
  "comercial:pronto_venda",
  "comercial:apto_abate",
  "peso:atual_confiavel",
  "protocolo:executado",
  "agenda:concluida_como_fato",
  "reproducao:iatf_pendente",
];

const AGENDA_SIGNAL_LIMITATION =
  "Sinal calculado a partir de insight de agenda; nao comprova execucao factual e nao persiste marcador.";

const HERD_STATE_SIGNAL_LIMITATION =
  "Sinal calculado a partir de insight de estado atual; nao altera regra tecnica nem substitui state_*.";

function assertNonEmptyString(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return trimmed;
}

function isBlockedSignalCode(code: OperationalSignalCode): code is BlockedOperationalSignalCode {
  return BLOCKED_SIGNAL_CODES.includes(code as BlockedOperationalSignalCode);
}

function assertAllowedSignalCode(
  code: OperationalSignalCode,
): asserts code is AllowedOperationalSignalCode {
  if (isBlockedSignalCode(code)) {
    throw new Error(`${code} is blocked and cannot be emitted`);
  }
}

function normalizeLimitations(limitations: readonly string[] | undefined): string[] {
  const normalized = new Set<string>();

  for (const limitation of limitations ?? []) {
    const trimmed = limitation.trim();
    if (trimmed) {
      normalized.add(trimmed);
    }
  }

  return Array.from(normalized);
}

function assertAnswerableSourceInsight<T>(
  insight: OperationalInsight<T>,
): asserts insight is AnswerableOperationalInsight<T> {
  if (isBlockedInsight(insight)) {
    throw new Error("blocked insight cannot emit operational signals");
  }
}

function rejectBlockedSignalInsight(
  insight: BlockedOperationalInsight,
): never {
  throw new Error(
    `blocked insight cannot emit operational signals: ${insight.source.block.code}`,
  );
}

function countAgendaByDomain(
  items: readonly AgendaNeedItemInput[],
  domain: string,
): number {
  return items.filter((item) => item.domain?.trim().toLowerCase() === domain).length;
}

function countByKey<T extends string>(
  groups: readonly Array<Record<T, string> & { count: number }>,
  keyName: T,
  keyValue: string,
): number {
  return groups.find((group) => group[keyName] === keyValue)?.count ?? 0;
}

function mergeLimitations(
  insightLimitations: readonly string[],
  signalLimitation: string,
): string[] {
  return normalizeLimitations([...insightLimitations, signalLimitation]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isAgendaNeedItemArray(value: unknown): value is readonly AgendaNeedItemInput[] {
  return Array.isArray(value)
    && value.every(
      (item) =>
        isRecord(item)
        && typeof item.id === "string"
        && typeof item.status === "string"
        && typeof item.dueDate === "string",
    );
}

function isHerdStageSummary(value: unknown): value is HerdStageSummary {
  return isRecord(value)
    && typeof value.totalAnimals === "number"
    && typeof value.unknownStageCount === "number"
    && Array.isArray(value.byStage)
    && Array.isArray(value.byLote)
    && Array.isArray(value.byStatus);
}

export function createOperationalSignal(
  input: CreateOperationalSignalInput,
): OperationalSignal {
  assertAllowedSignalCode(input.code);

  return {
    code: input.code,
    label: assertNonEmptyString(input.label, "label"),
    severity: input.severity,
    primarySource: assertNonEmptyString(input.primarySource, "primarySource"),
    questionKind: input.questionKind,
    limitations: normalizeLimitations(input.limitations),
    generatedAt: assertNonEmptyString(input.generatedAt, "generatedAt"),
    count: input.count,
    sourceInsightQuestion: assertNonEmptyString(
      input.sourceInsightQuestion,
      "sourceInsightQuestion",
    ),
  };
}

export function createSignalsFromAgendaInsight(
  insight: OperationalInsight<readonly AgendaNeedItemInput[]>,
): OperationalSignal[] {
  if (isBlockedInsight(insight)) {
    return rejectBlockedSignalInsight(insight);
  }

  assertAnswerableSourceInsight(insight);

  if (insight.questionKind !== "future_need" && insight.questionKind !== "current_pending") {
    throw new Error("agenda signals require future_need or current_pending insight");
  }

  const count = insight.data.length;
  if (count === 0) {
    return [];
  }

  const limitations = mergeLimitations(
    insight.source.limitations,
    AGENDA_SIGNAL_LIMITATION,
  );
  const signals: OperationalSignal[] = [];

  signals.push(
    createOperationalSignal({
      code: "agenda:pendente",
      label: "Agenda pendente",
      severity: "info",
      primarySource: insight.source.primarySource,
      questionKind: insight.questionKind,
      limitations,
      generatedAt: insight.generatedAt,
      count,
      sourceInsightQuestion: insight.question,
    }),
  );

  if (insight.question.toLowerCase().includes("vence hoje")) {
    signals.push(
      createOperationalSignal({
        code: "agenda:vence_hoje",
        label: "Agenda vence hoje",
        severity: "warning",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  if (insight.question.toLowerCase().includes("atras")) {
    signals.push(
      createOperationalSignal({
        code: "agenda:atrasada",
        label: "Agenda atrasada",
        severity: "critical",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  const sanitaryCount = countAgendaByDomain(insight.data, "sanitario");
  if (sanitaryCount > 0) {
    signals.push(
      createOperationalSignal({
        code: "sanitario:pendencia_aberta",
        label: "Pendencia sanitaria aberta",
        severity: "warning",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count: sanitaryCount,
        sourceInsightQuestion: insight.question,
      }),
    );

    if (insight.question.toLowerCase().includes("atras")) {
      signals.push(
        createOperationalSignal({
          code: "sanitario:pendencia_atrasada",
          label: "Pendencia sanitaria atrasada",
          severity: "critical",
          primarySource: insight.source.primarySource,
          questionKind: insight.questionKind,
          limitations,
          generatedAt: insight.generatedAt,
          count: sanitaryCount,
          sourceInsightQuestion: insight.question,
        }),
      );
    }
  }

  return signals;
}

export function createSignalsFromHerdStageInsight(
  insight: OperationalInsight<HerdStageSummary>,
): OperationalSignal[] {
  if (isBlockedInsight(insight)) {
    return rejectBlockedSignalInsight(insight);
  }

  assertAnswerableSourceInsight(insight);

  if (insight.questionKind !== "current_state") {
    throw new Error("herd stage signals require current_state insight");
  }

  const limitations = mergeLimitations(
    insight.source.limitations,
    HERD_STATE_SIGNAL_LIMITATION,
  );
  const signals: OperationalSignal[] = [];
  const activeCount = countByKey(insight.data.byStatus, "status", "ativo");
  const soldCount = countByKey(insight.data.byStatus, "status", "vendido");
  const deadCount = countByKey(insight.data.byStatus, "status", "morto");
  const missingLoteCount = countByKey(insight.data.byLote, "loteId", "sem_lote");

  if (activeCount > 0) {
    signals.push(
      createOperationalSignal({
        code: "animal:ativo",
        label: "Animal ativo",
        severity: "info",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count: activeCount,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  if (soldCount > 0) {
    signals.push(
      createOperationalSignal({
        code: "animal:vendido",
        label: "Animal vendido",
        severity: "info",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count: soldCount,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  if (deadCount > 0) {
    signals.push(
      createOperationalSignal({
        code: "animal:morto",
        label: "Animal morto",
        severity: "info",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count: deadCount,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  if (missingLoteCount > 0) {
    signals.push(
      createOperationalSignal({
        code: "lote:sem_lote",
        label: "Sem lote",
        severity: "warning",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count: missingLoteCount,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  if (insight.data.unknownStageCount > 0 || insight.resultStatus === "partial") {
    signals.push(
      createOperationalSignal({
        code: "estagio:desconhecido",
        label: "Estagio desconhecido",
        severity: "warning",
        primarySource: insight.source.primarySource,
        questionKind: insight.questionKind,
        limitations,
        generatedAt: insight.generatedAt,
        count: insight.data.unknownStageCount,
        sourceInsightQuestion: insight.question,
      }),
    );
  }

  return signals;
}

export function createOperationalSignalsFromInsights(
  insights: readonly OperationalInsight<unknown>[],
): OperationalSignal[] {
  const signals: OperationalSignal[] = [];

  for (const insight of insights) {
    if (isBlockedInsight(insight)) {
      throw new Error("blocked insight cannot emit operational signals");
    }

    if (!isAnswerableInsight(insight)) {
      continue;
    }

    if (
      (insight.questionKind === "future_need" || insight.questionKind === "current_pending")
      && isAgendaNeedItemArray(insight.data)
    ) {
      signals.push(
        ...createSignalsFromAgendaInsight(insight),
      );
      continue;
    }

    if (insight.questionKind === "current_state" && isHerdStageSummary(insight.data)) {
      signals.push(
        ...createSignalsFromHerdStageInsight(insight),
      );
    }
  }

  return signals;
}
