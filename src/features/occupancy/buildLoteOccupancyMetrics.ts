// src/features/occupancy/buildLoteOccupancyMetrics.ts

import type { Animal } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod, LoteOccupancyMetrics, DataStatus } from "./occupancyTypes";
import { calculateUaLotacao } from "../../lib/animals/kpiHelpers";
import type { OccupancyAggregate } from "@/lib/occupancy/occupancyAggregation";
import { presentQualifiedOccupancyDuration } from "./qualifiedOccupancyAdapter";

interface BuildLoteOccupancyMetricsInput {
  loteId: string;
  animalPeriods: AnimalOccupancyPeriod[];
  totalAnimalsInLote: number;
  activeAnimals?: Animal[];
  latestEccsMap?: Map<string, number>;
  lastMovementDate?: string | null;
  categoriaPredominante?: string;
  categoriaStatus?: DataStatus;
  qualifiedDuration?: OccupancyAggregate | null;
}

// fallow-ignore-next-line complexity -- legacy multi-metric builder; F22C.3 replaces only duration semantics.
export function buildLoteOccupancyMetrics({
  loteId,
  animalPeriods,
  totalAnimalsInLote,
  activeAnimals = [],
  latestEccsMap = new Map(),
  lastMovementDate = null,
  categoriaPredominante = "Categoria desconhecida",
  categoriaStatus = {
    status: "empty",
    reason: "Classificacao operacional nao informada",
    source: "classificationSnapshot",
  },
  qualifiedDuration,
}: BuildLoteOccupancyMetricsInput): LoteOccupancyMetrics {
  const periodsInLote = animalPeriods.filter((p) => p.loteId === loteId);
  const qualified = presentQualifiedOccupancyDuration(qualifiedDuration);

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

    const animalWeights = activeAnimals.map(() => ({ pesoKg: 0, isConfiavel: false, isMissing: true }));
    const uaResult = calculateUaLotacao(animalWeights, undefined);

    return {
      loteId,
      quantidadeAtual: activeAnimals.length,
      dataEntradaRecente: null,
      tempoMedioPermanencia: qualified.meanDurationDays,
      tempoMaximoPermanencia: qualified.maxDurationDays,
      pesoMedioInicial: 0,
      pesoMedioFinal: 0,
      ganhoMedio: 0,
      gmdEstimado: 0,
      weightStatus: { status: "empty", reason: "Sem pesagens suficientes" },
      eccMedioAtual,
      eccCobertura: { avaliados: evaluatedCount, total: activeAnimals.length || totalAnimalsInLote },
      eccStatus,
      animaisSemEcc,
      permanenciaStatus: qualified.status,
      tempoLotacaoStatus: qualified.status,
      ultimaMovimentacao: lastMovementDate,
      categoriaPredominante,
      categoriaStatus,
      uaTotal: uaResult.uaTotal,
      lotacaoStatus: {
        status: uaResult.status,
        reason: uaResult.reason,
        source: uaResult.source,
        limitation: uaResult.limitation,
      },
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

  const periodsWithWeight = periodsInLote.filter((p) => p.weightStatus.status === "complete");
  const pesoMedioInicial = periodsWithWeight.reduce((sum, p) => sum + (p.pesoInicial || 0), 0) / (periodsWithWeight.length || 1);
  const pesoMedioFinal = periodsWithWeight.filter(p => p.saidaAt === null).reduce((sum, p) => sum + (p.pesoFinal || 0), 0) / (periodsWithWeight.filter(p => p.saidaAt === null).length || 1);
  const ganhoMedio = periodsWithWeight.reduce((sum, p) => sum + (p.ganho || 0), 0) / (periodsWithWeight.length || 1);
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

  // UA Lotacao real
  const animalWeights = activeAnimals.map(animal => {
    const p = periodsInLote.find(per => per.animalId === animal.id && per.saidaAt === null);
    const pesoKg = p?.pesoFinal || 0;
    const isConfiavel = p?.weightStatus.status === "complete";
    const isMissing = !p || p.weightStatus.status === "empty";
    return { pesoKg, isConfiavel, isMissing };
  });

  const uaResult = calculateUaLotacao(animalWeights, undefined);

  // fallow-ignore-next-line code-duplication -- parallel return shapes preserve the existing legacy builder contract.
  return {
    loteId,
    quantidadeAtual,
    dataEntradaRecente,
    tempoMedioPermanencia: qualified.meanDurationDays,
    tempoMaximoPermanencia: qualified.maxDurationDays,
    pesoMedioInicial,
    pesoMedioFinal,
    ganhoMedio,
    gmdEstimado,
    weightStatus,
    // fallow-ignore-next-line code-duplication -- common output fields intentionally preserve the public builder shape.
    eccMedioAtual,
    eccCobertura: { avaliados: evaluatedCount, total: activeAnimals.length || totalAnimalsInLote },
    eccStatus,
    animaisSemEcc,
    permanenciaStatus: qualified.status,
    tempoLotacaoStatus: qualified.status,
    ultimaMovimentacao: lastMovementDate,
    categoriaPredominante,
    categoriaStatus,
    uaTotal: uaResult.uaTotal,
    lotacaoStatus: {
      status: uaResult.status,
      reason: uaResult.reason,
      source: uaResult.source,
      limitation: uaResult.limitation,
    },
  };
}
