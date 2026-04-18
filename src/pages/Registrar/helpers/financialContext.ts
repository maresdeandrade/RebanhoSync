import type { FinanceiroTipoEnum } from "@/lib/offline/types";
import {
  resolveFinancialTotalAmount,
  type FinancialPriceMode,
  type FinancialWeightMode,
} from "@/lib/finance/transactions";

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

type FinanceiroDataLike = {
  natureza: FinanceiroNatureza;
  modoPreco: FinancialPriceMode;
  valorUnitario: string;
  valorTotal: string;
  quantidadeAnimais: string;
  modoPeso: FinancialWeightMode;
  pesoLoteKg: string;
};

type DeriveRegistrarFinancialContextInput = {
  financeiroData: FinanceiroDataLike;
  selectedAnimalsCount: number;
  parseUserWeight: (value: string) => number | null;
};

export function parseRegistrarNumeric(value: string): number {
  return Number.parseFloat(value.replace(",", "."));
}

export function deriveRegistrarFinancialContext(
  input: DeriveRegistrarFinancialContextInput,
) {
  const financeiroTipo: FinanceiroTipoEnum =
    input.financeiroData.natureza === "venda" ||
    input.financeiroData.natureza === "sociedade_saida"
      ? "venda"
      : "compra";

  const isFinanceiroSociedade =
    input.financeiroData.natureza === "sociedade_entrada" ||
    input.financeiroData.natureza === "sociedade_saida";

  const financeiroQuantidadeAnimais =
    input.selectedAnimalsCount > 0
      ? input.selectedAnimalsCount
      : Math.max(
          1,
          Number.parseInt(input.financeiroData.quantidadeAnimais || "1", 10) || 1,
        );

  const financeiroValorUnitario =
    input.financeiroData.valorUnitario.trim() !== ""
      ? parseRegistrarNumeric(input.financeiroData.valorUnitario)
      : null;

  const financeiroValorTotalInformado =
    input.financeiroData.valorTotal.trim() !== ""
      ? parseRegistrarNumeric(input.financeiroData.valorTotal)
      : null;

  const financeiroPesoLote =
    input.financeiroData.pesoLoteKg.trim() !== ""
      ? input.parseUserWeight(input.financeiroData.pesoLoteKg)
      : null;

  const financeiroValorTotalCalculado = resolveFinancialTotalAmount({
    quantity: financeiroQuantidadeAnimais,
    priceMode: input.financeiroData.modoPreco,
    totalAmount: financeiroValorTotalInformado,
    unitAmount: financeiroValorUnitario,
  });

  return {
    financeiroTipo,
    isFinanceiroSociedade,
    financeiroQuantidadeAnimais,
    financeiroValorUnitario,
    financeiroValorTotalInformado,
    financeiroPesoLote,
    financeiroValorTotalCalculado,
  };
}
