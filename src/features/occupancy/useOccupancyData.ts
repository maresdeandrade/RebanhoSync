// src/features/occupancy/useOccupancyData.ts

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@/lib/offline/db";
import type { Evento, EventoMovimentacao, EventoPesagem, EventoEcc, Animal, Lote, Pasto, PastoOcupacao } from "@/lib/offline/types";
import { buildAnimalOccupancyTimeline } from "./buildAnimalOccupancyTimeline";
import { buildWeightGainForOccupancy } from "./buildWeightGainForOccupancy";
import { buildEccMetricsForOccupancy } from "./buildEccMetricsForOccupancy";
import { buildLoteOccupancyMetrics } from "./buildLoteOccupancyMetrics";
import { buildPastoOccupancyMetrics } from "./buildPastoOccupancyMetrics";
import { getLatestValidEcc } from "./eccHelpers";
import { getCategoriaAtual } from "@/lib/animals/categoriaHelper";
import type { AnimalOccupancyPeriod, LoteOccupancyMetrics, PastoOccupancyMetrics } from "./occupancyTypes";

function getPredominantCategory(animals: Animal[]): string {
  if (animals.length === 0) return "Categoria desconhecida";
  const counts = new Map<string, number>();
  for (const animal of animals) {
    const cat = getCategoriaAtual(animal);
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  let predominant = "Categoria desconhecida";
  let max = 0;
  for (const [cat, count] of counts.entries()) {
    if (count > max) {
      max = count;
      predominant = cat;
    }
  }
  return predominant;
}

export function useOccupancyData(fazendaId: string, referenceDate: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allEvents = useLiveQuery(
    () => db.event_eventos.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allMovimentacoes = useLiveQuery(
    () => db.event_eventos_movimentacao.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allPesagens = useLiveQuery(
    () => db.event_eventos_pesagem.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allEccs = useLiveQuery(
    () => db.event_eventos_ecc.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allAnimals = useLiveQuery(
    () => db.state_animais.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  const allLotes = useLiveQuery(
    () => db.state_lotes.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  const allPastos = useLiveQuery(
    () => db.state_pastos.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  const allPastoOcupacoes = useLiveQuery(
    () => db.state_pasto_ocupacoes.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  const movimentacoesMap = useMemo(() => {
    return new Map<string, EventoMovimentacao>(
      allMovimentacoes.map((m) => [m.evento_id, m]),
    );
  }, [allMovimentacoes]);

  const pesagensMap = useMemo(() => {
    return new Map<string, EventoPesagem>(
      allPesagens.map((p) => [p.evento_id, p]),
    );
  }, [allPesagens]);

  const eccsMap = useMemo(() => {
    return new Map<string, EventoEcc>(
      allEccs.map((e) => [e.event_id, e]),
    );
  }, [allEccs]);

  const allEventsMap = useMemo(() => {
    return new Map<string, Evento>(
      allEvents.map((e) => [e.id, e]),
    );
  }, [allEvents]);

  const animalsMap = useMemo(() => {
    return new Map<string, Animal>(
      allAnimals.map((a) => [a.id, a]),
    );
  }, [allAnimals]);

  const latestEccsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const animal of allAnimals) {
      const latestEcc = getLatestValidEcc(animal.id, allEccs, allEventsMap);
      if (latestEcc) {
        map.set(animal.id, latestEcc.ecc);
      }
    }
    return map;
  }, [allAnimals, allEccs, allEventsMap]);

  const allAnimalPeriods = useMemo(() => {
    const animalIds = Array.from(new Set(allEvents.map(e => e.animal_id).filter(Boolean))) as string[];
    let periods: AnimalOccupancyPeriod[] = [];

    for (const animalId of animalIds) {
      const animalEvents = allEvents.filter(e => e.animal_id === animalId);
      let animalTimeline = buildAnimalOccupancyTimeline({
        animalId,
        events: animalEvents,
        movimentacoes: movimentacoesMap,
        referenceDate,
      });

      animalTimeline = animalTimeline.map(period => {
        const periodWithWeight = buildWeightGainForOccupancy({
          period,
          events: animalEvents,
          pesagens: pesagensMap,
        });
        return buildEccMetricsForOccupancy({
          period: periodWithWeight,
          events: animalEvents,
          eccs: eccsMap,
        });
      });
      periods = periods.concat(animalTimeline);
    }
    return periods;
  }, [allEvents, movimentacoesMap, pesagensMap, eccsMap, referenceDate]);

  const getLoteMetrics = (loteId: string): LoteOccupancyMetrics | null => {
    const activeAnimals = allAnimals.filter(
      (a) => a.lote_id === loteId && a.status !== "vendido" && a.status !== "morto"
    );

    // Encontrar última movimentação que tocou este lote
    const loteEvents = allEvents.filter(
      (e) => e.lote_id === loteId && e.dominio === "movimentacao" && !e.deleted_at
    );
    const lastMovementDate = loteEvents.reduce(
      (latest, e) => (!latest || e.occurred_at > latest ? e.occurred_at : latest),
      null as string | null
    );

    const categoriaPredominante = getPredominantCategory(activeAnimals);

    return buildLoteOccupancyMetrics({
      loteId,
      animalPeriods: allAnimalPeriods,
      totalAnimalsInLote: activeAnimals.length,
      activeAnimals,
      latestEccsMap,
      lastMovementDate,
      categoriaPredominante,
    });
  };

  const getPastoMetrics = (pastoId: string): PastoOccupancyMetrics | null => {
    const lotesInPasto = allLotes.filter((l) => l.pasto_id === pastoId);
    const loteIds = lotesInPasto.map((l) => l.id);

    const activeAnimals = allAnimals.filter(
      (a) => a.lote_id && loteIds.includes(a.lote_id) && a.status !== "vendido" && a.status !== "morto"
    );

    // Encontrar última movimentação que tocou este pasto
    const pastoEvents = allEvents.filter((e) => {
      if (e.dominio !== "movimentacao" || e.deleted_at) return false;
      const mov = movimentacoesMap.get(e.id);
      return mov && mov.to_pasto_id === pastoId;
    });
    const lastMovementDate = pastoEvents.reduce(
      (latest, e) => (!latest || e.occurred_at > latest ? e.occurred_at : latest),
      null as string | null
    );

    const categoriaPredominante = getPredominantCategory(activeAnimals);
    const pastoObj = allPastos.find(p => p.id === pastoId);
    const areaHa = pastoObj?.area_ha;

    return buildPastoOccupancyMetrics({
      pastoId,
      animalPeriods: allAnimalPeriods,
      activeAnimals,
      latestEccsMap,
      lastMovementDate,
      categoriaPredominante,
      areaHa,
    });
  };

  return {
    allAnimalPeriods,
    getLoteMetrics,
    getPastoMetrics,
    animalsMap,
    latestEccsMap,
    allPastoOcupacoes,
  };
}
