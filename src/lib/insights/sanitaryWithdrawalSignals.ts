import {
  createAnswerableInsight,
  createAnswerableSourceContract,
} from "@/lib/insights/sourceContract";
import type { OperationalInsight } from "@/lib/insights/types";

export interface SanitaryWithdrawalEventInput {
  id: string;
  animalId: string | null;
  deletedAt?: string | null;
  produto?: string | null;
  carenciaCarneAte?: string | null;
  carenciaLeiteAte?: string | null;
  carenciaCarneDias?: number | null;
  carenciaLeiteDias?: number | null;
}

export interface SanitaryWithdrawalSignalSummary {
  source: "eventos_sanitario_structured";
  activeCount: number;
  freeCount: number;
  evaluatedEventCount: number;
  activeEventIds: string[];
  freeEventIds: string[];
}

export interface SanitaryTraceabilityEventInput {
  id: string;
  occurredAt?: string | null;
  animalId?: string | null;
  loteId?: string | null;
  deletedAt?: string | null;
  produtoVeterinarioId?: string | null;
  produtoNome?: string | null;
  estoqueLoteId?: string | null;
  estoqueLoteCodigo?: string | null;
  validadeProduto?: string | null;
  doseQuantidade?: number | null;
  doseUnidade?: string | null;
  viaAplicacao?: string | null;
  custoUnitarioSnapshot?: number | null;
  custoTotalSnapshot?: number | null;
}

export interface SanitaryTraceabilitySignalSummary {
  source: "eventos_sanitario_structured";
  evaluatedEventCount: number;
  missingTraceabilityCount: number;
  productWithoutStockLotCount: number;
  stockInconsistencyCount: number;
  missingCostCount: number;
  missingTraceabilityEventIds: string[];
  productWithoutStockLotEventIds: string[];
  stockInconsistencyEventIds: string[];
  missingCostEventIds: string[];
}

const dateKey = (value: string): string => value.split("T")[0];

const hasConfiguredWithdrawal = (event: SanitaryWithdrawalEventInput): boolean =>
  Boolean(
    (typeof event.carenciaCarneDias === "number" && event.carenciaCarneDias > 0) ||
      (typeof event.carenciaLeiteDias === "number" && event.carenciaLeiteDias > 0),
  );

export function summarizeStructuredSanitaryWithdrawal(
  events: readonly SanitaryWithdrawalEventInput[],
  referenceDate: string,
): SanitaryWithdrawalSignalSummary {
  const ref = dateKey(referenceDate);
  const activeEventIds: string[] = [];
  const freeEventIds: string[] = [];

  for (const event of events) {
    if (event.deletedAt) continue;
    if (!event.animalId) continue;
    if (!hasConfiguredWithdrawal(event)) continue;

    const ends = [event.carenciaCarneAte, event.carenciaLeiteAte].filter(
      (value): value is string => Boolean(value),
    );
    const active = ends.some((end) => dateKey(end) >= ref);

    if (active) {
      activeEventIds.push(event.id);
    } else {
      freeEventIds.push(event.id);
    }
  }

  return {
    source: "eventos_sanitario_structured",
    activeCount: activeEventIds.length,
    freeCount: freeEventIds.length,
    evaluatedEventCount: activeEventIds.length + freeEventIds.length,
    activeEventIds,
    freeEventIds,
  };
}

export function createSanitaryWithdrawalSignalsInsight(input: {
  question: string;
  generatedAt: string;
  referenceDate: string;
  events: readonly SanitaryWithdrawalEventInput[];
}): OperationalInsight<SanitaryWithdrawalSignalSummary> {
  const data = summarizeStructuredSanitaryWithdrawal(
    input.events,
    input.referenceDate,
  );

  return createAnswerableInsight({
    questionKind: "historical_kpi",
    question: input.question,
    generatedAt: input.generatedAt,
    filters: {},
    period: {
      start: dateKey(input.referenceDate),
      end: dateKey(input.referenceDate),
    },
    source: createAnswerableSourceContract({
      primarySource: "eventos_sanitario",
      excludedSources: ["agenda_itens", "protocolos_sanitarios"],
      limitations: [
        "Carencia calculada somente de colunas estruturadas do evento sanitario executado.",
        "Sinais nao autorizam venda ou abate.",
      ],
    }),
    resultStatus: data.evaluatedEventCount > 0 ? "complete" : "empty",
    data,
  });
}

