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
import { calculateIndividualGmd, calculateUaLotacao } from "@/lib/animals/kpiHelpers";
import { getPredominantCategorySnapshot } from "./classification";
import type { OccupancyAggregate } from "@/lib/occupancy/occupancyAggregation";
import { presentQualifiedOccupancyDuration } from "./qualifiedOccupancyAdapter";

const GMD_LOTE_SCOPE_LIMITATION =
  "Leitura baseada nos animais atualmente no lote com pesagens válidas; não comprova desempenho histórico completo do lote nem permanência no período sem movimentações suficientes.";
const GMD_PASTO_SCOPE_LIMITATION =
  "Leitura baseada nos animais atualmente no pasto com pesagens válidas; não comprova desempenho histórico completo do pasto nem permanência no período sem movimentações suficientes.";
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

// fallow-ignore-next-line complexity -- legacy multi-metric adapter; F22C.3 changes only qualified permanence.
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
): CockpitLoteMetrics {
  const animals = Array.isArray(animalsInput) ? animalsInput : [];
  const events = Array.isArray(eventsInput) ? eventsInput : [];
  const pesagens = Array.isArray(pesagensInput) ? pesagensInput : [];
  const eccs = Array.isArray(eccsInput) ? eccsInput : [];
  const movimentacoes = Array.isArray(movimentacoesInput) ? movimentacoesInput : [];
  const agendaItens = Array.isArray(agendaItensInput) ? agendaItensInput : [];

  const refDateObj = safeParseDate(referenceDate);

// Active animals in this lote (exclude mortos/vendidos/retirados)
   const activeAnimals = animals.filter(
     (a) => a.lote_id === loteId && a.status === "ativo" && !a.deleted_at
   );
  const activeAnimalIds = new Set(activeAnimals.map((a) => a.id));

  // Non-deleted events on or before referenceDate
  const validEvents = events.filter(
    (e) => !e.deleted_at && e.occurred_at <= referenceDate
  );

  // 1. Peso Confiável & Recência
  let sumWeight = 0;
  let countWeightUsed = 0;
  let countExpired = 0;
  let countMissing = 0;

  const animalPesagensMap = new Map<string, EventoPesagem[]>();
  pesagens.forEach((p) => {
    if (p.deleted_at) return;
    const ev = validEvents.find((e) => e.id === p.evento_id);
    if (ev && ev.animal_id) {
      if (!animalPesagensMap.has(ev.animal_id)) {
        animalPesagensMap.set(ev.animal_id, []);
      }
      animalPesagensMap.get(ev.animal_id)!.push(p);
    }
  });

  activeAnimals.forEach((animal) => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const validPes = animalPes
      .map((p) => {
        const ev = validEvents.find((e) => e.id === p.evento_id)!;
        return { p, ev };
      })
      .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

    if (validPes.length === 0) {
      countMissing++;
    } else {
      const latest = validPes[0];
      const weightDateObj = safeParseDate(latest.ev.occurred_at);
      const days = differenceInDays(refDateObj, weightDateObj);

      if (weightFreshnessDays !== undefined && weightFreshnessDays !== null) {
        if (days <= weightFreshnessDays) {
          sumWeight += latest.p.peso_kg;
          countWeightUsed++;
        } else {
          countExpired++;
        }
      } else {
        sumWeight += latest.p.peso_kg;
        countWeightUsed++;
      }
    }
  });

  const pesoMedio = countWeightUsed > 0 ? sumWeight / countWeightUsed : null;
  let pesoStatus: DataStatus = { status: "empty", reason: "Sem pesagens registradas" };

  if (activeAnimals.length === 0) {
    pesoStatus = { status: "empty", reason: "Sem animais ativos no lote" };
  } else if (weightFreshnessDays !== undefined && weightFreshnessDays !== null) {
    if (countWeightUsed === activeAnimals.length) {
      pesoStatus = {
        status: "complete",
        reason: "Todos os pesos são confiáveis",
        source: "Pesagem factual fresca",
      };
    } else if (countWeightUsed > 0) {
      pesoStatus = {
        status: "partial",
        reason: `${countWeightUsed} de ${activeAnimals.length} animais com peso confiável`,
        source: "Pesagem factual fresca",
        limitation: `${countExpired} expirados, ${countMissing} sem peso`,
      };
    } else {
      pesoStatus = {
        status: "empty",
        reason: "Nenhum peso confiável dentro do prazo de validade",
        source: "Pesagem factual fresca",
        limitation: `Todos os ${activeAnimals.length} animais com peso expirado ou ausente`,
      };
    }
  } else {
    if (countWeightUsed > 0) {
      pesoStatus = {
        status: "partial",
        reason: "Usando último peso registrado (sem limite de recência)",
        source: "Último peso registrado",
        limitation: "FreshnessDays não configurado",
      };
    }
  }

  // 2. GMD (Média dos GMDs individuais reais válidos)
  let sumGmd = 0;
  let sumGanho = 0;
  let countGmdCalculated = 0;

  activeAnimals.forEach((animal) => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const mappedPes = animalPes.map(p => {
      const ev = validEvents.find((e) => e.id === p.evento_id)!;
      return {
        peso_kg: p.peso_kg,
        occurred_at: ev.occurred_at,
        deleted_at: p.deleted_at,
      };
    });

    const gmdResult = calculateIndividualGmd(mappedPes);
    if (gmdResult.isValid) {
      sumGmd += gmdResult.gmdKgDia;
      sumGanho += gmdResult.ganhoKg;
      countGmdCalculated++;
    }
  });

  const gmdMedio = countGmdCalculated > 0 ? sumGmd / countGmdCalculated : null;
  const ganhoMedio = countGmdCalculated > 0 ? sumGanho / countGmdCalculated : null;
  let gmdStatus: DataStatus = { status: "empty", reason: "Sem histórico de GMD" };

  if (activeAnimals.length === 0) {
    gmdStatus = { status: "empty", reason: "Sem animais ativos" };
  } else if (countGmdCalculated === activeAnimals.length) {
    gmdStatus = {
      status: "partial",
      reason: "GMD individual disponível para todos os animais atuais do lote",
      source: "Pesagens factuais dos animais atuais",
      limitation: GMD_LOTE_SCOPE_LIMITATION,
    };
  } else if (countGmdCalculated > 0) {
    gmdStatus = {
      status: "partial",
      reason: `${countGmdCalculated} de ${activeAnimals.length} animais atuais do lote com GMD`,
      source: "Pesagens factuais dos animais atuais",
      limitation: mergeLimitations(
        `${activeAnimals.length - countGmdCalculated} animais com dados insuficientes (exige ≥2 pesagens em dias distintos).`,
        GMD_LOTE_SCOPE_LIMITATION,
      ),
    };
  } else {
    gmdStatus = {
      status: "empty",
      reason: "Dados insuficientes para calcular GMD",
      source: "Pesagens factuais dos animais atuais",
      limitation: mergeLimitations(
        "Todos os animais têm menos de 2 pesagens ou intervalo inválido.",
        GMD_LOTE_SCOPE_LIMITATION,
      ),
    };
  }

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
    pesoMedio,
    pesoStatus,
    gmdMedio,
    ganhoMedio,
    gmdStatus,
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
): CockpitPastoMetrics {
  const animals = Array.isArray(animalsInput) ? animalsInput : [];
  const lotes = Array.isArray(lotesInput) ? lotesInput : [];
  const pastos = Array.isArray(pastosInput) ? pastosInput : [];
  const events = Array.isArray(eventsInput) ? eventsInput : [];
  const pesagens = Array.isArray(pesagensInput) ? pesagensInput : [];
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

  // Non-deleted events on or before referenceDate
  const validEvents = events.filter(
    (e) => !e.deleted_at && e.occurred_at <= referenceDate
  );

  // 1. Peso Confiável & Recência
  let sumWeight = 0;
  let countWeightUsed = 0;
  let countExpired = 0;
  let countMissing = 0;

  const animalPesagensMap = new Map<string, EventoPesagem[]>();
  pesagens.forEach((p) => {
    if (p.deleted_at) return;
    const ev = validEvents.find((e) => e.id === p.evento_id);
    if (ev && ev.animal_id) {
      if (!animalPesagensMap.has(ev.animal_id)) {
        animalPesagensMap.set(ev.animal_id, []);
      }
      animalPesagensMap.get(ev.animal_id)!.push(p);
    }
  });

  activeAnimals.forEach((animal) => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const validPes = animalPes
      .map((p) => {
        const ev = validEvents.find((e) => e.id === p.evento_id)!;
        return { p, ev };
      })
      .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

    if (validPes.length === 0) {
      countMissing++;
    } else {
      const latest = validPes[0];
      const weightDateObj = safeParseDate(latest.ev.occurred_at);
      const days = differenceInDays(refDateObj, weightDateObj);

      if (weightFreshnessDays !== undefined && weightFreshnessDays !== null) {
        if (days <= weightFreshnessDays) {
          sumWeight += latest.p.peso_kg;
          countWeightUsed++;
        } else {
          countExpired++;
        }
      } else {
        sumWeight += latest.p.peso_kg;
        countWeightUsed++;
      }
    }
  });

  const pesoMedio = countWeightUsed > 0 ? sumWeight / countWeightUsed : null;
  let pesoStatus: DataStatus = { status: "empty", reason: "Sem pesagens registradas" };

  if (activeAnimals.length === 0) {
    pesoStatus = { status: "empty", reason: "Sem animais ativos no pasto" };
  } else if (weightFreshnessDays !== undefined && weightFreshnessDays !== null) {
    if (countWeightUsed === activeAnimals.length) {
      pesoStatus = {
        status: "complete",
        reason: "Todos os pesos são confiáveis",
        source: "Pesagem factual fresca",
      };
    } else if (countWeightUsed > 0) {
      pesoStatus = {
        status: "partial",
        reason: `${countWeightUsed} de ${activeAnimals.length} animais com peso confiável`,
        source: "Pesagem factual fresca",
        limitation: `${countExpired} expirados, ${countMissing} sem peso`,
      };
    } else {
      pesoStatus = {
        status: "empty",
        reason: "Nenhum peso confiável dentro do prazo de validade",
        source: "Pesagem factual fresca",
        limitation: `Todos os ${activeAnimals.length} animais com peso expirado ou ausente`,
      };
    }
  } else {
    if (countWeightUsed > 0) {
      pesoStatus = {
        status: "partial",
        reason: "Usando último peso registrado (sem limite de recência)",
        source: "Último peso registrado",
        limitation: "FreshnessDays não configurado",
      };
    }
  }

  // 2. GMD (Média dos GMDs individuais reais válidos)
  let sumGmd = 0;
  let sumGanho = 0;
  let countGmdCalculated = 0;

  activeAnimals.forEach((animal) => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const mappedPes = animalPes.map(p => {
      const ev = validEvents.find((e) => e.id === p.evento_id)!;
      return {
        peso_kg: p.peso_kg,
        occurred_at: ev.occurred_at,
        deleted_at: p.deleted_at,
      };
    });

    const gmdResult = calculateIndividualGmd(mappedPes);
    if (gmdResult.isValid) {
      sumGmd += gmdResult.gmdKgDia;
      sumGanho += gmdResult.ganhoKg;
      countGmdCalculated++;
    }
  });

  const gmdMedio = countGmdCalculated > 0 ? sumGmd / countGmdCalculated : null;
  const ganhoMedioPeso = countGmdCalculated > 0 ? sumGanho / countGmdCalculated : null;
  let gmdStatus: DataStatus = { status: "empty", reason: "Sem histórico de GMD" };

  if (activeAnimals.length === 0) {
    gmdStatus = { status: "empty", reason: "Sem animais ativos" };
  } else if (countGmdCalculated === activeAnimals.length) {
    gmdStatus = {
      status: "partial",
      reason: "GMD individual disponível para todos os animais atuais do pasto",
      source: "Pesagens factuais dos animais atuais",
      limitation: GMD_PASTO_SCOPE_LIMITATION,
    };
  } else if (countGmdCalculated > 0) {
    gmdStatus = {
      status: "partial",
      reason: `${countGmdCalculated} de ${activeAnimals.length} animais atuais do pasto com GMD`,
      source: "Pesagens factuais dos animais atuais",
      limitation: mergeLimitations(
        `${activeAnimals.length - countGmdCalculated} animais com dados insuficientes (exige ≥2 pesagens em dias distintos).`,
        GMD_PASTO_SCOPE_LIMITATION,
      ),
    };
  } else {
    gmdStatus = {
      status: "empty",
      reason: "Dados insuficientes para calcular GMD",
      source: "Pesagens factuais dos animais atuais",
      limitation: mergeLimitations(
        "Todos os animais têm menos de 2 pesagens ou intervalo inválido.",
        GMD_PASTO_SCOPE_LIMITATION,
      ),
    };
  }

  // fallow-ignore-next-line code-duplication -- legacy ECC branches remain outside the F22C.3 duration scope.
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
    pesoMedio,
    pesoStatus,
    gmdMedio,
    ganhoMedioPeso,
    gmdStatus,
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
