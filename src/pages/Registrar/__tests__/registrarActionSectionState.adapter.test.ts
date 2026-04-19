/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRegistrarActionSectionState } from "@/pages/Registrar/useRegistrarActionSectionState";

describe("useRegistrarActionSectionState", () => {
  it("centraliza wiring de callbacks e props derivadas das sections", () => {
    const setProtocoloId = vi.fn();
    const setProtocoloItemId = vi.fn();
    const setPesagemData = vi.fn();
    const setMovimentacaoData = vi.fn();
    const setNutricaoData = vi.fn();
    const updateFinanceiroData = vi.fn();
    const setShowNovaContraparte = vi.fn();
    const setNovaContraparte = vi.fn();
    const updateCompraNovoAnimalField = vi.fn();
    const updateCompraNovoAnimalPesoByIndex = vi.fn();
    const navigateContrapartes = vi.fn();
    const setReproducaoData = vi.fn();

    const { result } = renderHook(() =>
      useRegistrarActionSectionState({
        activeFarmId: "farm-1",
        selectedAnimais: ["animal-1"],
        selectedAnimaisDetalhesCount: 1,
        selectedLoteIdNormalized: "lote-origem",
        lotes: [
          { id: "lote-origem", nome: "Origem" },
          { id: "lote-destino", nome: "Destino" },
        ],
        farmWeightUnit: "kg",
        animaisNoLote: [],
        sanitarioSection: {
          sanitarioTipo: "vacinacao",
          onSanitarioTipoChange: vi.fn(),
          produto: "",
          onProdutoChange: vi.fn(),
          sanitatioProductMissing: false,
          selectedVeterinaryProduct: null,
          hasVeterinaryProducts: false,
          isVeterinaryProductsEmpty: false,
          veterinaryProductSuggestions: [],
          selectedVeterinaryProductId: "",
          onSelectVeterinaryProduct: vi.fn(),
          protocoloId: "",
          setProtocoloId,
          protocolos: [],
          protocoloItemId: "",
          setProtocoloItemId,
          protocoloItensEvaluated: [],
          selectedProtocolRestrictionsText: null,
          selectedProtocolPrimaryReason: null,
          selectedProtocolCompatibleWithAll: null,
          allProtocolItemsIneligible: false,
        },
        transitChecklistState: {
          transitChecklistSection: {
            enabled: false,
            purpose: "movimentacao",
            isInterstate: false,
            destinationUf: null,
            gtaChecked: false,
            gtaNumber: "",
            reproductionDocsChecked: false,
            brucellosisExamDate: "",
            tuberculosisExamDate: "",
            notes: "",
          },
          onTransitChecklistChange: vi.fn(),
          officialTransitChecklistEnabled: false,
          transitChecklistIssues: [],
          showsTransitChecklist: false,
          blockedAnimals: [],
          movementComplianceGuards: { blockers: [], warnings: [] },
          nutritionComplianceGuards: { blockers: [], warnings: [] },
        },
        pesagemSection: {
          invalidAnimalIds: ["animal-1"],
          pesagemData: {},
          setPesagemData,
        },
        movimentacaoSection: {
          movimentacaoData: { toLoteId: "" },
          setMovimentacaoData,
          movimentacaoSemDestino: true,
          movimentacaoDestinoIgualOrigem: false,
        },
        nutricaoSection: {
          nutricaoData: { alimentoNome: "", quantidadeKg: "" },
          setNutricaoData,
          nutricaoAlimentoMissing: true,
          nutricaoQuantidadeInvalida: true,
        },
        financeiroSection: {
          financeiroData: {
            natureza: "compra",
            contraparteId: "none",
            modoPreco: "por_lote",
            valorUnitario: "",
            valorTotal: "",
            quantidadeAnimais: "1",
            modoPeso: "nenhum",
            pesoLoteKg: "",
          },
          updateFinanceiroData,
          financeiroValorTotalCalculado: 0,
          isFinanceiroSociedade: false,
          contrapartes: [],
          canManageContraparte: true,
          showNovaContraparte: false,
          setShowNovaContraparte,
          novaContraparte: { nome: "", tipo: "comprador", documento: "", telefone: "" },
          setNovaContraparte,
          handleCreateContraparte: vi.fn(),
          isSavingContraparte: false,
          compraNovosAnimais: [],
          updateCompraNovoAnimalField,
          updateCompraNovoAnimalPesoByIndex,
          financeiroWeightStep: 0.1,
          financeiroWeightUnitLabel: "kg",
          onNavigateContrapartes: navigateContrapartes,
        },
        reproducaoSection: {
          partoRequiresSingleMatrix: false,
          reproducaoData: { tipo: "cobertura", machoId: null },
          setReproducaoData,
        },
      }),
    );

    act(() => {
      result.current.sanitarioSectionProps.onProtocoloChange("none");
      result.current.sanitarioSectionProps.onProtocoloItemChange("item-1");
      result.current.pesagemSectionProps.onPesoChange("animal-1", "320");
      result.current.movimentacaoSectionProps.onMovimentacaoDestinoChange("lote-destino");
      result.current.nutricaoSectionProps.onAlimentoNomeChange("silagem");
      result.current.financeiroSectionProps.onNaturezaChange("venda");
      result.current.financeiroSectionProps.onToggleNovaContraparte();
      result.current.financeiroSectionProps.onNovaContraparteFieldChange("nome", "Fornecedor A");
      result.current.financeiroSectionProps.onCompraPesoChange("tmp-1", "200");
      result.current.financeiroSectionProps.onNavigateContrapartes();
      result.current.reproducaoSectionProps.onChange({ tipo: "IA", machoId: null });
    });

    expect(setProtocoloId).toHaveBeenCalledWith("");
    expect(setProtocoloItemId).toHaveBeenCalledWith("item-1");
    expect(setPesagemData).toHaveBeenCalledTimes(1);
    expect(setMovimentacaoData).toHaveBeenCalledWith({ toLoteId: "lote-destino" });
    expect(setNutricaoData).toHaveBeenCalledTimes(1);
    expect(updateFinanceiroData).toHaveBeenCalledWith("natureza", "venda");
    expect(setShowNovaContraparte).toHaveBeenCalledTimes(1);
    expect(setNovaContraparte).toHaveBeenCalledTimes(1);
    expect(updateCompraNovoAnimalField).toHaveBeenCalledWith("tmp-1", "pesoKg", "200");
    expect(navigateContrapartes).toHaveBeenCalledTimes(1);
    expect(setReproducaoData).toHaveBeenCalledWith({ tipo: "IA", machoId: null });
    expect(result.current.movimentacaoSectionProps.lotesDestino).toEqual([
      { id: "lote-destino", nome: "Destino" },
    ]);
  });
});
