import { db } from "@/lib/offline/db";
import type { AgendaItem, ProtocoloSanitarioItem } from "@/lib/offline/types";

export type RegistrarSourceTaskPrefill = {
  protocoloIdFromTask: string | null;
  protocoloItemIdFromTask: string | null;
  produtoFromTask: string | null;
  tipoFromTask: string | null;
  sourceRef: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
};

type LoadAgendaItemFn = (taskId: string) => Promise<AgendaItem | undefined>;
type LoadProtocolItemFn = (
  protocolItemId: string,
) => Promise<ProtocoloSanitarioItem | undefined>;

const readString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export async function loadRegistrarSourceTaskPrefillEffect(input: {
  sourceTaskId: string;
  tipoManejo: string | null;
  loadAgendaItem?: LoadAgendaItemFn;
  loadProtocolItem?: LoadProtocolItemFn;
}): Promise<RegistrarSourceTaskPrefill | null> {
  if (!input.sourceTaskId) {
    return null;
  }
  if (input.tipoManejo && input.tipoManejo !== "sanitario") {
    return null;
  }

  const loadAgendaItem =
    input.loadAgendaItem ?? ((taskId: string) => db.state_agenda_itens.get(taskId));
  const sourceTask = await loadAgendaItem(input.sourceTaskId);

  if (!sourceTask || sourceTask.dominio !== "sanitario") {
    return null;
  }

  const sourceRef = sourceTask.source_ref;
  const protocoloItemIdFromTask = sourceTask.protocol_item_version_id;
  const protocoloIdFromRef = readString(sourceRef, "protocolo_id");
  const produtoFromRefOrPayload =
    readString(sourceRef, "produto") ?? readString(sourceTask.payload, "produto");
  const tipoFromRef = readString(sourceRef, "tipo");
  const shouldLoadProtocolItem =
    protocoloItemIdFromTask &&
    (!protocoloIdFromRef || !produtoFromRefOrPayload || !tipoFromRef);
  const loadProtocolItem =
    input.loadProtocolItem ??
    ((protocolItemId: string) =>
      db.state_protocolos_sanitarios_itens.get(protocolItemId));
  const protocoloItem = shouldLoadProtocolItem
    ? await loadProtocolItem(protocoloItemIdFromTask)
    : undefined;

  return {
    protocoloIdFromTask: protocoloIdFromRef ?? protocoloItem?.protocolo_id ?? null,
    protocoloItemIdFromTask,
    produtoFromTask: produtoFromRefOrPayload ?? protocoloItem?.produto ?? null,
    tipoFromTask: tipoFromRef ?? protocoloItem?.tipo ?? null,
    sourceRef,
    payload: sourceTask.payload,
  };
}
