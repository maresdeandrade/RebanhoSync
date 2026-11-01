import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { requireTenantSensitiveRead } from "@/lib/offline/localReadBoundary";
import {
  computeAnimalWithdrawal,
  computeLoteWithdrawal,
  type WithdrawalReadModel,
  type SanitaryEventInputForReadModel,
} from "../compliance/withdrawalReadModel";

function inventorySnapshot(
  value: unknown,
): NonNullable<SanitaryEventInputForReadModel["payload"]>["insumo_snapshot"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const type = v.produto_tipo_snapshot,
    trace = v.rastreabilidade;
  if (
    typeof v.produto_nome_snapshot !== "string" ||
    (type !== null &&
      type !== "sanitario" &&
      type !== "nutricional" &&
      type !== "outro") ||
    (trace !== "manual" && trace !== "parcial" && trace !== "completo")
  )
    return null;
  return {
    produto_nome_snapshot: v.produto_nome_snapshot,
    produto_tipo_snapshot: type === "sanitario" ? type : type === "nutricional" ? type : type === "outro" ? type : null,
    rastreabilidade: trace,
    principio_ativo_snapshot:
      typeof v.principio_ativo_snapshot === "string"
        ? v.principio_ativo_snapshot
        : null,
    carencia_carne_dias_snapshot:
      typeof v.carencia_carne_dias_snapshot === "number"
        ? v.carencia_carne_dias_snapshot
        : null,
    carencia_leite_dias_snapshot:
      typeof v.carencia_leite_dias_snapshot === "number"
        ? v.carencia_leite_dias_snapshot
        : null,
    limitacoes: Array.isArray(v.limitacoes)
      ? v.limitacoes.filter((x): x is string => typeof x === "string")
      : [],
  };
}

// Canonical relations define group membership; legacy single-animal facts keep
// their original fallback. Copies only adapt the read model, never persisted.
async function readAnimalSanitaryEvents(farmId: string, animalIds: string[]) {
  const relations = await db.event_eventos_animais
    .where("[fazenda_id+animal_id]")
    .anyOf(animalIds.map((id) => [farmId, id]))
    .toArray();
  const [legacy, related] = await Promise.all([
    db.event_eventos.where("animal_id").anyOf(animalIds).toArray(),
    db.event_eventos.bulkGet([...new Set(relations.map((r) => r.evento_id))]),
  ]);
  const events = new Map(
    [...legacy, ...related]
      .filter(
        (e) =>
          e &&
          e.fazenda_id === farmId &&
          e.dominio === "sanitario" &&
          !e.deleted_at &&
          (e.sanitario_v3_confirmation == null ||
            e.sanitario_v3_confirmation === "confirmed"),
      )
      .map((e) => [e!.id, e!]),
  );
  return [...events.values()].flatMap((event) => {
    const ids = relations
      .filter((r) => r.evento_id === event.id)
      .map((r) => r.animal_id);
    return [
      ...new Set(ids.length ? ids : event.animal_id ? [event.animal_id] : []),
    ].map((animal_id) => ({ ...event, animal_id }));
  });
}

/**
 * Hook reativa offline para ler a carencia sanitaria assistiva de um Animal.
 */
