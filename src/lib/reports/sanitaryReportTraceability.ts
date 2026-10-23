import type { Evento, EventoSanitario } from "@/lib/offline/types";
import type {
  OperationalSummaryInput,
  SanitaryTraceabilityCostRow,
  SanitaryTraceabilitySummary,
} from "./operationalSummaryTypes";
import {
  getEventDateKey,
  type resolveMetricTimezone,
} from "./operationalSummaryCalendar";
import { readStringPayload } from "./reportPayload";
import {
  addTraceabilityCost,
  toSortedTraceabilityRows,
} from "./reportTraceability";
import type { buildInventoryStock } from "./inventoryReportStock";

type SanitaryReportStock = Pick<
  ReturnType<typeof buildInventoryStock>,
  "insumos" | "activeInventoryLots" | "apresentacaoById" | "inventoryMovements"
>;
type SanitaryReportTraceabilityArgs = {
  input: Pick<OperationalSummaryInput, "protocoloItensSanitarios">;
  eventos: Evento[];
  sanitaryDetailByEventId: Map<string, EventoSanitario>;
  stock: SanitaryReportStock;
  metricTimezone: ReturnType<typeof resolveMetricTimezone>;
  animalById: Map<string, string>;
  loteById: Map<string, string>;
};

function collectCatalogLinkedEvents(
  sanitaryEvents: Evento[],
  sanitaryDetailByEventId: Map<string, EventoSanitario>,
) {
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
  return { sanitaryCatalogProductIds, catalogLinkedEvents };
}

