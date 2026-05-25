import { parseISO } from "date-fns";
import type { Evento, EventoReproducao } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod } from "./occupancyTypes";

export interface EccMetricsInput {
  period: AnimalOccupancyPeriod;
  events: Evento[];
  reproducoes: Map<string, EventoReproducao>;
}

export function buildEccMetricsForOccupancy({
  period,
  events,
  reproducoes,
}: EccMetricsInput): AnimalOccupancyPeriod {
  const animalEccEvents = events
    .filter(
      (e) =>
        e.dominio === "reproducao" &&
        !e.deleted_at &&
        e.animal_id === period.animalId,
    )
    .map((e) => ({
      occurredAt: e.occurred_at,
      ecc: reproducoes.get(e.id)?.payload?.escore_condicao_corporal || 0,
    }))
    .filter((e) => e.ecc > 0)
    .sort((a, b) => parseISO(a.occurredAt).getTime() - parseISO(b.occurredAt).getTime());

  const start = parseISO(period.entradaAt);
  const end = period.saidaAt ? parseISO(period.saidaAt) : null;

  // ECC inicial: mais proximo da entrada (preferencialmente dentro ou anterior proximo)
  const eccInicialEntry = animalEccEvents.reduce((prev, curr) => {
    const currTime = parseISO(curr.occurredAt).getTime();
    const startTime = start.getTime();
    const prevTime = parseISO(prev.occurredAt).getTime();

    if (Math.abs(currTime - startTime) < Math.abs(prevTime - startTime)) {
      return curr;
    }
    return prev;
  }, animalEccEvents[0]);

  // ECC final: mais proximo da saida ou ultima disponivel
  const referenceEnd = end || new Date();
  const eccFinalEntry = animalEccEvents.reduce((prev, curr) => {
    const currTime = parseISO(curr.occurredAt).getTime();
    const endTime = referenceEnd.getTime();
    const prevTime = parseISO(prev.occurredAt).getTime();

    if (Math.abs(currTime - endTime) < Math.abs(prevTime - endTime)) {
      return curr;
    }
    return prev;
  }, animalEccEvents[animalEccEvents.length - 1]);

  if (animalEccEvents.length === 0) {
    return {
      ...period,
      eccStatus: { status: "empty", reason: "Sem ECC individual registrado para o animal no periodo." },
    };
  }

  if (eccInicialEntry.occurredAt === eccFinalEntry.occurredAt) {
    return {
      ...period,
      eccInicial: eccInicialEntry.ecc,
      eccStatus: { status: "partial", reason: "Apenas uma avaliacao de ECC disponivel no periodo." },
    };
  }

  const variacaoEcc = eccFinalEntry.ecc - eccInicialEntry.ecc;

  return {
    ...period,
    eccInicial: eccInicialEntry.ecc,
    eccFinal: eccFinalEntry.ecc,
    variacaoEcc,
    eccStatus: { status: "complete" },
  };
}
