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
  EventoSanitario,
  FazendaSanidadeConfig,
  FinanceiroTipoEnum,
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
  SociedadeAnimal,
  SociedadePecuaria,
} from "@/lib/offline/types";
import {
  createSanitarySupplyNeedsInsight,
  type SanitarySupplyNeedGroup,
} from "@/lib/insights/sanitarySupplyNeeds";
import {
  evaluateInventoryReplenishmentAlert,
  evaluateInventoryResupply,
  parseInventoryResupplyPolicy,
  type InventoryReplenishmentAlertSeverity,
  type InventoryResupplyStatus,
} from "@/lib/inventory/resupplyPolicy";
import { describeSanitaryAgendaScheduleMeta } from "@/lib/sanitario/engine/calendar";
import {
  getSanitaryAttentionOperationalClassLabel,
  summarizeSanitaryAgendaAttention,
} from "@/lib/sanitario/compliance/attention";
import type {
  RegulatoryComplianceAttentionBadge,
  RegulatoryComplianceAttentionItem,
} from "@/lib/sanitario/compliance/complianceAttention";
import {
  buildRegulatoryOperationalReadModel,
  type RegulatoryImpactAnalyticalCut,
  type RegulatorySubareaAnalyticalCut,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  summarizeBiosecurityOccurrences,
  type BiosecurityOccurrenceReportSummary,
} from "@/lib/sanitario/compliance/biosecurityReadModel";
import {
  buildSanitaryExceptionsReadModel,
  summarizeSanitaryExceptions,
  type SanitaryException,
  type SanitaryExceptionSummary,
} from "@/lib/sanitario/reconciliation/sanitaryExceptions";

export type ReportPreset = "7d" | "30d" | "90d" | "mes_atual";

export interface ReportRange {
  preset: ReportPreset;
  from: string;
  to: string;
  label: string;
  filenameTag: string;
}

export interface OperationalSummaryInput {
  animals: Animal[];
  lotes: Lote[];
  pastos: Pasto[];
  agenda: AgendaItem[];
  eventos: Evento[];
  eventosSanitario?: EventoSanitario[];
  eventosComercial?: EventoComercial[];
  eventosPesagem: EventoPesagem[];
  eventosFinanceiro: EventoFinanceiro[];
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
    entradas: number;
    saidas: number;
    saldo: number;
    transacoes: number;
    compras: number;
    vendas: number;
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
      missingProductCount: number;
      missingQuantityCount: number;
      groups: InventoryFutureDemandRow[];
    };
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

const DOMAIN_LABEL: Record<DominioEnum, string> = {
  sanitario: "Sanitario",
  alerta_sanitario: "Alerta sanitario",
  conformidade: "Conformidade",
  comercial: "Comercial",
  pesagem: "Pesagem",
  nutricao: "Nutricao",
  movimentacao: "Movimentacao",
  reproducao: "Reproducao",
  financeiro: "Financeiro",
  obito: "Obito",
  ecc: "ECC",
};

const DOMAIN_ORDER: DominioEnum[] = [
  "sanitario",
  "alerta_sanitario",
  "conformidade",
  "comercial",
  "pesagem",
  "movimentacao",
  "nutricao",
  "reproducao",
  "financeiro",
  "obito",
  "ecc",
];

const FINANCE_SIGNAL: Record<FinanceiroTipoEnum, "entrada" | "saida"> = {
  compra: "saida",
  venda: "entrada",
};

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const LONG_DATETIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toLocalDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function safeDateLabel(dateKey: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(`${dateKey}T00:00:00`));
}

function safeDateTimeLabel(iso: string): string {
  return LONG_DATETIME_FORMATTER.format(new Date(iso));
}

