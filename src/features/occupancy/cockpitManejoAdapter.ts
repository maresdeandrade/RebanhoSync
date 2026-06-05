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
  PastoOcupacao,
} from "@/lib/offline/types";
import { calculateIndividualGmd, calculateUaLotacao } from "@/lib/animals/kpiHelpers";
import { getPredominantCategorySnapshot } from "./classification";

const GMD_LOTE_SCOPE_LIMITATION =
  "Leitura baseada nos animais atualmente no lote com pesagens válidas; não comprova desempenho histórico completo do lote nem permanência no período sem movimentações suficientes.";
const GMD_PASTO_SCOPE_LIMITATION =
  "Leitura baseada nos animais atualmente no pasto com pesagens válidas; não comprova desempenho histórico completo do pasto nem permanência no período sem movimentações suficientes.";
const OCCUPANCY_READ_MODEL_LIMITATION =
  "Read model de ocupação atual; não é fonte histórica primária completa de permanência.";
const MOVEMENT_HISTORY_LIMITATION =
  "Baseado em movimentações de entrada registradas para os animais atuais; não substitui auditoria histórica completa de entradas e saídas.";
const PASTO_STOCKING_RATE_LIMITATION =
  "Taxa UA/ha exige area_ha válida e peso explícito dos animais atuais; dados incompletos tornam a leitura parcial.";
const LOTE_UA_LIMITATION =
  "UA total do lote exige peso explícito dos animais atuais; dados ausentes ou desatualizados tornam a leitura parcial.";
