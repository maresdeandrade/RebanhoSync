import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@/lib/offline/db";
import type { Evento, EventoMovimentacao, EventoPesagem, EventoReproducao, Animal } from "@/lib/offline/types";
import { buildAnimalOccupancyTimeline } from "./buildAnimalOccupancyTimeline";
import { buildWeightGainForOccupancy } from "./buildWeightGainForOccupancy";
import { buildEccMetricsForOccupancy } from "./buildEccMetricsForOccupancy";
import { buildLoteOccupancyMetrics } from "./buildLoteOccupancyMetrics";
import { buildPastoOccupancyMetrics } from "./buildPastoOccupancyMetrics";
import type { AnimalOccupancyPeriod, LoteOccupancyMetrics, PastoOccupancyMetrics } from "./occupancyTypes";

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
  const allReproducoes = useLiveQuery(
    () => db.event_eventos_reproducao.where("fazenda_id").equals(fazendaId).toArray(),
    [fazendaId],
  ) || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allAnimals = useLiveQuery(
    () => db.state_animais.where("fazenda_id").equals(fazendaId).toArray(),
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

  const reproducoesMap = useMemo(() => {
    return new Map<string, EventoReproducao>(
      allReproducoes.map((r) => [r.evento_id, r]),
    );
  }, [allReproducoes]);

  const animalsMap = useMemo(() => {
    return new Map<string, Animal>(
      allAnimals.map((a) => [a.id, a]),
    );
  }, [allAnimals]);

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
          reproducoes: reproducoesMap,
        });
      });
      periods = periods.concat(animalTimeline);
    }
    return periods;
  }, [allEvents, movimentacoesMap, pesagensMap, reproducoesMap, referenceDate]);

  const getLoteMetrics = (loteId: string): LoteOccupancyMetrics | null => {
    const totalAnimalsInLote = allAnimals.filter(a => a.lote_id === loteId).length;
    return buildLoteOccupancyMetrics({
      loteId,
      animalPeriods: allAnimalPeriods,
      totalAnimalsInLote,
    });
  };

  const getPastoMetrics = (pastoId: string): PastoOccupancyMetrics | null => {
    return buildPastoOccupancyMetrics({
      pastoId,
      animalPeriods: allAnimalPeriods,
    });
  };

  return {
    allAnimalPeriods,
    getLoteMetrics,
    getPastoMetrics,
    animalsMap,
  };
}
