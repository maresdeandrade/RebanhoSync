// src/features/occupancy/cockpitManejoAdapter.ts

import { differenceInDays, parseISO } from "date-fns";
import type {
  Animal,
  Lote,
  Pasto,
  Evento,
  EventoPesagem,
  EventoEcc,
  EventoMovimentacao,
  AgendaItem,
} from "@/lib/offline/types";
import { calculateUaLotacao } from "@/lib/animals/kpiHelpers";
import { getPredominantCategorySnapshot } from "./classification";
import type { OccupancyAggregate } from "@/lib/occupancy/occupancyAggregation";
import { presentQualifiedOccupancyDuration } from "./qualifiedOccupancyAdapter";
import type { OccupancyPerformanceAggregate } from "@/lib/occupancy/occupancyPerformance";
import { presentObservedOccupancyPerformance } from "./observedOccupancyPerformanceAdapter";
const PASTO_STOCKING_RATE_LIMITATION =
  "Taxa UA/ha exige area_ha válida e peso explícito dos animais atuais; dados incompletos tornam a leitura parcial.";
const LOTE_UA_LIMITATION =
  "UA total do lote exige peso explícito dos animais atuais; dados ausentes ou desatualizados tornam a leitura parcial.";

function mergeLimitations(...limitations: Array<string | undefined>): string | undefined {
  return limitations.filter(Boolean).join(" ");
}

export interface DataStatus {
  status: "empty" | "partial" | "complete" | "bloqueado";
  reason?: string;
  source?: string;
  limitation?: string;
}

export interface CockpitLoteMetrics {
  loteId: string;
  quantidadeAtual: number;
  pesoMedio: number | null;
  pesoStatus: DataStatus;
  gmdMedio: number | null;
  ganhoMedio: number | null;
  gmdStatus: DataStatus;
  eccMedio: number | null;
  eccStatus: DataStatus;
  eccCobertura: { avaliados: number; total: number };
  animaisSemEcc: string[];
  dataEntradaLote: string | null;
  tempoMedioPermanencia: number | null;
  tempoMaximoPermanencia: number | null;
  permanenciaStatus: DataStatus;
  ultimaMovimentacao: string | null;
  agendaItensAbertos: {
    total: number;
    atrasados: number;
    hoje: number;
    proximos: number;
  };
  categoriaPredominante: string;
  categoriaStatus: DataStatus;
  uaTotal: number;
  lotacaoStatus: DataStatus;
}

export interface CockpitPastoMetrics {
  pastoId: string;
  lotacaoAtual: number;
  pesoMedio: number | null;
  pesoStatus: DataStatus;
  gmdMedio: number | null;
  ganhoMedioPeso: number | null;
  gmdStatus: DataStatus;
  eccMedio: number | null;
  eccStatus: DataStatus;
  eccCobertura: { avaliados: number; total: number };
  animaisSemEcc: string[];
  tempoUsoDias: number | null;
  permanenciaStatus: DataStatus;
  ultimaMovimentacao: string | null;
  agendaItensAbertos: {
    total: number;
    atrasados: number;
    hoje: number;
    proximos: number;
  };
  categoriaPredominante: string;
  categoriaStatus: DataStatus;
  uaTotal: number;
  taxaLotacaoUaHa: number | null;
  taxaLotacaoStatus: DataStatus;
}

// Utility to parse ISO date string safely and strip time if only comparing dates
function safeParseDate(dStr: string): Date {
  return parseISO(dStr);
}

function groupWeightDetailsByAnimal(
  details: readonly EventoPesagem[],
  events: readonly Evento[],
): Map<string, EventoPesagem[]> {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const grouped = new Map<string, EventoPesagem[]>();
  for (const detail of details) {
    if (detail.deleted_at) continue;
    const animalId = eventsById.get(detail.evento_id)?.animal_id;
    if (!animalId) continue;
    grouped.set(animalId, [...(grouped.get(animalId) ?? []), detail]);
  }
  return grouped;
}