const CURRENT_ENTRY_MOVEMENT_LIMITATION =
  "Leitura atual baseada em movimentações de entrada; sem eventos completos de entrada e saída, não afirma permanência histórica completa.";

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
  tempoMedioPermanencia: number;
  tempoMaximoPermanencia: number;
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
  tempoUsoDias: number;
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
  pastoOcupacoesInput?: PastoOcupacao[]
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
      status: "complete",
      reason: "GMD calculado para todos os animais atuais do lote",
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

  // 4. Permanência com prioridade de state_pasto_ocupacoes
  let dataEntradaLote: string | null = null;
  let tempoMedioPermanencia = 0;
  let maxPermanencia = 0;
  let permanenciaStatus: DataStatus = { status: "empty", reason: "Sem histórico de permanência", source: "Sem dados" };

  const ocupacoesLote = Array.isArray(pastoOcupacoesInput)
    ? pastoOcupacoesInput.filter((o) => o.lote_id === loteId)
    : [];

  const animalMovMap = new Map<string, EventoMovimentacao[]>();
  movimentacoes.forEach((m) => {
    if (m.deleted_at) return;
    const ev = validEvents.find((v) => v.id === m.evento_id);
    if (ev && ev.animal_id) {
      if (!animalMovMap.has(ev.animal_id)) {
        animalMovMap.set(ev.animal_id, []);
      }
      animalMovMap.get(ev.animal_id)!.push(m);
    }
  });

  if (ocupacoesLote.length > 0) {
    const ocupacaoAtiva = ocupacoesLote.find((o) => o.saida_em === null);
    if (ocupacaoAtiva) {
      dataEntradaLote = ocupacaoAtiva.entrada_em;
      const days = differenceInDays(refDateObj, safeParseDate(dataEntradaLote));
      tempoMedioPermanencia = days >= 0 ? days : 0;
      maxPermanencia = tempoMedioPermanencia;
      permanenciaStatus = {
        status: "partial",
        reason: "Ocupação atual mapeada por read model",
        source: "state_pasto_ocupacoes (read model)",
        limitation: OCCUPANCY_READ_MODEL_LIMITATION,
      };
    } else {
      const sorted = [...ocupacoesLote].sort((a, b) => b.entrada_em.localeCompare(a.entrada_em));
      dataEntradaLote = sorted[0].entrada_em;
      const days = differenceInDays(refDateObj, safeParseDate(dataEntradaLote));
      tempoMedioPermanencia = days >= 0 ? days : 0;
      maxPermanencia = tempoMedioPermanencia;
      permanenciaStatus = {
        status: "partial",
        reason: "Ocupação anterior encerrada",
        source: "state_pasto_ocupacoes (read model)",
        limitation: mergeLimitations(
          "Não há registro de ocupação aberta atualmente no pasto.",
          OCCUPANCY_READ_MODEL_LIMITATION,
        ),
      };
    }
  } else {
    // Fallback: eventos_movimentacao
    let sumPermanenciaDays = 0;
    let countWithEntry = 0;

    activeAnimals.forEach((animal) => {
      const animalM = animalMovMap.get(animal.id) || [];
      const validM = animalM
        .map((m) => {
          const ev = validEvents.find((v) => v.id === m.evento_id)!;
          return { m, ev };
        })
        .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

      if (validM.length > 0 && validM[0].m.to_lote_id === loteId) {
        const entryDate = validM[0].ev.occurred_at;
        const days = differenceInDays(refDateObj, safeParseDate(entryDate));
        const validDays = days >= 0 ? days : 0;
        sumPermanenciaDays += validDays;
        countWithEntry++;
        if (validDays > maxPermanencia) {
          maxPermanencia = validDays;
        }
        if (!dataEntradaLote || entryDate > dataEntradaLote) {
          dataEntradaLote = entryDate;
        }
      }
    });

    tempoMedioPermanencia = countWithEntry > 0 ? sumPermanenciaDays / countWithEntry : 0;

    if (activeAnimals.length === 0) {
      permanenciaStatus = { status: "empty", reason: "Sem animais ativos no lote", source: "Sem dados" };
    } else if (countWithEntry === activeAnimals.length) {
      permanenciaStatus = {
        status: "partial",
        reason: "Permanência atual calculada por movimentações de entrada",
        source: "eventos_movimentacao",
        limitation: mergeLimitations(
          CURRENT_ENTRY_MOVEMENT_LIMITATION,
          MOVEMENT_HISTORY_LIMITATION,
        ),
      };
    } else if (countWithEntry > 0) {
      permanenciaStatus = {
        status: "partial",
        reason: "Permanência calculada parcialmente via movimentações",
        source: "eventos_movimentacao",
        limitation: mergeLimitations(
          `${activeAnimals.length - countWithEntry} animais sem movimentação de entrada registrada.`,
          MOVEMENT_HISTORY_LIMITATION,
        ),
      };
    } else {
      permanenciaStatus = {
        status: "partial",
        reason: "Permanência desconhecida (todos os animais sem movimentação de entrada)",
        source: "eventos_movimentacao",
        limitation: "Movimentação inicial ausente para todos os animais atuais; permanência histórica não pode ser afirmada.",
      };
    }
  }

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
  pastoOcupacoesInput?: PastoOcupacao[]
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
      status: "complete",
      reason: "GMD calculado para todos os animais atuais do pasto",
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

  // 4. Lotação / Uso do Pasto com prioridade de state_pasto_ocupacoes
  let tempoUsoDias = 0;
  let permanenciaStatus: DataStatus = { status: "empty", reason: "Sem histórico de uso", source: "Sem dados" };

  const ocupacoesPasto = Array.isArray(pastoOcupacoesInput)
    ? pastoOcupacoesInput.filter((o) => o.pasto_id === pastoId)
    : [];

  const animalMovMap = new Map<string, EventoMovimentacao[]>();
  movimentacoes.forEach((m) => {
    if (m.deleted_at) return;
    const ev = validEvents.find((v) => v.id === m.evento_id);
    if (ev && ev.animal_id) {
      if (!animalMovMap.has(ev.animal_id)) {
        animalMovMap.set(ev.animal_id, []);
      }
      animalMovMap.get(ev.animal_id)!.push(m);
    }
  });

  if (ocupacoesPasto.length > 0) {
    const ocupacoesAtivas = ocupacoesPasto.filter((o) => o.saida_em === null);
    if (ocupacoesAtivas.length > 0) {
      const sumDays = ocupacoesAtivas.reduce((sum, o) => {
        const days = differenceInDays(refDateObj, safeParseDate(o.entrada_em));
        return sum + (days >= 0 ? days : 0);
      }, 0);
      tempoUsoDias = sumDays / ocupacoesAtivas.length;
      permanenciaStatus = {
        status: "partial",
        reason: "Ocupação atual mapeada por read model",
        source: "state_pasto_ocupacoes (read model)",
        limitation: OCCUPANCY_READ_MODEL_LIMITATION,
      };
    } else {
      const sorted = [...ocupacoesPasto].sort((a, b) => b.entrada_em.localeCompare(a.entrada_em));
      const latest = sorted[0];
      const days = differenceInDays(refDateObj, safeParseDate(latest.entrada_em));
      tempoUsoDias = days >= 0 ? days : 0;
      permanenciaStatus = {
        status: "partial",
        reason: "Última ocupação encerrada",
        source: "state_pasto_ocupacoes (read model)",
        limitation: mergeLimitations(
          "Não há registro de lote ativo atualmente no pasto.",
          OCCUPANCY_READ_MODEL_LIMITATION,
        ),
      };
    }
  } else {
    // Fallback: eventos_movimentacao
    let sumUsoDays = 0;
    let countWithPastoEntry = 0;

    activeAnimals.forEach((animal) => {
      const animalM = animalMovMap.get(animal.id) || [];
      const validM = animalM
        .map((m) => {
          const ev = validEvents.find((v) => v.id === m.evento_id)!;
          return { m, ev };
        })
        .sort((a, b) => b.ev.occurred_at.localeCompare(a.ev.occurred_at));

      if (validM.length > 0 && validM[0].m.to_pasto_id === pastoId) {
        const entryDate = validM[0].ev.occurred_at;
        const days = differenceInDays(refDateObj, safeParseDate(entryDate));
        const validDays = days >= 0 ? days : 0;
        sumUsoDays += validDays;
        countWithPastoEntry++;
      }
    });

    tempoUsoDias = countWithPastoEntry > 0 ? sumUsoDays / countWithPastoEntry : 0;

    if (activeAnimals.length === 0) {
      permanenciaStatus = {
        status: "empty",
        reason: "Sem animais ativos no pasto",
        source: "Sem dados",
      };
    } else if (countWithPastoEntry === activeAnimals.length) {
      permanenciaStatus = {
        status: "partial",
        reason: "Uso atual calculado por movimentações de entrada",
        source: "eventos_movimentacao",
        limitation: mergeLimitations(
          CURRENT_ENTRY_MOVEMENT_LIMITATION,
          MOVEMENT_HISTORY_LIMITATION,
        ),
      };
    } else if (countWithPastoEntry > 0) {
      permanenciaStatus = {
        status: "partial",
        reason: "Tempo de uso parcial via movimentações",
        source: "eventos_movimentacao",
        limitation: mergeLimitations(
          `${activeAnimals.length - countWithPastoEntry} animais sem movimentação de entrada registrada.`,
          MOVEMENT_HISTORY_LIMITATION,
        ),
      };
    } else {
      permanenciaStatus = {
        status: "partial",
        reason: "Tempo de uso desconhecido (todos os animais sem movimentação de entrada)",
        source: "eventos_movimentacao",
        limitation: "Movimentação inicial ausente para todos os animais atuais; uso histórico do pasto não pode ser afirmado.",
      };
    }
  }

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
