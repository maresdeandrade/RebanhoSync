import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type {
  OperationInput,
  ReproTipoEnum,
  Animal,
} from "@/lib/offline/types";
import { type ReproductionEventData } from "@/components/events/ReproductionForm";
import type { EventDomain } from "@/lib/events/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Scale,
  Move,
  Syringe,
  ChevronRight,
  ChevronLeft,
  Check,
  Handshake,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";
import { parseWeightInput } from "@/lib/format/weight";
import {
  buildRegulatoryOperationalReadModel,
} from "@/lib/sanitario/regulatoryReadModel";
import {
  isMovimentacaoDestinoIgualOrigem,
  shouldClearMovimentacaoDestino,
} from "@/pages/Registrar/helpers/movimentacao";
import {
  filterRegistrarAnimalsBySearch,
  resolveSelectedVisibleCount,
} from "@/pages/Registrar/helpers/animalSelection";
import {
  resolveSelectedRecordsByIds,
} from "@/pages/Registrar/helpers/selectContext";
import {
  buildBaseActionStepIssues,
  composeRegistrarActionStepIssues,
} from "@/pages/Registrar/helpers/actionStepIssues";
import {
  buildRegistrarAgendaCompletionOp,
  resolveRegistrarDistinctAnimalIds,
  resolveRegistrarTargetAnimalIds,
} from "@/pages/Registrar/helpers/plan";
import { resolveRegistrarPreflightIssue } from "@/pages/Registrar/helpers/preflight";
import {
  parseRegistrarNumeric,
} from "@/pages/Registrar/helpers/financialContext";
import {
  resolveRegistrarFinalizeCatchIssue,
  resolveRegistrarFinalizeOpsIssue,
} from "@/pages/Registrar/helpers/finalizeGuards";
import { resolveRegistrarFinancialFinalizePlan } from "@/pages/Registrar/helpers/financialFinalize";
import {
  isRegistrarFinancialFlow,
  resolveRegistrarNonFinancialFinalizePlan,
} from "@/pages/Registrar/effects/nonFinancialFinalize";
import { tryRegistrarSanitaryRpcFinalizeEffect } from "@/pages/Registrar/effects/sanitaryRpc";
import { loadRegistrarAnimalsMap } from "@/pages/Registrar/effects/animalLookup";
import { loadRegistrarSanitaryFinalizeContext } from "@/pages/Registrar/effects/sanitaryContext";
import {
  loadRegistrarAnimaisNoLoteEffect,
  loadRegistrarBullByIdEffect,
  loadRegistrarContrapartesEffect,
  loadRegistrarRegulatorySurfaceSourceEffect,
  loadRegistrarSingleActiveBullInLoteEffect,
} from "@/pages/Registrar/effects/localQueries";
import { runRegistrarFinalizeGestureEffect } from "@/pages/Registrar/effects/finalizeGesture";
import { FinanceiroResumoConfirmacao } from "@/pages/Registrar/components/FinanceiroResumoConfirmacao";
import { RegistrarFinanceiroSection } from "@/pages/Registrar/components/RegistrarFinanceiroSection";
import {
  RegistrarComplianceBlockSection,
  RegistrarSanitaryMovementBlockSection,
} from "@/pages/Registrar/components/RegistrarComplianceBlocks";
import { RegistrarTransitChecklistSection } from "@/pages/Registrar/components/RegistrarTransitChecklistSection";
import { ReproducaoResumoConfirmacao } from "@/pages/Registrar/components/ReproducaoResumoConfirmacao";
import { TransitChecklistResumoConfirmacao } from "@/pages/Registrar/components/TransitChecklistResumoConfirmacao";
import { ConfirmacaoResumoBase } from "@/pages/Registrar/components/ConfirmacaoResumoBase";
import { RegistrarQuickActionsGrid } from "@/pages/Registrar/components/RegistrarQuickActionsGrid";
import { RegistrarManejoActionsGrid } from "@/pages/Registrar/components/RegistrarManejoActionsGrid";
import { RegistrarSelectTargetStep } from "@/pages/Registrar/components/RegistrarSelectTargetStep";
import { RegistrarSanitarioSection } from "@/pages/Registrar/components/RegistrarSanitarioSection";
import { RegistrarPesagemSection } from "@/pages/Registrar/components/RegistrarPesagemSection";
import { RegistrarMovimentacaoSection } from "@/pages/Registrar/components/RegistrarMovimentacaoSection";
import { RegistrarNutricaoSection } from "@/pages/Registrar/components/RegistrarNutricaoSection";
import { RegistrarReproducaoSection } from "@/pages/Registrar/components/RegistrarReproducaoSection";
import {
  TRANSIT_CHECKLIST_UF_OPTIONS,
  TRANSIT_PURPOSE_OPTIONS,
  useRegistrarSanitarioPackage,
} from "@/pages/Registrar/components/useRegistrarSanitarioPackage";
import { useRegistrarFinanceiroPackage } from "@/pages/Registrar/components/useRegistrarFinanceiroPackage";
import {
  buildRegistrarFinalizeSuccessMessage,
  buildRegistrarPostFinalizeNavigationPath,
} from "@/pages/Registrar/helpers/finalizeOutcome";

enum RegistrationStep {
  SELECT_ANIMALS = 1,
  CHOOSE_ACTION = 2,
  CONFIRM = 3,
}

const REGISTRATION_STEPS = [
  RegistrationStep.SELECT_ANIMALS,
  RegistrationStep.CHOOSE_ACTION,
  RegistrationStep.CONFIRM,
];

