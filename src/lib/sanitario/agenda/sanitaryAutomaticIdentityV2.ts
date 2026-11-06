import { readSanitaryPlanningHistoryV2 } from "../checks/sanitaryProtocolPrecheckV2";
import { sanitaryRequiresScheduledContextV2 } from "./sanitaryContextualPlanningV2";
import { resolveSanitaryAnimalContextV2 } from "../windows/sanitaryAnimalContextV2";
import type { SanitarioAgendaLocalV2 } from "@/lib/offline/types";
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
  const animal = source.animals.find((entry) => entry.id === row.animalId);
  const resolution =
    animal && context
      ? resolveSanitaryAnimalContextV2({
          animal,
          source,
          item,
          evaluatedAt: date,
          declared: context,
        })
      : null;
  if (resolution) context = resolution.context;
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
  const keyParts = [
    "sanitary-auto-v2",
    source.fazendaId,
    row.animalId,
    protocol.id,
    protocol.version,
    item.id,
    item.version,
  ];
  const legacyWindowKey = windowKey;
  const legacyKey = [...keyParts, legacyWindowKey].join("|");
  const episodeId =
    sanitaryRequiresScheduledContextV2(item) &&
    (item.eligibilityRule.requires_pregnancy_or_peripartum_context ||
      item.operationalWindowRule.anchor === "parturition")
      ? resolution?.reproductiveEpisodeId
      : null;
  if (episodeId) windowKey = `episode:${episodeId}`;
  let key = [...keyParts, windowKey].join("|");
  // Keep the exact persisted identity (and its pending ops) when the old intent
  // belongs to this cycle or cannot be safely distinguished from it.
  const legacyPrefix = `${keyParts.join("|")}|context:`;
  const legacy =
    episodeId &&
    source.agendas.find(
      (agenda) =>
        agenda.fazenda_id === source.fazendaId &&
        !sanitaryAgendaFromOtherEpisodeV2(source, row, agenda) &&
        typeof agenda.metadata.automationKey === "string" &&
        (agenda.metadata.automationKey === legacyKey ||
          agenda.metadata.automationKey.startsWith(legacyPrefix)) &&
        (!resolution.reproductiveEpisodeDate ||
          agenda.data_programada >= resolution.reproductiveEpisodeDate) &&
        source.agendaAnimals.some(
          (link) =>
            link.agenda_id === agenda.id && link.animal_id === row.animalId,
        ),
    );
  if (legacy) {
    key = legacy.metadata.automationKey as string;
    windowKey =
      typeof legacy.metadata.automationWindowKey === "string"
        ? legacy.metadata.automationWindowKey
        : legacyWindowKey;
  }
  const completionBelongsToCycle =
    !episodeId ||
    !history.completion ||
    (resolution.reproductiveEpisodeDate &&
      history.completion.executedAt.slice(0, 10) >=
        resolution.reproductiveEpisodeDate);
  return {
    key,
    windowKey,
    completed: Boolean(
      completionBelongsToCycle &&
      completedWindow(history, legacyWindowKey, date, context),
    ),
  };
}

function completedWindow(
  history: ReturnType<typeof readSanitaryPlanningHistoryV2>,
  windowKey: string,
  date: string,
  context?: SanitaryOperationalContextV2,
) {
  if (!history.completion) return false;
  if (windowKey.startsWith("context:"))
    return (
      history.completion.executedAt.slice(0, 10) >=
      context.scheduledContext.date
    );
  if (windowKey === date.slice(0, 7))
    return history.completion.executedAt.slice(0, 7) === windowKey;
  if (history.requirement?.kind === "previous_dose")
    return Boolean(
      history.anchor &&
      history.completion.executedAt >= history.anchor.executedAt,
    );
  return history.completedInitial;
}

// Only separate intents when both episodes are evidenced. Missing offline history
// keeps the existing conservative deduplication and never rewrites old intents.
export function sanitaryAgendaFromOtherEpisodeV2(
  source: SanitaryProtocolWindowSourceV2,
  row: Pick<SanitaryProtocolWindowRowV2, "animalId" | "itemId" | "contextResolution">,
  agenda: SanitarioAgendaLocalV2,
) {
  const current = row.contextResolution?.reproductiveEpisodeId;
  const item = source.catalog.items.find((entry) => entry.id === row.itemId);
  const animal = source.animals.find((entry) => entry.id === row.animalId);
  if (!current || !item || !animal || agenda.fazenda_id !== animal.fazenda_id ||
    !sanitaryRequiresScheduledContextV2(item) ||
    !(item.eligibilityRule.requires_pregnancy_or_peripartum_context || item.operationalWindowRule.anchor === "parturition")) return false;
  const key = agenda.metadata.automationKey;
  const storedEpisode = typeof key === "string" ? key.split("|episode:")[1] : undefined;
  if (storedEpisode && source.reproductiveEvents?.some((event) =>
    event.id === storedEpisode && event.animal_id === animal.id && event.fazenda_id === animal.fazenda_id && !event.deleted_at)) {
    return storedEpisode !== current;
  }
  const previous = resolveSanitaryAnimalContextV2({
    animal, source, item, evaluatedAt: agenda.data_programada,
    declared: row.contextResolution!.context,
  }).reproductiveEpisodeId;
  return Boolean(previous && previous !== current);
}

export function suppressedSanitaryAutomaticIntentV2(
  source: SanitaryProtocolWindowSourceV2,
  row: SanitaryProtocolWindowRowV2,
  key: string,
) {
  return source.agendas.some((agenda) => {
    if ((source.fazendaId && agenda.fazenda_id !== source.fazendaId) || sanitaryAgendaFromOtherEpisodeV2(source, row, agenda)) return false;
    if (typeof agenda.metadata.automationKey === "string")
      return agenda.metadata.automationKey === key;
    if (agenda.status !== "cancelada" || agenda.protocolo_id !== row.protocolId)
      return false;
    if (agenda.protocol_item_snapshot.itemKey !== row.itemKey) return false;
    return source.agendaAnimals.some(
      (link) => link.agenda_id === agenda.id && link.animal_id === row.animalId,
    );
  });
}
