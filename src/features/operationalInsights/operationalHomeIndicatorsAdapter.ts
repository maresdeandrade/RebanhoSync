// src/features/operationalInsights/operationalHomeIndicatorsAdapter.ts

/**
 * Pure deterministic adapter to compute operational home indicators from factual data.
 * No direct IO (Dexie/Supabase) – all data is supplied via the input parameter.
 */
export interface FactualEvent {
  id: string;
  dominio: string;
  animal_id?: string | null;
  lote_id?: string | null;
  occurred_at: string;
  deleted_at?: string | null;
}

export interface FactualPesagem {
  evento_id: string;
  peso_kg: number;
  deleted_at?: string | null;
}

export interface FactualEcc {
  event_id: string;
  ecc: number;
  deleted_at?: string | null;
}

export interface FactualMovimentacao {
  evento_id: string;
  from_lote_id?: string | null;
  to_lote_id?: string | null;
  deleted_at?: string | null;
}

export interface FactualAgendaItem {
  id: string;
  dominio: string;
  tipo: string;
  status: string;
  data_prevista: string;
  animal_id?: string | null;
  lote_id?: string | null;
  deleted_at?: string | null;
}

export interface FactualAnimal {
  id: string;
  identificacao: string;
  lote_id?: string | null;
  status: string; // 'ativo' | 'morto' | 'vendido'
  deleted_at?: string | null;
}

export interface FactualLote {
  id: string;
  nome: string;
  deleted_at?: string | null;
}

export interface FactualPasto {
  id: string;
  nome: string;
  deleted_at?: string | null;
}

export interface HomeIndicatorsInput {
  referenceDate: string; // YYYY-MM-DD
  animals: readonly FactualAnimal[];
  lotes: readonly FactualLote[];
  pastos: readonly FactualPasto[];
  agenda: readonly FactualAgendaItem[];
  events: readonly FactualEvent[];
  pesagens: readonly FactualPesagem[];
  eccs: readonly FactualEcc[];
  movimentacoes: readonly FactualMovimentacao[];
  weightFreshnessDays?: number; // optional configuration
}

export type IndicatorStatus = 'completo' | 'parcial' | 'vazio' | 'bloqueado';

export interface HomeIndicatorsResult {
  agenda: {
    status: IndicatorStatus;
    totalOpen: number;
    overdue: number;
    dueToday: number;
    upcoming: number;
    limitation?: string;
  };
  ecc: {
    status: IndicatorStatus;
    coberturaAtiva: { evaluated: number; total: number; percentage: number };
    eccMedioGlobal: number;
    lotesComMenorCobertura: { loteId: string; nome: string; evaluated: number; total: number; percentage: number; eccMedio: number }[];
    lotesSemEcc: { loteId: string; nome: string }[];
    animaisSemEccCount: number;
    animaisSemEccList: { id: string; identificacao: string }[];
    limitation?: string;
  };
  gmd: {
    status: IndicatorStatus;
    lotesComGmd: { loteId: string; nome: string; gmdMedio: number; animaisCount: number }[];
    lotesSemPesagemSuficiente: { loteId: string; nome: string; reason: string }[];
    animaisComApenasUmaPesagemCount: number;
    limitation?: string;
  };
  lotacao: {
    status: IndicatorStatus;
    lotePermanencia: { loteId: string; nome: string; permanenciaMediaDias: number; ultimaMovimentacao?: string | null; isPartial: boolean }[];
    limitation?: string;
  };
  sanitario: {
    status: IndicatorStatus;
    totalOpen: number;
    overdue: number;
    dueToday: number;
    upcoming: number;
    limitation?: string;
  };
  pesoConfiavel: {
    status: IndicatorStatus;
    classification: 'confiavel' | 'parcial' | 'bloqueado' | 'sem_dado';
    label: string;
    coberturaAtiva: { evaluated: number; total: number; percentage: number };
    pesoMedioGlobal: number;
    animaisConfiaveisCount: number;
    animaisDesatualizadosCount: number;
    animaisSemPesagemCount: number;
    lotesBaixaCobertura: { loteId: string; nome: string; percentage: number }[];
    lotePesoMedioConfiavel: Record<string, number>;
    limitation?: string;
  };
}

/**
 * Helper to safely parse a date string (ISO) and return a Date object.
 */
function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Compute agenda indicators.
 */
function computeAgenda(input: HomeIndicatorsInput) {
  const today = input.referenceDate;
  const openItems = input.agenda.filter(i => i.status === 'agendado' && !i.deleted_at);
  const overdue = openItems.filter(i => i.data_prevista < today).length;
  const dueToday = openItems.filter(i => i.data_prevista === today).length;
  const upcoming = openItems.filter(i => i.data_prevista > today).length;
  const totalOpen = openItems.length;
  const status: IndicatorStatus = totalOpen === 0 ? 'vazio' : 'completo';
  return { status, totalOpen, overdue, dueToday, upcoming };
}

