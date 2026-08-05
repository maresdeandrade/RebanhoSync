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
  | "DPP_INVALID";

export interface ReproductiveProjectionEvent {
  id: string;
  fazenda_id: string;
  animal_id: string | null;
  occurred_at: string;
  deleted_at: string | null;
  details?: {
    tipo: ReproTipoEnum;
    payload: unknown;
    deleted_at?: string | null;
  };
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
  const history = events
    .filter((event) => !event.deleted_at && event.details && !event.details.deleted_at)
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