function getEventDateKey(evento: Evento): string {
  return evento.occurred_on ?? evento.occurred_at.slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCsvCell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function normalizeInventoryCategory(value: string | null | undefined): string {
  const category = value?.trim();
  return category || "Sem categoria";
}

function readStringPayload(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumberPayload(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getFutureDemandProductId(
  item: AgendaItem,
  protocolItem: ProtocoloSanitarioItem | null,
): string | null {
  return (
    readStringPayload(item.source_ref, "produto_veterinario_id") ??
    readStringPayload(item.payload, "produto_veterinario_id") ??
    readStringPayload(protocolItem?.payload, "produto_veterinario_id")
  );
}

function getFutureDemandProductName(
  item: AgendaItem,
  protocolItem: ProtocoloSanitarioItem | null,
): string | null {
  return (
    readStringPayload(item.source_ref, "produto_nome_catalogo") ??
    readStringPayload(item.payload, "produto_nome_catalogo") ??
    readStringPayload(protocolItem?.payload, "produto_nome_catalogo") ??
    readStringPayload(item.source_ref, "produto") ??
    readStringPayload(item.payload, "produto") ??
    protocolItem?.produto ??
    null
  );
}

function getFutureDemandQuantityPerAnimal(
  item: AgendaItem,
  protocolItem: ProtocoloSanitarioItem | null,
): number | null {
  return (
    readNumberPayload(item.payload, "quantityPerAnimal") ??
    readNumberPayload(item.payload, "quantity_per_animal") ??
    readNumberPayload(item.payload, "quantidade_por_animal") ??
    readNumberPayload(item.source_ref, "quantityPerAnimal") ??
    readNumberPayload(item.source_ref, "quantity_per_animal") ??
    readNumberPayload(item.source_ref, "quantidade_por_animal") ??
    readNumberPayload(protocolItem?.payload, "quantityPerAnimal") ??
    readNumberPayload(protocolItem?.payload, "quantity_per_animal") ??
    readNumberPayload(protocolItem?.payload, "quantidade_por_animal")
  );
}

function getFutureDemandUnit(
  item: AgendaItem,
  protocolItem: ProtocoloSanitarioItem | null,
): string {
  return (
    readStringPayload(item.payload, "productUnit") ??
    readStringPayload(item.payload, "unidade_base") ??
    readStringPayload(item.source_ref, "productUnit") ??
    readStringPayload(item.source_ref, "unidade_base") ??
    readStringPayload(protocolItem?.payload, "productUnit") ??
    readStringPayload(protocolItem?.payload, "unidade_base") ??
    "dose"
  );
}

function getInventoryMovementSignal(
  tipo: InsumoMovimentacao["tipo"],
): "entrada" | "saida" | null {
  if (
    tipo === "entrada" ||
    tipo === "ajuste_positivo" ||
    tipo === "transferencia_entrada"
  ) {
    return "entrada";
  }

  if (
    tipo === "ajuste_negativo" ||
    tipo === "consumo_sanitario" ||
    tipo === "consumo_nutricao" ||
    tipo === "perda" ||
    tipo === "transferencia_saida"
  ) {
    return "saida";
  }

  return null;
}

function addTraceabilityCost(
  map: Map<string, SanitaryTraceabilityCostRow>,
  key: string | null | undefined,
  label: string | null | undefined,
  cost: number,
) {
  const normalizedKey = key?.trim() || "sem_chave";
  const row =
    map.get(normalizedKey) ??
    ({
      key: normalizedKey,
      label: label?.trim() || "Sem identificacao",
      eventCount: 0,
      totalCost: 0,
    } satisfies SanitaryTraceabilityCostRow);

  row.eventCount += 1;
  row.totalCost = Number((row.totalCost + cost).toFixed(2));
  map.set(normalizedKey, row);
}

function toSortedTraceabilityRows(
  map: Map<string, SanitaryTraceabilityCostRow>,
): SanitaryTraceabilityCostRow[] {
  return Array.from(map.values()).sort((left, right) => {
    if (right.totalCost !== left.totalCost) return right.totalCost - left.totalCost;
    return left.label.localeCompare(right.label);
  });
}

function resolveAgendaStatus(
  item: AgendaItem,
  todayKey: string,
): AgendaAttentionRow["status"] {
  if (item.data_prevista < todayKey) return "atrasado";
  if (item.data_prevista === todayKey) return "hoje";
  return "proximo";
}

export function resolveReportRange(
  preset: ReportPreset,
  now = new Date(),
): ReportRange {
  const endDate = toLocalDateOnly(now);

  if (preset === "mes_atual") {
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    return {
      preset,
      from: toDateKey(startDate),
      to: toDateKey(endDate),
      label: "Mes atual",
      filenameTag: `${startDate.getFullYear()}-${`${startDate.getMonth() + 1}`.padStart(2, "0")}`,
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const startDate = shiftDays(endDate, -(days - 1));

  return {
    preset,
    from: toDateKey(startDate),
    to: toDateKey(endDate),
    label: `Ultimos ${days} dias`,
    filenameTag: `${days}d`,
  };
}

export function buildOperationalSummary(
  input: OperationalSummaryInput,
  range: ReportRange,
  now = new Date(),
): OperationalSummaryReport {
  const todayKey = toDateKey(toLocalDateOnly(now));
  const animals = input.animals.filter(
    (animal) => !animal.deleted_at && animal.status === "ativo",
  );
  const lotes = input.lotes.filter((lote) => !lote.deleted_at);
  const pastos = input.pastos.filter((pasto) => !pasto.deleted_at);
  const agendaAberta = input.agenda.filter(
    (item) => !item.deleted_at && item.status === "agendado",
  );
  const eventos = input.eventos.filter(
    (evento) =>
      !evento.deleted_at &&
      getEventDateKey(evento) >= range.from &&
      getEventDateKey(evento) <= range.to,
  );

  const animalById = new Map(
    input.animals.filter((animal) => !animal.deleted_at).map((animal) => [
      animal.id,
      animal.identificacao || animal.nome || "Animal sem identificacao",
    ]),
  );
  const loteById = new Map(lotes.map((lote) => [lote.id, lote.nome]));
  const financeByEventId = new Map(
    input.eventosFinanceiro
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const commercialByEventId = new Map(
    (input.eventosComercial ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const weightByEventId = new Map(
    input.eventosPesagem
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const sanitaryDetailByEventId = new Map(
    (input.eventosSanitario ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const insumos = (input.insumos ?? []).filter((item) => !item.deleted_at);
  const insumoById = new Map(insumos.map((item) => [item.id, item]));
  const apresentacaoById = new Map(
    (input.insumoApresentacoes ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.id, item]),
  );
  const inventoryMovements = (input.insumoMovimentacoes ?? []).filter(
    (movement) =>
      !movement.deleted_at &&
      movement.occurred_at.slice(0, 10) >= range.from &&
      movement.occurred_at.slice(0, 10) <= range.to,
  );
  const movementsByLot = new Map<string, InsumoMovimentacao[]>();
  const inventorySaldoByInsumo = new Map<string, number>();

  for (const lot of input.insumoLotes ?? []) {
    if (lot.deleted_at) continue;
    inventorySaldoByInsumo.set(
      lot.insumo_id,
      (inventorySaldoByInsumo.get(lot.insumo_id) ?? 0) + lot.saldo_atual_base,
    );
  }
  const activeInventoryLots = (input.insumoLotes ?? []).filter(
    (lot) => !lot.deleted_at && lot.status === "ativo",
  );

  for (const movement of inventoryMovements) {
    const current = movementsByLot.get(movement.insumo_lote_id) ?? [];
    current.push(movement);
    movementsByLot.set(movement.insumo_lote_id, current);
  }

  const inventoryItems = (input.insumoLotes ?? [])
    .filter((lot) => !lot.deleted_at)
    .map<InventoryReportItemRow>((lot) => {
      const insumo = insumoById.get(lot.insumo_id);
      const apresentacao = lot.apresentacao_id
        ? apresentacaoById.get(lot.apresentacao_id)
        : undefined;
      const movements = movementsByLot.get(lot.id) ?? [];
      const movementTotals = movements.reduce(
        (acc, movement) => {
          const signal = getInventoryMovementSignal(movement.tipo);
          if (signal === "entrada") acc.entradas += movement.quantidade_base;
          if (signal === "saida") acc.saidas += movement.quantidade_base;
          return acc;
        },
        { entradas: 0, saidas: 0 },
      );
      const resupply = evaluateInventoryResupply(
        inventorySaldoByInsumo.get(lot.insumo_id) ?? lot.saldo_atual_base,
        parseInventoryResupplyPolicy(insumo?.payload),
      );

      return {
        id: lot.id,
        insumoId: insumo?.id ?? null,
        productId: insumo?.produto_veterinario_id ?? null,
        categoria: normalizeInventoryCategory(insumo?.categoria),
        insumo: insumo?.nome ?? "Insumo sem cadastro",
        tipo:
          insumo?.tipo === "sanitario"
            ? "Sanitario"
            : insumo?.tipo === "nutricional"
              ? "Nutricional"
              : "Outro",
        lote: lot.identificacao_lote ?? "Sem identificacao",
        apresentacao: apresentacao?.nome ?? "Sem apresentacao",
        unidadeBase: lot.unidade_base,
        saldo: lot.saldo_atual_base,
        entradas: movementTotals.entradas,
        saidas: movementTotals.saidas,
        status: lot.status,
        validade: lot.validade,
        local: lot.local_armazenamento,
        resupplyStatus: resupply.status,
        minimumStockBase: resupply.minimumStockBase,
        reorderPointBase: resupply.reorderPointBase,
        resupplyGap:
          resupply.status === "critical"
            ? resupply.gapToMinimum
            : resupply.status === "warning"
              ? resupply.gapToReorderPoint
              : 0,
      };
    })
    .sort((left, right) =>
      `${left.categoria} ${left.insumo} ${left.lote}`.localeCompare(
        `${right.categoria} ${right.insumo} ${right.lote}`,
      ),
    );

  const inventoryCategoryMap = new Map<string, InventoryReportCategoryRow>();
  for (const item of inventoryItems) {
    const row =
      inventoryCategoryMap.get(item.categoria) ??
      ({
        categoria: item.categoria,
        itens: 0,
        lotes: 0,
        saldo: 0,
        entradas: 0,
        saidas: 0,
        resupplyWarningCount: 0,
        resupplyCriticalCount: 0,
      } satisfies InventoryReportCategoryRow);

    row.itens += 1;
    row.lotes += 1;
    row.saldo += item.saldo;
    row.entradas += item.entradas;
    row.saidas += item.saidas;
    if (item.resupplyStatus === "warning") row.resupplyWarningCount += 1;
    if (item.resupplyStatus === "critical") row.resupplyCriticalCount += 1;
    inventoryCategoryMap.set(item.categoria, row);
  }
  const inventoryCategories = Array.from(inventoryCategoryMap.values()).sort(
    (left, right) => left.categoria.localeCompare(right.categoria),
  );
  const inventoryLotById = new Map(
    (input.insumoLotes ?? [])
      .filter((lot) => !lot.deleted_at)
      .map((lot) => [lot.id, lot]),
  );

  const protocolItemByIdForDemand = new Map(
    (input.protocoloItensSanitarios ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.id, item]),
  );
  const animalCountByLote = new Map<string, number>();
  for (const animal of animals) {
    if (!animal.lote_id) continue;
    animalCountByLote.set(
      animal.lote_id,
      (animalCountByLote.get(animal.lote_id) ?? 0) + 1,
    );
  }
  const demandHorizonDays = 30;
  const supplyAgendaItems = agendaAberta.map((item) => {
    const protocolItem = item.protocol_item_version_id
      ? protocolItemByIdForDemand.get(item.protocol_item_version_id) ?? null
      : null;

    return {
      id: item.id,
      status: item.status,
      dueDate: item.data_prevista,
      deletedAt: item.deleted_at,
      domain: item.dominio,
      animalId: item.animal_id,
      loteId: item.lote_id,
      protocolId: protocolItem?.protocolo_id ?? null,
      protocolItemVersionId: protocolItem?.id ?? item.protocol_item_version_id,
      productId: getFutureDemandProductId(item, protocolItem),
      productName: getFutureDemandProductName(item, protocolItem),
      productUnit: getFutureDemandUnit(item, protocolItem),
      quantityPerAnimal: getFutureDemandQuantityPerAnimal(item, protocolItem),
      animalCount: item.animal_id
        ? 1
        : item.lote_id
          ? animalCountByLote.get(item.lote_id) ?? 1
          : 1,
    };
  });
  const futureSupplyNeeds = createSanitarySupplyNeedsInsight({
    questionKind: "future_need",
    question: "Demanda futura de insumos sanitarios por agenda valida",
    generatedAt: new Date().toISOString(),
    items: supplyAgendaItems,
    scope: "due_within_days",
    referenceDate: todayKey,
    days: demandHorizonDays,
  });
  const getAvailableInventoryBalance = (group: SanitarySupplyNeedGroup) => {
    const productName = group.productName?.trim().toLowerCase();
    return inventoryItems.reduce((acc, item) => {
      const insumo = insumoById.get(inventoryLotById.get(item.id)?.insumo_id ?? "");
      const matchesById =
        group.productId && insumo?.produto_veterinario_id === group.productId;
      const matchesByName =
        productName &&
        (item.insumo.trim().toLowerCase() === productName ||
          item.insumo.trim().toLowerCase().includes(productName));
      return matchesById || matchesByName ? acc + item.saldo : acc;
    }, 0);
  };
  const futureDemandGroups =
    futureSupplyNeeds.answerability === "answerable"
      ? futureSupplyNeeds.data.groups.map<InventoryFutureDemandRow>((group) => {
          const availableBalance = getAvailableInventoryBalance(group);
          const estimatedQuantity = group.estimatedQuantity ?? null;
          return {
            productKey: group.productKey,
            productId: group.productId,
            productName: group.productName ?? "Produto sem nome",
            productUnit: group.productUnit ?? "dose",
            agendaItemCount: group.agendaItemCount,
            animalCount: group.animalCount,
            estimatedQuantity,
            missingQuantityCount: group.missingQuantityCount,
            availableBalance,
            balanceGap:
              estimatedQuantity == null
                ? null
                : Math.max(estimatedQuantity - availableBalance, 0),
          };
        })
      : [];
  const futureDemandMissingQuantity = futureDemandGroups.reduce(
    (acc, group) => acc + group.missingQuantityCount,
    0,
  );
  const futureDemandByInventoryItem = new Map<string, number>();
  for (const demand of futureDemandGroups) {
    if (demand.estimatedQuantity == null) continue;
    const demandName = demand.productName.trim().toLowerCase();

    for (const insumo of insumos) {
      const matchesProduct =
        demand.productId && insumo.produto_veterinario_id === demand.productId;
      const matchesName =
        demandName.length > 0 &&
        (insumo.nome.trim().toLowerCase() === demandName ||
          insumo.nome.trim().toLowerCase().includes(demandName));
      const sameUnit = insumo.unidade_base === demand.productUnit;

      if ((matchesProduct || matchesName) && sameUnit) {
        futureDemandByInventoryItem.set(
          insumo.id,
          (futureDemandByInventoryItem.get(insumo.id) ?? 0) +
            demand.estimatedQuantity,
        );
      }
    }
  }
  const replenishmentAlerts = insumos
    .filter((insumo) => insumo.ativo)
    .map<InventoryReplenishmentAlertRow | null>((insumo) => {
      const currentBalanceBase = inventorySaldoByInsumo.get(insumo.id) ?? 0;
      const alert = evaluateInventoryReplenishmentAlert({
        currentBalanceBase,
        futureDemandBase: futureDemandByInventoryItem.get(insumo.id) ?? null,
        policy: parseInventoryResupplyPolicy(insumo.payload),
      });

      if (!alert.severity) return null;

      return {
        insumoId: insumo.id,
        productId: insumo.produto_veterinario_id,
        insumo: insumo.nome,
        categoria: normalizeInventoryCategory(insumo.categoria),
        tipo:
          insumo.tipo === "sanitario"
            ? "Sanitario"
            : insumo.tipo === "nutricional"
              ? "Nutricional"
              : "Outro",
        unidadeBase: insumo.unidade_base,
        severity: alert.severity,
        currentBalanceBase,
        futureDemandBase: futureDemandByInventoryItem.get(insumo.id) ?? null,
        projectedBalanceBase: alert.projectedBalanceBase,
        minimumStockBase: parseInventoryResupplyPolicy(insumo.payload).minimumStockBase,
        reorderPointBase: parseInventoryResupplyPolicy(insumo.payload).reorderPointBase,
        currentGapBase: alert.currentGapBase,
        projectedGapBase: alert.projectedGapBase,
        reasons: alert.reasons,
      };
    })
    .filter((item): item is InventoryReplenishmentAlertRow => Boolean(item))
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "critical" ? -1 : 1;
      }

      return left.insumo.localeCompare(right.insumo);
    });

  const sanitaryEvents = eventos.filter((evento) => evento.dominio === "sanitario");
  const sanitaryCatalogProductIds = new Set<string>();
  let catalogLinkedEvents = 0;
  for (const event of sanitaryEvents) {
    const detail = sanitaryDetailByEventId.get(event.id);
    const catalogProductId =
      readStringPayload(detail?.payload, "produto_veterinario_id") ??
      readStringPayload(event.payload, "produto_veterinario_id");

    if (catalogProductId) {
      catalogLinkedEvents += 1;
      sanitaryCatalogProductIds.add(catalogProductId);
    }
  }

  let activeLotMappedCatalogProducts = 0;
  let presentationMappedCatalogProducts = 0;
  let reliablyMappedCatalogProducts = 0;
  for (const productId of sanitaryCatalogProductIds) {
    const matchingInsumos = insumos.filter(
      (insumo) =>
        insumo.ativo &&
        insumo.tipo === "sanitario" &&
        insumo.produto_veterinario_id === productId,
    );
    if (matchingInsumos.length !== 1) continue;

    const mappedInsumo = matchingInsumos[0];
    const hasActiveLot = activeInventoryLots.some(
      (lot) => lot.insumo_id === mappedInsumo.id,
    );
    if (hasActiveLot) activeLotMappedCatalogProducts += 1;

    const hasCompatiblePresentation = Array.from(apresentacaoById.values()).some(
      (presentation) =>
        presentation.insumo_id === mappedInsumo.id &&
        presentation.unidade_base === mappedInsumo.unidade_base &&
        presentation.quantidade_base > 0,
    );
    if (hasCompatiblePresentation) presentationMappedCatalogProducts += 1;

    if (hasActiveLot && hasCompatiblePresentation) {
      reliablyMappedCatalogProducts += 1;
    }
  }

  const assistedSanitaryConsumptionMovements = inventoryMovements.filter(
    (movement) =>
      movement.tipo === "consumo_sanitario" &&
      movement.source_evento_id &&
      movement.source_evento_dominio === "sanitario",
  );
  const assistedSanitaryConsumedEventIds = new Set(
    assistedSanitaryConsumptionMovements
      .map((movement) => movement.source_evento_id)
      .filter((id): id is string => Boolean(id)),
  );
  const assistedConsumptionCoveragePct =
    catalogLinkedEvents > 0
      ? Math.round(
          (assistedSanitaryConsumedEventIds.size / catalogLinkedEvents) * 100,
        )
      : null;
  const unmappedCatalogProducts =
    sanitaryCatalogProductIds.size - reliablyMappedCatalogProducts;
  const sanitaryPhase3Prerequisites = {
    sanitaryEvents: sanitaryEvents.length,
    catalogLinkedEvents,
    unmappedCatalogProducts,
    activeLotMappedCatalogProducts,
    presentationMappedCatalogProducts,
    reliablyMappedCatalogProducts,
    assistedConsumptionEvents: assistedSanitaryConsumedEventIds.size,
    assistedConsumptionMovements: assistedSanitaryConsumptionMovements.length,
    assistedConsumptionCoveragePct,
    readyForAutoReview:
      sanitaryEvents.length > 0 &&
      catalogLinkedEvents === sanitaryEvents.length &&
      unmappedCatalogProducts === 0 &&
      assistedSanitaryConsumedEventIds.size > 0,
  };
  const sanitaryTraceProduct = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceStockLot = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceAnimal = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceLote = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceProtocol = new Map<string, SanitaryTraceabilityCostRow>();
  let sanitaryTraceTotalCost = 0;
  let eventsWithStructuredProduct = 0;
  let eventsWithStockLot = 0;
  let eventsWithoutCompleteTraceability = 0;
  let productsWithoutStockLot = 0;
  let missingCostEvents = 0;
  let stockInconsistencyEvents = 0;
  const sanitaryProtocolItemById = new Map(
    (input.protocoloItensSanitarios ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.id, item]),
  );

  for (const event of sanitaryEvents) {
    const detail = sanitaryDetailByEventId.get(event.id);
    if (!detail) continue;

    const cost = detail.custo_total_snapshot ?? 0;
    sanitaryTraceTotalCost = Number((sanitaryTraceTotalCost + cost).toFixed(2));
    if (detail.produto_veterinario_id) eventsWithStructuredProduct += 1;
    if (detail.estoque_lote_id) eventsWithStockLot += 1;
    const hasProduct = Boolean(detail.produto_veterinario_id || detail.produto_nome_snapshot || detail.produto);
    const hasDoseVia = Boolean(
      typeof detail.dose_quantidade === "number" &&
      detail.dose_quantidade > 0 &&
      detail.dose_unidade &&
      detail.via_aplicacao,
    );
    if (!hasProduct || !hasDoseVia) eventsWithoutCompleteTraceability += 1;
    if (hasProduct && !detail.estoque_lote_id) productsWithoutStockLot += 1;
    if (hasProduct && detail.custo_total_snapshot == null) missingCostEvents += 1;
    if (
      detail.estoque_lote_id &&
      (!detail.estoque_lote_codigo_snapshot ||
        !detail.validade_produto ||
        detail.validade_produto < getEventDateKey(event))
    ) {
      stockInconsistencyEvents += 1;
    }
    const protocolItem = detail.protocol_item_version_id
      ? sanitaryProtocolItemById.get(detail.protocol_item_version_id) ?? null
      : null;
    const protocolLabel = protocolItem
      ? `${protocolItem.item_code ?? protocolItem.tipo} / v${protocolItem.version}`
      : detail.protocol_item_version
        ? `Item sanitario v${detail.protocol_item_version}`
        : "Sem protocolo";

    addTraceabilityCost(
      sanitaryTraceProduct,
      detail.produto_veterinario_id ?? detail.produto_nome_snapshot ?? detail.produto,
      detail.produto_nome_snapshot ?? detail.produto,
      cost,
    );
    addTraceabilityCost(
      sanitaryTraceStockLot,
      detail.estoque_lote_id ?? detail.estoque_lote_codigo_snapshot,
      detail.estoque_lote_codigo_snapshot ?? "Sem lote de estoque",
      cost,
    );
    addTraceabilityCost(
      sanitaryTraceAnimal,
      event.animal_id,
      animalById.get(event.animal_id ?? "") ?? "Sem animal",
      cost,
    );
    addTraceabilityCost(
      sanitaryTraceLote,
      event.lote_id,
      loteById.get(event.lote_id ?? "") ?? "Sem lote pecuario",
      cost,
    );
    addTraceabilityCost(
      sanitaryTraceProtocol,
      detail.protocol_item_version_id ?? protocolItem?.logical_item_key,
      protocolLabel,
      cost,
    );
  }

  const sanitaryTraceability: SanitaryTraceabilitySummary = {
    totalCost: sanitaryTraceTotalCost,
    eventsWithStructuredProduct,
    eventsWithStockLot,
    eventsWithoutCompleteTraceability,
    productsWithoutStockLot,
    missingCostEvents,
    stockInconsistencyEvents,
    byProduct: toSortedTraceabilityRows(sanitaryTraceProduct),
    byStockLot: toSortedTraceabilityRows(sanitaryTraceStockLot),
    byAnimal: toSortedTraceabilityRows(sanitaryTraceAnimal),
    byLote: toSortedTraceabilityRows(sanitaryTraceLote),
    byProtocol: toSortedTraceabilityRows(sanitaryTraceProtocol),
  };
  const sanitaryAttention = summarizeSanitaryAgendaAttention({
    agenda: agendaAberta,
    animals,
    lotes,
    protocols: (input.protocolosSanitarios ?? []).filter((item) => !item.deleted_at),
    protocolItems: (input.protocoloItensSanitarios ?? []).filter(
      (item) => !item.deleted_at,
    ),
    limit: agendaAberta.length,
    today: now,
  });
  const regulatoryReadModel = buildRegulatoryOperationalReadModel({
    config: input.fazendaSanidadeConfig ?? null,
    templates: input.catalogoProtocolosOficiais ?? [],
    items: input.catalogoProtocolosOficiaisItens ?? [],
  });
  const biosecurityOccurrences = summarizeBiosecurityOccurrences({
    eventos,
    agenda: agendaAberta,
    from: range.from,
    to: range.to,
  });
  const sanitaryExceptions = buildSanitaryExceptionsReadModel({
    eventos,
    eventosSanitario: input.eventosSanitario ?? [],
    insumoMovimentacoes: input.insumoMovimentacoes ?? [],
    agendaItens: agendaAberta,
    estoqueLotes: input.insumoLotes ?? [],
    detectedAt: now.toISOString(),
  });
  const sanitaryExceptionSummary = summarizeSanitaryExceptions(
    sanitaryExceptions,
    eventos,
  );
  const sanitaryAttentionById = new Map(
    sanitaryAttention.topItems.map((item) => [item.id, item]),
  );
  const domainCounts = DOMAIN_ORDER.map((dominio) => ({
    label: DOMAIN_LABEL[dominio],
    value: eventos.filter((evento) => evento.dominio === dominio).length,
  }));

  const financeEvents = eventos
    .filter((evento) => evento.dominio === "financeiro")
    .map((evento) => financeByEventId.get(evento.id))
    .filter((item): item is EventoFinanceiro => Boolean(item));

  const financeiro = financeEvents.reduce(
    (acc, item) => {
      if (FINANCE_SIGNAL[item.tipo] === "entrada") {
        acc.entradas += Number(item.valor_total || 0);
        acc.vendas += 1;
      } else {
        acc.saidas += Number(item.valor_total || 0);
        acc.compras += 1;
      }
      acc.transacoes += 1;
      return acc;
    },
    {
      entradas: 0,
      saidas: 0,
      saldo: 0,
      transacoes: 0,
      compras: 0,
      vendas: 0,
    },
  );
  financeiro.saldo = financeiro.entradas - financeiro.saidas;

  const commercialEvents = eventos
    .filter((evento) => evento.dominio === "comercial")
    .map((evento) => ({
      evento,
      detalhe: commercialByEventId.get(evento.id),
    }))
    .filter(
      (item): item is { evento: Evento; detalhe: EventoComercial } =>
        Boolean(item.detalhe),
    );
  const commercialOperation = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialCounterparty = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialAnimal = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialLote = new Map<string, SanitaryTraceabilityCostRow>();
  const commercialSociedade = new Map<string, SanitaryTraceabilityCostRow>();
  let commercialReceita = 0;
  let commercialCusto = 0;

  for (const { evento, detalhe } of commercialEvents) {
    const amount = Number(detalhe.valor_liquido_derivado ?? detalhe.valor_bruto ?? 0);
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;

    if (detalhe.operation_type === "venda") {
      commercialReceita = Number((commercialReceita + normalizedAmount).toFixed(2));
    } else {
      commercialCusto = Number((commercialCusto + normalizedAmount).toFixed(2));
    }

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

    for (const animalId of detalhe.animal_ids ?? (evento.animal_id ? [evento.animal_id] : [])) {
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
      loteById.get(detalhe.lote_id ?? evento.lote_id ?? "") ?? detalhe.lote_id ?? evento.lote_id,
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

  const comercial: CommercialTraceabilitySummary = {
    totalReceita: commercialReceita,
    totalCusto: commercialCusto,
    operations: commercialEvents.length,
    byOperation: toSortedTraceabilityRows(commercialOperation),
    byCounterparty: toSortedTraceabilityRows(commercialCounterparty),
    byAnimal: toSortedTraceabilityRows(commercialAnimal),
    byLote: toSortedTraceabilityRows(commercialLote),
    bySociedade: toSortedTraceabilityRows(commercialSociedade),
  };

  const pesagens = eventos
    .filter((evento) => evento.dominio === "pesagem")
    .map((evento) => ({
      evento,
      detalhe: weightByEventId.get(evento.id),
    }))
    .filter(
      (item): item is { evento: Evento; detalhe: EventoPesagem } =>
        Boolean(item.detalhe),
    );

  const totalPeso = pesagens.reduce(
    (acc, item) => acc + Number(item.detalhe.peso_kg || 0),
    0,
  );
  const ultimaPesagem = pesagens
    .slice()
    .sort((left, right) => right.evento.occurred_at.localeCompare(left.evento.occurred_at))[0];

  const agendaAttention = agendaAberta
    .slice()
    .sort((left, right) => left.data_prevista.localeCompare(right.data_prevista))
    .slice(0, 10)
    .map((item) => {
      const sanitaryItem = sanitaryAttentionById.get(item.id);
      const protocolItem = item.protocol_item_version_id
        ? sanitaryProtocolItemById.get(item.protocol_item_version_id) ?? null
        : null;
      const scheduleMeta =
        item.dominio === "sanitario"
          ? describeSanitaryAgendaScheduleMeta({
              intervalDays: item.interval_days_applied ?? protocolItem?.intervalo_dias ?? null,
              payloads: [
                protocolItem?.payload ?? null,
                item.payload,
                item.source_ref,
              ],
            })
          : null;

      return {
        id: item.id,
        data: item.data_prevista,
        titulo: sanitaryItem?.titulo ?? `${DOMAIN_LABEL[item.dominio]}: ${item.tipo.replaceAll("_", " ")}`,
        contexto:
          sanitaryItem?.contexto ??
          animalById.get(item.animal_id ?? "") ??
          loteById.get(item.lote_id ?? "") ??
          "Sem animal ou lote vinculado",
        scheduleLabel: scheduleMeta?.label,
        scheduleModeLabel: scheduleMeta?.modeLabel,
        scheduleAnchorLabel: scheduleMeta?.anchorLabel ?? undefined,
        operationalClassLabel: sanitaryItem
          ? getSanitaryAttentionOperationalClassLabel(sanitaryItem.operationalClass)
          : undefined,
        status: resolveAgendaStatus(item, todayKey),
        priorityLabel: sanitaryItem?.priorityLabel,
        priorityTone: sanitaryItem?.priorityTone,
        mandatory: sanitaryItem?.mandatory,
        requiresVet: sanitaryItem?.requiresVet,
      };
    });

  const recentEvents = eventos
    .slice()
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
    .slice(0, 8)
    .map((evento) => ({
      id: evento.id,
      data: getEventDateKey(evento),
      dominio: DOMAIN_LABEL[evento.dominio],
      contexto:
        animalById.get(evento.animal_id ?? "") ??
        loteById.get(evento.lote_id ?? "") ??
        evento.observacoes ??
        "Registro geral",
    }));

  return {
    generatedAt: new Date().toISOString(),
    range,
    summary: {
      animaisAtivos: animals.length,
      lotesAtivos: lotes.length,
      pastosAtivos: pastos.length,
      agendaAberta: agendaAberta.length,
      agendaHoje: agendaAberta.filter((item) => item.data_prevista === todayKey).length,
      agendaAtrasada: agendaAberta.filter((item) => item.data_prevista < todayKey).length,
      eventosPeriodo: eventos.length,
      pendenciasSync: input.gestures.filter(
        (gesture) => gesture.status === "PENDING" || gesture.status === "SYNCING",
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
        ? getEventDateKey(ultimaPesagem.evento)
        : null,
    },
    regulatoryCompliance: {
      openCount: regulatoryReadModel.attention.openCount,
      blockingCount: regulatoryReadModel.attention.blockingCount,
      feedBanOpenCount: regulatoryReadModel.attention.feedBanOpenCount,
      criticalChecklistCount: regulatoryReadModel.attention.criticalChecklistCount,
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
      lotesAtivos: inventoryItems.filter((item) => item.status === "ativo").length,
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
        missingProductCount:
          futureSupplyNeeds.answerability === "answerable"
            ? futureSupplyNeeds.data.incompleteAgendaItemIds.length
            : 0,
        missingQuantityCount: futureDemandMissingQuantity,
        groups: futureDemandGroups,
      },
      sanitaryPhase3Prerequisites,
      sanitaryTraceability,
    },
    agendaAttention,
    recentEvents,
  };
}

export function buildOperationalSummaryCsv(
  report: OperationalSummaryReport,
  farmName: string,
): string {
  const lines: string[] = [];
  const pushRow = (...cells: Array<string | number | null>) => {
    lines.push(cells.map(toCsvCell).join(";"));
  };

  pushRow("secao", "campo", "valor");
  pushRow("meta", "fazenda", farmName);
  pushRow("meta", "periodo", `${report.range.label} (${report.range.from} a ${report.range.to})`);
  pushRow("meta", "gerado_em", report.generatedAt);
  pushRow("resumo", "animais_ativos", report.summary.animaisAtivos);
  pushRow("resumo", "lotes_ativos", report.summary.lotesAtivos);
  pushRow("resumo", "pastos_ativos", report.summary.pastosAtivos);
  pushRow("resumo", "agenda_aberta", report.summary.agendaAberta);
  pushRow("resumo", "agenda_hoje", report.summary.agendaHoje);
  pushRow("resumo", "agenda_atrasada", report.summary.agendaAtrasada);
  pushRow("resumo", "eventos_no_periodo", report.summary.eventosPeriodo);
  pushRow("resumo", "pendencias_sync", report.summary.pendenciasSync);
  pushRow("resumo", "erros_sync", report.summary.errosSync);
  pushRow("financeiro", "entradas", report.financeiro.entradas.toFixed(2));
  pushRow("financeiro", "saidas", report.financeiro.saidas.toFixed(2));
  pushRow("financeiro", "saldo", report.financeiro.saldo.toFixed(2));
  pushRow("financeiro", "transacoes", report.financeiro.transacoes);
  pushRow("comercial", "operacoes", report.comercial.operations);
  pushRow("comercial", "receita", report.comercial.totalReceita.toFixed(2));
  pushRow("comercial", "custo", report.comercial.totalCusto.toFixed(2));
  for (const item of report.comercial.byCounterparty) {
    pushRow(
      "comercial_contraparte",
      item.label,
      `${item.eventCount} operacao(oes) | valor ${item.totalCost.toFixed(2)}`,
    );
  }
  for (const item of report.comercial.bySociedade) {
    pushRow(
      "comercial_sociedade",
      item.label,
      `${item.eventCount} operacao(oes) | valor ${item.totalCost.toFixed(2)}`,
    );
  }
  pushRow("pesagem", "total_pesagens", report.pesagem.totalPesagens);
  pushRow(
    "pesagem",
    "peso_medio_kg",
    report.pesagem.pesoMedioKg == null ? "" : report.pesagem.pesoMedioKg.toFixed(2),
  );
  pushRow(
    "pesagem",
    "ultimo_peso_kg",
    report.pesagem.ultimoPesoKg == null ? "" : report.pesagem.ultimoPesoKg.toFixed(2),
  );
  pushRow("pesagem", "ultima_pesagem_em", report.pesagem.ultimaPesagemEm);
  pushRow("conformidade", "pendencias_abertas", report.regulatoryCompliance.openCount);
  pushRow("conformidade", "bloqueios", report.regulatoryCompliance.blockingCount);
  pushRow("conformidade", "feed_ban_aberto", report.regulatoryCompliance.feedBanOpenCount);
  pushRow(
    "conformidade",
    "checklists_criticos",
    report.regulatoryCompliance.criticalChecklistCount,
  );
  pushRow(
    "conformidade",
    "bloqueios_nutricao",
    report.regulatoryCompliance.nutritionBlockers,
  );
  pushRow(
    "conformidade",
    "bloqueios_movimentacao",
    report.regulatoryCompliance.movementBlockers,
  );
  pushRow(
    "conformidade",
    "bloqueios_venda",
    report.regulatoryCompliance.saleBlockers,
  );
  pushRow("biosseguranca", "ocorrencias", report.biosecurityOccurrences.total);
  pushRow("biosseguranca", "ocorrencias_abertas", report.biosecurityOccurrences.openCount);
  pushRow(
    "biosseguranca",
    "ocorrencias_com_pendencia",
    report.biosecurityOccurrences.pendingCount,
  );
  pushRow(
    "biosseguranca",
    "suspeitas_notificaveis_abertas",
    report.biosecurityOccurrences.notifiableOpenCount,
  );
  for (const item of report.biosecurityOccurrences.byTipoOcorrencia) {
    pushRow("biosseguranca_tipo", item.key, item.count);
  }
  for (const item of report.biosecurityOccurrences.byGravidade) {
    pushRow("biosseguranca_gravidade", item.key, item.count);
  }
  for (const item of report.biosecurityOccurrences.byEscopo) {
    pushRow("biosseguranca_escopo", item.key, item.count);
  }
  pushRow("sanitario_excecoes", "abertas", report.sanitaryExceptions.totalOpen);
  pushRow("sanitario_excecoes", "resolvidas", report.sanitaryExceptions.totalResolved);
  pushRow("sanitario_excecoes", "ignoradas", report.sanitaryExceptions.totalIgnored);
  pushRow(
    "sanitario_excecoes",
    "estoque_inconsistente",
    report.sanitaryExceptions.inconsistentStockCount,
  );
  pushRow(
    "sanitario_excecoes",
    "custo_ausente",
    report.sanitaryExceptions.missingCostCount,
  );
  pushRow(
    "sanitario_excecoes",
    "tempo_medio_resolucao_dias",
    report.sanitaryExceptions.averageResolutionDays ?? 0,
  );
  for (const item of report.sanitaryExceptions.byType) {
    pushRow("sanitario_excecao_tipo", item.key, item.count);
  }
  for (const item of report.sanitaryExceptions.bySeverity) {
    pushRow("sanitario_excecao_gravidade", item.key, item.count);
  }
  pushRow("estoque", "insumos_ativos", report.inventory.itensAtivos);
  pushRow("estoque", "lotes_ativos", report.inventory.lotesAtivos);
  pushRow("estoque", "saldo_total", report.inventory.saldoTotal.toFixed(3));
  pushRow(
    "estoque",
    "entradas_periodo",
    report.inventory.entradasPeriodo.toFixed(3),
  );
  pushRow(
    "estoque",
    "saidas_periodo",
    report.inventory.saidasPeriodo.toFixed(3),
  );
  pushRow(
    "estoque",
    "ressuprimento_parametrizado",
    report.inventory.resupplyConfiguredItems,
  );
  pushRow(
    "estoque",
    "ressuprimento_atencao",
    report.inventory.resupplyWarningItems,
  );
  pushRow(
    "estoque",
    "ressuprimento_critico",
    report.inventory.resupplyCriticalItems,
  );
  pushRow(
    "estoque",
    "alertas_reposicao",
    report.inventory.replenishmentAlerts.length,
  );
  pushRow(
    "estoque",
    "fase3_eventos_sanitarios",
    report.inventory.sanitaryPhase3Prerequisites.sanitaryEvents,
  );
  pushRow(
    "estoque",
    "fase3_eventos_com_produto_catalogado",
    report.inventory.sanitaryPhase3Prerequisites.catalogLinkedEvents,
  );
  pushRow(
    "estoque",
    "fase3_produtos_mapeados",
    report.inventory.sanitaryPhase3Prerequisites.reliablyMappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_produtos_com_lote_ativo",
    report.inventory.sanitaryPhase3Prerequisites.activeLotMappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_produtos_com_apresentacao_compativel",
    report.inventory.sanitaryPhase3Prerequisites.presentationMappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_produtos_sem_mapeamento_confiavel",
    report.inventory.sanitaryPhase3Prerequisites.unmappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_eventos_com_consumo_assistido",
    report.inventory.sanitaryPhase3Prerequisites.assistedConsumptionEvents,
  );
  pushRow(
    "estoque",
    "fase3_cobertura_consumo_assistido_pct",
    report.inventory.sanitaryPhase3Prerequisites.assistedConsumptionCoveragePct,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "custo_total",
    report.inventory.sanitaryTraceability.totalCost.toFixed(2),
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_com_produto_estruturado",
    report.inventory.sanitaryTraceability.eventsWithStructuredProduct,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_com_lote_estoque",
    report.inventory.sanitaryTraceability.eventsWithStockLot,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_sem_rastreabilidade_completa",
    report.inventory.sanitaryTraceability.eventsWithoutCompleteTraceability,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "produtos_sem_lote_estoque",
    report.inventory.sanitaryTraceability.productsWithoutStockLot,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_sem_custo",
    report.inventory.sanitaryTraceability.missingCostEvents,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_com_estoque_inconsistente",
    report.inventory.sanitaryTraceability.stockInconsistencyEvents,
  );

  for (const item of report.inventory.sanitaryTraceability.byProduct) {
    pushRow(
      "sanitario_custo_produto",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byAnimal) {
    pushRow(
      "sanitario_custo_animal",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byLote) {
    pushRow(
      "sanitario_custo_lote_pecuario",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byStockLot) {
    pushRow(
      "sanitario_custo_lote_estoque",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byProtocol) {
    pushRow(
      "sanitario_custo_protocolo",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.categorias) {
    pushRow(
      "estoque_categoria",
      item.categoria,
      `${item.itens} item(ns) | ${item.lotes} lote(s) | saldo ${item.saldo.toFixed(3)} | +${item.entradas.toFixed(3)} | -${item.saidas.toFixed(3)} | ressuprir ${item.resupplyWarningCount} | critico ${item.resupplyCriticalCount}`,
    );
  }

  for (const item of report.inventory.items) {
    pushRow(
      "estoque_item",
      item.insumo,
      `${item.categoria} | ${item.tipo} | lote ${item.lote} | ${item.apresentacao} | saldo ${item.saldo.toFixed(3)} ${item.unidadeBase} | +${item.entradas.toFixed(3)} | -${item.saidas.toFixed(3)} | ${item.status} | ressuprimento ${item.resupplyStatus} | minimo ${item.minimumStockBase == null ? "" : item.minimumStockBase.toFixed(3)} | ponto ${item.reorderPointBase == null ? "" : item.reorderPointBase.toFixed(3)} | gap ${item.resupplyGap == null ? "" : item.resupplyGap.toFixed(3)}${item.local ? ` | ${item.local}` : ""}`,
    );
  }

  for (const item of report.inventory.replenishmentAlerts) {
    pushRow(
      "estoque_alerta_reposicao",
      item.insumo,
      `${item.severity} | saldo ${item.currentBalanceBase.toFixed(3)} ${item.unidadeBase} | demanda ${item.futureDemandBase == null ? "" : item.futureDemandBase.toFixed(3)} | projetado ${item.projectedBalanceBase == null ? "" : item.projectedBalanceBase.toFixed(3)} | minimo ${item.minimumStockBase == null ? "" : item.minimumStockBase.toFixed(3)} | ponto ${item.reorderPointBase == null ? "" : item.reorderPointBase.toFixed(3)} | ${item.reasons.join(" + ")}`,
    );
  }

  pushRow(
    "estoque_demanda_futura",
    "horizonte_dias",
    report.inventory.futureDemand.horizonDays,
  );
  pushRow(
    "estoque_demanda_futura",
    "status",
    report.inventory.futureDemand.status,
  );
  pushRow(
    "estoque_demanda_futura",
    "agendas_sem_produto",
    report.inventory.futureDemand.missingProductCount,
  );
  pushRow(
    "estoque_demanda_futura",
    "agendas_sem_quantidade",
    report.inventory.futureDemand.missingQuantityCount,
  );

  for (const item of report.inventory.futureDemand.groups) {
    pushRow(
      "estoque_demanda_item",
      item.productName,
      `${item.agendaItemCount} agenda(s) | ${item.animalCount} animal(is) | demanda ${item.estimatedQuantity == null ? "sem quantidade" : item.estimatedQuantity.toFixed(3)} ${item.productUnit} | saldo ${item.availableBalance.toFixed(3)} | gap ${item.balanceGap == null ? "sem quantidade" : item.balanceGap.toFixed(3)}`,
    );
  }

  for (const item of report.regulatoryCompliance.subareas) {
    pushRow(
      "conformidade_subarea",
      item.label,
      `${item.openCount} pendencia(s) | ${item.blockerCount} bloqueio(s) | ${item.warningCount} revisao(oes) | ${item.recommendation}`,
    );
  }

  for (const item of report.regulatoryCompliance.impacts) {
    pushRow(
      "conformidade_impacto",
      item.label,
      `${item.totalCount} alerta(s) | ${item.blockerCount} bloqueio(s) | ${item.warningCount} revisao(oes) | ${item.message}`,
    );
  }

  for (const item of report.manejoByDomain) {
    pushRow("manejo", item.label, item.value);
  }

  for (const item of report.regulatoryCompliance.topItems) {
    pushRow(
      "conformidade_item",
      item.label,
      `${item.statusLabel} | ${item.detail} | ${item.recommendation}`,
    );
  }

  for (const item of report.agendaAttention) {
    pushRow(
      "agenda",
      item.data,
      `${item.titulo} | ${item.contexto}${item.operationalClassLabel ? ` | ${item.operationalClassLabel}` : ""}${item.scheduleLabel ? ` | ${item.scheduleLabel}` : ""}${item.scheduleModeLabel ? ` | ${item.scheduleModeLabel}` : ""}${item.scheduleAnchorLabel ? ` | ${item.scheduleAnchorLabel}` : ""} | ${item.status}${item.priorityLabel ? ` | ${item.priorityLabel}` : ""}`,
    );
  }

  for (const item of report.recentEvents) {
    pushRow("evento", item.data, `${item.dominio} | ${item.contexto}`);
  }

  return lines.join("\r\n");
}

export function buildOperationalSummaryPrintHtml(
  report: OperationalSummaryReport,
  farmName: string,
): string {
  const metricCards = [
    ["Animais ativos", String(report.summary.animaisAtivos)],
    ["Agenda aberta", String(report.summary.agendaAberta)],
    ["Saldo no periodo", report.financeiro.saldo.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })],
    ["Sync pendente", String(report.summary.pendenciasSync)],
  ]
    .map(
      ([label, value]) => `
        <div class="metric-card">
          <span class="metric-label">${escapeHtml(label)}</span>
          <strong class="metric-value">${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");

  const manejoRows = report.manejoByDomain
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.value}</td>
        </tr>
      `,
    )
    .join("");

  const inventoryRows =
    report.inventory.items.length > 0
      ? report.inventory.items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.categoria)}</td>
                <td>${escapeHtml(item.insumo)}</td>
                <td>${escapeHtml(item.lote)}</td>
                <td>${item.saldo.toLocaleString("pt-BR")} ${escapeHtml(item.unidadeBase)}</td>
                <td>+${item.entradas.toLocaleString("pt-BR")} / -${item.saidas.toLocaleString("pt-BR")} | ${escapeHtml(item.resupplyStatus)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5">Sem itens de estoque cadastrados.</td>
          </tr>
        `;

  const futureDemandRows =
    report.inventory.futureDemand.groups.length > 0
      ? report.inventory.futureDemand.groups
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.productName)}</td>
                <td>${item.agendaItemCount} agenda(s) / ${item.animalCount} animal(is)</td>
                <td>${item.estimatedQuantity == null ? "Sem quantidade" : `${item.estimatedQuantity.toLocaleString("pt-BR")} ${escapeHtml(item.productUnit)}`}</td>
                <td>${item.availableBalance.toLocaleString("pt-BR")} ${escapeHtml(item.productUnit)}</td>
                <td>${item.balanceGap == null ? "Sem quantidade" : item.balanceGap.toLocaleString("pt-BR")}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5">Sem demanda futura calculavel nos proximos ${report.inventory.futureDemand.horizonDays} dias.</td>
          </tr>
        `;

  const replenishmentAlertRows =
    report.inventory.replenishmentAlerts.length > 0
      ? report.inventory.replenishmentAlerts
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.insumo)}</td>
                <td>${escapeHtml(item.severity === "critical" ? "Critico" : "Atencao")}</td>
                <td>${item.currentBalanceBase.toLocaleString("pt-BR")} ${escapeHtml(item.unidadeBase)}</td>
                <td>${item.futureDemandBase == null ? "Sem demanda" : `${item.futureDemandBase.toLocaleString("pt-BR")} ${escapeHtml(item.unidadeBase)}`}</td>
                <td>${escapeHtml(item.reasons.join(" + "))}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5">Sem alerta operacional de reposicao.</td>
          </tr>
        `;

  const agendaRows =
    report.agendaAttention.length > 0
      ? report.agendaAttention
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(safeDateLabel(item.data))}</td>
                <td>${escapeHtml(item.titulo)}</td>
                <td>${escapeHtml(
                  [
                    item.contexto,
                    item.operationalClassLabel,
                    item.scheduleLabel,
                    item.scheduleModeLabel,
                    item.scheduleAnchorLabel,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                )}</td>
                <td>${escapeHtml(item.priorityLabel ? `${item.status} | ${item.priorityLabel}` : item.status)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Nenhuma tarefa aberta na agenda.</td>
          </tr>
        `;

  const complianceRows =
    report.regulatoryCompliance.topItems.length > 0
      ? report.regulatoryCompliance.topItems
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td>${escapeHtml(item.statusLabel)}</td>
                <td>${escapeHtml(item.detail)}</td>
                <td>${escapeHtml(item.recommendation)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem pendencias regulatorias abertas no periodo.</td>
          </tr>
        `;

  const biosecurityRows =
    report.biosecurityOccurrences.byTipoOcorrencia.length > 0
      ? report.biosecurityOccurrences.byTipoOcorrencia
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.key)}</td>
                <td>${item.count}</td>
                <td>${escapeHtml(
                  report.biosecurityOccurrences.byGravidade
                    .map((group) => `${group.key}: ${group.count}`)
                    .join(" | "),
                )}</td>
                <td>${escapeHtml(
                  report.biosecurityOccurrences.byEscopo
                    .map((group) => `${group.key}: ${group.count}`)
                    .join(" | "),
                )}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem ocorrencia real de biosseguranca ou suspeita notificavel no periodo.</td>
          </tr>
        `;

  const complianceSubareaRows =
    report.regulatoryCompliance.subareas.length > 0
      ? report.regulatoryCompliance.subareas
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td>${item.openCount}</td>
                <td>${item.blockerCount}</td>
                <td>${escapeHtml(item.recommendation)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem recortes analiticos abertos por subarea.</td>
          </tr>
        `;

  const complianceImpactRows =
    report.regulatoryCompliance.impacts.length > 0
      ? report.regulatoryCompliance.impacts
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td>${item.totalCount}</td>
                <td>${item.blockerCount}</td>
                <td>${escapeHtml(item.message)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem impactos operacionais abertos.</td>
          </tr>
        `;

  const eventRows =
    report.recentEvents.length > 0
      ? report.recentEvents
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(safeDateLabel(item.data))}</td>
                <td>${escapeHtml(item.dominio)}</td>
                <td>${escapeHtml(item.contexto)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="3">Nenhum evento registrado no periodo.</td>
          </tr>
        `;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Resumo operacional - ${escapeHtml(farmName)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 32px;
          }
          h1, h2 {
            margin: 0 0 12px;
          }
          p {
            margin: 0 0 8px;
          }
          .meta {
            color: #475569;
            margin-bottom: 24px;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 20px 0 28px;
          }
          .metric-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 16px;
          }
          .metric-label {
            display: block;
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .metric-value {
            font-size: 22px;
          }
          section {
            margin-bottom: 24px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
            padding: 10px 8px;
            font-size: 14px;
          }
          th {
            color: #475569;
          }
          .finance-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          .finance-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 16px;
          }
          @media print {
            body {
              margin: 18px;
            }
          }
        </style>
      </head>
      <body>
        <h1>Resumo operacional</h1>
        <p><strong>${escapeHtml(farmName)}</strong></p>
        <p class="meta">
          ${escapeHtml(report.range.label)} | ${escapeHtml(safeDateLabel(report.range.from))} a ${escapeHtml(safeDateLabel(report.range.to))}<br />
          Gerado em ${escapeHtml(safeDateTimeLabel(report.generatedAt))}
        </p>

        <div class="metrics">${metricCards}</div>

        <section>
          <h2>Manejos no periodo</h2>
          <table>
            <thead>
              <tr>
                <th>Dominio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${manejoRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Financeiro basico</h2>
          <div class="finance-grid">
            <div class="finance-card">
              <span class="metric-label">Entradas</span>
              <strong>${escapeHtml(report.financeiro.entradas.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }))}</strong>
            </div>
            <div class="finance-card">
              <span class="metric-label">Saidas</span>
              <strong>${escapeHtml(report.financeiro.saidas.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }))}</strong>
            </div>
            <div class="finance-card">
              <span class="metric-label">Saldo</span>
              <strong>${escapeHtml(report.financeiro.saldo.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }))}</strong>
            </div>
          </div>
          <p class="meta" style="margin-top: 12px;">
            ${report.financeiro.transacoes} transacao(oes) no periodo. Pesagens: ${report.pesagem.totalPesagens}.
          </p>
        </section>

        <section>
          <h2>Estoque operacional</h2>
          <p class="meta">
            ${report.inventory.itensAtivos} insumo(s) ativo(s) |
            ${report.inventory.lotesAtivos} lote(s) ativo(s) |
            +${report.inventory.entradasPeriodo.toLocaleString("pt-BR")} /
            -${report.inventory.saidasPeriodo.toLocaleString("pt-BR")} no periodo
            | ${report.inventory.resupplyWarningItems} ressuprimento(s) |
            ${report.inventory.resupplyCriticalItems} critico(s)
          </p>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Insumo</th>
                <th>Lote</th>
                <th>Saldo</th>
                <th>+/- periodo</th>
              </tr>
            </thead>
            <tbody>${inventoryRows}</tbody>
          </table>
          <h3>Demanda futura por agenda valida</h3>
          <p class="meta">
            Horizonte: ${report.inventory.futureDemand.horizonDays} dias |
            Status: ${escapeHtml(report.inventory.futureDemand.status)} |
            ${report.inventory.futureDemand.missingProductCount} agenda(s) sem produto |
            ${report.inventory.futureDemand.missingQuantityCount} agenda(s) sem quantidade
          </p>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Origem</th>
                <th>Demanda</th>
                <th>Saldo</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>${futureDemandRows}</tbody>
          </table>
          <h3>Alertas de reposicao</h3>
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Severidade</th>
                <th>Saldo atual</th>
                <th>Demanda futura</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>${replenishmentAlertRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Conformidade regulatoria</h2>
          <p class="meta">
            ${report.regulatoryCompliance.openCount} pendencia(s) aberta(s) |
            ${report.regulatoryCompliance.blockingCount} bloqueio(s) |
            ${report.regulatoryCompliance.saleBlockers} bloqueio(s) para venda/transito
          </p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Contexto</th>
                <th>Recomendacao</th>
              </tr>
            </thead>
            <tbody>${complianceRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Biosseguranca e ocorrencias sanitarias</h2>
          <p class="meta">
            Fonte: ${escapeHtml(report.biosecurityOccurrences.source)} |
            ${report.biosecurityOccurrences.openCount} ocorrencia(s) aberta(s) |
            ${report.biosecurityOccurrences.pendingCount} pendencia(s) especifica(s) |
            ${report.biosecurityOccurrences.notifiableOpenCount} suspeita(s) notificavel(is) aberta(s)
          </p>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ocorrencias</th>
                <th>Gravidade</th>
                <th>Escopo</th>
              </tr>
            </thead>
            <tbody>${biosecurityRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Recortes regulatorios por subarea</h2>
          <table>
            <thead>
              <tr>
                <th>Subarea</th>
                <th>Pendencias</th>
                <th>Bloqueios</th>
                <th>Recomendacao</th>
              </tr>
            </thead>
            <tbody>${complianceSubareaRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Impacto operacional da conformidade</h2>
          <table>
            <thead>
              <tr>
                <th>Impacto</th>
                <th>Alertas</th>
                <th>Bloqueios</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>${complianceImpactRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Agenda que exige atencao</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tarefa</th>
                <th>Contexto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${agendaRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Eventos recentes</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dominio</th>
                <th>Contexto</th>
              </tr>
            </thead>
            <tbody>${eventRows}</tbody>
          </table>
        </section>
      </body>
    </html>
  `;
}
