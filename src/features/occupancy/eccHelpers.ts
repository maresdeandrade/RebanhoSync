import type { Evento, EventoEcc } from "@/lib/offline/types";

export function getLatestValidEcc(
  animalId: string,
  eccEvents: EventoEcc[],
  baseEventsMap: Map<string, Evento>,
): EventoEcc | null {
  const validEccs = eccEvents.filter((e) => {
    if (e.animal_id !== animalId) return false;
    if (e.deleted_at) return false;
    const base = baseEventsMap.get(e.event_id);
    if (!base || base.deleted_at || base.dominio !== "ecc") return false;
    return true;
  });

  if (validEccs.length === 0) return null;

  return validEccs.reduce((latest, current) => {
    const latestBase = baseEventsMap.get(latest.event_id)!;
    const currentBase = baseEventsMap.get(current.event_id)!;
    return latestBase.occurred_at >= currentBase.occurred_at ? latest : current;
  });
}
