import type {
  OperationalSummaryInput,
  OperationalSummaryReport,
  ReportRange,
} from "./operationalSummaryTypes";
export type * from "./operationalSummaryTypes";
export { resolveReportRange } from "./operationalSummaryCalendar";
export {
  OPERATIONAL_REPORT_SOURCE_NOTES,
  OPERATIONAL_REPORT_LIMITATIONS,
  buildOperationalSummaryCsv,
  buildOperationalSummaryPrintHtml,
} from "./operationalSummaryExport";
import { getEventDateKey } from "./operationalSummaryCalendar";
import { prepareOperationalSummary } from "./operationalSummaryScope";
import { buildInventoryStock } from "./inventoryReportStock";
import { buildInventoryDemand } from "./inventoryReportDemand";
import { buildSanitaryReportTraceability } from "./sanitaryReportTraceability";
import {
  buildOperationalReadModels,
  buildOperationalAttentionRows,
} from "./operationalReportAttention";
import {
  buildFinancialReport,
  buildCommercialReport,
} from "./financialCommercialReport";
import {
  buildWeightReport,
  buildReproductionReport,
} from "./reproductionWeightReport";
import { buildOperationalMetrics } from "./operationalReportMetrics";
import { closeMetricSemantics } from "./operationalMetricCoverage";
export function buildOperationalSummary(
  rawInput: OperationalSummaryInput,
  range: ReportRange,
  now = new Date(),
): OperationalSummaryReport {
  const {
    input,
    metricTimezone,
    todayKey,
    animals,
    lotes,
    pastos,
    agendaAberta,
    eventos,
    animalById,
    loteById,
    financeByEventId,
    commercialByEventId,
    weightByEventId,
    sanitaryDetailByEventId,
  } = prepareOperationalSummary(rawInput, range, now);
  const stock = buildInventoryStock({ input, metricTimezone, range });
  const { insumos, inventoryItems, inventoryCategories, partialCost } = stock;
  const supply = buildInventoryDemand({
    input,
    animals,
    agendaAberta,
    todayKey,
    stock,
  });
  const {
    demandHorizonDays,
    futureDemandSource,
    futureDemandLimitations,
    futureSupplyNeeds,
    futureDemandGroups,
    futureDemandMissingQuantity,
    replenishmentAlerts,
  } = supply;
  const {
    sanitaryPhase3Prerequisites,
    sanitaryTraceability,
    sanitaryProtocolItemById,
  } = buildSanitaryReportTraceability({
    input,
    eventos,
    sanitaryDetailByEventId,
    stock,
    metricTimezone,
    animalById,
    loteById,
  });
  const {
    sanitaryAttentionById,
    regulatoryReadModel,
    biosecurityOccurrences,
    sanitaryExceptions,
    sanitaryExceptionSummary,
    domainCounts,
  } = buildOperationalReadModels({
    input,
    agendaAberta,
    animals,
    lotes,
    eventos,
    range,
    now,
  });
  const finance = buildFinancialReport({
    input,
    eventos,
    financeByEventId,
    range,
    metricTimezone,
  });
  const { activeFinanceTransactions, financeiro } = finance;
  const commercial = buildCommercialReport({
    input,
    eventos,
    commercialByEventId,
    activeFinanceTransactions,
    animalById,
    loteById,
  });
  const { comercial } = commercial;
  const weights = buildWeightReport({ eventos, weightByEventId });
  const { pesagens, totalPeso, ultimaPesagem } = weights;
  const reproduction = buildReproductionReport({
    input,
    animals,
    range,
    metricTimezone,
  });
  const { reproductiveSummary } = reproduction;
  const metrics = buildOperationalMetrics({
    input,
    eventos,
    animals,
    lotes,
    pastos,
    agendaAberta,
    metricTimezone,
    range,
    sanitaryDetailByEventId,
    stock,
    supply,
    finance,
    commercial,
    weights,
    reproduction,
  });
  const semanticallyClosedMetrics = closeMetricSemantics(
    metrics,
    input,
    metricTimezone,
  );
  const { agendaAttention, recentEvents } = buildOperationalAttentionRows({
    agendaAberta,
    sanitaryAttentionById,
    sanitaryProtocolItemById,
    animalById,
    loteById,
    todayKey,
    eventos,
    metricTimezone,
  });
  return {
    generatedAt: new Date().toISOString(),
    range,
    metrics: semanticallyClosedMetrics,
    reproducao: reproductiveSummary,
    summary: {
      animaisAtivos: animals.length,
      lotesAtivos: lotes.length,
      pastosAtivos: pastos.length,
      agendaAberta: agendaAberta.length,
      agendaHoje: agendaAberta.filter((item) => item.data_prevista === todayKey)
        .length,
      agendaAtrasada: agendaAberta.filter(
        (item) => item.data_prevista < todayKey,
      ).length,
      eventosPeriodo: eventos.length,
      pendenciasSync: input.gestures.filter(
        (gesture) =>
          gesture.status === "PENDING" || gesture.status === "SYNCING",
      ).length,
      errosSync: input.rejections.length,
    },
    manejoByDomain: domainCounts,
    financeiro,
    comercial,
    pesagem: {
      totalPesagens: pesagens.length,
      pesoMedioKg: pesagens.length > 0 ? totalPeso / pesagens.length : null,
      ultimoPesoKg: ultimaPesagem?.detalhe.peso_kg ?? null,
      ultimaPesagemEm: ultimaPesagem
        ? getEventDateKey(ultimaPesagem.evento, metricTimezone.timezone)
        : null,
    },
    regulatoryCompliance: {
      openCount: regulatoryReadModel.attention.openCount,
      blockingCount: regulatoryReadModel.attention.blockingCount,
      feedBanOpenCount: regulatoryReadModel.attention.feedBanOpenCount,
      criticalChecklistCount:
        regulatoryReadModel.attention.criticalChecklistCount,
      nutritionBlockers: regulatoryReadModel.flows.nutrition.blockerCount,
      movementBlockers: regulatoryReadModel.flows.movementInternal.blockerCount,
      saleBlockers: regulatoryReadModel.flows.sale.blockerCount,
      badges: regulatoryReadModel.attention.badges,
      topItems: regulatoryReadModel.attention.topItems,
      subareas: regulatoryReadModel.analytics.subareas,
      impacts: regulatoryReadModel.analytics.impacts,
    },
    biosecurityOccurrences,
    sanitaryExceptions: {
      ...sanitaryExceptionSummary,
      items: sanitaryExceptions,
    },
    inventory: {
      itensAtivos: insumos.filter((item) => item.ativo).length,
      lotesAtivos: inventoryItems.filter((item) => item.status === "ativo")
        .length,
      saldoTotal: inventoryItems.reduce((acc, item) => acc + item.saldo, 0),
      entradasPeriodo: inventoryItems.reduce(
        (acc, item) => acc + item.entradas,
        0,
      ),
      saidasPeriodo: inventoryItems.reduce((acc, item) => acc + item.saidas, 0),
      resupplyConfiguredItems: inventoryItems.filter(
        (item) => item.resupplyStatus !== "unconfigured",
      ).length,
      resupplyWarningItems: inventoryItems.filter(
        (item) => item.resupplyStatus === "warning",
      ).length,
      resupplyCriticalItems: inventoryItems.filter(
        (item) => item.resupplyStatus === "critical",
      ).length,
      replenishmentAlerts,
      categorias: inventoryCategories,
      items: inventoryItems,
      futureDemand: {
        horizonDays: demandHorizonDays,
        status:
          futureSupplyNeeds.answerability === "answerable"
            ? futureSupplyNeeds.resultStatus
            : "empty",
        source: futureDemandSource,
        limitations: [
          ...futureDemandLimitations,
          ...futureSupplyNeeds.source.limitations,
        ],
        missingProductCount:
          futureSupplyNeeds.answerability === "answerable"
            ? futureSupplyNeeds.data.incompleteAgendaItemIds.length
            : 0,
        missingQuantityCount: futureDemandMissingQuantity,
        groups: futureDemandGroups,
      },
      partialCost,
      sanitaryPhase3Prerequisites,
      sanitaryTraceability,
    },
    agendaAttention,
    recentEvents,
  };
}