const STEP_LABEL: Record<RegistrationStep, string> = {
  [RegistrationStep.SELECT_ANIMALS]: "Selecionar alvo",
  [RegistrationStep.CHOOSE_ACTION]: "Escolher acao",
  [RegistrationStep.CONFIRM]: "Confirmar",
};

const SEM_LOTE_OPTION = "__sem_lote__";

type QuickActionKey =
  | "vacinacao"
  | "vermifugacao"
  | "pesagem"
  | "movimentacao"
  | "compra"
  | "venda";

type QuickActionConfig = {
  key: QuickActionKey;
  label: string;
  helper: string;
  requiresAnimals?: boolean;
  icon: typeof Syringe;
};

const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    key: "vacinacao",
    label: "Vacinacao",
    helper: "Aplicacao sanitaria rapida para rotina de vacina.",
    requiresAnimals: true,
    icon: Syringe,
  },
  {
    key: "vermifugacao",
    label: "Vermifugacao",
    helper: "Registro sanitario rapido por lote ou animal.",
    requiresAnimals: true,
    icon: Syringe,
  },
  {
    key: "pesagem",
    label: "Pesagem",
    helper: "Lancar peso sem navegar pelo fluxo generico.",
    requiresAnimals: true,
    icon: Scale,
  },
  {
    key: "movimentacao",
    label: "Movimentacao",
    helper: "Mover animais entre lotes com menos cliques.",
    requiresAnimals: true,
    icon: Move,
  },
  {
    key: "compra",
    label: "Compra",
    helper: "Compra simples por lote, com ou sem novos animais.",
    icon: Handshake,
  },
  {
    key: "venda",
    label: "Venda",
    helper: "Venda simples com atualizacao do status do animal.",
    requiresAnimals: true,
    icon: Handshake,
  },
];

const isQuickActionKey = (value: string | null): value is QuickActionKey =>
  QUICK_ACTIONS.some((action) => action.key === value);

const getQuickActionConfig = (key: QuickActionKey | null) =>
  QUICK_ACTIONS.find((action) => action.key === key) ?? null;

const isReproTipoEnum = (value: string | null): value is ReproTipoEnum =>
  value === "cobertura" ||
  value === "IA" ||
  value === "diagnostico" ||
  value === "parto" ||
  value === "aborto";

const BullNameDisplay = ({ machoId }: { machoId: string }) => {
  const bull = useLiveQuery(
    () => loadRegistrarBullByIdEffect({ machoId }),
    [machoId],
  );
  if (!bull) return <span className="font-bold truncate max-w-[150px]">{machoId}</span>;
  return <span className="font-bold truncate max-w-[150px]">{bull.identificacao}</span>;
};

