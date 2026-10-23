import type { Animal, Evento, EventoPesagem, EventoReproducao } from "@/lib/offline/types";
import {
  rebuildReproductiveProjection,
  type ReproductiveProjectionEvent,
} from "@/lib/reproduction/status";
import type {
  OperationalSummaryInput,
  ReportRange,
  ReproductionReportSummary,
} from "./operationalSummaryTypes";
import { getEventDateKey } from "./operationalSummaryCalendar";
import type { resolveMetricTimezone } from "./operationalSummaryCalendar";
import { asRecord, readNestedNumber } from "./reportPayload";

function getReproductiveBirthCount(detail: EventoReproducao): number | null {
  const payload = asRecord(detail.payload);
  const count = readNestedNumber(payload, "numero_crias");
  return count != null && Number.isInteger(count) && count >= 0 ? count : null;
}

function buildReproductiveHistory(
  events: readonly Evento[],
  details: readonly EventoReproducao[],
): ReproductiveProjectionEvent[] {
  const detailByEventId = new Map(
    details.map((detail) => [detail.evento_id, detail]),
  );

  return events
    .filter((event) => event.dominio === "reproducao")
    .map((event) => {
      const detail = detailByEventId.get(event.id);
      return {
        ...event,
        details: detail
          ? {
              tipo: detail.tipo,
              payload: detail.payload,
              deleted_at: detail.deleted_at,
            }
          : undefined,
      };
    });
}

export function buildWeightReport({
  eventos,
  weightByEventId,
}: {
  eventos: readonly Evento[];
  weightByEventId: ReadonlyMap<string, EventoPesagem>;
}) {
  const pesagens = eventos
    .filter((evento) => evento.dominio === "pesagem")
    .map((evento) => ({
      evento,
      detalhe: weightByEventId.get(evento.id),
    }))
    .filter((item): item is { evento: Evento; detalhe: EventoPesagem } =>
      Boolean(item.detalhe),
    );

  const totalPeso = pesagens.reduce(
    (acc, item) => acc + Number(item.detalhe.peso_kg || 0),
    0,
  );
  const ultimaPesagem = pesagens
    .slice()
    .sort((left, right) =>
      right.evento.occurred_at.localeCompare(left.evento.occurred_at),
    )[0];

  return { pesagens, totalPeso, ultimaPesagem };
}

export function buildReproductionReport({
  input,
  animals,
  range,
  metricTimezone,
}: {
  input: Pick<OperationalSummaryInput, "eventos" | "eventosReproducao">;
  animals: readonly Animal[];
  range: Pick<ReportRange, "from" | "to">;
  metricTimezone: Pick<ReturnType<typeof resolveMetricTimezone>, "timezone">;
}) {
  const reproductionLoaded = input.eventosReproducao !== undefined;
  const reproductionDetails = input.eventosReproducao ?? [];
  const reproductionDetailByEventId = new Map(
    reproductionDetails.map((detail) => [detail.evento_id, detail]),
  );
  const reproductiveHistory = reproductionLoaded
    ? buildReproductiveHistory(input.eventos, reproductionDetails)
    : [];
  const reproductiveEventsInPeriod = reproductiveHistory.filter(
    (event) =>
      !event.deleted_at &&
      getEventDateKey(event, metricTimezone.timezone) >= range.from &&
      getEventDateKey(event, metricTimezone.timezone) <= range.to,
  );
  const reproductionEventCount = input.eventos.filter(
    (event) => !event.deleted_at && event.dominio === "reproducao",
  ).length;
  const reproductionMissingDetailCount = reproductionLoaded
    ? reproductiveHistory.filter((event) => !event.details).length
    : reproductionEventCount;
  const reproductiveProjections = animals
    .filter((animal) => animal.sexo === "F")
    .map((animal) =>
      rebuildReproductiveProjection(
        reproductiveHistory.filter((event) => event.animal_id === animal.id),
      ),
    );
  const reproductiveInconsistencyCount = reproductiveProjections.filter(
    (projection) => projection.inconsistency !== null,
  ).length;
  const reproductiveCoverageStatus: "complete" | "partial" | "unavailable" =
    !reproductionLoaded
      ? "unavailable"
      : reproductionMissingDetailCount > 0 || reproductiveInconsistencyCount > 0
        ? "partial"
        : "complete";
  const reproductivePeriodTypeCount = (type: EventoReproducao["tipo"]) =>
    reproductiveEventsInPeriod.filter((event) => event.details?.tipo === type)
      .length;
  const partoEventsInPeriod = reproductiveEventsInPeriod.filter(
    (event) => event.details?.tipo === "parto",
  );
  const birthCounts = partoEventsInPeriod.map((event) => {
    const detail = reproductionDetailByEventId.get(event.id);
    return detail ? getReproductiveBirthCount(detail) : null;
  });
  const knownBirthCount = birthCounts.reduce(
    (total, value) => total + (value ?? 0),
    0,
  );
  const birthsComplete = birthCounts.every((value) => value !== null);
  const reproductiveSummary: ReproductionReportSummary = {
    matrizes: animals.filter((animal) => animal.sexo === "F").length,
    servicos:
      reproductivePeriodTypeCount("cobertura") +
      reproductivePeriodTypeCount("IA"),
    diagnosticos: reproductivePeriodTypeCount("diagnostico"),
    prenhasAtuais: reproductiveProjections.filter(
      (projection) => projection.status === "PRENHA",
    ).length,
    partos: partoEventsInPeriod.length,
    abortosPerdas: reproductivePeriodTypeCount("aborto"),
    nascimentos:
      partoEventsInPeriod.length === 0 || birthsComplete
        ? knownBirthCount
        : null,
  };

  return {
    knownBirthCount,
    birthsComplete,
    reproductiveSummary,
    reproductionLoaded,
    reproductiveCoverageStatus,
    partoEventsInPeriod,
  };
}
