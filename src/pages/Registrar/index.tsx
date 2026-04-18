import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import type {
  OperationInput,
  SanitarioTipoEnum,
  ReproTipoEnum,
  Animal,
  ProtocoloSanitario,
  ProdutoVeterinarioCatalogEntry,
  EstadoUFEnum,
} from "@/lib/offline/types";
import { type ReproductionEventData } from "@/components/events/ReproductionForm";
import type { EventDomain } from "@/lib/events/types";
import {
  type FinancialPriceMode,
  type FinancialWeightMode,
} from "@/lib/finance/transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  formatWeight,
  getWeightInputStep,
  getWeightUnitLabel,
  parseWeightInput,
} from "@/lib/format/weight";
import {
  readVeterinaryProductSelection,
  refreshVeterinaryProductsCatalog,
  resolveVeterinaryProductByName,
  searchVeterinaryProducts,
  normalizeVeterinaryProductText,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/products";
import {
  formatSanitaryProtocolRestrictions,
} from "@/lib/sanitario/protocolRules";
import {
  listAnimalsBlockedBySanitaryAlert,
} from "@/lib/sanitario/alerts";
import {
  buildRegulatoryOperationalReadModel,
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/regulatoryReadModel";
import {
  DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  hasOfficialTransitChecklistEnabled,
  type TransitChecklistPurpose,
} from "@/lib/sanitario/transit";
import { cn } from "@/lib/utils";
import {
  isMovimentacaoDestinoIgualOrigem,
  shouldClearMovimentacaoDestino,
} from "@/pages/Registrar/helpers/movimentacao";
import {
  filterRegistrarAnimalsBySearch,
  resolveSelectedVisibleCount,
} from "@/pages/Registrar/helpers/animalSelection";
import {
  resolveMovementSensitiveRecords,
  resolveSelectedRecordsByIds,
} from "@/pages/Registrar/helpers/selectContext";
import {
  buildBaseActionStepIssues,
  buildProtocolEligibilityIssues,
  buildSanitaryMovementBlockIssues,
  composeRegistrarActionStepIssues,
} from "@/pages/Registrar/helpers/actionStepIssues";
import {
  buildComplianceFlowIssues,
  buildTransitChecklistIssues,
  shouldShowTransitChecklist,
} from "@/pages/Registrar/helpers/transitCompliance";
import {
  buildRegistrarAgendaCompletionOp,
  resolveRegistrarDistinctAnimalIds,
  resolveRegistrarTargetAnimalIds,
} from "@/pages/Registrar/helpers/plan";
import { resolveRegistrarPreflightIssue } from "@/pages/Registrar/helpers/preflight";
import {
  evaluateRegistrarProtocolItems,
  findRegistrarProtocolItemEvaluation,
} from "@/pages/Registrar/helpers/protocolEvaluation";
import {
  deriveRegistrarFinancialContext,
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
  runRegistrarCreateContraparteEffect,
  type RegistrarNovaContraparteDraft,
} from "@/pages/Registrar/effects/contraparteCreate";
import { FinanceiroContraparteSection } from "@/pages/Registrar/components/FinanceiroContraparteSection";
import { FinanceiroCompraAnimaisSection } from "@/pages/Registrar/components/FinanceiroCompraAnimaisSection";
import { FinanceiroResumoConfirmacao } from "@/pages/Registrar/components/FinanceiroResumoConfirmacao";
import { FinanceiroVendaPesosSection } from "@/pages/Registrar/components/FinanceiroVendaPesosSection";
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
  buildRegistrarFinalizeSuccessMessage,
  buildRegistrarPostFinalizeNavigationPath,
} from "@/pages/Registrar/helpers/finalizeOutcome";
import type { CompraNovoAnimalDraft, RegistrarSexo } from "@/pages/Registrar/types";

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
const TRANSIT_CHECKLIST_UF_OPTIONS: EstadoUFEnum[] = [
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
const TRANSIT_PURPOSE_OPTIONS: Array<{
  value: TransitChecklistPurpose;
  label: string;
}> = [
  { value: "movimentacao", label: "Movimentacao" },
  { value: "venda", label: "Venda" },
  { value: "reproducao", label: "Reproducao" },
  { value: "evento", label: "Evento" },
  { value: "abate", label: "Abate" },
];

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

const readString = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

interface FinanceiroFormData {
  natureza: FinanceiroNatureza;
  contraparteId: string;
  modoPreco: FinancialPriceMode;
  valorUnitario: string;
  valorTotal: string;
  quantidadeAnimais: string;
  modoPeso: FinancialWeightMode;
  pesoLoteKg: string;
}

const BullNameDisplay = ({ machoId }: { machoId: string }) => {
  const bull = useLiveQuery(() => db.state_animais.get(machoId), [machoId]);
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

  // Form states
  const [sanitarioData, setSanitarioData] = useState({
    tipo: "vacinacao" as SanitarioTipoEnum,
    produto: "",
  });
  const [selectedVeterinaryProductId, setSelectedVeterinaryProductId] =
    useState<string>("");
  const [protocoloId, setProtocoloId] = useState<string>("");
  const [protocoloItemId, setProtocoloItemId] = useState<string>("");
  const [pesagemData, setPesagemData] = useState<Record<string, string>>({});
  const [movimentacaoData, setMovimentacaoData] = useState({ toLoteId: "" });
  const [transitChecklist, setTransitChecklist] = useState(
    DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  );
  const [nutricaoData, setNutricaoData] = useState({
    alimentoNome: "",
    quantidadeKg: "",
  });
  const [financeiroData, setFinanceiroData] = useState<FinanceiroFormData>({
    natureza: "compra",
    contraparteId: "none",
    modoPreco: "por_lote",
    valorUnitario: "",
    valorTotal: "",
    quantidadeAnimais: "1",
    modoPeso: "nenhum",
    pesoLoteKg: "",
  });
  const [showNovaContraparte, setShowNovaContraparte] = useState(false);
  const [isSavingContraparte, setIsSavingContraparte] = useState(false);
  const [novaContraparte, setNovaContraparte] = useState<RegistrarNovaContraparteDraft>({
    tipo: "pessoa",
    nome: "",
    documento: "",
    telefone: "",
    email: "",
    endereco: "",
  });
  const [compraNovosAnimais, setCompraNovosAnimais] = useState<
    CompraNovoAnimalDraft[]
  >([]);
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

  const applyQuickAction = useCallback((actionKey: QuickActionKey) => {
    setQuickAction(actionKey);

    if (actionKey === "vacinacao" || actionKey === "vermifugacao") {
      setTipoManejo("sanitario");
      setSanitarioData((prev) => ({
        ...prev,
        tipo: actionKey,
        produto: prev.tipo === actionKey ? prev.produto : "",
      }));
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
    setFinanceiroData((prev) => ({
      ...prev,
      natureza: actionKey === "compra" ? "compra" : "venda",
    }));
  }, []);

  const parseUserWeight = (value: string) =>
    parseWeightInput(value, farmMeasurementConfig.weight_unit);

  const canManageContraparte = role === "owner" || role === "manager";
  const financeiroWeightStep = getWeightInputStep(farmMeasurementConfig.weight_unit);
  const financeiroWeightUnitLabel = getWeightUnitLabel(farmMeasurementConfig.weight_unit);

  const updateCompraNovoAnimalField = useCallback(
    <K extends keyof CompraNovoAnimalDraft>(
      localId: string,
      field: K,
      value: CompraNovoAnimalDraft[K],
    ) => {
      setCompraNovosAnimais((prev) =>
        prev.map((item) =>
          item.localId === localId ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const updateCompraNovoAnimalPesoByIndex = useCallback((index: number, value: string) => {
    setCompraNovosAnimais((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, pesoKg: value } : item,
      ),
    );
  }, []);

  // TD-014: Validar peso > 0 no frontend para pesagem
  const isPesagemValid = selectedAnimais.every((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return false;
    const weight = parseUserWeight(weightStr);
    return weight !== null && weight > 0;
  });

  const financialContext = deriveRegistrarFinancialContext({
    financeiroData,
    selectedAnimalsCount: selectedAnimais.length,
    parseUserWeight,
  });
  const {
    financeiroTipo,
    isFinanceiroSociedade,
    financeiroQuantidadeAnimais,
    financeiroValorUnitario,
    financeiroValorTotalInformado,
    financeiroPesoLote,
    financeiroValorTotalCalculado,
  } = financialContext;

  // P2.4 FIX: Use centralized useLotes hook
  const lotes = useLotes();
  const regulatorySurfaceSource = useLiveQuery(
    () => (activeFarmId ? loadRegulatorySurfaceSource(activeFarmId) : null),
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
  const sanitatioProductMissing = sanitarioData.produto.trim().length === 0;
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
  const showsTransitChecklist = shouldShowTransitChecklist({
    tipoManejo,
    financeiroNatureza: financeiroData.natureza,
  });
  const officialTransitChecklistEnabled = hasOfficialTransitChecklistEnabled(
    regulatorySurfaceSource?.config ?? null,
  );
  const isExternalTransitContext =
    showsTransitChecklist && transitChecklist.enabled;
  const nutritionComplianceGuards =
    tipoManejo === "nutricao"
      ? regulatoryReadModel.flows.nutrition
      : EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.nutrition;
  const movementComplianceGuards = useMemo(
    () =>
      showsTransitChecklist || tipoManejo === "movimentacao"
        ? isExternalTransitContext
          ? regulatoryReadModel.flows.movementExternal
          : regulatoryReadModel.flows.movementInternal
        : EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.movementInternal,
    [isExternalTransitContext, regulatoryReadModel, showsTransitChecklist, tipoManejo],
  );
  const transitChecklistIssues = useMemo(
    () =>
      buildTransitChecklistIssues({
        showsTransitChecklist,
        transitChecklist,
        asOfDate: new Date().toISOString().slice(0, 10),
      }),
    [showsTransitChecklist, transitChecklist],
  );
  const pesagemAnimaisInvalidos = selectedAnimais.filter((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return true;
    const weight = parseUserWeight(weightStr);
    return weight === null || weight <= 0;
  });
  const requiresAnimalsForQuickAction =
    quickActionConfig?.requiresAnimals === true && selectedAnimais.length === 0;
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
  const animaisNoLote = useLiveQuery(
    async () => {
      if (!selectedLoteId) return [];
      if (selectedLoteId === SEM_LOTE_OPTION) {
        return db.state_animais
          .filter((a) => a.lote_id === null && (!a.deleted_at || a.deleted_at === null))
          .toArray();
      }
      return db.state_animais
        .where("lote_id")
        .equals(selectedLoteId)
        .filter((a) => !a.deleted_at || a.deleted_at === null)
        .toArray();
    },
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

  const protocolos = useLiveQuery(() => {
    return activeFarmId
      ? db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((p) => p.ativo && (!p.deleted_at || p.deleted_at === null))
          .toArray()
      : [];
  }, [activeFarmId]);

  const contrapartes = useLiveQuery(() => {
    return activeFarmId
      ? db.state_contrapartes
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((c) => !c.deleted_at || c.deleted_at === null)
          .toArray()
      : [];
  }, [activeFarmId]);
  const protocoloItens = useLiveQuery(() => {
    return protocoloId && activeFarmId
      ? db.state_protocolos_sanitarios_itens
          .where("protocolo_id")
          .equals(protocoloId)
          .filter(
            (i) =>
              i.fazenda_id === activeFarmId &&
              i.tipo === sanitarioData.tipo &&
              (!i.deleted_at || i.deleted_at === null),
          )
          .toArray()
      : [];
  }, [protocoloId, sanitarioData.tipo, activeFarmId]);
  const veterinaryProducts = useLiveQuery(() => {
    return db.catalog_produtos_veterinarios.orderBy("nome").toArray();
  }, []);
  const contraparteSelecionadaNome =
    financeiroData.contraparteId !== "none"
      ? contrapartes?.find((item) => item.id === financeiroData.contraparteId)
          ?.nome ?? "Contraparte selecionada"
      : "Sem contraparte";
  const financeiroResumoValorLabel = Number.isFinite(financeiroValorTotalCalculado)
    ? financeiroValorTotalCalculado.toFixed(2)
    : "-";
  const financeiroResumoPrecoLabel =
    financeiroData.modoPreco === "por_animal" ? "Por animal" : "Por lote";
  const financeiroResumoPesoLabel =
    financeiroData.modoPeso === "nenhum"
      ? "Nao informado"
      : financeiroData.modoPeso === "lote"
        ? `Lote ${
            financeiroPesoLote !== null
              ? formatWeight(
                  financeiroPesoLote,
                  farmMeasurementConfig.weight_unit,
                )
              : "-"
          }`
        : "Individual";
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
  const selectedVeterinaryProduct = useMemo(
    () =>
      (veterinaryProducts ?? []).find(
        (product) => product.id === selectedVeterinaryProductId,
      ) ?? null,
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
  const veterinaryProductSuggestions = useMemo(
    () =>
      searchVeterinaryProducts(veterinaryProducts ?? [], {
        query: sanitarioData.produto,
        sanitaryType: sanitarioData.tipo,
        limit: 6,
      }),
    [sanitarioData.produto, sanitarioData.tipo, veterinaryProducts],
  );
  const hasVeterinaryProducts =
    Array.isArray(veterinaryProducts) && veterinaryProducts.length > 0;
  const isVeterinaryProductsEmpty =
    Array.isArray(veterinaryProducts) && veterinaryProducts.length === 0;
  const selectedAnimaisDetalhes = useMemo(
    () =>
      resolveSelectedRecordsByIds({
        records: animaisNoLote ?? [],
        selectedIds: selectedAnimais,
      }),
    [animaisNoLote, selectedAnimais],
  );
  const movementSensitiveAnimals = useMemo(
    () =>
      resolveMovementSensitiveRecords({
        showsTransitChecklist,
        selectedRecords: selectedAnimaisDetalhes,
        fallbackRecords: animaisNoLote ?? [],
      }),
    [animaisNoLote, selectedAnimaisDetalhes, showsTransitChecklist],
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
        tipoManejo,
        financeiroNatureza: financeiroData.natureza,
        movementBlockers: movementComplianceGuards.blockers,
        nutritionBlockers: nutritionComplianceGuards.blockers,
      }),
    [
      financeiroData.natureza,
      movementComplianceGuards.blockers,
      nutritionComplianceGuards.blockers,
      tipoManejo,
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
        selectedAnimals: selectedAnimaisDetalhes,
      }),
    [protocoloItens, protocolosById, selectedAnimaisDetalhes],
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
    protocoloItensEvaluated.every(
      ({ eligibility }) => !eligibility.compatibleWithAll,
    );
  const protocolEligibilityIssues = useMemo(
    () =>
      buildProtocolEligibilityIssues({
        tipoManejo,
        selectedProtocolCompatibleWithAll:
          selectedProtocoloItemEvaluation?.eligibility.compatibleWithAll ??
          null,
      }),
    [selectedProtocoloItemEvaluation, tipoManejo],
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
  const transitChecklistSection = showsTransitChecklist ? (
    <div className="space-y-4 rounded-lg border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Transito externo e checklist GTA
          </p>
          <p className="text-xs text-muted-foreground">
            Use apenas quando houver saida para outra localizacao. Manejo interno
            entre lotes da mesma fazenda nao exige GTA por padrao.
          </p>
        </div>
        <StatusBadge tone={officialTransitChecklistEnabled ? "warning" : "neutral"}>
          {officialTransitChecklistEnabled
            ? "Overlay oficial ativo"
            : "Checklist manual"}
        </StatusBadge>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
        <Checkbox
          checked={transitChecklist.enabled}
          onCheckedChange={(checked) =>
            setTransitChecklist((prev) => ({
              ...prev,
              enabled: checked === true,
            }))
          }
        />
        <div className="space-y-1">
          <span className="text-sm font-medium text-foreground">
            Este manejo representa transito externo
          </span>
          <p className="text-sm text-muted-foreground">
            Ao ativar, o fluxo passa a exigir GTA/e-GTA e, em reproducao
            interestadual, os atestados sanitarios do PNCEBT.
          </p>
        </div>
      </label>

      {transitChecklist.enabled ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Finalidade do transito</Label>
            <Select
              value={transitChecklist.purpose}
              onValueChange={(value) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  purpose: value as TransitChecklistPurpose,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a finalidade" />
              </SelectTrigger>
              <SelectContent>
                {TRANSIT_PURPOSE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Numero/protocolo GTA</Label>
            <Input
              value={transitChecklist.gtaNumber}
              onChange={(event) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  gtaNumber: event.target.value,
                }))
              }
              placeholder="Ex.: eGTA-2026-000123"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 md:col-span-2">
            <Checkbox
              checked={transitChecklist.gtaChecked}
              onCheckedChange={(checked) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  gtaChecked: checked === true,
                }))
              }
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Checklist de GTA/e-GTA concluido
              </span>
              <p className="text-sm text-muted-foreground">
                Confirma a revisao documental minima antes de liberar o transito.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 md:col-span-2">
            <Checkbox
              checked={transitChecklist.isInterstate}
              onCheckedChange={(checked) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  isInterstate: checked === true,
                  destinationUf:
                    checked === true ? prev.destinationUf : null,
                }))
              }
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Transito interestadual
              </span>
              <p className="text-sm text-muted-foreground">
                Habilita UF de destino e, para reproducao, a validacao dos
                atestados negativos com janela de 60 dias.
              </p>
            </div>
          </label>

          {transitChecklist.isInterstate ? (
            <div className="space-y-2 md:col-span-2">
              <Label>UF de destino</Label>
              <Select
                value={transitChecklist.destinationUf ?? "__none__"}
                onValueChange={(value) =>
                  setTransitChecklist((prev) => ({
                    ...prev,
                    destinationUf:
                      value === "__none__" ? null : (value as EstadoUFEnum),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  {TRANSIT_CHECKLIST_UF_OPTIONS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {transitChecklist.purpose === "reproducao" && transitChecklist.isInterstate ? (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 md:col-span-2">
                <Checkbox
                  checked={transitChecklist.reproductionDocsChecked}
                  onCheckedChange={(checked) =>
                    setTransitChecklist((prev) => ({
                      ...prev,
                      reproductionDocsChecked: checked === true,
                    }))
                  }
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">
                    Atestados PNCEBT conferidos
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Confirmar brucelose e tuberculose negativas antes do
                    transito para reproducao interestadual.
                  </p>
                </div>
              </label>

              <div className="space-y-2">
                <Label>Atestado negativo de brucelose</Label>
                <Input
                  type="date"
                  value={transitChecklist.brucellosisExamDate}
                  onChange={(event) =>
                    setTransitChecklist((prev) => ({
                      ...prev,
                      brucellosisExamDate: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Atestado negativo de tuberculose</Label>
                <Input
                  type="date"
                  value={transitChecklist.tuberculosisExamDate}
                  onChange={(event) =>
                    setTransitChecklist((prev) => ({
                      ...prev,
                      tuberculosisExamDate: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <Label>Observacoes do transito</Label>
            <Input
              value={transitChecklist.notes}
              onChange={(event) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Ex.: saida para feira, leilao, frigorifico ou cobertura interestadual"
            />
          </div>
        </div>
      ) : null}

      {transitChecklistIssues.length > 0 ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {transitChecklistIssues[0]}
        </div>
      ) : null}
    </div>
  ) : null;
  const sanitaryMovementBlockSection =
    showsTransitChecklist && animalsBlockedBySanitaryAlert.length > 0 ? (
      <div className="space-y-3 rounded-lg border border-rose-200/70 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Bloqueio sanitario de movimentacao
          </p>
          <p className="text-xs text-muted-foreground">
            Animais com suspeita sanitaria aberta nao podem seguir para
            movimentacao externa ou venda ate o encerramento do alerta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {animalsBlockedBySanitaryAlert.map(({ animal, alert }) => (
            <StatusBadge key={animal.id} tone="danger">
              {animal.identificacao}: {alert.diseaseName ?? "suspeita aberta"}
            </StatusBadge>
          ))}
        </div>
      </div>
    ) : null;
  const movementComplianceBlockSection =
    movementComplianceGuards.blockers.length > 0 ||
    movementComplianceGuards.warnings.length > 0 ? (
      <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Restricoes regulatorias de movimentacao
          </p>
          <p className="text-xs text-muted-foreground">
            O overlay oficial detectou pendencias que afetam este fluxo de
            movimentacao.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {movementComplianceGuards.blockers.map((guard) => (
            <StatusBadge key={guard.key} tone={guard.tone}>
              {guard.label}
            </StatusBadge>
          ))}
          {movementComplianceGuards.warnings.map((guard) => (
            <StatusBadge key={guard.key} tone={guard.tone}>
              {guard.label}
            </StatusBadge>
          ))}
        </div>
        {movementComplianceGuards.blockers.length > 0 ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {movementComplianceGuards.blockers[0]?.message}
          </div>
        ) : null}
        {movementComplianceGuards.blockers.length === 0 &&
        movementComplianceGuards.warnings.length > 0 ? (
          <div className="rounded-lg border border-warning/20 bg-warning-muted/60 p-3 text-sm text-warning">
            {movementComplianceGuards.warnings[0]?.message}
          </div>
        ) : null}
      </div>
    ) : null;
  const nutritionComplianceBlockSection =
    nutritionComplianceGuards.blockers.length > 0 ||
    nutritionComplianceGuards.warnings.length > 0 ? (
      <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Restricoes regulatorias de nutricao
          </p>
          <p className="text-xs text-muted-foreground">
            O overlay oficial detectou risco alimentar ou operacional antes do
            lancamento deste manejo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nutritionComplianceGuards.blockers.map((guard) => (
            <StatusBadge key={guard.key} tone={guard.tone}>
              {guard.label}
            </StatusBadge>
          ))}
          {nutritionComplianceGuards.warnings.map((guard) => (
            <StatusBadge key={guard.key} tone={guard.tone}>
              {guard.label}
            </StatusBadge>
          ))}
        </div>
        {nutritionComplianceGuards.blockers.length > 0 ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {nutritionComplianceGuards.blockers[0]?.message}
          </div>
        ) : null}
        {nutritionComplianceGuards.blockers.length === 0 &&
        nutritionComplianceGuards.warnings.length > 0 ? (
          <div className="rounded-lg border border-warning/20 bg-warning-muted/60 p-3 text-sm text-warning">
            {nutritionComplianceGuards.warnings[0]?.message}
          </div>
        ) : null}
      </div>
    ) : null;

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

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(activeFarmId, [
      "protocolos_sanitarios",
      "protocolos_sanitarios_itens",
    ]).catch((error) => {
      console.warn("[registrar] failed to refresh sanitary protocols", error);
    });
  }, [activeFarmId]);

  useEffect(() => {
    if (!activeFarmId) return;

    refreshVeterinaryProductsCatalog().catch((error) => {
      console.warn("[registrar] failed to refresh veterinary products", error);
    });
  }, [activeFarmId]);

  useEffect(() => {
    if (!protocoloId) return;
    const stillExists = (protocolos ?? []).some((p) => p.id === protocoloId);
    if (!stillExists) {
      setProtocoloId("");
      setProtocoloItemId("");
    }
  }, [protocolos, protocoloId]);

  useEffect(() => {
    if (!protocoloItemId) return;
    const stillExists = (protocoloItens ?? []).some((item) => item.id === protocoloItemId);
    if (!stillExists) {
      setProtocoloItemId("");
    }
  }, [protocoloItens, protocoloItemId]);

  useEffect(() => {
    if (!protocoloItemId) return;
    const selectedItem = (protocoloItens ?? []).find(
      (item) => item.id === protocoloItemId,
    );
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
      setSelectedVeterinaryProductId((currentId) =>
        currentId || productSelection.id,
      );
    }
  }, [protocoloItemId, protocoloItens, resolveProtocolProductSelection]);

  useEffect(() => {
    const normalizedTypedProduct = normalizeVeterinaryProductText(
      sanitarioData.produto,
    );

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
  }, [
    sanitarioData.produto,
    selectedVeterinaryProduct,
    selectedVeterinaryProductId,
  ]);

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
    if (queryProtocoloId) {
      setProtocoloId(queryProtocoloId);
    }
    if (queryProtocoloItemId) {
      setProtocoloItemId(queryProtocoloItemId);
    }
    if (queryProduto) {
      setSanitarioData((prev) => ({ ...prev, produto: queryProduto }));
    }
    if (
      querySanitarioTipo &&
      ["vacinacao", "vermifugacao", "medicamento"].includes(querySanitarioTipo)
    ) {
      setSanitarioData((prev) => ({
        ...prev,
        tipo: querySanitarioTipo as SanitarioTipoEnum,
      }));
    }
    if (
      queryNatureza &&
      ["compra", "venda", "sociedade_entrada", "sociedade_saida"].includes(
        queryNatureza,
      )
    ) {
      setFinanceiroData((prev) => ({
        ...prev,
        natureza: queryNatureza as FinanceiroNatureza,
      }));
    }
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
  }, [searchParams, applyQuickAction]);

  useEffect(() => {
    const applySourceTaskPrefill = async () => {
      if (!sourceTaskId) return;
      if (tipoManejo && tipoManejo !== "sanitario") return;

      const sourceTask = await db.state_agenda_itens.get(sourceTaskId);
      if (!sourceTask || sourceTask.dominio !== "sanitario") return;

      const sourceRef = sourceTask.source_ref;
      const protocoloIdFromTask = readString(sourceRef, "protocolo_id");
      const protocoloItemIdFromTask =
        readString(sourceRef, "protocolo_item_id") ?? sourceTask.protocol_item_version_id;
      const produtoFromTask =
        readString(sourceRef, "produto") ?? readString(sourceTask.payload, "produto");
      const tipoFromTask = readString(sourceRef, "tipo");
      const productSelectionFromTask =
        readVeterinaryProductSelection(sourceRef) ??
        readVeterinaryProductSelection(sourceTask.payload);

      if (protocoloIdFromTask) setProtocoloId((prev) => prev || protocoloIdFromTask);
      if (protocoloItemIdFromTask) {
        setProtocoloItemId((prev) => prev || protocoloItemIdFromTask);
      }
      if (productSelectionFromTask) {
        setSelectedVeterinaryProductId((prev) =>
          prev || productSelectionFromTask.id,
        );
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
  }, [sourceTaskId, tipoManejo]);

  useEffect(() => {
    if (selectedAnimais.length === 0 && financeiroData.natureza === "venda") {
      setFinanceiroData((prev) => ({ ...prev, natureza: "compra" }));
    }
  }, [selectedAnimais.length, financeiroData.natureza]);

  useEffect(() => {
    if (tipoManejo !== "financeiro") {
      setCompraNovosAnimais([]);
      return;
    }

    if (
      financeiroData.natureza === "venda" &&
      financeiroData.modoPeso === "individual"
    ) {
      setCompraNovosAnimais((prev) =>
        selectedAnimais.map((animalId, index) => {
          const current = prev[index];
          return {
            localId: current?.localId ?? animalId,
            identificacao: current?.identificacao ?? "",
            sexo: current?.sexo ?? "F",
            dataNascimento: "",
            pesoKg: current?.pesoKg ?? "",
          };
        }),
      );
      return;
    }

    if (financeiroData.natureza !== "compra") {
      setCompraNovosAnimais([]);
      return;
    }

    if (selectedAnimais.length > 0) {
      setCompraNovosAnimais([]);
      return;
    }

    const nextQuantity = Math.max(
      1,
      Number.parseInt(financeiroData.quantidadeAnimais || "1", 10) || 1,
    );
    setCompraNovosAnimais((prev) => {
      const nextDrafts: CompraNovoAnimalDraft[] = Array.from(
        { length: nextQuantity },
        (_, index) => {
          const current = prev[index];
          return (
            current ?? {
              localId: crypto.randomUUID(),
              identificacao: "",
              sexo: index === 0 ? ("F" as const) : ("M" as const),
              dataNascimento: "",
              pesoKg: "",
            }
          );
        },
      );
      return nextDrafts;
    });
  }, [
    tipoManejo,
    financeiroData.natureza,
    financeiroData.modoPeso,
    financeiroData.quantidadeAnimais,
    selectedAnimais,
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

  useEffect(() => {
    if (!showsTransitChecklist) {
      setTransitChecklist(DEFAULT_TRANSIT_CHECKLIST_DRAFT);
      return;
    }

    setTransitChecklist((prev) => {
      const expectedPurpose =
        tipoManejo === "financeiro" && financeiroData.natureza === "venda"
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
  }, [financeiroData.natureza, showsTransitChecklist, tipoManejo]);

  // UX Improvement: Auto-select bull if present in the selected lote
  useEffect(() => {
     const autoSelectBull = async () => {
        if (tipoManejo !== "reproducao") return;
        if (!selectedLoteId || selectedLoteId === SEM_LOTE_OPTION) return;

        // If we already have a bull selected manually, don't override
        if (reproducaoData.machoId) return;

        // Find active bulls in this lote
        const bullsInLote = await db.state_animais
           .where("lote_id")
           .equals(selectedLoteId)
           .filter(a => a.sexo === "M" && a.status === "ativo" && !a.deleted_at)
           .toArray();

        if (bullsInLote.length === 1) {
           setReproducaoData(prev => ({ ...prev, machoId: bullsInLote[0].id }));
           showSuccess(`Reprodutor ${bullsInLote[0].identificacao} selecionado automaticamente.`);
        }
     };

     autoSelectBull();
  }, [tipoManejo, selectedLoteId, reproducaoData.machoId]);

  const handleCreateContraparte = async () => {
    const fazenda_id = activeFarmId ?? lotes?.[0]?.fazenda_id;
    if (!fazenda_id) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManageContraparte) {
      showError("Apenas owner/manager pode cadastrar contraparte.");
      return;
    }
    if (!novaContraparte.nome.trim()) {
      showError("Nome da contraparte e obrigatorio.");
      return;
    }

    setIsSavingContraparte(true);
    try {
      const { contraparteId, txId } = await runRegistrarCreateContraparteEffect({
        fazendaId: fazenda_id,
        draft: novaContraparte,
      });

      setFinanceiroData((prev) => ({ ...prev, contraparteId }));
      setNovaContraparte({
        tipo: "pessoa",
        nome: "",
        documento: "",
        telefone: "",
        email: "",
        endereco: "",
      });
      setShowNovaContraparte(false);
      showSuccess(
        `Contraparte salva neste aparelho. Sincronizacao pendente. TX ${txId.slice(0, 8)}.`,
      );
    } catch {
      showError("Falha ao cadastrar contraparte.");
    } finally {
      setIsSavingContraparte(false);
    }
  };

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

      const txId = await createGesture(fazenda_id, ops);
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
                onSanitarioTipoChange={(tipo) =>
                  setSanitarioData((prev) => ({ ...prev, tipo }))
                }
                produto={sanitarioData.produto}
                onProdutoChange={(value) =>
                  setSanitarioData((prev) => ({ ...prev, produto: value }))
                }
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
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Natureza</Label>
                  <Select
                    onValueChange={(value) =>
                      setFinanceiroData((prev) => ({
                        ...prev,
                        natureza: value as FinanceiroNatureza,
                      }))
                    }
                    value={financeiroData.natureza}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem
                        value="venda"
                        disabled={selectedAnimais.length === 0}
                      >
                        Venda
                      </SelectItem>
                      <SelectItem value="sociedade_entrada">
                        Sociedade (Entrada)
                      </SelectItem>
                      <SelectItem value="sociedade_saida">
                        Sociedade (Saida)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!isFinanceiroSociedade && (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Quantidade de animais</Label>
                        <Input
                          type="number"
                          min="1"
                          value={
                            selectedAnimais.length > 0
                              ? String(selectedAnimais.length)
                              : financeiroData.quantidadeAnimais
                          }
                          disabled={selectedAnimais.length > 0}
                          onChange={(e) =>
                            setFinanceiroData((prev) => ({
                              ...prev,
                              quantidadeAnimais: e.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {selectedAnimais.length > 0
                            ? "Quantidade travada pela selecao atual de animais."
                            : "Para compra sem animais previamente selecionados, o sistema gera esse lote de animais no mesmo gesto."}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Modo de preco</Label>
                        <Select
                          value={financeiroData.modoPreco}
                          onValueChange={(value) =>
                            setFinanceiroData((prev) => ({
                              ...prev,
                              modoPreco: value as FinancialPriceMode,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="por_lote">Preco por lote</SelectItem>
                            <SelectItem value="por_animal">Preco por animal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {financeiroData.modoPreco === "por_animal" ? (
                        <div className="space-y-2">
                          <Label>Valor por animal</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={financeiroData.valorUnitario}
                            onChange={(e) =>
                              setFinanceiroData((prev) => ({
                                ...prev,
                                valorUnitario: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Valor total do lote</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={financeiroData.valorTotal}
                            onChange={(e) =>
                              setFinanceiroData((prev) => ({
                                ...prev,
                                valorTotal: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Total calculado</Label>
                        <Input
                          value={
                            Number.isFinite(financeiroValorTotalCalculado)
                              ? financeiroValorTotalCalculado.toFixed(2)
                              : ""
                          }
                          disabled
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Modo de peso</Label>
                        <Select
                          value={financeiroData.modoPeso}
                          onValueChange={(value) =>
                            setFinanceiroData((prev) => ({
                              ...prev,
                              modoPeso: value as FinancialWeightMode,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">Sem peso</SelectItem>
                            <SelectItem value="lote">Peso do lote</SelectItem>
                            <SelectItem value="individual">Peso individual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {financeiroData.modoPeso === "lote" && (
                        <div className="space-y-2">
                          <Label>
                            Peso do lote ({getWeightUnitLabel(farmMeasurementConfig.weight_unit)})
                          </Label>
                          <Input
                            type="number"
                            step={getWeightInputStep(farmMeasurementConfig.weight_unit)}
                            value={financeiroData.pesoLoteKg}
                            onChange={(e) =>
                              setFinanceiroData((prev) => ({
                                ...prev,
                                pesoLoteKg: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
                <FinanceiroContraparteSection
                  isFinanceiroSociedade={isFinanceiroSociedade}
                  financeiroContraparteId={financeiroData.contraparteId}
                  contrapartes={contrapartes}
                  onFinanceiroContraparteChange={(value) =>
                    setFinanceiroData((prev) => ({
                      ...prev,
                      contraparteId: value,
                    }))
                  }
                  showNovaContraparte={showNovaContraparte}
                  onToggleNovaContraparte={() =>
                    setShowNovaContraparte((prev) => !prev)
                  }
                  canManageContraparte={canManageContraparte}
                  onNavigateContrapartes={() => navigate("/contrapartes")}
                  novaContraparte={novaContraparte}
                  onNovaContraparteFieldChange={(field, value) =>
                    setNovaContraparte((prev) => ({
                      ...prev,
                      [field]: value,
                    }))
                  }
                  onCreateContraparte={handleCreateContraparte}
                  isSavingContraparte={isSavingContraparte}
                />

                {selectedAnimais.length === 0 &&
                  financeiroData.natureza === "compra" &&
                  !isFinanceiroSociedade && (
                    <FinanceiroCompraAnimaisSection
                      drafts={compraNovosAnimais}
                      isIndividualWeightMode={financeiroData.modoPeso === "individual"}
                      weightInputStep={financeiroWeightStep}
                      weightUnitLabel={financeiroWeightUnitLabel}
                      onIdentificacaoChange={(localId, value) =>
                        updateCompraNovoAnimalField(localId, "identificacao", value)
                      }
                      onSexoChange={(localId, value) =>
                        updateCompraNovoAnimalField(localId, "sexo", value as RegistrarSexo)
                      }
                      onDataNascimentoChange={(localId, value) =>
                        updateCompraNovoAnimalField(localId, "dataNascimento", value)
                      }
                      onPesoChange={(localId, value) =>
                        updateCompraNovoAnimalField(localId, "pesoKg", value)
                      }
                    />
                  )}

                {selectedAnimais.length > 0 &&
                  financeiroData.natureza === "venda" &&
                  financeiroData.modoPeso === "individual" &&
                  !isFinanceiroSociedade && (
                    <FinanceiroVendaPesosSection
                      selectedAnimalIds={selectedAnimais}
                      animaisNoLote={animaisNoLote}
                      drafts={compraNovosAnimais}
                      weightInputStep={financeiroWeightStep}
                      weightUnitLabel={financeiroWeightUnitLabel}
                      onPesoAtIndexChange={updateCompraNovoAnimalPesoByIndex}
                    />
                  )}
                {transitChecklistSection}
                {sanitaryMovementBlockSection}
                {movementComplianceBlockSection}
              </div>

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
