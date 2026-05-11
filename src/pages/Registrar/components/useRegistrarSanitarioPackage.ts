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

  const handleProtocoloChange = useCallback((id: string) => {
    const newId = id === "none" ? "" : id;
    setProtocoloId(newId);
    setProtocoloItemId("");
    setSanitarioData((prev) =>
      prev.produto === "" ? prev : { ...prev, produto: "" },
    );
    setSelectedVeterinaryProductId((prev) => (prev === "" ? prev : ""));
  }, []);

  const applySanitaryQuickAction = useCallback((tipo: "vacinacao" | "vermifugacao") => {
    setSanitarioData((prev) => (prev.tipo === tipo ? prev : { ...prev, tipo, produto: "" }));
    setProtocoloId("");
    setProtocoloItemId("");
    setSelectedVeterinaryProductId("");
  }, []);
  const handleSanitarioTipoChange = useCallback((tipo: SanitarioTipoEnum) => {
    setSanitarioData((prev) => (prev.tipo === tipo ? prev : { ...prev, tipo, produto: "" }));
    setProtocoloId("");
    setProtocoloItemId("");
    setSelectedVeterinaryProductId("");
  }, []);
  const handleSanitarioProdutoChange = useCallback((produto: string) => {
    setSanitarioData((prev) =>
      prev.produto === produto ? prev : { ...prev, produto },
    );
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

  const filteredProtocolos = useMemo(() => {
    if (!protocolos) return [];
    const tipo = sanitarioData.tipo;

    // Deduplica protocolos para não renderizar duas vezes o mesmo balão
    const uniqueProtocolos = Array.from(
      new Map(protocolos.map((p) => [       p.id, p])).values()
    );

    return uniqueProtocolos.filter(p => {
      const name = (p.nome || "").toLowerCase();
      const family = ("familia_sanitaria" in p && typeof p.familia_sanitaria === "string" ? p.familia_sanitaria : "").toLowerCase();
      
      const isVacina = name.includes("vacina") || name.includes("raiva") || name.includes("brucelose") || name.includes("clostridiose") || name.includes("aftosa") || name.includes("bvd") || name.includes("ibr") || family.includes("vacina");
      
      const isTristeza = name.includes("tristeza") || name.includes("tpb");
      const isVermi = name.includes("verm") || name.includes("endect") || (name.includes("parasit") && !isTristeza) || name.includes("carrapat") || name.includes("mosca") || name.includes("estrategico") || name.includes("5-7-9") || family.includes("verm");

      if (tipo === "vacinacao") return isVacina || (!isVermi && !isTristeza && name.includes("oficial"));
      if (tipo === "vermifugacao") return isVermi;
      if (tipo === "medicamento") return !isVacina && !isVermi;
      
      return true;
    });
  }, [protocolos, sanitarioData.tipo]);

  const filteredVeterinaryProducts = useMemo(() => {
    if (!veterinaryProducts) return undefined;
    const tipo = sanitarioData.tipo;

    const uniqueProducts = Array.from(
      new Map(veterinaryProducts.map((p) => [                                                                        (p.nome || "").trim().toLowerCase(), p])).values()
    );

    return uniqueProducts.filter((p) => {
      const cat = (p.categoria || "").toLowerCase();
      const nome = (p.nome || "").toLowerCase();
      const isTristeza = nome.includes("tristeza") || nome.includes("tpb");
      const isEstrategico = nome.includes("estrategico") || nome.includes("5-7-9");

      if (tipo === "vacinacao") {
        return cat.includes("vacina") || nome.includes("vacina") || cat.includes("biol");
      }
      if (tipo === "vermifugacao") {
        return (
          cat.includes("verm") ||
          cat.includes("anti") ||
          cat.includes("endect") ||
          (cat.includes("parasit") && !isTristeza) ||
          nome.includes("verm") ||
          nome.includes("mectina") ||
          isEstrategico
        );
      }
      if (tipo === "medicamento") {
        return !cat.includes("vacina") && !nome.includes("vacina") && !cat.includes("verm") && !nome.includes("verm") && !isEstrategico;
      }
      return true;
    });
  }, [veterinaryProducts, sanitarioData.tipo]);

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
          veterinaryProducts: filteredVeterinaryProducts,
      }),
    [filteredVeterinaryProducts],
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
        veterinaryProducts: filteredVeterinaryProducts,
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
      filteredVeterinaryProducts,
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
    // Apply type first because changing type clears selected protocol/item.
    // Then restore query-selected protocol and item.
    if (query.sanitarioTipo && SANITARIO_TYPES.includes(query.sanitarioTipo as SanitarioTipoEnum)) {
      handleSanitarioTipoChange(query.sanitarioTipo as SanitarioTipoEnum);
    }
    if (query.protocoloId) {
      handleProtocoloChange(query.protocoloId);
    }
    if (query.protocoloItemId) {
      setProtocoloItemId(query.protocoloItemId);
    }
    if (query.produto) {
      handleSanitarioProdutoChange(query.produto);
    }
  }, [handleProtocoloChange, handleSanitarioProdutoChange, handleSanitarioTipoChange]);

  const finalProductSuggestions = useMemo(() => {
    const suggestions = sanitaryPackage.veterinaryProductSuggestions || [];
    const tipo = sanitarioData.tipo;
    const selectedProtocol = protocolos?.find(p => p.id === protocoloId);
    const protocolName = (selectedProtocol?.nome || "").toLowerCase();

    const uniqueSuggestions = Array.from(
      new Map(suggestions.map((p) => [(p.nome || "").trim().toLowerCase(), p])).values()
    );

    return uniqueSuggestions.filter((p) => {
      const cat = (p.categoria || "").toLowerCase();
      const nome = (p.nome || "").toLowerCase();
      
      const isTristeza = nome.includes("tristeza") || nome.includes("tpb");
      const isEstrategico = nome.includes("estrategico") || nome.includes("5-7-9");

      let matchTipo = true;
      if (tipo === "vacinacao") {
        matchTipo = cat.includes("vacina") || nome.includes("vacina") || cat.includes("biol");
      } else if (tipo === "vermifugacao") {
        matchTipo = cat.includes("verm") || cat.includes("anti") || cat.includes("endect") || (cat.includes("parasit") && !isTristeza) || nome.includes("verm") || nome.includes("mectina") || isEstrategico;
      } else if (tipo === "medicamento") {
        matchTipo = !cat.includes("vacina") && !nome.includes("vacina") && !cat.includes("verm") && !nome.includes("verm") && !isEstrategico;
      }

      if (!matchTipo) return false;

      if (protocoloId && protocolName) {
        if (protocolName.includes("raiva")) return nome.includes("raiva");
        if (protocolName.includes("brucelose")) return nome.includes("brucelose") || nome.includes("b19") || nome.includes("rb51") || nome.includes("cepa");
        if (protocolName.includes("clostridiose")) return nome.includes("clostridiose") || nome.includes("polivalente") || nome.includes("sintomatica");
        if (protocolName.includes("aftosa")) return nome.includes("aftosa");
      }

      return true;
    });
  }, [sanitaryPackage.veterinaryProductSuggestions, sanitarioData.tipo, protocoloId, protocolos]);

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
    veterinaryProductSuggestions: finalProductSuggestions,
    selectVeterinaryProduct,
    protocolos: filteredProtocolos,
    protocoloId,
    setProtocoloId: handleProtocoloChange,
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
