import { readSanitaryPlanningHistoryV2 } from "../checks/sanitaryProtocolPrecheckV2";
import { sanitaryRequiresScheduledContextV2 } from "./sanitaryContextualPlanningV2";
import type {
  SanitaryProtocolWindowSourceV2,
  SanitaryProtocolWindowRowV2,
  SanitaryOperationalContextV2,
} from "../windows/sanitaryProtocolWindowsV2";

export function sanitaryAutomaticIdentityV2(
  source: SanitaryProtocolWindowSourceV2,
  row: SanitaryProtocolWindowRowV2,
  date: string,
  context?: SanitaryOperationalContextV2,
) {
  const item = source.catalog.items.find((entry) => entry.id === row.itemId)!;
  const protocol = source.catalog.protocols.find(
    (entry) => entry.id === row.protocolId,
  )!;
  const history = readSanitaryPlanningHistoryV2({
    catalog: source.catalog,
    item,
    protocol,
    animalId: row.animalId,
    history: source.executedHistory,
    today: date,
  });
  const months = item.operationalWindowRule.calendar_months;
  let windowKey = "initial";
  if (Array.isArray(months) && months.length) windowKey = date.slice(0, 7);
  if (history.anchor)
    windowKey = `event:${history.anchor.eventId}:${history.anchor.executedAt}`;
  if (sanitaryRequiresScheduledContextV2(item) && context?.scheduledContext)
    windowKey = `context:${context.scheduledContext.date}`;
  const key = [
    "sanitary-auto-v2",
    source.fazendaId,
    row.animalId,
    protocol.id,
    protocol.version,
    item.id,
    item.version,
    windowKey,
  ].join("|");
  return { key, windowKey, completed: completedWindow(history, windowKey, date, context) };
}

function completedWindow(
  history: ReturnType<typeof readSanitaryPlanningHistoryV2>, windowKey: string,
  date: string, context?: SanitaryOperationalContextV2,
) {
  if (!history.completion) return false;
  if (windowKey.startsWith("context:")) return history.completion.executedAt.slice(0, 10) >= context.scheduledContext.date;
  if (windowKey === date.slice(0, 7)) return history.completion.executedAt.slice(0, 7) === windowKey;
  if (history.requirement?.kind === "previous_dose")
    return Boolean(history.anchor && history.completion.executedAt >= history.anchor.executedAt);
  return history.completedInitial;
}

export function suppressedSanitaryAutomaticIntentV2(
  source: SanitaryProtocolWindowSourceV2,
  row: SanitaryProtocolWindowRowV2,
  key: string,
) {
  return source.agendas.some((agenda) => {
    if (typeof agenda.metadata.automationKey === "string") return agenda.metadata.automationKey === key;
    if (agenda.status !== "cancelada" || agenda.protocolo_id !== row.protocolId)
      return false;
    if (agenda.protocol_item_snapshot.itemKey !== row.itemKey) return false;
    return source.agendaAnimals.some(
      (link) => link.agenda_id === agenda.id && link.animal_id === row.animalId,
    );
  });
}
