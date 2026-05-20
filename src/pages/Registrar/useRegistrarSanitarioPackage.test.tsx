/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EventDomain } from "@/lib/events/types";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";
import type { RegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import type { Animal } from "@/lib/offline/types";
import { useRegistrarSanitarioPackage } from "./components/useRegistrarSanitarioPackage";
import * as dexieHooks from "dexie-react-hooks";

// Mocks para dependências externas e side-effects do componente
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock("@/pages/Registrar/effects/bootstrap", () => ({
  refreshRegistrarSanitaryProtocolsEffect: vi.fn().mockResolvedValue(undefined),
  refreshRegistrarVeterinaryProductsEffect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/pages/Registrar/effects/sourceTaskPrefill", () => ({
  loadRegistrarSourceTaskPrefillEffect: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/pages/Registrar/effects/localQueries", () => ({
  loadRegistrarProtocolosEffect: vi.fn(),
  loadRegistrarProtocoloItensEffect: vi.fn(),
  loadRegistrarVeterinaryProductsEffect: vi.fn(),
}));

vi.mock("@/lib/sanitario/models/registrarPackage", () => ({
  resolveRegistrarSanitaryPackage: vi.fn(() => ({
    selectedVeterinaryProduct: null,
    selectedVeterinaryProductSelection: null,
    hasVeterinaryProducts: true,
    isVeterinaryProductsEmpty: false,
    veterinaryProductSuggestions: [
      { id: "prod-1", nome: "Vacina Raiva Inativada", categoria: "Vacinas" },
      { id: "prod-2", nome: "Vacina Brucelose B19", categoria: "Biológicos" },
      { id: "prod-3", nome: "Vermifugo Ivermectina", categoria: "Endectocidas" },
    ],
    protocoloItensEvaluated: [],
    selectedProtocoloItemEvaluation: null,
    selectedProtocolRestrictionsText: null,
    selectedProtocolPrimaryReason: null,
    allProtocolItemsIneligible: false,
    protocolEligibilityIssues: [],
    sanitatioProductMissing: false,
    transitChecklistIssues: [],
    showsTransitChecklist: false,
    officialTransitChecklistEnabled: false,
    animalsBlockedBySanitaryAlert: [],
    sanitaryMovementBlockIssues: [],
    movementComplianceGuards: [],
    nutritionComplianceGuards: [],
    complianceFlowIssues: [],
  })),
  resolveProtocolProductSelectionFromCatalog: vi.fn(),
}));

type MockProtocolo = { id: string; nome: string; familia_sanitaria?: string };
type MockProduct = { id: string; nome: string; categoria?: string };

const defaultProps = {
  activeFarmId: "farm-1",
  tipoManejo: "sanitario" as EventDomain,
  sourceTaskId: "",
  financeiroNatureza: "compra" as FinanceiroNatureza,
  regulatorySurfaceConfig: null,
  regulatoryReadModel: {} as RegulatoryOperationalReadModel,
  animaisNoLote: [] as Animal[],
  selectedAnimaisDetalhes: [] as Animal[],
};

describe("useRegistrarSanitarioPackage", () => {
  let mockProtocolos: MockProtocolo[] = [];
  let mockProducts: MockProduct[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockProtocolos = [];
    mockProducts = [];

    // Espiona o useLiveQuery para retornar dados simulados baseado na função que o invoca
    vi.spyOn(dexieHooks, "useLiveQuery").mockImplementation((querier: () => unknown) => {
      const fnStr = typeof querier === "function" ? querier.toString().toLowerCase() : "";
      if (fnStr.includes("product") || fnStr.includes("produto") || fnStr.includes("en(")) return mockProducts;
      if (fnStr.includes("item") || fnStr.includes("itens") || fnStr.includes("rn(")) return [];
      return mockProtocolos;
    });
  });

  it("deve resetar o protocolo e o produto quando o tipo sanitário for alterado (Limpeza em cascata)", () => {
    mockProtocolos = [{ id: "prot-1", nome: "Protocolo Teste" }];
    const { result } = renderHook(() => useRegistrarSanitarioPackage(defaultProps));

    // Simula a escolha de um protocolo e produto inicial
    act(() => {
      result.current.setProtocoloId("prot-1");
      result.current.handleSanitarioProdutoChange("Produto Teste");
    });

    expect(result.current.protocoloId).toBe("prot-1");
    expect(result.current.sanitarioData.produto).toBe("Produto Teste");

    // Muda o tipo (ex: de vacinação para medicamento)
    act(() => {
      result.current.handleSanitarioTipoChange("medicamento");
    });

    // Verifica se a cascata foi ativada zerando tudo abaixo
    expect(result.current.sanitarioData.tipo).toBe("medicamento");
    expect(result.current.protocoloId).toBe("");
    expect(result.current.protocoloItemId).toBe("");
    expect(result.current.sanitarioData.produto).toBe("");
    expect(result.current.selectedVeterinaryProductId).toBe("");
  });

  it("retorna os protocolos cadastrados sem filtrar por tipo sanitario no cabecalho", () => {
    mockProtocolos = [
      { id: "1", nome: "Vacina Brucelose", familia_sanitaria: "vacina" },
      { id: "3", nome: "Vermifugação Desmama", familia_sanitaria: "verm" },
    ];

    const { result } = renderHook(() => useRegistrarSanitarioPackage(defaultProps));

    act(() => {
      result.current.handleSanitarioTipoChange("vacinacao");
    });

    const renderizedProtocols = result.current.protocolos;

    // Retorna todos os protocolos; a filtragem por tipo ocorre nos itens
    expect(renderizedProtocols.length).toBeGreaterThan(0);
  });

  it("expõe todos os protocolos indepentente do tipo ativo no form", () => {
    mockProtocolos = [
      { id: "1", nome: "Controle Estratégico 5-7-9" },
      { id: "2", nome: "Tratamento de Tristeza Parasitaria (TPB)" },
    ];

    const { result } = renderHook(() => useRegistrarSanitarioPackage(defaultProps));

    act(() => result.current.handleSanitarioTipoChange("vermifugacao"));
    expect(result.current.protocolos.length).toBeGreaterThan(0);
  });

  it("deve filtrar sugestões de produtos estritamente baseando-se no protocolo selecionado", () => {
    // Supondo que mockamos o `resolveRegistrarSanitaryPackage` para retornar 3 sugestões
    // 1 de Raiva, 1 de Brucelose e 1 Vermífugo. (Feito no mock do cabeçalho).
    
    mockProtocolos = [
      { id: "prot-raiva", nome: "Raiva dos Herbivoros" },
      { id: "prot-bruc", nome: "Brucelose" },
    ];

    const { result } = renderHook(() => useRegistrarSanitarioPackage(defaultProps));

    act(() => {
      result.current.handleSanitarioTipoChange("vacinacao");
    });

    // Sem protocolo selecionado, deve mostrar as 2 vacinas (escondeu o vermífugo)
    expect(result.current.veterinaryProductSuggestions).toHaveLength(2);

    // Seleciona o protocolo da Raiva
    act(() => {
      result.current.setProtocoloId("prot-raiva");
    });

    // Agora DEVE obrigatoriamente mostrar APENAS o produto relacionado a Raiva
    expect(result.current.veterinaryProductSuggestions).toHaveLength(1);
    expect(result.current.veterinaryProductSuggestions[0].nome).toBe("Vacina Raiva Inativada");
  });
});
