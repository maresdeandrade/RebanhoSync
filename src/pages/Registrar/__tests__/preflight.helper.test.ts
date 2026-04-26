import { describe, expect, it } from "vitest";
import {
  resolveRegistrarPreflightIssue,
  type RegistrarPreflightInput,
} from "@/pages/Registrar/helpers/preflight";

function buildBaseInput(
  overrides: Partial<RegistrarPreflightInput> = {},
): RegistrarPreflightInput {
  return {
    tipoManejo: "financeiro",
    selectedAnimais: ["animal-1"],
    selectedLoteId: "lote-1",
    partoRequiresSingleMatrix: false,
    isFinanceiroSociedade: false,
    financeiroData: {
      natureza: "venda",
      modoPeso: "nenhum",
      modoPreco: "por_lote",
      contraparteId: "cp-1",
    },
    financeiroValorTotalCalculado: 1200,
    financeiroPesoLote: null,
    financeiroValorUnitario: null,
    financeiroQuantidadeAnimais: 1,
    compraNovosAnimais: [],
    pesagemData: {},
    transitChecklistIssues: [],
    complianceFlowIssues: [],
    parseUserWeight: (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
    ...overrides,
  };
}

describe("resolveRegistrarPreflightIssue", () => {
  it("retorna erro quando sociedade não possui contraparte", () => {
    const issue = resolveRegistrarPreflightIssue(
      buildBaseInput({
        isFinanceiroSociedade: true,
        financeiroData: {
          natureza: "sociedade_entrada",
          modoPeso: "nenhum",
          modoPreco: "por_lote",
          contraparteId: "none",
        },
      }),
    );

    expect(issue).toBe(
      "Selecione ou cadastre uma contraparte para evento de sociedade.",
    );
  });

  it("retorna erro quando compra por lote está sem lote selecionado", () => {
    const issue = resolveRegistrarPreflightIssue(
      buildBaseInput({
        tipoManejo: "financeiro",
        selectedAnimais: [],
        selectedLoteId: "",
        financeiroData: {
          natureza: "compra",
          modoPeso: "nenhum",
          modoPreco: "por_lote",
          contraparteId: "cp-1",
        },
      }),
    );

    expect(issue).toBe("Selecione um lote para registrar entrada sem animais.");
  });

  it("retorna erro para pesagem com peso inválido", () => {
    const issue = resolveRegistrarPreflightIssue(
      buildBaseInput({
        tipoManejo: "pesagem",
        selectedAnimais: ["animal-1", "animal-2"],
        pesagemData: {
          "animal-1": "350",
          "animal-2": "",
        },
      }),
    );

    expect(issue).toBe("Informe um peso maior que zero para todos os animais.");
  });

  it("retorna erro para compra com identificações duplicadas", () => {
    const issue = resolveRegistrarPreflightIssue(
      buildBaseInput({
        tipoManejo: "financeiro",
        selectedAnimais: [],
        financeiroData: {
          natureza: "compra",
          modoPeso: "individual",
          modoPreco: "por_lote",
          contraparteId: "cp-1",
        },
        financeiroQuantidadeAnimais: 2,
        compraNovosAnimais: [
          { identificacao: "BZ-01", dataNascimento: "", pesoKg: "30", raca: null },
          { identificacao: "bz-01", dataNascimento: "", pesoKg: "31", raca: null },
        ],
      }),
    );

    expect(issue).toBe("Nao repita identificacoes nos novos animais.");
  });

  it("prioriza erro de checklist de trânsito quando existir", () => {
    const issue = resolveRegistrarPreflightIssue(
      buildBaseInput({
        transitChecklistIssues: ["Checklist faltando GTA."],
      }),
    );

    expect(issue).toBe("Checklist faltando GTA.");
  });

  it("retorna null no caminho feliz", () => {
    const issue = resolveRegistrarPreflightIssue(buildBaseInput());
    expect(issue).toBeNull();
  });

  it("permite doacao sem valor financeiro informado", () => {
    const issue = resolveRegistrarPreflightIssue(
      buildBaseInput({
        selectedAnimais: [],
        financeiroData: {
          natureza: "doacao_entrada",
          modoPeso: "nenhum",
          modoPreco: "por_lote",
          contraparteId: "none",
        },
        financeiroValorTotalCalculado: 0,
        financeiroQuantidadeAnimais: 1,
        compraNovosAnimais: [
          { identificacao: "DOA-01", dataNascimento: "", pesoKg: "", raca: null },
        ],
      }),
    );

    expect(issue).toBeNull();
  });
});