export function useAnimalWithdrawal(
  animalId: string | null,
  activeFarmId: string | null,
) {
  return useLiveQuery(async () => {
    if (!animalId || !activeFarmId) return null;
    await requireTenantSensitiveRead();

    // 1. Busca todos os eventos do animal no Dexie
    const baseEvents = await readAnimalSanitaryEvents(activeFarmId, [animalId]);

    // Filtra apenas eventos sanitarios nao deletados da fazenda ativa
    const activeSanitarioEvents = baseEvents.filter(
      (e) =>
        e.dominio === "sanitario" &&
        !e.deleted_at &&
        e.fazenda_id === activeFarmId,
    );

    if (activeSanitarioEvents.length === 0) {
      return computeAnimalWithdrawal(animalId, [], getTodayNominalStr());
    }

    // 2. Busca os detalhes correspondentes em eventos_sanitario
    const eventIds = activeSanitarioEvents.map((e) => e.id);
    const details = await db.event_eventos_sanitario
      .where("evento_id")
      .anyOf(eventIds)
      .toArray();

    const detailMap = new Map(details.map((d) => [d.evento_id, d]));

    // 3. Mescla em objetos SanitaryEventInputForReadModel
    const eventsCombined: SanitaryEventInputForReadModel[] =
      activeSanitarioEvents.map((e) => {
        const d = detailMap.get(e.id);
        return {
          id: e.id,
          sanitario_v3_confirmation: e.sanitario_v3_confirmation,
          animal_id: e.animal_id,
          lote_id: e.lote_id,
          occurred_at: e.occurred_at,
          deleted_at: e.deleted_at,
          produto: d ? d.produto : "",
          carencia_carne_dias: d?.carencia_carne_dias ?? null,
          carencia_leite_dias: d?.carencia_leite_dias ?? null,
          carencia_carne_ate: d?.carencia_carne_ate ?? null,
          carencia_leite_ate: d?.carencia_leite_ate ?? null,
          payload: d
            ? {
                insumo_snapshot: inventorySnapshot(d.payload?.insumo_snapshot),
                carencia_regra_json: d.payload?.carencia_regra_json,
              }
            : null,
        };
      });

    return computeAnimalWithdrawal(
      animalId,
      eventsCombined,
      getTodayNominalStr(),
    );
  }, [animalId, activeFarmId]);
}

/**
 * Hook reativa offline para ler a carencia sanitaria assistiva combinada de um Lote.
 */
