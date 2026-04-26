import type { Animal } from "@/lib/offline/types";
import type { FinancialWeightMode } from "@/lib/finance/transactions";
import type { AnimalBreedEnum } from "@/lib/animals/catalogs";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";
import {
  isFinanceiroSaidaNatureza,
  supportsDraftAnimalsInFinanceiroNatureza,
} from "@/pages/Registrar/helpers/financialNature";

type CompraNovoAnimalDraft = {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string;
  pesoKg: string;
  raca: AnimalBreedEnum | null;
};

export type RegistrarSelectedAnimalRecord = {
  id: string;
  identificacao: string;
  loteId: string | null;
};

export type RegistrarPurchaseAnimalInput = {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string | null;
  pesoKg: number | null;
  raca: AnimalBreedEnum | null;
};

export function buildRegistrarSelectedAnimalRecords(input: {
  selectedAnimalIds: string[];
  animalsMap: Map<string, Animal>;
  fallbackLoteId: string | null;
}) {
  return input.selectedAnimalIds
    .map((animalId) => {
      const animal = input.animalsMap.get(animalId);
      if (!animal) return null;
      return {
        id: animal.id,
        identificacao: animal.identificacao,
        loteId: animal.lote_id ?? input.fallbackLoteId,
      };
    })
    .filter(
      (
        animal,
      ): animal is {
        id: string;
        identificacao: string;
        loteId: string | null;
      } => animal !== null,
    );
}

export function buildRegistrarFinancialPurchaseAnimals(input: {
  natureza: FinanceiroNatureza;
  compraNovosAnimais: CompraNovoAnimalDraft[];
  selectedAnimalRecords: RegistrarSelectedAnimalRecord[];
  modoPeso: FinancialWeightMode;
  parseUserWeight: (value: string) => number | null;
}) {
  if (supportsDraftAnimalsInFinanceiroNatureza(input.natureza)) {
    return input.compraNovosAnimais.map((draft) => ({
      localId: draft.localId,
      identificacao: draft.identificacao.trim(),
      sexo: draft.sexo,
      dataNascimento: draft.dataNascimento || null,
      pesoKg:
        input.modoPeso === "individual" ? input.parseUserWeight(draft.pesoKg) : null,
      raca: draft.raca ?? null,
    }));
  }

  if (isFinanceiroSaidaNatureza(input.natureza)) {
    return input.selectedAnimalRecords.map((animal, index) => ({
      localId: animal.id,
      identificacao: animal.identificacao,
      sexo: "M" as const,
      dataNascimento: null,
      pesoKg:
        input.modoPeso === "individual"
          ? input.parseUserWeight(input.compraNovosAnimais[index]?.pesoKg || "")
          : null,
      raca: null,
    }));
  }

  return [];
}
