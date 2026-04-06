import type {
  Animal,
  CategoriaZootecnicaCanonicaEnum,
  DestinoProdutivoAnimalEnum,
  EstadoProdutivoReprodutivoEnum,
  FaseVeterinariaEnum,
  StatusReprodutivoMachoEnum,
} from "@/lib/offline/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import {
  getAnimalProductiveDestination,
  getMaleReproductiveStatus,
  isMaleBreedingDestination,
} from "@/lib/animals/maleProfile";
import {
  buildAnimalTaxonomyFactsContract,
  readTaxonomyFactsRecord,
  type AnimalTaxonomyFactsPatch,
  type TaxonomyFactsWriter,
} from "@/lib/animals/taxonomyFactsContract";
import { getAnimalPayloadRecord } from "@/lib/reproduction/neonatal";
import type { ReproEventJoined } from "@/lib/reproduction/selectors";
import {
  computeReproStatus,
  type AnimalReproStatus,
} from "@/lib/reproduction/status";

const VETERINARY_NEONATAL_DAYS = 28;
const PRE_PARTO_IMEDIATO_DAYS = 30;
const PUERPERIO_DAYS = 60;
const RECEM_PARIDA_DAYS = 15;
const DEFAULT_LACTATION_DAYS = 210;

type AnimalPayloadRecord = Record<string, unknown>;

export interface AnimalTaxonomyFacts {
  castrado: boolean | null;
  puberdade_confirmada: boolean | null;
  secagem_realizada: boolean | null;
  data_secagem: string | null;
  em_lactacao: boolean | null;
  prenhez_confirmada: boolean | null;
  data_prevista_parto: string | null;
  data_ultimo_parto: string | null;
}

export interface AnimalTaxonomyReproContext {
  reproStatus: AnimalReproStatus | null;
  dataUltimoParto: string | null;
  dataPrevistaParto: string | null;
}

export interface AnimalTaxonomySnapshot {
  categoria_zootecnica: CategoriaZootecnicaCanonicaEnum;
  fase_veterinaria: FaseVeterinariaEnum;
  estado_produtivo_reprodutivo: EstadoProdutivoReprodutivoEnum;
  display: {
    categoria: string;
    fase_veterinaria: string;
    estado_canonico: string;
    estado_alias: string;
  };
  facts: {
    idade_dias: number | null;
    data_desmama: string | null;
    pariu_alguma_vez: boolean;
    prenhez_confirmada: boolean;
    puberdade_confirmada: boolean | null;
    castrado: boolean;
    secagem_realizada: boolean;
    em_lactacao: boolean;
    data_prevista_parto: string | null;
    data_ultimo_parto: string | null;
    destino_produtivo: DestinoProdutivoAnimalEnum | null;
    status_reprodutivo_macho: StatusReprodutivoMachoEnum | null;
  };
}

function asRecord(value: unknown): AnimalPayloadRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as AnimalPayloadRecord;
}

function parseNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function parseNullableDate(value: unknown) {
  return typeof value === "string" && value.length >= 10
    ? value.slice(0, 10)
    : null;
}

function isPositiveDiagnosticPayload(payload: unknown) {
  const record = asRecord(payload);
  return (
    record.resultado === "positivo" ||
    record.diagnostico_resultado === "positivo"
  );
}

function getDiagnosticPredictionDate(payload: unknown) {
  return parseNullableDate(asRecord(payload).data_prevista_parto);
}

function getLatestWeightKg(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  const metrics = asRecord(record.metrics);
  return typeof metrics.last_weight_kg === "number" &&
    Number.isFinite(metrics.last_weight_kg)
    ? metrics.last_weight_kg
    : null;
}

