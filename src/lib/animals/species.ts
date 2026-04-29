export const ANIMAL_SPECIES_OPTIONS = [
  { value: "bovino", label: "Bovino" },
  { value: "bubalino", label: "Bubalino" },
] as const;

export type AnimalSpeciesEnum = (typeof ANIMAL_SPECIES_OPTIONS)[number]["value"];

const SPECIES_LABELS = new Map(
  ANIMAL_SPECIES_OPTIONS.map((option) => [option.value, option.label]),
);

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAnimalSpeciesText(value: string) {
  return stripDiacritics(value).trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseAnimalSpecies(value: string): AnimalSpeciesEnum | null {
  const normalized = normalizeAnimalSpeciesText(value);

  if (normalized === "bovino" || normalized === "bubalino") {
    return normalized;
  }

  return null;
}

export function formatAnimalSpecies(value: AnimalSpeciesEnum | null | undefined) {
  if (!value) return "Nao informada";
  return SPECIES_LABELS.get(value) ?? value;
}
