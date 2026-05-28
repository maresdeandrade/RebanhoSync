import { differenceInDays, parseISO, isBefore, isAfter } from "date-fns";
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

export interface DataStatus {
  status: "empty" | "partial" | "complete";
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
  gmdStatus: DataStatus;
  eccMedio: number | null;
  eccStatus: DataStatus;
  eccCobertura: { avaliados: number; total: number };
  animaisSemEcc: string[];
  dataEntradaLote: string | null;
  tempoMedioPermanencia: number;
  tempoMaximoPermanencia: number;
  tempoLotacaoStatus: DataStatus;
  ultimaMovimentacao: string | null;
  agendaItensAbertos: {
    total: number;
    atrasados: number;
    hoje: number;
    proximos: number;
  };
  categoriaPredominante: string;
}

export interface CockpitPastoMetrics {
  pastoId: string;
  lotacaoAtual: number;
  pesoMedio: number | null;
  pesoStatus: DataStatus;
  gmdMedio: number | null;
  gmdStatus: DataStatus;
  eccMedio: number | null;
  eccStatus: DataStatus;
  eccCobertura: { avaliados: number; total: number };
  animaisSemEcc: string[];
  tempoUsoDias: number;
  tempoLotacaoStatus: DataStatus;
  ultimaMovimentacao: string | null;
  agendaItensAbertos: {
    total: number;
    atrasados: number;
    hoje: number;
    proximos: number;
  };
  categoriaPredominante: string;
}

// Utility to parse ISO date string safely and strip time if only comparing dates
function safeParseDate(dStr: string): Date {
  return parseISO(dStr);
}

