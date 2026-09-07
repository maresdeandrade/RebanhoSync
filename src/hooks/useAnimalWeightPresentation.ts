import { useLiveQuery } from "dexie-react-hooks";
import { selectAnimalWeightPresentation } from "@/lib/insights/animalWeightPresentation";
import { db } from "@/lib/offline/db";
import type { Animal } from "@/lib/offline/types";

export function useAnimalWeightPresentation(
  animal: Pick<Animal, "id" | "fazenda_id" | "deleted_at"> | null | undefined,
  fazendaId: string | null | undefined,
) {
  return useLiveQuery(async () => {
    if (!animal?.id || !fazendaId) return null;

    const events = await db.event_eventos
      .where("animal_id")
      .equals(animal.id)
      .filter(
        (event) =>
          event.fazenda_id === fazendaId &&
          event.dominio === "pesagem" &&
          !event.deleted_at,
      )
      .toArray();
    const details = await db.event_eventos_pesagem.bulkGet(
      events.map((event) => event.id),
    );

    return selectAnimalWeightPresentation({
      fazendaId,
      animalId: animal.id,
      animal,
      events,
      weightDetails: details.filter(
        (detail): detail is NonNullable<typeof detail> => Boolean(detail),
      ),
      referenceDate: new Date().toISOString(),
    });
  }, [animal?.id, animal?.fazenda_id, animal?.deleted_at, fazendaId]);
}
