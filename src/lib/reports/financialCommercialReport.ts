import type {
  Evento,
  EventoComercial,
  EventoFinanceiro,
  FinanceTransaction,
} from "@/lib/offline/types";
import {
  classifyCommercialOperation,
  isCommercialOperationV2,
  isCommercialSimulation,
  resolveCommercialFinanceLink,
  resolveFinancialEventLink,
} from "@/lib/finance/classification";
import { selectEconomicCoverage } from "@/lib/finance/economicCoverage";
import { calculateObservedEconomicResult } from "@/lib/finance/observedEconomicResult";
import type {
  CommercialTraceabilitySummary,
  OperationalSummaryInput,
  ReportRange,
  SanitaryTraceabilityCostRow,
} from "./operationalSummaryTypes";
import type { resolveMetricTimezone } from "./operationalSummaryCalendar";
import { asRecord, readNestedNumber } from "./reportPayload";
import {
  addTraceabilityCost,
  toSortedTraceabilityRows,
} from "./reportTraceability";

export interface FinancialReportInput {
  input: Pick<
    OperationalSummaryInput,
    | "fazendaId"
    | "financeTransactions"
    | "financeCategories"
    | "eventosComercial"
    | "eventos"
  >;
  eventos: Evento[];
  financeByEventId: ReadonlyMap<string, EventoFinanceiro>;
  range: ReportRange;
  metricTimezone: ReturnType<typeof resolveMetricTimezone>;
}

export interface CommercialReportInput {
  input: Pick<OperationalSummaryInput, "fazendaId">;
  eventos: Evento[];
  commercialByEventId: ReadonlyMap<string, EventoComercial>;
  activeFinanceTransactions: FinanceTransaction[];
  animalById: ReadonlyMap<string, string>;
  loteById: ReadonlyMap<string, string>;
}

function getCommercialTotalArrobas(detail: EventoComercial): number | null {
  const pricing = asRecord(detail.snapshot?.pricing);
  return readNestedNumber(pricing, "total_arrobas");
}

function calculateFinancialEvidence({
  input,
  range,
  metricTimezone,
}: Pick<FinancialReportInput, "input" | "range" | "metricTimezone">) {
  return calculateObservedEconomicResult(
    selectEconomicCoverage({
      fazendaId: input.fazendaId,
      period: {
        from: range.from,
        to: range.to,
        timezone: metricTimezone.timezone ?? "UTC",
      },
      sourceCoverage: {
        financeTransactions: input.financeTransactions ? "VERIFIED" : "UNKNOWN",
        financeCategories: input.financeCategories ? "VERIFIED" : "UNKNOWN",
        commercialOperations: input.eventosComercial ? "VERIFIED" : "UNKNOWN",
      },
      transactions: input.financeTransactions ?? [],
      categories: input.financeCategories ?? [],
      events: input.eventos,
      commercialDetails: input.eventosComercial ?? [],
    }),
  );
}

function createFinancialTotals(
  observedEconomicResult: ReturnType<typeof calculateFinancialEvidence>,
) {
  return {
    entradas:
      observedEconomicResult.status === "CALCULATED"
        ? observedEconomicResult.observedRevenue
        : null,
    saidas:
      observedEconomicResult.status === "CALCULATED"
        ? observedEconomicResult.observedCost
        : null,
    saldo:
      observedEconomicResult.status === "CALCULATED"
        ? observedEconomicResult.observedResult
        : null,
    transacoes:
      observedEconomicResult.coverage.coverage.realizedTransactionsInPeriod,
    compras: 0,
    vendas: 0,
    entradasCompetencia: 0,
    saidasCompetencia: 0,
    previstosAPagar: 0,
    previstosAReceber: 0,
    vencidosAPagar: 0,
    vencidosAReceber: 0,
    observedEconomicResult,
  };
}

type FinancialTotals = ReturnType<typeof createFinancialTotals>;
type DateInRange = (value: string | null | undefined) => boolean;

function addForecastDueTotals(
  financeiro: FinancialTotals,
  transaction: FinanceTransaction,
  range: ReportRange,
  isDateInRange: DateInRange,
) {
  if (isDateInRange(transaction.due_date)) {
    if (transaction.direction === "entrada") {
      financeiro.previstosAReceber += transaction.valor_total;
      if (transaction.due_date! < range.to)
        financeiro.vencidosAReceber += transaction.valor_total;
    } else {
      financeiro.previstosAPagar += transaction.valor_total;
      if (transaction.due_date! < range.to)
        financeiro.vencidosAPagar += transaction.valor_total;
    }
  }
}

