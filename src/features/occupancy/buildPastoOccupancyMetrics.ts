import type { AnimalOccupancyPeriod, PastoOccupancyMetrics, DataStatus } from "./occupancyTypes";

interface BuildPastoOccupancyMetricsInput {
  pastoId: string;
  animalPeriods: AnimalOccupancyPeriod[];
}

export function buildPastoOccupancyMetrics({
  pastoId,
  animalPeriods,
}: BuildPastoOccupancyMetricsInput): PastoOccupancyMetrics {
  const periodsInPasto = animalPeriods.filter((p) => p.pastoId === pastoId);

  if (periodsInPasto.length === 0) {
    return {
      pastoId,
      lotacaoAtual: 0,
      tempoMedioOcupacao: 0,
      ganhoMedioPeso: 0,
      gmdEstimado: 0,
      weightStatus: { status: "empty" },
      eccMedioAtual: 0,
      eccVariacaoMedia: 0,
      eccStatus: { status: "empty" },
    };
  }

  const lotacaoAtual = periodsInPasto.filter((p) => p.saidaAt === null).length;

  const tempoMedioOcupacao = periodsInPasto.reduce((sum, p) => sum + p.dias, 0) / periodsInPasto.length;

  const periodsWithWeight = periodsInPasto.filter((p) => p.weightStatus.status === "complete");
  const ganhoMedioPeso = periodsWithWeight.reduce((sum, p) => sum + (p.ganho || 0), 0) / (periodsWithWeight.length || 1);
  const gmdEstimado = periodsWithWeight.reduce((sum, p) => sum + (p.gmd || 0), 0) / (periodsWithWeight.length || 1);

  let weightStatus: DataStatus = { status: "empty" };
  if (periodsWithWeight.length > 0) {
    weightStatus = { status: "complete" };
  }

  const periodsWithEcc = periodsInPasto.filter((p) => p.eccStatus.status === "complete" || p.eccStatus.status === "partial");
  const eccMedioAtual = periodsWithEcc.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.eccFinal || p.eccInicial || 0), 0) / (periodsWithEcc.filter(p => p.saidaAt === null).length || 1);
  const eccVariacaoMedia = periodsWithEcc.filter(p => p.variacaoEcc !== undefined).reduce((sum, p) => sum + (p.variacaoEcc || 0), 0) / (periodsWithEcc.filter(p => p.variacaoEcc !== undefined).length || 1);

  let eccStatus: DataStatus = { status: "empty" };
  if (periodsWithEcc.length > 0) {
    eccStatus = { status: "complete" };
  }

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
  };
}
