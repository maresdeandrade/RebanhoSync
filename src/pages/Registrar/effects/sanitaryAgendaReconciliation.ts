import { db } from "@/lib/offline/db";
import type {
  AgendaItem,
  OperationInput,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import { normalizeVeterinaryProductText } from "@/lib/sanitario/catalog/products";

type LoadPendingAgendaItemsFn = (input: {
  fazendaId: string;
  animalId: string | null;
  loteId: string | null;
}) => Promise<AgendaItem[]>;

type LoadProtocolItemsFn = (
  ids: string[],
) => Promise<Array<ProtocoloSanitarioItem | undefined>>;

const readString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const defaultLoadPendingAgendaItems: LoadPendingAgendaItemsFn = async ({
  fazendaId,
  animalId,
  loteId,
}) =>
  db.state_agenda_itens
    .where("fazenda_id")
    .equals(fazendaId)
    .filter(
      (item) =>
        item.dominio === "sanitario" &&
        item.status === "agendado" &&
        (animalId
          ? item.animal_id === animalId
          : Boolean(loteId) && item.animal_id !== null && item.lote_id === loteId) &&
        !item.deleted_at &&
        !item.source_evento_id,
    )
    .toArray();

const defaultLoadProtocolItems: LoadProtocolItemsFn = async (ids) =>
  ids.length > 0 ? await db.state_protocolos_sanitarios_itens.bulkGet(ids) : [];

function resolveAgendaItemProduct(input: {
  item: AgendaItem;
  protocolItem: ProtocoloSanitarioItem | null;
}) {
  return (
    input.protocolItem?.produto ??
    readString(input.item.source_ref, "produto") ??
    readString(input.item.payload, "produto") ??
    ""
  );
}

function matchesManualSanitaryAgenda(input: {
  item: AgendaItem;
  protocolItem: ProtocoloSanitarioItem | null;
  selectedProtocolItemId: string | null;
  sanitarioTipo: SanitarioTipoEnum;
  normalizedProductName: string;
}) {
  if (
    input.selectedProtocolItemId &&
    input.item.protocol_item_version_id === input.selectedProtocolItemId
  ) {
    return true;
  }

  const itemTipo = input.protocolItem?.tipo ?? input.item.tipo;
  if (itemTipo !== input.sanitarioTipo) return false;

  const itemProduct = normalizeVeterinaryProductText(
    resolveAgendaItemProduct({
      item: input.item,
      protocolItem: input.protocolItem,
    }),
  );

  return Boolean(itemProduct && itemProduct === input.normalizedProductName);
}

function selectAgendaItemsToComplete(input: {
  matched: AgendaItem[];
  animalId: string | null;
}) {
  if (input.animalId) return input.matched.slice(0, 1);

  const seenAnimalIds = new Set<string>();
  return input.matched.filter((item) => {
    if (!item.animal_id || seenAnimalIds.has(item.animal_id)) return false;
    seenAnimalIds.add(item.animal_id);
    return true;
  });
}

export async function resolveManualSanitaryAgendaCompletionOpsEffect(input: {
  fazendaId: string;
  linkedEventId: string;
  animalId: string | null;
  loteId: string | null;
  sanitarioTipo: SanitarioTipoEnum;
  sanitaryProductName: string;
  protocoloItem: Pick<ProtocoloSanitarioItem, "id"> | null;
  loadPendingAgendaItems?: LoadPendingAgendaItemsFn;
  loadProtocolItems?: LoadProtocolItemsFn;
}): Promise<OperationInput[]> {
  if (!input.animalId && !input.loteId) return [];

  const normalizedProductName = normalizeVeterinaryProductText(
    input.sanitaryProductName,
  );
  if (!normalizedProductName && !input.protocoloItem?.id) return [];

  const loadPendingAgendaItems =
    input.loadPendingAgendaItems ?? defaultLoadPendingAgendaItems;
  const loadProtocolItems = input.loadProtocolItems ?? defaultLoadProtocolItems;
  const pendingItems = await loadPendingAgendaItems({
    fazendaId: input.fazendaId,
    animalId: input.animalId,
    loteId: input.loteId,
  });

  if (pendingItems.length === 0) return [];

  const protocolItemIds = Array.from(
    new Set(
      pendingItems
        .map((item) => item.protocol_item_version_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const protocolItems = await loadProtocolItems(protocolItemIds);
  const protocolItemById = new Map(
    protocolItems
      .filter((item): item is ProtocoloSanitarioItem => Boolean(item))
      .map((item) => [item.id, item]),
  );

  const matched = pendingItems
    .filter((item) =>
      matchesManualSanitaryAgenda({
        item,
        protocolItem: item.protocol_item_version_id
          ? protocolItemById.get(item.protocol_item_version_id) ?? null
          : null,
        selectedProtocolItemId: input.protocoloItem?.id ?? null,
        sanitarioTipo: input.sanitarioTipo,
        normalizedProductName,
      }),
    )
    .sort(
      (left, right) =>
        left.data_prevista.localeCompare(right.data_prevista) ||
        left.id.localeCompare(right.id),
    );

  const agendaItems = selectAgendaItemsToComplete({
    matched,
    animalId: input.animalId,
  });
  if (agendaItems.length === 0) return [];

  return agendaItems.map((agendaItem) => ({
      table: "agenda_itens",
      action: "UPDATE",
      record: {
        id: agendaItem.id,
        status: "concluido",
        source_evento_id: input.linkedEventId,
      },
    }));
}
