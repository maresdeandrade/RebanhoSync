import type {
  Evento,
  EventoComercial,
  FinanceCategory,
  FinanceCategoryTipoEnum,
  FinanceTransaction,
} from "@/lib/offline/types";
import {
  isCommercialOperationV2,
  isCommercialSimulation,
} from "@/lib/finance/classification";

export type EconomicCoverageStatus =
  | "AVAILABLE"
  | "PARTIAL"
  | "INSUFFICIENT_COVERAGE"
  | "CONFLICT";

export type EconomicSourceCoverageState = "VERIFIED" | "PARTIAL" | "UNKNOWN";

export interface EconomicCoveragePeriod {
  from: string;
  to: string;
  timezone: string;
  boundary: "inclusive";
  factualDateField: "finance_transactions.paid_at";
}

export interface EconomicSourceCoverage {
  financeTransactions: EconomicSourceCoverageState;
  financeCategories: EconomicSourceCoverageState;
  commercialOperations: EconomicSourceCoverageState;
}

export interface EconomicObservedFact {
  transactionId: string;
  clientOpId: string;
  paidAt: string;
  amount: number;
  effect: "OBSERVATION" | "REVERSAL";
  categoryId: string;
  categoryType: FinanceCategoryTipoEnum;
}

export interface EconomicObservedAmount {
  amount: number | null;
  grossAmount: number | null;
  reversalAmount: number | null;
  facts: EconomicObservedFact[];
}

export type EconomicUnclassifiedReason =
  | "REALIZED_WITHOUT_PAID_AT"
  | "MISSING_CATEGORY_REFERENCE"
  | "CATEGORY_NOT_LOADED"
  | "CATEGORY_DELETED"
  | "CATEGORY_INACTIVE"
  | "UNSUPPORTED_CATEGORY_TYPE";

export interface EconomicUnclassifiedTransaction {
  transactionId: string;
  categoryId: string | null;
  reason: EconomicUnclassifiedReason;
}

export interface EconomicReversalEvidence {
  transactionId: string;
  reversesTransactionId: string;
  amount: number;
  appliedTo: "REVENUE" | "COST" | null;
}

export type CommercialFinanceGapReason =
  | "MISSING_FINANCE_REFERENCE"
  | "UNRESOLVED_FINANCE_REFERENCE";

export interface CommercialEventWithoutFinance {
  eventId: string;
  operationType: "compra" | "venda";
  occurredAt: string;
  financeTransactionId: string | null;
  reason: CommercialFinanceGapReason;
}

export interface EconomicCoverageConflict {
  code:
    | "DUPLICATE_TRANSACTION_IDENTITY"
    | "CATEGORY_IDENTITY_CONFLICT"
    | "CATEGORY_CROSS_FARM"
    | "INVALID_TRANSACTION_VALUE"
    | "INVALID_TRANSACTION_DATE"
    | "DIRECTION_CATEGORY_CONFLICT"
    | "INVALID_REVERSAL_LINK"
    | "REVERSAL_CROSS_FARM"
    | "REVERSAL_FACT_MISMATCH"
    | "COMMERCIAL_CROSS_FARM_LINK";
  recordIds: string[];
  description: string;
}

export interface EconomicCoverageResult {
  fazendaId: string;
  period: EconomicCoveragePeriod;
  status: EconomicCoverageStatus;
  observedRevenue: EconomicObservedAmount;
  observedCosts: EconomicObservedAmount;
  unclassifiedTransactions: EconomicUnclassifiedTransaction[];
  reversals: EconomicReversalEvidence[];
  commercialEventsWithoutFinance: CommercialEventWithoutFinance[];
  coverage: {
    sources: EconomicSourceCoverage;
    inputTransactionCount: number;
    farmTransactionCount: number;
    realizedTransactionsInPeriod: number;
    observedFactCount: number;
    deduplicatedTransactionCount: number;
    excludedOutsidePeriod: number;
    forecastTransactionCount: number;
    cancelledTransactionCount: number;
  };
  limitations: string[];
  conflicts: EconomicCoverageConflict[];
}

