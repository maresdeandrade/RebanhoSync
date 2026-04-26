import type { FinanceiroTipoEnum } from "@/lib/offline/types";
import {
  resolveFinancialTotalAmount,
  type FinancialPriceMode,
  type FinancialWeightMode,
} from "@/lib/finance/transactions";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";
import {
  isFinanceiroSociedadeNatureza,
  resolveFinanceiroTipoFromNatureza,
} from "@/pages/Registrar/helpers/financialNature";

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
  const financeiroTipo: FinanceiroTipoEnum = resolveFinanceiroTipoFromNatureza(
    input.financeiroData.natureza,
  );
  const isFinanceiroSociedade = isFinanceiroSociedadeNatureza(
    input.financeiroData.natureza,
  );

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