function addCompetenceTotals(
  financeiro: FinancialTotals,
  transaction: FinanceTransaction,
  isDateInRange: DateInRange,
) {
  if (isDateInRange(transaction.competence_date)) {
    if (transaction.direction === "entrada")
      financeiro.entradasCompetencia += transaction.valor_total;
    else financeiro.saidasCompetencia += transaction.valor_total;
  }
}

export function buildFinancialReport({
  input,
  eventos,
  financeByEventId,
  range,
  metricTimezone,
}: FinancialReportInput) {
  const activeFinanceTransactions = (input.financeTransactions ?? []).filter(
    (transaction) =>
      !transaction.deleted_at &&
      Number.isFinite(transaction.valor_total) &&
      transaction.valor_total > 0,
  );
  const financeEvents = eventos
    .filter((evento) => evento.dominio === "financeiro")
    .map((evento) => ({
      evento,
      detalhe: financeByEventId.get(evento.id),
      link: resolveFinancialEventLink({
        fazendaId: input.fazendaId,
        eventId: evento.id,
        transactions: activeFinanceTransactions,
      }),
    }))
    .filter(
      (
        item,
      ): item is {
        evento: Evento;
        detalhe: EventoFinanceiro;
        link: ReturnType<typeof resolveFinancialEventLink>;
      } => Boolean(item.detalhe),
    );
  const isDateInRange = (value: string | null | undefined) => {
    if (!value) return false;
    const dateKey = value.slice(0, 10);
    return dateKey >= range.from && dateKey <= range.to;
  };

  const observedEconomicResult = calculateFinancialEvidence({
    input,
    range,
    metricTimezone,
  });

  const financeiro = createFinancialTotals(observedEconomicResult);

  for (const transaction of activeFinanceTransactions) {
    if (transaction.status === "cancelado") continue;
    if (isDateInRange(transaction.occurred_at)) {
      if (transaction.direction === "entrada") financeiro.vendas += 1;
      else financeiro.compras += 1;
    }

    if (transaction.status === "realizado") {
      addCompetenceTotals(financeiro, transaction, isDateInRange);
    } else if (transaction.status === "previsto") {
      addForecastDueTotals(financeiro, transaction, range, isDateInRange);
      addCompetenceTotals(financeiro, transaction, isDateInRange);
    }
  }

  return {
    activeFinanceTransactions,
    financeEvents,
    observedEconomicResult,
    financeiro,
  };
}

