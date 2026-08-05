import type { ReproTipoEnum } from "@/lib/offline/types";
import { isPayloadV1, PUERPERIO_DAYS, type ReproStatus } from "./types";
import type { ReproEventJoined } from "./selectors";

export type { ReproStatus };

type LegacyDiagnosticPayload = {
  diagnostico_resultado?: unknown;
};

export type ReproductiveDppOrigin = "explicit" | "service_plus_283_days";
export type ReproductiveProjectionInconsistency =
  | "DIAGNOSIS_RESULT_INVALID"
  | "EPISODE_NOT_FOUND"
  | "EPISODE_ANIMAL_MISMATCH"
  | "EPISODE_FARM_MISMATCH"
  | "EPISODE_TYPE_INVALID"
  | "EPISODE_AFTER_DIAGNOSIS"
  | "EPISODE_NOT_CURRENT"
  | "PARTO_WITHOUT_EPISODE"
  | "PARTO_EPISODE_AFTER_BIRTH"
  | "ABORTO_WITHOUT_EPISODE"
  | "ABORTO_EPISODE_AFTER_LOSS"
  | "CORRECTION_CHAIN_BRANCH"
  | "CORRECTION_CHAIN_CYCLE"
  | "CORRECTION_CHAIN_INVALID"
  | "DPP_INVALID";

export interface ReproductiveProjectionEvent {
  id: string;
  fazenda_id: string;
  animal_id: string | null;
  occurred_at: string;
  corrige_evento_id?: string | null;
  payload?: Record<string, unknown>;
  deleted_at: string | null;
  details?: {
    tipo: ReproTipoEnum;
    payload: unknown;
    deleted_at?: string | null;
  };
}

const CORRECTABLE_TYPES = new Set<ReproTipoEnum>([
  "diagnostico",
  "parto",
  "aborto",
]);

function isReproductiveCorrection(event: ReproductiveProjectionEvent) {
  const value = event.payload?.reproduction_correction;
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).nature === "correction",
  );
}

function resolveEffectiveHistory(events: ReproductiveProjectionEvent[]) {
  const active = events.filter(
    (event) => !event.deleted_at && event.details && !event.details.deleted_at,
  );
  const byId = new Map(active.map((event) => [event.id, event]));
  const children = new Map<string, ReproductiveProjectionEvent[]>();
  let inconsistency: ReproductiveProjectionInconsistency | null = null;

  for (const event of active) {
    const correctedId = event.corrige_evento_id;
    if (!correctedId) continue;
    const corrected = byId.get(correctedId);
    if (
      !corrected ||
      !isReproductiveCorrection(event) ||
      corrected.fazenda_id !== event.fazenda_id ||
      corrected.animal_id !== event.animal_id ||
      !CORRECTABLE_TYPES.has(corrected.details!.tipo) ||
      corrected.details!.tipo !== event.details!.tipo
    ) {
      inconsistency = "CORRECTION_CHAIN_INVALID";
      continue;
    }
    const directChildren = children.get(correctedId) ?? [];
    directChildren.push(event);
    children.set(correctedId, directChildren);
  }

  for (const event of active) {
    const visited = new Set<string>();
    let current: ReproductiveProjectionEvent | undefined = event;
    while (current?.corrige_evento_id) {
      if (visited.has(current.id)) {
        inconsistency = "CORRECTION_CHAIN_CYCLE";
        break;
      }
      visited.add(current.id);
      current = byId.get(current.corrige_evento_id);
    }
  }

  const roots = active.filter((event) => !event.corrige_evento_id);
  const effective: ReproductiveProjectionEvent[] = [];
  for (const root of roots) {
    let current = root;
    const visited = new Set([root.id]);
    while (true) {
      const directChildren = children.get(current.id) ?? [];
      if (directChildren.length > 1) {
        inconsistency = "CORRECTION_CHAIN_BRANCH";
        break;
      }
      const child = directChildren[0];
      if (!child) break;
      if (visited.has(child.id)) {
        inconsistency = "CORRECTION_CHAIN_CYCLE";
        break;
      }
      visited.add(child.id);
      current = child;
    }
    effective.push(current);
  }

  const reachable = new Set<string>();
  for (const root of roots) {
    const pending = [root];
    while (pending.length) {
      const current = pending.pop()!;
      if (reachable.has(current.id)) continue;
      reachable.add(current.id);
      pending.push(...(children.get(current.id) ?? []));
    }
  }
  if (active.some((event) => !reachable.has(event.id))) {
    inconsistency ??= "CORRECTION_CHAIN_INVALID";
  }

  return { events: effective, inconsistency };
}

export interface ReproductiveProjection {
  status: ReproStatus;
  currentEpisodeId: string | null;
  lastDiagnosisEventId: string | null;
  diagnosedEpisodeId: string | null;
  dpp: string | null;
  dppOrigin: ReproductiveDppOrigin | null;
  lastBirthDate: string | null;
  lastLossDate: string | null;
  inconsistency: ReproductiveProjectionInconsistency | null;
  definingEventId: string | null;
  definingEventDate: string | null;
  definingEventType: ReproTipoEnum | null;
}

