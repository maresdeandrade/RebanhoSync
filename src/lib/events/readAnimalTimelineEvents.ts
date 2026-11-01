import { db } from "@/lib/offline/db";

export async function readAnimalTimelineEvents(fazendaId: string, animalId: string) {
  const [direct, relations] = await Promise.all([
    db.event_eventos.where("animal_id").equals(animalId)
      .filter(event => event.fazenda_id === fazendaId).toArray(),
    db.event_eventos_animais.where("[fazenda_id+animal_id]")
      .equals([fazendaId, animalId]).toArray(),
  ]);
  const related = await db.event_eventos.bulkGet(relations.map(r => r.evento_id));
  const events = new Map(direct.map(event => [event.id, event]));
  for (const event of related) {
    if (event?.fazenda_id === fazendaId && event.dominio === "sanitario")
      events.set(event.id, event);
  }
  return [...events.values()].filter(event => event.dominio !== "sanitario" ||
    event.sanitario_v3_confirmation == null || event.sanitario_v3_confirmation === "confirmed")
    .sort((a,b) => b.occurred_at.localeCompare(a.occurred_at));
}
