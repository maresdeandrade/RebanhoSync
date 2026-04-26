import { describe, expect, it } from "vitest";
import {
  deriveRegistrarFinancialContext,
  parseRegistrarNumeric,
} from "@/pages/Registrar/helpers/financialContext";

describe("parseRegistrarNumeric", () => {
  it("converte decimal com virgula", () => {
    expect(parseRegistrarNumeric("12,5")).toBe(12.5);
  });
});

describe("deriveRegistrarFinancialContext", () => {
  it("deriva natureza venda para financeiroTipo venda e sociedade true", () => {
    const result = deriveRegistrarFinancialContext({
      financeiroData: {
        natureza: "sociedade_saida",
        modoPreco: "por_lote",
        valorUnitario: "",
        valorTotal: "1000",
        quantidadeAnimais: "3",
        modoPeso: "lote",
        pesoLoteKg: "350,4",
      },
      selectedAnimalsCount: 0,
      parseUserWeight: (value) => parseRegistrarNumeric(value),
    });

    expect(result.financeiroTipo).toBe("venda");
    expect(result.isFinanceiroSociedade).toBe(true);
    expect(result.financeiroQuantidadeAnimais).toBe(3);
    expect(result.financeiroPesoLote).toBe(350.4);
  });

  it("prioriza quantidade de animais selecionados sobre campo digitado", () => {
    const result = deriveRegistrarFinancialContext({
      financeiroData: {
        natureza: "compra",
        modoPreco: "por_animal",
        valorUnitario: "25",
        valorTotal: "",
        quantidadeAnimais: "99",
        modoPeso: "nenhum",
        pesoLoteKg: "",
      },
      selectedAnimalsCount: 4,
      parseUserWeight: () => null,
    });

    expect(result.financeiroQuantidadeAnimais).toBe(4);
    expect(result.financeiroValorTotalCalculado).toBe(100);
  });

  it("mapeia doacao de entrada para tipo compra", () => {
    const result = deriveRegistrarFinancialContext({
      financeiroData: {
        natureza: "doacao_entrada",
        modoPreco: "por_lote",
        valorUnitario: "",
        valorTotal: "0",
        quantidadeAnimais: "2",
        modoPeso: "nenhum",
        pesoLoteKg: "",
      },
      selectedAnimalsCount: 0,
      parseUserWeight: () => null,
    });

    expect(result.financeiroTipo).toBe("compra");
    expect(result.isFinanceiroSociedade).toBe(false);
  });
});
