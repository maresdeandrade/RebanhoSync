import type { Animal } from "@/lib/offline/types";
import type { FinancialWeightMode } from "@/lib/finance/transactions";

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

type CompraNovoAnimalDraft = {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string;
  pesoKg: string;
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
  if (input.natureza === "compra") {
    return input.compraNovosAnimais.map((draft) => ({
      localId: draft.localId,
      identificacao: draft.identificacao.trim(),
      sexo: draft.sexo,
      dataNascimento: draft.dataNascimento || null,
      pesoKg:
        input.modoPeso === "individual" ? input.parseUserWeight(draft.pesoKg) : null,
    }));
  }

  return input.selectedAnimalRecords.map((animal, index) => ({
    localId: animal.id,
    identificacao: animal.identificacao,
    sexo: "M" as const,
    dataNascimento: null,
    pesoKg:
      input.modoPeso === "individual"
        ? input.parseUserWeight(input.compraNovosAnimais[index]?.pesoKg || "")
        : null,
  }));
}