function summarizeCatalogMappings(
  sanitaryCatalogProductIds: Set<string>,
  { insumos, activeInventoryLots, apresentacaoById }: SanitaryReportStock,
) {
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

    const hasCompatiblePresentation = Array.from(
      apresentacaoById.values(),
    ).some(
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
  return {
    activeLotMappedCatalogProducts,
    presentationMappedCatalogProducts,
    reliablyMappedCatalogProducts,
  };
}

function summarizeSanitaryPrerequisites({
  eventos,
  sanitaryDetailByEventId,
  stock,
}: Pick<
  SanitaryReportTraceabilityArgs,
  "eventos" | "sanitaryDetailByEventId" | "stock"
>) {
  const sanitaryEvents = eventos.filter(
    (evento) => evento.dominio === "sanitario",
  );
  const { sanitaryCatalogProductIds, catalogLinkedEvents } =
    collectCatalogLinkedEvents(sanitaryEvents, sanitaryDetailByEventId);
  const {
    activeLotMappedCatalogProducts,
    presentationMappedCatalogProducts,
    reliablyMappedCatalogProducts,
  } = summarizeCatalogMappings(sanitaryCatalogProductIds, stock);
  const { inventoryMovements } = stock;
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
  return { sanitaryEvents, sanitaryPhase3Prerequisites };
}

function hasTraceableProduct(detail: EventoSanitario) {
  return Boolean(
    detail.produto_veterinario_id ||
    detail.produto_nome_snapshot ||
    detail.produto,
  );
}

function hasTraceableDoseRoute(detail: EventoSanitario) {
  return Boolean(
    typeof detail.dose_quantidade === "number" &&
    detail.dose_quantidade > 0 &&
    detail.dose_unidade &&
    detail.via_aplicacao,
  );
}

function hasStockInconsistency(
  detail: EventoSanitario,
  event: Evento,
  timezone: string,
) {
  return (
    detail.estoque_lote_id &&
    (!detail.estoque_lote_codigo_snapshot ||
      !detail.validade_produto ||
      detail.validade_produto < getEventDateKey(event, timezone))
  );
}

function resolveTraceProtocol(
  detail: EventoSanitario,
  sanitaryProtocolItemById: Map<
    string,
    NonNullable<OperationalSummaryInput["protocoloItensSanitarios"]>[number]
  >,
) {
  const protocolItem = detail.protocol_item_version_id
    ? (sanitaryProtocolItemById.get(detail.protocol_item_version_id) ?? null)
    : null;
  const protocolLabel = protocolItem
    ? `${protocolItem.item_code ?? protocolItem.tipo} / v${protocolItem.version}`
    : detail.protocol_item_version
      ? `Item sanitario v${detail.protocol_item_version}`
      : "Sem protocolo";

  return { protocolItem, protocolLabel };
}

type TraceCostMap = Map<string, SanitaryTraceabilityCostRow>;

function addProductTraceCosts(
  detail: EventoSanitario,
  cost: number,
  sanitaryTraceProduct: TraceCostMap,
  sanitaryTraceStockLot: TraceCostMap,
) {
  addTraceabilityCost(
    sanitaryTraceProduct,
    detail.produto_veterinario_id ??
      detail.produto_nome_snapshot ??
      detail.produto,
    detail.produto_nome_snapshot ?? detail.produto,
    cost,
  );
  addTraceabilityCost(
    sanitaryTraceStockLot,
    detail.estoque_lote_id ?? detail.estoque_lote_codigo_snapshot,
    detail.estoque_lote_codigo_snapshot ?? "Sem lote de estoque",
    cost,
  );
}

function addContextTraceCosts(
  detail: EventoSanitario,
  event: Evento,
  cost: number,
  { protocolItem, protocolLabel }: ReturnType<typeof resolveTraceProtocol>,
  animalById: Map<string, string>,
  loteById: Map<string, string>,
  sanitaryTraceAnimal: TraceCostMap,
  sanitaryTraceLote: TraceCostMap,
  sanitaryTraceProtocol: TraceCostMap,
) {
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

type TraceabilityCounts = Pick<
  SanitaryTraceabilitySummary,
  | "eventsWithStructuredProduct"
  | "eventsWithStockLot"
  | "eventsWithoutCompleteTraceability"
  | "productsWithoutStockLot"
  | "missingCostEvents"
  | "stockInconsistencyEvents"
>;

function countProductTraceability(
  detail: EventoSanitario,
  counts: TraceabilityCounts,
) {
  if (detail.produto_veterinario_id) counts.eventsWithStructuredProduct += 1;
  const hasProduct = hasTraceableProduct(detail);
  if (!hasProduct || !hasTraceableDoseRoute(detail))
    counts.eventsWithoutCompleteTraceability += 1;
  if (hasProduct && detail.custo_total_snapshot == null)
    counts.missingCostEvents += 1;
}

function countStockTraceability(
  detail: EventoSanitario,
  event: Evento,
  timezone: string,
  counts: TraceabilityCounts,
) {
  if (detail.estoque_lote_id) counts.eventsWithStockLot += 1;
  if (hasTraceableProduct(detail) && !detail.estoque_lote_id)
    counts.productsWithoutStockLot += 1;
  if (hasStockInconsistency(detail, event, timezone))
    counts.stockInconsistencyEvents += 1;
}

function summarizeSanitaryTraceability(
  {
    input,
    sanitaryDetailByEventId,
    metricTimezone,
    animalById,
    loteById,
  }: Omit<SanitaryReportTraceabilityArgs, "eventos" | "stock">,
  sanitaryEvents: Evento[],
) {
  const sanitaryTraceProduct = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceStockLot = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceAnimal = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceLote = new Map<string, SanitaryTraceabilityCostRow>();
  const sanitaryTraceProtocol = new Map<string, SanitaryTraceabilityCostRow>();
  let sanitaryTraceTotalCost = 0;
  const counts = {
    eventsWithStructuredProduct: 0,
    eventsWithStockLot: 0,
    eventsWithoutCompleteTraceability: 0,
    productsWithoutStockLot: 0,
    missingCostEvents: 0,
    stockInconsistencyEvents: 0,
  };
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
    countProductTraceability(detail, counts);
    countStockTraceability(detail, event, metricTimezone.timezone, counts);
    const protocol = resolveTraceProtocol(detail, sanitaryProtocolItemById);
    addProductTraceCosts(
      detail,
      cost,
      sanitaryTraceProduct,
      sanitaryTraceStockLot,
    );
    addContextTraceCosts(
      detail,
      event,
      cost,
      protocol,
      animalById,
      loteById,
      sanitaryTraceAnimal,
      sanitaryTraceLote,
      sanitaryTraceProtocol,
    );
  }

  const sanitaryTraceability: SanitaryTraceabilitySummary = {
    totalCost: sanitaryTraceTotalCost,
    ...counts,
    byProduct: toSortedTraceabilityRows(sanitaryTraceProduct),
    byStockLot: toSortedTraceabilityRows(sanitaryTraceStockLot),
    byAnimal: toSortedTraceabilityRows(sanitaryTraceAnimal),
    byLote: toSortedTraceabilityRows(sanitaryTraceLote),
    byProtocol: toSortedTraceabilityRows(sanitaryTraceProtocol),
  };
  return { sanitaryTraceability, sanitaryProtocolItemById };
}

export function buildSanitaryReportTraceability(
  args: SanitaryReportTraceabilityArgs,
) {
  const { sanitaryEvents, sanitaryPhase3Prerequisites } =
    summarizeSanitaryPrerequisites(args);
  const { sanitaryTraceability, sanitaryProtocolItemById } =
    summarizeSanitaryTraceability(args, sanitaryEvents);
  return {
    sanitaryPhase3Prerequisites,
    sanitaryTraceability,
    sanitaryProtocolItemById,
  };
}