const hasProduct = (event: SanitaryTraceabilityEventInput): boolean =>
  Boolean(event.produtoVeterinarioId || event.produtoNome);

const hasDoseVia = (event: SanitaryTraceabilityEventInput): boolean =>
  typeof event.doseQuantidade === "number" &&
  Number.isFinite(event.doseQuantidade) &&
  event.doseQuantidade > 0 &&
  Boolean(event.doseUnidade) &&
  Boolean(event.viaAplicacao);

const isExpiredStockLot = (event: SanitaryTraceabilityEventInput): boolean => {
  if (!event.validadeProduto || !event.occurredAt) return false;
  return dateKey(event.validadeProduto) < dateKey(event.occurredAt);
};

export function summarizeStructuredSanitaryTraceability(
  events: readonly SanitaryTraceabilityEventInput[],
): SanitaryTraceabilitySignalSummary {
  const missingTraceabilityEventIds: string[] = [];
  const productWithoutStockLotEventIds: string[] = [];
  const stockInconsistencyEventIds: string[] = [];
  const missingCostEventIds: string[] = [];

  for (const event of events) {
    if (event.deletedAt) continue;

    const productPresent = hasProduct(event);
    if (!productPresent || !hasDoseVia(event)) {
      missingTraceabilityEventIds.push(event.id);
    }

    if (productPresent && !event.estoqueLoteId) {
      productWithoutStockLotEventIds.push(event.id);
    }

    if (
      event.estoqueLoteId &&
      (!event.estoqueLoteCodigo || !event.validadeProduto || isExpiredStockLot(event))
    ) {
      stockInconsistencyEventIds.push(event.id);
    }

    if (productPresent && event.custoTotalSnapshot == null) {
      missingCostEventIds.push(event.id);
    }
  }

  return {
    source: "eventos_sanitario_structured",
    evaluatedEventCount: events.filter((event) => !event.deletedAt).length,
    missingTraceabilityCount: missingTraceabilityEventIds.length,
    productWithoutStockLotCount: productWithoutStockLotEventIds.length,
    stockInconsistencyCount: stockInconsistencyEventIds.length,
    missingCostCount: missingCostEventIds.length,
    missingTraceabilityEventIds,
    productWithoutStockLotEventIds,
    stockInconsistencyEventIds,
    missingCostEventIds,
  };
}

export function createSanitaryTraceabilitySignalsInsight(input: {
  question: string;
  generatedAt: string;
  events: readonly SanitaryTraceabilityEventInput[];
}): OperationalInsight<SanitaryTraceabilitySignalSummary> {
  const data = summarizeStructuredSanitaryTraceability(input.events);

  return createAnswerableInsight({
    questionKind: "historical_kpi",
    question: input.question,
    generatedAt: input.generatedAt,
    filters: {},
    period: {
      start: dateKey(input.generatedAt),
      end: dateKey(input.generatedAt),
    },
    source: createAnswerableSourceContract({
      primarySource: "eventos_sanitario",
      excludedSources: ["agenda_itens", "protocolos_sanitarios"],
      limitations: [
        "Rastreabilidade sanitaria e calculada somente por colunas estruturadas do evento executado.",
        "Sinais nao autorizam venda ou abate.",
      ],
    }),
    resultStatus: data.evaluatedEventCount > 0 ? "complete" : "empty",
    data,
  });
}
