import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReproTipoEnum, Animal } from "@/lib/offline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  ClipboardCheck,
  Info,
  MapPin,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { parseWeightInput } from "@/lib/format/weight";
import { cn } from "@/lib/utils";
import { buildRegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  filterRegistrarAnimalsBySearch,
  resolveSelectedVisibleCount,
} from "@/pages/Registrar/helpers/animalSelection";
import { resolveSelectedRecordsByIds } from "@/pages/Registrar/helpers/selectContext";
import {
  buildBaseActionStepIssues,
  composeRegistrarActionStepIssues,
} from "@/pages/Registrar/helpers/actionStepIssues";
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
import { ReproducaoResumoConfirmacao } from "@/pages/Registrar/components/ReproducaoResumoConfirmacao";
import { TransitChecklistResumoConfirmacao } from "@/pages/Registrar/components/TransitChecklistResumoConfirmacao";
import { ConfirmacaoResumoBase } from "@/pages/Registrar/components/ConfirmacaoResumoBase";
import { RegistrarManejoActionsGrid } from "@/pages/Registrar/components/RegistrarManejoActionsGrid";
import { RegistrarSelectTargetStep } from "@/pages/Registrar/components/RegistrarSelectTargetStep";
import { RegistrarSanitarioSection } from "@/pages/Registrar/components/RegistrarSanitarioSection";
import { RegistrarPesagemSection } from "@/pages/Registrar/components/RegistrarPesagemSection";
import { RegistrarMovimentacaoSection } from "@/pages/Registrar/components/RegistrarMovimentacaoSection";
import { RegistrarNutricaoSection } from "@/pages/Registrar/components/RegistrarNutricaoSection";
import { RegistrarReproducaoSection } from "@/pages/Registrar/components/RegistrarReproducaoSection";
import { useRegistrarSanitarioPackage } from "@/pages/Registrar/components/useRegistrarSanitarioPackage";
import { useRegistrarFinanceiroPackage } from "@/pages/Registrar/components/useRegistrarFinanceiroPackage";
import {
  buildRegistrarFinalizeSuccessMessage,
  buildRegistrarPostFinalizeNavigationPath,
} from "@/pages/Registrar/helpers/finalizeOutcome";
import {
  REGISTRATION_STEPS,
  RegistrationStep,
  STEP_LABEL,
  useRegistrarStepFlow,
} from "@/pages/Registrar/useRegistrarStepFlow";
import { parseRegistrarQueryState } from "@/pages/Registrar/helpers/registrarQueryState";
import { resolveRegistrarDisplayContext } from "@/pages/Registrar/helpers/registrarContextResolver";
import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  resolveRegistrarFinalizeOpsIssue,
  resolveRegistrarFinalizeCatchIssue,
} from "@/pages/Registrar/helpers/finalizeGuards";
import {
  buildRegistrarAgendaCompletionOp,
  resolveRegistrarDistinctAnimalIds,
  resolveRegistrarTargetAnimalIds,
} from "@/pages/Registrar/helpers/plan";
import {
  isQuickActionKey,
  requiresAnimalsForQuickAction,
  useRegistrarQuickActionPolicy,
} from "@/pages/Registrar/useRegistrarQuickActionPolicy";
import {
  resolveFinanceiroNaturezaLabel,
  supportsDraftAnimalsInFinanceiroNatureza,
} from "@/pages/Registrar/helpers/financialNature";
import { useRegistrarActionSectionState } from "@/pages/Registrar/useRegistrarActionSectionState";
import { useRegistrarShellState } from "@/pages/Registrar/useRegistrarShellState";

const SEM_LOTE_OPTION = "__sem_lote__";

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
  if (!bull)
    return <span className="font-bold truncate max-w-[150px]">{machoId}</span>;
  return (
    <span className="font-bold truncate max-w-[150px]">
      {bull.identificacao}
    </span>
  );
};

