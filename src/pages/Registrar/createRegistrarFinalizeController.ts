import type { ReproductionEventData } from "@/components/events/ReproductionForm";
import type { EventDomain } from "@/lib/events/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import type { AnimalBreedEnum } from "@/lib/animals/catalogs";
import type {
  Animal,
  FinanceiroTipoEnum,
  OperationInput,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
} from "@/lib/offline/types";

type ProtocolItemLike = Pick<
  ProtocoloSanitarioItem,
  "id" | "protocolo_id" | "produto" | "tipo" | "payload"
>;
import type { VeterinaryProductSelection } from "@/lib/sanitario/products";
import type { TransitChecklistDraft } from "@/lib/sanitario/transit";
import {
  type RegistrarFinanceiroModoPeso,
  type RegistrarFinanceiroModoPreco,
  type RegistrarFinanceiroNatureza,
  resolveRegistrarPreflightIssue,
} from "@/pages/Registrar/helpers/preflight";
import { supportsDraftAnimalsInFinanceiroNatureza } from "@/pages/Registrar/helpers/financialNature";

type FinancialWeightMode = "nenhum" | "lote" | "individual";
type FinancialPriceMode = "por_lote" | "por_animal";

type CompraNovoAnimalDraft = {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string;
  pesoKg: string;
  raca: AnimalBreedEnum | null;
};

type RegistrarFinalizeSharedDeps = {
  resolveTargetAnimalIds: (input: {
    hasSelectedAnimals: boolean;
    selectedAnimais: string[];
  }) => Array<string | null>;
  resolveDistinctAnimalIds: (targetAnimalIds: Array<string | null>) => string[];
  loadAnimalsMap: (input: {
    animalIds: string[];
  }) => Promise<Map<string, Animal>>;
};

type RegistrarFinalizeSanitaryDeps = {
  loadSanitaryFinalizeContext: (input: {
    tipoManejo: EventDomain;
    protocoloItemId: string;
    sanitaryTypedProduct: string;
    selectedVeterinaryProductSelection: VeterinaryProductSelection | null;
    resolveProtocolProductSelection: (
      payload: Record<string, unknown> | null | undefined,
      productName: string,
      sanitaryType: SanitarioTipoEnum,
    ) => VeterinaryProductSelection | null;
    showsTransitChecklist: boolean;
    transitChecklist: TransitChecklistDraft;
    officialTransitChecklistEnabled: boolean;
  }) => Promise<{
    protocoloItem: ProtocolItemLike | null;
    sanitaryProductName: string;
    sanitaryProductSelection: VeterinaryProductSelection | null;
    sanitaryProductMetadata: Record<string, unknown>;
    transitChecklistPayload: Record<string, unknown>;
  }>;
  trySanitaryRpcFinalize: (input: {
    tipoManejo: EventDomain;
    sourceTaskId: string;
    fazendaId: string;
    occurredAt: string;
    tipo: SanitarioTipoEnum;
    sanitaryProductName: string;
    sanitaryProductMetadata: Record<string, unknown>;
  }) => Promise<
    | { status: "skip" }
    | { status: "handled"; eventoId: string }
    | { status: "fallback" }
  >;
};

