import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { EventDomain } from "@/lib/events/types";
import type {
  Animal,
  EstadoUFEnum,
  ProdutoVeterinarioCatalogEntry,
  ProtocoloSanitario,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import {
  readVeterinaryProductSelection,
  resolveVeterinaryProductByName,
  searchVeterinaryProducts,
  normalizeVeterinaryProductText,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/products";
import {
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  type RegulatoryOperationalReadModel,
} from "@/lib/sanitario/regulatoryReadModel";
import {
  DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  hasOfficialTransitChecklistEnabled,
  type TransitChecklistDraft,
} from "@/lib/sanitario/transit";
import {
  buildComplianceFlowIssues,
  buildTransitChecklistIssues,
  shouldShowTransitChecklist,
} from "@/pages/Registrar/helpers/transitCompliance";
import {
  buildProtocolEligibilityIssues,
  buildSanitaryMovementBlockIssues,
} from "@/pages/Registrar/helpers/actionStepIssues";
import { formatSanitaryProtocolRestrictions } from "@/lib/sanitario/protocolRules";
import { listAnimalsBlockedBySanitaryAlert } from "@/lib/sanitario/alerts";
import { resolveMovementSensitiveRecords } from "@/pages/Registrar/helpers/selectContext";
import {
  evaluateRegistrarProtocolItems,
  findRegistrarProtocolItemEvaluation,
} from "@/pages/Registrar/helpers/protocolEvaluation";
import { loadRegistrarSourceTaskPrefillEffect } from "@/pages/Registrar/effects/sourceTaskPrefill";
import {
  refreshRegistrarSanitaryProtocolsEffect,
  refreshRegistrarVeterinaryProductsEffect,
} from "@/pages/Registrar/effects/bootstrap";
import {
  loadRegistrarProtocoloItensEffect,
  loadRegistrarProtocolosEffect,
  loadRegistrarVeterinaryProductsEffect,
} from "@/pages/Registrar/effects/localQueries";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";

export const TRANSIT_CHECKLIST_UF_OPTIONS: EstadoUFEnum[] = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export const TRANSIT_PURPOSE_OPTIONS: Array<{
  value: TransitChecklistDraft["purpose"];
  label: string;
}> = [
  { value: "movimentacao", label: "Movimentacao" },
  { value: "venda", label: "Venda" },
  { value: "reproducao", label: "Reproducao" },
  { value: "evento", label: "Evento" },
  { value: "abate", label: "Abate" },
];

const SANITARIO_TYPES: SanitarioTipoEnum[] = [
  "vacinacao",
  "vermifugacao",
  "medicamento",
];

export function useRegistrarSanitarioPackage(input: {
  activeFarmId: string | null;
  tipoManejo: EventDomain | null;
  sourceTaskId: string;
  financeiroNatureza: FinanceiroNatureza;
  regulatorySurfaceConfig: Record<string, unknown> | null;
  regulatoryReadModel: RegulatoryOperationalReadModel;
  animaisNoLote: Animal[] | undefined;
  selectedAnimaisDetalhes: Animal[];
}) {
  const [sanitarioData, setSanitarioData] = useState({
    tipo: "vacinacao" as SanitarioTipoEnum,
    produto: "",
  });
  const [selectedVeterinaryProductId, setSelectedVeterinaryProductId] =
    useState<string>("");
  const [protocoloId, setProtocoloId] = useState<string>("");
  const [protocoloItemId, setProtocoloItemId] = useState<string>("");
  const [transitChecklist, setTransitChecklist] = useState<TransitChecklistDraft>(
    DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  );
  const applySanitaryQuickAction = useCallback((tipo: "vacinacao" | "vermifugacao") => {
    setSanitarioData((prev) => ({
      ...prev,
      tipo,
      produto: prev.tipo === tipo ? prev.produto : "",
    }));
  }, []);
  const handleSanitarioTipoChange = useCallback((tipo: SanitarioTipoEnum) => {
    setSanitarioData((prev) => ({
      ...prev,
      tipo,
    }));
  }, []);
  const handleSanitarioProdutoChange = useCallback((produto: string) => {
    setSanitarioData((prev) => ({
      ...prev,
      produto,
    }));
  }, []);

  const protocolos = useLiveQuery(
    () =>
      loadRegistrarProtocolosEffect({
        activeFarmId: input.activeFarmId,
      }),
    [input.activeFarmId],
  );

  const protocoloItens = useLiveQuery(
    () =>
      loadRegistrarProtocoloItensEffect({
        protocoloId,
        activeFarmId: input.activeFarmId,
        sanitaryType: sanitarioData.tipo,
      }),
    [protocoloId, input.activeFarmId, sanitarioData.tipo],
  );

  const veterinaryProducts = useLiveQuery(
    () => loadRegistrarVeterinaryProductsEffect(),
    [],
  );

  const selectedVeterinaryProduct = useMemo(
    () =>
      (veterinaryProducts ?? []).find((product) => product.id === selectedVeterinaryProductId) ??
      null,
    [selectedVeterinaryProductId, veterinaryProducts],
  );

  const selectedVeterinaryProductSelection = useMemo<VeterinaryProductSelection | null>(
    () =>
      selectedVeterinaryProduct
        ? {
            id: selectedVeterinaryProduct.id,
            nome: selectedVeterinaryProduct.nome,
            categoria: selectedVeterinaryProduct.categoria,
            origem: "catalogo",
          }
        : null,
    [selectedVeterinaryProduct],
  );

  const hasVeterinaryProducts =
    Array.isArray(veterinaryProducts) && veterinaryProducts.length > 0;
  const isVeterinaryProductsEmpty =
    Array.isArray(veterinaryProducts) && veterinaryProducts.length === 0;

  const veterinaryProductSuggestions = useMemo(
    () =>
      searchVeterinaryProducts(veterinaryProducts ?? [], {
        query: sanitarioData.produto,
        sanitaryType: sanitarioData.tipo,
        limit: 6,
      }),
    [sanitarioData.produto, sanitarioData.tipo, veterinaryProducts],
  );

  const createAutomaticProductSelection = useCallback(
    (
      product: ProdutoVeterinarioCatalogEntry,
      matchMode: VeterinaryProductSelection["matchMode"],
    ): VeterinaryProductSelection => ({
      id: product.id,
      nome: product.nome,
      categoria: product.categoria,
      origem: "catalogo_automatico",
      matchMode,
    }),
    [],
  );

  const resolveProtocolProductSelection = useCallback(
    (
      payload: Record<string, unknown> | null | undefined,
      productName: string,
      sanitaryType: SanitarioTipoEnum,
    ): VeterinaryProductSelection | null => {
      const fromPayload = readVeterinaryProductSelection(payload);
      if (fromPayload) return fromPayload;

      const resolved = resolveVeterinaryProductByName(
        productName,
        veterinaryProducts ?? [],
        {
          sanitaryType,
        },
      );

      if (!resolved.product) return null;

      return createAutomaticProductSelection(
        resolved.product,
        resolved.matchMode,
      );
    },
    [createAutomaticProductSelection, veterinaryProducts],
  );

  const selectVeterinaryProduct = useCallback(
    (
      product: ProdutoVeterinarioCatalogEntry,
      options?: { preserveTypedName?: boolean },
    ) => {
      setSelectedVeterinaryProductId(product.id);
      if (options?.preserveTypedName) return;
      setSanitarioData((prev) => ({
        ...prev,
        produto: product.nome,
      }));
    },
    [],
  );

  const showsTransitChecklist = shouldShowTransitChecklist({
    tipoManejo: input.tipoManejo,
    financeiroNatureza: input.financeiroNatureza,
  });

  const officialTransitChecklistEnabled = hasOfficialTransitChecklistEnabled(
    input.regulatorySurfaceConfig,
  );

  const isExternalTransitContext = showsTransitChecklist && transitChecklist.enabled;

  const movementComplianceGuards = useMemo(
    () =>
      showsTransitChecklist || input.tipoManejo === "movimentacao"
        ? isExternalTransitContext
          ? input.regulatoryReadModel.flows.movementExternal
          : input.regulatoryReadModel.flows.movementInternal
        : EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.movementInternal,
    [input.regulatoryReadModel, input.tipoManejo, isExternalTransitContext, showsTransitChecklist],
  );

  const nutritionComplianceGuards =
    input.tipoManejo === "nutricao"
      ? input.regulatoryReadModel.flows.nutrition
      : EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.nutrition;

  const transitChecklistIssues = useMemo(
    () =>
      buildTransitChecklistIssues({
        showsTransitChecklist,
        transitChecklist,
        asOfDate: new Date().toISOString().slice(0, 10),
      }),
    [showsTransitChecklist, transitChecklist],
  );

  const movementSensitiveAnimals = useMemo(
    () =>
      resolveMovementSensitiveRecords({
        showsTransitChecklist,
        selectedRecords: input.selectedAnimaisDetalhes,
        fallbackRecords: input.animaisNoLote ?? [],
      }),
    [input.animaisNoLote, input.selectedAnimaisDetalhes, showsTransitChecklist],
  );

  const animalsBlockedBySanitaryAlert = useMemo(
    () => listAnimalsBlockedBySanitaryAlert(movementSensitiveAnimals),
    [movementSensitiveAnimals],
  );

  const sanitaryMovementBlockIssues = useMemo(
    () =>
      buildSanitaryMovementBlockIssues({
        showsTransitChecklist,
        blockedAnimals: animalsBlockedBySanitaryAlert,
      }),
    [animalsBlockedBySanitaryAlert, showsTransitChecklist],
  );

  const complianceFlowIssues = useMemo(
    () =>
      buildComplianceFlowIssues({
        tipoManejo: input.tipoManejo,
        financeiroNatureza: input.financeiroNatureza,
        movementBlockers: movementComplianceGuards.blockers,
        nutritionBlockers: nutritionComplianceGuards.blockers,
      }),
    [
      input.financeiroNatureza,
      input.tipoManejo,
      movementComplianceGuards.blockers,
      nutritionComplianceGuards.blockers,
    ],
  );

  const protocolosById = useMemo<Map<string, ProtocoloSanitario>>(
    () => new Map((protocolos ?? []).map((protocolo) => [protocolo.id, protocolo])),
    [protocolos],
  );

  const protocoloItensEvaluated = useMemo(
    () =>
      evaluateRegistrarProtocolItems({
        items: protocoloItens ?? [],
        protocolsById: protocolosById,
        selectedAnimals: input.selectedAnimaisDetalhes,
      }),
    [input.selectedAnimaisDetalhes, protocoloItens, protocolosById],
  );

  const selectedProtocoloItemEvaluation = useMemo(
    () =>
      findRegistrarProtocolItemEvaluation({
        protocolItemId: protocoloItemId || null,
        evaluations: protocoloItensEvaluated,
      }),
    [protocoloItemId, protocoloItensEvaluated],
  );

  const selectedProtocolRestrictionsText = useMemo(
    () =>
      selectedProtocoloItemEvaluation
        ? formatSanitaryProtocolRestrictions(
            selectedProtocoloItemEvaluation.eligibility.restrictions,
          )
        : null,
    [selectedProtocoloItemEvaluation],
  );

  const selectedProtocolPrimaryReason =
    selectedProtocoloItemEvaluation?.eligibility.reasons[0] ?? null;

  const allProtocolItemsIneligible =
    protocoloItensEvaluated.length > 0 &&
    protocoloItensEvaluated.every(({ eligibility }) => !eligibility.compatibleWithAll);

  const protocolEligibilityIssues = useMemo(
    () =>
      buildProtocolEligibilityIssues({
        tipoManejo: input.tipoManejo,
        selectedProtocolCompatibleWithAll:
          selectedProtocoloItemEvaluation?.eligibility.compatibleWithAll ?? null,
      }),
    [input.tipoManejo, selectedProtocoloItemEvaluation],
  );

  const sanitatioProductMissing = sanitarioData.produto.trim().length === 0;

  useEffect(() => {
    refreshRegistrarSanitaryProtocolsEffect({
      activeFarmId: input.activeFarmId,
    }).catch((error) => {
      console.warn("[registrar] failed to refresh sanitary protocols", error);
    });
  }, [input.activeFarmId]);

  useEffect(() => {
    refreshRegistrarVeterinaryProductsEffect({
      activeFarmId: input.activeFarmId,
    }).catch((error) => {
      console.warn("[registrar] failed to refresh veterinary products", error);
    });
  }, [input.activeFarmId]);

  useEffect(() => {
    if (!protocoloId) return;
    const stillExists = (protocolos ?? []).some((p) => p.id === protocoloId);
    if (!stillExists) {
      setProtocoloId("");
      setProtocoloItemId("");
    }
  }, [protocoloId, protocolos]);

  useEffect(() => {
    if (!protocoloItemId) return;
    const stillExists = (protocoloItens ?? []).some((item) => item.id === protocoloItemId);
    if (!stillExists) {
      setProtocoloItemId("");
    }
  }, [protocoloItemId, protocoloItens]);

  useEffect(() => {
    if (!protocoloItemId) return;
    const selectedItem = (protocoloItens ?? []).find((item) => item.id === protocoloItemId);
    if (!selectedItem) return;

    const productSelection = resolveProtocolProductSelection(
      selectedItem.payload,
      selectedItem.produto,
      selectedItem.tipo,
    );

    setSanitarioData((prev) => {
      if (prev.produto.trim()) return prev;
      return { ...prev, produto: selectedItem.produto };
    });

    if (productSelection) {
      setSelectedVeterinaryProductId((currentId) => currentId || productSelection.id);
    }
  }, [protocoloItemId, protocoloItens, resolveProtocolProductSelection]);

  useEffect(() => {
    const normalizedTypedProduct = normalizeVeterinaryProductText(sanitarioData.produto);

    if (!normalizedTypedProduct) {
      if (selectedVeterinaryProductId) {
        setSelectedVeterinaryProductId("");
      }
      return;
    }

    if (!selectedVeterinaryProduct) return;

    if (
      normalizeVeterinaryProductText(selectedVeterinaryProduct.nome) !==
      normalizedTypedProduct
    ) {
      setSelectedVeterinaryProductId("");
    }
  }, [sanitarioData.produto, selectedVeterinaryProduct, selectedVeterinaryProductId]);

  useEffect(() => {
    const applySourceTaskPrefill = async () => {
      const sourcePrefill = await loadRegistrarSourceTaskPrefillEffect({
        sourceTaskId: input.sourceTaskId,
        tipoManejo: input.tipoManejo,
      });
      if (!sourcePrefill) return;

      const {
        protocoloIdFromTask,
        protocoloItemIdFromTask,
        produtoFromTask,
        tipoFromTask,
        sourceRef,
        payload,
      } = sourcePrefill;

      const productSelectionFromTask =
        readVeterinaryProductSelection(sourceRef) ?? readVeterinaryProductSelection(payload);

      if (protocoloIdFromTask) setProtocoloId((prev) => prev || protocoloIdFromTask);
      if (protocoloItemIdFromTask) {
        setProtocoloItemId((prev) => prev || protocoloItemIdFromTask);
      }
      if (productSelectionFromTask) {
        setSelectedVeterinaryProductId((prev) => prev || productSelectionFromTask.id);
      }

      if (
        tipoFromTask &&
        ["vacinacao", "vermifugacao", "medicamento"].includes(tipoFromTask)
      ) {
        setSanitarioData((prev) => ({
          ...prev,
          tipo: tipoFromTask as SanitarioTipoEnum,
          produto: prev.produto || produtoFromTask || "",
        }));
      } else if (produtoFromTask) {
        setSanitarioData((prev) => ({
          ...prev,
          produto: prev.produto || produtoFromTask,
        }));
      }
    };

    applySourceTaskPrefill().catch((error) => {
      console.warn("[registrar] failed to prefill from source task", error);
    });
  }, [input.sourceTaskId, input.tipoManejo]);

  useEffect(() => {
    if (!showsTransitChecklist) {
      setTransitChecklist(DEFAULT_TRANSIT_CHECKLIST_DRAFT);
      return;
    }

    setTransitChecklist((prev) => {
      const expectedPurpose =
        input.tipoManejo === "financeiro" && input.financeiroNatureza === "venda"
          ? "venda"
          : "movimentacao";

      if (!prev.enabled && prev.purpose !== expectedPurpose) {
        return {
          ...prev,
          purpose: expectedPurpose,
        };
      }

      return prev;
    });
  }, [input.financeiroNatureza, input.tipoManejo, showsTransitChecklist]);

  const applySanitaryQueryPrefill = useCallback((query: {
    protocoloId?: string | null;
    protocoloItemId?: string | null;
    produto?: string | null;
    sanitarioTipo?: string | null;
  }) => {
    if (query.protocoloId) {
      setProtocoloId(query.protocoloId);
    }
    if (query.protocoloItemId) {
      setProtocoloItemId(query.protocoloItemId);
    }
    if (query.produto) {
      handleSanitarioProdutoChange(query.produto);
    }
    if (query.sanitarioTipo && SANITARIO_TYPES.includes(query.sanitarioTipo as SanitarioTipoEnum)) {
      handleSanitarioTipoChange(query.sanitarioTipo as SanitarioTipoEnum);
    }
  }, [handleSanitarioProdutoChange, handleSanitarioTipoChange]);

  return {
    sanitarioData,
    setSanitarioData,
    applySanitaryQuickAction,
    handleSanitarioTipoChange,
    handleSanitarioProdutoChange,
    applySanitaryQueryPrefill,
    selectedVeterinaryProduct,
    selectedVeterinaryProductId,
    setSelectedVeterinaryProductId,
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
  };
}
