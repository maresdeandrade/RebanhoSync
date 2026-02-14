
import { db } from "@/lib/offline/db";
import type { Evento, EventoReproducao } from "@/lib/offline/types";

export type ReproEventJoined = Evento & { details?: EventoReproducao };

/**
 * Efficiently joins event_eventos with event_eventos_reproducao using a Map approach.
 * optimized for bulk operations (Dashboard, specialized lists).
 */
export async function getReproductionEventsJoined(fazendaId: string): Promise<ReproEventJoined[]> {
  // 1. Fetch Headers (filtered by domain)
  const headers = await db.event_eventos
    .where("fazenda_id").equals(fazendaId)
    .filter(e => e.dominio === 'reproducao' && !e.deleted_at)
    .toArray();

  if (headers.length === 0) return [];

  // 2. Fetch Details (All repro details for farm - usually smaller or equal count to headers)
  // We fetch all because checking ID one-by-one is slow for Dexie basic backend
  // Alternatively we could use .bulkGet(ids) if we map ids first.
  const ids = headers.map(h => h.id);
  const details = await db.event_eventos_reproducao.bulkGet(ids); // BulkGet is efficient
  
  // 3. Map details by ID
  const detailMap = new Map<string, EventoReproducao>();
  details.forEach(d => {
      if (d) detailMap.set(d.evento_id, d);
  });

  // 4. Merge
  return headers.map(evt => ({
    ...evt,
    details: detailMap.get(evt.id)
  }));
}

/**
 * Fetches full reproduction history for a single animal.
 */
export async function getAnimalReproHistory(animalId: string): Promise<ReproEventJoined[]> {
   const headers = await db.event_eventos
    .where("animal_id").equals(animalId)
    .filter(e => e.dominio === 'reproducao' && !e.deleted_at)
    .sortBy("occurred_at"); // Dexie returns ascending by default
   
   // Reverse to get Descending (most recent first)
   headers.reverse();

   const ids = headers.map(h => h.id);
   const details = await db.event_eventos_reproducao.bulkGet(ids);

   const detailMap = new Map<string, EventoReproducao>();
   details.forEach(d => { if (d) detailMap.set(d.evento_id, d); });

   return headers.map(evt => ({
     ...evt,
     details: detailMap.get(evt.id)
   }));
}