const Registrar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFarmId, role, farmMeasurementConfig, farmLifecycleConfig } =
    useAuth();
  const [step, setStep] = useState<RegistrationStep>(
    RegistrationStep.SELECT_ANIMALS,
  );
  const [tipoManejo, setTipoManejo] = useState<EventDomain | null>(null);
  const [quickAction, setQuickAction] = useState<QuickActionKey | null>(null);
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [selectedAnimais, setSelectedAnimais] = useState<string[]>([]);
  const [animalSearch, setAnimalSearch] = useState("");
  const [sourceTaskId, setSourceTaskId] = useState<string>("");

  const [pesagemData, setPesagemData] = useState<Record<string, string>>({});
  const [movimentacaoData, setMovimentacaoData] = useState({ toLoteId: "" });
  const [nutricaoData, setNutricaoData] = useState({
    alimentoNome: "",
    quantidadeKg: "",
  });
  const [reproducaoData, setReproducaoData] = useState<ReproductionEventData>({
    tipo: "cobertura",
    machoId: null,
    observacoes: "",
  });
  const quickActionConfig = getQuickActionConfig(quickAction);
  const partoRequiresSingleMatrix =
    tipoManejo === "reproducao" &&
    reproducaoData.tipo === "parto" &&
    selectedAnimais.length > 1;

  const selectRegularAction = useCallback((domain: EventDomain) => {
    setQuickAction(null);
    setTipoManejo(domain);
  }, []);

  const parseUserWeight = (value: string) =>
    parseWeightInput(value, farmMeasurementConfig.weight_unit);

  // TD-014: Validar peso > 0 no frontend para pesagem
  const isPesagemValid = selectedAnimais.every((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return false;
    const weight = parseUserWeight(weightStr);
    return weight !== null && weight > 0;
  });

  // P2.4 FIX: Use centralized useLotes hook
  const lotes = useLotes();
  const regulatorySurfaceSource = useLiveQuery(
    () =>
      loadRegistrarRegulatorySurfaceSourceEffect({
        activeFarmId: activeFarmId ?? null,
      }),
    [activeFarmId],
  );
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(
        regulatorySurfaceSource ?? undefined,
      ),
    [regulatorySurfaceSource],
  );
  const selectedLoteIdNormalized =
    selectedLoteId === SEM_LOTE_OPTION
      ? null
      : selectedLoteId || null;
  const selectedLoteLabel =
    selectedLoteId === SEM_LOTE_OPTION
      ? "Sem lote"
      : lotes?.find((l) => l.id === selectedLoteId)?.nome ?? "-";
  const nutricaoQuantidade =
    nutricaoData.quantidadeKg.trim() !== ""
      ? parseRegistrarNumeric(nutricaoData.quantidadeKg)
      : null;
  const nutricaoAlimentoMissing = nutricaoData.alimentoNome.trim().length === 0;
  const nutricaoQuantidadeInvalida =
    nutricaoQuantidade === null ||
    !Number.isFinite(nutricaoQuantidade) ||
    nutricaoQuantidade <= 0;
  const movimentacaoSemDestino = movimentacaoData.toLoteId.trim().length === 0;
  const movimentacaoDestinoIgualOrigem = isMovimentacaoDestinoIgualOrigem({
    origemLoteId: selectedLoteIdNormalized,
    destinoLoteId: movimentacaoData.toLoteId,
  });
  const pesagemAnimaisInvalidos = selectedAnimais.filter((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return true;
    const weight = parseUserWeight(weightStr);
    return weight === null || weight <= 0;
  });
  const requiresAnimalsForQuickAction =
    quickActionConfig?.requiresAnimals === true && selectedAnimais.length === 0;
  const animaisNoLote = useLiveQuery(
    () =>
      loadRegistrarAnimaisNoLoteEffect({
        selectedLoteId,
        semLoteOption: SEM_LOTE_OPTION,
      }),
    [selectedLoteId],
  );
  const filteredAnimaisNoLote = useMemo(() => {
    return filterRegistrarAnimalsBySearch({
      animals: animaisNoLote ?? [],
      search: animalSearch,
    });
  }, [animalSearch, animaisNoLote]);
  const visibleAnimalIds = filteredAnimaisNoLote.map((animal) => animal.id);
  const selectedVisibleCount = resolveSelectedVisibleCount({
    selectedAnimalIds: selectedAnimais,
    visibleAnimalIds,
  });
  const selectedAnimaisDetalhes = useMemo(
    () =>
      resolveSelectedRecordsByIds({
        records: animaisNoLote ?? [],
        selectedIds: selectedAnimais,
      }),
    [animaisNoLote, selectedAnimais],
  );

  const contrapartes = useLiveQuery(
    () =>
      loadRegistrarContrapartesEffect({
        activeFarmId: activeFarmId ?? null,
      }),
    [activeFarmId],
  );

  const financeiroPackage = useRegistrarFinanceiroPackage({
    role,
    activeFarmId: activeFarmId ?? null,
    tipoManejo,
    selectedAnimalIds: selectedAnimais,
    farmWeightUnit: farmMeasurementConfig.weight_unit,
    parseUserWeight,
    lotes,
  });
  const {
    financeiroData,
    updateFinanceiroData,
    applyFinanceiroNaturezaQueryPrefill,
    showNovaContraparte,
    setShowNovaContraparte,
    isSavingContraparte,
    novaContraparte,
    setNovaContraparte,
    compraNovosAnimais,
    canManageContraparte,
    financeiroWeightStep,
    financeiroWeightUnitLabel,
    financialContext,
    handleCreateContraparte,
    updateCompraNovoAnimalField,
    updateCompraNovoAnimalPesoByIndex,
    financialSummary,
  } = financeiroPackage;
  const {
    financeiroTipo,
    isFinanceiroSociedade,
    financeiroQuantidadeAnimais,
    financeiroValorUnitario,
    financeiroValorTotalInformado,
    financeiroPesoLote,
    financeiroValorTotalCalculado,
  } = financialContext;

  const sanitarioPackage = useRegistrarSanitarioPackage({
    activeFarmId: activeFarmId ?? null,
    tipoManejo,
    sourceTaskId,
    financeiroNatureza: financeiroData.natureza,
    regulatorySurfaceConfig: (regulatorySurfaceSource?.config as Record<string, unknown> | null) ?? null,
    regulatoryReadModel,
    animaisNoLote: (animaisNoLote as Animal[] | undefined) ?? undefined,
    selectedAnimaisDetalhes,
  });
  const {
    sanitarioData,
    applySanitaryQuickAction,
    handleSanitarioTipoChange,
    handleSanitarioProdutoChange,
    applySanitaryQueryPrefill,
    selectedVeterinaryProduct,
    selectedVeterinaryProductId,
    selectedVeterinaryProductSelection,
    hasVeterinaryProducts,
    isVeterinaryProductsEmpty,
    veterinaryProductSuggestions,
    selectVeterinaryProduct,
    protocolos,
    protocoloId,
    setProtocoloId,
    protocoloItemId,
    setProtocoloItemId,
    protocoloItensEvaluated,
    selectedProtocoloItemEvaluation,
    selectedProtocolRestrictionsText,
    selectedProtocolPrimaryReason,
    allProtocolItemsIneligible,
    protocolEligibilityIssues,
    sanitatioProductMissing,
    resolveProtocolProductSelection,
    transitChecklist,
    setTransitChecklist,
    transitChecklistIssues,
    showsTransitChecklist,
    officialTransitChecklistEnabled,
    animalsBlockedBySanitaryAlert,
    sanitaryMovementBlockIssues,
    movementComplianceGuards,
    nutritionComplianceGuards,
    complianceFlowIssues,
  } = sanitarioPackage;
  const {
    valorLabel: financeiroResumoValorLabel,
    precoLabel: financeiroResumoPrecoLabel,
    pesoLabel: financeiroResumoPesoLabel,
  } = financialSummary;
  const applyQuickAction = useCallback((actionKey: QuickActionKey) => {
    setQuickAction(actionKey);

    if (actionKey === "vacinacao" || actionKey === "vermifugacao") {
      setTipoManejo("sanitario");
      applySanitaryQuickAction(actionKey);
      return;
    }

    if (actionKey === "pesagem") {
      setTipoManejo("pesagem");
      return;
    }

    if (actionKey === "movimentacao") {
      setTipoManejo("movimentacao");
      return;
    }

    setTipoManejo("financeiro");
    updateFinanceiroData("natureza", actionKey === "compra" ? "compra" : "venda");
  }, [applySanitaryQuickAction, updateFinanceiroData]);

  const contraparteSelecionadaNome =
    financeiroData.contraparteId !== "none"
      ? contrapartes?.find((item) => item.id === financeiroData.contraparteId)
          ?.nome ?? "Contraparte selecionada"
      : "Sem contraparte";
  const showFinanceiroAnimaisGeradosResumo =
    tipoManejo === "financeiro" &&
    financeiroData.natureza === "compra" &&
    selectedAnimais.length === 0 &&
    !isFinanceiroSociedade;
  const reproducaoResumoCriasGeradas = Math.max(
    1,
    reproducaoData.numeroCrias ?? reproducaoData.crias?.length ?? 1,
  );
  const reproducaoResumoReprodutorLabel = reproducaoData.machoId ? (
    <BullNameDisplay machoId={reproducaoData.machoId} />
  ) : null;
  const transitChecklistPurposeLabel = transitChecklist.purpose.replace(/_/g, " ");
  const transitChecklistGtaLabel = transitChecklist.gtaNumber || "Checklist concluido";
  const confirmacaoManejoLabel = quickActionConfig?.label ?? tipoManejo ?? "-";
  const showConfirmacaoAlvoLote = selectedAnimais.length === 0;
  const showConfirmacaoDestinoMovimentacao = tipoManejo === "movimentacao";
  const confirmacaoDestinoMovimentacaoLabel =
    lotes?.find((item) => item.id === movimentacaoData.toLoteId)?.nome ?? "-";
  const showConfirmacaoNutricaoAlimento = tipoManejo === "nutricao";
  const transitChecklistSection = showsTransitChecklist ? (
    <RegistrarTransitChecklistSection
      transitChecklist={transitChecklist}
      onTransitChecklistChange={setTransitChecklist}
      officialTransitChecklistEnabled={officialTransitChecklistEnabled}
      transitChecklistIssues={transitChecklistIssues}
      transitPurposeOptions={TRANSIT_PURPOSE_OPTIONS}
      ufOptions={TRANSIT_CHECKLIST_UF_OPTIONS}
    />
  ) : null;
  const sanitaryMovementBlockSection =
    showsTransitChecklist && animalsBlockedBySanitaryAlert.length > 0 ? (
      <RegistrarSanitaryMovementBlockSection
        blockedAnimals={animalsBlockedBySanitaryAlert}
      />
    ) : null;
  const movementComplianceBlockSection = (
    <RegistrarComplianceBlockSection
      title="Restricoes regulatorias de movimentacao"
      description="O overlay oficial detectou pendencias que afetam este fluxo de movimentacao."
      blockers={movementComplianceGuards.blockers}
      warnings={movementComplianceGuards.warnings}
    />
  );
  const nutritionComplianceBlockSection = (
    <RegistrarComplianceBlockSection
      title="Restricoes regulatorias de nutricao"
      description="O overlay oficial detectou risco alimentar ou operacional antes do lancamento deste manejo."
      blockers={nutritionComplianceGuards.blockers}
      warnings={nutritionComplianceGuards.warnings}
    />
  );

  const baseActionStepIssues = useMemo(
    () =>
      buildBaseActionStepIssues({
        tipoManejo,
        sanitatioProductMissing,
        pesagemAnimaisInvalidosCount: pesagemAnimaisInvalidos.length,
        movimentacaoSemDestino,
        movimentacaoDestinoIgualOrigem,
        nutricaoAlimentoMissing,
        nutricaoQuantidadeInvalida,
        isFinanceiroSociedade,
        financeiroContraparteId: financeiroData.contraparteId,
        partoRequiresSingleMatrix,
      }),
    [
      financeiroData.contraparteId,
      isFinanceiroSociedade,
      movimentacaoDestinoIgualOrigem,
      movimentacaoSemDestino,
      nutricaoAlimentoMissing,
      nutricaoQuantidadeInvalida,
      partoRequiresSingleMatrix,
      pesagemAnimaisInvalidos.length,
      sanitatioProductMissing,
      tipoManejo,
    ],
  );
  const actionStepIssues = useMemo(
    () =>
      composeRegistrarActionStepIssues({
        baseIssues: baseActionStepIssues,
        protocolEligibilityIssues,
        sanitaryMovementBlockIssues,
        complianceFlowIssues,
        transitChecklistIssues,
      }),
    [
      baseActionStepIssues,
      complianceFlowIssues,
      protocolEligibilityIssues,
      sanitaryMovementBlockIssues,
      transitChecklistIssues,
    ],
  );
  const canAdvanceToConfirm = actionStepIssues.length === 0;

  useEffect(() => {
    const querySourceTaskId = searchParams.get("sourceTaskId");
    const queryDomain = searchParams.get("dominio");
    const queryNatureza = searchParams.get("natureza");
    const queryQuick = searchParams.get("quick");
    const queryAnimalId = searchParams.get("animalId");
    const queryLoteId = searchParams.get("loteId");
    const queryProtocoloId = searchParams.get("protocoloId");
    const queryProtocoloItemId = searchParams.get("protocoloItemId");
    const queryProduto = searchParams.get("produto");
    const querySanitarioTipo = searchParams.get("sanitarioTipo");
    const queryReproTipo = searchParams.get("reproTipo");

    if (querySourceTaskId) {
      setSourceTaskId(querySourceTaskId);
    }
    if (queryLoteId) {
      setSelectedLoteId(queryLoteId);
    }
    if (queryAnimalId) {
      setSelectedAnimais([queryAnimalId]);
    }
    if (isQuickActionKey(queryQuick)) {
      applyQuickAction(queryQuick);
    }
    if (
      queryDomain &&
      ["sanitario", "pesagem", "movimentacao", "nutricao", "financeiro"].includes(
        queryDomain,
      )
    ) {
      setTipoManejo(queryDomain as EventDomain);
    }
    applySanitaryQueryPrefill({
      protocoloId: queryProtocoloId,
      protocoloItemId: queryProtocoloItemId,
      produto: queryProduto,
      sanitarioTipo: querySanitarioTipo,
    });
    applyFinanceiroNaturezaQueryPrefill(queryNatureza);
    if (queryDomain === "reproducao") {
      setTipoManejo("reproducao");
      setQuickAction(null);
      if (isReproTipoEnum(queryReproTipo)) {
        setReproducaoData((prev) => ({
          ...prev,
          tipo: queryReproTipo,
          episodeEventoId: null,
          episodeLinkMethod: undefined,
        }));
      }
    }
    if ((queryDomain && queryAnimalId) || (isQuickActionKey(queryQuick) && queryAnimalId)) {
      setStep(RegistrationStep.CHOOSE_ACTION);
    }
  }, [
    searchParams,
    applyQuickAction,
    applyFinanceiroNaturezaQueryPrefill,
    applySanitaryQueryPrefill,
  ]);

  // TD-008: Anti-teleport (ensure origin !== destination)
  useEffect(() => {
    if (
      shouldClearMovimentacaoDestino({
        origemLoteId: selectedLoteIdNormalized,
        destinoLoteId: movimentacaoData.toLoteId,
      })
    ) {
      setMovimentacaoData((prev) => ({ ...prev, toLoteId: "" }));
    }
  }, [movimentacaoData.toLoteId, selectedLoteIdNormalized]);

  // UX Improvement: Auto-select bull if present in the selected lote
  useEffect(() => {
     const autoSelectBull = async () => {
        const selectedBull = await loadRegistrarSingleActiveBullInLoteEffect({
          tipoManejo,
          selectedLoteId,
          semLoteOption: SEM_LOTE_OPTION,
          selectedBullId: reproducaoData.machoId,
        });
        if (!selectedBull) return;

        setReproducaoData((prev) => ({ ...prev, machoId: selectedBull.id }));
        showSuccess(
          `Reprodutor ${selectedBull.identificacao} selecionado automaticamente.`,
        );
     };

     autoSelectBull();
  }, [tipoManejo, selectedLoteId, reproducaoData.machoId]);


  const handleFinalize = async () => {
    if (!tipoManejo) return;

    const fazenda_id = activeFarmId ?? lotes?.[0]?.fazenda_id;
    if (!fazenda_id) return;

    const hasSelectedAnimals = selectedAnimais.length > 0;
    const compraGerandoAnimais =
      tipoManejo === "financeiro" &&
      financeiroData.natureza === "compra" &&
      !hasSelectedAnimals;

    const preflightIssue = resolveRegistrarPreflightIssue({
      tipoManejo,
      selectedAnimais,
      selectedLoteId,
      partoRequiresSingleMatrix,
      isFinanceiroSociedade,
      financeiroData: {
        natureza: financeiroData.natureza,
        modoPeso: financeiroData.modoPeso,
        modoPreco: financeiroData.modoPreco,
        contraparteId: financeiroData.contraparteId,
      },
      financeiroValorTotalCalculado,
      financeiroPesoLote,
      financeiroValorUnitario,
      financeiroQuantidadeAnimais,
      compraNovosAnimais,
      pesagemData,
      transitChecklistIssues,
      complianceFlowIssues,
      parseUserWeight,
    });
    if (preflightIssue) {
      showError(preflightIssue);
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
      } = await loadRegistrarSanitaryFinalizeContext({
        tipoManejo,
        protocoloItemId,
        sanitaryTypedProduct: sanitarioData.produto,
        selectedVeterinaryProductSelection,
        resolveProtocolProductSelection,
        showsTransitChecklist,
        transitChecklist,
        officialTransitChecklistEnabled,
      });

      const sanitaryRpc = await tryRegistrarSanitaryRpcFinalizeEffect({
        tipoManejo,
        sourceTaskId,
        fazendaId: fazenda_id,
        occurredAt: now,
        tipo: sanitarioData.tipo,
        sanitaryProductName,
        sanitaryProductMetadata,
      });
      if (sanitaryRpc.status === "handled") {
        showSuccess(
          `Aplicacao sanitaria confirmada no servidor. Evento ${sanitaryRpc.eventoId.slice(0, 8)}.`,
        );
        navigate("/home");
        return;
      }

      const ops: OperationInput[] = [];
      const createdAnimalIds: string[] = [];

      let linkedEventId: string | null = null;
      let postPartoRedirect:
        | { motherId: string; eventId: string; calfIds: string[] }
        | null = null;

      const targetAnimalIds = resolveRegistrarTargetAnimalIds({
        hasSelectedAnimals,
        selectedAnimais,
      });

      // P3.2 PERF: Fetch all animals in bulk to avoid N+1 queries
      const distinctAnimalIds =
        resolveRegistrarDistinctAnimalIds(targetAnimalIds);
      const animalsMap = await loadRegistrarAnimalsMap({
        animalIds: distinctAnimalIds,
      });

      if (
        isRegistrarFinancialFlow({
          tipoManejo,
          isFinanceiroSociedade,
        })
      ) {
        const financialPlan = resolveRegistrarFinancialFinalizePlan({
          tipoManejo,
          natureza: financeiroData.natureza,
          isFinanceiroSociedade,
          fazendaId: fazenda_id,
          occurredAt: now,
          selectedAnimalIds: selectedAnimais,
          animalsMap,
          selectedLoteIdNormalized,
          contraparteId: financeiroData.contraparteId,
          sourceTaskId: sourceTaskId || null,
          compraNovosAnimais,
          modoPeso: financeiroData.modoPeso,
          modoPreco: financeiroData.modoPreco,
          valorTotalInformado: financeiroValorTotalInformado,
          valorUnitario: financeiroValorUnitario,
          pesoLote: financeiroPesoLote,
          transitChecklistPayload,
          parseUserWeight,
        });

        if (financialPlan.issue) {
          showError(financialPlan.issue);
          return;
        }

        linkedEventId = financialPlan.linkedEventId;
        createdAnimalIds.push(...financialPlan.createdAnimalIds);
        ops.push(...financialPlan.ops);
      } else {
        const nonFinancialPlan = await resolveRegistrarNonFinancialFinalizePlan({
          tipoManejo,
          fazendaId: fazenda_id,
          occurredAt: now,
          sourceTaskId: sourceTaskId || null,
          targetAnimalIds,
          animalsMap,
          selectedLoteIsSemLote: selectedLoteId === SEM_LOTE_OPTION,
          selectedLoteIdNormalized,
          createdAnimalIds,
          transitChecklistPayload,
          sanitaryProductName,
          sanitaryProductSelection,
          sanitaryProductMetadata,
          protocoloItem,
          sanitarioData,
          pesagemData,
          movimentacaoData,
          nutricaoData,
          financeiroData: {
            natureza: financeiroData.natureza,
            valorTotal: financeiroData.valorTotal,
            contraparteId: financeiroData.contraparteId,
          },
          financeiroTipo,
          reproducaoData,
          farmLifecycleConfig,
          parseUserWeight,
        });

        if (nonFinancialPlan.issue) {
          showError(nonFinancialPlan.issue);
          return;
        }

        if (!linkedEventId && nonFinancialPlan.linkedEventId) {
          linkedEventId = nonFinancialPlan.linkedEventId;
        }
        postPartoRedirect = nonFinancialPlan.postPartoRedirect;
        ops.push(...nonFinancialPlan.ops);
      }

      if (sourceTaskId && linkedEventId) {
        ops.push(
          buildRegistrarAgendaCompletionOp({
            sourceTaskId,
            linkedEventId,
          }),
        );
      }

      const opsIssue = resolveRegistrarFinalizeOpsIssue(ops.length);
      if (opsIssue) {
        showError(opsIssue);
        return;
      }

      const txId = await runRegistrarFinalizeGestureEffect({
        fazendaId: fazenda_id,
        ops,
      });
      showSuccess(
        buildRegistrarFinalizeSuccessMessage({
          compraGerandoAnimais,
          createdAnimalCount: createdAnimalIds.length,
          txId,
        }),
      );
      navigate(buildRegistrarPostFinalizeNavigationPath(postPartoRedirect));
    } catch (e: unknown) {
      showError(resolveRegistrarFinalizeCatchIssue(e));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageIntro
        eyebrow="Fluxo operacional"
        title="Registrar manejo"
        description="Fluxo guiado para selecionar o alvo, escolher a acao e confirmar o gesto offline-first sem perder contexto operacional."
        meta={
          <>
            <StatusBadge tone="info">
              Etapa {step}/3: {STEP_LABEL[step]}
            </StatusBadge>
            {sourceTaskId ? (
              <StatusBadge tone="neutral">
                Origem agenda {sourceTaskId.slice(0, 8)}
              </StatusBadge>
            ) : null}
            {quickActionConfig ? (
              <StatusBadge tone="neutral">{quickActionConfig.label}</StatusBadge>
            ) : null}
            {selectedLoteLabel !== "-" ? (
              <StatusBadge tone="neutral">{selectedLoteLabel}</StatusBadge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3">
        {REGISTRATION_STEPS.map((currentStep) => (
          <div
            key={currentStep}
            className={
              step >= currentStep
                ? "rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3"
                : "rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Etapa {currentStep}
            </p>
            <p className="mt-1 text-sm font-medium">{STEP_LABEL[currentStep]}</p>
          </div>
        ))}
      </div>

      {step === RegistrationStep.SELECT_ANIMALS && (
        <RegistrarSelectTargetStep
          quickAction={quickAction}
          quickActions={QUICK_ACTIONS}
          onApplyQuickAction={applyQuickAction}
          onClearQuickAction={() => setQuickAction(null)}
          selectedLoteId={selectedLoteId}
          onSelectedLoteIdChange={(value) => {
            setSelectedLoteId(value);
            setSelectedAnimais([]);
          }}
          semLoteOption={SEM_LOTE_OPTION}
          lotes={lotes ?? []}
          selectedAnimaisCount={selectedAnimais.length}
          selectedVisibleCount={selectedVisibleCount}
          filteredAnimaisNoLote={filteredAnimaisNoLote}
          visibleAnimalIds={visibleAnimalIds}
          selectedAnimais={selectedAnimais}
          animalSearch={animalSearch}
          onAnimalSearchChange={setAnimalSearch}
          onSelectVisible={(visibleIds) =>
            setSelectedAnimais((prev) =>
              Array.from(new Set([...prev, ...visibleIds])),
            )
          }
          onClearSelection={() => setSelectedAnimais([])}
          onToggleAnimalSelection={(animalId, checked) =>
            setSelectedAnimais((prev) =>
              checked
                ? [...prev, animalId]
                : prev.filter((id) => id !== animalId),
            )
          }
          animaisNoLoteCount={animaisNoLote?.length ?? 0}
          requiresAnimalsForQuickAction={requiresAnimalsForQuickAction}
          quickActionLabel={quickActionConfig?.label ?? null}
          onNext={() => setStep(RegistrationStep.CHOOSE_ACTION)}
        />
      )}

      {step === RegistrationStep.CHOOSE_ACTION && (
        <Card>
          <CardHeader>
            <CardTitle>2. Escolher Ação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Manejos mais usados</p>
                <p className="text-sm text-muted-foreground">
                  Atalhos com prefill para a rotina mais comum do campo.
                </p>
              </div>
              <div>
                <RegistrarQuickActionsGrid
                  actions={QUICK_ACTIONS}
                  activeAction={quickAction}
                  selectedAnimalsCount={selectedAnimais.length}
                  disableRequiresAnimals
                  onSelectAction={applyQuickAction}
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Todos os registros</p>
              <RegistrarManejoActionsGrid
                tipoManejo={tipoManejo}
                selectedAnimaisCount={selectedAnimais.length}
                onSelectAction={selectRegularAction}
              />
            </div>

            {selectedAnimais.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem animais selecionados: use Financeiro para compra/sociedade
                por lote. Venda exige selecao de animal.
              </p>
            )}

            {tipoManejo === "sanitario" && (
              <RegistrarSanitarioSection
                sanitarioTipo={sanitarioData.tipo}
                onSanitarioTipoChange={handleSanitarioTipoChange}
                produto={sanitarioData.produto}
                onProdutoChange={handleSanitarioProdutoChange}
                sanitatioProductMissing={sanitatioProductMissing}
                selectedVeterinaryProduct={selectedVeterinaryProduct}
                hasVeterinaryProducts={hasVeterinaryProducts}
                isVeterinaryProductsEmpty={isVeterinaryProductsEmpty}
                veterinaryProductSuggestions={veterinaryProductSuggestions}
                selectedVeterinaryProductId={selectedVeterinaryProductId}
                onSelectVeterinaryProduct={selectVeterinaryProduct}
                protocoloId={protocoloId}
                onProtocoloChange={(value) => setProtocoloId(value === "none" ? "" : value)}
                protocolos={protocolos ?? []}
                protocoloItemId={protocoloItemId}
                onProtocoloItemChange={setProtocoloItemId}
                protocoloItensEvaluated={protocoloItensEvaluated}
                selectedAnimaisDetalhesCount={selectedAnimaisDetalhes.length}
                selectedProtocolRestrictionsText={selectedProtocolRestrictionsText}
                selectedProtocolPrimaryReason={selectedProtocolPrimaryReason}
                selectedProtocolCompatibleWithAll={
                  selectedProtocoloItemEvaluation?.eligibility.compatibleWithAll ?? null
                }
                allProtocolItemsIneligible={allProtocolItemsIneligible}
              />
            )}

            {tipoManejo === "pesagem" && (
              <RegistrarPesagemSection
                selectedAnimalIds={selectedAnimais}
                animaisNoLote={animaisNoLote}
                invalidAnimalIds={pesagemAnimaisInvalidos}
                weightInputStep={getWeightInputStep(farmMeasurementConfig.weight_unit)}
                weightUnitLabel={getWeightUnitLabel(farmMeasurementConfig.weight_unit)}
                pesagemData={pesagemData}
                onPesoChange={(animalId, value) =>
                  setPesagemData((prev) => ({ ...prev, [animalId]: value }))
                }
              />
            )}

            {tipoManejo === "movimentacao" && (
              <RegistrarMovimentacaoSection
                movimentacaoDestinoId={movimentacaoData.toLoteId}
                onMovimentacaoDestinoChange={(value) => setMovimentacaoData({ toLoteId: value })}
                lotesDestino={
                  lotes?.filter((lote) => lote.id !== selectedLoteIdNormalized) ?? []
                }
                movimentacaoSemDestino={movimentacaoSemDestino}
                movimentacaoDestinoIgualOrigem={movimentacaoDestinoIgualOrigem}
                transitChecklistSection={transitChecklistSection}
                sanitaryMovementBlockSection={sanitaryMovementBlockSection}
                movementComplianceBlockSection={movementComplianceBlockSection}
              />
            )}

            {tipoManejo === "nutricao" && (
              <RegistrarNutricaoSection
                alimentoNome={nutricaoData.alimentoNome}
                onAlimentoNomeChange={(value) =>
                  setNutricaoData((prev) => ({ ...prev, alimentoNome: value }))
                }
                quantidadeKg={nutricaoData.quantidadeKg}
                onQuantidadeKgChange={(value) =>
                  setNutricaoData((prev) => ({ ...prev, quantidadeKg: value }))
                }
                nutricaoAlimentoMissing={nutricaoAlimentoMissing}
                nutricaoQuantidadeInvalida={nutricaoQuantidadeInvalida}
                nutritionComplianceBlockSection={nutritionComplianceBlockSection}
              />
            )}

            {tipoManejo === "financeiro" && (
              <RegistrarFinanceiroSection
                financeiroData={financeiroData}
                onNaturezaChange={(natureza) => updateFinanceiroData("natureza", natureza)}
                onQuantidadeAnimaisChange={(value) =>
                  updateFinanceiroData("quantidadeAnimais", value)
                }
                onModoPrecoChange={(modoPreco) => updateFinanceiroData("modoPreco", modoPreco)}
                onValorUnitarioChange={(valorUnitario) =>
                  updateFinanceiroData("valorUnitario", valorUnitario)
                }
                onValorTotalChange={(valorTotal) =>
                  updateFinanceiroData("valorTotal", valorTotal)
                }
                onModoPesoChange={(modoPeso) => updateFinanceiroData("modoPeso", modoPeso)}
                onPesoLoteChange={(pesoLoteKg) =>
                  updateFinanceiroData("pesoLoteKg", pesoLoteKg)
                }
                onContraparteChange={(contraparteId) =>
                  updateFinanceiroData("contraparteId", contraparteId)
                }
                financeiroValorTotalCalculado={financeiroValorTotalCalculado}
                isFinanceiroSociedade={isFinanceiroSociedade}
                selectedAnimalIds={selectedAnimais}
                contrapartes={contrapartes}
                canManageContraparte={canManageContraparte}
                showNovaContraparte={showNovaContraparte}
                onToggleNovaContraparte={() => setShowNovaContraparte((prev) => !prev)}
                onNavigateContrapartes={() => navigate("/contrapartes")}
                novaContraparte={novaContraparte}
                onNovaContraparteFieldChange={(field, value) =>
                  setNovaContraparte((prev) => ({ ...prev, [field]: value }))
                }
                onCreateContraparte={handleCreateContraparte}
                isSavingContraparte={isSavingContraparte}
                compraNovosAnimais={compraNovosAnimais}
                onCompraIdentificacaoChange={(localId, value) =>
                  updateCompraNovoAnimalField(localId, "identificacao", value)
                }
                onCompraSexoChange={(localId, value) =>
                  updateCompraNovoAnimalField(localId, "sexo", value)
                }
                onCompraDataNascimentoChange={(localId, value) =>
                  updateCompraNovoAnimalField(localId, "dataNascimento", value)
                }
                onCompraPesoChange={(localId, value) =>
                  updateCompraNovoAnimalField(localId, "pesoKg", value)
                }
                onVendaPesoAtIndexChange={updateCompraNovoAnimalPesoByIndex}
                animaisNoLote={animaisNoLote}
                weightInputStep={financeiroWeightStep}
                weightUnitLabel={financeiroWeightUnitLabel}
                transitChecklistSection={transitChecklistSection}
                sanitaryMovementBlockSection={sanitaryMovementBlockSection}
                movementComplianceBlockSection={movementComplianceBlockSection}
              />

            )}

            {tipoManejo === "reproducao" && (
              <RegistrarReproducaoSection
                partoRequiresSingleMatrix={partoRequiresSingleMatrix}
                fazendaId={activeFarmId ?? ""}
                animalId={selectedAnimais[0]}
                data={reproducaoData}
                onChange={setReproducaoData}
              />
            )}

            {actionStepIssues.length > 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {actionStepIssues[0]}
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(RegistrationStep.SELECT_ANIMALS)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={!tipoManejo || !canAdvanceToConfirm}
                onClick={() => setStep(RegistrationStep.CONFIRM)}
              >
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CONFIRM && (
        <Card>
          <CardHeader>
            <CardTitle>3. Salvar neste aparelho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-info/20 bg-info/5 p-4 text-sm text-muted-foreground">
              Ao confirmar, o manejo fica salvo imediatamente neste aparelho. A
              confirmacao autoritativa aparece depois na fila de sync.
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <ConfirmacaoResumoBase
                manejoLabel={confirmacaoManejoLabel}
                animaisCount={selectedAnimais.length}
                showAlvoLote={showConfirmacaoAlvoLote}
                alvoLoteLabel={selectedLoteLabel}
                showDestinoMovimentacao={showConfirmacaoDestinoMovimentacao}
                destinoMovimentacaoLabel={confirmacaoDestinoMovimentacaoLabel}
                showNutricaoAlimento={showConfirmacaoNutricaoAlimento}
                nutricaoAlimentoLabel={nutricaoData.alimentoNome}
              />
              {transitChecklist.enabled ? (
                <TransitChecklistResumoConfirmacao
                  purposeLabel={transitChecklistPurposeLabel}
                  gtaLabel={transitChecklistGtaLabel}
                  isInterstate={transitChecklist.isInterstate}
                  destinationUf={transitChecklist.destinationUf}
                />
              ) : null}
              {tipoManejo === "financeiro" && (
                <FinanceiroResumoConfirmacao
                  naturezaLabel={financeiroData.natureza.replace(/_/g, " ")}
                  contraparteNome={contraparteSelecionadaNome}
                  valorLabel={financeiroResumoValorLabel}
                  isFinanceiroSociedade={isFinanceiroSociedade}
                  quantidadeAnimais={financeiroQuantidadeAnimais}
                  precoLabel={financeiroResumoPrecoLabel}
                  pesoLabel={financeiroResumoPesoLabel}
                  showAnimaisGerados={showFinanceiroAnimaisGeradosResumo}
                  animaisGeradosCount={compraNovosAnimais.length}
                />
              )}
              {tipoManejo === "reproducao" && (
                <ReproducaoResumoConfirmacao
                  tipoLabel={reproducaoData.tipo}
                  showCriasGeradas={reproducaoData.tipo === "parto"}
                  criasGeradas={reproducaoResumoCriasGeradas}
                  reprodutorLabel={reproducaoResumoReprodutorLabel}
                  observacoes={reproducaoData.observacoes}
                />
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(RegistrationStep.CHOOSE_ACTION)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleFinalize}
              >
                <Check className="mr-2 h-4 w-4" /> Salvar neste aparelho
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Registrar;