function prepareCommonOccupancySources(
  eventsInput: Evento[],
  pesagensInput: EventoPesagem[],
  referenceDate: string,
  observedPerformance?: OccupancyPerformanceAggregate | null,
) {
  const events = Array.isArray(eventsInput) ? eventsInput : [];
  const pesagens = Array.isArray(pesagensInput) ? pesagensInput : [];
  const validEvents = events.filter(
    (event) => !event.deleted_at && event.occurred_at <= referenceDate,
  );

  return {
    validEvents,
    animalPesagensMap: groupWeightDetailsByAnimal(pesagens, validEvents),
    performance: presentObservedOccupancyPerformance(observedPerformance),
  };
}

// fallow-ignore-next-line complexity -- legacy multi-metric adapter; F22C changes only qualified permanence/performance.
export function calculateLoteMetrics(
  loteId: string,
  referenceDate: string,
  weightFreshnessDays: number | null | undefined,
  animalsInput: Animal[],
  eventsInput: Evento[],
  pesagensInput: EventoPesagem[],
  eccsInput: EventoEcc[],
  movimentacoesInput: EventoMovimentacao[],
  agendaItensInput: AgendaItem[],
  qualifiedDuration?: OccupancyAggregate | null,
  observedPerformance?: OccupancyPerformanceAggregate | null,
): CockpitLoteMetrics {
  const animals = Array.isArray(animalsInput) ? animalsInput : [];
  const eccs = Array.isArray(eccsInput) ? eccsInput : [];
  const movimentacoes = Array.isArray(movimentacoesInput) ? movimentacoesInput : [];
  const agendaItens = Array.isArray(agendaItensInput) ? agendaItensInput : [];

  const refDateObj = safeParseDate(referenceDate);

// Active animals in this lote (exclude mortos/vendidos/retirados)
   const activeAnimals = animals.filter(
     (a) => a.lote_id === loteId && a.status === "ativo" && !a.deleted_at
   );
  const activeAnimalIds = new Set(activeAnimals.map((a) => a.id));

  const { validEvents, animalPesagensMap, performance } =
    prepareCommonOccupancySources(
      eventsInput,
      pesagensInput,
      referenceDate,
      observedPerformance,
    );

  // 3. ECC (Escore de Condição Corporal)
  let sumEcc = 0;
  let countEccEvaluated = 0;
  const animaisSemEcc: string[] = [];

  const animalEccsMap = new Map<string, EventoEcc[]>();
  eccs.forEach((e) => {
    if (e.deleted_at) return;
    const ev = validEvents.find((v) => v.id === e.event_id);
    if (ev && ev.animal_id) {
      if (!animalEccsMap.has(ev.animal_id)) {
        animalEccsMap.set(ev.animal_id, []);
      }
      animalEccsMap.get(ev.animal_id)!.push(e);
    }
  });

  activeAnimals.forEach((animal) => {
    const animalE = animalEccsMap.get(animal.id) || [];
    const validE = animalE
      .map((e) => {
        const ev = validEvents.find((v) => v.id === e.event_id)!;
        return { e, ev };
      })
      .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

    if (validE.length > 0) {
      sumEcc += validE[0].e.ecc;
      countEccEvaluated++;
    } else {
      animaisSemEcc.push(animal.identificacao);
    }
  });

  const eccMedio = countEccEvaluated > 0 ? sumEcc / countEccEvaluated : null;
  let eccStatus: DataStatus = { status: "empty", reason: "Sem ECC factual registrado" };

  if (activeAnimals.length === 0) {
    eccStatus = { status: "empty", reason: "Sem animais ativos" };
  } else if (countEccEvaluated === activeAnimals.length) {
    eccStatus = {
      status: "complete",
      reason: "ECC registrado para todos os animais",
      source: "ECC factual",
    };
  } else if (countEccEvaluated > 0) {
    eccStatus = {
      status: "partial",
      reason: `Cobertura de ECC parcial: ${countEccEvaluated} de ${activeAnimals.length} avaliados`,
      source: "ECC factual",
      limitation: `${activeAnimals.length - countEccEvaluated} animais sem ECC`,
    };
  } else {
    eccStatus = {
      status: "empty",
      reason: "Nenhum animal com ECC registrado",
      source: "ECC factual",
      limitation: "Todos os animais sem ECC registrado",
    };
  }

  // 4. Permanência histórica qualificada. O adapter não reconstrói fatos nem usa state_*.
  const qualifiedPermanence = presentQualifiedOccupancyDuration(qualifiedDuration);
  const dataEntradaLote: string | null = null;
  const tempoMedioPermanencia = qualifiedPermanence.meanDurationDays;
  const maxPermanencia = qualifiedPermanence.maxDurationDays;
  const permanenciaStatus: DataStatus = qualifiedPermanence.status;

  // Ultima movimentação que tocou este lote
  const loteMovs = validEvents.filter(
    (e) => e.lote_id === loteId && e.dominio === "movimentacao"
  );
  const ultimaMovimentacao = loteMovs.length > 0
    ? loteMovs.reduce((latest, e) => (e.occurred_at > latest ? e.occurred_at : latest), loteMovs[0].occurred_at)
    : null;

  // 5. Pendências (Agenda)
  const openLoteAgendaItens = agendaItens.filter((item) => {
    if (item.deleted_at || item.status === "concluido" || item.status === "cancelado") {
      return false;
    }
    const isLoteTarget = item.lote_id === loteId;
    const isAnimalTarget = item.animal_id && activeAnimalIds.has(item.animal_id);
    return isLoteTarget || isAnimalTarget;
  });

  let atrasados = 0;
  let hoje = 0;
  let proximos = 0;

  openLoteAgendaItens.forEach((item) => {
    if (item.due_date < referenceDate) {
      atrasados++;
    } else if (item.due_date === referenceDate) {
      hoje++;
    } else {
      proximos++;
    }
  });

  const agendaItensAbertos = {
    total: openLoteAgendaItens.length,
    atrasados,
    hoje,
    proximos,
  };

  const categoriaSnapshot = getPredominantCategorySnapshot(activeAnimals, referenceDate);
  const categoriaPredominante = categoriaSnapshot.label;

  // UA Lotacao real do Lote (sem area do pasto direta, areaHa = undefined)
  const loteAnimalWeights = activeAnimals.map(animal => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const validPes = animalPes
      .map((p) => {
        const ev = validEvents.find((e) => e.id === p.evento_id)!;
        return { p, ev };
      })
      .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

    const latest = validPes[0];
    const pesoKg = latest?.p.peso_kg || 0;
    const isConfiavel = latest 
      ? (weightFreshnessDays !== undefined && weightFreshnessDays !== null 
          ? differenceInDays(refDateObj, safeParseDate(latest.ev.occurred_at)) <= weightFreshnessDays
          : true)
      : false;
    const isMissing = !latest;
    return { pesoKg, isConfiavel, isMissing };
  });

  const uaResult = calculateUaLotacao(loteAnimalWeights, undefined);

  return {
    loteId,
    quantidadeAtual: activeAnimals.length,
    pesoMedio: performance.finalWeightKg,
    pesoStatus: performance.status,
    gmdMedio: performance.observedGmdKgPerDay,
    ganhoMedio: performance.weightDeltaKg,
    gmdStatus: performance.status,
    eccMedio,
    eccStatus,
    eccCobertura: { avaliados: countEccEvaluated, total: activeAnimals.length },
    animaisSemEcc,
    dataEntradaLote,
    tempoMedioPermanencia,
    tempoMaximoPermanencia: maxPermanencia,
    permanenciaStatus,
    ultimaMovimentacao,
    agendaItensAbertos,
    categoriaPredominante,
    categoriaStatus: categoriaSnapshot.status,
    uaTotal: uaResult.uaTotal,
    lotacaoStatus: {
      status: uaResult.status,
      reason: uaResult.reason,
      source: uaResult.source,
      limitation: mergeLimitations(uaResult.limitation, LOTE_UA_LIMITATION),
    },
  };
}