export function useLoteWithdrawal(
  loteId: string | null,
  activeFarmId: string | null,
) {
  return useLiveQuery(async () => {
    if (!loteId || !activeFarmId) return null;
    await requireTenantSensitiveRead();

    // 1. Busca animais ativos atualmente vinculados a este lote
    // Exclui sumariamente animais mortos ou vendidos (regra 9 e 11)
    const animais = await db.state_animais
      .where("lote_id")
      .equals(loteId)
      .toArray();

    const activeAnimais = animais.filter(
      (a) =>
        !a.deleted_at && a.status === "ativo" && a.fazenda_id === activeFarmId,
    );

    if (activeAnimais.length === 0) {
      return computeLoteWithdrawal(loteId, []);
    }

    const animalIds = activeAnimais.map((a) => a.id);

    // 2. Busca todos os eventos sanitarios associados a esses animais ativos
    // Fazemos uma busca indexada por animal_id
    const baseEvents = await readAnimalSanitaryEvents(activeFarmId, animalIds);

    const activeSanSanEvents = baseEvents.filter(
      (e) =>
        e.dominio === "sanitario" &&
        !e.deleted_at &&
        e.fazenda_id === activeFarmId,
    );

    // 3. Busca detalhes dos eventos sanitarios dos animais
    const eventIds = activeSanSanEvents.map((e) => e.id);
    const details = await db.event_eventos_sanitario
      .where("evento_id")
      .anyOf(eventIds)
      .toArray();

    const detailMap = new Map(details.map((d) => [d.evento_id, d]));

    // 4. Cria o map de eventos por animal
    const eventsByAnimal = new Map<string, SanitaryEventInputForReadModel[]>();
    for (const e of activeSanSanEvents) {
      if (!e.animal_id) continue;
      const d = detailMap.get(e.id);
      const combined: SanitaryEventInputForReadModel = {
        id: e.id,
        sanitario_v3_confirmation: e.sanitario_v3_confirmation,
        animal_id: e.animal_id,
        lote_id: e.lote_id,
        occurred_at: e.occurred_at,
        deleted_at: e.deleted_at,
        produto: d ? d.produto : "",
        carencia_carne_dias: d?.carencia_carne_dias ?? null,
        carencia_leite_dias: d?.carencia_leite_dias ?? null,
        carencia_carne_ate: d?.carencia_carne_ate ?? null,
        carencia_leite_ate: d?.carencia_leite_ate ?? null,
        payload: d
          ? {
              insumo_snapshot: inventorySnapshot(d.payload?.insumo_snapshot),
              carencia_regra_json: d.payload?.carencia_regra_json,
            }
          : null,
      };

      if (!eventsByAnimal.has(e.animal_id)) {
        eventsByAnimal.set(e.animal_id, []);
      }
      eventsByAnimal.get(e.animal_id)!.push(combined);
    }

    const todayStr = getTodayNominalStr();

    // 5. Computa o read model individual para cada animal ativo do lote
    const animalReadModels: WithdrawalReadModel[] = activeAnimais.map((a) => {
      const animalEvents = eventsByAnimal.get(a.id) || [];
      return computeAnimalWithdrawal(a.id, animalEvents, todayStr);
    });

    // 6. Busca eventos sanitarios aplicados diretamente ao lote inteiro
    const baseLoteEvents = await db.event_eventos
      .where("lote_id")
      .equals(loteId)
      .toArray();

    const activeLoteSanEvents = baseLoteEvents.filter(
      (e) =>
        e.dominio === "sanitario" &&
        !e.deleted_at &&
        e.fazenda_id === activeFarmId &&
        !e.animal_id, // eventos diretos de lote, nao vinculados a animais individuais
    );

    if (activeLoteSanEvents.length > 0) {
      const scopedRelations = await db.event_eventos_animais
        .where("evento_id")
        .anyOf(activeLoteSanEvents.map((e) => e.id))
        .toArray();
      const groupedIds = new Set(
        scopedRelations
          .filter((r) => r.fazenda_id === activeFarmId)
          .map((r) => r.evento_id),
      );
      const loteEventIds = activeLoteSanEvents.map((e) => e.id);
      const loteDetails = await db.event_eventos_sanitario
        .where("evento_id")
        .anyOf(loteEventIds)
        .toArray();

      const loteDetailMap = new Map(loteDetails.map((d) => [d.evento_id, d]));

      // Para cada evento direto no lote, criamos um "animal virtual" para agregar no lote
      for (const e of activeLoteSanEvents) {
        if (
          groupedIds.has(e.id) ||
          (e.sanitario_v3_confirmation != null &&
            e.sanitario_v3_confirmation !== "confirmed")
        )
          continue;
        const d = loteDetailMap.get(e.id);
        const combined: SanitaryEventInputForReadModel = {
          id: e.id,
          sanitario_v3_confirmation: e.sanitario_v3_confirmation,
          animal_id: "lote-direct",
          lote_id: loteId,
          occurred_at: e.occurred_at,
          deleted_at: e.deleted_at,
          produto: d ? d.produto : "",
          carencia_carne_dias: d?.carencia_carne_dias ?? null,
          carencia_leite_dias: d?.carencia_leite_dias ?? null,
          carencia_carne_ate: d?.carencia_carne_ate ?? null,
          carencia_leite_ate: d?.carencia_leite_ate ?? null,
          payload: d
            ? {
                insumo_snapshot: inventorySnapshot(d.payload?.insumo_snapshot),
                carencia_regra_json: d.payload?.carencia_regra_json,
              }
            : null,
        };

        const directReadModel = computeAnimalWithdrawal(
          "lote-direct",
          [combined],
          todayStr,
        );
        animalReadModels.push(directReadModel);
      }
    }

    // 7. Agrega todos no calculo final do lote
    return computeLoteWithdrawal(loteId, animalReadModels);
  }, [loteId, activeFarmId]);
}

/**
 * Retorna a data nominal de hoje formatada em "YYYY-MM-DD" local/UTC compativel.
 */
function getTodayNominalStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Hook reativa offline para ler a carencia sanitaria assistiva combinada de um Pasto.
 * Agrega todos os animais ativos de todos os lotes que estao atualmente vinculados ao pasto (regra 9).
 */
export function usePastoWithdrawal(
  pastoId: string | null,
  activeFarmId: string | null,
) {
  return useLiveQuery(async () => {
    if (!pastoId || !activeFarmId) return null;
    await requireTenantSensitiveRead();

    // 1. Busca todos os lotes vinculados a este pasto no Dexie
    const lotes = await db.state_lotes
      .where("pasto_id")
      .equals(pastoId)
      .toArray();

    const activeLotes = lotes.filter(
      (l) => !l.deleted_at && l.fazenda_id === activeFarmId,
    );

    if (activeLotes.length === 0) {
      return computeLoteWithdrawal(pastoId, []);
    }

    const loteIds = activeLotes.map((l) => l.id);

    // 2. Busca todos os animais ativos vinculados a estes lotes
    // Exclui mortos ou vendidos de pasto ativo
    const animais = await db.state_animais
      .where("lote_id")
      .anyOf(loteIds)
      .toArray();

    const activeAnimais = animais.filter(
      (a) =>
        !a.deleted_at && a.status === "ativo" && a.fazenda_id === activeFarmId,
    );

    if (activeAnimais.length === 0) {
      return computeLoteWithdrawal(pastoId, []);
    }

    const animalIds = activeAnimais.map((a) => a.id);

    // 3. Busca todos os eventos sanitarios associados a esses animais
    const baseEvents = await readAnimalSanitaryEvents(activeFarmId, animalIds);

    const activeSanSanEvents = baseEvents.filter(
      (e) =>
        e.dominio === "sanitario" &&
        !e.deleted_at &&
        e.fazenda_id === activeFarmId,
    );

    // 4. Busca detalhes correspondentes
    const eventIds = activeSanSanEvents.map((e) => e.id);
    const details = await db.event_eventos_sanitario
      .where("evento_id")
      .anyOf(eventIds)
      .toArray();

    const detailMap = new Map(details.map((d) => [d.evento_id, d]));

    // 5. Agrupa eventos por animal
    const eventsByAnimal = new Map<string, SanitaryEventInputForReadModel[]>();
    for (const e of activeSanSanEvents) {
      if (!e.animal_id) continue;
      const d = detailMap.get(e.id);
      const combined: SanitaryEventInputForReadModel = {
        id: e.id,
        sanitario_v3_confirmation: e.sanitario_v3_confirmation,
        animal_id: e.animal_id,
        lote_id: e.lote_id,
        occurred_at: e.occurred_at,
        deleted_at: e.deleted_at,
        produto: d ? d.produto : "",
        carencia_carne_dias: d?.carencia_carne_dias ?? null,
        carencia_leite_dias: d?.carencia_leite_dias ?? null,
        carencia_carne_ate: d?.carencia_carne_ate ?? null,
        carencia_leite_ate: d?.carencia_leite_ate ?? null,
        payload: d
          ? {
              insumo_snapshot: inventorySnapshot(d.payload?.insumo_snapshot),
              carencia_regra_json: d.payload?.carencia_regra_json,
            }
          : null,
      };

      if (!eventsByAnimal.has(e.animal_id)) {
        eventsByAnimal.set(e.animal_id, []);
      }
      eventsByAnimal.get(e.animal_id)!.push(combined);
    }

    const todayStr = getTodayNominalStr();

    // 6. Calcula o read model para cada animal ativo
    const animalReadModels: WithdrawalReadModel[] = activeAnimais.map((a) => {
      const animalEvents = eventsByAnimal.get(a.id) || [];
      return computeAnimalWithdrawal(a.id, animalEvents, todayStr);
    });

    // 7. Agrega no calculo final do pasto como se fosse um super-lote
    return computeLoteWithdrawal(pastoId, animalReadModels);
  }, [pastoId, activeFarmId]);
}
