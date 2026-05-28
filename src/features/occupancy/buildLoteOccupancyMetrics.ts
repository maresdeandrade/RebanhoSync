import type { Animal } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod, LoteOccupancyMetrics, DataStatus } from "./occupancyTypes";

interface BuildLoteOccupancyMetricsInput {
  loteId: string;
  animalPeriods: AnimalOccupancyPeriod[];
  totalAnimalsInLote: number;
  activeAnimals?: Animal[];
  latestEccsMap?: Map<string, number>;
  lastMovementDate?: string | null;
  categoriaPredominante?: string;
}

export function buildLoteOccupancyMetrics({
  loteId,
  animalPeriods,
  totalAnimalsInLote,
  activeAnimals = [],
  latestEccsMap = new Map(),
  lastMovementDate = null,
  categoriaPredominante = "Não classificada",
}: BuildLoteOccupancyMetricsInput): LoteOccupancyMetrics {
  const periodsInLote = animalPeriods.filter((p) => p.loteId === loteId);

  if (periodsInLote.length === 0) {
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
      loteId,
      quantidadeAtual: activeAnimals.length,
      dataEntradaRecente: null,
      tempoMedioPermanencia: 0,
      tempoMaximoPermanencia: 0,
      pesoMedioInicial: 0,
      pesoMedioFinal: 0,
      ganhoMedio: 0,
      gmdEstimado: 0,
      weightStatus: { status: "empty", reason: "Sem pesagens suficientes" },
      eccMedioAtual,
      eccCobertura: { avaliados: evaluatedCount, total: activeAnimals.length || totalAnimalsInLote },
      eccStatus,
      animaisSemEcc,
      tempoLotacaoStatus: { status: "empty", reason: "Sem histórico de movimentação (tempo de lotação estimado)." },
      ultimaMovimentacao: lastMovementDate,
      categoriaPredominante,
    };
  }

  const currentPeriods = periodsInLote.filter((p) => {
    if (activeAnimals.length === 0) {
      return p.saidaAt === null;
    }
    const isCurrentActive = activeAnimals.some((a) => a.id === p.animalId);
    return isCurrentActive && p.saidaAt === null;
  });
  const quantidadeAtual = activeAnimals.length || currentPeriods.length;

  const dataEntradaRecente = periodsInLote.reduce((latestDate, period) => {
    if (!latestDate) return period.entradaAt;
    return period.entradaAt > latestDate ? period.entradaAt : latestDate;
  }, null as string | null);

  const tempoMedioPermanenciaVal = periodsInLote.reduce((sum, p) => sum + p.dias, 0) / (periodsInLote.length || 1);
  const tempoMaximoPermanencia = periodsInLote.reduce((max, p) => Math.max(max, p.dias), 0);

  const periodsWithWeight = periodsInLote.filter((p) => p.weightStatus.status === "complete");
  const pesoMedioInicial = periodsWithWeight.reduce((sum, p) => sum + (p.pesoInicial || 0), 0) / (periodsWithWeight.length || 1);
  const pesoMedioFinal = periodsWithWeight.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.pesoFinal || 0), 0) / (periodsWithWeight.filter(p => p.saidaAt === null).length || 1);
  const ganhoMedio = periodsWithWeight.reduce((sum, p) => sum + (p.ganho || 0), 0) / (periodsWithWeight.length || 1);
  const gmdEstimado = periodsWithWeight.reduce((sum, p) => sum + (p.gmd || 0), 0) / (periodsWithWeight.length || 1);

  let weightStatus: DataStatus = { status: "empty", reason: "Sem pesagens suficientes" };
  if (periodsWithWeight.length > 0) {
    weightStatus = { status: "complete" };
  }

  // Factual ECC calculations (fall back to period logic if activeAnimals not passed)
  let evaluatedCount = 0;
  let eccMedioAtual = 0;
  let animaisSemEcc: string[] = [];
  let eccStatus: DataStatus = { status: "empty" };

  if (activeAnimals.length > 0) {
    evaluatedCount = activeAnimals.filter((a) => latestEccsMap.has(a.id)).length;
    const evaluatedAnimals = activeAnimals.filter((a) => latestEccsMap.has(a.id));
    eccMedioAtual = evaluatedAnimals.reduce((sum, a) => sum + latestEccsMap.get(a.id)!, 0) / (evaluatedCount || 1);
    animaisSemEcc = activeAnimals.filter((a) => !latestEccsMap.has(a.id)).map((a) => a.identificacao);

    eccStatus =
      evaluatedCount === 0
        ? { status: "empty", reason: "Sem ECC factual registrado" }
        : evaluatedCount < activeAnimals.length
          ? { status: "partial", reason: "Cobertura de ECC parcial" }
          : { status: "complete" };
  } else {
    const periodsWithEcc = periodsInLote.filter((p) => p.eccStatus.status === "complete" || p.eccStatus.status === "partial");
    eccMedioAtual = periodsWithEcc.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.eccFinal || p.eccInicial || 0), 0) / (periodsWithEcc.filter(p => p.saidaAt === null).length || 1);
    evaluatedCount = periodsWithEcc.length;
    eccStatus = periodsWithEcc.length > 0 ? { status: "complete" } : { status: "empty" };
  }

  const tempoLotacaoStatus: DataStatus =
    lastMovementDate === null
      ? { status: "empty", reason: "Sem histórico de movimentação (tempo de lotação estimado)." }
      : { status: "complete" };

  return {
    loteId,
    quantidadeAtual,
    dataEntradaRecente,
    tempoMedioPermanencia: tempoMedioPermanenciaVal,
    tempoMaximoPermanencia,
    pesoMedioInicial,
    pesoMedioFinal,
    ganhoMedio,
    gmdEstimado,
    weightStatus,
    eccMedioAtual,
    eccCobertura: { avaliados: evaluatedCount, total: activeAnimals.length || totalAnimalsInLote },
    eccStatus,
    animaisSemEcc,
    tempoLotacaoStatus,
    ultimaMovimentacao: lastMovementDate,
    categoriaPredominante,
  };
}
