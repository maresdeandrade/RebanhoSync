import type {
  Animal,
  AnimalLifeStageEnum,
  ModoTransicaoEstagioEnum,
} from "@/lib/offline/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import {
  getAnimalProductiveDestination,
  getAnimalTransitionMode,
  getMaleReproductiveStatus,
  isMaleBreedingDestination,
} from "@/lib/animals/maleProfile";
import { getAnimalPayloadRecord } from "@/lib/reproduction/neonatal";

type LifecycleSource = "stored" | "inferred";
export type PendingAnimalLifecycleKind =
  | "marco_biologico"
  | "decisao_estrategica";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getLifecycleRecord(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  return asRecord(record.lifecycle);
}

function getAgeInDays(dataNascimento: string | null | undefined) {
  if (!dataNascimento) return null;
  const birthDate = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function getStoredLifeStage(payload: Animal["payload"]) {
  const lifecycle = getLifecycleRecord(payload);
  return isAnimalLifeStage(lifecycle.estagio_vida)
    ? lifecycle.estagio_vida
    : null;
}

function getLatestWeightKg(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  const metrics = asRecord(record.metrics);
  return typeof metrics.last_weight_kg === "number" &&
    Number.isFinite(metrics.last_weight_kg)
    ? metrics.last_weight_kg
    : null;
}

function hasRecordedWeaning(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  const weaning = asRecord(record.weaning);
  return typeof weaning.completed_at === "string";
}

function isAnimalLifeStage(value: unknown): value is AnimalLifeStageEnum {
  return (
    value === "cria_neonatal" ||
    value === "cria_aleitamento" ||
    value === "desmamado" ||
    value === "recria" ||
    value === "garrote" ||
    value === "novilha" ||
    value === "vaca_adulta" ||
    value === "touro" ||
    value === "boi_adulto" ||
    value === "terminacao"
  );
}

export function inferAnimalLifeStage(
  animal: Pick<
    Animal,
    "sexo" | "data_nascimento" | "payload" | "papel_macho" | "habilitado_monta"
  >,
  config: FarmLifecycleConfig = DEFAULT_FARM_LIFECYCLE_CONFIG,
): AnimalLifeStageEnum {
  const ageInDays = getAgeInDays(animal.data_nascimento);
  const latestWeightKg = getLatestWeightKg(animal.payload);
  const destination = getAnimalProductiveDestination(animal);
  const reproductiveStatus = getMaleReproductiveStatus(animal);
  const weaned = hasRecordedWeaning(animal.payload);
  const useWeightBasis =
    config.stage_classification_basis === "peso" && latestWeightKg !== null;

  if (!weaned) {
    if (ageInDays === null || ageInDays <= config.neonatal_days) {
      return "cria_neonatal";
    }

    if (
      (useWeightBasis && latestWeightKg < config.weaning_weight_kg) ||
      (!useWeightBasis && ageInDays < config.weaning_days)
    ) {
      return "cria_aleitamento";
    }
  }

  if (
    weaned ||
    (useWeightBasis && latestWeightKg >= config.weaning_weight_kg) ||
    (!useWeightBasis && ageInDays !== null && ageInDays >= config.weaning_days)
  ) {
    if (animal.sexo === "F") {
      return (useWeightBasis
        ? latestWeightKg >= config.female_adult_weight_kg
        : ageInDays !== null && ageInDays >= config.female_adult_days)
        ? "vaca_adulta"
        : "novilha";
    }

    if (destination === "reprodutor" && reproductiveStatus === "apto") {
      return (useWeightBasis
        ? latestWeightKg >= config.male_adult_weight_kg
        : ageInDays !== null && ageInDays >= config.male_adult_days)
        ? "touro"
        : "garrote";
    }

    if (destination && !isMaleBreedingDestination(destination)) {
      return (useWeightBasis
        ? latestWeightKg >= config.male_adult_weight_kg
        : ageInDays !== null && ageInDays >= config.male_adult_days)
        ? "terminacao"
        : "recria";
    }

    if (destination === "rufiao") {
      return (useWeightBasis
        ? latestWeightKg >= config.male_breeding_candidate_weight_kg
        : ageInDays !== null &&
          ageInDays >= config.male_breeding_candidate_days)
        ? "garrote"
        : "recria";
    }

    if (
      (useWeightBasis && latestWeightKg >= config.male_adult_weight_kg) ||
      (!useWeightBasis && ageInDays !== null && ageInDays >= config.male_adult_days)
    ) {
      return "boi_adulto";
    }

    if (
      (useWeightBasis &&
        latestWeightKg >= config.male_breeding_candidate_weight_kg) ||
      (!useWeightBasis &&
        ageInDays !== null &&
        ageInDays >= config.male_breeding_candidate_days)
    ) {
      return "garrote";
    }
  }

  return "desmamado";
}

export interface AnimalLifecycleSnapshot {
  currentStage: AnimalLifeStageEnum;
  currentStageSource: LifecycleSource;
  targetStage: AnimalLifeStageEnum;
  targetStageReason: string;
  transitionMode: ModoTransicaoEstagioEnum;
  shouldSuggestTransition: boolean;
  suggestionKind: "initialize" | "transition" | null;
  canAutoApply: boolean;
}

export interface PendingAnimalLifecycleTransition {
  animalId: string;
  identificacao: string;
  currentStage: AnimalLifeStageEnum;
  targetStage: AnimalLifeStageEnum;
  queueKind: PendingAnimalLifecycleKind;
  transitionMode: ModoTransicaoEstagioEnum;
  suggestionKind: "initialize" | "transition";
  canAutoApply: boolean;
  reason: string;
}

export interface PendingAnimalLifecycleSummary {
  total: number;
  strategic: number;
  biological: number;
  manual: number;
  autoApply: number;
}

function getTargetStageReason(
  animal: Pick<
    Animal,
    "sexo" | "data_nascimento" | "payload" | "papel_macho" | "habilitado_monta"
  >,
  config: FarmLifecycleConfig,
  targetStage: AnimalLifeStageEnum,
) {
  const ageInDays = getAgeInDays(animal.data_nascimento);
  const destination = getAnimalProductiveDestination(animal);
  const reproductiveStatus = getMaleReproductiveStatus(animal);

  switch (targetStage) {
    case "cria_neonatal":
      return `Faixa neonatal ate ${config.neonatal_days} dias.`;
    case "cria_aleitamento":
      return `Animal ainda em aleitamento antes do marco de ${config.weaning_days} dias.`;
    case "desmamado":
      return "Desmame concluido e entrada na fase pos-aleitamento.";
    case "novilha":
      return `Femea desmamada abaixo de ${config.female_adult_days} dias.`;
    case "vaca_adulta":
      return `Femea acima do marco adulto de ${config.female_adult_days} dias.`;
    case "garrote":
      return destination === "reprodutor"
        ? `Macho reprodutivo em preparo antes do marco adulto de ${config.male_adult_days} dias.`
        : `Macho acima de ${config.male_breeding_candidate_days} dias, ainda sem aptidao plena.`;
    case "touro":
      return `Destino reprodutivo confirmado com status ${reproductiveStatus ?? "apto"} e idade adulta.`;
    case "terminacao":
      return `Destino ${destination ?? "produtivo"} em fase final de ganho/saida.`;
    case "boi_adulto":
      return `Macho adulto acima de ${config.male_adult_days} dias sem perfil reprodutivo ativo.`;
    case "recria":
      return ageInDays !== null
        ? `Animal em crescimento com ${ageInDays} dias e fora dos marcos finais.`
        : "Animal em crescimento pos-desmame.";
    default:
      return "Estagio inferido a partir da idade e do destino produtivo.";
  }
}

function isAgeOnlyTransition(
  currentStage: AnimalLifeStageEnum,
  targetStage: AnimalLifeStageEnum,
) {
  const strategicTargets = new Set<AnimalLifeStageEnum>([
    "touro",
    "terminacao",
  ]);

  return !strategicTargets.has(targetStage) && currentStage !== "touro";
}

export function resolveAnimalLifecycleSnapshot(
  animal: Pick<
    Animal,
    "sexo" | "data_nascimento" | "payload" | "papel_macho" | "habilitado_monta"
  >,
  config: FarmLifecycleConfig = DEFAULT_FARM_LIFECYCLE_CONFIG,
): AnimalLifecycleSnapshot {
  const storedStage = getStoredLifeStage(animal.payload);
  const targetStage = inferAnimalLifeStage(animal, config);
  const transitionMode =
    getAnimalTransitionMode(animal) ?? config.default_transition_mode;
  const currentStage = storedStage ?? targetStage;
  const currentStageSource: LifecycleSource = storedStage ? "stored" : "inferred";
  const shouldSuggestTransition =
    storedStage === null ? true : storedStage !== targetStage;
  const suggestionKind =
    shouldSuggestTransition && storedStage === null
      ? "initialize"
      : shouldSuggestTransition
        ? "transition"
        : null;
  const canAutoApply =
    shouldSuggestTransition &&
    (transitionMode === "automatico" ||
      (transitionMode === "hibrido" &&
        config.hybrid_auto_apply_age_stages &&
        isAgeOnlyTransition(currentStage, targetStage)));

  return {
    currentStage,
    currentStageSource,
    targetStage,
    targetStageReason: getTargetStageReason(animal, config, targetStage),
    transitionMode,
    shouldSuggestTransition,
    suggestionKind,
    canAutoApply,
  };
}

export function buildAnimalLifecyclePayload(
  currentPayload: Animal["payload"] | null | undefined,
  stage: AnimalLifeStageEnum,
  source: "manual" | "automatico",
  occurredAt = new Date().toISOString(),
) {
  const nextPayload = { ...getAnimalPayloadRecord(currentPayload) };
  const lifecycle = { ...getLifecycleRecord(currentPayload) };

  lifecycle.estagio_vida = stage;
  lifecycle.estagio_source = source;
  lifecycle.estagio_recorded_at = occurredAt;

  nextPayload.lifecycle = lifecycle;
  return nextPayload;
}

export function getAnimalLifeStageLabel(stage: AnimalLifeStageEnum) {
  switch (stage) {
    case "cria_neonatal":
      return "Cria neonatal";
    case "cria_aleitamento":
      return "Cria em aleitamento";
    case "desmamado":
      return "Desmamado";
    case "recria":
      return "Recria";
    case "garrote":
      return "Garrote";
    case "novilha":
      return "Novilha";
    case "vaca_adulta":
      return "Vaca adulta";
    case "touro":
      return "Touro";
    case "boi_adulto":
      return "Boi adulto";
    case "terminacao":
      return "Terminacao";
  }
}

export function getPendingAnimalLifecycleKindLabel(
  kind: PendingAnimalLifecycleKind,
) {
  return kind === "decisao_estrategica"
    ? "Decisao estrategica"
    : "Marco biologico";
}

function getPendingAnimalLifecycleKind(
  animal: Pick<
    Animal,
    "sexo" | "payload" | "papel_macho" | "habilitado_monta"
  >,
  targetStage: AnimalLifeStageEnum,
): PendingAnimalLifecycleKind {
  const destination = getAnimalProductiveDestination(animal);
  const reproductiveStatus = getMaleReproductiveStatus(animal);

  if (
    targetStage === "touro" ||
    targetStage === "terminacao" ||
    (animal.sexo === "M" &&
      destination !== null &&
      (targetStage === "garrote" ||
        targetStage === "recria" ||
        targetStage === "boi_adulto")) ||
    (animal.sexo === "M" &&
      reproductiveStatus !== null &&
      reproductiveStatus !== "inativo" &&
      (targetStage === "garrote" || targetStage === "boi_adulto"))
  ) {
    return "decisao_estrategica";
  }

  return "marco_biologico";
}

export function getPendingAnimalLifecycleTransitions(
  animals: Pick<
    Animal,
    | "id"
    | "identificacao"
    | "sexo"
    | "status"
    | "data_nascimento"
    | "payload"
    | "papel_macho"
    | "habilitado_monta"
    | "deleted_at"
  >[],
  config: FarmLifecycleConfig = DEFAULT_FARM_LIFECYCLE_CONFIG,
) {
  return animals
    .filter((animal) => !animal.deleted_at && animal.status === "ativo")
    .map((animal) => {
      const snapshot = resolveAnimalLifecycleSnapshot(animal, config);
      if (!snapshot.shouldSuggestTransition || !snapshot.suggestionKind) {
        return null;
      }

      return {
        animalId: animal.id,
        identificacao: animal.identificacao,
        currentStage: snapshot.currentStage,
        targetStage: snapshot.targetStage,
        queueKind: getPendingAnimalLifecycleKind(animal, snapshot.targetStage),
        transitionMode: snapshot.transitionMode,
        suggestionKind: snapshot.suggestionKind,
        canAutoApply: snapshot.canAutoApply,
        reason: snapshot.targetStageReason,
      } satisfies PendingAnimalLifecycleTransition;
    })
    .filter(
      (
        item,
      ): item is PendingAnimalLifecycleTransition => item !== null,
    )
    .sort((left, right) => {
      if (left.canAutoApply !== right.canAutoApply) {
        return left.canAutoApply ? 1 : -1;
      }
      if (left.queueKind !== right.queueKind) {
        return left.queueKind === "decisao_estrategica" ? -1 : 1;
      }
      if (left.suggestionKind !== right.suggestionKind) {
        return left.suggestionKind === "transition" ? -1 : 1;
      }
      return left.identificacao.localeCompare(right.identificacao);
    });
}

export function summarizePendingAnimalLifecycleTransitions(
  items: PendingAnimalLifecycleTransition[],
): PendingAnimalLifecycleSummary {
  const strategic = items.filter(
    (item) => item.queueKind === "decisao_estrategica",
  ).length;
  const autoApply = items.filter((item) => item.canAutoApply).length;

  return {
    total: items.length,
    strategic,
    biological: items.length - strategic,
    manual: items.length - autoApply,
    autoApply,
  };
}
