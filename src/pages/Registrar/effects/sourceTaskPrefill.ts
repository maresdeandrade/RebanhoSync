import { db } from "@/lib/offline/db";
import type { AgendaItem } from "@/lib/offline/types";

export type RegistrarSourceTaskPrefill = {
  protocoloIdFromTask: string | null;
  protocoloItemIdFromTask: string | null;
  produtoFromTask: string | null;
  tipoFromTask: string | null;
  sourceRef: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
};

type LoadAgendaItemFn = (taskId: string) => Promise<AgendaItem | undefined>;

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
  return {
    protocoloIdFromTask: readString(sourceRef, "protocolo_id"),
    protocoloItemIdFromTask:
      readString(sourceRef, "protocolo_item_id") ?? sourceTask.protocol_item_version_id,
    produtoFromTask:
      readString(sourceRef, "produto") ?? readString(sourceTask.payload, "produto"),
    tipoFromTask: readString(sourceRef, "tipo"),
    sourceRef,
    payload: sourceTask.payload,
  };
}
