import { resolveAnimalClassificationSnapshot } from "@/lib/animals/classificationSnapshot";
import { readTaxonomyFactsRecord } from "@/lib/animals/taxonomyFactsContract";
import { selectLatestObservedWeight } from "@/lib/insights/latestObservedWeight";
import { rebuildReproductiveProjection } from "@/lib/reproduction/status";
import { getCalfJourneyMilestoneKey } from "@/lib/reproduction/calfJourney";
import type { Animal } from "@/lib/offline/types";
import type { SanitaryProtocolItemV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";
import {
  sanitaryPlanningHasFieldSourceV2,
  sanitaryPlanningKindV2,
} from "../agenda/sanitaryPlanningPolicyV2";
import { sanitaryScheduledDateValidV2 } from "../agenda/sanitaryContextualPlanningV2";
import type {
  SanitaryOperationalContextV2,
  SanitaryProtocolWindowSourceV2,
} from "./sanitaryProtocolWindowsV2";

export type SanitaryContextFactV2<T> = {
  status: "known" | "unknown" | "contradictory";
  value: T | null;
  sources: string[];
  reason: string;
};
const known = <T>(
  value: T,
  sources: string[],
  reason: string,
): SanitaryContextFactV2<T> => ({ status: "known", value, sources, reason });
const unknown = <T>(
  reason: string,
  sources: string[] = [],
): SanitaryContextFactV2<T> => ({
  status: "unknown",
  value: null,
  sources,
  reason,
});
const conflict = <T>(
  reason: string,
  sources: string[],
): SanitaryContextFactV2<T> => ({
  status: "contradictory",
  value: null,
  sources,
  reason,
});
const day = (value: string | null | undefined) => {
  const key = value?.slice(0, 10);
  return key && sanitaryScheduledDateValidV2(key) ? key : null;
};
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );

