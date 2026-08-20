import type {
  FinanceTransaction,
  Evento,
  EventoComercial,
  EventoFinanceiro,
} from "@/lib/offline/types";

export type EconomicItemSource =
  | "ledger_manual"
  | "ledger_linked"
  | "evento_financeiro_linked"
  | "evento_financeiro_isolated"
  | "comercial_isolated"
  | "comercial_linked"
  | "comercial_simulation"
  | "legacy_comercial";

export interface EconomicItemClassification {
  sourceType: EconomicItemSource;
  isRealizedCash: boolean;
  isCompetence: boolean;
  isForecast: boolean;
  isCommercialOperation: boolean;
  includedInCashAggregate: boolean;
  includedInCommercialAggregate: boolean;
  limitations: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const COMMERCIAL_SIMULATION_KINDS = new Set([
  "simulation",
  "commercial_simulation",
  "simulacao",
  "simulacao_comercial",
]);

export function isCommercialSimulation(
  evento: Evento,
  detalhe?: EventoComercial,
): boolean {
  const payload = asRecord(evento.payload);
  const snapshot = asRecord(detalhe?.snapshot);
  const explicitBoolean = [
    payload?.simulation,
    payload?.is_simulation,
    snapshot?.simulation,
    snapshot?.is_simulation,
  ].some((value) => value === true);
  const hasSimulationKind = [
    payload?.kind,
    payload?.operation_kind,
    snapshot?.kind,
    snapshot?.operation_kind,
  ].some(
    (value) =>
      typeof value === "string" &&
      COMMERCIAL_SIMULATION_KINDS.has(value.trim().toLowerCase()),
  );

  return explicitBoolean || hasSimulationKind;
}

export function isCommercialOperationV2(evento: Evento): boolean {
  const payload = asRecord(evento.payload);
  return payload?.kind === "commercial_operation_v2";
}

/**
 * Determina se uma transação do ledger é efetivamente considerada "Caixa Realizado".
 * Exige status "realizado" e paid_at preenchido.
 */
export function isRealizedCashTransaction(tx: FinanceTransaction): boolean {
  return tx.status === "realizado" && tx.paid_at !== null;
}

export type FinanceLinkResolution = {
  transaction?: FinanceTransaction;
  duplicate: boolean;
  crossFarm: boolean;
};

/**
 * Resolve a factual-event link only by explicit identity and farm scope.
 * Multiple ledger records for one source event are treated as a conflict rather
 * than being silently selected by last-write-wins.
 */
export function resolveFinancialEventLink(input: {
  fazendaId: string;
  eventId: string;
  transactions: readonly FinanceTransaction[];
}): FinanceLinkResolution {
  const candidates = input.transactions.filter(
    (transaction) => transaction.source_event_id === input.eventId,
  );
  const sameFarm = candidates.filter(
    (transaction) => transaction.fazenda_id === input.fazendaId,
  );
  return {
    transaction: sameFarm.length === 1 ? sameFarm[0] : undefined,
    duplicate: sameFarm.length > 1,
    crossFarm: candidates.length > 0 && sameFarm.length === 0,
  };
}

export function resolveCommercialFinanceLink(input: {
  fazendaId: string;
  financeTransactionId: string | null | undefined;
  transactions: readonly FinanceTransaction[];
}): FinanceLinkResolution {
  if (!input.financeTransactionId) {
    return { duplicate: false, crossFarm: false };
  }
  const candidates = input.transactions.filter(
    (transaction) => transaction.id === input.financeTransactionId,
  );
  const sameFarm = candidates.filter(
    (transaction) => transaction.fazenda_id === input.fazendaId,
  );
  return {
    transaction: sameFarm.length === 1 ? sameFarm[0] : undefined,
    duplicate: sameFarm.length > 1,
    crossFarm: candidates.length > 0 && sameFarm.length === 0,
  };
}

/**
 * Classifica um lançamento do ledger gerencial isoladamente.
 */
export function classifyLedgerTransaction(
  tx: FinanceTransaction,
): EconomicItemClassification {
  const isCash = isRealizedCashTransaction(tx);
  const isForecast = tx.status === "previsto";
  const isCompetence = tx.competence_date !== null;

  return {
    sourceType: tx.source_event_id !== null ? "ledger_linked" : "ledger_manual",
    isRealizedCash: isCash,
    isCompetence,
    isForecast,
    isCommercialOperation: false,
    includedInCashAggregate: isCash,
    includedInCommercialAggregate: false,
    limitations:
      tx.source_event_id === null
        ? ["Lançamento manual sem evento histórico vinculado."]
        : [],
  };
}

/**
 * Classifica um evento financeiro histórico.
 */
export function classifyFinancialEvent(
  evento: Evento,
  detalhe: EventoFinanceiro,
  linkedTx?: FinanceTransaction,
): EconomicItemClassification {
  if (linkedTx) {
    const txClass = classifyLedgerTransaction(linkedTx);
    return {
      ...txClass,
      sourceType: "evento_financeiro_linked",
      limitations: [
        "Efeito econômico deduplicado pelo lançamento financeiro vinculado.",
      ],
    };
  }

  return {
    sourceType: "evento_financeiro_isolated",
    isRealizedCash: true,
    isCompetence: false,
    isForecast: false,
    isCommercialOperation: false,
    includedInCashAggregate: true,
    includedInCommercialAggregate: false,
    limitations: ["Evento financeiro histórico sem lançamento gerencial."],
  };
}

/**
 * Classifica uma operação comercial.
 */
export function classifyCommercialOperation(
  evento: Evento,
  detalhe: EventoComercial,
  linkedTx?: FinanceTransaction,
): EconomicItemClassification {
  if (isCommercialSimulation(evento, detalhe)) {
    return {
      sourceType: "comercial_simulation",
      isRealizedCash: false,
      isCompetence: false,
      isForecast: false,
      isCommercialOperation: false,
      includedInCashAggregate: false,
      includedInCommercialAggregate: false,
      limitations: ["Simulação comercial não gera fato econômico."],
    };
  }

  if (!isCommercialOperationV2(evento)) {
    return {
      sourceType: "legacy_comercial",
      isRealizedCash: false,
      isCompetence: false,
      isForecast: false,
      isCommercialOperation: false,
      includedInCashAggregate: false,
      includedInCommercialAggregate: false,
      limitations: ["Operação comercial legada ignorada na leitura v2."],
    };
  }

  if (linkedTx) {
    const txClass = classifyLedgerTransaction(linkedTx);
    return {
      sourceType: "comercial_linked",
      isRealizedCash: txClass.isRealizedCash,
      isCompetence: txClass.isCompetence,
      isForecast: txClass.isForecast,
      isCommercialOperation: true,
      includedInCashAggregate: txClass.includedInCashAggregate,
      includedInCommercialAggregate: true,
      limitations: [
        "Caixa derivado exclusivamente do lançamento financeiro vinculado.",
      ],
    };
  }

  return {
    sourceType: "comercial_isolated",
    isRealizedCash: false,
    isCompetence: false,
    isForecast: false,
    isCommercialOperation: true,
    includedInCashAggregate: false,
    includedInCommercialAggregate: true,
    limitations: [
      "Operação comercial sem lançamento financeiro vinculado não entra no caixa.",
    ],
  };
}