/**
 * Compute ECC indicators respecting the business rules.
 */
function computeEcc(input: HomeIndicatorsInput) {
  // filter active animals (exclude morto/vendido and soft‑deleted)
  const activeAnimals = input.animals.filter(a => a.status === 'ativo' && !a.deleted_at);
  const totalAnimals = activeAnimals.length;

  // map animalId -> latest ECC (by event occurrence)
  const eccByAnimal: Record<string, FactualEcc> = {};
  for (const ecc of input.eccs) {
    if (ecc.deleted_at) continue;
    const evt = input.events.find(e => e.id === ecc.event_id);
    if (!evt) continue;
    const animalId = evt.animal_id;
    if (!animalId) continue;
    const existing = eccByAnimal[animalId];
    if (!existing) {
      eccByAnimal[animalId] = ecc;
    } else {
      const existingEvt = input.events.find(e => e.id === existing.event_id);
      if (existingEvt && evt.occurred_at > existingEvt.occurred_at) {
        eccByAnimal[animalId] = ecc;
      }
    }
  }

  const evaluated = Object.keys(eccByAnimal).length;
  const coberturaAtiva = {
    evaluated,
    total: totalAnimals,
    percentage: totalAnimals === 0 ? 0 : Math.round((evaluated / totalAnimals) * 100),
  };

  const eccValues = Object.values(eccByAnimal).map(e => e.ecc);
  const eccMedioGlobal = eccValues.length ? Number((eccValues.reduce((a,b)=>a+b,0) / eccValues.length).toFixed(2)) : 0;

  // animais sem ECC
  const animaisSemEcc = activeAnimals.filter(a => !(a.id in eccByAnimal));
  const animaisSemEccCount = animaisSemEcc.length;
  const animaisSemEccList = animaisSemEcc.map(a => ({ id: a.id, identificacao: a.identificacao }));

  // lotes com menor cobertura
  const lotesMap = new Map<string, { evaluated: number; total: number; eccSum: number; nome: string }>();
  for (const lote of input.lotes) {
    lotesMap.set(lote.id, { evaluated: 0, total: 0, eccSum: 0, nome: lote.nome });
  }
  for (const animal of activeAnimals) {
    if (animal.lote_id && lotesMap.has(animal.lote_id)) {
      const entry = lotesMap.get(animal.lote_id)!;
      entry.total += 1;
      if (eccByAnimal[animal.id]) {
        entry.evaluated += 1;
        entry.eccSum += eccByAnimal[animal.id].ecc;
      }
    }
  }
  const lotesComMenorCobertura = Array.from(lotesMap.entries())
    .filter(([, v]) => v.total > 0)
    .map(([id, v]) => ({
      loteId: id,
      nome: v.nome,
      evaluated: v.evaluated,
      total: v.total,
      percentage: Math.round((v.evaluated / v.total) * 100),
      eccMedio: v.evaluated ? Number((v.eccSum / v.evaluated).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5);

  const lotesSemEcc = Array.from(lotesMap.entries())
    .filter(([, v]) => v.evaluated === 0 && v.total > 0)
    .map(([id, v]) => ({ loteId: id, nome: v.nome }));

  const status: IndicatorStatus = totalAnimals === 0 ? 'vazio' : 'completo';
  return { status, coberturaAtiva, eccMedioGlobal, lotesComMenorCobertura, lotesSemEcc, animaisSemEccCount, animaisSemEccList };
}

/**
 * Compute GMD (weight gain) indicators.
 */
function computeGmd(input: HomeIndicatorsInput) {
  // group pesagens by animal
  const pesagensByAnimal: Record<string, FactualPesagem[]> = {};
  for (const p of input.pesagens) {
    if (p.deleted_at) continue;
    const evt = input.events.find(e => e.id === p.evento_id);
    if (!evt) continue;
    const animalId = evt.animal_id;
    if (!animalId) continue;
    if (!pesagensByAnimal[animalId]) pesagensByAnimal[animalId] = [];
    pesagensByAnimal[animalId].push(p);
  }

  // Only consider animals with >=2 valid pesagens
  const lotesMap = new Map<string, { gmdSum: number; animaisCount: number; nome: string }>();
  for (const lote of input.lotes) lotesMap.set(lote.id, { gmdSum: 0, animaisCount: 0, nome: lote.nome });

  const lotesSemPesagemSuficiente: { loteId: string; nome: string; reason: string }[] = [];
  let animaisComApenasUmaPesagemCount = 0;

  for (const animal of input.animals) {
    if (animal.status !== 'ativo' || animal.deleted_at) continue;
    const pesagens = pesagensByAnimal[animal.id] ?? [];
    if (pesagens.length < 2) {
      if (pesagens.length === 1) animaisComApenasUmaPesagemCount++;
      // add to lote missing info if animal belongs to a lote
      if (animal.lote_id && lotesMap.has(animal.lote_id)) {
        const loteEntry = lotesMap.get(animal.lote_id)!;
        // note that this lote has insufficient data via later processing
      }
      continue;
    }
    // Sort by occurrence date to compute simple gain
    const sorted = pesagens
      .map(p => {
        const ev = input.events.find(e => e.id === p.evento_id)!;
        return { date: ev.occurred_at, peso: p.peso_kg };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].peso;
    const last = sorted[sorted.length - 1].peso;
    const gain = last - first;
    const loteId = animal.lote_id;
    if (loteId && lotesMap.has(loteId)) {
      const entry = lotesMap.get(loteId)!;
      entry.gmdSum += gain;
      entry.animaisCount += 1;
    }
  }

  const lotesComGmd = Array.from(lotesMap.entries())
    .filter(([, v]) => v.animaisCount > 0)
    .map(([id, v]) => ({ loteId: id, nome: v.nome, gmdMedio: Number((v.gmdSum / v.animaisCount).toFixed(2)), animaisCount: v.animaisCount }));

  // Identify lotes with insufficient pesagens
  for (const lote of input.lotes) {
    const entry = lotesMap.get(lote.id)!;
    if (entry.animaisCount === 0) {
      lotesSemPesagemSuficiente.push({ loteId: lote.id, nome: lote.nome, reason: 'Nenhuma pesagem suficiente' });
    }
  }

  const status: IndicatorStatus = lotesComGmd.length ? 'completo' : 'bloqueado';
  return { status, lotesComGmd, lotesSemPesagemSuficiente, animaisComApenasUmaPesagemCount };
}

/**
 * Compute lotação (permanence) indicators.
 */
function computeLotacao(input: HomeIndicatorsInput) {
  const lotesMap = new Map<string, { eventos: FactualMovimentacao[]; nome: string }>();
  for (const lote of input.lotes) lotesMap.set(lote.id, { eventos: [], nome: lote.nome });
  for (const mov of input.movimentacoes) {
    if (mov.deleted_at) continue;
    // consider both origins and destinations to compute permanence per lote
    if (mov.from_lote_id && lotesMap.has(mov.from_lote_id)) {
      lotesMap.get(mov.from_lote_id)!.eventos.push(mov);
    }
    if (mov.to_lote_id && lotesMap.has(mov.to_lote_id)) {
      lotesMap.get(mov.to_lote_id)!.eventos.push(mov);
    }
  }

  const lotePermanencia = Array.from(lotesMap.entries()).map(([id, v]) => {
    const dates = v.eventos.map(m => {
      const evt = input.events.find(e => e.id === m.evento_id);
      return evt?.occurred_at ?? null;
    }).filter((d): d is string => d !== null);
    if (dates.length === 0) {
      return { loteId: id, nome: v.nome, permanenciaMediaDias: 0, ultimaMovimentacao: null, isPartial: true };
    }
    const sorted = dates.sort();
    const first = parseDate(sorted[0])!;
    const last = parseDate(sorted[sorted.length - 1])!;
    const diffDays = Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    return { loteId: id, nome: v.nome, permanenciaMediaDias: diffDays, ultimaMovimentacao: sorted[sorted.length - 1], isPartial: false };
  });

  const status: IndicatorStatus = lotePermanencia.length ? 'completo' : 'vazio';
  return { status, lotePermanencia };
}

/**
 * Compute peso confiável indicators.
 */
function computePesoConfiavel(input: HomeIndicatorsInput) {
  const today = parseDate(input.referenceDate);
  if (!today) return { status: 'bloqueado' as IndicatorStatus, classification: 'sem_dado' as const, label: 'Data inválida', coberturaAtiva: { evaluated: 0, total: 0, percentage: 0 }, pesoMedioGlobal: 0, animaisConfiaveisCount: 0, animaisDesatualizadosCount: 0, animaisSemPesagemCount: 0, lotesBaixaCobertura: [], lotePesoMedioConfiavel: {} };

  const weightFreshnessDays = input.weightFreshnessDays ?? null;

  // Map animalId -> latest pesagem (by event date)
  const latestPesagemByAnimal: Record<string, { peso: number; date: Date }> = {};
  for (const p of input.pesagens) {
    if (p.deleted_at) continue;
    const ev = input.events.find(e => e.id === p.evento_id);
    if (!ev) continue;
    const animalId = ev.animal_id;
    if (!animalId) continue;
    const evDate = parseDate(ev.occurred_at);
    if (!evDate) continue;
    const existing = latestPesagemByAnimal[animalId];
    if (!existing || evDate > existing.date) {
      latestPesagemByAnimal[animalId] = { peso: p.peso_kg, date: evDate };
    }
  }

  const activeAnimals = input.animals.filter(a => a.status === 'ativo' && !a.deleted_at);
  const totalAnimals = activeAnimals.length;

  let evaluated = 0;
  let pesoSum = 0;
  let animaisConfiaveisCount = 0;
  let animaisDesatualizadosCount = 0;
  let animaisSemPesagemCount = 0;
  const lotesCobertura: Record<string, { evaluated: number; total: number; pesoSum: number }> = {};

  for (const animal of activeAnimals) {
    const loteId = animal.lote_id ?? '__no_lote__';
    if (!lotesCobertura[loteId]) lotesCobertura[loteId] = { evaluated: 0, total: 0, pesoSum: 0 };
    lotesCobertura[loteId].total += 1;

    const latest = latestPesagemByAnimal[animal.id];
    if (!latest) {
      animaisSemPesagemCount++;
      continue;
    }
    const daysDiff = Math.round((today.getTime() - latest.date.getTime()) / (1000 * 60 * 60 * 24));
    if (weightFreshnessDays === null) {
      // configuration missing – treat as parcial for the whole indicator
      animaisDesatualizadosCount++;
    } else if (daysDiff <= weightFreshnessDays) {
      // recent
      evaluated++;
      pesoSum += latest.peso;
      animaisConfiaveisCount++;
      lotesCobertura[loteId].evaluated += 1;
      lotesCobertura[loteId].pesoSum += latest.peso;
    } else {
      animaisDesatualizadosCount++;
    }
  }

  const coverage = totalAnimals === 0 ? 0 : Math.round((evaluated / totalAnimals) * 100);
  const pesoMedioGlobal = evaluated ? Number((pesoSum / evaluated).toFixed(2)) : 0;

  const lotesBaixaCobertura = Object.entries(lotesCobertura)
    .filter(([, v]) => v.total > 0)
    .map(([id, v]) => ({ loteId: id, nome: id === '__no_lote__' ? 'Sem lote' : input.lotes.find(l => l.id === id)?.nome ?? '???', percentage: Math.round((v.evaluated / v.total) * 100) }))
    .filter(l => l.percentage < 80)
    .sort((a, b) => a.percentage - b.percentage);

  const lotePesoMedioConfiavel: Record<string, number> = {};
  for (const [id, v] of Object.entries(lotesCobertura)) {
    if (v.evaluated) {
      lotePesoMedioConfiavel[id] = Number((v.pesoSum / v.evaluated).toFixed(2));
    }
  }

  let status: IndicatorStatus = 'completo';
  let classification: 'confiavel' | 'parcial' | 'bloqueado' | 'sem_dado' = 'confiavel';
  let label = 'Peso atual confiável';
  if (weightFreshnessDays === null) {
    classification = 'parcial';
    label = 'Último peso registrado';
    status = 'parcial';
  } else if (evaluated === 0) {
    classification = 'sem_dado';
    status = 'vazio';
  }

  return {
    status,
    classification,
    label,
    coberturaAtiva: { evaluated, total: totalAnimals, percentage: coverage },
    pesoMedioGlobal,
    animaisConfiaveisCount,
    animaisDesatualizadosCount,
    animaisSemPesagemCount,
    lotesBaixaCobertura,
    lotePesoMedioConfiavel,
    limitation: undefined,
  };
}

/**
 * Compute sanitary indicators.
 */
function computeSanitario(input: HomeIndicatorsInput) {
  const today = input.referenceDate;
  const openSanitario = input.agenda.filter(i => i.status === 'agendado' && !i.deleted_at && i.dominio === 'sanitario');
  const overdue = openSanitario.filter(i => i.data_prevista < today).length;
  const dueToday = openSanitario.filter(i => i.data_prevista === today).length;
  const upcoming = openSanitario.filter(i => i.data_prevista > today).length;
  const totalOpen = openSanitario.length;
  const status: IndicatorStatus = totalOpen === 0 ? 'vazio' : 'completo';
  return { status, totalOpen, overdue, dueToday, upcoming };
}

/**
 * Main exported function – orchestrates all sub‑calculators.
 */
export function computeHomeIndicators(input: HomeIndicatorsInput): HomeIndicatorsResult {
  return {
    agenda: computeAgenda(input),
    ecc: computeEcc(input),
    gmd: computeGmd(input),
    lotacao: computeLotacao(input),
    sanitario: computeSanitario(input),
    pesoConfiavel: computePesoConfiavel(input),
  } as HomeIndicatorsResult;
}
