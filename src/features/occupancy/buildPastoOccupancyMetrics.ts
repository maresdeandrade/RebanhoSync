// src/features/occupancy/buildPastoOccupancyMetrics.ts

import type { Animal } from "@/lib/offline/types";
import type { AnimalOccupancyPeriod, PastoOccupancyMetrics, DataStatus } from "./occupancyTypes";
import { calculateUaLotacao } from "../../lib/animals/kpiHelpers";

interface BuildPastoOccupancyMetricsInput {
  pastoId: string;
  animalPeriods: AnimalOccupancyPeriod[];
  activeAnimals?: Animal[];
  latestEccsMap?: Map<string, number>;
  lastMovementDate?: string | null;
  categoriaPredominante?: string;
  categoriaStatus?: DataStatus;
  areaHa?: number | null;
}

export function buildPastoOccupancyMetrics({
  pastoId,
  animalPeriods,
  activeAnimals = [],
  latestEccsMap = new Map(),
  lastMovementDate = null,
  categoriaPredominante = "Categoria desconhecida",
  categoriaStatus = {
    status: "empty",
    reason: "Classificacao operacional nao informada",
    source: "classificationSnapshot",
  },
  areaHa = null,
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

    const animalWeights = activeAnimals.map(() => ({ pesoKg: 0, isConfiavel: false, isMissing: true }));
    const uaResult = calculateUaLotacao(animalWeights, areaHa);

    const permanenciaStatus: DataStatus = {
      status: "empty",
      reason: "Sem histórico de movimentação (tempo de lotação estimado).",
      source: "Sem dados",
    };

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
      permanenciaStatus,
      tempoLotacaoStatus: permanenciaStatus,
      ultimaMovimentacao: lastMovementDate,
      categoriaPredominante,
      categoriaStatus,
      uaTotal: uaResult.uaTotal,
      taxaLotacaoUaHa: uaResult.taxaLotacaoUaHa,
      taxaLotacaoStatus: {
        status: uaResult.status,
        reason: uaResult.reason,
        source: uaResult.source,
        limitation: uaResult.limitation,
      },
    };
  }

  const lotacaoAtual = activeAnimals.length || periodsInPasto.filter((p) => p.saidaAt === null).length;
  const tempoMedioOcupacao = periodsInPasto.reduce((sum, p) => sum + p.dias, 0) / (periodsInPasto.length || 1);

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

  const permanenciaStatus: DataStatus =
    lastMovementDate === null
      ? {
          status: "empty",
          reason: "Sem histórico de movimentação (tempo de lotação estimado).",
          source: "Sem dados",
        }
      : {
          status: "complete",
          source: "Movimentações factuais",
        };

  // UA Lotacao real
  const animalWeights = activeAnimals.map(animal => {
    const p = periodsInPasto.find(per => per.animalId === animal.id && per.saidaAt === null);
    const pesoKg = p?.pesoFinal || 0;
    const isConfiavel = p?.weightStatus.status === "complete";
    const isMissing = !p || p.weightStatus.status === "empty";
    return { pesoKg, isConfiavel, isMissing };
  });

  const uaResult = calculateUaLotacao(animalWeights, areaHa);

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
    permanenciaStatus,
    tempoLotacaoStatus: permanenciaStatus,
    ultimaMovimentacao: lastMovementDate,
    categoriaPredominante,
    categoriaStatus,
    uaTotal: uaResult.uaTotal,
    taxaLotacaoUaHa: uaResult.taxaLotacaoUaHa,
    taxaLotacaoStatus: {
      status: uaResult.status,
      reason: uaResult.reason,
      source: uaResult.source,
      limitation: uaResult.limitation,
    },
  };
}
