import type {
  AgendaItem,
  Animal,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  createSanitarySupplyNeedsInsight,
  type SanitarySupplyNeedGroup,
} from "@/lib/insights/sanitarySupplyNeeds";
import { selectFutureSanitarySupplyAgenda } from "@/lib/reports/futureSanitarySupplyAgenda";
import {
  evaluateInventoryReplenishmentAlert,
  parseInventoryResupplyPolicy,
} from "@/lib/inventory/resupplyPolicy";
import type {
  InventoryFutureDemandRow,
  InventoryReplenishmentAlertRow,
  OperationalSummaryInput,
} from "./operationalSummaryTypes";
import { readStringPayload, readNumberPayload } from "./reportPayload";
import {
  normalizeInventoryCategory,
  type buildInventoryStock,
} from "./inventoryReportStock";

type InventoryDemandInput = Pick<
  OperationalSummaryInput,
  | "protocoloItensSanitarios"
  | "futureSanitaryAgendaItems"
  | "sanitarioAgendaV2"
  | "sanitarioAgendaAnimaisV2"
  | "fazendaId"
  | "agenda"
  | "animals"
  | "lotes"
>;
type InventoryDemandStock = Pick<
  ReturnType<typeof buildInventoryStock>,
  | "inventoryItems"
  | "insumoById"
  | "inventoryLotById"
  | "insumos"
  | "inventorySaldoByInsumo"
>;

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

function adaptFutureSupplyAgenda(
  input: InventoryDemandInput,
  animals: Animal[],
  agendaAberta: AgendaItem[],
) {
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
  const legacySupplyAgendaItems = agendaAberta.map((item) => {
    const protocolItem = item.protocol_item_version_id
      ? (protocolItemByIdForDemand.get(item.protocol_item_version_id) ?? null)
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
          ? (animalCountByLote.get(item.lote_id) ?? 1)
          : 1,
    };
  });
  const composedSanitaryAgendaItems =
    input.futureSanitaryAgendaItems ??
    (input.sanitarioAgendaV2 !== undefined
      ? selectFutureSanitarySupplyAgenda({
          activeFarmId: input.fazendaId,
          legacyItems: input.agenda,
          agendaV2: input.sanitarioAgendaV2,
          agendaAnimalsV2: input.sanitarioAgendaAnimaisV2 ?? [],
          animals: input.animals,
          lots: input.lotes,
          protocolItems: input.protocoloItensSanitarios ?? [],
        })
      : undefined);
  const usingComposedSanitaryAgenda = composedSanitaryAgendaItems !== undefined;
  const supplyAgendaItems =
    composedSanitaryAgendaItems ?? legacySupplyAgendaItems;
  const futureDemandSource:
    | "state_agenda_itens + ops_sanitario_agenda_v2"
    | "state_agenda_itens" = usingComposedSanitaryAgenda
    ? "state_agenda_itens + ops_sanitario_agenda_v2"
    : "state_agenda_itens";
  const futureDemandLimitations = [
    "Demanda futura representa planejamento; nao comprova execucao historica.",
    usingComposedSanitaryAgenda
      ? "Projecao analitica combina Agenda Sanitária v2 canonica com compatibilidade legacy apenas por identidade explicita."
      : "O caller nao forneceu a projecao composta; o resultado usa state_agenda_itens legado.",
  ];
  return {
    supplyAgendaItems,
    usingComposedSanitaryAgenda,
    futureDemandSource,
    futureDemandLimitations,
  };
}

function summarizeFutureDemandGroups(
  futureSupplyNeeds: ReturnType<typeof createSanitarySupplyNeedsInsight>,
  {
    inventoryItems,
    insumoById,
    inventoryLotById,
  }: Pick<
    InventoryDemandStock,
    "inventoryItems" | "insumoById" | "inventoryLotById"
  >,
) {
  const getAvailableInventoryBalance = (group: SanitarySupplyNeedGroup) => {
    const productName = group.productName?.trim().toLowerCase();
    return inventoryItems.reduce((acc, item) => {
      const insumo = insumoById.get(
        inventoryLotById.get(item.id)?.insumo_id ?? "",
      );
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
  return { futureDemandGroups, futureDemandMissingQuantity };
}

function buildReplenishmentAlerts(
  futureDemandGroups: InventoryFutureDemandRow[],
  {
    insumos,
    inventorySaldoByInsumo,
  }: Pick<InventoryDemandStock, "insumos" | "inventorySaldoByInsumo">,
) {
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
        minimumStockBase: parseInventoryResupplyPolicy(insumo.payload)
          .minimumStockBase,
        reorderPointBase: parseInventoryResupplyPolicy(insumo.payload)
          .reorderPointBase,
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

  return replenishmentAlerts;
}

export function buildInventoryDemand({
  input,
  animals,
  agendaAberta,
  todayKey,
  stock,
}: {
  input: InventoryDemandInput;
  animals: Animal[];
  agendaAberta: AgendaItem[];
  todayKey: string;
  stock: InventoryDemandStock;
}) {
  const demandHorizonDays = 30;
  const {
    supplyAgendaItems,
    usingComposedSanitaryAgenda,
    futureDemandSource,
    futureDemandLimitations,
  } = adaptFutureSupplyAgenda(input, animals, agendaAberta);
  const futureSupplyNeeds = createSanitarySupplyNeedsInsight({
    questionKind: "future_need",
    question: "Demanda futura de insumos sanitarios por agenda valida",
    generatedAt: new Date().toISOString(),
    items: supplyAgendaItems,
    scope: "due_within_days",
    referenceDate: todayKey,
    days: demandHorizonDays,
    primarySource: futureDemandSource,
    auxiliarySources: usingComposedSanitaryAgenda
      ? [
          "ops_sanitario_agenda_animais_v2",
          "state_animais",
          "state_lotes",
          "protocolos_sanitarios",
          "protocolos_sanitarios_itens",
          "produtos_veterinarios",
        ]
      : undefined,
  });
  const { futureDemandGroups, futureDemandMissingQuantity } =
    summarizeFutureDemandGroups(futureSupplyNeeds, stock);
  const replenishmentAlerts = buildReplenishmentAlerts(
    futureDemandGroups,
    stock,
  );
  return {
    demandHorizonDays,
    futureDemandSource,
    futureDemandLimitations,
    futureSupplyNeeds,
    futureDemandGroups,
    futureDemandMissingQuantity,
    replenishmentAlerts,
  };
}
