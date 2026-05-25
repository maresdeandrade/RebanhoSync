import type { AnimalOccupancyPeriod, LoteOccupancyMetrics, DataStatus } from "./occupancyTypes";

interface BuildLoteOccupancyMetricsInput {
  loteId: string;
  animalPeriods: AnimalOccupancyPeriod[];
  totalAnimalsInLote: number;
}

export function buildLoteOccupancyMetrics({
  loteId,
  animalPeriods,
  totalAnimalsInLote,
}: BuildLoteOccupancyMetricsInput): LoteOccupancyMetrics {
  const periodsInLote = animalPeriods.filter((p) => p.loteId === loteId);

  if (periodsInLote.length === 0) {
    return {
      loteId,
      quantidadeAtual: 0,
      dataEntradaRecente: null,
      tempoMedioPermanencia: 0,
      tempoMaximoPermanencia: 0,
      pesoMedioInicial: 0,
      pesoMedioFinal: 0,
      ganhoMedio: 0,
      gmdEstimado: 0,
      weightStatus: { status: "empty" },
      eccMedioAtual: 0,
      eccCobertura: { avaliados: 0, total: totalAnimalsInLote },
      eccStatus: { status: "empty" },
    };
  }

  const currentAnimals = periodsInLote.filter((p) => p.saidaAt === null);
  const quantidadeAtual = currentAnimals.length;

  const dataEntradaRecente = periodsInLote.reduce((latestDate, period) => {
    if (!latestDate) return period.entradaAt;
    return period.entradaAt > latestDate ? period.entradaAt : latestDate;
  }, null as string | null);

  const tempoMedioPermanencia = periodsInLote.reduce((sum, p) => sum + p.dias, 0) / periodsInLote.length;
  const tempoMaximoPermanencia = periodsInLote.reduce((max, p) => Math.max(max, p.dias), 0);

  const periodsWithWeight = periodsInLote.filter((p) => p.weightStatus.status === "complete");
  const pesoMedioInicial = periodsWithWeight.reduce((sum, p) => sum + (p.pesoInicial || 0), 0) / (periodsWithWeight.length || 1);
  const pesoMedioFinal = periodsWithWeight.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.pesoFinal || 0), 0) / (periodsWithWeight.filter(p => p.saidaAt === null).length || 1);
  const ganhoMedio = periodsWithWeight.reduce((sum, p) => sum + (p.ganho || 0), 0) / (periodsWithWeight.length || 1);
  const gmdEstimado = periodsWithWeight.reduce((sum, p) => sum + (p.gmd || 0), 0) / (periodsWithWeight.length || 1);

  let weightStatus: DataStatus = { status: "empty" };
  if (periodsWithWeight.length > 0) {
    weightStatus = { status: "complete" };
  }

  const periodsWithEcc = periodsInLote.filter((p) => p.eccStatus.status === "complete" || p.eccStatus.status === "partial");
  const eccMedioAtual = periodsWithEcc.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.eccFinal || p.eccInicial || 0), 0) / (periodsWithEcc.filter(p => p.saidaAt === null).length || 1);
  const eccCobertura = { avaliados: periodsWithEcc.length, total: totalAnimalsInLote };

  let eccStatus: DataStatus = { status: "empty" };
  if (periodsWithEcc.length > 0) {
    eccStatus = { status: "complete" };
  }

  return {
    loteId,
    quantidadeAtual,
    dataEntradaRecente,
    tempoMedioPermanencia,
    tempoMaximoPermanencia,
    pesoMedioInicial,
    pesoMedioFinal,
    ganhoMedio,
    gmdEstimado,
    weightStatus,
    eccMedioAtual,
    eccCobertura,
    eccStatus,
  };
}
