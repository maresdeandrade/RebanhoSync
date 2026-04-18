import { describe, expect, it } from "vitest";
import {
  buildBaseActionStepIssues,
  buildProtocolEligibilityIssues,
  buildSanitaryMovementBlockIssues,
  composeRegistrarActionStepIssues,
} from "@/pages/Registrar/helpers/actionStepIssues";

describe("buildBaseActionStepIssues", () => {
  it("retorna issue padrão quando manejo não foi selecionado", () => {
    const issues = buildBaseActionStepIssues({
      tipoManejo: null,
      sanitatioProductMissing: false,
      pesagemAnimaisInvalidosCount: 0,
      movimentacaoSemDestino: false,
      movimentacaoDestinoIgualOrigem: false,
      nutricaoAlimentoMissing: false,
      nutricaoQuantidadeInvalida: false,
      isFinanceiroSociedade: false,
      financeiroContraparteId: "x",
      partoRequiresSingleMatrix: false,
    });

    expect(issues).toEqual(["Escolha um manejo antes de continuar."]);
  });

  it("retorna issue de anti-teleporte para movimentação com destino igual origem", () => {
    const issues = buildBaseActionStepIssues({
      tipoManejo: "movimentacao",
      sanitatioProductMissing: false,
      pesagemAnimaisInvalidosCount: 0,
      movimentacaoSemDestino: false,
      movimentacaoDestinoIgualOrigem: true,
      nutricaoAlimentoMissing: false,
      nutricaoQuantidadeInvalida: false,
      isFinanceiroSociedade: false,
      financeiroContraparteId: "x",
      partoRequiresSingleMatrix: false,
    });

    expect(issues).toEqual(["Origem e destino devem ser diferentes."]);
  });

  it("retorna issue quando financeiro de sociedade não tem contraparte", () => {
    const issues = buildBaseActionStepIssues({
      tipoManejo: "financeiro",
      sanitatioProductMissing: false,
      pesagemAnimaisInvalidosCount: 0,
      movimentacaoSemDestino: false,
      movimentacaoDestinoIgualOrigem: false,
      nutricaoAlimentoMissing: false,
      nutricaoQuantidadeInvalida: false,
      isFinanceiroSociedade: true,
      financeiroContraparteId: "none",
      partoRequiresSingleMatrix: false,
    });

    expect(issues).toEqual([
      "Eventos de sociedade exigem uma contraparte vinculada.",
    ]);
  });

  it("acumula issues de nutrição quando campos obrigatórios estão inválidos", () => {
    const issues = buildBaseActionStepIssues({
      tipoManejo: "nutricao",
      sanitatioProductMissing: false,
      pesagemAnimaisInvalidosCount: 0,
      movimentacaoSemDestino: false,
      movimentacaoDestinoIgualOrigem: false,
      nutricaoAlimentoMissing: true,
      nutricaoQuantidadeInvalida: true,
      isFinanceiroSociedade: false,
      financeiroContraparteId: "x",
      partoRequiresSingleMatrix: false,
    });

    expect(issues).toEqual([
      "Informe o alimento usado no manejo.",
      "Quantidade de nutricao deve ser maior que zero.",
    ]);
  });
});

describe("composeRegistrarActionStepIssues", () => {
  it("concatena issues de todos os blocos na ordem do fluxo", () => {
    const issues = composeRegistrarActionStepIssues({
      baseIssues: ["base"],
      protocolEligibilityIssues: ["protocol"],
      sanitaryMovementBlockIssues: ["sanitary"],
      complianceFlowIssues: ["compliance"],
      transitChecklistIssues: ["transit"],
    });

    expect(issues).toEqual([
      "base",
      "protocol",
      "sanitary",
      "compliance",
      "transit",
    ]);
  });

  it("retorna vazio quando nenhum bloco possui issue", () => {
    const issues = composeRegistrarActionStepIssues({
      baseIssues: [],
      protocolEligibilityIssues: [],
      sanitaryMovementBlockIssues: [],
      complianceFlowIssues: [],
      transitChecklistIssues: [],
    });

    expect(issues).toEqual([]);
  });
});

describe("buildSanitaryMovementBlockIssues", () => {
  it("retorna vazio quando checklist de transito nao esta ativo", () => {
    const issues = buildSanitaryMovementBlockIssues({
      showsTransitChecklist: false,
      blockedAnimals: [{ animal: { identificacao: "BR-001" } }],
    });

    expect(issues).toEqual([]);
  });

  it("gera mensagem singular para um animal bloqueado", () => {
    const issues = buildSanitaryMovementBlockIssues({
      showsTransitChecklist: true,
      blockedAnimals: [{ animal: { identificacao: "BR-001" } }],
    });

    expect(issues).toEqual([
      "BR-001 esta com suspeita sanitaria aberta e nao pode sair da fazenda.",
    ]);
  });

  it("gera mensagem agregada quando ha multiplos bloqueios", () => {
    const issues = buildSanitaryMovementBlockIssues({
      showsTransitChecklist: true,
      blockedAnimals: [
        { animal: { identificacao: "BR-001" } },
        { animal: { identificacao: "BR-002" } },
      ],
    });

    expect(issues).toEqual([
      "2 animal(is) do recorte atual estao com suspeita sanitaria aberta e bloqueio de movimentacao.",
    ]);
  });
});

describe("buildProtocolEligibilityIssues", () => {
  it("retorna vazio fora do fluxo sanitario", () => {
    const issues = buildProtocolEligibilityIssues({
      tipoManejo: "movimentacao",
      selectedProtocolCompatibleWithAll: false,
    });

    expect(issues).toEqual([]);
  });

  it("retorna vazio quando nao ha item selecionado", () => {
    const issues = buildProtocolEligibilityIssues({
      tipoManejo: "sanitario",
      selectedProtocolCompatibleWithAll: null,
    });

    expect(issues).toEqual([]);
  });

  it("retorna issue quando item escolhido nao cobre todos os animais", () => {
    const issues = buildProtocolEligibilityIssues({
      tipoManejo: "sanitario",
      selectedProtocolCompatibleWithAll: false,
    });

    expect(issues).toEqual([
      "O item de protocolo escolhido nao atende todos os animais selecionados.",
    ]);
  });
});
