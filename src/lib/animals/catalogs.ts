export const ANIMAL_BREED_OPTIONS = [
  { value: "nelore", label: "Nelore" },
  { value: "angus", label: "Angus" },
  { value: "brahman", label: "Brahman" },
  { value: "brangus", label: "Brangus" },
  { value: "braford", label: "Braford" },
  { value: "gir", label: "Gir" },
  { value: "girolando", label: "Girolando" },
  { value: "holandes", label: "Holandes" },
  { value: "jersey", label: "Jersey" },
  { value: "senepol", label: "Senepol" },
  { value: "tabapua", label: "Tabapua" },
  { value: "canchim", label: "Canchim" },
  { value: "caracu", label: "Caracu" },
  { value: "charoles", label: "Charoles" },
  { value: "hereford", label: "Hereford" },
  { value: "limousin", label: "Limousin" },
  { value: "simental", label: "Simental" },
  { value: "mestico", label: "Mestico" },
  { value: "outra", label: "Outra" },
] as const;

export type AnimalBreedEnum = (typeof ANIMAL_BREED_OPTIONS)[number]["value"];

const BREED_LABELS = new Map(
  ANIMAL_BREED_OPTIONS.map((option) => [option.value, option.label]),
);

const BREED_ALIASES: Record<string, AnimalBreedEnum> = {
  nelore: "nelore",
  angus: "angus",
  brahman: "brahman",
  brangus: "brangus",
  braford: "braford",
  gir: "gir",
  girolando: "girolando",
  holandes: "holandes",
  holandesa: "holandes",
  jersey: "jersey",
  senepol: "senepol",
  tabapua: "tabapua",
  tabapuã: "tabapua",
  canchim: "canchim",
  caracu: "caracu",
  charoles: "charoles",
  charolesa: "charoles",
  hereford: "hereford",
  limousin: "limousin",
  simental: "simental",
  mestiço: "mestico",
  mestico: "mestico",
  cruzado: "mestico",
  outra: "outra",
  outro: "outra",
};

export function parseAnimalBreed(
  value: string | null | undefined,
): AnimalBreedEnum | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return BREED_ALIASES[normalized] ?? null;
}

export function getAnimalBreedLabel(value: string | null | undefined) {
  if (!value) return null;
  return BREED_LABELS.get(value as AnimalBreedEnum) ?? value;
}

export const REPRODUCTION_TECHNIQUE_OPTIONS = [
  { value: "monta_natural", label: "Monta natural" },
  { value: "repasse", label: "Repasse" },
  { value: "iatf", label: "IATF" },
  { value: "ia_convencional", label: "IA convencional" },
  { value: "semen_sexado", label: "Semen sexado" },
  { value: "semen_convencional", label: "Semen convencional" },
  { value: "externo_identificado", label: "Reprodutor externo identificado" },
  { value: "externo_sem_identificacao", label: "Reprodutor externo sem identificacao" },
] as const;

export type ReproductionTechniqueEnum =
  (typeof REPRODUCTION_TECHNIQUE_OPTIONS)[number]["value"];

const REPRO_TECHNIQUE_LABELS = new Map(
  REPRODUCTION_TECHNIQUE_OPTIONS.map((option) => [option.value, option.label]),
);

export function getReproductionTechniqueLabel(
  value: string | null | undefined,
) {
  if (!value) return null;
  return REPRO_TECHNIQUE_LABELS.get(value as ReproductionTechniqueEnum) ?? value;
}

export const REPRODUCTION_BULL_REFERENCE_OPTIONS = [
  { value: "cadastrado_no_rebanho", label: "Cadastrado no rebanho" },
  { value: "externo_identificado", label: "Externo identificado" },
  { value: "externo_sem_identificacao", label: "Externo sem identificacao" },
  { value: "semen_lote_identificado", label: "Semen com lote identificado" },
] as const;

export type ReproductionBullReferenceEnum =
  (typeof REPRODUCTION_BULL_REFERENCE_OPTIONS)[number]["value"];

const REPRO_BULL_REFERENCE_LABELS = new Map(
  REPRODUCTION_BULL_REFERENCE_OPTIONS.map((option) => [option.value, option.label]),
);

export function getReproductionBullReferenceLabel(
  value: string | null | undefined,
) {
  if (!value) return null;
  return REPRO_BULL_REFERENCE_LABELS.get(value as ReproductionBullReferenceEnum) ?? value;
}
