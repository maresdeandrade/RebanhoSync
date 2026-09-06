import type { OccupancyPerformanceAggregate } from "@/lib/occupancy/occupancyPerformance";
import type { DataStatus } from "./occupancyTypes";

export interface ObservedOccupancyPerformancePresentation {
  initialWeightKg: number | null;
  finalWeightKg: number | null;
  weightDeltaKg: number | null;
  observedGmdKgPerDay: number | null;
  status: DataStatus;
}

const SOURCE = "eventos + eventos_pesagem dentro da ocupação histórica qualificada";

export function presentObservedOccupancyPerformance(
  aggregate: OccupancyPerformanceAggregate | null | undefined,
): ObservedOccupancyPerformancePresentation {
  if (aggregate?.coverage === "CONFLICT") {
    return {
      initialWeightKg: null,
      finalWeightKg: null,
      weightDeltaKg: null,
      observedGmdKgPerDay: null,
      status: {
        status: "bloqueado",
        reason: "Conflito factual impede apresentar o GMD observado",
        source: SOURCE,
        limitation:
          "Nenhum resultado parcial é usado como fallback; o conflito deve ser resolvido na fonte factual.",
      },
    };
  }

  if (!aggregate || aggregate.calculatedIntervals === 0) {
    return {
      initialWeightKg: null,
      finalWeightKg: null,
      weightDeltaKg: null,
      observedGmdKgPerDay: null,
      status: {
        status: "empty",
        reason: "Pesagens factuais insuficientes dentro da ocupação",
        source: SOURCE,
        limitation:
          "Ausência não é convertida em zero; o resultado não representa desempenho de toda a permanência.",
      },
    };
  }

  return {
    initialWeightKg: aggregate.meanInitialObservedWeightKg,
    finalWeightKg: aggregate.meanFinalObservedWeightKg,
    weightDeltaKg: aggregate.meanWeightDeltaKg,
    observedGmdKgPerDay: aggregate.meanObservedGmdKgPerDay,
    status: {
      status: "partial",
      reason: "GMD observado entre pesagens factuais dentro da ocupação",
      source: SOURCE,
      limitation: [
        `Coverage: ${aggregate.coverage}.`,
        `${aggregate.calculatedIntervals} intervalo(s) calculado(s); ${aggregate.unavailableIntervals} indisponível(is).`,
        "Confiabilidade não classificada e uso operacional não autorizado; não representa ganho de toda a permanência.",
      ].join(" "),
    },
  };
}
