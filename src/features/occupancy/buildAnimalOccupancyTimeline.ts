import { differenceInDays, parseISO } from "date-fns";
import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod } from "./occupancyTypes";

interface BuildAnimalOccupancyTimelineInput {
  animalId: string;
  events: Evento[];
  movimentacoes: Map<string, EventoMovimentacao>;
  referenceDate: string;
}

export function buildAnimalOccupancyTimeline({
  animalId,
  events,
  movimentacoes,
  referenceDate,
}: BuildAnimalOccupancyTimelineInput): AnimalOccupancyPeriod[] {
  const animalMovementEvents = events
    .filter(
      (e) =>
        e.dominio === "movimentacao" &&
        !e.deleted_at &&
        e.animal_id === animalId,
    )
    .sort(
      (a, b) =>
        parseISO(a.occurred_at).getTime() - parseISO(b.occurred_at).getTime(),
    );

  const periods: AnimalOccupancyPeriod[] = [];

  if (animalMovementEvents.length === 0) {
    return periods;
  }

  let currentPeriod: AnimalOccupancyPeriod | null = null;

  for (const event of animalMovementEvents) {
    const movimentacao = movimentacoes.get(event.id);
    if (!movimentacao) continue;

    const occurredAt = event.occurred_at;

    if (currentPeriod) {
      // Close the previous period
      currentPeriod.saidaAt = occurredAt;
      currentPeriod.dias = differenceInDays(
        parseISO(currentPeriod.saidaAt),
        parseISO(currentPeriod.entradaAt),
      );
      periods.push(currentPeriod);
    }

    // Start a new period
    currentPeriod = {
      animalId,
      loteId: movimentacao.to_lote_id,
      pastoId: movimentacao.to_pasto_id,
      entradaAt: occurredAt,
      saidaAt: null,
      dias: 0,
      weightStatus: { status: "empty" },
      eccStatus: { status: "empty" },
    };
  }

  // If there's an open period, calculate its duration until the reference date
  if (currentPeriod) {
    currentPeriod.dias = differenceInDays(
      parseISO(referenceDate),
      parseISO(currentPeriod.entradaAt),
    );
    periods.push(currentPeriod);
  }

  return periods;
}
