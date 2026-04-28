import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { EventDomain } from "@/lib/events/types";
import type {
  Animal,
  EstadoUFEnum,
  ProdutoVeterinarioCatalogEntry,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import {
  readVeterinaryProductSelection,
  normalizeVeterinaryProductText,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/catalog/products";
import type { RegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  type TransitChecklistDraft,
} from "@/lib/sanitario/compliance/transit";
import {
  resolveProtocolProductSelectionFromCatalog,
  resolveRegistrarSanitaryPackage,
} from "@/lib/sanitario/models/registrarPackage";
import { isFinanceiroSaidaNatureza } from "@/pages/Registrar/helpers/financialNature";
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

  const resolveProtocolProductSelection = useCallback(
    (
      payload: Record<string, unknown> | null | undefined,
      productName: string,
      sanitaryType: SanitarioTipoEnum,
    ): VeterinaryProductSelection | null =>
      resolveProtocolProductSelectionFromCatalog({
        payload,
        productName,
        sanitaryType,
        veterinaryProducts,
      }),
    [veterinaryProducts],
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

  const sanitaryPackage = useMemo(
    () =>
      resolveRegistrarSanitaryPackage({
        tipoManejo: input.tipoManejo,
        financeiroNatureza: input.financeiroNatureza,
        regulatorySurfaceConfig: input.regulatorySurfaceConfig,
        regulatoryReadModel: input.regulatoryReadModel,
        animaisNoLote: input.animaisNoLote,
        selectedAnimaisDetalhes: input.selectedAnimaisDetalhes,
        protocolos,
        protocoloItens,
        protocoloItemId: protocoloItemId || null,
        sanitarioData,
        selectedVeterinaryProductId,
        veterinaryProducts,
        transitChecklist,
        asOfDate: new Date().toISOString().slice(0, 10),
      }),
    [
      input.animaisNoLote,
      input.financeiroNatureza,
      input.regulatoryReadModel,
      input.regulatorySurfaceConfig,
      input.selectedAnimaisDetalhes,
      input.tipoManejo,
      protocoloItemId,
      protocoloItens,
      protocolos,
      sanitarioData,
      selectedVeterinaryProductId,
      transitChecklist,
      veterinaryProducts,
    ],
  );

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

    if (!sanitaryPackage.selectedVeterinaryProduct) return;

    if (
      normalizeVeterinaryProductText(sanitaryPackage.selectedVeterinaryProduct.nome) !==
      normalizedTypedProduct
    ) {
      setSelectedVeterinaryProductId("");
    }
  }, [
    sanitarioData.produto,
    sanitaryPackage.selectedVeterinaryProduct,
    selectedVeterinaryProductId,
  ]);

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
    if (!sanitaryPackage.showsTransitChecklist) {
      setTransitChecklist(DEFAULT_TRANSIT_CHECKLIST_DRAFT);
      return;
    }

    setTransitChecklist((prev) => {
      const expectedPurpose =
        input.tipoManejo === "financeiro" &&
        isFinanceiroSaidaNatureza(input.financeiroNatureza)
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
  }, [input.financeiroNatureza, input.tipoManejo, sanitaryPackage.showsTransitChecklist]);

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
    selectedVeterinaryProduct: sanitaryPackage.selectedVeterinaryProduct,
    selectedVeterinaryProductId,
    setSelectedVeterinaryProductId,
    selectedVeterinaryProductSelection:
      sanitaryPackage.selectedVeterinaryProductSelection,
    hasVeterinaryProducts: sanitaryPackage.hasVeterinaryProducts,
    isVeterinaryProductsEmpty: sanitaryPackage.isVeterinaryProductsEmpty,
    veterinaryProductSuggestions: sanitaryPackage.veterinaryProductSuggestions,
    selectVeterinaryProduct,
    protocolos,
    protocoloId,
    setProtocoloId,
    protocoloItemId,
    setProtocoloItemId,
    protocoloItensEvaluated: sanitaryPackage.protocoloItensEvaluated,
    selectedProtocoloItemEvaluation:
      sanitaryPackage.selectedProtocoloItemEvaluation,
    selectedProtocolRestrictionsText:
      sanitaryPackage.selectedProtocolRestrictionsText,
    selectedProtocolPrimaryReason: sanitaryPackage.selectedProtocolPrimaryReason,
    allProtocolItemsIneligible: sanitaryPackage.allProtocolItemsIneligible,
    protocolEligibilityIssues: sanitaryPackage.protocolEligibilityIssues,
    sanitatioProductMissing: sanitaryPackage.sanitatioProductMissing,
    resolveProtocolProductSelection,
    transitChecklist,
    setTransitChecklist,
    transitChecklistIssues: sanitaryPackage.transitChecklistIssues,
    showsTransitChecklist: sanitaryPackage.showsTransitChecklist,
    officialTransitChecklistEnabled:
      sanitaryPackage.officialTransitChecklistEnabled,
    animalsBlockedBySanitaryAlert:
      sanitaryPackage.animalsBlockedBySanitaryAlert,
    sanitaryMovementBlockIssues: sanitaryPackage.sanitaryMovementBlockIssues,
    movementComplianceGuards: sanitaryPackage.movementComplianceGuards,
    nutritionComplianceGuards: sanitaryPackage.nutritionComplianceGuards,
    complianceFlowIssues: sanitaryPackage.complianceFlowIssues,
  };
}
