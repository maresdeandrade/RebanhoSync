import type {
  Evento,
  EventoComercial,
  EventoFinanceiro,
  FinanceTransaction,
} from "@/lib/offline/types";
import {
  classifyCommercialOperation,
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
import { addTraceabilityCost, toSortedTraceabilityRows } from "./reportTraceability";

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

function isCommercialOperationV2(evento: Evento): boolean {
  const payload = asRecord(evento.payload);
  return payload?.kind === "commercial_operation_v2";
}

const COMMERCIAL_SIMULATION_KINDS = new Set([
  "simulation",
  "commercial_simulation",
  "simulacao",
  "simulacao_comercial",
]);

function isCommercialSimulation(
  evento: Evento,
  detalhe: EventoComercial | undefined,
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

  const observedEconomicResult = calculateObservedEconomicResult(
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

  const financeiro = {
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

  for (const transaction of activeFinanceTransactions) {
    if (transaction.status === "cancelado") continue;
    if (isDateInRange(transaction.occurred_at)) {
      if (transaction.direction === "entrada") financeiro.vendas += 1;
      else financeiro.compras += 1;
    }

    if (transaction.status === "realizado") {
      if (isDateInRange(transaction.competence_date)) {
        if (transaction.direction === "entrada")
          financeiro.entradasCompetencia += transaction.valor_total;
        else financeiro.saidasCompetencia += transaction.valor_total;
      }
    } else if (transaction.status === "previsto") {
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
      if (isDateInRange(transaction.competence_date)) {
        if (transaction.direction === "entrada")
          financeiro.entradasCompetencia += transaction.valor_total;
        else financeiro.saidasCompetencia += transaction.valor_total;
      }
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

    for (const animalId of detalhe.animal_ids ??
      (evento.animal_id ? [evento.animal_id] : [])) {
      addTraceabilityCost(
        commercialAnimal,
        animalId,
        animalById.get(animalId) ?? animalId,
        normalizedAmount,
      );
    }

    addTraceabilityCost(
      commercialLote,
      detalhe.lote_id ?? evento.lote_id,
      loteById.get(detalhe.lote_id ?? evento.lote_id ?? "") ??
        detalhe.lote_id ??
        evento.lote_id,
      normalizedAmount,
    );

    const sociedadeSnapshot = detalhe.sociedade_snapshot;
    if (sociedadeSnapshot && typeof sociedadeSnapshot === "object") {
      const list = Array.isArray(sociedadeSnapshot)
        ? sociedadeSnapshot
        : [sociedadeSnapshot];
      for (const raw of list) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const record = raw as Record<string, unknown>;
        const sociedadeId =
          typeof record.sociedadeId === "string"
            ? record.sociedadeId
            : typeof record.sociedade_id === "string"
              ? record.sociedade_id
              : null;
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
  let commercialReceita = 0;
  let commercialCusto = 0;
  let commercialGrossTotal = 0;
  let commercialNetTotal = 0;
  let commercialHeads = 0;
  let commercialWeightKg = 0;
  let commercialArrobas = 0;
  let commercialGrossComplete = true;
  let commercialNetComplete = true;
  let commercialWeightComplete = true;
  let commercialArrobasComplete = true;

  for (const { evento, detalhe } of commercialEvents) {
    commercialHeads += detalhe.quantidade_animais;
    if (detalhe.valor_bruto == null) {
      commercialGrossComplete = false;
    } else {
      commercialGrossTotal += detalhe.valor_bruto;
    }
    if (detalhe.valor_liquido_derivado == null) {
      commercialNetComplete = false;
    } else {
      commercialNetTotal += detalhe.valor_liquido_derivado;
    }
    if (detalhe.peso_vivo_total == null) {
      commercialWeightComplete = false;
    } else {
      commercialWeightKg += detalhe.peso_vivo_total;
    }
    const totalArrobas = getCommercialTotalArrobas(detalhe);
    if (totalArrobas == null) {
      commercialArrobasComplete = false;
    } else {
      commercialArrobas += totalArrobas;
    }
    const amount = Number(
      detalhe.valor_liquido_derivado ?? detalhe.valor_bruto ?? 0,
    );
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;

    if (detalhe.operation_type === "venda") {
      commercialReceita = Number(
        (commercialReceita + normalizedAmount).toFixed(2),
      );
    } else {
      commercialCusto = Number((commercialCusto + normalizedAmount).toFixed(2));
    }

    commercialTraceability.addEvent(evento, detalhe, normalizedAmount);
  }

  const commercialEventCount = eventos.filter((evento) => {
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
  const commercialDetailsComplete =
    commercialEventCount === commercialEvents.length;
  const commercialGrossValue =
    commercialEvents.length === 0
      ? 0
      : commercialGrossComplete
        ? Number(commercialGrossTotal.toFixed(2))
        : commercialEvents.some((item) => item.detalhe.valor_bruto != null)
          ? Number(commercialGrossTotal.toFixed(2))
          : null;
  const commercialNetValue =
    commercialEvents.length === 0
      ? 0
      : commercialNetComplete
        ? Number(commercialNetTotal.toFixed(2))
        : commercialEvents.some(
              (item) => item.detalhe.valor_liquido_derivado != null,
            )
          ? Number(commercialNetTotal.toFixed(2))
          : null;
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
    precoMedioCabecaLiquido:
      commercialNetValue != null && commercialHeads > 0
        ? Number((commercialNetValue / commercialHeads).toFixed(2))
        : null,
    precoMedioArrobaLiquido:
      commercialNetValue != null &&
      commercialArrobasComplete &&
      commercialArrobas > 0
        ? Number((commercialNetValue / commercialArrobas).toFixed(2))
        : null,
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