function createCommercialTraceability({
  animalById,
  loteById,
}: Pick<CommercialReportInput, "animalById" | "loteById">) {
  const commercialOperation = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialCounterparty = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialAnimal = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialLote = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialSociedade = new Map<string, SanitaryTraceabilityCostRow>();

  function addEvent(
    evento: Evento,
    detalhe: EventoComercial,
    normalizedAmount: number,
  ) {
    addTraceabilityCost(
      commercialOperation,
      detalhe.operation_type,
      detalhe.operation_type === "venda" ? "Venda" : "Compra",
      normalizedAmount,
    );
    addTraceabilityCost(
      commercialCounterparty,
      detalhe.contraparte_id,
      detalhe.contraparte_nome,
      normalizedAmount,
    );

    addAnimalCosts(evento, detalhe, normalizedAmount);
    addLoteCosts(evento, detalhe, normalizedAmount);
    addSociedadeCosts(detalhe, normalizedAmount);
  }

  function readSociedadeId(record: Record<string, unknown>) {
    return typeof record.sociedadeId === "string"
      ? record.sociedadeId
      : typeof record.sociedade_id === "string"
        ? record.sociedade_id
        : null;
  }

  function addAnimalCosts(
    evento: Evento,
    detalhe: EventoComercial,
    normalizedAmount: number,
  ) {
    for (const animalId of detalhe.animal_ids ??
      (evento.animal_id ? [evento.animal_id] : [])) {
      addTraceabilityCost(
        commercialAnimal,
        animalId,
        animalById.get(animalId) ?? animalId,
        normalizedAmount,
      );
    }
  }

  function addLoteCosts(
    evento: Evento,
    detalhe: EventoComercial,
    normalizedAmount: number,
  ) {
    addTraceabilityCost(
      commercialLote,
      detalhe.lote_id ?? evento.lote_id,
      loteById.get(detalhe.lote_id ?? evento.lote_id ?? "") ??
        detalhe.lote_id ??
        evento.lote_id,
      normalizedAmount,
    );
  }

  function addSociedadeCosts(
    detalhe: EventoComercial,
    normalizedAmount: number,
  ) {
    const sociedadeSnapshot = detalhe.sociedade_snapshot;
    if (sociedadeSnapshot && typeof sociedadeSnapshot === "object") {
      const list = Array.isArray(sociedadeSnapshot)
        ? sociedadeSnapshot
        : [sociedadeSnapshot];
      for (const raw of list) {
        const record = asRecord(raw);
        if (!record) continue;
        const sociedadeId = readSociedadeId(record);
        if (!sociedadeId) continue;
        addTraceabilityCost(
          commercialSociedade,
          sociedadeId,
          typeof record.contraparteNome === "string"
            ? record.contraparteNome
            : sociedadeId,
          normalizedAmount,
        );
      }
    }
  }

  function toRows() {
    return {
      byOperation: toSortedTraceabilityRows(commercialOperation),
      byCounterparty: toSortedTraceabilityRows(commercialCounterparty),
      byAnimal: toSortedTraceabilityRows(commercialAnimal),
      byLote: toSortedTraceabilityRows(commercialLote),
      bySociedade: toSortedTraceabilityRows(commercialSociedade),
    };
  }

  return { addEvent, toRows };
}

function accumulateCommercialTotals(
  commercialEvents: Array<{ evento: Evento; detalhe: EventoComercial }>,
  commercialTraceability: ReturnType<typeof createCommercialTraceability>,
) {
  const totals = {
    commercialReceita: 0,
    commercialCusto: 0,
    commercialGrossTotal: 0,
    commercialNetTotal: 0,
    commercialHeads: 0,
    commercialWeightKg: 0,
    commercialArrobas: 0,
    commercialGrossComplete: true,
    commercialNetComplete: true,
    commercialWeightComplete: true,
    commercialArrobasComplete: true,
  };
  for (const { evento, detalhe } of commercialEvents) {
    addCommercialDeclaredTotals(totals, detalhe);
    addCommercialFinancialTotals(
      totals,
      evento,
      detalhe,
      commercialTraceability,
    );
  }
  return totals;
}

type CommercialTotals = ReturnType<typeof accumulateCommercialTotals>;

function addCommercialDeclaredTotals(
  totals: CommercialTotals,
  detalhe: EventoComercial,
) {
  totals.commercialHeads += detalhe.quantidade_animais;
  if (detalhe.valor_bruto == null) {
    totals.commercialGrossComplete = false;
  } else {
    totals.commercialGrossTotal += detalhe.valor_bruto;
  }
  if (detalhe.valor_liquido_derivado == null) {
    totals.commercialNetComplete = false;
  } else {
    totals.commercialNetTotal += detalhe.valor_liquido_derivado;
  }
  if (detalhe.peso_vivo_total == null) {
    totals.commercialWeightComplete = false;
  } else {
    totals.commercialWeightKg += detalhe.peso_vivo_total;
  }
  const totalArrobas = getCommercialTotalArrobas(detalhe);
  if (totalArrobas == null) {
    totals.commercialArrobasComplete = false;
  } else {
    totals.commercialArrobas += totalArrobas;
  }
}

function addCommercialFinancialTotals(
  totals: CommercialTotals,
  evento: Evento,
  detalhe: EventoComercial,
  commercialTraceability: ReturnType<typeof createCommercialTraceability>,
) {
  const amount = Number(
    detalhe.valor_liquido_derivado ?? detalhe.valor_bruto ?? 0,
  );
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;

  if (detalhe.operation_type === "venda") {
    totals.commercialReceita = Number(
      (totals.commercialReceita + normalizedAmount).toFixed(2),
    );
  } else {
    totals.commercialCusto = Number(
      (totals.commercialCusto + normalizedAmount).toFixed(2),
    );
  }

  commercialTraceability.addEvent(evento, detalhe, normalizedAmount);
}