type RegistrarFinalizeTrackDeps = {
  isFinancialFlow: (input: {
    tipoManejo: EventDomain;
    isFinanceiroSociedade: boolean;
  }) => boolean;
  resolveFinancialFinalizePlan: (input: {
    tipoManejo: string;
    isFinanceiroSociedade: boolean;
    natureza: RegistrarFinanceiroNatureza;
    fazendaId: string;
    occurredAt: string;
    selectedAnimalIds: string[];
    animalsMap: Map<string, Animal>;
    selectedLoteIdNormalized: string | null;
    contraparteId: string;
    sourceTaskId: string | null;
    compraNovosAnimais: CompraNovoAnimalDraft[];
    modoPeso: FinancialWeightMode;
    modoPreco: FinancialPriceMode;
    valorTotalInformado: number;
    valorUnitario: number;
    pesoLote: number;
    transitChecklistPayload: Record<string, unknown>;
    farmLifecycleConfig: FarmLifecycleConfig;
    parseUserWeight: (value: string) => number | null;
  }) =>
    | { issue: string; linkedEventId: null; createdAnimalIds: []; ops: [] }
    | {
        issue: null;
        linkedEventId: string;
        createdAnimalIds: string[];
        ops: OperationInput[];
      };
  resolveNonFinancialFinalizePlan: (input: {
    tipoManejo: EventDomain;
    fazendaId: string;
    occurredAt: string;
    sourceTaskId: string | null;
    targetAnimalIds: Array<string | null>;
    animalsMap: Map<string, Animal>;
    selectedLoteIsSemLote: boolean;
    selectedLoteIdNormalized: string | null;
    createdAnimalIds: string[];
    transitChecklistPayload: Record<string, unknown>;
    sanitaryProductName: string;
    sanitaryProductSelection: VeterinaryProductSelection | null;
    sanitaryProductMetadata: Record<string, unknown>;
    protocoloItem: ProtocoloSanitarioItem | null;
    sanitarioData: { tipo: SanitarioTipoEnum };
    pesagemData: Record<string, string>;
    movimentacaoData: { toLoteId: string };
    nutricaoData: { alimentoNome: string; quantidadeKg: string };
    financeiroData: {
      natureza: RegistrarFinanceiroNatureza;
      valorTotal: string;
      contraparteId: string;
    };
    financeiroTipo: FinanceiroTipoEnum;
    reproducaoData: ReproductionEventData;
    farmLifecycleConfig: FarmLifecycleConfig;
    parseUserWeight: (value: string) => number | null;
  }) => Promise<
    | { issue: string; linkedEventId: null; postPartoRedirect: null; ops: [] }
    | {
        issue: null;
        linkedEventId: string | null;
        postPartoRedirect: {
          motherId: string;
          eventId: string;
          calfIds: string[];
        } | null;
        ops: OperationInput[];
      }
  >;
};

type RegistrarFinalizeCommitDeps = {
  buildAgendaCompletionOp: (input: {
    sourceTaskId: string;
    linkedEventId: string;
  }) => OperationInput;
  resolveFinalizeOpsIssue: (opsLength: number) => string | null;
  runFinalizeGesture: (input: {
    fazendaId: string;
    ops: OperationInput[];
  }) => Promise<string>;
};

type RegistrarFinalizeFeedbackDeps = {
  buildFinalizeSuccessMessage: (input: {
    compraGerandoAnimais: boolean;
    createdAnimalCount: number;
    txId: string;
    sourceTaskId?: string | null;
  }) => string;
  buildPostFinalizeNavigationPath: (
    postPartoRedirect: {
      motherId: string;
      eventId: string;
      calfIds: string[];
    } | null,
    sourceTaskId?: string | null,
  ) => string;
  resolveFinalizeCatchIssue: (error: unknown) => string;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  navigate: (path: string) => void;
};

export type RegistrarFinalizeControllerDeps = {
  shared: RegistrarFinalizeSharedDeps;
  sanitary: RegistrarFinalizeSanitaryDeps;
  tracks: RegistrarFinalizeTrackDeps;
  commit: RegistrarFinalizeCommitDeps;
  feedback: RegistrarFinalizeFeedbackDeps;
};

export type RegistrarFinalizeControllerInput = {
  context: {
    tipoManejo: EventDomain | null;
    activeFarmId: string | null;
    fallbackFarmId: string | null;
    sourceTaskId: string;
    farmLifecycleConfig: FarmLifecycleConfig;
    parseUserWeight: (value: string) => number | null;
  };
  selection: {
    selectedAnimais: string[];
    selectedLoteId: string;
    selectedLoteIdNormalized: string | null;
    partoRequiresSingleMatrix: boolean;
  };
  finance: {
    isFinanceiroSociedade: boolean;
    data: {
      natureza: RegistrarFinanceiroNatureza;
      modoPeso: RegistrarFinanceiroModoPeso;
      modoPreco: RegistrarFinanceiroModoPreco;
      contraparteId: string;
      valorTotal: string;
    };
    summary: {
      tipo: FinanceiroTipoEnum;
      valorTotalCalculado: number;
      valorTotalInformado: number;
      valorUnitario: number;
      pesoLote: number;
      quantidadeAnimais: number;
    };
    compraNovosAnimais: CompraNovoAnimalDraft[];
  };
  sanitary: {
    protocoloItemId: string;
    data: { tipo: SanitarioTipoEnum; produto: string };
    selectedVeterinaryProductSelection: VeterinaryProductSelection | null;
    resolveProtocolProductSelection: (
      payload: Record<string, unknown> | null | undefined,
      productName: string,
      sanitaryType: SanitarioTipoEnum,
    ) => VeterinaryProductSelection | null;
    transit: {
      showsTransitChecklist: boolean;
      transitChecklist: TransitChecklistDraft;
      officialTransitChecklistEnabled: boolean;
      transitChecklistIssues: string[];
    };
    complianceFlowIssues: string[];
  };
  operationData: {
    pesagemData: Record<string, string>;
    movimentacaoData: { toLoteId: string };
    nutricaoData: { alimentoNome: string; quantidadeKg: string };
    reproducaoData: ReproductionEventData;
  };
  onFinalizeHandled?: () => void;
};

