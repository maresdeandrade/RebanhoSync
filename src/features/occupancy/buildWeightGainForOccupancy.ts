import { differenceInDays, parseISO } from "date-fns";
import type { Evento, EventoPesagem } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod } from "./occupancyTypes";

export interface WeightGainInput {
  period: AnimalOccupancyPeriod;
  events: Evento[];
  pesagens: Map<string, EventoPesagem>;
}

export function buildWeightGainForOccupancy({
  period,
  events,
  pesagens,
}: WeightGainInput): AnimalOccupancyPeriod {
  const animalPesagens = events
    .filter((e) => e.dominio === "pesagem" && !e.deleted_at && e.animal_id === period.animalId)
    .map((e) => ({
      occurredAt: e.occurred_at,
      peso: pesagens.get(e.id)?.peso_kg || 0,
    }))
    .filter((p) => p.peso > 0)
    .sort((a, b) => parseISO(a.occurredAt).getTime() - parseISO(b.occurredAt).getTime());

  if (animalPesagens.length === 0) {
    return {
      ...period,
      weightStatus: { status: "empty", reason: "Sem pesagens suficientes para o animal." },
    };
  }

  const start = parseISO(period.entradaAt);
  const end = period.saidaAt ? parseISO(period.saidaAt) : null;

  // Peso inicial: mais proximo da entrada (preferencialmente dentro ou anterior proximo)
  const pesoInicialEntry = animalPesagens.reduce((prev, curr) => {
    const currTime = parseISO(curr.occurredAt).getTime();
    const startTime = start.getTime();
    const prevTime = parseISO(prev.occurredAt).getTime();
    
    // Se curr está mais próximo de start do que prev
    if (Math.abs(currTime - startTime) < Math.abs(prevTime - startTime)) {
      return curr;
    }
    return prev;
  }, animalPesagens[0]); // Provide initial value

  // Peso final: mais proximo da saida ou ultima disponivel
  const referenceEnd = end || new Date();
  const pesoFinalEntry = animalPesagens.reduce((prev, curr) => {
    const currTime = parseISO(curr.occurredAt).getTime();
    const endTime = referenceEnd.getTime();
    const prevTime = parseISO(prev.occurredAt).getTime();
    
    if (Math.abs(currTime - endTime) < Math.abs(prevTime - endTime)) {
      return curr;
    }
    return prev;
  }, animalPesagens[animalPesagens.length - 1]); // Provide initial value

  if (pesoInicialEntry.occurredAt === pesoFinalEntry.occurredAt) {
    return {
      ...period,
      weightStatus: { status: "partial", reason: "Apenas uma pesagem valida no periodo." },
    };
  }

  const ganho = pesoFinalEntry.peso - pesoInicialEntry.peso;
  const diasEntrePesagens = differenceInDays(
    parseISO(pesoFinalEntry.occurredAt),
    parseISO(pesoInicialEntry.occurredAt)
  );
  const gmd = diasEntrePesagens > 0 ? ganho / diasEntrePesagens : 0;

  return {
    ...period,
    pesoInicial: pesoInicialEntry.peso,
    pesoFinal: pesoFinalEntry.peso,
    ganho,
    gmd,
    weightStatus: { status: "complete" },
  };
}
