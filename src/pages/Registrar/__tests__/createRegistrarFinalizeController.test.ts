import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";

function buildControllerDeps() {
  return {
    shared: {
      resolveTargetAnimalIds: vi.fn(() => ["animal-1"]),
      resolveDistinctAnimalIds: vi.fn(() => ["animal-1"]),
      loadAnimalsMap: vi.fn(async () => new Map()),
    },
    sanitary: {
      loadSanitaryFinalizeContext: vi.fn(async () => ({
        protocoloItem: null,
        sanitaryProductName: "Produto A",
        sanitaryProductSelection: null,
        sanitaryProductMetadata: {},
        transitChecklistPayload: {},
      })),
      trySanitaryRpcFinalize: vi.fn(async () => ({ status: "fallback" as const })),
    },
    tracks: {
      isFinancialFlow: vi.fn(() => false),
      resolveFinancialFinalizePlan: vi.fn(() => ({
        issue: null,
        linkedEventId: "evt-fin",
        createdAnimalIds: [],
        ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-fin" } }],
      })),
      resolveNonFinancialFinalizePlan: vi.fn(async () => ({
        issue: null,
        linkedEventId: "evt-1",
        postPartoRedirect: null,
        ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-1" } }],
      })),
    },
    commit: {
      buildAgendaCompletionOp: vi.fn(() => ({
        table: "agenda_itens",
        action: "UPDATE",
        record: { id: "agenda-1", status: "concluido" },
      })),
      resolveFinalizeOpsIssue: vi.fn(() => null),
      runFinalizeGesture: vi.fn(async () => "tx-12345678"),
    },
    feedback: {
      buildFinalizeSuccessMessage: vi.fn(() => "ok"),
      buildPostFinalizeNavigationPath: vi.fn(() => "/home"),
      resolveFinalizeCatchIssue: vi.fn(() => "erro"),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      navigate: vi.fn(),
    },
  };
}

function buildFinalizeInput() {
  return {
    context: {
      tipoManejo: "pesagem" as const,
      activeFarmId: "farm-1",
      fallbackFarmId: null,
      sourceTaskId: "",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      parseUserWeight: (value: string) => Number.parseFloat(value),
    },
    selection: {
      selectedAnimais: ["animal-1"],
      selectedLoteId: "lote-1",
      selectedLoteIdNormalized: "lote-1",
      partoRequiresSingleMatrix: false,
    },
    finance: {
      isFinanceiroSociedade: false,
      data: {
        natureza: "venda" as const,
        modoPeso: "nenhum" as const,
        modoPreco: "por_lote" as const,
        contraparteId: "cp-1",
        valorTotal: "100",
      },
      summary: {
        tipo: "venda" as const,
        valorTotalCalculado: 100,
        valorTotalInformado: 100,
        valorUnitario: 0,
        pesoLote: 0,
        quantidadeAnimais: 1,
      },
      compraNovosAnimais: [],
    },
    sanitary: {
      protocoloItemId: "",
      data: {
        tipo: "vacinacao" as const,
        produto: "",
      },
      selectedVeterinaryProductSelection: null,
      resolveProtocolProductSelection: vi.fn(() => null),
      transit: {
        showsTransitChecklist: false,
        transitChecklist: {
          enabled: false,
          purpose: "movimentacao" as const,
          isInterstate: false,
          destinationUf: null,
          gtaChecked: false,
          gtaNumber: "",
          reproductionDocsChecked: false,
          brucellosisExamDate: "",
          tuberculosisExamDate: "",
          notes: "",
        },
        officialTransitChecklistEnabled: false,
        transitChecklistIssues: [],
      },
      complianceFlowIssues: [],
    },
    operationData: {
      pesagemData: { "animal-1": "300" },
      movimentacaoData: { toLoteId: "lote-2" },
      nutricaoData: { alimentoNome: "Silagem", quantidadeKg: "20" },
      reproducaoData: { tipo: "cobertura" as const, machoId: null },
    },
  };
}

describe("createRegistrarFinalizeController", () => {
  it("interrompe no preflight e reporta erro", async () => {
    const deps = buildControllerDeps();
    const finalize = createRegistrarFinalizeController(deps);
    const input = buildFinalizeInput();
    input.selection.selectedAnimais = [];
    input.operationData.pesagemData = {};

    await finalize(input);

    expect(deps.feedback.showError).toHaveBeenCalledWith(
      "Selecione ao menos um animal para este tipo de registro.",
    );
    expect(deps.sanitary.loadSanitaryFinalizeContext).not.toHaveBeenCalled();
  });

  it("encerra no caminho de RPC sanitário quando já tratado no servidor", async () => {
    const deps = buildControllerDeps();
    deps.sanitary.trySanitaryRpcFinalize.mockResolvedValue({
      status: "handled",
      eventoId: "evt-server-1234",
    });
    const finalize = createRegistrarFinalizeController(deps);
    const input = buildFinalizeInput();
    input.context.tipoManejo = "sanitario";

    await finalize(input);

    expect(deps.feedback.navigate).toHaveBeenCalledWith("/home");
    expect(deps.commit.runFinalizeGesture).not.toHaveBeenCalled();
  });

  it("monta commit offline no trilho financeiro quando RPC não trata", async () => {
    const deps = buildControllerDeps();
    deps.tracks.isFinancialFlow.mockReturnValue(true);
    const finalize = createRegistrarFinalizeController(deps);
    const input = buildFinalizeInput();
    input.context.tipoManejo = "financeiro";

    await finalize(input);

    expect(deps.tracks.resolveFinancialFinalizePlan).toHaveBeenCalled();
    expect(deps.commit.runFinalizeGesture).toHaveBeenCalled();
    expect(deps.feedback.showSuccess).toHaveBeenCalledWith("ok");
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/home");
  });
});
