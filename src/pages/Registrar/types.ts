import type {
  FinancialPriceMode,
  FinancialWeightMode,
} from "@/lib/finance/transactions";
import type { AnimalBreedEnum } from "@/lib/animals/catalogs";

export type RegistrarSexo = "M" | "F";

export interface CompraNovoAnimalDraft {
  localId: string;
  identificacao: string;
  sexo: RegistrarSexo;
  dataNascimento: string;
  pesoKg: string;
  raca: AnimalBreedEnum | null;
}

export type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida"
  | "doacao_entrada"
  | "doacao_saida"
  | "arrendamento";

export interface FinanceiroFormData {
  natureza: FinanceiroNatureza;
  contraparteId: string;
  modoPreco: FinancialPriceMode;
  valorUnitario: string;
  valorTotal: string;
  quantidadeAnimais: string;
  modoPeso: FinancialWeightMode;
  pesoLoteKg: string;
}
