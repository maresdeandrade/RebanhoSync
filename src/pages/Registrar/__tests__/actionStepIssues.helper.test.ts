import { describe, expect, it } from "vitest";
import {
  buildBaseActionStepIssues,
  buildInventoryActionStepIssues,
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

  it("retorna issues de ECC quando há animais inválidos ou nenhum válido no modo lote", () => {
    const issues = buildBaseActionStepIssues({
      tipoManejo: "ecc",
      sanitatioProductMissing: false,
      pesagemAnimaisInvalidosCount: 0,
      movimentacaoSemDestino: false,
      movimentacaoDestinoIgualOrigem: false,
      nutricaoAlimentoMissing: false,
      nutricaoQuantidadeInvalida: false,
      isFinanceiroSociedade: false,
      financeiroContraparteId: "x",
      partoRequiresSingleMatrix: false,
      eccAnimaisInvalidosCount: 1,
      isSingleAnimal: false,
      hasAtLeastOneValidEcc: false,
    });

    expect(issues).toEqual([
      "ECC deve estar entre 1.0 e 5.0 com passo de 0.25.",
      "Pelo menos 1 ECC válido deve ser preenchido para salvar.",
    ]);
  });
});

describe("composeRegistrarActionStepIssues", () => {
  it("mantem somente integridade no registro factual com alertas simultaneos", () => {
    expect(composeRegistrarActionStepIssues({
      registrationMode: "executed_fact", baseIssues: ["Destino ausente"], inventoryIssues: ["Lote de estoque ausente"],
      protocolEligibilityIssues: ["Protocolo incompativel"], sanitaryMovementBlockIssues: ["Caso aberto"],
      complianceFlowIssues: ["Restricao"], transitChecklistIssues: ["GTA nao confirmada"],
    })).toEqual(["Destino ausente", "Lote de estoque ausente"]);
  });

  it("concatena bloqueios sem promover aviso documental a erro", () => {
    const issues = composeRegistrarActionStepIssues({
      baseIssues: ["base"],
      inventoryIssues: ["inventory"],
      protocolEligibilityIssues: ["protocol"],
      sanitaryMovementBlockIssues: ["sanitary"],
      complianceFlowIssues: ["compliance"],
      transitChecklistIssues: ["transit"],
    });

    expect(issues).toEqual([
      "base",
      "inventory",
      "protocol",
      "sanitary",
      "compliance",
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

  it("não transforma pendencia documental em bloqueio, mas conserva guards independentes", () => {
    expect(composeRegistrarActionStepIssues({
      baseIssues: [],
      protocolEligibilityIssues: [],
      sanitaryMovementBlockIssues: ["Suspeita sanitaria ativa."],
      complianceFlowIssues: ["Restricao de movimento."],
      transitChecklistIssues: ["GTA nao informada."],
    })).toEqual(["Suspeita sanitaria ativa.", "Restricao de movimento."]);
  });
});

describe("buildInventoryActionStepIssues", () => {
  it("bloqueia avanço quando baixa sanitaria está marcada sem lote e quantidade", () => {
    const issues = buildInventoryActionStepIssues({
      tipoManejo: "sanitario",
      gerarBaixaEstoque: true,
      selectedInsumoId: "insumo-1",
      selectedLoteId: "",
      quantidadeConsumida: "",
    });

    expect(issues).toEqual([
      "Selecione o lote de estoque antes de continuar.",
      "Informe quantidade de estoque maior que zero.",
    ]);
  });

  it("não exige estoque quando baixa não está marcada", () => {
    const issues = buildInventoryActionStepIssues({
      tipoManejo: "sanitario",
      gerarBaixaEstoque: false,
      selectedInsumoId: "",
      selectedLoteId: "",
      quantidadeConsumida: "",
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
      "BR-001 possui restricao sanitaria informada; confira os casos e requisitos aplicaveis.",
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
      "2 animal(is) do recorte atual possuem restricoes sanitarias informadas.",
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