function countExpectedCommercialEvents(
  eventos: Evento[],
  commercialByEventId: CommercialReportInput["commercialByEventId"],
) {
  return eventos.filter((evento) => {
    if (evento.dominio !== "comercial") return false;
    const detalhe = commercialByEventId.get(evento.id);
    if (!detalhe) {
      // For counting purposes, if detail is missing we still check if it *should* have been included
      // to flag it as partial.
      return (
        isCommercialOperationV2(evento) &&
        !isCommercialSimulation(evento, undefined)
      );
    }
    const classification = classifyCommercialOperation(
      evento,
      detalhe,
      undefined,
    );
    return classification.includedInCommercialAggregate;
  }).length;
}

function resolveCommercialValue(
  events: Array<{ detalhe: EventoComercial }>,
  complete: boolean,
  total: number,
  readAmount: (detail: EventoComercial) => number | null | undefined,
) {
  if (events.length === 0) return 0;
  if (complete || events.some((item) => readAmount(item.detalhe) != null))
    return Number(total.toFixed(2));
  return null;
}

function commercialAverage(
  value: number | null,
  quantity: number,
  complete = true,
) {
  return value != null && complete && quantity > 0
    ? Number((value / quantity).toFixed(2))
    : null;
}

export function buildCommercialReport({
  input,
  eventos,
  commercialByEventId,
  activeFinanceTransactions,
  animalById,
  loteById,
}: CommercialReportInput) {
  const commercialEvents = eventos
    .filter((evento) => evento.dominio === "comercial")
    .map((evento) => {
      const detalhe = commercialByEventId.get(evento.id);
      if (!detalhe) return null;
      const link = resolveCommercialFinanceLink({
        fazendaId: input.fazendaId,
        financeTransactionId: detalhe.finance_transaction_id,
        transactions: activeFinanceTransactions,
      });
      const classification = classifyCommercialOperation(
        evento,
        detalhe,
        link.transaction,
      );
      return { evento, detalhe, classification };
    })
    .filter(
      (
        item,
      ): item is {
        evento: Evento;
        detalhe: EventoComercial;
        classification: ReturnType<typeof classifyCommercialOperation>;
      } => Boolean(item) && item!.classification.includedInCommercialAggregate,
    );
  const commercialTraceability = createCommercialTraceability({
    animalById,
    loteById,
  });
  const {
    commercialReceita,
    commercialCusto,
    commercialGrossTotal,
    commercialNetTotal,
    commercialHeads,
    commercialWeightKg,
    commercialArrobas,
    commercialGrossComplete,
    commercialNetComplete,
    commercialWeightComplete,
    commercialArrobasComplete,
  } = accumulateCommercialTotals(commercialEvents, commercialTraceability);

  const commercialEventCount = countExpectedCommercialEvents(
    eventos,
    commercialByEventId,
  );
  const commercialDetailsComplete =
    commercialEventCount === commercialEvents.length;
  const commercialGrossValue = resolveCommercialValue(
    commercialEvents,
    commercialGrossComplete,
    commercialGrossTotal,
    (detail) => detail.valor_bruto,
  );
  const commercialNetValue = resolveCommercialValue(
    commercialEvents,
    commercialNetComplete,
    commercialNetTotal,
    (detail) => detail.valor_liquido_derivado,
  );

  const comercial: CommercialTraceabilitySummary = {
    totalReceita: commercialReceita,
    totalCusto: commercialCusto,
    totalBruto: commercialGrossValue,
    totalLiquido: commercialNetValue,
    cabecasNegociadas: commercialHeads,
    pesoComercialKg:
      commercialEvents.length === 0 || commercialWeightComplete
        ? commercialWeightKg
        : null,
    precoMedioCabecaLiquido: commercialAverage(
      commercialNetValue,
      commercialHeads,
    ),
    precoMedioArrobaLiquido: commercialAverage(
      commercialNetValue,
      commercialArrobas,
      commercialArrobasComplete,
    ),
    operations: commercialEvents.length,
    ...commercialTraceability.toRows(),
  };

  return {
    commercialEvents,
    commercialDetailsComplete,
    commercialGrossComplete,
    commercialNetComplete,
    commercialWeightComplete,
    commercialArrobasComplete,
    commercialNetValue,
    commercialHeads,
    commercialArrobas,
    comercial,
  };
}
