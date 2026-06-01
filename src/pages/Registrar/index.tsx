import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReproTipoEnum, Animal, SanitarioCaso, Insumo, InsumoLote } from "@/lib/offline/types";
import { RegistrarInventorySection } from "@/pages/Registrar/components/RegistrarInventorySection";
import { RegistrarComercialSection, type ComercialFormData } from "@/pages/Registrar/components/RegistrarComercialSection";
import { calculateCommercialOperation } from "@/lib/comercial/commercialOperation";
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
  Info,
  MapPin,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { parseWeightInput } from "@/lib/format/weight";
import { cn } from "@/lib/utils";
import {
  buildBiosecurityOccurrenceEventInput,
} from "@/lib/sanitario/compliance/biosecurityOccurrence";
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
import { RegistrarEccSection } from "@/pages/Registrar/components/RegistrarEccSection";
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
import { resolveSanitaryDefaultDose } from "@/lib/inventory/sanitaryDefaults";
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
import { RegistrarContextSummary } from "@/pages/Registrar/components/RegistrarContextSummary";
import { RegistrarStickyActionBar } from "@/pages/Registrar/components/RegistrarStickyActionBar";
import { RegistrarStepIndicator } from "@/pages/Registrar/components/RegistrarStepIndicator";

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
  const [isRegisteringBiosecurityOccurrence, setIsRegisteringBiosecurityOccurrence] =
    useState(false);
  const [comercialData, setComercialData] = useState<ComercialFormData>({
    operationType: "compra",
    scope: "lote",
    occurredAt: new Date().toISOString().split("T")[0],
    quantidadeAnimais: "",
    pesoVivoTotal: "",
    valorBruto: "",
    frete: "",
    comissao: "",
    descontos: "",
    taxasImpostos: "",
    contraparteId: "none",
    financeTransactionId: "none",
    observacoes: "",
    pesosPorAnimal: {},
    valoresPorAnimal: {},
  });
  const [contextAnimalId, setContextAnimalId] = useState("");
  const [contextLoteId, setContextLoteId] = useState("");
  const [contextPastoId, setContextPastoId] = useState("");
  const [sanitarioCasoId, setSanitarioCasoId] = useState("");
  const [abrirCasoClinico, setAbrirCasoClinico] = useState(false);
  const [clinicalProtocolRef, setClinicalProtocolRef] = useState<{
    protocolId: string | null;
    itemId: string | null;
  }>({ protocolId: null, itemId: null });
  const [showTechDetails, setShowTechDetails] = useState(false);
  // Estados para Baixa Automática de Insumos/Estoque
  const [gerarBaixaEstoque, setGerarBaixaEstoque] = useState(false);
  const [selectedInsumoId, setSelectedInsumoId] = useState("");
  const [selectedInsumoLoteId, setSelectedInsumoLoteId] = useState("");
  const [quantidadeConsumida, setQuantidadeConsumida] = useState("");
  const [doseSanitaria, setDoseSanitaria] = useState(resolveSanitaryDefaultDose);
  const [doseUnidadeSanitaria, setDoseUnidadeSanitaria] = useState("dose");
  const [viaAplicacaoSanitaria, setViaAplicacaoSanitaria] = useState("");
  const [insumoRef, setInsumoRef] = useState<Insumo | null>(null);
  const [loteRef, setLoteRef] = useState<InsumoLote | null>(null);

  // Resetar estados de estoque ao mudar tipoManejo (movido abaixo para evitar TDZ)

  const { user, activeFarmId, role, farmMeasurementConfig, farmLifecycleConfig } =
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
    eccData,
    setEccData,
    eccObservacoes,
    setEccObservacoes,
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

  // Resetar estados de estoque ao mudar tipoManejo
  useEffect(() => {
    setGerarBaixaEstoque(false);
    setSelectedInsumoId("");
    setSelectedInsumoLoteId("");
    setQuantidadeConsumida("");
    setDoseSanitaria(resolveSanitaryDefaultDose());
    setDoseUnidadeSanitaria("dose");
    setViaAplicacaoSanitaria("");
    setInsumoRef(null);
    setLoteRef(null);
  }, [
    tipoManejo,
    setGerarBaixaEstoque,
    setSelectedInsumoId,
    setSelectedInsumoLoteId,
    setQuantidadeConsumida,
    setDoseSanitaria,
    setDoseUnidadeSanitaria,
    setViaAplicacaoSanitaria,
    setInsumoRef,
    setLoteRef,
  ]);

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
  const selectedLoteForBiosecurity =
    selectedLoteIdNormalized && selectedLoteIdNormalized !== SEM_LOTE_OPTION
      ? (lotes?.find((lote) => lote.id === selectedLoteIdNormalized) ?? null)
      : null;
  const pesagemAnimaisInvalidos = selectedAnimais.filter((id) => {
    const weightStr = pesagemData[id];
    if (!weightStr || weightStr.trim() === "") return true;
    const weight = parseUserWeight(weightStr);
    return weight === null || weight <= 0;
  });
  const isSingleAnimal = selectedAnimais.length === 1;
  const validateLocalEccValue = (valStr: string) => {
    if (!valStr || valStr.trim() === "") return { isValid: true, isEmpty: true };
    const num = Number(valStr);
    if (isNaN(num) || num < 1.0 || num > 5.0) {
      return { isValid: false, isEmpty: false };
    }
    const diff = (num - 1.0) / 0.25;
    const stepDiff = Math.abs(diff - Math.round(diff));
    return { isValid: stepDiff <= 1e-9, isEmpty: false };
  };
  const eccAnimaisInvalidos = selectedAnimais.filter((id) => {
    const val = eccData[id] || "";
    const { isValid, isEmpty } = validateLocalEccValue(val);
    if (isSingleAnimal) {
      return isEmpty || !isValid;
    } else {
      return !isEmpty && !isValid;
    }
  });
  const hasAtLeastOneValidEcc = selectedAnimais.some((id) => {
    const val = eccData[id] || "";
    const { isValid, isEmpty } = validateLocalEccValue(val);
    return !isEmpty && isValid;
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
  const activeClinicalCases = useLiveQuery(async () => {
    if (!activeFarmId || tipoManejo !== "sanitario" || selectedAnimais.length !== 1) {
      return [] as SanitarioCaso[];
    }

    const animalId = selectedAnimais[0];
    const cases = await db.state_sanitario_casos
      .where("[fazenda_id+animal_id]")
      .equals([activeFarmId, animalId])
      .toArray();

    return cases
      .filter(
        (item) =>
          item.tipo === "clinico" &&
          (item.status === "aberto" || item.status === "em_acompanhamento") &&
          !item.deleted_at,
      )
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  }, [activeFarmId, selectedAnimais, tipoManejo]);
  const clinicalCaseOptions = useMemo(
    () =>
      (activeClinicalCases ?? []).map((item) => ({
        id: item.id,
        label:
          item.disease_name ||
          item.observacoes ||
          `Caso ${item.id.slice(0, 8)}`,
      })),
    [activeClinicalCases],
  );
  // Pre-fill previous ECC for selected animals to ease field recording
  const lastEccsForSelected = useLiveQuery(async () => {
    if (tipoManejo !== "ecc" || selectedAnimais.length === 0) {
      return {} as Record<string, number>;
    }
    const events = await db.event_eventos
      .where("animal_id")
      .anyOf(selectedAnimais)
      .toArray();
    const activeEvents = events.filter((e) => !e.deleted_at && e.dominio === "ecc");
    if (activeEvents.length === 0) return {} as Record<string, number>;

    const eventIds = activeEvents.map((e) => e.id);
    const eccDetails = await db.event_eventos_ecc
      .where("event_id")
      .anyOf(eventIds)
      .toArray();

    const eccMap = new Map(eccDetails.map((d) => [d.event_id, d.ecc]));
    const latestEccByAnimal: Record<string, number> = {};
    const latestEventByAnimal: Record<string, typeof activeEvents[0]> = {};

    for (const event of activeEvents) {
      const eccVal = eccMap.get(event.id);
      if (eccVal === undefined || eccVal === null) continue;

      const currentLatest = latestEventByAnimal[event.animal_id!];
      if (
        !currentLatest ||
        new Date(event.occurred_at) > new Date(currentLatest.occurred_at)
      ) {
        latestEventByAnimal[event.animal_id!] = event;
        latestEccByAnimal[event.animal_id!] = eccVal;
      }
    }
    return latestEccByAnimal;
  }, [selectedAnimais, tipoManejo]);

  const [eccInitializedIds, setEccInitializedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (tipoManejo === "ecc" && lastEccsForSelected && Object.keys(lastEccsForSelected).length > 0) {
      setEccData((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [animalId, ecc] of Object.entries(lastEccsForSelected)) {
          if (!eccInitializedIds[animalId]) {
            next[animalId] = String(ecc);
            setEccInitializedIds((p) => ({ ...p, [animalId]: true }));
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [tipoManejo, lastEccsForSelected, eccInitializedIds, setEccData]);

  useEffect(() => {
    setEccInitializedIds((prev) => {
      const next = { ...prev };
      let changed = false;
      const selectedSet = new Set(selectedAnimais);
      for (const id of Object.keys(next)) {
        if (!selectedSet.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedAnimais]);

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

  const biosecurityContext = useMemo(() => {
    const animalById = new Map(
      [
        ...selectedAnimaisDetalhes,
        registrarContextRecords?.animal ?? null,
      ]
        .filter((animal): animal is Animal => Boolean(animal))
        .map((animal) => [animal.id, animal]),
    );
    const animalIds = Array.from(
      new Set([
        ...selectedAnimais,
        contextAnimalId || null,
        registrarContextRecords?.agendaItem?.animal_id ?? null,
      ].filter((id): id is string => Boolean(id))),
    );
    const loteFromAgenda = registrarContextRecords?.agendaItem?.lote_id
      ? lotes?.find(
          (lote) => lote.id === registrarContextRecords.agendaItem?.lote_id,
        ) ?? null
      : null;
    const lote =
      selectedLoteForBiosecurity ??
      registrarContextRecords?.lote ??
      loteFromAgenda ??
      null;

    return {
      animals: animalIds.map((id) => {
        const animal = animalById.get(id);
        return {
          id,
          label: animal?.identificacao ?? `Animal ${id.slice(0, 8)}`,
        };
      }),
      lote: lote
        ? {
            id: lote.id,
            label: lote.nome,
          }
        : null,
      localId: contextPastoId || null,
      agendaItemId: sourceTaskId || null,
    };
  }, [
    contextAnimalId,
    contextPastoId,
    lotes,
    registrarContextRecords,
    selectedAnimais,
    selectedAnimaisDetalhes,
    selectedLoteForBiosecurity,
    sourceTaskId,
  ]);

  const contrapartes = useLiveQuery(
    () =>
      loadRegistrarContrapartesEffect({
        activeFarmId: activeFarmId ?? null,
      }),
    [activeFarmId],
  );

  // ---------------------------------------------------------------------------
  // Busca o último peso de cada animal selecionado (usado na seção comercial)
  // ---------------------------------------------------------------------------
  const animaisComPesoComercial = useLiveQuery(async () => {
    if (tipoManejo !== "comercial" || selectedAnimais.length === 0) {
      return [] as Array<{ id: string; identificacao: string; nome: string | null; lastWeightKg: number | null }>;
    }

    // Busca todos os eventos de pesagem dos animais selecionados
    const eventos = await db.event_eventos
      .where("animal_id")
      .anyOf(selectedAnimais)
      .toArray();

    const pesagemEventos = eventos.filter(
      (e) => !e.deleted_at && e.dominio === "pesagem",
    );

    if (pesagemEventos.length === 0) {
      // Retorna animais sem peso
      const animals = await db.state_animais
        .where("id")
        .anyOf(selectedAnimais)
        .toArray();
      return animals.map((a) => ({
        id: a.id,
        identificacao: a.identificacao,
        nome: a.nome,
        lastWeightKg: null,
      }));
    }

    const eventoIds = pesagemEventos.map((e) => e.id);
    const pesagens = await db.event_eventos_pesagem
      .where("evento_id")
      .anyOf(eventoIds)
      .toArray();

    const pesoMap = new Map(pesagens.map((p) => [p.evento_id, p.peso_kg]));

    // Para cada animal, encontra o evento de pesagem mais recente
    const latestPesoByAnimal: Record<string, number> = {};
    const latestEventByAnimal: Record<string, typeof pesagemEventos[0]> = {};

    for (const evento of pesagemEventos) {
      const pesoKg = pesoMap.get(evento.id);
      if (pesoKg === undefined || pesoKg === null) continue;

      const animalId = evento.animal_id!;
      const current = latestEventByAnimal[animalId];
      if (
        !current ||
        new Date(evento.occurred_at) > new Date(current.occurred_at)
      ) {
        latestEventByAnimal[animalId] = evento;
        latestPesoByAnimal[animalId] = pesoKg;
      }
    }

    const animals = await db.state_animais
      .where("id")
      .anyOf(selectedAnimais)
      .toArray();

    return animals.map((a) => ({
      id: a.id,
      identificacao: a.identificacao,
      nome: a.nome,
      lastWeightKg: latestPesoByAnimal[a.id] ?? null,
    }));
  }, [tipoManejo, selectedAnimais]);

  const financeTransactions = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_finance_transactions
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray();
  }, [activeFarmId]);

  const comercialCalculationSummary = useMemo(() => {
    if (tipoManejo !== "comercial") return null;

    if (comercialData.operationType === "sociedade") {
      return {
        calculationStatus: "complete",
        issues: [],
        limitations: [],
        snapshot: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }

    const qty = selectedAnimais.length > 0 && comercialData.scope === "animal"
      ? selectedAnimais.length
      : (parseInt(comercialData.quantidadeAnimais, 10) || 0);

    const peso = parseFloat(comercialData.pesoVivoTotal) || 0;
    const bruto = parseFloat(comercialData.valorBruto) || 0;
    const frete = parseFloat(comercialData.frete) || 0;
    const comissao = parseFloat(comercialData.comissao) || 0;
    const descontos = parseFloat(comercialData.descontos) || 0;
    const taxas = parseFloat(comercialData.taxasImpostos) || 0;

    const contraparte = contrapartes?.find(c => c.id === comercialData.contraparteId);

    return calculateCommercialOperation({
      operationType: comercialData.operationType,
      scope: comercialData.scope,
      occurredAt: comercialData.occurredAt,
      quantidadeAnimais: qty > 0 ? qty : undefined,
      pesoVivoTotal: comercialData.pesoVivoTotal !== "" ? peso : undefined,
      valorBruto: comercialData.valorBruto !== "" ? bruto : undefined,
      frete: comercialData.frete !== "" ? frete : undefined,
      comissao: comercialData.comissao !== "" ? comissao : undefined,
      descontos: comercialData.descontos !== "" ? descontos : undefined,
      taxasImpostos: comercialData.taxasImpostos !== "" ? taxas : undefined,
      contraparteId: comercialData.contraparteId !== "none" ? comercialData.contraparteId : undefined,
      contraparteNome: contraparte?.nome,
      financeTransactionId: comercialData.financeTransactionId !== "none" ? comercialData.financeTransactionId : undefined,
      animalIds: comercialData.scope === "animal" ? selectedAnimais : undefined,
    });
  }, [tipoManejo, comercialData, selectedAnimais, contrapartes]);

  const comercialBlockingIssues = useMemo(() => {
    if (!comercialCalculationSummary) return [];
    return comercialCalculationSummary.issues
      .filter((i) => i.severity === "blocking")
      .map((i) => i.message);
  }, [comercialCalculationSummary]);

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
  const confirmacaoManejoLabel =
    quickActionConfig?.label ??
    (tipoManejo === "ecc"
      ? "Escore de Condição Corporal (ECC)"
      : tipoManejo === "comercial"
      ? "Operação Comercial"
      : tipoManejo ?? "-");
  const showConfirmacaoAlvoLote = selectedAnimais.length === 0;
  const showConfirmacaoDestinoMovimentacao = tipoManejo === "movimentacao";
  const confirmacaoDestinoMovimentacaoLabel =
    lotes?.find((item) => item.id === movimentacaoData.toLoteId)?.nome ?? "-";
  const showConfirmacaoNutricaoAlimento = tipoManejo === "nutricao";
  const sanitaryInventoryAnimalCount =
    selectedAnimais.length > 0
      ? selectedAnimais.length
      : (animaisNoLote?.length ?? 0);
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
      clinicalCases: clinicalCaseOptions,
      selectedClinicalCaseId: sanitarioCasoId,
      onClinicalCaseChange: (value) => {
        setSanitarioCasoId(value);
        if (value) setAbrirCasoClinico(false);
      },
      createClinicalCase: abrirCasoClinico,
      onCreateClinicalCaseChange: (value) => {
        setAbrirCasoClinico(value);
        if (value) setSanitarioCasoId("");
      },
      biosecurityContext,
      onRegisterBiosecurityOccurrence: async (occurrence) => {
        if (!activeFarmId) {
          showError("Selecione uma fazenda antes de registrar.");
          return;
        }

        setIsRegisteringBiosecurityOccurrence(true);
        try {
          const eventInput = buildBiosecurityOccurrenceEventInput({
            fazendaId: activeFarmId,
            occurredAt: new Date().toISOString(),
            occurrence,
          });
          const built = buildEventGesture(eventInput);
          await runRegistrarFinalizeGestureEffect({
            fazendaId: activeFarmId,
            ops: built.ops,
          });
          showSuccess("Ocorrência registrada.");
        } catch (error) {
          console.error(error);
          showError("Não foi possível registrar a ocorrência.");
          throw error;
        } finally {
          setIsRegisteringBiosecurityOccurrence(false);
        }
      },
      isRegisteringBiosecurityOccurrence,
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
    eccSection: {
      invalidAnimalIds: eccAnimaisInvalidos,
      eccData,
      eccObservacoes,
      onEccChange: (animalId, value) =>
        setEccData((prev) => ({ ...prev, [animalId]: value })),
      onObservacoesChange: (animalId, value) =>
        setEccObservacoes((prev) => ({ ...prev, [animalId]: value })),
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
        eccAnimaisInvalidosCount: eccAnimaisInvalidos.length,
        isSingleAnimal,
        hasAtLeastOneValidEcc,
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
      eccAnimaisInvalidos.length,
      isSingleAnimal,
      hasAtLeastOneValidEcc,
    ],
  );
  const actionStepIssues = useMemo(
    () =>
      composeRegistrarActionStepIssues({
        // comercialBlockingIssues are intentionally excluded here:
        // they should NOT block step 2→3 navigation (the user needs to reach
        // step 3 to fill in the form). They are checked in handleFinalize instead.
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
    if (tipoManejo !== "sanitario") {
      setSanitarioCasoId("");
      setAbrirCasoClinico(false);
      return;
    }

    if (
      sanitarioCasoId &&
      activeClinicalCases !== undefined &&
      !clinicalCaseOptions.some((item) => item.id === sanitarioCasoId)
    ) {
      setSanitarioCasoId("");
    }
  }, [activeClinicalCases, clinicalCaseOptions, sanitarioCasoId, tipoManejo]);

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
    if (parsedQuery.quickAction === "compra" || parsedQuery.quickAction === "venda") {
      setComercialData((prev) => ({
        ...prev,
        operationType: parsedQuery.quickAction as "compra" | "venda",
        scope: parsedQuery.animalId ? "animal" : "lote",
      }));
    }
    if (
      parsedQuery.domain &&
      [
        "sanitario",
        "pesagem",
        "movimentacao",
        "nutricao",
        "financeiro",
        "comercial",
      ].includes(parsedQuery.domain) &&
      parsedQuery.domain !== tipoManejo
    ) {
      setTipoManejo(parsedQuery.domain);
    }
    applySanitaryQueryPrefill(parsedQuery.sanitaryPrefill);
    const nextClinicalProtocolRef = {
      protocolId: parsedQuery.sanitaryPrefill.clinicalProtocolId,
      itemId: parsedQuery.sanitaryPrefill.clinicalProtocolItemId,
    };
    setClinicalProtocolRef((prev) =>
      prev.protocolId === nextClinicalProtocolRef.protocolId &&
      prev.itemId === nextClinicalProtocolRef.itemId
        ? prev
        : nextClinicalProtocolRef,
    );
    if (parsedQuery.sanitaryPrefill.sanitarioCasoId) {
      setSanitarioCasoId(parsedQuery.sanitaryPrefill.sanitarioCasoId);
      setAbrirCasoClinico(false);
    } else if (parsedQuery.sanitaryPrefill.abrirCasoClinico) {
      setAbrirCasoClinico(true);
      setSanitarioCasoId("");
    }
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
    setSanitarioCasoId,
    setAbrirCasoClinico,
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

  const handleBackFromStep1 = useCallback(() => {
    if (sourceTaskId) {
      navigate("/agenda");
    } else {
      if (window.history.state && window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/home");
      }
    }
  }, [navigate, sourceTaskId]);

  const handleFinalize = useCallback(async () => {
    if (isFinalizing) return;

    // Guard: block finalize if there are unresolved commercial blocking issues
    if (tipoManejo === "comercial" && comercialBlockingIssues.length > 0) {
      showError(comercialBlockingIssues[0]);
      return;
    }

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
          caseLink: {
            selectedCaseId: sanitarioCasoId || null,
            createClinicalCase: abrirCasoClinico,
          },
          clinicalProtocolRef,
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
          eccData,
          eccObservacoes,
          movimentacaoData,
          nutricaoData,
          reproducaoData,
        },
        comercial: tipoManejo === "comercial" ? {
          operationType: comercialData.operationType,
          scope: comercialData.scope,
          quantidadeAnimais: comercialData.scope === "animal" && selectedAnimais.length > 0
            ? selectedAnimais.length
            : (parseInt(comercialData.quantidadeAnimais, 10) || 0),
          pesoVivoTotal: comercialData.pesoVivoTotal !== "" ? parseFloat(comercialData.pesoVivoTotal) : null,
          valorBruto: comercialData.valorBruto !== "" ? parseFloat(comercialData.valorBruto) : null,
          frete: comercialData.frete !== "" ? parseFloat(comercialData.frete) : null,
          comissao: comercialData.comissao !== "" ? parseFloat(comercialData.comissao) : null,
          descontos: comercialData.descontos !== "" ? parseFloat(comercialData.descontos) : null,
          taxasImpostos: comercialData.taxasImpostos !== "" ? parseFloat(comercialData.taxasImpostos) : null,
          contraparteId: comercialData.contraparteId !== "none" ? comercialData.contraparteId : null,
          contraparteNome: comercialData.contraparteId !== "none"
            ? contrapartes?.find(c => c.id === comercialData.contraparteId)?.nome || null
            : null,
          animalIds: comercialData.scope === "animal" ? selectedAnimais : null,
          loteId: comercialData.scope === "lote" && selectedLoteIdNormalized !== null ? selectedLoteIdNormalized : null,
          financeTransactionId: comercialData.financeTransactionId !== "none" ? comercialData.financeTransactionId : null,
          observacoes: comercialData.observacoes || null,
        } : undefined,
        inventory: {
          sanitary: tipoManejo === "sanitario" ? {
            insumoId: selectedInsumoId || null,
            insumoLoteId: selectedInsumoLoteId || null,
            insumoRef,
            loteRef,
            dose: parseFloat(doseSanitaria.replace(",", ".")) || null,
            doseUnidade: loteRef?.unidade_base || doseUnidadeSanitaria || null,
            quantidadeConsumida: parseFloat(quantidadeConsumida.replace(",", ".")) || null,
            quantidadeUnidade: loteRef?.unidade_base || doseUnidadeSanitaria || null,
            viaAplicacao: viaAplicacaoSanitaria || null,
            custoUnitarioSnapshot: loteRef?.custo_unitario ?? null,
            responsavelNome: user?.email ?? null,
            responsavelTipo: user ? "usuario" : null,
            gerarBaixaEstoque,
          } : null,
          nutricao: tipoManejo === "nutricao" ? {
            insumoId: selectedInsumoId || null,
            insumoLoteId: selectedInsumoLoteId || null,
            insumoRef,
            loteRef,
            quantidadeConsumida: parseFloat(quantidadeConsumida.replace(",", ".")) || null,
            quantidadeUnidade: loteRef?.unidade_base || null,
            custoUnitarioSnapshot: loteRef?.custo_unitario ?? null,
            gerarBaixaEstoque,
          } : null,
        },
      });
    } finally {
      setIsFinalizing(false);
    }
  }, [
    activeFarmId,
    abrirCasoClinico,
    clinicalProtocolRef,
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
    eccData,
    eccObservacoes,
    protocoloItemId,
    reproducaoData,
    resolveProtocolProductSelection,
    sanitarioData.produto,
    sanitarioData.tipo,
    sanitarioCasoId,
    selectedAnimais,
    selectedLoteId,
    selectedLoteIdNormalized,
    selectedVeterinaryProductSelection,
    showsTransitChecklist,
    sourceTaskId,
    tipoManejo,
    transitChecklist,
    transitChecklistIssues,
    user,
    viaAplicacaoSanitaria,
    isFinalizing,
    gerarBaixaEstoque,
    selectedInsumoId,
    selectedInsumoLoteId,
    quantidadeConsumida,
    doseSanitaria,
    doseUnidadeSanitaria,
    insumoRef,
    loteRef,
    comercialData,
    comercialBlockingIssues,
    contrapartes,
  ]);

  if (!activeFarmId) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <PageIntro
          variant="plain"
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
      <PageIntro
        variant="plain"
        eyebrow="Fluxo operacional"
        title="Registrar manejo"
        description="Escolha o alvo, informe o manejo e revise antes de registrar."
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
              <StatusBadge tone="neutral">
                {quickActionConfig.label}
              </StatusBadge>
            ) : null}
            {selectedLoteLabel !== "-" ? (
              <StatusBadge tone="neutral">
                {selectedLoteLabel}
              </StatusBadge>
            ) : null}
            {selectedAnimais.length > 0 ? (
              <StatusBadge tone="neutral">
                {selectedAnimais.length} animal(is) selecionado(s)
              </StatusBadge>
            ) : null}
            {hasRegistrarDisplayContext ? (
              <StatusBadge tone="neutral">
                Contexto recebido
              </StatusBadge>
            ) : null}
          </>
        }
      />

      <RegistrarContextSummary
        hasRegistrarDisplayContext={hasRegistrarDisplayContext}
        registrarContextRecords={registrarContextRecords}
        registrarDisplayContext={registrarDisplayContext}
        showTechDetails={showTechDetails}
        setShowTechDetails={setShowTechDetails}
      />

      <RegistrarStepIndicator
        step={step}
        registrationSteps={REGISTRATION_STEPS}
        stepLabels={STEP_LABEL}
      />

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
          onBack={handleBackFromStep1}
        />
      )}

      {step === RegistrationStep.CHOOSE_ACTION && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Manejo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div>
              <RegistrarManejoActionsGrid
                tipoManejo={tipoManejo}
                selectedAnimaisCount={selectedAnimais.length}
                onSelectAction={selectRegularAction}
              />
            </div>

            {selectedAnimais.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem animais: use Financeiro para entrada por lote.
              </p>
            )}

            {tipoManejo === "sanitario" && (
              <>
                <RegistrarSanitarioSection
                  {...actionSectionState.sanitarioSectionProps}
                />
                <RegistrarInventorySection
                  activeFarmId={activeFarmId ?? ""}
                  tipoManejo="sanitario"
                  selectedAnimalCount={sanitaryInventoryAnimalCount}
                  sanitarioTipo={sanitarioData.tipo}
                  gerarBaixaEstoque={gerarBaixaEstoque}
                  onGerarBaixaEstoqueChange={setGerarBaixaEstoque}
                  selectedInsumoId={selectedInsumoId}
                  onSelectedInsumoIdChange={setSelectedInsumoId}
                  selectedLoteId={selectedInsumoLoteId}
                  onSelectedLoteIdChange={setSelectedInsumoLoteId}
                  quantidadeConsumida={quantidadeConsumida}
                  onQuantidadeConsumidaChange={setQuantidadeConsumida}
                  doseSanitaria={doseSanitaria}
                  onDoseSanitariaChange={setDoseSanitaria}
                  doseUnidadeSanitaria={doseUnidadeSanitaria}
                  onDoseUnidadeSanitariaChange={setDoseUnidadeSanitaria}
                  viaAplicacaoSanitaria={viaAplicacaoSanitaria}
                  onViaAplicacaoSanitariaChange={setViaAplicacaoSanitaria}
                  onInsumoRefChange={setInsumoRef}
                  onLoteRefChange={setLoteRef}
                />
              </>
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
              <>
                <RegistrarNutricaoSection
                  {...actionSectionState.nutricaoSectionProps}
                />
                <RegistrarInventorySection
                  activeFarmId={activeFarmId ?? ""}
                  tipoManejo="nutricao"
                  selectedAnimalCount={selectedAnimais.length}
                  gerarBaixaEstoque={gerarBaixaEstoque}
                  onGerarBaixaEstoqueChange={setGerarBaixaEstoque}
                  selectedInsumoId={selectedInsumoId}
                  onSelectedInsumoIdChange={setSelectedInsumoId}
                  selectedLoteId={selectedInsumoLoteId}
                  onSelectedLoteIdChange={setSelectedInsumoLoteId}
                  quantidadeConsumida={quantidadeConsumida}
                  onQuantidadeConsumidaChange={setQuantidadeConsumida}
                  onInsumoRefChange={setInsumoRef}
                  onLoteRefChange={setLoteRef}
                  quantidadeExternaKg={nutricaoData.quantidadeKg}
                />
              </>
            )}

            {tipoManejo === "financeiro" && (
              <RegistrarFinanceiroSection
                {...actionSectionState.financeiroSectionProps}
              />
            )}

            {tipoManejo === "comercial" && (
              <RegistrarComercialSection
                fazendaId={activeFarmId}
                comercialData={comercialData}
                updateComercialData={(field, val) => setComercialData(prev => ({ ...prev, [field]: val }))}
                selectedAnimalIds={selectedAnimais}
                animaisComPeso={animaisComPesoComercial ?? []}
                contrapartes={contrapartes}
                canManageContraparte={canManageContraparte}
                showNovaContraparte={showNovaContraparte}
                onToggleNovaContraparte={() => setShowNovaContraparte(p => !p)}
                novaContraparte={novaContraparte}
                onNovaContraparteFieldChange={(field, val) => setNovaContraparte(prev => ({ ...prev, [field]: val }))}
                onCreateContraparte={handleCreateContraparte}
                isSavingContraparte={isSavingContraparte}
                onNavigateContrapartes={() => navigate("/contrapartes")}
                financeTransactions={financeTransactions}
                weightUnitLabel={farmMeasurementConfig.weight_unit}
              />
            )}

            {tipoManejo === "reproducao" && (
              <RegistrarReproducaoSection
                {...actionSectionState.reproducaoSectionProps}
              />
            )}

            {tipoManejo === "ecc" && (
              <RegistrarEccSection
                {...actionSectionState.eccSectionProps}
              />
            )}

            <RegistrarStickyActionBar
              step={step}
              isFinalizing={isFinalizing}
              canAdvanceToConfirm={canAdvanceToConfirm}
              tipoManejo={tipoManejo}
              sourceTaskId={sourceTaskId}
              actionStepIssues={actionStepIssues}
              onBack={goToSelectAnimals}
              onNext={goToConfirm}
              onFinalize={handleFinalize}
            />
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CONFIRM && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Revisar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-5">
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
              {tipoManejo === "comercial" && (
                <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                    Resumo da Operação Comercial
                  </p>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-medium">Tipo</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-0.5 capitalize">{comercialData.operationType}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wider text-blue-800 dark:text-blue-300 font-medium">Valor Bruto</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-0.5">
                        {comercialData.valorBruto !== "" ? `R$ ${parseFloat(comercialData.valorBruto).toFixed(2)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-border/40 text-sm">
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Escopo:</span>
                      <span className="font-semibold capitalize">{comercialData.scope}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Quantidade de Animais:</span>
                      <span className="font-semibold">
                        {comercialData.scope === "animal" && selectedAnimais.length > 0
                          ? selectedAnimais.length
                          : (parseInt(comercialData.quantidadeAnimais, 10) || "—")}
                      </span>
                    </div>
                    {comercialData.pesoVivoTotal && (
                      <div className="flex justify-between py-1 border-b border-border/20">
                        <span className="text-muted-foreground">Peso Vivo Total:</span>
                        <span className="font-semibold">{comercialData.pesoVivoTotal} {farmMeasurementConfig.weight_unit}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Contraparte:</span>
                      <span className="font-semibold">{contraparteSelecionadaNome}</span>
                    </div>
                    {comercialData.financeTransactionId !== "none" && (
                      <div className="flex justify-between py-1 border-b border-border/20">
                        <span className="text-muted-foreground">Vínculo Financeiro:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Vinculado</span>
                      </div>
                    )}
                  </div>
                  {comercialData.observacoes && (
                    <div className="pt-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Observações:</span> {comercialData.observacoes}
                    </div>
                  )}
                </div>
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
              {tipoManejo === "ecc" && (
                <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                    Resumo do Registro de ECC
                  </p>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-medium">Eventos a gerar</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">{selectedAnimais.filter(id => eccData[id] && eccData[id].trim() !== "").length}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wider text-amber-800 dark:text-amber-300 font-medium">Animais sem ECC</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-0.5">{selectedAnimais.length - selectedAnimais.filter(id => eccData[id] && eccData[id].trim() !== "").length}</p>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1 pr-1 border-t border-border/40">
                    {selectedAnimais.map((animalId) => {
                      const animalIdent = animaisNoLote?.find(a => a.id === animalId)?.identificacao ?? "Animal";
                      const val = eccData[animalId];
                      const obs = eccObservacoes[animalId];
                      const hasValue = val && val.trim() !== "";
                      return (
                        <div key={animalId} className="flex justify-between items-center text-sm py-1 border-b border-border/20 last:border-b-0">
                          <span className="text-muted-foreground font-medium">{animalIdent}</span>
                          <span className={cn("font-semibold", hasValue ? "text-primary" : "text-muted-foreground italic")}>
                            {hasValue ? `${Number(val).toFixed(2)}` : "Não avaliado"}
                            {hasValue && obs ? ` (${obs})` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <RegistrarStickyActionBar
              step={step}
              isFinalizing={isFinalizing}
              canAdvanceToConfirm={canAdvanceToConfirm}
              tipoManejo={tipoManejo}
              sourceTaskId={sourceTaskId}
              actionStepIssues={actionStepIssues}
              onBack={goToChooseAction}
              onNext={goToConfirm}
              onFinalize={handleFinalize}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Registrar;
