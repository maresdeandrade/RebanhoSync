import type { Animal } from "@/lib/offline/types";
import { isAnimalBreedingEligible } from "@/lib/animals/maleProfile";
import { deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";

export type AnimalVisualRole =
  | "vaca"
  | "novilha"
  | "boi"
  | "touro"
  | "garrote"
  | "bezerro"
  | "bezerra";

export interface AnimalVisualProfile {
  role: AnimalVisualRole;
  label: string;
  toneClassName: string;
  icon: "adult" | "calf";
  headClassName: string;
  modifier: "female" | "male" | "weight" | "maternal";
  frameClassName: string;
}

function getAgeInDays(dataNascimento: string | null | undefined): number | null {
  if (!dataNascimento) return null;

  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;

  return Math.floor((Date.now() - nascimento.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAnimalVisualRole(
  animal: Animal,
  categoriaLabel: string | null | undefined,
): AnimalVisualRole {
  const normalized = categoriaLabel?.trim().toLowerCase() ?? "";

  if (normalized.includes("bezerro(a)")) {
    return animal.sexo === "F" ? "bezerra" : "bezerro";
  }
  if (normalized.includes("novilha")) return "novilha";
  if (normalized.includes("vaca")) return "vaca";
  if (normalized.includes("touro")) return "touro";
  if (normalized.includes("garrote")) return "garrote";
  if (normalized.includes("boi")) return "boi";
  if (normalized.includes("bezerra")) return "bezerra";
  if (normalized.includes("bezerro")) return "bezerro";
  if (normalized.includes("bezer")) {
    return animal.sexo === "F" ? "bezerra" : "bezerro";
  }

  const taxonomy = deriveAnimalTaxonomy(animal);
  switch (taxonomy.categoria_zootecnica) {
    case "bezerra":
      return "bezerra";
    case "novilha":
      return "novilha";
    case "vaca":
      return "vaca";
    case "bezerro":
      return "bezerro";
    case "garrote":
      return "garrote";
    case "touro":
      return "touro";
    case "boi_terminacao":
      return "boi";
  }

  const idadeDias = getAgeInDays(animal.data_nascimento);
  if (idadeDias !== null && idadeDias <= 240) {
    return animal.sexo === "F" ? "bezerra" : "bezerro";
  }

  if (animal.sexo === "F") {
    if (idadeDias !== null && idadeDias < 901) {
      return "novilha";
    }
    return "vaca";
  }

  if (isAnimalBreedingEligible(animal)) {
    return "touro";
  }

  if (idadeDias !== null && idadeDias < 731) {
    return "garrote";
  }

  return "boi";
}

export function getAnimalVisualProfile(
  animal: Animal,
  categoriaLabel?: string | null,
): AnimalVisualProfile {
  const role = getAnimalVisualRole(animal, categoriaLabel);
  const femaleTone = "border-rose-200 bg-rose-100 text-rose-800";
  const maleTone = "border-sky-200 bg-sky-100 text-sky-800";

  switch (role) {
    case "bezerra":
      return {
        role,
        label: "Bezerra",
        toneClassName: femaleTone,
        icon: "calf",
        headClassName: "h-4 w-4",
        modifier: "female",
        frameClassName: "h-8 w-8",
      };
    case "bezerro":
      return {
        role,
        label: "Bezerro",
        toneClassName: maleTone,
        icon: "calf",
        headClassName: "h-4 w-4",
        modifier: "male",
        frameClassName: "h-8 w-8",
      };
    case "novilha":
      return {
        role,
        label: "Novilha",
        toneClassName: femaleTone,
        icon: "adult",
        headClassName: "h-5 w-5",
        modifier: "female",
        frameClassName: "h-9 w-9",
      };
    case "vaca":
      return {
        role,
        label: "Vaca",
        toneClassName: femaleTone,
        icon: "adult",
        headClassName: "h-5 w-6",
        modifier: "maternal",
        frameClassName: "h-10 w-10",
      };
    case "touro":
      return {
        role,
        label: "Touro",
        toneClassName: maleTone,
        icon: "adult",
        headClassName: "h-5 w-6",
        modifier: "weight",
        frameClassName: "h-10 w-10",
      };
    case "garrote":
      return {
        role,
        label: "Garrote",
        toneClassName: maleTone,
        icon: "adult",
        headClassName: "h-5 w-5",
        modifier: "male",
        frameClassName: "h-9 w-9",
      };
    case "boi":
    default:
      return {
        role: "boi",
        label: "Boi",
        toneClassName: maleTone,
        icon: "adult",
        headClassName: "h-5 w-6",
        modifier: "male",
        frameClassName: "h-10 w-10",
      };
  }
}

export function isFemaleReproductionEligible(
  animal: Animal,
  categoriaLabel?: string | null,
) {
  if (animal.sexo !== "F") return false;

  const role = getAnimalVisualRole(animal, categoriaLabel);
  return role === "novilha" || role === "vaca";
}
