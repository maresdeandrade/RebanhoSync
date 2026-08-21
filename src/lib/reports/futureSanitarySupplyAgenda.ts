import type { SanitarySupplyAgendaItemInput } from "@/lib/insights/sanitarySupplyNeeds";
import type {
  AgendaItem,
  Animal,
  Lote,
  ProtocoloSanitarioItem,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";

export type FutureSanitaryAgendaSources = {
  activeFarmId: string;
  legacyItems: readonly AgendaItem[];
  agendaV2: readonly SanitarioAgendaLocalV2[];
  agendaAnimalsV2: readonly SanitarioAgendaAnimalLocalV2[];
  animals: readonly Animal[];
  lots: readonly Lote[];
  protocolItems?: readonly ProtocoloSanitarioItem[];
};

function readText(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function readExplicitAgendaV2Id(item: AgendaItem): string | null {
  return readText(item.source_ref, ["agenda_v2_id", "sanitario_agenda_v2_id"]);
}

function selectTextFromV2Sources(
  agenda: SanitarioAgendaLocalV2,
  keys: readonly string[],
): string | null {
  return (
    readText(agenda.produto_snapshot, keys) ??
    readText(agenda.metadata, keys) ??
    readText(agenda.protocol_item_snapshot, keys)
  );
}

function selectNumberFromV2Sources(
  agenda: SanitarioAgendaLocalV2,
  keys: readonly string[],
): number | null {
  return (
    readNumber(agenda.produto_snapshot, keys) ??
    readNumber(agenda.metadata, keys) ??
    readNumber(agenda.protocol_item_snapshot, keys)
  );
}

function mapV2Status(status: SanitarioAgendaLocalV2["status"]): string {
  if (status === "executada" || status === "fechada") return "concluido";
  if (status === "cancelada" || status === "dispensada") return "cancelado";
  return "agendado";
}

function knownValuesConflict(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return Boolean(left && right && left !== right);
}

function couldRepresentSameIntent(
  legacyItem: SanitarySupplyAgendaItemInput,
  agendaV2Item: SanitarySupplyAgendaItemInput,
): boolean {
  if (
    legacyItem.status !== "agendado" ||
    agendaV2Item.status !== "agendado" ||
    legacyItem.deletedAt ||
    agendaV2Item.deletedAt ||
    legacyItem.dueDate !== agendaV2Item.dueDate
  ) {
    return false;
  }

  return !(
    knownValuesConflict(legacyItem.animalId, agendaV2Item.animalId) ||
    knownValuesConflict(legacyItem.loteId, agendaV2Item.loteId) ||
    knownValuesConflict(legacyItem.protocolId, agendaV2Item.protocolId) ||
    knownValuesConflict(
      legacyItem.protocolItemVersionId,
      agendaV2Item.protocolItemVersionId,
    ) ||
    knownValuesConflict(legacyItem.productId, agendaV2Item.productId) ||
    knownValuesConflict(legacyItem.productName, agendaV2Item.productName)
  );
}

function selectLegacyItems(input: {
  activeFarmId: string;
  items: readonly AgendaItem[];
  animals: readonly Animal[];
  lots: readonly Lote[];
  protocolItems: readonly ProtocoloSanitarioItem[];
  canonicalAgendaV2Ids: ReadonlySet<string>;
}): SanitarySupplyAgendaItemInput[] {
  const protocolItemsById = new Map(
    input.protocolItems
      .filter((item) => item.fazenda_id === input.activeFarmId && !item.deleted_at)
      .map((item) => [item.id, item]),
  );
  const activeAnimalCountByLot = new Map<string, number>();
  const validLotIds = new Set(
    input.lots
      .filter((lot) => lot.fazenda_id === input.activeFarmId && !lot.deleted_at)
      .map((lot) => lot.id),
  );
  for (const animal of input.animals) {
    if (
      animal.fazenda_id !== input.activeFarmId ||
      animal.status !== "ativo" ||
      animal.deleted_at ||
      !animal.lote_id
    ) {
      continue;
    }
    activeAnimalCountByLot.set(
      animal.lote_id,
      (activeAnimalCountByLot.get(animal.lote_id) ?? 0) + 1,
    );
  }

  return input.items
    .filter((item) => item.fazenda_id === input.activeFarmId)
    .filter((item) => {
      const linkedAgendaV2Id = readExplicitAgendaV2Id(item);
      return !linkedAgendaV2Id || !input.canonicalAgendaV2Ids.has(linkedAgendaV2Id);
    })
    .map((item) => {
      const protocolItem = item.protocol_item_version_id
        ? protocolItemsById.get(item.protocol_item_version_id) ?? null
        : null;
      const productId =
        readText(item.source_ref, ["produto_veterinario_id"]) ??
        readText(item.payload, ["produto_veterinario_id"]) ??
        readText(protocolItem?.payload, ["produto_veterinario_id"]);
      const productName =
        readText(item.source_ref, ["produto_nome_catalogo", "produto"]) ??
        readText(item.payload, ["produto_nome_catalogo", "produto"]) ??
        readText(protocolItem?.payload, ["produto_nome_catalogo"]) ??
        protocolItem?.produto ??
        null;
      const quantityKeys = [
        "quantityPerAnimal",
        "quantity_per_animal",
        "quantidade_por_animal",
      ] as const;

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
        productId,
        productName,
        productUnit:
          readText(item.payload, ["productUnit", "unidade_base"]) ??
          readText(item.source_ref, ["productUnit", "unidade_base"]) ??
          readText(protocolItem?.payload, ["productUnit", "unidade_base"]) ??
          "dose",
        quantityPerAnimal:
          readNumber(item.payload, quantityKeys) ??
          readNumber(item.source_ref, quantityKeys) ??
          readNumber(protocolItem?.payload, quantityKeys),
        animalCount: item.animal_id
          ? 1
          : item.lote_id
            ? validLotIds.has(item.lote_id)
              ? (activeAnimalCountByLot.get(item.lote_id) ?? 0)
              : null
            : 1,
      };
    })
    .filter((item) => item.animalCount !== 0);
}

function selectAgendaV2Items(input: {
  activeFarmId: string;
  agendas: readonly SanitarioAgendaLocalV2[];
  agendaAnimals: readonly SanitarioAgendaAnimalLocalV2[];
  animals: readonly Animal[];
  lots: readonly Lote[];
}): SanitarySupplyAgendaItemInput[] {
  const validAnimalsById = new Map(
    input.animals
      .filter(
        (animal) =>
          animal.fazenda_id === input.activeFarmId &&
          animal.status === "ativo" &&
          !animal.deleted_at,
      )
      .map((animal) => [animal.id, animal]),
  );
  const validLotIds = new Set(
    input.lots
      .filter((lot) => lot.fazenda_id === input.activeFarmId && !lot.deleted_at)
      .map((lot) => lot.id),
  );
  const plannedAnimalIdsByAgenda = new Map<string, Set<string>>();

  for (const relation of input.agendaAnimals) {
    if (
      relation.fazenda_id !== input.activeFarmId ||
      relation.planned_status !== "planejado" ||
      !validAnimalsById.has(relation.animal_id)
    ) {
      continue;
    }
    const animalIds = plannedAnimalIdsByAgenda.get(relation.agenda_id) ?? new Set();
    animalIds.add(relation.animal_id);
    plannedAnimalIdsByAgenda.set(relation.agenda_id, animalIds);
  }

  return input.agendas
    .filter((agenda) => agenda.fazenda_id === input.activeFarmId)
    .map((agenda) => {
      const plannedAnimalIds = plannedAnimalIdsByAgenda.get(agenda.id) ?? new Set();
      const target = agenda.metadata.target;
      const targetRecord =
        target && typeof target === "object" && !Array.isArray(target)
          ? (target as Record<string, unknown>)
          : null;
      const explicitAnimalId =
        targetRecord?.scope === "animal" && typeof targetRecord.id === "string"
          ? targetRecord.id
          : null;
      const validExplicitAnimalId =
        explicitAnimalId && validAnimalsById.has(explicitAnimalId)
          ? explicitAnimalId
          : null;
      const wholeLotTarget =
        agenda.lote_id !== null &&
        validLotIds.has(agenda.lote_id) &&
        readText(agenda.metadata, ["targetAnimalScope"]) ===
          "lote_sem_animais_explicitos";
      const wholeLotAnimalCount = wholeLotTarget
        ? Array.from(validAnimalsById.values()).filter(
            (animal) => animal.lote_id === agenda.lote_id,
          ).length
        : null;
      const animalCount =
        plannedAnimalIds.size > 0
          ? plannedAnimalIds.size
          : validExplicitAnimalId
            ? 1
            : wholeLotAnimalCount;

      return {
        id: `sanitario-v2:${agenda.id}`,
        status: mapV2Status(agenda.status),
        dueDate: agenda.data_programada,
        deletedAt: agenda.deleted_at,
        domain: "sanitario",
        animalId:
          plannedAnimalIds.size === 1
            ? Array.from(plannedAnimalIds)[0]
            : validExplicitAnimalId,
        loteId: agenda.lote_id,
        protocolId: agenda.protocolo_id,
        protocolItemVersionId: agenda.protocol_item_version_id,
        productId: agenda.produto_veterinario_id,
        productName: selectTextFromV2Sources(agenda, [
          "productName",
          "product_name",
          "nomeComercial",
          "nome_comercial",
          "produto_nome_catalogo",
        ]),
        productUnit: selectTextFromV2Sources(agenda, [
          "productUnit",
          "product_unit",
          "unidade_base",
          "unidade",
        ]),
        quantityPerAnimal: selectNumberFromV2Sources(agenda, [
          "quantityPerAnimal",
          "quantity_per_animal",
          "quantidade_por_animal",
        ]),
        animalCount,
      };
    })
    .filter((item) => item.animalCount !== 0);
}

export function selectFutureSanitarySupplyAgenda(
  sources: FutureSanitaryAgendaSources,
): SanitarySupplyAgendaItemInput[] {
  const activeFarmId = sources.activeFarmId.trim();
  if (!activeFarmId) return [];

  const canonicalAgendaV2Ids = new Set(
    sources.agendaV2
      .filter((agenda) => agenda.fazenda_id === activeFarmId)
      .map((agenda) => agenda.id),
  );

  const legacyItems = selectLegacyItems({
    activeFarmId,
    items: sources.legacyItems,
    animals: sources.animals,
    lots: sources.lots,
    protocolItems: sources.protocolItems ?? [],
    canonicalAgendaV2Ids,
  });
  const agendaV2Items = selectAgendaV2Items({
    activeFarmId,
    agendas: sources.agendaV2,
    agendaAnimals: sources.agendaAnimalsV2,
    animals: sources.animals,
    lots: sources.lots,
  });
  const overlappingLegacyIds = new Set<string>();
  const overlappingAgendaV2Ids = new Set<string>();

  for (const legacyItem of legacyItems) {
    for (const agendaV2Item of agendaV2Items) {
      if (!couldRepresentSameIntent(legacyItem, agendaV2Item)) continue;
      overlappingLegacyIds.add(legacyItem.id);
      overlappingAgendaV2Ids.add(agendaV2Item.id);
    }
  }

  return [
    ...legacyItems.map((item) => ({
      ...item,
      possibleSourceOverlap: overlappingLegacyIds.has(item.id),
    })),
    ...agendaV2Items.map((item) => ({
      ...item,
      possibleSourceOverlap: overlappingAgendaV2Ids.has(item.id),
    })),
  ];
}