export function calculatePastoMetrics(
  pastoId: string,
  referenceDate: string,
  weightFreshnessDays: number | null | undefined,
  animalsInput: Animal[],
  lotesInput: Lote[],
  pastosInput: Pasto[],
  eventsInput: Evento[],
  pesagensInput: EventoPesagem[],
  eccsInput: EventoEcc[],
  movimentacoesInput: EventoMovimentacao[],
  agendaItensInput: AgendaItem[],
  qualifiedDuration?: OccupancyAggregate | null,
  observedPerformance?: OccupancyPerformanceAggregate | null,
): CockpitPastoMetrics {
  const animals = Array.isArray(animalsInput) ? animalsInput : [];
  const lotes = Array.isArray(lotesInput) ? lotesInput : [];
  const pastos = Array.isArray(pastosInput) ? pastosInput : [];
  const eccs = Array.isArray(eccsInput) ? eccsInput : [];
  const movimentacoes = Array.isArray(movimentacoesInput) ? movimentacoesInput : [];
  const agendaItens = Array.isArray(agendaItensInput) ? agendaItensInput : [];

  const refDateObj = safeParseDate(referenceDate);

  // Lotes linked to this pasto
  const lotesInPasto = lotes.filter((l) => l.pasto_id === pastoId);
  const loteIdsInPasto = new Set(lotesInPasto.map((l) => l.id));

// Active animals currently in those lotes (exclude mortos/vendidos/retirados)
   const activeAnimals = animals.filter(
     (a) => a.lote_id && loteIdsInPasto.has(a.lote_id) && a.status === "ativo" && !a.deleted_at
   );
  const activeAnimalIds = new Set(activeAnimals.map((a) => a.id));

  const commonSources = prepareCommonOccupancySources(
    eventsInput,
    pesagensInput,
    referenceDate,
    observedPerformance,
  );
  const { validEvents, animalPesagensMap, performance } = commonSources;

  // fallow-ignore-next-line code-duplication -- legacy ECC branches remain outside the F22C scope.
  // 3. ECC
  let sumEcc = 0;
  let countEccEvaluated = 0;
  const animaisSemEcc: string[] = [];

  const animalEccsMap = new Map<string, EventoEcc[]>();
  eccs.forEach((e) => {
    if (e.deleted_at) return;
    const ev = validEvents.find((v) => v.id === e.event_id);
    if (ev && ev.animal_id) {
      if (!animalEccsMap.has(ev.animal_id)) {
        animalEccsMap.set(ev.animal_id, []);
      }
      animalEccsMap.get(ev.animal_id)!.push(e);
    }
  });

  activeAnimals.forEach((animal) => {
    const animalE = animalEccsMap.get(animal.id) || [];
    const validE = animalE
      .map((e) => {
        const ev = validEvents.find((v) => v.id === e.event_id)!;
        return { e, ev };
      })
      .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

    if (validE.length > 0) {
      sumEcc += validE[0].e.ecc;
      countEccEvaluated++;
    } else {
      animaisSemEcc.push(animal.identificacao);
    }
  });

  const eccMedio = countEccEvaluated > 0 ? sumEcc / countEccEvaluated : null;
  let eccStatus: DataStatus = { status: "empty", reason: "Sem ECC factual registrado" };

  if (activeAnimals.length === 0) {
    eccStatus = { status: "empty", reason: "Sem animais ativos" };
  } else if (countEccEvaluated === activeAnimals.length) {
    eccStatus = {
      status: "complete",
      reason: "ECC registrado para todos os animais",
      source: "ECC factual",
    };
  } else if (countEccEvaluated > 0) {
    eccStatus = {
      status: "partial",
      reason: `Cobertura de ECC parcial: ${countEccEvaluated} de ${activeAnimals.length} avaliados`,
      source: "ECC factual",
      limitation: `${activeAnimals.length - countEccEvaluated} animais sem ECC`,
    };
  } else {
    eccStatus = {
      status: "empty",
      reason: "Nenhum animal com ECC registrado",
      source: "ECC factual",
      limitation: "Todos os animais sem ECC registrado",
    };
  }

  // 4. Uso histórico qualificado. O adapter não reconstrói fatos nem usa state_*.
  const qualifiedPermanence = presentQualifiedOccupancyDuration(qualifiedDuration);
  const tempoUsoDias = qualifiedPermanence.meanDurationDays;
  const permanenciaStatus: DataStatus = qualifiedPermanence.status;

  // Ultima movimentação que tocou este pasto
  const pastoMovs = validEvents.filter((e) => {
    if (e.dominio !== "movimentacao") return false;
    const m = movimentacoes.find((mov) => mov.evento_id === e.id);
    return m && (m.to_pasto_id === pastoId || m.from_pasto_id === pastoId);
  });
  const ultimaMovimentacao = pastoMovs.length > 0
    ? pastoMovs.reduce((latest, e) => (e.occurred_at > latest ? e.occurred_at : latest), pastoMovs[0].occurred_at)
    : null;

  // 5. Pendências (Agenda)
  const openPastoAgendaItens = agendaItens.filter((item) => {
    if (item.deleted_at || item.status === "concluido" || item.status === "cancelado") {
      return false;
    }
    const isLoteTarget = item.lote_id && loteIdsInPasto.has(item.lote_id);
    const isAnimalTarget = item.animal_id && activeAnimalIds.has(item.animal_id);
    return isLoteTarget || isAnimalTarget;
  });

  let atrasados = 0;
  let hoje = 0;
  let proximos = 0;

  openPastoAgendaItens.forEach((item) => {
    if (item.due_date < referenceDate) {
      atrasados++;
    } else if (item.due_date === referenceDate) {
      hoje++;
    } else {
      proximos++;
    }
  });

  const agendaItensAbertos = {
    total: openPastoAgendaItens.length,
    atrasados,
    hoje,
    proximos,
  };

  const categoriaSnapshot = getPredominantCategorySnapshot(activeAnimals, referenceDate);
  const categoriaPredominante = categoriaSnapshot.label;

  // 6. UA e Taxa de lotação real UA/ha
  const pastoObj = pastosInput.find(p => p.id === pastoId);
  const areaHa = pastoObj?.area_ha ?? null;

  const pastoAnimalWeights = activeAnimals.map(animal => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const validPes = animalPes
      .map((p) => {
        const ev = validEvents.find((e) => e.id === p.evento_id)!;
        return { p, ev };
      })
      .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

    const latest = validPes[0];
    const pesoKg = latest?.p.peso_kg || 0;
    const isConfiavel = latest 
      ? (weightFreshnessDays !== undefined && weightFreshnessDays !== null 
          ? differenceInDays(refDateObj, safeParseDate(latest.ev.occurred_at)) <= weightFreshnessDays
          : true)
      : false;
    const isMissing = !latest;
    return { pesoKg, isConfiavel, isMissing };
  });

  const uaResult = calculateUaLotacao(pastoAnimalWeights, areaHa);

  return {
    pastoId,
    lotacaoAtual: activeAnimals.length,
    pesoMedio: performance.finalWeightKg,
    pesoStatus: performance.status,
    gmdMedio: performance.observedGmdKgPerDay,
    ganhoMedioPeso: performance.weightDeltaKg,
    gmdStatus: performance.status,
    eccMedio,
    eccStatus,
    eccCobertura: { avaliados: countEccEvaluated, total: activeAnimals.length },
    animaisSemEcc,
    tempoUsoDias,
    permanenciaStatus,
    ultimaMovimentacao,
    agendaItensAbertos,
    categoriaPredominante,
    categoriaStatus: categoriaSnapshot.status,
    uaTotal: uaResult.uaTotal,
    taxaLotacaoUaHa: uaResult.taxaLotacaoUaHa,
    taxaLotacaoStatus: {
      status: uaResult.status,
      reason: uaResult.reason,
      source: uaResult.source,
      limitation: mergeLimitations(uaResult.limitation, PASTO_STOCKING_RATE_LIMITATION),
    },
  };
}