const Registrar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [contextAnimalId, setContextAnimalId] = useState("");
  const [contextLoteId, setContextLoteId] = useState("");
  const [contextPastoId, setContextPastoId] = useState("");
  const [showTechDetails, setShowTechDetails] = useState(false);
  const { activeFarmId, role, farmMeasurementConfig, farmLifecycleConfig } =
    useAuth();
  const shellState = useRegistrarShellState({
    semLoteOption: SEM_LOTE_OPTION,
  });
  const {
    tipoManejo,
    setTipoManejo,
    selectedLoteId,
    setSelectedLoteId,
    selectedLoteIdNormalized,
    selectedAnimais,
    setSelectedAnimais,
    animalSearch,
    setAnimalSearch,
    sourceTaskId,
    setSourceTaskId,
    pesagemData,
    setPesagemData,
    movimentacaoData,
    setMovimentacaoData,
    nutricaoData,
    setNutricaoData,
    reproducaoData,
    setReproducaoData,
    partoRequiresSingleMatrix,
    nutricaoAlimentoMissing,
    nutricaoQuantidadeInvalida,
    movimentacaoSemDestino,
    movimentacaoDestinoIgualOrigem,
    onSelectedLoteIdChange,
    onSelectVisibleAnimais,
    onToggleAnimalSelection,
    clearSelectedAnimais,
  } = shellState;

  const parseUserWeight = useCallback(
    (value: string) =>
      parseWeightInput(value, farmMeasurementConfig.weight_unit),
    [farmMeasurementConfig.weight_unit],
  );

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
      buildRegulatoryOperationalReadModel(regulatorySurfaceSource ?? undefined),
    [regulatorySurfaceSource],
  );
  const selectedLoteLabel =
    selectedLoteId === SEM_LOTE_OPTION
      ? "Sem lote"
      : (lotes?.find((l) => l.id === selectedLoteId)?.nome ?? "-");
  const pesagemAnimaisInvalidos = selectedAnimais.filter((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return true;
    const weight = parseUserWeight(weightStr);
    return weight === null || weight <= 0;
  });
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
  const hasRegistrarDisplayContext = Boolean(
    sourceTaskId || contextAnimalId || contextLoteId || contextPastoId,
  );
  const registrarContextRecords = useLiveQuery(async () => {
    if (!hasRegistrarDisplayContext) {
      return {
        agendaItem: null,
        animal: null,
        lote: null,
        pasto: null,
      };
    }

    const [agendaItem, animal, lote, pasto] = await Promise.all([
      sourceTaskId
        ? db.state_agenda_itens.get(sourceTaskId)
        : Promise.resolve(null),
      contextAnimalId
        ? db.state_animais.get(contextAnimalId)
        : Promise.resolve(null),
      contextLoteId ? db.state_lotes.get(contextLoteId) : Promise.resolve(null),
      contextPastoId
        ? db.state_pastos.get(contextPastoId)
        : Promise.resolve(null),
    ]);

    return {
      agendaItem: agendaItem ?? null,
      animal: animal ?? null,
      lote: lote ?? null,
      pasto: pasto ?? null,
    };
  }, [
    sourceTaskId,
    contextAnimalId,
    contextLoteId,
    contextPastoId,
    hasRegistrarDisplayContext,
  ]);
  const registrarDisplayContext = useMemo(
    () =>
      registrarContextRecords
        ? resolveRegistrarDisplayContext({
            sourceTaskId: sourceTaskId || null,
            animalId: contextAnimalId || null,
            loteId: contextLoteId || null,
            pastoId: contextPastoId || null,
            records: registrarContextRecords,
          })
        : [],
    [
      contextAnimalId,
      contextLoteId,
      contextPastoId,
      registrarContextRecords,
      sourceTaskId,
    ],
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
    regulatorySurfaceConfig:
      (regulatorySurfaceSource?.config as unknown as Record<
        string,
        unknown
      > | null) ?? null,
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
  const {
    quickAction,
    quickActionConfig,
    quickActions,
    applyQuickAction,
    clearQuickAction,
    selectRegularAction,
  } = useRegistrarQuickActionPolicy({
    applySanitaryQuickAction,
    setTipoManejo,
    updateFinanceiroNatureza: (natureza) =>
      updateFinanceiroData("natureza", natureza),
  });
  const quickActionRequiresAnimals = requiresAnimalsForQuickAction({
    quickAction,
    selectedAnimalCount: selectedAnimais.length,
  });

  const contraparteSelecionadaNome =
    financeiroData.contraparteId !== "none"
      ? (contrapartes?.find((item) => item.id === financeiroData.contraparteId)
          ?.nome ?? "Contraparte selecionada")
      : "Sem contraparte";
  const showFinanceiroAnimaisGeradosResumo =
    tipoManejo === "financeiro" &&
    supportsDraftAnimalsInFinanceiroNatureza(financeiroData.natureza) &&
    selectedAnimais.length === 0 &&
    !isFinanceiroSociedade;
  const reproducaoResumoCriasGeradas = Math.max(
    1,
    reproducaoData.numeroCrias ?? reproducaoData.crias?.length ?? 1,
  );
  const reproducaoResumoReprodutorLabel = reproducaoData.machoId ? (
    <BullNameDisplay machoId={reproducaoData.machoId} />
  ) : null;
  const transitChecklistPurposeLabel = transitChecklist.purpose.replace(
    /_/g,
    " ",
  );
  const transitChecklistGtaLabel =
    transitChecklist.gtaNumber || "Checklist concluido";
  const confirmacaoManejoLabel = quickActionConfig?.label ?? tipoManejo ?? "-";
  const showConfirmacaoAlvoLote = selectedAnimais.length === 0;
  const showConfirmacaoDestinoMovimentacao = tipoManejo === "movimentacao";
  const confirmacaoDestinoMovimentacaoLabel =
    lotes?.find((item) => item.id === movimentacaoData.toLoteId)?.nome ?? "-";
  const showConfirmacaoNutricaoAlimento = tipoManejo === "nutricao";
  const actionSectionState = useRegistrarActionSectionState({
    activeFarmId: activeFarmId ?? null,
    selectedAnimais,
    selectedAnimaisDetalhesCount: selectedAnimaisDetalhes.length,
    selectedLoteIdNormalized,
    lotes,
    farmWeightUnit: farmMeasurementConfig.weight_unit,
    animaisNoLote,
    sanitarioSection: {
      selectedAnimaisDetalhesCount: selectedAnimaisDetalhes.length,
      sanitarioTipo: sanitarioData.tipo,
      onSanitarioTipoChange: handleSanitarioTipoChange,
      produto: sanitarioData.produto,
      onProdutoChange: handleSanitarioProdutoChange,
      sanitatioProductMissing: sanitatioProductMissing,
      selectedVeterinaryProduct,
      hasVeterinaryProducts,
      isVeterinaryProductsEmpty,
      veterinaryProductSuggestions,
      selectedVeterinaryProductId,
      onSelectVeterinaryProduct: selectVeterinaryProduct,
      protocoloId,
      setProtocoloId: setProtocoloId,
      protocolos: protocolos ?? [],
      protocoloItemId,
      setProtocoloItemId: setProtocoloItemId,
      protocoloItensEvaluated,
      selectedProtocolRestrictionsText,
      selectedProtocolPrimaryReason,
      selectedProtocolCompatibleWithAll:
        selectedProtocoloItemEvaluation?.eligibility.compatibleWithAll ?? null,
      allProtocolItemsIneligible,
    },
    transitChecklistState: {
      transitChecklistSection: transitChecklist,
      onTransitChecklistChange: setTransitChecklist,
      officialTransitChecklistEnabled,
      transitChecklistIssues,
      showsTransitChecklist,
      blockedAnimals: animalsBlockedBySanitaryAlert,
      movementComplianceGuards,
      nutritionComplianceGuards,
    },
    pesagemSection: {
      invalidAnimalIds: pesagemAnimaisInvalidos,
      pesagemData,
      setPesagemData,
    },
    movimentacaoSection: {
      movimentacaoData,
      setMovimentacaoData,
      movimentacaoSemDestino,
      movimentacaoDestinoIgualOrigem,
    },
    nutricaoSection: {
      nutricaoData,
      setNutricaoData,
      nutricaoAlimentoMissing,
      nutricaoQuantidadeInvalida,
    },
    financeiroSection: {
      financeiroData,
      updateFinanceiroData,
      financeiroValorTotalCalculado,
      isFinanceiroSociedade,
      contrapartes,
      canManageContraparte,
      showNovaContraparte,
      setShowNovaContraparte,
      novaContraparte,
      setNovaContraparte,
      handleCreateContraparte,
      isSavingContraparte,
      compraNovosAnimais,
      updateCompraNovoAnimalField,
      updateCompraNovoAnimalPesoByIndex,
      financeiroWeightStep,
      financeiroWeightUnitLabel,
      onNavigateContrapartes: () => navigate("/contrapartes"),
    },
    reproducaoSection: {
      partoRequiresSingleMatrix,
      reproducaoData,
      setReproducaoData,
    },
  });

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
  const {
    step,
    advanceFromSelect,
    goToSelectAnimals,
    goToChooseAction,
    goToConfirm,
  } = useRegistrarStepFlow({
    selectedLoteId,
    requiresAnimalsForQuickAction: quickActionRequiresAnimals,
    hasTipoManejo: tipoManejo !== null,
    canAdvanceToConfirm,
  });

  useEffect(() => {
    const parsedQuery = parseRegistrarQueryState({
      searchParams,
      isQuickActionKey,
      isReproTipoEnum,
    });

    if (parsedQuery.sourceTaskId && parsedQuery.sourceTaskId !== sourceTaskId) {
      setSourceTaskId(parsedQuery.sourceTaskId);
    }
    if (parsedQuery.loteId && parsedQuery.loteId !== selectedLoteId) {
      setSelectedLoteId(parsedQuery.loteId);
    }
    if (parsedQuery.loteId !== contextLoteId) {
      setContextLoteId(parsedQuery.loteId ?? "");
    }
    if (parsedQuery.pastoId !== contextPastoId) {
      setContextPastoId(parsedQuery.pastoId ?? "");
    }
    if (parsedQuery.animalId) {
      setSelectedAnimais((prev) =>
        prev.length === 1 && prev[0] === parsedQuery.animalId
          ? prev
          : [parsedQuery.animalId],
      );
    }
    if (parsedQuery.animalId !== contextAnimalId) {
      setContextAnimalId(parsedQuery.animalId ?? "");
    }
    if (parsedQuery.quickAction) {
      applyQuickAction(parsedQuery.quickAction);
    }
    if (
      parsedQuery.domain &&
      [
        "sanitario",
        "pesagem",
        "movimentacao",
        "nutricao",
        "financeiro",
      ].includes(parsedQuery.domain) &&
      parsedQuery.domain !== tipoManejo
    ) {
      setTipoManejo(parsedQuery.domain);
    }
    applySanitaryQueryPrefill(parsedQuery.sanitaryPrefill);
    applyFinanceiroNaturezaQueryPrefill(parsedQuery.natureza);
    if (parsedQuery.domain === "reproducao") {
      setTipoManejo("reproducao");
      clearQuickAction();
      if (parsedQuery.reproTipo) {
        setReproducaoData((prev) => ({
          ...prev,
          tipo: parsedQuery.reproTipo,
          episodeEventoId: null,
          episodeLinkMethod: undefined,
        }));
      }
    }
    if (parsedQuery.shouldOpenChooseActionStep) {
      goToChooseAction();
    }
  }, [
    searchParams,
    applyQuickAction,
    applyFinanceiroNaturezaQueryPrefill,
    applySanitaryQueryPrefill,
    clearQuickAction,
    goToChooseAction,
    setReproducaoData,
    setContextAnimalId,
    setContextLoteId,
    setContextPastoId,
    setSelectedAnimais,
    setSelectedLoteId,
    setSourceTaskId,
    setTipoManejo,
    sourceTaskId,
    selectedLoteId,
    contextLoteId,
    contextPastoId,
    contextAnimalId,
    tipoManejo,
  ]);

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
  }, [tipoManejo, selectedLoteId, reproducaoData.machoId, setReproducaoData]);

  const finalizeController = useMemo(
    () =>
      createRegistrarFinalizeController({
        shared: {
          resolveTargetAnimalIds: resolveRegistrarTargetAnimalIds,
          resolveDistinctAnimalIds: resolveRegistrarDistinctAnimalIds,
          loadAnimalsMap: loadRegistrarAnimalsMap,
        },
        sanitary: {
          loadSanitaryFinalizeContext: loadRegistrarSanitaryFinalizeContext,
          trySanitaryRpcFinalize: tryRegistrarSanitaryRpcFinalizeEffect,
        },
        tracks: {
          isFinancialFlow: isRegistrarFinancialFlow,
          resolveFinancialFinalizePlan: resolveRegistrarFinancialFinalizePlan,
          resolveNonFinancialFinalizePlan:
            resolveRegistrarNonFinancialFinalizePlan,
        },
        commit: {
          buildAgendaCompletionOp: buildRegistrarAgendaCompletionOp,
          resolveFinalizeOpsIssue: resolveRegistrarFinalizeOpsIssue,
          runFinalizeGesture: runRegistrarFinalizeGestureEffect,
        },
        feedback: {
          buildFinalizeSuccessMessage: buildRegistrarFinalizeSuccessMessage,
          buildPostFinalizeNavigationPath:
            buildRegistrarPostFinalizeNavigationPath,
          resolveFinalizeCatchIssue: resolveRegistrarFinalizeCatchIssue,
          showSuccess,
          showError,
          navigate,
        },
      }),
    [navigate],
  );

  const handleFinalize = useCallback(async () => {
    if (isFinalizing) return;

    setIsFinalizing(true);
    try {
      await finalizeController({
        context: {
          tipoManejo,
          activeFarmId: activeFarmId ?? null,
          fallbackFarmId: lotes?.[0]?.fazenda_id ?? null,
          sourceTaskId,
          farmLifecycleConfig,
          parseUserWeight,
        },
        selection: {
          selectedAnimais,
          selectedLoteId,
          selectedLoteIdNormalized,
          partoRequiresSingleMatrix,
        },
        finance: {
          isFinanceiroSociedade,
          data: {
            natureza: financeiroData.natureza,
            modoPeso: financeiroData.modoPeso,
            modoPreco: financeiroData.modoPreco,
            contraparteId: financeiroData.contraparteId,
            valorTotal: financeiroData.valorTotal,
          },
          summary: {
            tipo: financeiroTipo,
            valorTotalCalculado: financeiroValorTotalCalculado,
            valorTotalInformado: financeiroValorTotalInformado,
            valorUnitario: financeiroValorUnitario,
            pesoLote: financeiroPesoLote,
            quantidadeAnimais: financeiroQuantidadeAnimais,
          },
          compraNovosAnimais,
        },
        sanitary: {
          protocoloItemId,
          data: {
            tipo: sanitarioData.tipo,
            produto: sanitarioData.produto,
          },
          selectedVeterinaryProductSelection,
          resolveProtocolProductSelection,
          transit: {
            showsTransitChecklist,
            transitChecklist,
            officialTransitChecklistEnabled,
            transitChecklistIssues,
          },
          complianceFlowIssues,
        },
        operationData: {
          pesagemData,
          movimentacaoData,
          nutricaoData,
          reproducaoData,
        },
      });
    } finally {
      setIsFinalizing(false);
    }
  }, [
    activeFarmId,
    compraNovosAnimais,
    complianceFlowIssues,
    farmLifecycleConfig,
    financeiroData.contraparteId,
    financeiroData.modoPeso,
    financeiroData.modoPreco,
    financeiroData.natureza,
    financeiroData.valorTotal,
    financeiroPesoLote,
    financeiroQuantidadeAnimais,
    financeiroTipo,
    financeiroValorTotalCalculado,
    financeiroValorTotalInformado,
    financeiroValorUnitario,
    finalizeController,
    isFinanceiroSociedade,
    lotes,
    movimentacaoData,
    nutricaoData,
    officialTransitChecklistEnabled,
    parseUserWeight,
    partoRequiresSingleMatrix,
    pesagemData,
    protocoloItemId,
    reproducaoData,
    resolveProtocolProductSelection,
    sanitarioData.produto,
    sanitarioData.tipo,
    selectedAnimais,
    selectedLoteId,
    selectedLoteIdNormalized,
    selectedVeterinaryProductSelection,
    showsTransitChecklist,
    sourceTaskId,
    tipoManejo,
    transitChecklist,
    transitChecklistIssues,
    isFinalizing,
  ]);

  if (!activeFarmId) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <PageIntro
          eyebrow="Fluxo operacional"
          title="Registrar execução"
          description="Selecione uma fazenda para iniciar um registro."
          actions={
            <Button size="sm" onClick={() => navigate("/select-fazenda")}>
              Selecionar fazenda
            </Button>
          }
        />
        <EmptyState
          icon={MapPin}
          title="Fazenda nao selecionada"
          description="Sem fazenda ativa, o registro nao pode ser iniciado."
          action={{
            label: "Selecionar fazenda",
            onClick: () => navigate("/select-fazenda"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <section className="overflow-hidden rounded-2xl border border-sky-900/20 bg-gradient-to-br from-[#002B45] via-sky-950 to-[#004264] text-white shadow-sm dark:border-sky-400/20">
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/80">
                  Fluxo operacional
                </p>
                <h1 className="text-2xl font-bold tracking-normal text-white sm:text-3xl">
                  Registrar manejo
                </h1>
              </div>
            </div>
            <StatusBadge
              tone="info"
              className="w-fit border-white/20 bg-white/10 text-white"
            >
              Etapa {step}/3: {STEP_LABEL[step]}
            </StatusBadge>
          </div>

          <div className="flex flex-wrap gap-2">
            {sourceTaskId ? (
              <StatusBadge
                tone="neutral"
                className="border-white/20 bg-white/10 text-white"
              >
                Origem agenda {sourceTaskId.slice(0, 8)}
              </StatusBadge>
            ) : null}
            {quickActionConfig ? (
              <StatusBadge
                tone="neutral"
                className="border-white/20 bg-white/10 text-white"
              >
                {quickActionConfig.label}
              </StatusBadge>
            ) : null}
            {selectedLoteLabel !== "-" ? (
              <StatusBadge
                tone="neutral"
                className="border-white/20 bg-white/10 text-white"
              >
                {selectedLoteLabel}
              </StatusBadge>
            ) : null}
            {selectedAnimais.length > 0 ? (
              <StatusBadge
                tone="neutral"
                className="border-white/20 bg-white/10 text-white"
              >
                {selectedAnimais.length} animal(is) selecionado(s)
              </StatusBadge>
            ) : null}
            {hasRegistrarDisplayContext ? (
              <StatusBadge
                tone="neutral"
                className="border-white/20 bg-white/10 text-white"
              >
                Contexto recebido
              </StatusBadge>
            ) : null}
          </div>
        </div>
      </section>

      {hasRegistrarDisplayContext ? (
        <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-foreground shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground border">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Contexto do manejo
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="h-8 text-xs text-muted-foreground"
            >
              {showTechDetails
                ? "Ocultar detalhes técnicos"
                : "Ver detalhes técnicos"}
            </Button>
          </div>
          {registrarContextRecords === undefined ? (
            <p className="text-muted-foreground">Carregando contexto...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {registrarDisplayContext.map((entry) => (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-2 px-3",
                    entry.found
                      ? "bg-background"
                      : "border-warning/30 bg-warning/10",
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {entry.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-foreground bg-muted/50 font-normal"
                    >
                      {entry.description}
                    </Badge>
                  </div>
                  {showTechDetails && (
                    <span className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                      ID: {entry.id}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-2 sm:grid sm:grid-cols-3 sm:gap-3">
        {REGISTRATION_STEPS.map((currentStep) => {
          const isActive = step === currentStep;
          const isCompleted = step > currentStep;
          return (
            <div
              key={currentStep}
              className={cn(
                "flex items-center rounded-full sm:rounded-2xl border px-2 py-1.5 sm:px-4 sm:py-3 shadow-sm transition-all duration-300",
                isActive || isCompleted
                  ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
                  : "border-border/70 bg-card text-muted-foreground",
                isActive ? "flex-1 sm:flex-none" : "shrink-0",
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={cn(
                    "grid h-7 w-7 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-full text-xs sm:text-sm",
                    isActive || isCompleted
                      ? "bg-sky-700 font-bold text-white"
                      : "border border-border font-semibold text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : currentStep}
                </span>
                <div
                  className={cn(
                    "min-w-0",
                    isActive ? "block" : "hidden sm:block",
                  )}
                >
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-xs">
                    Etapa {currentStep}
                  </p>
                  <p className="truncate text-xs font-medium text-foreground sm:mt-0.5 sm:text-sm">
                    {STEP_LABEL[currentStep]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {step === RegistrationStep.SELECT_ANIMALS && (
        <RegistrarSelectTargetStep
          quickAction={quickAction}
          onApplyQuickAction={applyQuickAction}
          onClearQuickAction={clearQuickAction}
          selectedLoteId={selectedLoteId}
          onSelectedLoteIdChange={onSelectedLoteIdChange}
          semLoteOption={SEM_LOTE_OPTION}
          lotes={lotes ?? []}
          selectedAnimaisCount={selectedAnimais.length}
          selectedVisibleCount={selectedVisibleCount}
          filteredAnimaisNoLote={filteredAnimaisNoLote}
          visibleAnimalIds={visibleAnimalIds}
          selectedAnimais={selectedAnimais}
          animalSearch={animalSearch}
          onAnimalSearchChange={setAnimalSearch}
          onSelectVisible={onSelectVisibleAnimais}
          onClearSelection={clearSelectedAnimais}
          onToggleAnimalSelection={onToggleAnimalSelection}
          animaisNoLoteCount={animaisNoLote?.length ?? 0}
          requiresAnimalsForQuickAction={quickActionRequiresAnimals}
          quickActionLabel={quickActionConfig?.label ?? null}
          onNext={advanceFromSelect}
        />
      )}

      {step === RegistrationStep.CHOOSE_ACTION && (
        <Card className="border-sky-200/70 shadow-sm dark:border-sky-900/60">
          <CardHeader className="rounded-t-xl border-b border-sky-100 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20">
            <CardTitle className="text-base">2. Intencao do registro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <p className="mb-3 text-sm font-medium">Escolha o manejo</p>
              <RegistrarManejoActionsGrid
                tipoManejo={tipoManejo}
                selectedAnimaisCount={selectedAnimais.length}
                onSelectAction={selectRegularAction}
              />
            </div>

            {selectedAnimais.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem animais selecionados: Financeiro permite compra, doacao,
                arrendamento ou sociedade por lote. Saida exige animal.
              </p>
            )}

            {tipoManejo === "sanitario" && (
              <RegistrarSanitarioSection
                {...actionSectionState.sanitarioSectionProps}
              />
            )}

            {tipoManejo === "pesagem" && (
              <RegistrarPesagemSection
                {...actionSectionState.pesagemSectionProps}
              />
            )}

            {tipoManejo === "movimentacao" && (
              <RegistrarMovimentacaoSection
                {...actionSectionState.movimentacaoSectionProps}
              />
            )}

            {tipoManejo === "nutricao" && (
              <RegistrarNutricaoSection
                {...actionSectionState.nutricaoSectionProps}
              />
            )}

            {tipoManejo === "financeiro" && (
              <RegistrarFinanceiroSection
                {...actionSectionState.financeiroSectionProps}
              />
            )}

            {tipoManejo === "reproducao" && (
              <RegistrarReproducaoSection
                {...actionSectionState.reproducaoSectionProps}
              />
            )}

            <div className="sticky bottom-0 z-40 bg-card py-4 border-t mt-4 -mx-6 px-6 -mb-6 rounded-b-xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
              {actionStepIssues.length > 0 ? (
                <div className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {actionStepIssues[0]}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={goToSelectAnimals}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  className="flex-1 bg-[#0057C2] text-white hover:bg-[#00479f]"
                  disabled={!tipoManejo || !canAdvanceToConfirm}
                  onClick={goToConfirm}
                >
                  Revisar informações <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CONFIRM && (
        <Card className="border-sky-200/70 shadow-sm dark:border-sky-900/60">
          <CardHeader className="rounded-t-xl border-b border-sky-100 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20">
            <CardTitle className="text-base">3. Revisar e salvar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/80 p-4 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
              Ao confirmar, o manejo fica salvo neste aparelho. A fila de sync
              confirma com o servidor depois.
            </div>
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-4">
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
                  naturezaLabel={resolveFinanceiroNaturezaLabel(
                    financeiroData.natureza,
                  )}
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

            <div className="sticky bottom-0 z-40 bg-card py-4 border-t mt-4 -mx-6 px-6 -mb-6 rounded-b-xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={goToChooseAction}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  className="min-h-12 flex-1 bg-[#0057C2] text-base font-semibold text-white shadow-sm hover:bg-[#00479f]"
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                >
                  <Check className="mr-2 h-4 w-4" />{" "}
                  {isFinalizing
                    ? "Registrando..."
                    : sourceTaskId
                      ? "Registrar manejo e voltar para agenda"
                      : "Registrar manejo"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Registrar;
