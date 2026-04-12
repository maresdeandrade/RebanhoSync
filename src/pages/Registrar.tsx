import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import type {
  FinanceiroTipoEnum,
  OperationInput,
  SanitarioTipoEnum,
  ReproTipoEnum,
  Animal,
  ProdutoVeterinarioCatalogEntry,
  EstadoUFEnum,
} from "@/lib/offline/types";
import {
  ReproductionForm,
  ReproductionEventData,
} from "@/components/events/ReproductionForm";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { EventDomain, EventInput } from "@/lib/events/types";
import { EventValidationError } from "@/lib/events/validators";
import { prepareReproductionGesture } from "@/lib/reproduction/register";
import {
  buildFinancialTransaction,
  resolveFinancialTotalAmount,
  type FinancialPriceMode,
  type FinancialTransactionNature,
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
  Search,
  Syringe,
  ChevronRight,
  ChevronLeft,
  Check,
  PlusCircle,
  Handshake,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";
import { deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import {
  formatWeight,
  getWeightInputStep,
  getWeightUnitLabel,
  parseWeightInput,
} from "@/lib/format/weight";
import {
  buildVeterinaryProductMetadata,
  readVeterinaryProductSelection,
  refreshVeterinaryProductsCatalog,
  resolveVeterinaryProductByName,
  searchVeterinaryProducts,
  normalizeVeterinaryProductText,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/products";
import { describeSanitaryCalendarSchedule } from "@/lib/sanitario/calendar";
import { readSanitaryRegimen } from "@/lib/sanitario/regimen";
import {
  evaluateSanitaryProtocolEligibility,
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
  buildTransitChecklistPayload,
  hasOfficialTransitChecklistEnabled,
  validateTransitChecklist,
  type TransitChecklistPurpose,
} from "@/lib/sanitario/transit";
import { cn } from "@/lib/utils";

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

interface CompraNovoAnimalDraft {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string;
  pesoKg: string;
}

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

const isDirectFinancialNature = (
  value: FinanceiroNatureza,
): value is FinancialTransactionNature => value === "compra" || value === "venda";

interface NovaContraparteDraft {
  tipo: "pessoa" | "empresa";
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
}

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
  const [novaContraparte, setNovaContraparte] = useState<NovaContraparteDraft>({
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

  // TD-014: Validar peso > 0 no frontend para pesagem
  const isPesagemValid = selectedAnimais.every((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return false;
    const weight = parseUserWeight(weightStr);
    return weight !== null && weight > 0;
  });

  const financeiroTipo: FinanceiroTipoEnum =
    financeiroData.natureza === "venda" ||
    financeiroData.natureza === "sociedade_saida"
      ? "venda"
      : "compra";
  const isFinanceiroSociedade =
    financeiroData.natureza === "sociedade_entrada" ||
    financeiroData.natureza === "sociedade_saida";
  const parseNumeric = (value: string): number =>
    Number.parseFloat(value.replace(",", "."));
  const financeiroQuantidadeAnimais =
    selectedAnimais.length > 0
      ? selectedAnimais.length
      : Math.max(1, Number.parseInt(financeiroData.quantidadeAnimais || "1", 10) || 1);
  const financeiroValorUnitario =
    financeiroData.valorUnitario.trim() !== ""
      ? parseNumeric(financeiroData.valorUnitario)
      : null;
  const financeiroValorTotalInformado =
    financeiroData.valorTotal.trim() !== ""
      ? parseNumeric(financeiroData.valorTotal)
      : null;
  const financeiroPesoLote =
    financeiroData.pesoLoteKg.trim() !== ""
      ? parseUserWeight(financeiroData.pesoLoteKg)
      : null;
  const financeiroValorTotalCalculado = resolveFinancialTotalAmount({
    quantity: financeiroQuantidadeAnimais,
    priceMode: financeiroData.modoPreco,
    totalAmount: financeiroValorTotalInformado,
    unitAmount: financeiroValorUnitario,
  });

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
      ? parseNumeric(nutricaoData.quantidadeKg)
      : null;
  const nutricaoAlimentoMissing = nutricaoData.alimentoNome.trim().length === 0;
  const nutricaoQuantidadeInvalida =
    nutricaoQuantidade === null ||
    !Number.isFinite(nutricaoQuantidade) ||
    nutricaoQuantidade <= 0;
  const movimentacaoSemDestino = movimentacaoData.toLoteId.trim().length === 0;
  const movimentacaoDestinoIgualOrigem =
    Boolean(selectedLoteIdNormalized) &&
    movimentacaoData.toLoteId === selectedLoteIdNormalized;
  const showsTransitChecklist =
    tipoManejo === "movimentacao" ||
    (tipoManejo === "financeiro" && financeiroData.natureza === "venda");
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
  const transitChecklistIssues = useMemo(() => {
    if (!showsTransitChecklist) return [];

    return validateTransitChecklist(
      transitChecklist,
      new Date().toISOString().slice(0, 10),
    );
  }, [showsTransitChecklist, transitChecklist]);
  const pesagemAnimaisInvalidos = selectedAnimais.filter((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return true;
    const weight = parseUserWeight(weightStr);
    return weight === null || weight <= 0;
  });
  const requiresAnimalsForQuickAction =
    quickActionConfig?.requiresAnimals === true && selectedAnimais.length === 0;
  const baseActionStepIssues = useMemo(() => {
    if (!tipoManejo) return ["Escolha um manejo antes de continuar."];

    const issues: string[] = [];

    if (tipoManejo === "sanitario" && sanitatioProductMissing) {
      issues.push("Informe o produto sanitario antes de confirmar.");
    }

    if (tipoManejo === "pesagem" && pesagemAnimaisInvalidos.length > 0) {
      issues.push("Informe peso maior que zero para todos os animais selecionados.");
    }

    if (tipoManejo === "movimentacao") {
      if (movimentacaoSemDestino) {
        issues.push("Selecione o lote de destino antes de continuar.");
      } else if (movimentacaoDestinoIgualOrigem) {
        issues.push("Origem e destino devem ser diferentes.");
      }
    }

    if (tipoManejo === "nutricao") {
      if (nutricaoAlimentoMissing) {
        issues.push("Informe o alimento usado no manejo.");
      }
      if (nutricaoQuantidadeInvalida) {
        issues.push("Quantidade de nutricao deve ser maior que zero.");
      }
    }

    if (
      tipoManejo === "financeiro" &&
      isFinanceiroSociedade &&
      financeiroData.contraparteId === "none"
    ) {
      issues.push("Eventos de sociedade exigem uma contraparte vinculada.");
    }

    if (partoRequiresSingleMatrix) {
      issues.push("Parto com geracao de cria deve ser registrado para uma matriz por vez.");
    }

    return issues;
  }, [
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
  ]);
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
    const normalizedSearch = animalSearch.trim().toLowerCase();
    const base = animaisNoLote ?? [];

    if (!normalizedSearch) return base;

    return base.filter((animal) =>
      [
        animal.identificacao,
        animal.nome ?? "",
        animal.rfid ?? "",
        animal.sexo === "M" ? "macho" : "femea",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [animalSearch, animaisNoLote]);
  const visibleAnimalIds = filteredAnimaisNoLote.map((animal) => animal.id);
  const selectedVisibleCount = visibleAnimalIds.filter((id) =>
    selectedAnimais.includes(id),
  ).length;

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
  const selectedAnimaisDetalhes = useMemo(
    () =>
      (animaisNoLote ?? []).filter((animal) => selectedAnimais.includes(animal.id)),
    [animaisNoLote, selectedAnimais],
  );
  const movementSensitiveAnimals = useMemo(() => {
    if (!showsTransitChecklist) return [];
    if (selectedAnimaisDetalhes.length > 0) return selectedAnimaisDetalhes;
    return animaisNoLote ?? [];
  }, [animaisNoLote, selectedAnimaisDetalhes, showsTransitChecklist]);
  const animalsBlockedBySanitaryAlert = useMemo(
    () => listAnimalsBlockedBySanitaryAlert(movementSensitiveAnimals),
    [movementSensitiveAnimals],
  );
  const sanitaryMovementBlockIssues = useMemo(() => {
    if (!showsTransitChecklist || animalsBlockedBySanitaryAlert.length === 0) {
      return [];
    }

    const firstBlocked = animalsBlockedBySanitaryAlert[0];
    if (!firstBlocked) return [];

    return [
      animalsBlockedBySanitaryAlert.length === 1
        ? `${firstBlocked.animal.identificacao} esta com suspeita sanitaria aberta e nao pode sair da fazenda.`
        : `${animalsBlockedBySanitaryAlert.length} animal(is) do recorte atual estao com suspeita sanitaria aberta e bloqueio de movimentacao.`,
    ];
  }, [animalsBlockedBySanitaryAlert, showsTransitChecklist]);
  const complianceFlowIssues = useMemo(() => {
    if (tipoManejo === "nutricao") {
      return nutritionComplianceGuards.blockers.map((guard) => guard.message);
    }

    if (tipoManejo === "movimentacao") {
      return movementComplianceGuards.blockers.map((guard) => guard.message);
    }

    if (tipoManejo === "financeiro" && financeiroData.natureza === "venda") {
      return movementComplianceGuards.blockers.map((guard) => guard.message);
    }

    return [];
  }, [
    financeiroData.natureza,
    movementComplianceGuards.blockers,
    nutritionComplianceGuards.blockers,
    tipoManejo,
  ]);
  const protocolosById = useMemo(
    () => new Map((protocolos ?? []).map((protocolo) => [protocolo.id, protocolo])),
    [protocolos],
  );
  const protocoloItensEvaluated = useMemo(
    () =>
      (protocoloItens ?? [])
        .map((item) => {
          const protocolo = protocolosById.get(item.protocolo_id) ?? null;
          const eligibility = evaluateSanitaryProtocolEligibility(
            item,
            selectedAnimaisDetalhes,
            protocolo,
          );

          return {
            item,
            protocolo,
            eligibility,
          };
        })
        .sort((left, right) => {
          if (
            left.eligibility.compatibleWithAll !==
            right.eligibility.compatibleWithAll
          ) {
            return left.eligibility.compatibleWithAll ? -1 : 1;
          }

          return (left.item.dose_num ?? 0) - (right.item.dose_num ?? 0);
        }),
    [protocoloItens, protocolosById, selectedAnimaisDetalhes],
  );
  const selectedProtocoloItemEvaluation = useMemo(
    () =>
      protocoloItensEvaluated.find(({ item }) => item.id === protocoloItemId) ?? null,
    [protocoloItemId, protocoloItensEvaluated],
  );
  const protocolEligibilityIssues = useMemo(() => {
    if (tipoManejo !== "sanitario" || !selectedProtocoloItemEvaluation) {
      return [];
    }

    if (selectedProtocoloItemEvaluation.eligibility.compatibleWithAll) {
      return [];
    }

    return [
      "O item de protocolo escolhido nao atende todos os animais selecionados.",
    ];
  }, [selectedProtocoloItemEvaluation, tipoManejo]);
  const actionStepIssues = useMemo(
    () => [
      ...baseActionStepIssues,
      ...protocolEligibilityIssues,
      ...sanitaryMovementBlockIssues,
      ...complianceFlowIssues,
      ...transitChecklistIssues,
    ],
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
      movimentacaoData.toLoteId &&
      selectedLoteIdNormalized &&
      movimentacaoData.toLoteId === selectedLoteIdNormalized
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
      const contraparteId = crypto.randomUUID();
      const txId = await createGesture(fazenda_id, [
        {
          table: "contrapartes",
          action: "INSERT",
          record: {
            id: contraparteId,
            tipo: novaContraparte.tipo,
            nome: novaContraparte.nome.trim(),
            documento: novaContraparte.documento.trim() || null,
            telefone: novaContraparte.telefone.trim() || null,
            email: novaContraparte.email.trim() || null,
            endereco: novaContraparte.endereco.trim() || null,
            payload: {
              origem: "registrar_financeiro",
            },
          },
        },
      ]);

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
    const financeRequiresAnimal =
      tipoManejo === "financeiro" && financeiroData.natureza === "venda";
    const financeByLoteOnly =
      tipoManejo === "financeiro" &&
      !financeRequiresAnimal &&
      !hasSelectedAnimals;
    const compraGerandoAnimais =
      tipoManejo === "financeiro" &&
      financeiroData.natureza === "compra" &&
      !hasSelectedAnimals;

    if (
      tipoManejo === "financeiro" &&
      isFinanceiroSociedade &&
      financeiroData.contraparteId === "none"
    ) {
      showError("Selecione ou cadastre uma contraparte para evento de sociedade.");
      return;
    }

    if (!hasSelectedAnimals && !financeByLoteOnly) {
      showError("Selecione ao menos um animal para este tipo de registro.");
      return;
    }

    if (financeByLoteOnly && !selectedLoteId) {
      showError("Selecione um lote para registrar compra sem animais.");
      return;
    }

    if (partoRequiresSingleMatrix) {
      showError(
        "Parto com geracao de cria deve ser registrado para uma matriz por vez.",
      );
      return;
    }

    if (
      tipoManejo === "financeiro" &&
      !isFinanceiroSociedade &&
      (!Number.isFinite(financeiroValorTotalCalculado) ||
        financeiroValorTotalCalculado <= 0)
    ) {
      showError("Informe um valor financeiro valido para a transacao.");
      return;
    }

    if (
      tipoManejo === "financeiro" &&
      !isFinanceiroSociedade &&
      financeiroData.modoPeso === "lote" &&
      (!Number.isFinite(financeiroPesoLote) || (financeiroPesoLote ?? 0) <= 0)
    ) {
      showError("Informe um peso de lote valido.");
      return;
    }

    if (
      tipoManejo === "financeiro" &&
      !isFinanceiroSociedade &&
      financeiroData.modoPreco === "por_animal" &&
      (!Number.isFinite(financeiroValorUnitario) ||
        (financeiroValorUnitario ?? 0) <= 0)
    ) {
      showError("Informe um valor unitario valido.");
      return;
    }

    if (
      tipoManejo === "financeiro" &&
      financeiroData.natureza === "compra" &&
      !hasSelectedAnimals &&
      compraNovosAnimais.length !== financeiroQuantidadeAnimais
    ) {
      showError("A quantidade de animais da compra ficou inconsistente.");
      return;
    }

    if (compraGerandoAnimais) {
      const hoje = new Date();
      const dataNascimentoInvalida = compraNovosAnimais.some((item) => {
        if (!item.dataNascimento) return false;
        const parsed = new Date(item.dataNascimento);
        return Number.isNaN(parsed.getTime()) || parsed > hoje;
      });
      if (dataNascimentoInvalida) {
        showError("Data de nascimento invalida ou no futuro.");
        return;
      }

      const identificacoes = compraNovosAnimais
        .map((item) => item.identificacao.trim().toLowerCase())
        .filter(Boolean);
      if (new Set(identificacoes).size !== identificacoes.length) {
        showError("Nao repita identificacoes nos novos animais.");
        return;
      }

      if (financeiroData.modoPeso === "individual") {
          const pesoInvalido = compraNovosAnimais.some((item) => {
            if (!item.pesoKg.trim()) return true;
            const peso = parseUserWeight(item.pesoKg);
            return !Number.isFinite(peso) || peso <= 0;
          });
        if (pesoInvalido) {
          showError("Informe um peso individual valido para cada animal da compra.");
          return;
        }
      }
    }

    if (
      tipoManejo === "financeiro" &&
      financeiroData.natureza === "venda" &&
      financeiroData.modoPeso === "individual"
    ) {
      const pesoInvalido = compraNovosAnimais.some((item) => {
        if (!item.pesoKg.trim()) return true;
        const peso = parseUserWeight(item.pesoKg);
        return !Number.isFinite(peso) || peso <= 0;
      });
      if (pesoInvalido) {
        showError("Informe um peso individual valido para cada animal da venda.");
        return;
      }
    }

    if (tipoManejo === "pesagem") {
      const invalidWeights = selectedAnimais.filter((id) => {
        const weightStr = pesagemData[id];
        if (!weightStr || weightStr.trim() === "") return true;
        const weight = parseUserWeight(weightStr);
        return weight === null || weight <= 0;
      });

      if (invalidWeights.length > 0) {
        showError("Informe um peso maior que zero para todos os animais.");
        return;
      }
    }

    if (transitChecklistIssues.length > 0) {
      showError(transitChecklistIssues[0] ?? "Checklist de transito incompleto.");
      return;
    }

    if (complianceFlowIssues.length > 0) {
      showError(complianceFlowIssues[0] ?? "Bloqueio regulatorio em aberto.");
      return;
    }

    try {
      const now = new Date().toISOString();
      const protocoloItem =
        tipoManejo === "sanitario" && protocoloItemId
          ? await db.state_protocolos_sanitarios_itens.get(protocoloItemId)
          : null;
      const sanitaryProductName =
        tipoManejo === "sanitario"
          ? sanitarioData.produto.trim() || protocoloItem?.produto || ""
          : "";
      const protocolRegimen =
        tipoManejo === "sanitario" && protocoloItem
          ? readSanitaryRegimen(protocoloItem.payload)
          : null;
      const protocolProductSelection =
        tipoManejo === "sanitario" && protocoloItem
          ? resolveProtocolProductSelection(
              protocoloItem.payload,
              protocoloItem.produto,
              protocoloItem.tipo,
            )
          : null;
      const sanitaryProductSelection =
        tipoManejo === "sanitario"
          ? selectedVeterinaryProductSelection ?? protocolProductSelection
          : null;
      const sanitaryProductMetadata =
        tipoManejo === "sanitario"
          ? {
              ...buildVeterinaryProductMetadata({
                selectedProduct: sanitaryProductSelection,
                typedName: sanitaryProductName,
                source: sanitaryProductSelection?.origem,
                matchMode: sanitaryProductSelection?.matchMode ?? null,
              }),
              ...(protocoloItem
                ? {
                    protocolo_item_id: protocoloItem.id,
                    protocolo_id: protocoloItem.protocolo_id,
                  }
                : {}),
              ...(protocolRegimen
                ? {
                    family_code: protocolRegimen.family_code,
                    regimen_version: protocolRegimen.regimen_version,
                    milestone_code: protocolRegimen.milestone_code,
                    regime_sanitario: protocolRegimen,
                  }
                : {}),
            }
          : {};
      const transitChecklistPayload = showsTransitChecklist
        ? buildTransitChecklistPayload(transitChecklist, {
            officialPackEnabled: officialTransitChecklistEnabled,
          })
        : {};

      if (tipoManejo === "sanitario" && sourceTaskId) {
        try {
          const eventoId = await concluirPendenciaSanitaria({
            agendaItemId: sourceTaskId,
            occurredAt: now,
            tipo: sanitarioData.tipo,
            produto: sanitaryProductName,
            payload: {
              origem: "registrar_manejo",
              ...sanitaryProductMetadata,
            },
          });

          await pullDataForFarm(fazenda_id, [
            "agenda_itens",
            "eventos",
            "eventos_sanitario",
          ]);

          showSuccess(
            `Aplicacao sanitaria confirmada no servidor. Evento ${eventoId.slice(0, 8)}.`,
          );
          navigate("/home");
          return;
        } catch (rpcError) {
          console.warn(
            "[registrar] rpc sanitario falhou, fallback para fluxo offline",
            rpcError,
          );
        }
      }

      const ops: OperationInput[] = [];
      const createdAnimalIds: string[] = [];

      let linkedEventId: string | null = null;
      let postPartoRedirect:
        | { motherId: string; eventId: string; calfIds: string[] }
        | null = null;

      const targetAnimalIds: Array<string | null> = hasSelectedAnimals
        ? selectedAnimais
        : [null];

      // P3.2 PERF: Fetch all animals in bulk to avoid N+1 queries
      const distinctAnimalIds = Array.from(
        new Set(targetAnimalIds.filter((id): id is string => id !== null)),
      );
      const animalsMap = new Map<string, Animal>();

      if (distinctAnimalIds.length > 0) {
        const animals = await db.state_animais.bulkGet(distinctAnimalIds);
        animals.forEach((animal) => {
          if (animal) animalsMap.set(animal.id, animal);
        });
      }

      if (tipoManejo === "financeiro" && !isFinanceiroSociedade) {
        if (!isDirectFinancialNature(financeiroData.natureza)) {
          showError("Natureza financeira invalida para este fluxo.");
          return;
        }

        const natureza = financeiroData.natureza;
        const selectedAnimalRecords = selectedAnimais
          .map((animalId) => {
            const animal = animalsMap.get(animalId);
            if (!animal) return null;
            return {
              id: animal.id,
              identificacao: animal.identificacao,
              loteId: animal.lote_id ?? selectedLoteIdNormalized,
            };
          })
          .filter(
            (
              animal,
            ): animal is {
              id: string;
              identificacao: string;
              loteId: string | null;
            } => animal !== null,
          );

        const purchaseAnimals =
          natureza === "compra"
            ? compraNovosAnimais.map((draft) => ({
                localId: draft.localId,
                identificacao: draft.identificacao.trim(),
                sexo: draft.sexo,
                dataNascimento: draft.dataNascimento || null,
                pesoKg:
                  financeiroData.modoPeso === "individual"
                    ? parseUserWeight(draft.pesoKg)
                    : null,
              }))
            : selectedAnimalRecords.map((animal, index) => ({
                localId: animal.id,
                identificacao: animal.identificacao,
                sexo: "M" as const,
                dataNascimento: null,
                pesoKg:
                  financeiroData.modoPeso === "individual"
                    ? parseUserWeight(compraNovosAnimais[index]?.pesoKg || "")
                    : null,
              }));

        const built = buildFinancialTransaction({
          fazendaId: fazenda_id,
          natureza,
          occurredAt: now,
          loteId: selectedLoteIdNormalized,
          contraparteId:
            financeiroData.contraparteId !== "none"
              ? financeiroData.contraparteId
              : null,
          sourceTaskId: sourceTaskId || null,
          selectedAnimals: selectedAnimalRecords,
          purchaseAnimals,
          priceMode: financeiroData.modoPreco,
          totalAmount:
            financeiroData.modoPreco === "por_lote"
              ? financeiroValorTotalInformado
              : null,
          unitAmount:
            financeiroData.modoPreco === "por_animal"
              ? financeiroValorUnitario
              : null,
          weightMode: financeiroData.modoPeso,
          lotWeightKg: financeiroPesoLote,
          payload: transitChecklistPayload,
        });

        linkedEventId = built.financialEventId;
        createdAnimalIds.push(...built.createdAnimalIds);
        ops.push(...built.ops);
      } else {
        for (const animalId of targetAnimalIds) {
        const animal = animalId ? animalsMap.get(animalId) : null;
        if (animalId && !animal) continue;
        const targetLoteId = animal?.lote_id ?? selectedLoteIdNormalized;

        let eventInput: EventInput;

        if (tipoManejo === "sanitario") {
          eventInput = {
            dominio: "sanitario",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            tipo: sanitarioData.tipo,
            produto: sanitaryProductName,
            protocoloItem: protocoloItem
              ? {
                  id: protocoloItem.id,
                  intervalDays: protocoloItem.intervalo_dias,
                  doseNum: protocoloItem.dose_num,
                  geraAgenda: protocoloItem.gera_agenda,
                }
              : undefined,
            produtoRef: sanitaryProductSelection ?? undefined,
            payload: sanitaryProductMetadata,
          };
        } else if (tipoManejo === "pesagem") {
          eventInput = {
            dominio: "pesagem",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            pesoKg: parseUserWeight(animalId ? pesagemData[animalId] || "" : ""),
          };
        } else if (tipoManejo === "movimentacao") {
          eventInput = {
            dominio: "movimentacao",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            fromLoteId: targetLoteId,
            toLoteId: movimentacaoData.toLoteId || null,
            payload: transitChecklistPayload,
          };
        } else if (tipoManejo === "nutricao") {
          eventInput = {
            dominio: "nutricao",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            alimentoNome: nutricaoData.alimentoNome,
            quantidadeKg: parseNumeric(nutricaoData.quantidadeKg),
          };
        } else if (tipoManejo === "financeiro") {
          const natureza = financeiroData.natureza;
          const financialAnimalId =
            animalId ??
            (natureza === "compra" && selectedLoteId === SEM_LOTE_OPTION
              ? createdAnimalIds[0] ?? null
              : null);
          const payloadFinanceiro =
            natureza === "sociedade_entrada"
              ? { kind: "sociedade_entrada", origem: "registrar_manejo" }
              : natureza === "sociedade_saida"
                ? { kind: "sociedade_saida", origem: "registrar_manejo" }
                : natureza === "venda"
                  ? { kind: "venda_animal", origem: "registrar_manejo" }
                  : animalId
                    ? { kind: "compra_animal", origem: "registrar_manejo" }
                    : createdAnimalIds.length > 0
                      ? {
                          kind: "compra_lote_com_animais",
                          origem: "registrar_manejo",
                          animal_ids: createdAnimalIds,
                          animais_cadastrados: createdAnimalIds.length,
                        }
                      : { kind: "compra_lote", origem: "registrar_manejo" };

          eventInput = {
            dominio: "financeiro",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: financialAnimalId,
            loteId: targetLoteId,
            tipo: financeiroTipo,
            valorTotal: parseNumeric(financeiroData.valorTotal),
            contraparteId:
              financeiroData.contraparteId !== "none"
                ? financeiroData.contraparteId
                : null,
            applyAnimalStateUpdate:
              natureza === "venda" && Boolean(animalId),
            clearAnimalLoteOnSale:
              natureza === "venda" && Boolean(animalId),
            payload: {
              ...payloadFinanceiro,
              ...transitChecklistPayload,
            },
          };
        } else if (tipoManejo === "reproducao" && animalId && animal) {
          const categoriaLabel = deriveAnimalTaxonomy(animal, {
            config: farmLifecycleConfig,
          }).display.categoria;

          if (!isFemaleReproductionEligible(animal, categoriaLabel)) {
            showError(
              `Reproducao disponivel apenas para novilhas e vacas. ${animal.identificacao} esta como ${categoriaLabel ?? "categoria nao elegivel"}.`,
            );
            return;
          }

          const built = await prepareReproductionGesture({
            fazendaId: fazenda_id,
            animalId,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalIdentificacao: animal.identificacao,
            loteId: targetLoteId,
            data: reproducaoData,
          });

          if (!linkedEventId) {
            linkedEventId = built.eventId;
          }
          if (reproducaoData.tipo === "parto" && built.calfIds.length > 0) {
            postPartoRedirect = {
              motherId: animalId,
              eventId: built.eventId,
              calfIds: built.calfIds,
            };
          }
          ops.push(...built.ops);
          continue;
        } else if (tipoManejo === "reproducao") {
          // Block orphan parto if validation failed or user selected 'unlinked'
          // Actually, we should check if we found a candidate if mode is auto.
          // But strict server rules say: REJECT if parto is unlinked.
          if (reproducaoData.tipo === "parto") {
             if (reproducaoData.episodeLinkMethod === 'unlinked') {
                showError("Parto exige vínculo com evento anterior (Cobertura/IA). Selecione um episódio.");
                return;
             }
             // If manual and no ID
             if (reproducaoData.episodeLinkMethod === 'manual' && !reproducaoData.episodeEventoId) {
                showError("Selecione o evento de serviço para vincular o parto.");
                return;
             }
          }

          if (
             (reproducaoData.tipo === "cobertura" || reproducaoData.tipo === "IA") &&
             !reproducaoData.machoId
          ) {
             showError("Macho e obrigatorio para Cobertura/IA.");
             return;
          }

          eventInput = {
            dominio: "reproducao",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            tipo: reproducaoData.tipo,
            machoId: reproducaoData.machoId,
            observacoes: reproducaoData.observacoes,
            payloadData: {
              schema_version: 1,
              // Linking
              episode_evento_id: reproducaoData.episodeEventoId || undefined,
              episode_link_method: reproducaoData.episodeLinkMethod || undefined,
              
              // Fields
              tecnica_livre: reproducaoData.tecnicaLivre,
              reprodutor_tag: reproducaoData.reprodutorTag,
              resultado: reproducaoData.resultadoDiagnostico, // v1 uses 'resultado'
              data_prevista_parto: reproducaoData.dataPrevistaParto,
              data_parto_real: reproducaoData.dataParto, // v1 uses data_parto_real
              numero_crias: reproducaoData.numeroCrias,
              
              // Legacy support (optional, but keep it clean if v1 is enough)
              // diagnostico_resultado: reproducaoData.resultadoDiagnostico, 
            },
          };
        } else {
           continue; 
        }

        const built = buildEventGesture(eventInput);
        if (!linkedEventId) {
          linkedEventId = built.eventId;
        }
        ops.push(...built.ops);
      }
      }

      if (sourceTaskId && linkedEventId) {
        ops.push({
          table: "agenda_itens",
          action: "UPDATE",
          record: {
            id: sourceTaskId,
            status: "concluido",
            source_evento_id: linkedEventId,
          },
        });
      }

      if (ops.length === 0) {
        showError("Nenhuma operacao valida para envio.");
        return;
      }

      const txId = await createGesture(fazenda_id, ops);
      if (compraGerandoAnimais) {
        showSuccess(
          `Compra salva neste aparelho com ${createdAnimalIds.length} novo(s) animal(is). Sincronizacao pendente. TX ${txId.slice(0, 8)}.`,
        );
      } else {
        showSuccess(
          `Manejo salvo neste aparelho. Sincronizacao pendente. TX ${txId.slice(0, 8)}.`,
        );
      }

      if (postPartoRedirect) {
        const nextParams = new URLSearchParams();
        nextParams.set("eventoId", postPartoRedirect.eventId);
        postPartoRedirect.calfIds.forEach((calfId) =>
          nextParams.append("cria", calfId),
        );
        navigate(
          `/animais/${postPartoRedirect.motherId}/pos-parto?${nextParams.toString()}`,
        );
        return;
      }

      navigate("/home");
    } catch (e: unknown) {
      if (e instanceof EventValidationError) {
        showError(e.issues[0]?.message ?? "Dados invalidos para o evento.");
        return;
      }
      showError("Erro ao registrar manejo.");
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
        <Card>
          <CardHeader>
            <CardTitle>1. Selecionar Alvo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Manejos mais usados</p>
                  <p className="text-sm text-muted-foreground">
                    Escolha um atalho e depois selecione o lote e os animais.
                  </p>
                </div>
                {quickAction && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickAction(null)}
                  >
                    Limpar atalho
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Button
                      key={action.key}
                      type="button"
                      variant={quickAction === action.key ? "default" : "outline"}
                      className="h-auto flex-col items-start gap-2 p-4 text-left"
                      onClick={() => applyQuickAction(action.key)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-semibold">{action.label}</span>
                      </div>
                      <span className="whitespace-normal text-xs opacity-80">
                        {action.helper}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lote</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedLoteId(value);
                  setSelectedAnimais([]);
                }}
                value={selectedLoteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_LOTE_OPTION}>Sem lote</SelectItem>
                  {lotes?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLoteId && (
              <>
                <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {selectedAnimais.length} animal(is) selecionado(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Filtre por identificacao, nome, RFID ou sexo para reduzir erro de selecao.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          filteredAnimaisNoLote.length === 0 ||
                          selectedVisibleCount === filteredAnimaisNoLote.length
                        }
                        onClick={() =>
                          setSelectedAnimais((prev) =>
                            Array.from(new Set([...prev, ...visibleAnimalIds])),
                          )
                        }
                      >
                        Selecionar visiveis
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={selectedAnimais.length === 0}
                        onClick={() => setSelectedAnimais([])}
                      >
                        Limpar selecao
                      </Button>
                    </div>
                    </div>

                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={animalSearch}
                      onChange={(event) => setAnimalSearch(event.target.value)}
                      placeholder="Buscar animal neste lote"
                      aria-label="Buscar animal no lote selecionado"
                    />
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {filteredAnimaisNoLote.map((a) => (
                    <label
                      key={a.id}
                      htmlFor={`registrar-animal-${a.id}`}
                      className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/35"
                    >
                      <Checkbox
                        id={`registrar-animal-${a.id}`}
                        aria-label={`Selecionar animal ${a.identificacao}`}
                        checked={selectedAnimais.includes(a.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAnimais((prev) =>
                            checked
                              ? [...prev, a.id]
                              : prev.filter((id) => id !== a.id),
                          );
                        }}
                      />
                      <span className="font-medium">{a.identificacao}</span>
                      <span className="text-xs text-muted-foreground">
                      {a.sexo === "M" ? "Macho" : "Fêmea"}
                    </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {selectedLoteId && (animaisNoLote?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedLoteId === SEM_LOTE_OPTION
                  ? "Nao ha animais sem lote cadastrados."
                  : "Este lote ainda nao possui animais. Voce pode registrar compra ou sociedade por lote."}
              </p>
            )}

            {selectedLoteId &&
            (animaisNoLote?.length ?? 0) > 0 &&
            filteredAnimaisNoLote.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum animal encontrado com este filtro.
              </p>
            ) : null}

            {requiresAnimalsForQuickAction ? (
              <p className="text-sm text-amber-700">
                Esta acao exige ao menos um animal selecionado antes de continuar.
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={!selectedLoteId || requiresAnimalsForQuickAction}
              onClick={() => setStep(RegistrationStep.CHOOSE_ACTION)}
            >
              {quickActionConfig ? `Continuar para ${quickActionConfig.label}` : "Próximo"}{" "}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
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
              <div className="grid gap-3 md:grid-cols-3">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const disabled =
                    action.requiresAnimals === true && selectedAnimais.length === 0;

                  return (
                    <Button
                      key={action.key}
                      type="button"
                      variant={quickAction === action.key ? "default" : "outline"}
                      className="h-auto flex-col items-start gap-2 p-4 text-left"
                      disabled={disabled}
                      onClick={() => applyQuickAction(action.key)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-semibold">{action.label}</span>
                      </div>
                      <span className="whitespace-normal text-xs opacity-80">
                        {action.helper}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Todos os registros</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Button
                variant={tipoManejo === "sanitario" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => selectRegularAction("sanitario")}
              >
                <Syringe className="h-6 w-6" /> Sanitário
              </Button>
              <Button
                variant={tipoManejo === "pesagem" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => selectRegularAction("pesagem")}
              >
                <Scale className="h-6 w-6" /> Pesagem
              </Button>
              <Button
                variant={tipoManejo === "movimentacao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => selectRegularAction("movimentacao")}
              >
                <Move className="h-6 w-6" /> Mover
              </Button>
              <Button
                variant={tipoManejo === "nutricao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => selectRegularAction("nutricao")}
              >
                <Scale className="h-6 w-6" /> Nutricao
              </Button>
              <Button
                variant={tipoManejo === "financeiro" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => selectRegularAction("financeiro")}
              >
                <Move className="h-6 w-6" /> Financeiro
              </Button>
              <Button
                variant={tipoManejo === "reproducao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => selectRegularAction("reproducao")}
                disabled={selectedAnimais.length === 0}
              >
                <div className="h-6 w-6 rounded-full border-2 border-current" /> Reprodução
              </Button>
            </div>
            </div>

            {selectedAnimais.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem animais selecionados: use Financeiro para compra/sociedade
                por lote. Venda exige selecao de animal.
              </p>
            )}

            {tipoManejo === "sanitario" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    onValueChange={(v) =>
                      setSanitarioData((d) => ({
                        ...d,
                        tipo: v as SanitarioTipoEnum,
                      }))
                    }
                    value={sanitarioData.tipo}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacinacao">Vacinação</SelectItem>
                      <SelectItem value="vermifugacao">Vermifugação</SelectItem>
                      <SelectItem value="medicamento">Medicamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Input
                    className={cn(
                      sanitatioProductMissing && "border-destructive focus-visible:ring-destructive/30",
                    )}
                    placeholder="Digite o nome ou use uma sugestao do catalogo"
                    value={sanitarioData.produto}
                    onChange={(e) =>
                      setSanitarioData((d) => ({
                        ...d,
                        produto: e.target.value,
                      }))
                    }
                  />
                  {sanitatioProductMissing ? (
                    <p className="text-xs text-destructive">
                      Informe o produto ou selecione um item de protocolo antes de continuar.
                    </p>
                  ) : selectedVeterinaryProduct ? (
                    <p className="text-xs text-muted-foreground">
                      Catalogo vinculado: {selectedVeterinaryProduct.nome}
                      {selectedVeterinaryProduct.categoria
                        ? ` | ${selectedVeterinaryProduct.categoria}`
                        : ""}
                    </p>
                  ) : sanitarioData.produto.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      Texto livre: o evento sera salvo sem vinculo direto ao catalogo.
                    </p>
                  ) : veterinaryProducts && veterinaryProducts.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sugestoes do catalogo aparecem abaixo para acelerar o registro.
                    </p>
                  ) : null}

                  {veterinaryProductSuggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {veterinaryProductSuggestions.map((product) => {
                        const isSelected = product.id === selectedVeterinaryProductId;
                        return (
                          <Button
                            key={product.id}
                            type="button"
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            className="h-auto min-h-9 px-3 py-2 text-left"
                            onClick={() => selectVeterinaryProduct(product)}
                          >
                            <span>{product.nome}</span>
                            {product.categoria ? (
                              <Badge
                                variant="secondary"
                                className="ml-2 whitespace-nowrap"
                              >
                                {product.categoria}
                              </Badge>
                            ) : null}
                          </Button>
                        );
                      })}
                    </div>
                  ) : veterinaryProducts && veterinaryProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Catalogo veterinario indisponivel offline neste aparelho.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Protocolo (opcional)</Label>
                  <Select
                    onValueChange={(value) =>
                      setProtocoloId(value === "none" ? "" : value)
                    }
                    value={protocoloId || "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem protocolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem protocolo</SelectItem>
                      {protocolos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {protocoloId && protocoloItens && protocoloItens.length > 0 && (
                  <div className="space-y-2">
                    <Label>Item do Protocolo</Label>
                    <Select
                      onValueChange={setProtocoloItemId}
                      value={protocoloItemId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o item" />
                      </SelectTrigger>
                      <SelectContent>
                        {protocoloItensEvaluated.map(({ item, eligibility }) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            disabled={!eligibility.compatibleWithAll}
                          >
                            Dose {item.dose_num} |{" "}
                            {describeSanitaryCalendarSchedule({
                              intervalDays: item.intervalo_dias,
                              geraAgenda: item.gera_agenda,
                              payload: item.payload,
                            })}
                            {selectedAnimaisDetalhes.length > 0
                              ? ` | ${eligibility.eligibleCount}/${selectedAnimaisDetalhes.length} aptos`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProtocoloItemEvaluation ? (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {formatSanitaryProtocolRestrictions(
                          selectedProtocoloItemEvaluation.eligibility.restrictions,
                        ) ? (
                          <p>
                            Regras:{" "}
                            {
                              formatSanitaryProtocolRestrictions(
                                selectedProtocoloItemEvaluation.eligibility.restrictions,
                              )
                            }
                          </p>
                        ) : null}
                        {!selectedProtocoloItemEvaluation.eligibility.compatibleWithAll ? (
                          <p className="text-destructive">
                            {selectedProtocoloItemEvaluation.eligibility.reasons[0]}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {protocoloItensEvaluated.length > 0 &&
                    protocoloItensEvaluated.every(
                      ({ eligibility }) => !eligibility.compatibleWithAll,
                    ) ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum item deste protocolo atende todos os animais
                        selecionados. Ajuste a selecao ou troque o protocolo.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {tipoManejo === "pesagem" && (
              <div className="space-y-4 border-t pt-4 max-h-64 overflow-y-auto">
                {selectedAnimais.map((id) => {
                  const animal = animaisNoLote?.find((a) => a.id === id);
                  const isInvalid = pesagemAnimaisInvalidos.includes(id);
                  return (
                    <div
                      key={id}
                      className="flex items-start justify-between gap-4"
                    >
                      <Label className="w-24 pt-2">{animal?.identificacao}</Label>
                      <div className="flex-1 space-y-1">
                        <Input
                          className={cn(
                            isInvalid && "border-destructive focus-visible:ring-destructive/30",
                          )}
                          type="number"
                          step={getWeightInputStep(farmMeasurementConfig.weight_unit)}
                          placeholder={`Peso (${getWeightUnitLabel(
                            farmMeasurementConfig.weight_unit,
                          )})`}
                          value={pesagemData[id] || ""}
                          onChange={(e) =>
                            setPesagemData((prev) => ({
                              ...prev,
                              [id]: e.target.value,
                            }))
                          }
                        />
                        {isInvalid ? (
                          <p className="text-xs text-destructive">
                            Peso deve ser maior que zero.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tipoManejo === "movimentacao" && (
              <div className="space-y-4 border-t pt-4">
                <Label>Lote Destino</Label>
                <Select
                  onValueChange={(v) => setMovimentacaoData({ toLoteId: v })}
                  value={movimentacaoData.toLoteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes
                      ?.filter((l) => l.id !== selectedLoteIdNormalized)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {movimentacaoSemDestino ? (
                  <p className="text-xs text-destructive">
                    Selecione o lote de destino antes de continuar.
                  </p>
                ) : null}
                {movimentacaoDestinoIgualOrigem ? (
                  <p className="text-xs text-destructive">
                    Origem e destino devem ser diferentes.
                  </p>
                ) : null}
                {transitChecklistSection}
                {sanitaryMovementBlockSection}
                {movementComplianceBlockSection}
              </div>
            )}

            {tipoManejo === "nutricao" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Alimento</Label>
                  <Input
                    className={cn(
                      nutricaoAlimentoMissing &&
                        "border-destructive focus-visible:ring-destructive/30",
                    )}
                    value={nutricaoData.alimentoNome}
                    onChange={(e) =>
                      setNutricaoData((prev) => ({
                        ...prev,
                        alimentoNome: e.target.value,
                      }))
                    }
                    placeholder="Ex.: racao proteica"
                  />
                  {nutricaoAlimentoMissing ? (
                    <p className="text-xs text-destructive">
                      Informe o alimento usado neste manejo.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Quantidade (kg)</Label>
                  <Input
                    className={cn(
                      nutricaoQuantidadeInvalida &&
                        "border-destructive focus-visible:ring-destructive/30",
                    )}
                    type="number"
                    step="0.001"
                    value={nutricaoData.quantidadeKg}
                    onChange={(e) =>
                      setNutricaoData((prev) => ({
                        ...prev,
                        quantidadeKg: e.target.value,
                      }))
                    }
                  />
                  {nutricaoQuantidadeInvalida ? (
                    <p className="text-xs text-destructive">
                      Quantidade deve ser maior que zero.
                    </p>
                  ) : null}
                </div>
                {nutritionComplianceBlockSection}
              </div>
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
                <div className="space-y-2">
                  <Label>
                    Contraparte{" "}
                    {isFinanceiroSociedade ? "(obrigatoria em sociedade)" : "(opcional)"}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setFinanceiroData((prev) => ({
                        ...prev,
                        contraparteId: value,
                      }))
                    }
                    value={financeiroData.contraparteId}
                  >
                    <SelectTrigger
                      className={cn(
                        isFinanceiroSociedade &&
                          financeiroData.contraparteId === "none" &&
                          "border-destructive focus:ring-destructive/30",
                      )}
                    >
                      <SelectValue placeholder="Sem contraparte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem contraparte</SelectItem>
                      {contrapartes?.map((contraparte) => (
                        <SelectItem key={contraparte.id} value={contraparte.id}>
                          {contraparte.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isFinanceiroSociedade &&
                  financeiroData.contraparteId === "none" ? (
                    <p className="text-xs text-destructive">
                      Eventos de sociedade exigem uma contraparte vinculada.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNovaContraparte((prev) => !prev)}
                    disabled={!canManageContraparte}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {showNovaContraparte ? "Fechar cadastro" : "Nova contraparte"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/contrapartes")}
                  >
                    <Handshake className="mr-2 h-4 w-4" />
                    Gerenciar parceiros
                  </Button>
                </div>
                {!canManageContraparte && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Sua role pode registrar o evento, mas nao pode criar nova contraparte.
                    Use uma contraparte existente ou encaminhe o cadastro para owner/manager.
                  </div>
                )}

                {showNovaContraparte && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo da contraparte</Label>
                        <Select
                          value={novaContraparte.tipo}
                          onValueChange={(value) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              tipo: value as "pessoa" | "empresa",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pessoa">Pessoa</SelectItem>
                            <SelectItem value="empresa">Empresa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={novaContraparte.nome}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              nome: e.target.value,
                            }))
                          }
                          placeholder="Nome da contraparte"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Documento</Label>
                        <Input
                          value={novaContraparte.documento}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              documento: e.target.value,
                            }))
                          }
                          placeholder="CPF/CNPJ"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={novaContraparte.telefone}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              telefone: e.target.value,
                            }))
                          }
                          placeholder="Telefone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={novaContraparte.email}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Endereco</Label>
                        <Input
                          value={novaContraparte.endereco}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              endereco: e.target.value,
                            }))
                          }
                          placeholder="Cidade/UF"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleCreateContraparte}
                      disabled={isSavingContraparte || !canManageContraparte}
                    >
                      {isSavingContraparte ? "Salvando..." : "Salvar contraparte"}
                    </Button>
                  </div>
                )}

                {selectedAnimais.length === 0 &&
                  financeiroData.natureza === "compra" &&
                  !isFinanceiroSociedade && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div>
                        <Label>Animais gerados pela compra</Label>
                        <p className="text-xs text-muted-foreground">
                          Identificacao pode ficar vazia. O sistema gera automaticamente.
                        </p>
                      </div>

                      {compraNovosAnimais.map((draft, index) => (
                        <div
                          key={draft.localId}
                          className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-[1.2fr_140px_170px_140px]"
                        >
                          <Input
                            value={draft.identificacao}
                            onChange={(e) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? { ...item, identificacao: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder={`Identificacao do animal ${index + 1}`}
                          />
                          <Select
                            value={draft.sexo}
                            onValueChange={(value) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? { ...item, sexo: value as "M" | "F" }
                                    : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="F">Femea</SelectItem>
                              <SelectItem value="M">Macho</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={draft.dataNascimento}
                            onChange={(e) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? { ...item, dataNascimento: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <Input
                            type="number"
                            step={getWeightInputStep(farmMeasurementConfig.weight_unit)}
                            value={draft.pesoKg}
                            disabled={financeiroData.modoPeso !== "individual"}
                            onChange={(e) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? { ...item, pesoKg: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder={`Peso ${getWeightUnitLabel(
                              farmMeasurementConfig.weight_unit,
                            )}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                {selectedAnimais.length > 0 &&
                  financeiroData.natureza === "venda" &&
                  financeiroData.modoPeso === "individual" &&
                  !isFinanceiroSociedade && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div>
                        <Label>Pesos individuais da venda</Label>
                        <p className="text-xs text-muted-foreground">
                          Esses pesos geram pesagens no mesmo gesto da saida.
                        </p>
                      </div>

                      {selectedAnimais.map((animalId, index) => {
                        const animal = animaisNoLote?.find((item) => item.id === animalId);
                        const currentDraft = compraNovosAnimais[index];

                        return (
                          <div
                            key={animalId}
                            className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-[1fr_180px]"
                          >
                            <div className="flex items-center text-sm font-medium">
                              {animal?.identificacao ?? animalId}
                            </div>
                            <Input
                              type="number"
                              step={getWeightInputStep(farmMeasurementConfig.weight_unit)}
                              value={currentDraft?.pesoKg ?? ""}
                              onChange={(e) =>
                                setCompraNovosAnimais((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, pesoKg: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Peso ${getWeightUnitLabel(
                                farmMeasurementConfig.weight_unit,
                              )}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                {transitChecklistSection}
                {sanitaryMovementBlockSection}
                {movementComplianceBlockSection}
              </div>

            )}

            {tipoManejo === "reproducao" && (
                <div className="space-y-4 border-t pt-4">
                  {partoRequiresSingleMatrix && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Para gerar a cria e vincular mae e pai com seguranca, registre
                      o parto de uma matriz por vez.
                    </div>
                  )}
                  <ReproductionForm
                    fazendaId={activeFarmId ?? ""}
                    animalId={selectedAnimais[0]}
                    data={reproducaoData}
                    onChange={setReproducaoData}
                  />
                </div>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manejo:</span>
                <span className="font-bold capitalize">
                  {quickActionConfig?.label ?? tipoManejo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animais:</span>
                <span className="font-bold">{selectedAnimais.length}</span>
              </div>
              {selectedAnimais.length === 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alvo (lote):</span>
                  <span className="font-bold">{selectedLoteLabel}</span>
                </div>
              )}
              {tipoManejo === "movimentacao" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="font-bold">
                    {
                      lotes?.find((l) => l.id === movimentacaoData.toLoteId)
                        ?.nome
                    }
                  </span>
                </div>
              )}
              {transitChecklist.enabled ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transito externo:</span>
                    <span className="font-bold">Sim</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Finalidade:</span>
                    <span className="font-bold capitalize">
                      {transitChecklist.purpose.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GTA/e-GTA:</span>
                    <span className="font-bold">
                      {transitChecklist.gtaNumber || "Checklist concluido"}
                    </span>
                  </div>
                  {transitChecklist.isInterstate ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Destino UF:</span>
                      <span className="font-bold">
                        {transitChecklist.destinationUf ?? "-"}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
              {tipoManejo === "nutricao" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alimento:</span>
                  <span className="font-bold">{nutricaoData.alimentoNome}</span>
                </div>
              )}
              {tipoManejo === "financeiro" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Natureza:</span>
                    <span className="font-bold capitalize">
                      {financeiroData.natureza.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contraparte:</span>
                    <span className="font-bold">{contraparteSelecionadaNome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-bold">
                      {Number.isFinite(financeiroValorTotalCalculado)
                        ? financeiroValorTotalCalculado.toFixed(2)
                        : "-"}
                    </span>
                  </div>
                  {!isFinanceiroSociedade && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantidade:</span>
                        <span className="font-bold">{financeiroQuantidadeAnimais}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Preco:</span>
                        <span className="font-bold">
                          {financeiroData.modoPreco === "por_animal"
                            ? "Por animal"
                            : "Por lote"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peso:</span>
                        <span className="font-bold">
                          {financeiroData.modoPeso === "nenhum"
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
                              : "Individual"}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
              {tipoManejo === "financeiro" &&
                financeiroData.natureza === "compra" &&
                selectedAnimais.length === 0 &&
                !isFinanceiroSociedade && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Animais gerados:</span>
                    <span className="font-bold">{compraNovosAnimais.length}</span>
                  </div>

                )}
              {tipoManejo === "reproducao" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-bold capitalize">{reproducaoData.tipo}</span>
                  </div>
                  {reproducaoData.tipo === "parto" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Crias geradas:</span>
                      <span className="font-bold">
                        {Math.max(
                          1,
                          reproducaoData.numeroCrias ??
                            reproducaoData.crias?.length ??
                            1,
                        )}
                      </span>
                    </div>
                  )}
                  {reproducaoData.machoId && (
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Reprodutor:</span>
                        <BullNameDisplay machoId={reproducaoData.machoId} />
                     </div>
                  )}
                  {reproducaoData.observacoes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Obs:</span>
                      <span className="font-bold truncate max-w-[150px]">{reproducaoData.observacoes}</span>
                    </div>
                  )}
                </>
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