export function createRegistrarFinalizeController(
  deps: RegistrarFinalizeControllerDeps,
) {
  return async function finalize(
    input: RegistrarFinalizeControllerInput,
  ): Promise<void> {
    const { context, selection, finance, sanitary, operationData } = input;
    if (!context.tipoManejo) return;

    const fazendaId = context.activeFarmId ?? context.fallbackFarmId;
    if (!fazendaId) return;

    const hasSelectedAnimals = selection.selectedAnimais.length > 0;
    const compraGerandoAnimais =
      context.tipoManejo === "financeiro" &&
      supportsDraftAnimalsInFinanceiroNatureza(finance.data.natureza) &&
      !hasSelectedAnimals;

    const preflightIssue = resolveRegistrarPreflightIssue({
      tipoManejo: context.tipoManejo,
      selectedAnimais: selection.selectedAnimais,
      selectedLoteId: selection.selectedLoteId,
      partoRequiresSingleMatrix: selection.partoRequiresSingleMatrix,
      isFinanceiroSociedade: finance.isFinanceiroSociedade,
      financeiroData: {
        natureza: finance.data.natureza,
        modoPeso: finance.data.modoPeso,
        modoPreco: finance.data.modoPreco,
        contraparteId: finance.data.contraparteId,
      },
      financeiroValorTotalCalculado: finance.summary.valorTotalCalculado,
      financeiroPesoLote: finance.summary.pesoLote,
      financeiroValorUnitario: finance.summary.valorUnitario,
      financeiroQuantidadeAnimais: finance.summary.quantidadeAnimais,
      compraNovosAnimais: finance.compraNovosAnimais,
      pesagemData: operationData.pesagemData,
      transitChecklistIssues: sanitary.transit.transitChecklistIssues,
      complianceFlowIssues: sanitary.complianceFlowIssues,
      parseUserWeight: context.parseUserWeight,
    });
    if (preflightIssue) {
      deps.feedback.showError(preflightIssue);
      return;
    }

    try {
      const now = new Date().toISOString();
      const {
        protocoloItem,
        sanitaryProductName,
        sanitaryProductSelection,
        sanitaryProductMetadata,
        transitChecklistPayload,
      } = await deps.sanitary.loadSanitaryFinalizeContext({
        tipoManejo: context.tipoManejo,
        protocoloItemId: sanitary.protocoloItemId,
        sanitaryTypedProduct: sanitary.data.produto,
        selectedVeterinaryProductSelection:
          sanitary.selectedVeterinaryProductSelection,
        resolveProtocolProductSelection:
          sanitary.resolveProtocolProductSelection,
        showsTransitChecklist: sanitary.transit.showsTransitChecklist,
        transitChecklist: sanitary.transit.transitChecklist,
        officialTransitChecklistEnabled:
          sanitary.transit.officialTransitChecklistEnabled,
      });

      const sanitaryRpc = await deps.sanitary.trySanitaryRpcFinalize({
        tipoManejo: context.tipoManejo,
        sourceTaskId: context.sourceTaskId,
        fazendaId,
        occurredAt: now,
        tipo: sanitary.data.tipo,
        sanitaryProductName,
        sanitaryProductMetadata,
      });
      if (sanitaryRpc.status === "handled") {
        deps.feedback.showSuccess(
          `Aplicacao sanitaria confirmada no servidor. Evento ${sanitaryRpc.eventoId.slice(0, 8)}.`,
        );
        deps.feedback.navigate(
          deps.feedback.buildPostFinalizeNavigationPath(
            null,
            context.sourceTaskId || null,
          ),
        );
        input.onFinalizeHandled?.();
        return;
      }

      const ops: OperationInput[] = [];
      const createdAnimalIds: string[] = [];
      let linkedEventId: string | null = null;
      let postPartoRedirect: {
        motherId: string;
        eventId: string;
        calfIds: string[];
      } | null = null;

      const targetAnimalIds = deps.shared.resolveTargetAnimalIds({
        hasSelectedAnimals,
        selectedAnimais: selection.selectedAnimais,
      });
      const distinctAnimalIds =
        deps.shared.resolveDistinctAnimalIds(targetAnimalIds);
      const animalsMap = await deps.shared.loadAnimalsMap({
        animalIds: distinctAnimalIds,
      });

      if (
        deps.tracks.isFinancialFlow({
          tipoManejo: context.tipoManejo,
          isFinanceiroSociedade: finance.isFinanceiroSociedade,
        })
      ) {
        const financialPlan = deps.tracks.resolveFinancialFinalizePlan({
          tipoManejo: context.tipoManejo,
          natureza: finance.data.natureza,
          isFinanceiroSociedade: finance.isFinanceiroSociedade,
          fazendaId,
          occurredAt: now,
          selectedAnimalIds: selection.selectedAnimais,
          animalsMap,
          selectedLoteIdNormalized: selection.selectedLoteIdNormalized,
          contraparteId: finance.data.contraparteId,
          sourceTaskId: context.sourceTaskId || null,
          compraNovosAnimais: finance.compraNovosAnimais,
          modoPeso: finance.data.modoPeso as FinancialWeightMode,
          modoPreco: finance.data.modoPreco as FinancialPriceMode,
          valorTotalInformado: finance.summary.valorTotalInformado,
          valorUnitario: finance.summary.valorUnitario,
          pesoLote: finance.summary.pesoLote,
          transitChecklistPayload,
          farmLifecycleConfig: context.farmLifecycleConfig,
          parseUserWeight: context.parseUserWeight,
        });
        if (financialPlan.issue) {
          deps.feedback.showError(financialPlan.issue);
          return;
        }

        linkedEventId = financialPlan.linkedEventId;
        createdAnimalIds.push(...financialPlan.createdAnimalIds);
        ops.push(...financialPlan.ops);
      } else {
        const nonFinancialPlan =
          await deps.tracks.resolveNonFinancialFinalizePlan({
            tipoManejo: context.tipoManejo,
            fazendaId,
            occurredAt: now,
            sourceTaskId: context.sourceTaskId || null,
            targetAnimalIds,
            animalsMap,
            selectedLoteIsSemLote: selection.selectedLoteId === "__sem_lote__",
            selectedLoteIdNormalized: selection.selectedLoteIdNormalized,
            createdAnimalIds,
            transitChecklistPayload,
            sanitaryProductName,
            sanitaryProductSelection,
            sanitaryProductMetadata,
            protocoloItem,
            sanitarioData: { tipo: sanitary.data.tipo },
            pesagemData: operationData.pesagemData,
            movimentacaoData: operationData.movimentacaoData,
            nutricaoData: operationData.nutricaoData,
            financeiroData: {
              natureza: finance.data.natureza,
              valorTotal: finance.data.valorTotal,
              contraparteId: finance.data.contraparteId,
            },
            financeiroTipo: finance.summary.tipo,
            reproducaoData: operationData.reproducaoData,
            farmLifecycleConfig: context.farmLifecycleConfig,
            parseUserWeight: context.parseUserWeight,
          });
        if (nonFinancialPlan.issue) {
          deps.feedback.showError(nonFinancialPlan.issue);
          return;
        }

        if (!linkedEventId && nonFinancialPlan.linkedEventId) {
          linkedEventId = nonFinancialPlan.linkedEventId;
        }
        postPartoRedirect = nonFinancialPlan.postPartoRedirect;
        ops.push(...nonFinancialPlan.ops);
      }

      if (context.sourceTaskId && linkedEventId) {
        ops.push(
          deps.commit.buildAgendaCompletionOp({
            sourceTaskId: context.sourceTaskId,
            linkedEventId,
          }),
        );
      }

      const opsIssue = deps.commit.resolveFinalizeOpsIssue(ops.length);
      if (opsIssue) {
        deps.feedback.showError(opsIssue);
        return;
      }

      const txId = await deps.commit.runFinalizeGesture({
        fazendaId,
        ops,
      });
      deps.feedback.showSuccess(
        deps.feedback.buildFinalizeSuccessMessage({
          compraGerandoAnimais,
          createdAnimalCount: createdAnimalIds.length,
          txId,
          sourceTaskId: context.sourceTaskId,
        }),
      );
      deps.feedback.navigate(
        deps.feedback.buildPostFinalizeNavigationPath(
          postPartoRedirect,
          context.sourceTaskId,
        ),
      );
      input.onFinalizeHandled?.();
    } catch (error: unknown) {
      deps.feedback.showError(deps.feedback.resolveFinalizeCatchIssue(error));
    }
  };
}
