import { sanitaryRequiresScheduledContextV2, sanitaryScheduledDateValidV2 } from "./sanitaryContextualPlanningV2";
import { rebuildReproductiveProjection } from "@/lib/reproduction/status";
import type { SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import type { SanitaryProtocolWindowSourceV2, SanitaryProtocolWindowRowV2 } from "../windows/sanitaryProtocolWindowsV2";

// Only separate intents when both reproductive episodes are evidenced.
export function sanitaryAgendaFromOtherEpisodeV2(
  source: SanitaryProtocolWindowSourceV2,
  row: Pick<SanitaryProtocolWindowRowV2, "animalId" | "itemId" | "contextResolution">,
  agenda: SanitarioAgendaLocalV2,
) {
  const current = row.contextResolution?.reproductiveEpisodeId;
  const item = source.catalog.items.find((entry) => entry.id === row.itemId);
  const animal = source.animals.find((entry) => entry.id === row.animalId);
  if (
    !current || !item || !animal || agenda.fazenda_id !== animal.fazenda_id ||
    !sanitaryRequiresScheduledContextV2(item) ||
    !(item.eligibilityRule.requires_pregnancy_or_peripartum_context || item.operationalWindowRule.anchor === "parturition")
  ) return false;
  if (!sanitaryScheduledDateValidV2(agenda.data_programada)) return false;
  const events = (source.reproductiveEvents ?? []).filter((event) =>
    event.animal_id === animal.id && event.fazenda_id === animal.fazenda_id &&
    !event.deleted_at && sanitaryScheduledDateValidV2(event.occurred_at.slice(0, 10)) &&
    event.occurred_at.slice(0, 10) <= agenda.data_programada &&
    event.details && !event.details.deleted_at,
  );
  const projection = rebuildReproductiveProjection(events);
  const previous = !projection.inconsistency && projection.status === "PRENHA"
    ? projection.diagnosedEpisodeId : null;
  return Boolean(previous && previous !== current);
}
