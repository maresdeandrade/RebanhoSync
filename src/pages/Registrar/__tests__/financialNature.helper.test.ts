import { describe, expect, it } from "vitest";
import {
  resolveFinanceiroNaturezaOptions,
  supportsDraftAnimalsInFinanceiroNatureza,
} from "@/pages/Registrar/helpers/financialNature";

describe("financialNature helpers", () => {
  it("filtra opcoes de entrada para fluxos de compra", () => {
    const options = resolveFinanceiroNaturezaOptions("compra");
    expect(options.map((item) => item.value)).toEqual([
      "compra",
      "sociedade_entrada",
      "doacao_entrada",
      "arrendamento",
    ]);
  });

  it("filtra opcoes de saida para fluxos de venda", () => {
    const options = resolveFinanceiroNaturezaOptions("venda");
    expect(options.map((item) => item.value)).toEqual([
      "venda",
      "sociedade_saida",
      "doacao_saida",
    ]);
  });

  it("permite gerar novos animais apenas em naturezas de entrada com cadastro", () => {
    expect(supportsDraftAnimalsInFinanceiroNatureza("compra")).toBe(true);
    expect(supportsDraftAnimalsInFinanceiroNatureza("arrendamento")).toBe(true);
    expect(supportsDraftAnimalsInFinanceiroNatureza("doacao_saida")).toBe(false);
  });
});
