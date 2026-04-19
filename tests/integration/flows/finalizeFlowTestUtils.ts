import { vi } from "vitest";
import type {
  RegistrarFinalizeControllerDeps,
  RegistrarFinalizeControllerInput,
} from "@/pages/Registrar/createRegistrarFinalizeController";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";

export function createBaseFinalizeDeps(): RegistrarFinalizeControllerDeps {
  return {
    shared: {
      resolveTargetAnimalIds: vi.fn(() => ["animal-1"]),
      resolveDistinctAnimalIds: vi.fn(() => ["animal-1"]),
      loadAnimalsMap: vi.fn(async () => new Map()),
    },
    sanitary: {
      loadSanitaryFinalizeContext: vi.fn(async () => ({
        protocoloItem: {
          id: "protocol-item-1",
          protocolo_id: "protocol-1",
          tipo: "vacinacao",
          produto: "Vacina X",
          payload: {},
        },
        sanitaryProductName: "Vacina X",
        sanitaryProductSelection: null,
        sanitaryProductMetadata: { produto_id: "prod-1" },
        transitChecklistPayload: {},
      })),
      trySanitaryRpcFinalize: vi.fn(async () => ({ status: "fallback" as const })),
    },
    tracks: {
      isFinancialFlow: vi.fn(() => false),
      resolveFinancialFinalizePlan: vi.fn(() => ({
        issue: null,
        linkedEventId: "evt-fin-1",
        createdAnimalIds: [],
        ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-fin-1" } }],
      })),
      resolveNonFinancialFinalizePlan: vi.fn(async () => ({
        issue: null,
        linkedEventId: "evt-1",
        postPartoRedirect: null,
        ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-1" } }],
      })),
    },
    commit: {
      buildAgendaCompletionOp: vi.fn(({ sourceTaskId, linkedEventId }) => ({
        table: "agenda_itens",
        action: "UPDATE",
        record: { id: sourceTaskId, status: "concluido", source_evento_id: linkedEventId },
      })),
      resolveFinalizeOpsIssue: vi.fn(() => null),
      runFinalizeGesture: vi.fn(async () => "tx-flow-123"),
    },
    feedback: {
      buildFinalizeSuccessMessage: vi.fn(() => "registro concluido"),
      buildPostFinalizeNavigationPath: vi.fn((postPartoRedirect, sourceTaskId) => {
        if (postPartoRedirect) {
          return `/animais/${postPartoRedirect.motherId}/pos-parto`;
        }
        return sourceTaskId ? "/agenda" : "/home";
      }),
      resolveFinalizeCatchIssue: vi.fn(() => "erro ao finalizar"),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      navigate: vi.fn(),
    },
  };
}

export function createBaseFinalizeInput(
  overrides: Partial<RegistrarFinalizeControllerInput> = {},
): RegistrarFinalizeControllerInput {
  return {
    context: {
      tipoManejo: "sanitario",
      activeFarmId: "farm-1",
      fallbackFarmId: null,
      sourceTaskId: "agenda-1",
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
        natureza: "venda",
        modoPeso: "nenhum",
        modoPreco: "por_lote",
        contraparteId: "cp-1",
        valorTotal: "1000",
      },
      summary: {
        tipo: "venda",
        valorTotalCalculado: 1000,
        valorTotalInformado: 1000,
        valorUnitario: 0,
        pesoLote: 0,
        quantidadeAnimais: 1,
      },
      compraNovosAnimais: [],
    },
    sanitary: {
      protocoloItemId: "protocol-item-1",
      data: {
        tipo: "vacinacao",
        produto: "Vacina X",
      },
      selectedVeterinaryProductSelection: null,
      resolveProtocolProductSelection: vi.fn(() => null),
      transit: {
        showsTransitChecklist: false,
        transitChecklist: {
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
        officialTransitChecklistEnabled: false,
        transitChecklistIssues: [],
      },
      complianceFlowIssues: [],
    },
    operationData: {
      pesagemData: { "animal-1": "420" },
      movimentacaoData: { toLoteId: "lote-2" },
      nutricaoData: { alimentoNome: "Racao", quantidadeKg: "12" },
      reproducaoData: { tipo: "cobertura", machoId: null },
    },
    ...overrides,
  };
}