function getPredominantCategory(animals: Animal[]): string {
  if (animals.length === 0) return "Nenhum animal";
  const counts = new Map<string, number>();
  for (const animal of animals) {
    const cat = animal.categoria_zootecnica || "Não classificada";
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  let predominant = "Não classificada";
  let max = 0;
  for (const [cat, count] of counts.entries()) {
    if (count > max) {
      max = count;
      predominant = cat;
    }
  }
  return predominant;
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
  agendaItensInput: AgendaItem[]
): CockpitLoteMetrics {
  const animals = Array.isArray(animalsInput) ? animalsInput : [];
  const events = Array.isArray(eventsInput) ? eventsInput : [];
  const pesagens = Array.isArray(pesagensInput) ? pesagensInput : [];
  const eccs = Array.isArray(eccsInput) ? eccsInput : [];
  const movimentacoes = Array.isArray(movimentacoesInput) ? movimentacoesInput : [];
  const agendaItens = Array.isArray(agendaItensInput) ? agendaItensInput : [];

  const refDateObj = safeParseDate(referenceDate);

  // Active animals in this lote
  const activeAnimals = animals.filter(
    (a) => a.lote_id === loteId && a.status === "ativo"
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
    // Sort desc to get latest
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
        // Without freshness, we use the latest weight but mark as partial
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
    // Freshness not configured
    if (countWeightUsed > 0) {
      pesoStatus = {
        status: "partial",
        reason: "Usando último peso registrado (sem limite de recência)",
        source: "Último peso registrado",
        limitation: "FreshnessDays não configurado",
      };
    }
  }

  // 2. GMD (≥2 valid factual weights)
  let sumGmd = 0;
  let countGmdCalculated = 0;

  activeAnimals.forEach((animal) => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    // Sort asc to get oldest and newest
    const validPesSorted = animalPes
      .map((p) => {
        const ev = validEvents.find((e) => e.id === p.evento_id)!;
        return { p, ev };
      })
      .sort((a, b) => a.ev.occurred_at.localeCompare(b.ev.occurred_at));

    if (validPesSorted.length >= 2) {
      const first = validPesSorted[0];
      const last = validPesSorted[validPesSorted.length - 1];
      const days = differenceInDays(
        safeParseDate(last.ev.occurred_at),
        safeParseDate(first.ev.occurred_at)
      );
      if (days > 0) {
        const gain = last.p.peso_kg - first.p.peso_kg;
        sumGmd += gain / days;
        countGmdCalculated++;
      }
    }
  });

  const gmdMedio = countGmdCalculated > 0 ? sumGmd / countGmdCalculated : null;
  let gmdStatus: DataStatus = { status: "empty", reason: "Sem histórico de GMD" };

  if (activeAnimals.length === 0) {
    gmdStatus = { status: "empty", reason: "Sem animais ativos" };
  } else if (countGmdCalculated === activeAnimals.length) {
    gmdStatus = {
      status: "complete",
      reason: "GMD calculado para todos os animais",
      source: "GMD factual",
    };
  } else if (countGmdCalculated > 0) {
    gmdStatus = {
      status: "partial",
      reason: `${countGmdCalculated} de ${activeAnimals.length} animais com GMD`,
      source: "GMD factual",
      limitation: `${activeAnimals.length - countGmdCalculated} animais com dados insuficientes (exige ≥2 pesagens)`,
    };
  } else {
    gmdStatus = {
      status: "empty",
      reason: "Dados insuficientes para calcular GMD",
      source: "GMD factual",
      limitation: "Todos os animais têm menos de 2 pesagens registradas",
    };
  }

  // 3. ECC (Escore de Condição Corporal)
  let sumEcc = 0;
  let countEccEvaluated = 0;
  const animaisSemEcc: string[] = [];

  const animalEccsMap = new Map<string, EventoEcc[]>();
  eccs.forEach((e) => {
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

  // 4. Lotação / Permanência / Entrada
  let sumPermanenciaDays = 0;
  let countWithEntry = 0;
  let maxPermanencia = 0;
  let dataEntradaLote: string | null = null;

  const animalMovMap = new Map<string, EventoMovimentacao[]>();
  movimentacoes.forEach((m) => {
    const ev = validEvents.find((v) => v.id === m.evento_id);
    if (ev && ev.animal_id) {
      if (!animalMovMap.has(ev.animal_id)) {
        animalMovMap.set(ev.animal_id, []);
      }
      animalMovMap.get(ev.animal_id)!.push(m);
    }
  });

  activeAnimals.forEach((animal) => {
    const animalM = animalMovMap.get(animal.id) || [];
    // Latest movement desc
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

  const tempoMedioPermanencia = countWithEntry > 0 ? sumPermanenciaDays / countWithEntry : 0;
  let tempoLotacaoStatus: DataStatus = { status: "empty" };

  if (activeAnimals.length === 0) {
    tempoLotacaoStatus = {
      status: "empty",
      reason: "Sem animais ativos",
    };
  } else if (countWithEntry === activeAnimals.length) {
    tempoLotacaoStatus = {
      status: "complete",
      reason: "Histórico de permanência completo",
      source: "Movimentações factuais",
    };
  } else if (countWithEntry > 0) {
    tempoLotacaoStatus = {
      status: "partial",
      reason: "Permanência parcial (alguns animais sem movimentação de entrada)",
      source: "Movimentações factuais",
      limitation: `${activeAnimals.length - countWithEntry} animais sem movimentação de entrada registrada`,
    };
  } else {
    tempoLotacaoStatus = {
      status: "partial",
      reason: "Permanência desconhecida (todos os animais sem movimentação de entrada)",
      source: "Movimentações factuais",
      limitation: "Movimentação inicial ausente para todos os animais",
    };
  }

  // Ultima movimentação que tocou este lote
  const loteMovs = validEvents.filter(
    (e) => e.lote_id === loteId && e.dominio === "movimentacao"
  );
  const ultimaMovimentacao = loteMovs.length > 0
    ? loteMovs.reduce((latest, e) => (e.occurred_at > latest ? e.occurred_at : latest), loteMovs[0].occurred_at)
    : null;

  // 5. Pendências (Agenda)
  // Lote: agenda aberta do lote + agenda aberta dos animais ativos do lote.
  // Ignorar agenda concluída, cancelada, deletada.
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

  const categoriaPredominante = getPredominantCategory(activeAnimals);

  return {
    loteId,
    quantidadeAtual: activeAnimals.length,
    pesoMedio,
    pesoStatus,
    gmdMedio,
    gmdStatus,
    eccMedio,
    eccStatus,
    eccCobertura: { avaliados: countEccEvaluated, total: activeAnimals.length },
    animaisSemEcc,
    dataEntradaLote,
    tempoMedioPermanencia,
    tempoMaximoPermanencia: maxPermanencia,
    tempoLotacaoStatus,
    ultimaMovimentacao,
    agendaItensAbertos,
    categoriaPredominante,
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
  agendaItensInput: AgendaItem[]
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

  // Active animals currently in those lotes
  const activeAnimals = animals.filter(
    (a) => a.lote_id && loteIdsInPasto.has(a.lote_id) && a.status === "ativo"
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

  // 2. GMD
  let sumGmd = 0;
  let countGmdCalculated = 0;

  activeAnimals.forEach((animal) => {
    const animalPes = animalPesagensMap.get(animal.id) || [];
    const validPesSorted = animalPes
      .map((p) => {
        const ev = validEvents.find((e) => e.id === p.evento_id)!;
        return { p, ev };
      })
      .sort((a, b) => a.ev.occurred_at.localeCompare(b.ev.occurred_at));

    if (validPesSorted.length >= 2) {
      const first = validPesSorted[0];
      const last = validPesSorted[validPesSorted.length - 1];
      const days = differenceInDays(
        safeParseDate(last.ev.occurred_at),
        safeParseDate(first.ev.occurred_at)
      );
      if (days > 0) {
        const gain = last.p.peso_kg - first.p.peso_kg;
        sumGmd += gain / days;
        countGmdCalculated++;
      }
    }
  });

  const gmdMedio = countGmdCalculated > 0 ? sumGmd / countGmdCalculated : null;
  let gmdStatus: DataStatus = { status: "empty", reason: "Sem histórico de GMD" };

  if (activeAnimals.length === 0) {
    gmdStatus = { status: "empty", reason: "Sem animais ativos" };
  } else if (countGmdCalculated === activeAnimals.length) {
    gmdStatus = {
      status: "complete",
      reason: "GMD calculado para todos os animais",
      source: "GMD factual",
    };
  } else if (countGmdCalculated > 0) {
    gmdStatus = {
      status: "partial",
      reason: `${countGmdCalculated} de ${activeAnimals.length} animais com GMD`,
      source: "GMD factual",
      limitation: `${activeAnimals.length - countGmdCalculated} animais com dados insuficientes (exige ≥2 pesagens)`,
    };
  } else {
    gmdStatus = {
      status: "empty",
      reason: "Dados insuficientes para calcular GMD",
      source: "GMD factual",
      limitation: "Todos os animais têm menos de 2 pesagens registradas",
    };
  }

  // 3. ECC
  let sumEcc = 0;
  let countEccEvaluated = 0;
  const animaisSemEcc: string[] = [];

  const animalEccsMap = new Map<string, EventoEcc[]>();
  eccs.forEach((e) => {
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

  // 4. Lotação / Uso do Pasto
  let sumUsoDays = 0;
  let countWithPastoEntry = 0;

  const animalMovMap = new Map<string, EventoMovimentacao[]>();
  movimentacoes.forEach((m) => {
    const ev = validEvents.find((v) => v.id === m.evento_id);
    if (ev && ev.animal_id) {
      if (!animalMovMap.has(ev.animal_id)) {
        animalMovMap.set(ev.animal_id, []);
      }
      animalMovMap.get(ev.animal_id)!.push(m);
    }
  });

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

  const tempoUsoDias = countWithPastoEntry > 0 ? sumUsoDays / countWithPastoEntry : 0;
  let tempoLotacaoStatus: DataStatus = { status: "empty" };

  if (activeAnimals.length === 0) {
    tempoLotacaoStatus = {
      status: "empty",
      reason: "Sem animais ativos no pasto",
    };
  } else if (countWithPastoEntry === activeAnimals.length) {
    tempoLotacaoStatus = {
      status: "complete",
      reason: "Tempo de uso completo do pasto",
      source: "Movimentações factuais",
    };
  } else if (countWithPastoEntry > 0) {
    tempoLotacaoStatus = {
      status: "partial",
      reason: "Tempo de uso parcial (alguns animais sem movimentação de entrada)",
      source: "Movimentações factuais",
      limitation: `${activeAnimals.length - countWithPastoEntry} animais sem movimentação de entrada registrada`,
    };
  } else {
    tempoLotacaoStatus = {
      status: "partial",
      reason: "Tempo de uso desconhecido (todos os animais sem movimentação de entrada)",
      source: "Movimentações factuais",
      limitation: "Movimentação inicial ausente para todos os animais",
    };
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
  // Pasto: agenda aberta dos lotes do pasto + agenda aberta dos animais ativos desses lotes.
  // Ignorar agenda concluída, cancelada, deletada.
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

  const categoriaPredominante = getPredominantCategory(activeAnimals);

  return {
    pastoId,
    lotacaoAtual: activeAnimals.length,
    pesoMedio,
    pesoStatus,
    gmdMedio,
    gmdStatus,
    eccMedio,
    eccStatus,
    eccCobertura: { avaliados: countEccEvaluated, total: activeAnimals.length },
    animaisSemEcc,
    tempoUsoDias,
    tempoLotacaoStatus,
    ultimaMovimentacao,
    agendaItensAbertos,
    categoriaPredominante,
  };
}