export interface SelectEconomicCoverageInput {
  fazendaId: string;
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  sourceCoverage: EconomicSourceCoverage;
  transactions: readonly FinanceTransaction[];
  categories: readonly FinanceCategory[];
  events: readonly Evento[];
  commercialDetails: readonly EventoComercial[];
}

type EconomicKind = "REVENUE" | "COST";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COST_CATEGORY_TYPES = new Set<FinanceCategoryTipoEnum>([
  "custo_variavel",
  "custo_fixo",
]);

function assertDateKey(value: string, field: string): void {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
}

function assertInput(input: SelectEconomicCoverageInput): void {
  if (!input.fazendaId.trim()) throw new Error("fazendaId is required");
  assertDateKey(input.period.from, "period.from");
  assertDateKey(input.period.to, "period.to");
  if (input.period.from > input.period.to) {
    throw new Error("period.from must be before or equal to period.to");
  }
  if (!input.period.timezone.trim())
    throw new Error("period.timezone is required");
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: input.period.timezone,
    }).format();
  } catch {
    throw new Error("period.timezone must be a valid IANA timezone");
  }
}

function dateKeyInTimezone(timestamp: string, timezone: string): string | null {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function semanticTransactionFingerprint(
  transaction: FinanceTransaction,
): string {
  return JSON.stringify({
    fazendaId: transaction.fazenda_id,
    occurredAt: transaction.occurred_at,
    paidAt: transaction.paid_at,
    direction: transaction.direction,
    status: transaction.status,
    categoryId: transaction.category_id,
    amount: transaction.valor_total,
    origin: transaction.origem,
    sourceEventId: transaction.source_event_id,
    reversesTransactionId: transaction.reverses_transaction_id ?? null,
    deletedAt: transaction.deleted_at,
  });
}

function deduplicateTransactionIds(
  transactions: readonly FinanceTransaction[],
  conflicts: EconomicCoverageConflict[],
): { transactions: FinanceTransaction[]; count: number } {
  const byId = new Map<string, FinanceTransaction[]>();
  for (const transaction of transactions) {
    const group = byId.get(transaction.id) ?? [];
    group.push(transaction);
    byId.set(transaction.id, group);
  }
  const result: FinanceTransaction[] = [];
  let count = 0;
  for (const [id, group] of byId) {
    const fingerprints = unique(group.map(semanticTransactionFingerprint));
    if (fingerprints.length > 1) {
      conflicts.push({
        code: "DUPLICATE_TRANSACTION_IDENTITY",
        recordIds: [id],
        description:
          "Registros divergentes compartilham o mesmo finance_transactions.id.",
      });
      continue;
    }
    result.push(group[0]);
    count += group.length - 1;
  }
  return { transactions: result, count };
}

function deduplicateTransactionOperations(
  transactions: readonly FinanceTransaction[],
  conflicts: EconomicCoverageConflict[],
): { transactions: FinanceTransaction[]; count: number } {
  const byClientOperation = new Map<string, FinanceTransaction[]>();
  for (const transaction of transactions) {
    const key = transaction.client_op_id?.trim() || `id:${transaction.id}`;
    const group = byClientOperation.get(key) ?? [];
    group.push(transaction);
    byClientOperation.set(key, group);
  }
  const result: FinanceTransaction[] = [];
  let count = 0;
  for (const group of byClientOperation.values()) {
    const fingerprints = unique(group.map(semanticTransactionFingerprint));
    if (fingerprints.length > 1) {
      conflicts.push({
        code: "DUPLICATE_TRANSACTION_IDENTITY",
        recordIds: group.map((transaction) => transaction.id),
        description:
          "Registros divergentes compartilham o mesmo finance_transactions.client_op_id.",
      });
      continue;
    }
    result.push(group[0]);
    count += group.length - 1;
  }
  return { transactions: result, count };
}

function deduplicateTransactions(
  transactions: readonly FinanceTransaction[],
  conflicts: EconomicCoverageConflict[],
): { transactions: FinanceTransaction[]; deduplicatedCount: number } {
  const sorted = [...transactions].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const byId = deduplicateTransactionIds(sorted, conflicts);
  const byOperation = deduplicateTransactionOperations(
    byId.transactions,
    conflicts,
  );
  return {
    transactions: byOperation.transactions.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    deduplicatedCount: byId.count + byOperation.count,
  };
}

function buildCategoryIndex(
  input: SelectEconomicCoverageInput,
  conflicts: EconomicCoverageConflict[],
): Map<string, FinanceCategory> {
  const localCategories = input.categories.filter(
    (category) => category.fazenda_id === input.fazendaId,
  );
  const grouped = new Map<string, FinanceCategory[]>();
  for (const category of localCategories) {
    const group = grouped.get(category.id) ?? [];
    group.push(category);
    grouped.set(category.id, group);
  }

  const index = new Map<string, FinanceCategory>();
  for (const [id, group] of grouped) {
    const variants = unique(
      group.map((category) =>
        JSON.stringify({
          type: category.tipo,
          active: category.ativo,
          deletedAt: category.deleted_at,
        }),
      ),
    );
    if (variants.length > 1) {
      conflicts.push({
        code: "CATEGORY_IDENTITY_CONFLICT",
        recordIds: [id],
        description: "Categorias divergentes compartilham a mesma identidade.",
      });
      continue;
    }
    index.set(id, group[0]);
  }
  return index;
}

type CategoryResolutionInput = {
  transaction: FinanceTransaction;
  categoryIndex: Map<string, FinanceCategory>;
  allCategories: readonly FinanceCategory[];
  fazendaId: string;
  unclassified: EconomicUnclassifiedTransaction[];
  conflicts: EconomicCoverageConflict[];
};

function recordUnclassifiedCategory(
  input: CategoryResolutionInput,
  categoryId: string | null,
  reason: EconomicUnclassifiedReason,
): null {
  input.unclassified.push({
    transactionId: input.transaction.id,
    categoryId,
    reason,
  });
  return null;
}

function resolveUsableCategory(
  input: CategoryResolutionInput,
): FinanceCategory | null {
  const { transaction } = input;
  const categoryId = transaction.category_id?.trim();
  if (!categoryId) {
    return recordUnclassifiedCategory(
      input,
      null,
      "MISSING_CATEGORY_REFERENCE",
    );
  }
  const category = input.categoryIndex.get(categoryId);
  if (!category) {
    const existsCrossFarm = input.allCategories.some(
      (candidate) =>
        candidate.id === categoryId && candidate.fazenda_id !== input.fazendaId,
    );
    if (existsCrossFarm) {
      input.conflicts.push({
        code: "CATEGORY_CROSS_FARM",
        recordIds: [transaction.id, categoryId],
        description:
          "A categoria referenciada existe somente em outra fazenda.",
      });
      return null;
    }
    return recordUnclassifiedCategory(input, categoryId, "CATEGORY_NOT_LOADED");
  }
  if (category.deleted_at) {
    return recordUnclassifiedCategory(input, categoryId, "CATEGORY_DELETED");
  }
  if (!category.ativo) {
    return recordUnclassifiedCategory(input, categoryId, "CATEGORY_INACTIVE");
  }
  return category;
}

function resolveCategoryKind(
  input: CategoryResolutionInput,
): { kind: EconomicKind; category: FinanceCategory } | null {
  const category = resolveUsableCategory(input);
  if (!category) return null;
  const kind =
    category.tipo === "receita"
      ? "REVENUE"
      : COST_CATEGORY_TYPES.has(category.tipo)
        ? "COST"
        : null;
  if (!kind) {
    return recordUnclassifiedCategory(
      input,
      category.id,
      "UNSUPPORTED_CATEGORY_TYPE",
    );
  }
  const expectedDirection = kind === "REVENUE" ? "entrada" : "saida";
  if (input.transaction.direction !== expectedDirection) {
    input.conflicts.push({
      code: "DIRECTION_CATEGORY_CONFLICT",
      recordIds: [input.transaction.id, category.id],
      description: `Direcao ${input.transaction.direction} diverge da categoria ${category.tipo}.`,
    });
    return null;
  }
  return { kind, category };
}

function emptyObservedAmount(): EconomicObservedAmount {
  return {
    amount: null,
    grossAmount: null,
    reversalAmount: null,
    facts: [],
  };
}

function finalizeObservedAmount(
  target: EconomicObservedAmount,
): EconomicObservedAmount {
  if (target.facts.length === 0) return target;
  const grossAmount = target.facts
    .filter((fact) => fact.effect === "OBSERVATION")
    .reduce((total, fact) => total + fact.amount, 0);
  const reversalAmount = target.facts
    .filter((fact) => fact.effect === "REVERSAL")
    .reduce((total, fact) => total + fact.amount, 0);
  return {
    amount: grossAmount - reversalAmount,
    grossAmount,
    reversalAmount,
    facts: [...target.facts].sort((left, right) =>
      left.transactionId.localeCompare(right.transactionId),
    ),
  };
}

type CommercialGapContext = {
  source: SelectEconomicCoverageInput;
  localTransactions: readonly FinanceTransaction[];
  conflicts: EconomicCoverageConflict[];
};

function commercialDetailsInPeriod(
  input: SelectEconomicCoverageInput,
): EventoComercial[] {
  return input.commercialDetails
    .filter(
      (detail) =>
        detail.fazenda_id === input.fazendaId &&
        !detail.deleted_at &&
        (() => {
          const key = dateKeyInTimezone(
            detail.occurred_at,
            input.period.timezone,
          );
          return Boolean(
            key && key >= input.period.from && key <= input.period.to,
          );
        })(),
    )
    .sort((left, right) => left.evento_id.localeCompare(right.evento_id));
}

function resolveCommercialGap(
  detail: EventoComercial,
  input: CommercialGapContext,
  localTransactionIds: Set<string>,
): CommercialEventWithoutFinance | null {
  const event = input.source.events.find(
    (candidate) =>
      candidate.id === detail.evento_id &&
      candidate.fazenda_id === input.source.fazendaId &&
      candidate.dominio === "comercial" &&
      !candidate.deleted_at,
  );
  if (
    !event ||
    !isCommercialOperationV2(event) ||
    isCommercialSimulation(event, detail)
  ) {
    return null;
  }
  const financeTransactionId = detail.finance_transaction_id;
  if (!financeTransactionId) {
    return {
      eventId: detail.evento_id,
      operationType: detail.operation_type,
      occurredAt: detail.occurred_at,
      financeTransactionId: null,
      reason: "MISSING_FINANCE_REFERENCE",
    };
  }
  if (localTransactionIds.has(financeTransactionId)) return null;
  const crossFarm = input.source.transactions.some(
    (transaction) =>
      transaction.id === financeTransactionId &&
      transaction.fazenda_id !== input.source.fazendaId,
  );
  if (crossFarm) {
    input.conflicts.push({
      code: "COMMERCIAL_CROSS_FARM_LINK",
      recordIds: [detail.evento_id, financeTransactionId],
      description:
        "A operacao comercial referencia transacao financeira de outra fazenda.",
    });
    return null;
  }
  return {
    eventId: detail.evento_id,
    operationType: detail.operation_type,
    occurredAt: detail.occurred_at,
    financeTransactionId,
    reason: "UNRESOLVED_FINANCE_REFERENCE",
  };
}

function collectCommercialGaps(
  input: CommercialGapContext,
): CommercialEventWithoutFinance[] {
  const localTransactionIds = new Set(
    input.localTransactions.map((transaction) => transaction.id),
  );
  const gaps: CommercialEventWithoutFinance[] = [];
  for (const detail of commercialDetailsInPeriod(input.source)) {
    const gap = resolveCommercialGap(detail, input, localTransactionIds);
    if (gap) gaps.push(gap);
  }
  return gaps;
}

type MutableCoverageCounts = {
  realizedTransactionsInPeriod: number;
  excludedOutsidePeriod: number;
  forecastTransactionCount: number;
  cancelledTransactionCount: number;
};

type TransactionClassificationContext = {
  input: SelectEconomicCoverageInput;
  transactions: readonly FinanceTransaction[];
  transactionById: Map<string, FinanceTransaction>;
  categoryIndex: Map<string, FinanceCategory>;
  conflicts: EconomicCoverageConflict[];
  unclassified: EconomicUnclassifiedTransaction[];
  reversals: EconomicReversalEvidence[];
  revenue: EconomicObservedAmount;
  costs: EconomicObservedAmount;
  counts: MutableCoverageCounts;
};

function categoryInput(
  transaction: FinanceTransaction,
  context: TransactionClassificationContext,
): CategoryResolutionInput {
  return {
    transaction,
    categoryIndex: context.categoryIndex,
    allCategories: context.input.categories,
    fazendaId: context.input.fazendaId,
    unclassified: context.unclassified,
    conflicts: context.conflicts,
  };
}

function isObservedInPeriod(
  transaction: FinanceTransaction,
  context: TransactionClassificationContext,
): boolean {
  if (transaction.status === "cancelado") {
    context.counts.cancelledTransactionCount += 1;
    return false;
  }
  if (transaction.status === "previsto") {
    context.counts.forecastTransactionCount += 1;
    return false;
  }
  if (transaction.status !== "realizado") return false;
  if (!transaction.paid_at) {
    context.unclassified.push({
      transactionId: transaction.id,
      categoryId: transaction.category_id || null,
      reason: "REALIZED_WITHOUT_PAID_AT",
    });
    return false;
  }
  const key = dateKeyInTimezone(
    transaction.paid_at,
    context.input.period.timezone,
  );
  if (!key) {
    context.conflicts.push({
      code: "INVALID_TRANSACTION_DATE",
      recordIds: [transaction.id],
      description: "paid_at nao representa um instante valido.",
    });
    return false;
  }
  if (key < context.input.period.from || key > context.input.period.to) {
    context.counts.excludedOutsidePeriod += 1;
    return false;
  }
  context.counts.realizedTransactionsInPeriod += 1;
  return true;
}

function hasValidEconomicValue(
  transaction: FinanceTransaction,
  conflicts: EconomicCoverageConflict[],
): boolean {
  const valid =
    typeof transaction.valor_total === "number" &&
    Number.isFinite(transaction.valor_total) &&
    transaction.valor_total > 0;
  if (!valid) {
    conflicts.push({
      code: "INVALID_TRANSACTION_VALUE",
      recordIds: [transaction.id],
      description: "valor_total deve ser positivo e finito.",
    });
  }
  return valid;
}

function addObservedFact(
  transaction: FinanceTransaction,
  classification: { kind: EconomicKind; category: FinanceCategory },
  effect: EconomicObservedFact["effect"],
  context: TransactionClassificationContext,
): void {
  const target =
    classification.kind === "REVENUE" ? context.revenue : context.costs;
  target.facts.push({
    transactionId: transaction.id,
    clientOpId: transaction.client_op_id,
    paidAt: transaction.paid_at!,
    amount: transaction.valor_total,
    effect,
    categoryId: classification.category.id,
    categoryType: classification.category.tipo,
  });
}

function resolveReversalOriginal(
  transaction: FinanceTransaction,
  context: TransactionClassificationContext,
): FinanceTransaction | null {
  const targetId = transaction.reverses_transaction_id;
  if (transaction.origem !== "estorno" || !targetId) {
    context.conflicts.push({
      code: "INVALID_REVERSAL_LINK",
      recordIds: [transaction.id],
      description:
        "Estorno exige origem estorno e reverses_transaction_id explicito.",
    });
    return null;
  }
  const original = context.transactionById.get(targetId);
  if (original) return original;
  const crossFarm = context.input.transactions.some(
    (candidate) =>
      candidate.id === targetId &&
      candidate.fazenda_id !== context.input.fazendaId,
  );
  context.conflicts.push({
    code: crossFarm ? "REVERSAL_CROSS_FARM" : "INVALID_REVERSAL_LINK",
    recordIds: [transaction.id, targetId],
    description: crossFarm
      ? "Estorno referencia transacao de outra fazenda."
      : "Transacao original do estorno nao foi localizada.",
  });
  return null;
}

function reversalMatchesOriginal(
  reversal: FinanceTransaction,
  original: FinanceTransaction,
  conflicts: EconomicCoverageConflict[],
): boolean {
  const matches =
    original.id !== reversal.id &&
    original.direction !== reversal.direction &&
    original.category_id === reversal.category_id &&
    original.valor_total === reversal.valor_total;
  if (!matches) {
    conflicts.push({
      code: "REVERSAL_FACT_MISMATCH",
      recordIds: [reversal.id, original.id],
      description:
        "Estorno diverge da direcao oposta, categoria ou valor do original.",
    });
  }
  return matches;
}

function applyReversal(
  transaction: FinanceTransaction,
  context: TransactionClassificationContext,
): void {
  const original = resolveReversalOriginal(transaction, context);
  if (
    !original ||
    !reversalMatchesOriginal(transaction, original, context.conflicts)
  ) {
    return;
  }
  const classification = resolveCategoryKind(categoryInput(original, context));
  context.reversals.push({
    transactionId: transaction.id,
    reversesTransactionId: original.id,
    amount: transaction.valor_total,
    appliedTo: classification?.kind ?? null,
  });
  if (classification)
    addObservedFact(transaction, classification, "REVERSAL", context);
}

function classifyTransaction(
  transaction: FinanceTransaction,
  context: TransactionClassificationContext,
): void {
  if (!isObservedInPeriod(transaction, context)) return;
  if (!hasValidEconomicValue(transaction, context.conflicts)) return;
  const isReversal =
    transaction.origem === "estorno" ||
    transaction.reverses_transaction_id != null;
  if (isReversal) {
    applyReversal(transaction, context);
    return;
  }
  const classification = resolveCategoryKind(
    categoryInput(transaction, context),
  );
  if (classification)
    addObservedFact(transaction, classification, "OBSERVATION", context);
}

function classifyTransactions(context: TransactionClassificationContext): void {
  for (const transaction of context.transactions) {
    classifyTransaction(transaction, context);
  }
}

function buildLimitations(input: {
  observedRevenue: EconomicObservedAmount;
  observedCosts: EconomicObservedAmount;
  sourcesVerified: boolean;
  unclassifiedCount: number;
  commercialGapCount: number;
  reversalCount: number;
}): string[] {
  const limitations = [
    "Coverage observada nao comprova contabilidade completa, lucro, margem ou rentabilidade.",
  ];
  if (input.observedRevenue.amount === null) {
    limitations.push(
      "Nenhuma receita factual classificada foi observada no periodo; ausencia nao equivale a receita zero.",
    );
  }
  if (input.observedCosts.amount === null) {
    limitations.push(
      "Nenhum custo factual classificado foi observado no periodo; ausencia nao equivale a custo zero.",
    );
  }
  if (!input.sourcesVerified) {
    limitations.push(
      "Uma ou mais fontes nao possuem coverage verificada para fazenda e periodo.",
    );
  }
  if (input.unclassifiedCount > 0) {
    limitations.push(
      "Transacoes sem classificacao suficiente foram preservadas fora dos totais observados.",
    );
  }
  if (input.commercialGapCount > 0) {
    limitations.push(
      "Operacoes comerciais sem financeiro associado permanecem lacunas e nao entram no caixa observado.",
    );
  }
  if (input.reversalCount > 0) {
    limitations.push(
      "Estornos foram aplicados como reversao do bucket original, nao como receita ou custo independente.",
    );
  }
  return limitations;
}

function resolveCoverageStatus(input: {
  conflictCount: number;
  observedFactCount: number;
  sourcesVerified: boolean;
  unclassifiedCount: number;
  commercialGapCount: number;
}): EconomicCoverageStatus {
  if (input.conflictCount > 0) return "CONFLICT";
  if (input.observedFactCount === 0) return "INSUFFICIENT_COVERAGE";
  if (
    !input.sourcesVerified ||
    input.unclassifiedCount > 0 ||
    input.commercialGapCount > 0
  ) {
    return "PARTIAL";
  }
  return "AVAILABLE";
}

export function selectEconomicCoverage(
  input: SelectEconomicCoverageInput,
): EconomicCoverageResult {
  assertInput(input);
  const conflicts: EconomicCoverageConflict[] = [];
  const unclassified: EconomicUnclassifiedTransaction[] = [];
  const reversals: EconomicReversalEvidence[] = [];
  const localInput = input.transactions.filter(
    (transaction) =>
      transaction.fazenda_id === input.fazendaId && !transaction.deleted_at,
  );
  const deduplicated = deduplicateTransactions(localInput, conflicts);
  const counts: MutableCoverageCounts = {
    realizedTransactionsInPeriod: 0,
    excludedOutsidePeriod: 0,
    forecastTransactionCount: 0,
    cancelledTransactionCount: 0,
  };
  const context: TransactionClassificationContext = {
    input,
    transactions: deduplicated.transactions,
    transactionById: new Map(
      deduplicated.transactions.map((transaction) => [
        transaction.id,
        transaction,
      ]),
    ),
    categoryIndex: buildCategoryIndex(input, conflicts),
    conflicts,
    unclassified,
    reversals,
    revenue: emptyObservedAmount(),
    costs: emptyObservedAmount(),
    counts,
  };
  classifyTransactions(context);
  return buildEconomicCoverageResult(
    input,
    context,
    deduplicated.deduplicatedCount,
  );
}

function buildEconomicCoverageResult(
  input: SelectEconomicCoverageInput,
  context: TransactionClassificationContext,
  deduplicatedTransactionCount: number,
): EconomicCoverageResult {
  const commercialGaps = collectCommercialGaps({
    source: input,
    localTransactions: context.transactions,
    conflicts: context.conflicts,
  });
  const observedRevenue = finalizeObservedAmount(context.revenue);
  const observedCosts = finalizeObservedAmount(context.costs);
  const observedFactCount =
    observedRevenue.facts.length + observedCosts.facts.length;
  const sourcesVerified = Object.values(input.sourceCoverage).every(
    (state) => state === "VERIFIED",
  );
  const statusInput = {
    conflictCount: context.conflicts.length,
    observedFactCount,
    sourcesVerified,
    unclassifiedCount: context.unclassified.length,
    commercialGapCount: commercialGaps.length,
  };
  return {
    fazendaId: input.fazendaId,
    period: {
      ...input.period,
      boundary: "inclusive",
      factualDateField: "finance_transactions.paid_at",
    },
    status: resolveCoverageStatus(statusInput),
    observedRevenue,
    observedCosts,
    unclassifiedTransactions: context.unclassified.sort((left, right) =>
      left.transactionId.localeCompare(right.transactionId),
    ),
    reversals: context.reversals.sort((left, right) =>
      left.transactionId.localeCompare(right.transactionId),
    ),
    commercialEventsWithoutFinance: commercialGaps,
    coverage: {
      sources: { ...input.sourceCoverage },
      inputTransactionCount: input.transactions.length,
      farmTransactionCount: context.transactions.length,
      observedFactCount,
      deduplicatedTransactionCount,
      ...context.counts,
    },
    limitations: buildLimitations({
      observedRevenue,
      observedCosts,
      sourcesVerified,
      unclassifiedCount: context.unclassified.length,
      commercialGapCount: commercialGaps.length,
      reversalCount: context.reversals.length,
    }),
    conflicts: context.conflicts,
  };
}