export interface AnimalReproStatus {
  status: ReproStatus;
  lastEventDate: string | null;
  lastEventType: ReproTipoEnum | null;
  daysSinceEvent: number | null;
  predictionDate: string | null;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function addDays(value: string, days: number): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getDiagnosticResult(payload: unknown) {
  if (isPayloadV1(payload)) return payload.resultado ?? null;
  const legacy = payload as LegacyDiagnosticPayload;
  return legacy?.diagnostico_resultado ?? null;
}

function getEpisodeId(payload: unknown) {
  if (!isPayloadV1(payload)) return null;
  return payload.episode_evento_id ?? null;
}

function getExplicitDpp(payload: unknown) {
  if (!isPayloadV1(payload)) return null;
  return payload.data_prevista_parto ?? null;
}

function getBirthDate(payload: unknown, occurredAt: string) {
  if (isPayloadV1(payload) && isDateKey(payload.data_parto_real)) {
    return payload.data_parto_real;
  }
  return occurredAt.slice(0, 10);
}

function baseProjection(): ReproductiveProjection {
  return {
    status: "VAZIA",
    currentEpisodeId: null,
    lastDiagnosisEventId: null,
    diagnosedEpisodeId: null,
    dpp: null,
    dppOrigin: null,
    lastBirthDate: null,
    lastLossDate: null,
    inconsistency: null,
    definingEventId: null,
    definingEventDate: null,
    definingEventType: null,
  };
}

function defineFromEvent(
  projection: ReproductiveProjection,
  event: ReproductiveProjectionEvent,
) {
  projection.definingEventId = event.id;
  projection.definingEventDate = event.occurred_at;
  projection.definingEventType = event.details?.tipo ?? null;
}

/**
 * Rebuilds current reproductive state exclusively from factual event history.
 * Animal payload/taxonomy facts are deliberately not accepted as input.
 */
export function rebuildReproductiveProjection(
  events: ReproductiveProjectionEvent[],
): ReproductiveProjection {
  const effectiveHistory = resolveEffectiveHistory(events);
  const history = effectiveHistory.events
    .sort((left, right) => {
      const dateOrder = left.occurred_at.localeCompare(right.occurred_at);
      return dateOrder !== 0 ? dateOrder : left.id.localeCompare(right.id);
    });
  const byId = new Map(history.map((event) => [event.id, event]));
  const projection = baseProjection();

  for (const event of history) {
    const type = event.details?.tipo;
    if (!type) continue;

    if (type === "cobertura" || type === "IA") {
      projection.status = "SERVIDA";
      projection.currentEpisodeId = event.id;
      projection.lastDiagnosisEventId = null;
      projection.diagnosedEpisodeId = null;
      projection.dpp = null;
      projection.dppOrigin = null;
      projection.inconsistency = null;
      defineFromEvent(projection, event);
      continue;
    }

    if (type === "diagnostico") {
      const result = getDiagnosticResult(event.details.payload);
      const episodeId = getEpisodeId(event.details.payload);
      const episode = episodeId ? byId.get(episodeId) : null;
      projection.lastDiagnosisEventId = event.id;
      projection.diagnosedEpisodeId = episodeId;

      if (result !== "positivo" && result !== "negativo") {
        projection.inconsistency = "DIAGNOSIS_RESULT_INVALID";
        defineFromEvent(projection, event);
        continue;
      }
      if (!episode) {
        projection.inconsistency = "EPISODE_NOT_FOUND";
        defineFromEvent(projection, event);
        continue;
      }
      if (episode.fazenda_id !== event.fazenda_id) {
        projection.inconsistency = "EPISODE_FARM_MISMATCH";
        defineFromEvent(projection, event);
        continue;
      }
      if (episode.animal_id !== event.animal_id) {
        projection.inconsistency = "EPISODE_ANIMAL_MISMATCH";
        defineFromEvent(projection, event);
        continue;
      }
      if (
        episode.details?.tipo !== "cobertura" &&
        episode.details?.tipo !== "IA"
      ) {
        projection.inconsistency = "EPISODE_TYPE_INVALID";
        defineFromEvent(projection, event);
        continue;
      }
      if (episode.occurred_at > event.occurred_at) {
        projection.inconsistency = "EPISODE_AFTER_DIAGNOSIS";
        defineFromEvent(projection, event);
        continue;
      }
      if (projection.currentEpisodeId !== episode.id) {
        projection.inconsistency = "EPISODE_NOT_CURRENT";
        continue;
      }

      projection.inconsistency = null;
      defineFromEvent(projection, event);
      if (result === "negativo") {
        projection.status = "VAZIA";
        projection.currentEpisodeId = null;
        projection.dpp = null;
        projection.dppOrigin = null;
        continue;
      }

      projection.status = "PRENHA";
      projection.currentEpisodeId = episode.id;
      const explicitDpp = getExplicitDpp(event.details.payload);
      if (explicitDpp !== null) {
        if (!isDateKey(explicitDpp)) {
          projection.dpp = null;
          projection.dppOrigin = null;
          projection.inconsistency = "DPP_INVALID";
          continue;
        }
        projection.dpp = explicitDpp;
        projection.dppOrigin = "explicit";
      } else {
        projection.dpp = addDays(episode.occurred_at, 283);
        projection.dppOrigin = projection.dpp
          ? "service_plus_283_days"
          : null;
      }
      continue;
    }

    if (type === "parto") {
      const episodeId = getEpisodeId(event.details.payload);
      const episode = episodeId ? byId.get(episodeId) : null;
      const activeEpisodeId = projection.currentEpisodeId;
      let inconsistency: ReproductiveProjectionInconsistency | null = null;

      if (!episodeId) {
        inconsistency = "PARTO_WITHOUT_EPISODE";
      } else if (!episode) {
        inconsistency = "EPISODE_NOT_FOUND";
      } else if (episode.fazenda_id !== event.fazenda_id) {
        inconsistency = "EPISODE_FARM_MISMATCH";
      } else if (episode.animal_id !== event.animal_id) {
        inconsistency = "EPISODE_ANIMAL_MISMATCH";
      } else if (
        episode.details?.tipo !== "cobertura" &&
        episode.details?.tipo !== "IA"
      ) {
        inconsistency = "EPISODE_TYPE_INVALID";
      } else if (episode.occurred_at > event.occurred_at) {
        inconsistency = "PARTO_EPISODE_AFTER_BIRTH";
      } else if (activeEpisodeId !== episode.id) {
        inconsistency = "EPISODE_NOT_CURRENT";
      }

      projection.status = "PARIDA_PUERPERIO";
      projection.currentEpisodeId = null;
      projection.dpp = null;
      projection.dppOrigin = null;
      projection.lastBirthDate = getBirthDate(
        event.details.payload,
        event.occurred_at,
      );
      projection.inconsistency = inconsistency;
      defineFromEvent(projection, event);
      continue;
    }

    if (type === "aborto") {
      const episodeId = getEpisodeId(event.details.payload);
      const episode = episodeId ? byId.get(episodeId) : null;
      const activeEpisodeId = projection.currentEpisodeId;
      let inconsistency: ReproductiveProjectionInconsistency | null = null;

      if (!episodeId) {
        inconsistency = "ABORTO_WITHOUT_EPISODE";
      } else if (!episode) {
        inconsistency = "EPISODE_NOT_FOUND";
      } else if (episode.fazenda_id !== event.fazenda_id) {
        inconsistency = "EPISODE_FARM_MISMATCH";
      } else if (episode.animal_id !== event.animal_id) {
        inconsistency = "EPISODE_ANIMAL_MISMATCH";
      } else if (
        episode.details?.tipo !== "cobertura" &&
        episode.details?.tipo !== "IA"
      ) {
        inconsistency = "EPISODE_TYPE_INVALID";
      } else if (episode.occurred_at > event.occurred_at) {
        inconsistency = "ABORTO_EPISODE_AFTER_LOSS";
      } else if (activeEpisodeId !== episode.id) {
        inconsistency = "EPISODE_NOT_CURRENT";
      }

      projection.lastLossDate = event.occurred_at.slice(0, 10);
      if (inconsistency && activeEpisodeId) {
        projection.inconsistency = inconsistency;
        continue;
      }
      projection.status = "VAZIA";
      projection.currentEpisodeId = null;
      projection.dpp = null;
      projection.dppOrigin = null;
      projection.inconsistency = inconsistency;
      defineFromEvent(projection, event);
    }
  }

  if (effectiveHistory.inconsistency) {
    projection.inconsistency = effectiveHistory.inconsistency;
  }
  return projection;
}

export function computeReproStatus(
  events: ReproEventJoined[],
  now = new Date(),
): AnimalReproStatus {
  const projection = rebuildReproductiveProjection(events);
  const definingEvent = projection.definingEventId
    ? events.find((event) => event.id === projection.definingEventId) ?? null
    : null;
  const eventDate = definingEvent ? new Date(definingEvent.occurred_at) : null;
  const daysSinceEvent =
    eventDate && !Number.isNaN(eventDate.getTime())
      ? Math.max(
          0,
          Math.floor((now.getTime() - eventDate.getTime()) / 86_400_000),
        )
      : null;
  let status = projection.status;
  let predictionDate = projection.dpp;

  if (status === "PARIDA_PUERPERIO" && eventDate) {
    if ((daysSinceEvent ?? 0) > PUERPERIO_DAYS) {
      status = "PARIDA_ABERTA";
      predictionDate = null;
    } else {
      predictionDate = addDays(definingEvent!.occurred_at, 210);
    }
  } else if (status === "SERVIDA" && definingEvent) {
    predictionDate = addDays(definingEvent.occurred_at, 30);
  }

  return {
    status,
    lastEventDate: definingEvent?.occurred_at ?? null,
    lastEventType: definingEvent?.details?.tipo ?? null,
    daysSinceEvent,
    predictionDate,
  };
}
