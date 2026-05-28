import type { Animal } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod, PastoOccupancyMetrics, DataStatus } from "./occupancyTypes";

interface BuildPastoOccupancyMetricsInput {
  pastoId: string;
  animalPeriods: AnimalOccupancyPeriod[];
  activeAnimals?: Animal[];
  latestEccsMap?: Map<string, number>;
  lastMovementDate?: string | null;
  categoriaPredominante?: string;
}

export function buildPastoOccupancyMetrics({
  pastoId,
  animalPeriods,
  activeAnimals = [],
  latestEccsMap = new Map(),
  lastMovementDate = null,
  categoriaPredominante = "Não classificada",
}: BuildPastoOccupancyMetricsInput): PastoOccupancyMetrics {
  const periodsInPasto = animalPeriods.filter((p) => p.pastoId === pastoId);

  if (periodsInPasto.length === 0) {
    const evaluatedCount = activeAnimals.filter((a) => latestEccsMap.has(a.id)).length;
    const evaluatedAnimals = activeAnimals.filter((a) => latestEccsMap.has(a.id));
    const eccMedioAtual = evaluatedAnimals.reduce((sum, a) => sum + latestEccsMap.get(a.id)!, 0) / (evaluatedCount || 1);

    const eccStatus: DataStatus =
      evaluatedCount === 0
        ? { status: "empty", reason: "Sem ECC factual registrado" }
        : evaluatedCount < activeAnimals.length
          ? { status: "partial", reason: "Cobertura de ECC parcial" }
          : { status: "complete" };

    const animaisSemEcc = activeAnimals.filter((a) => !latestEccsMap.has(a.id)).map((a) => a.identificacao);

    return {
      pastoId,
      lotacaoAtual: activeAnimals.length,
      tempoMedioOcupacao: 0,
      ganhoMedioPeso: 0,
      gmdEstimado: 0,
      weightStatus: { status: "empty", reason: "Sem pesagens suficientes" },
      eccMedioAtual,
      eccVariacaoMedia: 0,
      eccStatus,
      eccCobertura: { avaliados: evaluatedCount, total: activeAnimals.length },
      animaisSemEcc,
      tempoLotacaoStatus: { status: "empty", reason: "Sem histórico de movimentação (tempo de lotação estimado)." },
      ultimaMovimentacao: lastMovementDate,
      categoriaPredominante,
    };
  }

  const lotacaoAtual = activeAnimals.length || periodsInPasto.filter((p) => p.saidaAt === null).length;
  const tempoMedioOcupacao = periodsInPasto.reduce((sum, p) => sum + p.dias, 0) / periodsInPasto.length;

  const periodsWithWeight = periodsInPasto.filter((p) => p.weightStatus.status === "complete");
  const ganhoMedioPeso = periodsWithWeight.reduce((sum, p) => sum + (p.ganho || 0), 0) / (periodsWithWeight.length || 1);
  const gmdEstimado = periodsWithWeight.reduce((sum, p) => sum + (p.gmd || 0), 0) / (periodsWithWeight.length || 1);

  let weightStatus: DataStatus = { status: "empty", reason: "Sem pesagens suficientes" };
  if (periodsWithWeight.length > 0) {
    weightStatus = { status: "complete" };
  }

  // Factual ECC calculations
  let evaluatedCount = 0;
  let eccMedioAtual = 0;
  let animaisSemEcc: string[] = [];
  let eccStatus: DataStatus = { status: "empty" };
  let eccVariacaoMedia = 0;

  if (activeAnimals.length > 0) {
    evaluatedCount = activeAnimals.filter((a) => latestEccsMap.has(a.id)).length;
    const evaluatedAnimals = activeAnimals.filter((a) => latestEccsMap.has(a.id));
    eccMedioAtual = evaluatedAnimals.reduce((sum, a) => sum + latestEccsMap.get(a.id)!, 0) / (evaluatedCount || 1);
    eccVariacaoMedia = periodsInPasto.filter(p => p.variacaoEcc !== undefined).reduce((sum, p) => sum + (p.variacaoEcc || 0), 0) / (periodsInPasto.filter(p => p.variacaoEcc !== undefined).length || 1);
    animaisSemEcc = activeAnimals.filter((a) => !latestEccsMap.has(a.id)).map((a) => a.identificacao);

    eccStatus =
      evaluatedCount === 0
        ? { status: "empty", reason: "Sem ECC factual registrado" }
        : evaluatedCount < activeAnimals.length
          ? { status: "partial", reason: "Cobertura de ECC parcial" }
          : { status: "complete" };
  } else {
    const periodsWithEcc = periodsInPasto.filter((p) => p.eccStatus.status === "complete" || p.eccStatus.status === "partial");
    eccMedioAtual = periodsWithEcc.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.eccFinal || p.eccInicial || 0), 0) / (periodsWithEcc.filter(p => p.saidaAt === null).length || 1);
    eccVariacaoMedia = periodsWithEcc.filter(p => p.variacaoEcc !== undefined).reduce((sum, p) => sum + (p.variacaoEcc || 0), 0) / (periodsWithEcc.filter(p => p.variacaoEcc !== undefined).length || 1);
    evaluatedCount = periodsWithEcc.length;
    eccStatus = periodsWithEcc.length > 0 ? { status: "complete" } : { status: "empty" };
  }

  const tempoLotacaoStatus: DataStatus =
    lastMovementDate === null
      ? { status: "empty", reason: "Sem histórico de movimentação (tempo de lotação estimado)." }
      : { status: "complete" };

  return {
    pastoId,
    lotacaoAtual,
    tempoMedioOcupacao,
    ganhoMedioPeso,
    gmdEstimado,
    weightStatus,
    eccMedioAtual,
    eccVariacaoMedia,
    eccStatus,
    eccCobertura: { avaliados: evaluatedCount, total: activeAnimals.length || lotacaoAtual },
    animaisSemEcc,
    tempoLotacaoStatus,
    ultimaMovimentacao: lastMovementDate,
    categoriaPredominante,
  };
}
