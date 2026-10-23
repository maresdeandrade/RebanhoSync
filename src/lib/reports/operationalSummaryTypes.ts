import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  DominioEnum,
  Evento,
  EventoComercial,
  EventoFinanceiro,
  EventoPesagem,
  EventoReproducao,
  EventoSanitario,
  FazendaSanidadeConfig,
  FinanceCategory,
  FinanceTransaction,
  Gesture,
  Insumo,
  InsumoApresentacao,
  InsumoLote,
  InsumoMovimentacao,
  Lote,
  Pasto,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  Rejection,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SociedadeAnimal,
  SociedadePecuaria,
} from "@/lib/offline/types";
import type {
  MetricCoverage,
  MetricResult,
  MetricStatus,
  MetricTimezoneSource,
} from "@/lib/reports/metricContract";
import type { ReproductiveProjectionEvent } from "@/lib/reproduction/status";
import type {
  SanitarySupplyAgendaItemInput,
  SanitarySupplyNeedGroup,
} from "@/lib/insights/sanitarySupplyNeeds";
import type {
  InventoryReplenishmentAlertSeverity,
  InventoryResupplyStatus,
} from "@/lib/inventory/resupplyPolicy";
import type {
  RegulatoryComplianceAttentionBadge,
  RegulatoryComplianceAttentionItem,
} from "@/lib/sanitario/compliance/complianceAttention";
import type {
  RegulatoryImpactAnalyticalCut,
  RegulatorySubareaAnalyticalCut,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import type { BiosecurityOccurrenceReportSummary } from "@/lib/sanitario/compliance/biosecurityReadModel";
import type {
  SanitaryException,
  SanitaryExceptionSummary,
} from "@/lib/sanitario/reconciliation/sanitaryExceptions";
import type { ObservedEconomicResult } from "@/lib/finance/observedEconomicResult";

export type ReportPreset = "7d" | "30d" | "90d" | "mes_atual";

export interface ReportRange {
  preset: ReportPreset;
  from: string;
  to: string;
  label: string;
  filenameTag: string;
}

export type OperationalMetricKey =
  | "rebanho_animais_ativos"
  | "rebanho_lotes_ativos"
  | "rebanho_pastos_ativos"
  | "rebanho_entradas"
  | "rebanho_saidas"
  | "rebanho_categorias_historicas"
  | "agenda_aberta"
  | "eventos_periodo"
  | "financeiro_entradas"
  | "financeiro_saidas"
  | "financeiro_saldo"
  | "financeiro_transacoes"
  | "financeiro_entradas_competencia"
  | "financeiro_saidas_competencia"
  | "financeiro_previstos_receber"
  | "financeiro_previstos_pagar"
  | "financeiro_vencidos_receber"
  | "financeiro_vencidos_pagar"
  | "comercial_operacoes"
  | "comercial_cabecas"
  | "comercial_valor_bruto"
  | "comercial_valor_liquido"
  | "comercial_preco_medio_cabeca"
  | "comercial_preco_medio_arroba"
  | "comercial_peso_kg"
  | "pesagem_eventos"
  | "pesagem_media_kg"
  | "pesagem_ultimo_kg"
  | "repro_matrizes"
  | "repro_servicos"
  | "repro_diagnosticos"
  | "repro_prenhas_atuais"
  | "repro_partos"
  | "repro_abortos"
  | "repro_nascimentos"
  | "sanitario_execucoes"
  | "estoque_saldo_atual"
  | "estoque_entradas"
  | "estoque_saidas"
  | "estoque_demanda_futura";

export interface ReproductionReportSummary {
  matrizes: number;
  servicos: number;
  diagnosticos: number;
  prenhasAtuais: number;
  partos: number;
  abortosPerdas: number;
  nascimentos: number | null;
}

export interface OperationalSummaryHistoricalCoverage {
  state: Extract<MetricCoverage["state"], "verified" | "partial">;
  evidence: string[];
  pendingLocalOperations?: number;
}

export interface OperationalSummaryInput {
  fazendaId: string;
  farmTimezone?: string | null;
  historicalCoverage?: Partial<
    Record<OperationalMetricKey, OperationalSummaryHistoricalCoverage>
  >;
  animals: Animal[];
  lotes: Lote[];
  pastos: Pasto[];
  agenda: AgendaItem[];
  eventos: Evento[];
  eventosSanitario?: EventoSanitario[];
  eventosComercial?: EventoComercial[];
  eventosReproducao?: EventoReproducao[];
  eventosPesagem: EventoPesagem[];
  eventosFinanceiro: EventoFinanceiro[];
  financeTransactions?: FinanceTransaction[];
  financeCategories?: FinanceCategory[];
  sociedadesPecuarias?: SociedadePecuaria[];
  sociedadeAnimais?: SociedadeAnimal[];
  gestures: Gesture[];
  rejections: Rejection[];
  protocolosSanitarios?: ProtocoloSanitario[];
  protocoloItensSanitarios?: ProtocoloSanitarioItem[];
  fazendaSanidadeConfig?: FazendaSanidadeConfig | null;
  catalogoProtocolosOficiais?: CatalogoProtocoloOficial[];
  catalogoProtocolosOficiaisItens?: CatalogoProtocoloOficialItem[];
  insumos?: Insumo[];
  insumoApresentacoes?: InsumoApresentacao[];
  insumoLotes?: InsumoLote[];
  insumoMovimentacoes?: InsumoMovimentacao[];
  sanitarioAgendaV2?: SanitarioAgendaLocalV2[];
  sanitarioAgendaAnimaisV2?: SanitarioAgendaAnimalLocalV2[];
  futureSanitaryAgendaItems?: readonly SanitarySupplyAgendaItemInput[];
}

export interface SummaryMetric {
  label: string;
  value: number;
}

export interface AgendaAttentionRow {
  id: string;
  data: string;
  titulo: string;
  contexto: string;
  scheduleLabel?: string;
  scheduleModeLabel?: string;
  scheduleAnchorLabel?: string;
  operationalClassLabel?: string;
  status: "atrasado" | "hoje" | "proximo";
  priorityLabel?: string;
  priorityTone?: "neutral" | "info" | "warning" | "danger";
  mandatory?: boolean;
  requiresVet?: boolean;
}

export interface RecentEventRow {
  id: string;
  data: string;
  dominio: string;
  contexto: string;
}

export interface InventoryReportCategoryRow {
  categoria: string;
  itens: number;
  lotes: number;
  saldo: number;
  entradas: number;
  saidas: number;
  resupplyWarningCount: number;
  resupplyCriticalCount: number;
}

export interface InventoryReportItemRow {
  id: string;
  insumoId: string | null;
  productId: string | null;
  categoria: string;
  insumo: string;
  tipo: string;
  lote: string;
  apresentacao: string;
  unidadeBase: string;
  saldo: number;
  entradas: number;
  saidas: number;
  status: string;
  validade: string | null;
  local: string | null;
  resupplyStatus: InventoryResupplyStatus;
  minimumStockBase: number | null;
  reorderPointBase: number | null;
  resupplyGap: number | null;
}

export interface InventoryReplenishmentAlertRow {
  insumoId: string;
  productId: string | null;
  insumo: string;
  categoria: string;
  tipo: string;
  unidadeBase: string;
  severity: InventoryReplenishmentAlertSeverity;
  currentBalanceBase: number;
  futureDemandBase: number | null;
  projectedBalanceBase: number | null;
  minimumStockBase: number | null;
  reorderPointBase: number | null;
  currentGapBase: number | null;
  projectedGapBase: number | null;
  reasons: string[];
}

export interface InventoryFutureDemandRow {
  productKey: string;
  productId?: string;
  productName: string;
  productUnit: string;
  agendaItemCount: number;
  animalCount: number;
  estimatedQuantity: number | null;
  missingQuantityCount: number;
  availableBalance: number;
  balanceGap: number | null;
}

export interface InventoryPartialCostSummary {
  entradasKnownCost: number;
  entradasKnownQuantity: number;
  entradasMissingCostQuantity: number;
  entradasMissingCostMovements: number;
  saidasKnownCost: number;
  saidasKnownQuantity: number;
  saidasMissingCostQuantity: number;
  saidasMissingCostMovements: number;
  saldoKnownCost: number;
  saldoKnownQuantity: number;
  saldoMissingCostQuantity: number;
  activeLotsWithKnownCost: number;
  activeLotsWithMissingCost: number;
}

export interface SanitaryTraceabilityCostRow {
  key: string;
  label: string;
  eventCount: number;
  totalCost: number;
}

export interface SanitaryTraceabilitySummary {
  totalCost: number;
  eventsWithStructuredProduct: number;
  eventsWithStockLot: number;
  eventsWithoutCompleteTraceability: number;
  productsWithoutStockLot: number;
  missingCostEvents: number;
  stockInconsistencyEvents: number;
  byProduct: SanitaryTraceabilityCostRow[];
  byStockLot: SanitaryTraceabilityCostRow[];
  byAnimal: SanitaryTraceabilityCostRow[];
  byLote: SanitaryTraceabilityCostRow[];
  byProtocol: SanitaryTraceabilityCostRow[];
}

export interface SanitaryExceptionsReportSummary extends SanitaryExceptionSummary {
  items: SanitaryException[];
}

export interface CommercialTraceabilitySummary {
  totalReceita: number;
  totalCusto: number;
  totalBruto: number | null;
  totalLiquido: number | null;
  cabecasNegociadas: number;
  pesoComercialKg: number | null;
  precoMedioCabecaLiquido: number | null;
  precoMedioArrobaLiquido: number | null;
  operations: number;
  byOperation: SanitaryTraceabilityCostRow[];
  byCounterparty: SanitaryTraceabilityCostRow[];
  byAnimal: SanitaryTraceabilityCostRow[];
  byLote: SanitaryTraceabilityCostRow[];
  bySociedade: SanitaryTraceabilityCostRow[];
}

export interface OperationalSummaryReport {
  generatedAt: string;
  range: ReportRange;
  metrics: Record<OperationalMetricKey, MetricResult<number>>;
  reproducao: ReproductionReportSummary;
  summary: {
    animaisAtivos: number;
    lotesAtivos: number;
    pastosAtivos: number;
    agendaAberta: number;
    agendaHoje: number;
    agendaAtrasada: number;
    eventosPeriodo: number;
    pendenciasSync: number;
    errosSync: number;
  };
  manejoByDomain: SummaryMetric[];
  financeiro: {
    entradas: number | null;
    saidas: number | null;
    saldo: number | null;
    transacoes: number;
    compras: number;
    vendas: number;
    entradasCompetencia: number;
    saidasCompetencia: number;
    previstosAPagar: number;
    previstosAReceber: number;
    vencidosAPagar: number;
    vencidosAReceber: number;
    observedEconomicResult: ObservedEconomicResult;
  };
  comercial: CommercialTraceabilitySummary;
  pesagem: {
    totalPesagens: number;
    pesoMedioKg: number | null;
    ultimoPesoKg: number | null;
    ultimaPesagemEm: string | null;
  };
  regulatoryCompliance: {
    openCount: number;
    blockingCount: number;
    feedBanOpenCount: number;
    criticalChecklistCount: number;
    nutritionBlockers: number;
    movementBlockers: number;
    saleBlockers: number;
    badges: RegulatoryComplianceAttentionBadge[];
    topItems: RegulatoryComplianceAttentionItem[];
    subareas: RegulatorySubareaAnalyticalCut[];
    impacts: RegulatoryImpactAnalyticalCut[];
  };
  biosecurityOccurrences: BiosecurityOccurrenceReportSummary;
  sanitaryExceptions: SanitaryExceptionsReportSummary;
  inventory: {
    itensAtivos: number;
    lotesAtivos: number;
    saldoTotal: number;
    entradasPeriodo: number;
    saidasPeriodo: number;
    resupplyConfiguredItems: number;
    resupplyWarningItems: number;
    resupplyCriticalItems: number;
    replenishmentAlerts: InventoryReplenishmentAlertRow[];
    categorias: InventoryReportCategoryRow[];
    items: InventoryReportItemRow[];
    futureDemand: {
      horizonDays: number;
      status: "complete" | "partial" | "empty";
      // Provenance of planning inputs; not executed sanitary facts.
      source: "state_agenda_itens" | "state_agenda_itens + ops_sanitario_agenda_v2";
      limitations: string[];
      missingProductCount: number;

      missingQuantityCount: number;
      groups: InventoryFutureDemandRow[];
    };
    partialCost: InventoryPartialCostSummary;
    sanitaryPhase3Prerequisites: {
      sanitaryEvents: number;
      catalogLinkedEvents: number;
      unmappedCatalogProducts: number;
      activeLotMappedCatalogProducts: number;
      presentationMappedCatalogProducts: number;
      reliablyMappedCatalogProducts: number;
      assistedConsumptionEvents: number;
      assistedConsumptionMovements: number;
      assistedConsumptionCoveragePct: number | null;
      readyForAutoReview: boolean;
    };
    sanitaryTraceability: SanitaryTraceabilitySummary;
  };
  agendaAttention: AgendaAttentionRow[];
  recentEvents: RecentEventRow[];
}