// A projection for this evaluation only. It never writes facts, configuration or Agenda.
export function resolveSanitaryAnimalContextV2(input: {
  animal: Animal;
  source: SanitaryProtocolWindowSourceV2;
  item: SanitaryProtocolItemV2ReadModel;
  evaluatedAt: string;
  declared: SanitaryOperationalContextV2;
}) {
  const { animal, source, item, declared } = input;
  const at = day(input.evaluatedAt);
  const farmId = source.fazendaId ?? animal.fazenda_id;
  const scoped =
    animal.fazenda_id === farmId && !animal.deleted_at && Boolean(at);
  const animalRef = `animais:${animal.id}`;
  const birth = day(animal.data_nascimento);
  const ageDays =
    scoped && birth && birth <= at
      ? known(
          daysBetween(birth, at),
          [animalRef],
          "Idade calculada a partir do nascimento cadastrado.",
        )
      : unknown<number>(
          "Nascimento, data de avaliação ou escopo indisponível.",
        );
  const sex =
    scoped && ["M", "F"].includes(animal.sexo)
      ? known(animal.sexo, [animalRef], "Sexo cadastrado.")
      : unknown<string>("Sexo indisponível.");
  const lot =
    scoped &&
    animal.lote_id &&
    source.lots.find(
      (entry) =>
        entry.id === animal.lote_id &&
        entry.fazenda_id === farmId &&
        !entry.deleted_at,
    );
  const lotId = lot
    ? known(
        lot.id,
        [animalRef, `lotes:${lot.id}`],
        "Lote atual da mesma fazenda.",
      )
    : unknown<string>("Lote atual não comprovado nos dados locais.");
  const events = scoped
    ? (source.reproductiveEvents ?? []).filter(
        (event) =>
          event.animal_id === animal.id &&
          event.fazenda_id === farmId &&
          !event.deleted_at &&
          day(event.occurred_at) &&
          day(event.occurred_at) <= at,
      )
    : [];
  const projection = rebuildReproductiveProjection(events);
  const eventRefs = events.map((event) => `eventos:${event.id}`);
  const incomplete = events.some(
    (event) => !event.details || event.details.deleted_at,
  );
  let pregnancy: SanitaryContextFactV2<boolean> =
    !events.length || incomplete
      ? unknown("Histórico reprodutivo local ausente ou incompleto.", eventRefs)
      : projection.inconsistency
        ? conflict(
            `Histórico reprodutivo contraditório: ${projection.inconsistency}.`,
            eventRefs,
          )
        : projection.status === "PRENHA"
          ? known(
              true,
              eventRefs,
              "Gestação confirmada na projeção factual reprodutiva.",
            )
          : projection.status === "SERVIDA"
            ? unknown("Serviço reprodutivo não comprova gestação.", eventRefs)
            : known(
                false,
                eventRefs,
                "Ciclo factual sem gestação confirmada vigente.",
              );
  const cachedFacts = readTaxonomyFactsRecord(animal.payload) ?? {};
  if (
    pregnancy.status === "known" &&
    ((pregnancy.value && animal.sexo !== "F") ||
      (typeof cachedFacts.prenhez_confirmada === "boolean" &&
        cachedFacts.prenhez_confirmada !== pregnancy.value) ||
      (pregnancy.value &&
        typeof cachedFacts.data_prevista_parto === "string" &&
        cachedFacts.data_prevista_parto !== projection.dpp))
  ) {
    pregnancy = conflict(
      "Cadastro/projeção atual diverge do histórico reprodutivo. Revise as fontes.",
      [...eventRefs, animalRef],
    );
  }
  const expectedBirth =
    pregnancy.status === "known" && pregnancy.value && day(projection.dpp)
      ? known(
          projection.dpp!,
          eventRefs,
          `DPP da projeção canônica (${projection.dppOrigin}).`,
        )
      : unknown<string>(
          "Previsão de parto canônica válida não comprovada.",
          eventRefs,
        );
  const observed =
    at && farmId && animal.id
      ? selectLatestObservedWeight({
          animal: scoped ? animal : null,
          animalId: animal.id,
          fazendaId: farmId,
          events: source.contextEvents ?? [],
          weightDetails: source.weightDetails ?? [],
          referenceDate: `${at}T23:59:59.999Z`,
        })
      : null;
  const weight =
    observed?.status === "available"
      ? known(
          observed.value.weight,
          [`eventos:${observed.value.eventId}`],
          "Último peso observado; não comprova peso atual nem dose.",
        )
      : observed?.status === "conflict"
        ? conflict<number>(
            "Pesagens contraditórias.",
            observed.conflict.eventIds.map((id) => `eventos:${id}`),
          )
        : unknown<number>(
            "Peso observado válido indisponível; não estimado por idade ou categoria.",
          );
  const classification = resolveAnimalClassificationSnapshot(animal, {
    referenceDate: input.evaluatedAt,
  });
  const completedWeaning = scoped
    ? (source.contextEvents ?? [])
        .filter(
          (event) =>
            event.fazenda_id === farmId &&
            event.animal_id === animal.id &&
            event.dominio === "nutricao" &&
            !event.deleted_at &&
            day(event.occurred_at) &&
            day(event.occurred_at) <= at &&
            (event.payload?.procedimento === "desmame" ||
              event.payload?.milestone_key === "desmame"),
        )
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0]
    : null;
  const plannedWeanings = scoped
    ? (source.managementAgendas ?? []).filter(
        (agenda) =>
          agenda.fazenda_id === farmId &&
          agenda.animal_id === animal.id &&
          !agenda.deleted_at &&
          agenda.status === "agendado" &&
          day(agenda.data_prevista) &&
          getCalfJourneyMilestoneKey(agenda) === "desmame",
      )
    : [];
  const weaningDates = new Set(
    plannedWeanings.map((agenda) => agenda.data_prevista),
  );
  const weaning = completedWeaning
    ? known(
        {
          kind: "completed" as const,
          date: day(completedWeaning.occurred_at)!,
        },
        [`eventos:${completedWeaning.id}`],
        "Desmame registrado como fato; Agenda concluída isolada não comprova execução.",
      )
    : weaningDates.size > 1
      ? conflict<{ kind: "planned" | "completed"; date: string }>(
          "Programações de desmama divergentes para o mesmo animal.",
          plannedWeanings.map((agenda) => `agenda_itens:${agenda.id}`),
        )
      : plannedWeanings.length
        ? known(
            {
              kind: "planned" as const,
              date: plannedWeanings[0].data_prevista,
            },
            plannedWeanings.map((agenda) => `agenda_itens:${agenda.id}`),
            "Desmama programada na jornada da cria; é intenção e não execução ou indicação sanitária.",
          )
        : unknown<{ kind: "planned" | "completed"; date: string }>(
            "Desmama não comprovada no histórico ou na programação individual disponível.",
          );
  const scheduled = declared.scheduledContext;
  const scheduledForAnimal =
    scoped &&
    scheduled &&
    day(scheduled.date) &&
    scheduled.reference.trim() &&
    scheduled.animalIds.includes(animal.id);
  let management = unknown<SanitaryOperationalContextV2["management"]>(
    "Manejo não confirmado para este animal.",
  );
  if (
    scoped &&
    ["pre_feedlot", "deferred_pasture"].includes(declared.management ?? "") &&
    scheduledForAnimal
  ) {
    management = known(
      declared.management,
      ["contexto_programado", scheduled.reference],
      "Intenção de manejo referenciada e dirigida ao animal; não é execução.",
    );
  } else if (
    scoped &&
    (weaning.value?.kind === "completed" ||
      ["recria", "garrote", "novilha", "desmamado"].includes(
        classification.estagioVida,
      ))
  ) {
    management = known(
      "rearing",
      [animalRef],
      "Recria derivada da classificação canônica; não autoriza intervenção sanitária.",
    );
  } else if (
    scoped &&
    ageDays.status === "known" &&
    ["cria_neonatal", "cria_aleitamento"].includes(
      classification.estagioVida,
    ) &&
    item.eligibilityRule.requires_mv_or_management_context &&
    declared.preWeaningBasis?.reference?.trim() &&
    ["intensive_dairy", "veterinarian"].includes(
      declared.preWeaningBasis.kind,
    ) &&
    weaning.status !== "contradictory"
  ) {
    management = known(
      "pre_weaning",
      [animalRef, declared.preWeaningBasis.reference],
      "Cria e indicação pré-desmama referenciada; critérios do protocolo continuam na pré-checagem.",
    );
  }
  let reproduction =
    pregnancy.status === "contradictory"
      ? conflict<SanitaryOperationalContextV2["reproductiveContext"]>(
          pregnancy.reason,
          pregnancy.sources,
        )
      : unknown<SanitaryOperationalContextV2["reproductiveContext"]>(
          "Pré-parto exige gestação e janela técnica fundamentadas.",
          eventRefs,
        );
  let derivedSchedule: SanitaryOperationalContextV2["scheduledContext"];
  const min = item.operationalWindowRule.min_offset_days,
    max = item.operationalWindowRule.max_offset_days;
  if (
    scoped &&
    expectedBirth.status === "known" &&
    item.operationalWindowRule.anchor === "parturition" &&
    typeof min === "number" &&
    Number.isInteger(min) &&
    typeof max === "number" &&
    Number.isInteger(max) &&
    min <= max &&
    max <= 0 &&
    sanitaryPlanningHasFieldSourceV2(item, "operational_window")
  ) {
    const offset = daysBetween(expectedBirth.value!, at!);
    if (offset >= min && offset <= max) {
      reproduction = known(
        "prepartum",
        [...eventRefs, `item:${item.id}:v${item.version}`],
        "Gestação e DPP dentro da janela versionada e fundamentada.",
      );
      const date = new Date(`${expectedBirth.value}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + min);
      derivedSchedule = {
        date: date.toISOString().slice(0, 10),
        animalIds: [animal.id],
        reference: `event:${projection.definingEventId}|item:${item.id}:v${item.version}`,
      };
    }
  }
  const recurrence = item.boosterRule.recurrenceRule as
    | { kind?: string }
    | undefined;
  const risk =
    scoped && typeof declared.riskContext === "boolean"
      ? known(
          declared.riskContext,
          ["contexto_declarado"],
          "Risco explicitamente informado; não inferido por endereço ou ausência de histórico.",
        )
      : unknown<boolean>("Risco não comprovado.");
  const cadence =
    scoped &&
    recurrence?.kind === "annual" &&
    sanitaryPlanningHasFieldSourceV2(item, "operational_window") &&
    declared.sanitaryCadence === "semiannual"
      ? conflict<"annual" | "semiannual">(
          "Cadência declarada diverge da regra anual versionada.",
          ["contexto_declarado", `item:${item.id}:v${item.version}`],
        )
      : scoped && declared.sanitaryCadence
        ? known(
            declared.sanitaryCadence,
            ["contexto_declarado"],
            "Cadência explicitamente configurada para a avaliação.",
          )
        : scoped &&
            recurrence?.kind === "annual" &&
            sanitaryPlanningHasFieldSourceV2(item, "operational_window")
          ? known(
              "annual" as const,
              [`item:${item.id}:v${item.version}`],
              "Cadência anual da regra versionada; histórico continua obrigatório.",
            )
          : unknown<"annual" | "semiannual">(
              "Regra/evidência insuficiente para escolher cadência.",
            );
  const context: SanitaryOperationalContextV2 = {
    ...declared,
    management: management.value,
    reproductiveContext: reproduction.value,
    sanitaryCadence: cadence.value,
    riskContext: risk.value,
    rabiesRiskArea: scoped ? declared.rabiesRiskArea : null,
    scheduledContext:
      derivedSchedule ?? (scheduledForAnimal ? scheduled : undefined),
  };
  const historyEvents = scoped
    ? (source.executedHistory
        .find((entry) => entry.animalId === animal.id)
        ?.events.filter(
          (event) => day(event.executedAt) && day(event.executedAt) <= at,
        ) ?? [])
    : [];
  const history = historyEvents.length
    ? known(
        historyEvents.length,
        historyEvents.map((event) => `eventos:${event.eventId}`),
        "Histórico sanitário disponível; fontes, produto/classe e sequência continuam validados na pré-checagem.",
      )
    : unknown<number>(
        "Sem histórico sanitário disponível localmente; não comprova ausência de execução.",
      );
  // Preserve the existing scheduled generic assessment. It is not a resolved pregnancy,
  // technical recommendation or authorization to apply a product.
  const genericAssessment = Boolean(
    scoped &&
    scheduledForAnimal &&
    scheduled.date <= at &&
    item.eligibilityRule.requires_pregnancy_or_peripartum_context &&
    sanitaryPlanningKindV2(item) === "avaliacao_manejo_generica",
  );
  return {
    reproductiveEpisodeId: pregnancy.status === "known" && pregnancy.value ? projection.currentEpisodeId : null,
    reproductiveEpisodeDate: pregnancy.status === "known" && pregnancy.value ? day(events.find((event) => event.id === projection.currentEpisodeId)?.occurred_at) : null,
    ageDays,
    sex,
    lotId,
    pregnancy,
    expectedBirth,
    weight,
    history,
    weaning,
    management,
    reproduction,
    risk,
    cadence,
    genericAssessment,
    context,
  };
}

export type SanitaryAnimalContextResolutionV2 = ReturnType<
  typeof resolveSanitaryAnimalContextV2
>;
