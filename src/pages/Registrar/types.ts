import type {
  FinancialPriceMode,
  FinancialWeightMode,
} from "@/lib/finance/transactions";

export type RegistrarSexo = "M" | "F";

export interface CompraNovoAnimalDraft {
  localId: string;
  identificacao: string;
  sexo: RegistrarSexo;
  dataNascimento: string;
  pesoKg: string;
}

export type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

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