function getDateInDays(data: string | null | undefined, now: Date) {
  if (!data) return null;
  const date = new Date(`${data.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function getDaysUntil(date: string | null | undefined, now: Date) {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function getDataDesmama(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  const weaning = asRecord(record.weaning);
  return parseNullableDate(weaning.completed_at);
}

function isYoungByLifecycleBasis(
  animal: Pick<Animal, "data_nascimento" | "payload">,
  config: FarmLifecycleConfig,
  now: Date,
) {
  const latestWeightKg = getLatestWeightKg(animal.payload);
  const ageInDays = getDateInDays(animal.data_nascimento, now);

  if (
    config.stage_classification_basis === "peso" &&
    latestWeightKg !== null
  ) {
    return latestWeightKg < config.weaning_weight_kg;
  }

  return ageInDays === null ? true : ageInDays < config.weaning_days;
}

function hasAdultMaleThreshold(
  animal: Pick<Animal, "data_nascimento" | "payload">,
  config: FarmLifecycleConfig,
  now: Date,
) {
  const latestWeightKg = getLatestWeightKg(animal.payload);
  const ageInDays = getDateInDays(animal.data_nascimento, now);

  if (
    config.stage_classification_basis === "peso" &&
    latestWeightKg !== null
  ) {
    return latestWeightKg >= config.male_adult_weight_kg;
  }

  return ageInDays !== null && ageInDays >= config.male_adult_days;
}

export function getAnimalTaxonomyFacts(
  payload: Animal["payload"],
): AnimalTaxonomyFacts {
  const facts = readTaxonomyFactsRecord(getAnimalPayloadRecord(payload)) ?? {};

  return {
    castrado: parseNullableBoolean(facts.castrado),
    puberdade_confirmada: parseNullableBoolean(facts.puberdade_confirmada),
    secagem_realizada: parseNullableBoolean(facts.secagem_realizada),
    data_secagem: parseNullableDate(facts.data_secagem),
    em_lactacao: parseNullableBoolean(facts.em_lactacao),
    prenhez_confirmada: parseNullableBoolean(facts.prenhez_confirmada),
    data_prevista_parto: parseNullableDate(facts.data_prevista_parto),
    data_ultimo_parto: parseNullableDate(facts.data_ultimo_parto),
  };
}

export function buildAnimalTaxonomyFactsPayload(
  currentPayload: Animal["payload"] | null | undefined,
  patch: AnimalTaxonomyFactsPatch,
  writer: TaxonomyFactsWriter = "manual",
) {
  const nextPayload = { ...getAnimalPayloadRecord(currentPayload) };
  const currentFacts = readTaxonomyFactsRecord(nextPayload);
  const nextFacts = buildAnimalTaxonomyFactsContract(
    currentFacts,
    patch,
    writer,
  );

  if (nextFacts) {
    nextPayload.taxonomy_facts = nextFacts;
  } else {
    delete nextPayload.taxonomy_facts;
  }

  return nextPayload;
}

export function buildAnimalTaxonomyReproContextMap(events: ReproEventJoined[]) {
  const historyByAnimal = new Map<string, ReproEventJoined[]>();

  for (const event of events) {
    if (!event.animal_id || event.deleted_at || !event.details) continue;
    const current = historyByAnimal.get(event.animal_id) ?? [];
    current.push(event);
    historyByAnimal.set(event.animal_id, current);
  }

  const contextMap = new Map<string, AnimalTaxonomyReproContext>();

  for (const [animalId, history] of historyByAnimal.entries()) {
    const sorted = [...history].sort((left, right) =>
      right.occurred_at.localeCompare(left.occurred_at),
    );
    const reproStatus = computeReproStatus(sorted);
    const parto = sorted.find((event) => event.details?.tipo === "parto");
    const positiveDiagnostic = sorted.find(
      (event) =>
        event.details?.tipo === "diagnostico" &&
        isPositiveDiagnosticPayload(event.details.payload),
    );

    contextMap.set(animalId, {
      reproStatus,
      dataUltimoParto: parto?.occurred_at?.slice(0, 10) ?? null,
      dataPrevistaParto:
        getDiagnosticPredictionDate(positiveDiagnostic?.details?.payload) ??
        null,
    });
  }

  return contextMap;
}

function resolveFemaleCategory(
  animal: Pick<Animal, "data_nascimento" | "payload">,
  facts: AnimalTaxonomySnapshot["facts"],
  config: FarmLifecycleConfig,
  now: Date,
): CategoriaZootecnicaCanonicaEnum {
  if (facts.pariu_alguma_vez) {
    return "vaca";
  }

  return isYoungByLifecycleBasis(animal, config, now) ? "bezerra" : "novilha";
}

function resolveMaleCategory(
  animal: Pick<
    Animal,
    "data_nascimento" | "payload" | "papel_macho" | "habilitado_monta"
  >,
  facts: AnimalTaxonomySnapshot["facts"],
  config: FarmLifecycleConfig,
  now: Date,
): CategoriaZootecnicaCanonicaEnum {
  if (isYoungByLifecycleBasis(animal, config, now)) {
    return "bezerro";
  }

  if (
    facts.destino_produtivo === "reprodutor" &&
    facts.status_reprodutivo_macho === "apto" &&
    hasAdultMaleThreshold(animal, config, now)
  ) {
    return "touro";
  }

  if (
    facts.destino_produtivo === "abate" ||
    facts.destino_produtivo === "engorda"
  ) {
    return hasAdultMaleThreshold(animal, config, now)
      ? "boi_terminacao"
      : "garrote";
  }

  return "garrote";
}

function resolveVeterinaryPhase(
  facts: AnimalTaxonomySnapshot["facts"],
  config: FarmLifecycleConfig,
  now: Date,
): FaseVeterinariaEnum {
  const ageInDays = facts.idade_dias;
  const daysSinceParto = getDateInDays(facts.data_ultimo_parto, now);
  const isPreWeaning =
    facts.data_desmama === null &&
    (ageInDays === null || ageInDays <= config.weaning_days);

  if (daysSinceParto !== null && daysSinceParto <= PUERPERIO_DAYS) {
    return "puerperio";
  }

  if (facts.prenhez_confirmada) {
    return "gestante";
  }

  if (ageInDays !== null && ageInDays <= VETERINARY_NEONATAL_DAYS) {
    return "neonatal";
  }

  if (isPreWeaning) {
    return "pre_desmama";
  }

  if (facts.puberdade_confirmada === true) {
    return "pubere";
  }

  if (facts.puberdade_confirmada === false) {
    return "pre_pubere";
  }

  return "pos_desmama";
}

function resolveFemaleState(
  facts: AnimalTaxonomySnapshot["facts"],
  now: Date,
): EstadoProdutivoReprodutivoEnum {
  const daysSinceParto = getDateInDays(facts.data_ultimo_parto, now);
  const daysUntilParto = getDaysUntil(facts.data_prevista_parto, now);

  if (daysSinceParto !== null && daysSinceParto <= RECEM_PARIDA_DAYS) {
    return "recem_parida";
  }

  if (facts.secagem_realizada) {
    return "seca";
  }

  if (
    facts.prenhez_confirmada &&
    daysUntilParto !== null &&
    daysUntilParto <= PRE_PARTO_IMEDIATO_DAYS
  ) {
    return "pre_parto_imediato";
  }

  if (facts.prenhez_confirmada) {
    return "prenhe";
  }

  if (facts.em_lactacao) {
    return "lactacao";
  }

  return "vazia";
}

function resolveMaleState(
  facts: AnimalTaxonomySnapshot["facts"],
  category: CategoriaZootecnicaCanonicaEnum,
): EstadoProdutivoReprodutivoEnum {
  if (
    facts.destino_produtivo === "reprodutor" &&
    (facts.status_reprodutivo_macho === "apto" ||
      facts.status_reprodutivo_macho === "candidato" ||
      facts.status_reprodutivo_macho === "suspenso")
  ) {
    return "reprodutor";
  }

  if (
    category === "boi_terminacao" ||
    facts.destino_produtivo === "abate" ||
    facts.destino_produtivo === "engorda"
  ) {
    return "terminacao";
  }

  if (facts.castrado) {
    return "castrado";
  }

  return "inteiro";
}

export function getCategoriaZootecnicaLabel(
  categoria: CategoriaZootecnicaCanonicaEnum,
) {
  switch (categoria) {
    case "bezerra":
      return "Bezerra";
    case "novilha":
      return "Novilha";
    case "vaca":
      return "Vaca";
    case "bezerro":
      return "Bezerro";
    case "garrote":
      return "Garrote";
    case "boi_terminacao":
      return "Boi";
    case "touro":
      return "Touro";
  }
}

export function getFaseVeterinariaLabel(fase: FaseVeterinariaEnum) {
  switch (fase) {
    case "neonatal":
      return "Neonatal";
    case "pre_desmama":
      return "Pre-desmama";
    case "pos_desmama":
      return "Pos-desmama";
    case "pre_pubere":
      return "Pre-pubere";
    case "pubere":
      return "Pubere";
    case "gestante":
      return "Gestante";
    case "puerperio":
      return "Puerperio";
  }
}

export function getEstadoProdutivoReprodutivoLabel(
  estado: EstadoProdutivoReprodutivoEnum,
) {
  switch (estado) {
    case "vazia":
      return "Vazia";
    case "prenhe":
      return "Prenhe";
    case "pre_parto_imediato":
      return "Pre-parto imediato";
    case "seca":
      return "Seca";
    case "recem_parida":
      return "Recem-parida";
    case "lactacao":
      return "Lactacao";
    case "inteiro":
      return "Inteiro";
    case "castrado":
      return "Castrado";
    case "reprodutor":
      return "Reprodutor";
    case "terminacao":
      return "Terminacao";
  }
}

export function getEstadoProdutivoReprodutivoAlias(
  estado: EstadoProdutivoReprodutivoEnum,
) {
  switch (estado) {
    case "pre_parto_imediato":
      return "Amojando";
    case "recem_parida":
      return "Vaca parida";
    case "lactacao":
      return "Vaca em lactacao";
    default:
      return getEstadoProdutivoReprodutivoLabel(estado);
  }
}

export function getCategoriaZootecnicaAliases(
  categoria: CategoriaZootecnicaCanonicaEnum,
) {
  if (categoria === "garrote") {
    return ["Garrote", "Sobreano"];
  }

  return [getCategoriaZootecnicaLabel(categoria)];
}

export function deriveAnimalTaxonomy(
  animal: Pick<
    Animal,
    "sexo" | "data_nascimento" | "payload" | "papel_macho" | "habilitado_monta"
  >,
  options?: {
    config?: FarmLifecycleConfig;
    reproContext?: AnimalTaxonomyReproContext | null;
    now?: Date;
  },
): AnimalTaxonomySnapshot {
  const config = options?.config ?? DEFAULT_FARM_LIFECYCLE_CONFIG;
  const now = options?.now ?? new Date();
  const storedFacts = getAnimalTaxonomyFacts(animal.payload);
  const reproContext = options?.reproContext ?? null;
  const dataDesmama = getDataDesmama(animal.payload);
  const ageInDays = getDateInDays(animal.data_nascimento, now);
  const destinoProdutivo = getAnimalProductiveDestination(animal);
  const maleStatus = getMaleReproductiveStatus(animal);
  const dataUltimoParto =
    reproContext?.dataUltimoParto ?? storedFacts.data_ultimo_parto;
  const dataPrevistaParto =
    reproContext?.dataPrevistaParto ?? storedFacts.data_prevista_parto;
  const prenhezConfirmada =
    reproContext?.reproStatus?.status === "PRENHA"
      ? true
      : storedFacts.prenhez_confirmada === true;
  const pariuAlgumaVez = Boolean(dataUltimoParto);
  const secagemRealizada = storedFacts.secagem_realizada === true;
  const daysSinceParto = getDateInDays(dataUltimoParto, now);
  const inferredLactation =
    daysSinceParto !== null &&
    daysSinceParto <= DEFAULT_LACTATION_DAYS &&
    !secagemRealizada;
  const emLactacao = storedFacts.em_lactacao ?? inferredLactation;
  const inferredPuberdade =
    storedFacts.puberdade_confirmada ??
    (pariuAlgumaVez || prenhezConfirmada || maleStatus !== null ? true : null);
  const facts = {
    idade_dias: ageInDays,
    data_desmama: dataDesmama,
    pariu_alguma_vez: pariuAlgumaVez,
    prenhez_confirmada: prenhezConfirmada,
    puberdade_confirmada: inferredPuberdade,
    castrado: storedFacts.castrado === true,
    secagem_realizada: secagemRealizada,
    em_lactacao: emLactacao === true,
    data_prevista_parto: dataPrevistaParto,
    data_ultimo_parto: dataUltimoParto,
    destino_produtivo: destinoProdutivo,
    status_reprodutivo_macho: maleStatus,
  };

  const categoria =
    animal.sexo === "F"
      ? resolveFemaleCategory(animal, facts, config, now)
      : resolveMaleCategory(animal, facts, config, now);
  const fase = resolveVeterinaryPhase(facts, config, now);
  const estado =
    animal.sexo === "F"
      ? resolveFemaleState(facts, now)
      : resolveMaleState(facts, categoria);

  return {
    categoria_zootecnica: categoria,
    fase_veterinaria: fase,
    estado_produtivo_reprodutivo: estado,
    display: {
      categoria: getCategoriaZootecnicaLabel(categoria),
      fase_veterinaria: getFaseVeterinariaLabel(fase),
      estado_canonico: getEstadoProdutivoReprodutivoLabel(estado),
      estado_alias: getEstadoProdutivoReprodutivoAlias(estado),
    },
    facts,
  };
}

export function isFemaleCanonicalReproductionEligible(
  snapshot: AnimalTaxonomySnapshot,
) {
  return (
    snapshot.categoria_zootecnica === "novilha" ||
    snapshot.categoria_zootecnica === "vaca"
  );
}

export function isMaleCanonicalBreedingCategory(
  snapshot: AnimalTaxonomySnapshot,
) {
  return (
    snapshot.categoria_zootecnica === "touro" ||
    (snapshot.categoria_zootecnica === "garrote" &&
      snapshot.facts.destino_produtivo !== null &&
      isMaleBreedingDestination(snapshot.facts.destino_produtivo))
  );
}
