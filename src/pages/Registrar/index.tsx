import { useCallback, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type {
  ReproTipoEnum,
  Animal,
} from "@/lib/offline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";
import { parseWeightInput } from "@/lib/format/weight";
import {
  buildRegulatoryOperationalReadModel,
} from "@/lib/sanitario/regulatoryReadModel";
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
import { RegistrarQuickActionsGrid } from "@/pages/Registrar/components/RegistrarQuickActionsGrid";
import { RegistrarManejoActionsGrid } from "@/pages/Registrar/components/RegistrarManejoActionsGrid";
import { RegistrarSelectTargetStep } from "@/pages/Registrar/components/RegistrarSelectTargetStep";
import { RegistrarSanitarioSection } from "@/pages/Registrar/components/RegistrarSanitarioSection";
import { RegistrarPesagemSection } from "@/pages/Registrar/components/RegistrarPesagemSection";
import { RegistrarMovimentacaoSection } from "@/pages/Registrar/components/RegistrarMovimentacaoSection";
import { RegistrarNutricaoSection } from "@/pages/Registrar/components/RegistrarNutricaoSection";
import { RegistrarReproducaoSection } from "@/pages/Registrar/components/RegistrarReproducaoSection";
import {
  useRegistrarSanitarioPackage,
} from "@/pages/Registrar/components/useRegistrarSanitarioPackage";
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
import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import { resolveRegistrarFinalizeOpsIssue, resolveRegistrarFinalizeCatchIssue } from "@/pages/Registrar/helpers/finalizeGuards";
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
  if (!bull) return <span className="font-bold truncate max-w-[150px]">{machoId}</span>;
  return <span className="font-bold truncate max-w-[150px]">{bull.identificacao}</span>;
};

const Registrar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
    (value: string) => parseWeightInput(value, farmMeasurementConfig.weight_unit),
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
      buildRegulatoryOperationalReadModel(
        regulatorySurfaceSource ?? undefined,
      ),
    [regulatorySurfaceSource],
  );
  const selectedLoteLabel =
    selectedLoteId === SEM_LOTE_OPTION
      ? "Sem lote"
      : lotes?.find((l) => l.id === selectedLoteId)?.nome ?? "-";
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
  const actionSectionState = useRegistrarActionSectionState({
    activeFarmId: activeFarmId ?? null,
    selectedAnimais,
    selectedAnimaisDetalhesCount: selectedAnimaisDetalhes.length,
    selectedLoteIdNormalized,
    lotes,
    farmWeightUnit: farmMeasurementConfig.weight_unit,
    animaisNoLote,
    sanitarioSection: {
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
      setProtocoloId,
      protocolos: protocolos ?? [],
      protocoloItemId,
      setProtocoloItemId,
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

    if (parsedQuery.sourceTaskId) {
      setSourceTaskId(parsedQuery.sourceTaskId);
    }
    if (parsedQuery.loteId) {
      setSelectedLoteId(parsedQuery.loteId);
    }
    if (parsedQuery.animalId) {
      setSelectedAnimais([parsedQuery.animalId]);
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
      ].includes(parsedQuery.domain)
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
    setSelectedAnimais,
    setSelectedLoteId,
    setSourceTaskId,
    setTipoManejo,
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
          resolveNonFinancialFinalizePlan: resolveRegistrarNonFinancialFinalizePlan,
        },
        commit: {
          buildAgendaCompletionOp: buildRegistrarAgendaCompletionOp,
          resolveFinalizeOpsIssue: resolveRegistrarFinalizeOpsIssue,
          runFinalizeGesture: runRegistrarFinalizeGestureEffect,
        },
        feedback: {
          buildFinalizeSuccessMessage: buildRegistrarFinalizeSuccessMessage,
          buildPostFinalizeNavigationPath: buildRegistrarPostFinalizeNavigationPath,
          resolveFinalizeCatchIssue: resolveRegistrarFinalizeCatchIssue,
          showSuccess,
          showError,
          navigate,
        },
      }),
    [navigate],
  );

  const handleFinalize = useCallback(async () => {
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
  ]);

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
          quickActions={quickActions}
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
                  actions={quickActions}
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
              <RegistrarSanitarioSection {...actionSectionState.sanitarioSectionProps} />
            )}

            {tipoManejo === "pesagem" && (
              <RegistrarPesagemSection {...actionSectionState.pesagemSectionProps} />
            )}

            {tipoManejo === "movimentacao" && (
              <RegistrarMovimentacaoSection {...actionSectionState.movimentacaoSectionProps} />
            )}

            {tipoManejo === "nutricao" && (
              <RegistrarNutricaoSection {...actionSectionState.nutricaoSectionProps} />
            )}

            {tipoManejo === "financeiro" && (
              <RegistrarFinanceiroSection {...actionSectionState.financeiroSectionProps} />
            )}

            {tipoManejo === "reproducao" && (
              <RegistrarReproducaoSection {...actionSectionState.reproducaoSectionProps} />
            )}

            {actionStepIssues.length > 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {actionStepIssues[0]}
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goToSelectAnimals}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={!tipoManejo || !canAdvanceToConfirm}
                onClick={goToConfirm}
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
                onClick={goToChooseAction}
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
