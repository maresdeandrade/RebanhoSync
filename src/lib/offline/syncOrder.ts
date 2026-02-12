import type { Operation } from "./types";
import { getRemoteTableName } from "./tableMap";

function getActionOrder(action: Operation["action"]): number {
  switch (action) {
    case "INSERT":
      return 0;
    case "UPDATE":
      return 100;
    case "DELETE":
      return 200;
    default:
      return 300;
  }
}

function getTableOrder(remoteTable: string, action: Operation["action"]): number {
  if (action === "DELETE") {
    if (remoteTable.startsWith("eventos_")) return 0;
    if (remoteTable === "eventos") return 10;
    if (remoteTable === "agenda_itens") return 20;
    if (remoteTable === "animais") return 30;
    return 40;
  }

  if (remoteTable === "eventos") return 0;
  if (remoteTable.startsWith("eventos_")) return 10;
  if (remoteTable === "agenda_itens") return 20;
  if (remoteTable === "animais") return 30;
  return 40;
}

export function compareOpsForSync(a: Operation, b: Operation): number {
  const aOrder = typeof a.op_order === "number" ? a.op_order : null;
  const bOrder = typeof b.op_order === "number" ? b.op_order : null;

  if (aOrder !== null && bOrder !== null) {
    if (aOrder !== bOrder) return aOrder - bOrder;
  } else if (aOrder !== null) {
    return -1;
  } else if (bOrder !== null) {
    return 1;
  } else {
    const aActionOrder = getActionOrder(a.action);
    const bActionOrder = getActionOrder(b.action);
    if (aActionOrder !== bActionOrder) return aActionOrder - bActionOrder;

    const aTableOrder = getTableOrder(getRemoteTableName(a.table), a.action);
    const bTableOrder = getTableOrder(getRemoteTableName(b.table), b.action);
    if (aTableOrder !== bTableOrder) return aTableOrder - bTableOrder;
  }

  if (a.created_at !== b.created_at) {
    return a.created_at.localeCompare(b.created_at);
  }
  return a.client_op_id.localeCompare(b.client_op_id);
}

export function sortOpsForSync(ops: Operation[]): Operation[] {
  return [...ops].sort(compareOpsForSync);
}
