import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  Dna,
  HeartPulse,
  History,
  Scale,
  Skull,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { MoverAnimalLote } from "@/components/manejo/MoverAnimalLote";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { getAnimalBreedLabel } from "@/lib/animals/catalogs";
import {
  buildAnimalLifecyclePayload,
  getAnimalLifeStageLabel,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import {
  getAnimalProductiveDestination,
  getAnimalProductiveDestinationLabel,
  getAnimalTransitionMode,
  getMaleReproductiveStatus,
  getMaleReproductiveStatusLabel,
  getTransitionModeLabel,
  isAnimalBreedingEligible,
} from "@/lib/animals/maleProfile";
import {
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
  getCategoriaZootecnicaAliases,
} from "@/lib/animals/taxonomy";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type {
  AgendaItem,
  Animal,
  Evento,
  EventoReproducao,
  CausaObitoEnum,
} from "@/lib/offline/types";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { buildReproductionDashboard } from "@/lib/reproduction/dashboard";
import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import {
  getBirthEventId,
  hasPendingNeonatalSetup,
  wasGeneratedFromBirthEvent,
} from "@/lib/reproduction/neonatal";
import {
  buildClosedSanitaryAlertPayload,
  buildOpenSanitaryAlertPayload,
  buildSanitaryAlertEventPayload,
  describeSanitaryAlertEvent,
  hasOpenSanitaryAlert,
  readAnimalSanitaryAlert,
  readStringArray,
  type SanitaryAlertClosureReason,
} from "@/lib/sanitario/compliance/alerts";
import {
  formatWeight,
  formatWeightPerDay,
  formatWeightValue,
} from "@/lib/format/weight";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/infrastructure/agendaSchedule";
import { showError, showSuccess } from "@/utils/toast";

type EnrichedEvent = Evento & {
  details?: EventoReproducao;
  machoIdentificacao?: string;
};

type ReproDetailsPayload = {
  diagnostico_resultado?: unknown;
  resultado?: unknown;
  numero_crias?: unknown;
};

type SanitaryAlertFormState = {
  diseaseCode: string;
  sinaisDesconhecidos: boolean;
  mortalidadeAlta: boolean;
  routeLabel: string;
  observacoes: string;
};

type SanitaryAlertResolutionState = {
  closureReason: SanitaryAlertClosureReason;
  closureNotes: string;
};

type AnimalAgendaRow = {
  item: AgendaItem;
  scheduleLabel: string | null;
  scheduleModeLabel: string | null;
  scheduleAnchorLabel: string | null;
};

const SANITARY_ALERT_CLOSURE_OPTIONS: Array<{
  value: SanitaryAlertClosureReason;
  label: string;
}> = [
  { value: "descartada", label: "Suspeita descartada" },
  {
    value: "notificada_em_acompanhamento",
    label: "Notificada e em acompanhamento",
  },
  { value: "encerrada_clinicamente", label: "Encerrada clinicamente" },
  { value: "outro", label: "Outro desfecho" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getReproStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function formatAgendaTipoLabel(value: string) {
  return value.replaceAll("_", " ");
}

const AnimalDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { farmLifecycleConfig, farmMeasurementConfig } = useAuth();
  const [showMoverLote, setShowMoverLote] = useState(false);
  const [showCloseSociedadeDialog, setShowCloseSociedadeDialog] = useState(false);
  const [isApplyingLifecycle, setIsApplyingLifecycle] = useState(false);
  const [isClosingSociedade, setIsClosingSociedade] = useState(false);
  const [showObitoDialog, setShowObitoDialog] = useState(false);
  const [isRegisteringObito, setIsRegisteringObito] = useState(false);
  const [obitoData, setObitoData] = useState(new Date().toISOString().split("T")[0]);
  const [obitoCausa, setObitoCausa] = useState<CausaObitoEnum>("outro");
  const [obitoObs, setObitoObs] = useState("");
  const [showSanitaryAlertDialog, setShowSanitaryAlertDialog] = useState(false);
  const [showCloseSanitaryAlertDialog, setShowCloseSanitaryAlertDialog] =
    useState(false);
  const [isSubmittingSanitaryAlert, setIsSubmittingSanitaryAlert] =
    useState(false);
  const [isClosingSanitaryAlert, setIsClosingSanitaryAlert] = useState(false);
  const [sanitaryAlertForm, setSanitaryAlertForm] =
    useState<SanitaryAlertFormState>({
      diseaseCode: "notif-generica",
      sinaisDesconhecidos: false,
      mortalidadeAlta: false,
      routeLabel: "Acionar SVO e registrar a rota local/e-Sisbravet",
      observacoes: "",
    });
  const [sanitaryAlertResolution, setSanitaryAlertResolution] =
    useState<SanitaryAlertResolutionState>({
      closureReason: "descartada",
      closureNotes: "",
    });
  const autoAppliedStageRef = useRef<string | null>(null);

  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const lote = useLiveQuery(
    () => (animal?.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal?.lote_id],
  );
  const mae = useLiveQuery(
    () => (animal?.mae_id ? db.state_animais.get(animal.mae_id) : null),
    [animal?.mae_id],
  );
  const pai = useLiveQuery(
    () => (animal?.pai_id ? db.state_animais.get(animal.pai_id) : null),
    [animal?.pai_id],
  );
  const crias = useLiveQuery(async () => {
    if (!animal?.id || !animal.fazenda_id) return [];

    return await db.state_animais
      .where("fazenda_id")
      .equals(animal.fazenda_id)
      .filter((candidate) => candidate.mae_id === animal.id && !candidate.deleted_at)
      .sortBy("identificacao");
  }, [animal?.id, animal?.fazenda_id]);

  const eventos = useLiveQuery<EnrichedEvent[]>(async () => {
    if (!id) return [];
    const evts = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .reverse()
      .sortBy("occurred_at");

    return Promise.all(
      evts.map(async (evt) => {
        if (evt.dominio === "reproducao") {
          const details = await db.event_eventos_reproducao.get(evt.id);
          let machoIdentificacao = undefined;
          if (details?.macho_id) {
            const macho = await db.state_animais.get(details.macho_id);
            machoIdentificacao = macho?.identificacao;
          }
          return { ...evt, details, machoIdentificacao } as EnrichedEvent;
        }
        return evt as EnrichedEvent;
      }),
    );
  }, [id]);

  const agenda = useLiveQuery(async () => {
    if (!id) return [];

    const items = await db.state_agenda_itens
      .where("animal_id")
      .equals(id)
      .filter((item) => !item.deleted_at)
      .toArray();
    const protocolItemIds = Array.from(
      new Set(
        items
          .map((item) => item.protocol_item_version_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
    const protocolItems =
      protocolItemIds.length > 0
        ? await db.state_protocolos_sanitarios_itens.bulkGet(protocolItemIds)
        : [];
    const protocolItemById = new Map(
      protocolItems
        .filter((item): item is NonNullable<(typeof protocolItems)[number]> => Boolean(item))
        .map((item) => [item.id, item]),
    );

    return items
      .slice()
      .sort((left, right) => left.data_prevista.localeCompare(right.data_prevista))
      .map((item): AnimalAgendaRow => {
        const protocolItem =
          item.protocol_item_version_id
            ? protocolItemById.get(item.protocol_item_version_id) ?? null
            : null;
        const scheduleMeta = resolveSanitaryAgendaItemScheduleMeta(
          item,
          protocolItem,
        );

        return {
          item,
          scheduleLabel: scheduleMeta?.label ?? null,
          scheduleModeLabel: scheduleMeta?.modeLabel ?? null,
          scheduleAnchorLabel: scheduleMeta?.anchorLabel ?? null,
        };
      });
  }, [id]);
  const officialDiseases = useLiveQuery(
    () => db.catalog_doencas_notificaveis.toArray(),
    [],
  );

  const ultimoPeso = useLiveQuery(async () => {
    if (!id) return null;

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "pesagem")
      .toArray();

    if (!registros.length) return null;

    const ultimo = registros.reduce((best, current) => {
      const bestTimestamp = new Date(
        best.server_received_at ?? best.occurred_at,
      ).getTime();
      const currentTimestamp = new Date(
        current.server_received_at ?? current.occurred_at,
      ).getTime();
      return currentTimestamp > bestTimestamp ? current : best;
    }, registros[0]);

    const details = await db.event_eventos_pesagem.get(ultimo.id);

    return details?.peso_kg
      ? {
          peso_kg: details.peso_kg,
          data: ultimo.server_received_at || ultimo.occurred_at,
        }
      : null;
  }, [id]);
  const historicoPeso = useLiveQuery(async () => {
    if (!id) return [];

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "pesagem" && !event.deleted_at)
      .toArray();

    const pontos = await Promise.all(
      registros.map(async (event) => {
        const details = await db.event_eventos_pesagem.get(event.id);
        if (!details?.peso_kg) return null;

        const dataReferencia = event.server_received_at || event.occurred_at;
        return {
          id: event.id,
          data: dataReferencia.slice(0, 10),
          dataLabel: formatDate(dataReferencia),
          pesoKg: details.peso_kg,
        };
      }),
    );

    return pontos
      .filter(
        (
          ponto,
        ): ponto is {
          id: string;
          data: string;
          dataLabel: string;
          pesoKg: number;
        } => ponto !== null,
      )
      .sort((left, right) => left.data.localeCompare(right.data));
  }, [id]);

  const proximaAgenda = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];

    return (
      agenda?.find(
        (entry) =>
          entry.item.status === "agendado" &&
          entry.item.data_prevista >= hoje &&
          (!entry.item.deleted_at || entry.item.deleted_at === null),
      ) ?? null
    );
  }, [agenda]);

  const sociedadeAtiva = useLiveQuery(async () => {
    if (!animal?.id || animal.origem !== "sociedade") return null;
    const sociedades = await db.state_animais_sociedade
      .where("[fazenda_id+animal_id]")
      .equals([animal.fazenda_id, animal.id])
      .and((item) => item.deleted_at === null && item.fim === null)
      .toArray();
    return sociedades[0] || null;
  }, [animal]);

  const contraparte = useLiveQuery(async () => {
    if (!sociedadeAtiva?.contraparte_id) return null;
    return await db.state_contrapartes.get(sociedadeAtiva.contraparte_id);
  }, [sociedadeAtiva?.contraparte_id]);
  const activeSanitaryAlert = useMemo(
    () => readAnimalSanitaryAlert(animal?.payload),
    [animal?.payload],
  );
  const hasMovementBlockedSanitaryAlert = hasOpenSanitaryAlert(animal?.payload);
  const selectedOfficialDisease = useMemo(() => {
    const diseases = officialDiseases ?? [];
    return (
      diseases.find((disease) => disease.codigo === sanitaryAlertForm.diseaseCode) ??
      diseases[0] ??
      null
    );
  }, [officialDiseases, sanitaryAlertForm.diseaseCode]);
  const selectedOfficialDiseaseSignals = useMemo(
    () => readStringArray(selectedOfficialDisease?.sinais_alerta_json, "sinais"),
    [selectedOfficialDisease],
  );
  const selectedOfficialDiseaseActions = useMemo(
    () => readStringArray(selectedOfficialDisease?.acao_imediata_json, "passos"),
    [selectedOfficialDisease],
  );

  const taxonomySnapshot = useMemo(() => {
    if (!animal) return null;
    const reproContext = buildAnimalTaxonomyReproContextMap(
      (eventos ?? []).filter((evt) => evt.dominio === "reproducao"),
    ).get(animal.id);
    return deriveAnimalTaxonomy(animal, {
      config: farmLifecycleConfig,
      reproContext: reproContext ?? null,
    });
  }, [animal, eventos, farmLifecycleConfig]);
  const categoriaLabel = taxonomySnapshot?.display.categoria ?? null;
  const isReproductionEligible =
    animal && isFemaleReproductionEligible(animal, categoriaLabel);
  const lifecycleSnapshot = animal
    ? resolveAnimalLifecycleSnapshot(animal, farmLifecycleConfig)
    : null;
  const maleDestination = animal ? getAnimalProductiveDestination(animal) : null;
  const maleReproductiveStatus = animal
    ? getMaleReproductiveStatus(animal)
    : null;
  const transitionMode = animal ? getAnimalTransitionMode(animal) : null;
  const effectiveTransitionMode = lifecycleSnapshot?.transitionMode ?? transitionMode;
  const isBreedingMale = animal ? isAnimalBreedingEligible(animal) : false;
  const reproResumo = useMemo(() => {
    if (!animal || !isReproductionEligible) return null;

    const dashboard = buildReproductionDashboard({
      animals: [animal],
      lotes: lote ? [lote] : [],
      events: (eventos ?? [])
        .filter((evt) => evt.dominio === "reproducao" && !evt.deleted_at)
        .map((evt) => ({
          ...evt,
          details: evt.details,
        })),
    });

    return dashboard.animals[0] ?? null;
  }, [animal, isReproductionEligible, lote, eventos]);
  const resumoPeso = useMemo(() => {
    if (!historicoPeso || historicoPeso.length === 0) return null;

    const primeiro = historicoPeso[0];
    const ultimo = historicoPeso[historicoPeso.length - 1];
    const variacaoKg = ultimo.pesoKg - primeiro.pesoKg;
    const diasEntreRegistros = Math.max(
      1,
      Math.round(
        (new Date(ultimo.data).getTime() - new Date(primeiro.data).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const ganhoMedioDiaKg =
      historicoPeso.length > 1 ? variacaoKg / diasEntreRegistros : null;

    return {
      primeiro,
      ultimo,
      variacaoKg,
      ganhoMedioDiaKg,
      totalPesagens: historicoPeso.length,
    };
  }, [historicoPeso]);
  const pendingNeonatalCount = useMemo(
    () =>
      (crias ?? []).filter((calf) => hasPendingNeonatalSetup(calf.payload)).length,
    [crias],
  );
  const calfJourneyPendingCount = useMemo(() => {
    if (!agenda || agenda.length === 0) return 0;
    return agenda.filter(
      (item) => item.status === "agendado" && isCalfJourneyAgendaItem(item),
    ).length;
  }, [agenda]);
  const isNeonatalCalf = animal
    ? wasGeneratedFromBirthEvent(animal.payload)
    : false;
  const calfInitialRoute = useMemo(() => {
    if (!animal) return null;

    const params = new URLSearchParams();
    const birthEventId = getBirthEventId(animal.payload);
    if (birthEventId) {
      params.set("eventoId", birthEventId);
    }
    if (mae?.id) {
      params.set("mae", mae.id);
    }

    return params.size > 0
      ? `/animais/${animal.id}/cria-inicial?${params.toString()}`
      : `/animais/${animal.id}/cria-inicial`;
  }, [animal, mae?.id]);

  const applyLifecycleTransition = useCallback(async (
    source: "manual" | "automatico",
    silent = false,
  ) => {
    if (!animal || !lifecycleSnapshot) return;

    setIsApplyingLifecycle(true);
    try {
      await createGesture(animal.fazenda_id, [
        {
          table: "animais",
          action: "UPDATE",
          record: {
            id: animal.id,
            payload: buildAnimalLifecyclePayload(
              animal.payload,
              lifecycleSnapshot.targetStage,
              source,
            ),
            updated_at: new Date().toISOString(),
          },
        },
      ]);

      if (!silent) {
        showSuccess(
          `Estagio atualizado para ${getAnimalLifeStageLabel(
            lifecycleSnapshot.targetStage,
          ).toLowerCase()}.`,
        );
      }
    } catch (error) {
      if (!silent) {
        showError("Nao foi possivel atualizar o estagio de vida.");
      }
    } finally {
      setIsApplyingLifecycle(false);
    }
  }, [animal, lifecycleSnapshot]);

  useEffect(() => {
    if (!animal || !lifecycleSnapshot?.canAutoApply || isApplyingLifecycle) {
      return;
    }

    if (autoAppliedStageRef.current === lifecycleSnapshot.targetStage) {
      return;
    }

    autoAppliedStageRef.current = lifecycleSnapshot.targetStage;
    void applyLifecycleTransition("automatico", true);
  }, [animal, applyLifecycleTransition, isApplyingLifecycle, lifecycleSnapshot]);

  useEffect(() => {
    if (!officialDiseases || officialDiseases.length === 0) {
      return;
    }

    const hasCurrentDisease = officialDiseases.some(
      (disease) => disease.codigo === sanitaryAlertForm.diseaseCode,
    );
    if (hasCurrentDisease) return;

    setSanitaryAlertForm((prev) => ({
      ...prev,
      diseaseCode: officialDiseases[0]?.codigo ?? "notif-generica",
    }));
  }, [officialDiseases, sanitaryAlertForm.diseaseCode]);

  const handleCloseSociedade = useCallback(async () => {
    if (!animal || !sociedadeAtiva) return;

    const now = new Date().toISOString();
    const hoje = new Date().toISOString().split("T")[0];

    setIsClosingSociedade(true);
    try {
      await createGesture(animal.fazenda_id, [
        {
          table: "animais_sociedade",
          action: "UPDATE",
          record: {
            id: sociedadeAtiva.id,
            fim: hoje,
            updated_at: now,
          },
        },
      ]);
      setShowCloseSociedadeDialog(false);
      showSuccess("Sociedade encerrada!");
    } catch {
      showError("Erro ao encerrar sociedade.");
    } finally {
      setIsClosingSociedade(false);
    }
  }, [animal, sociedadeAtiva]);

  const handleRegisterObito = useCallback(async () => {
    if (!animal) return;

    setIsRegisteringObito(true);
    try {
      // Find pending agenda items for this animal to cancel them
      const pendingTasks = agenda?.filter(item => item.status === "agendado").map(item => item.id) || [];

      const { ops } = buildEventGesture({
        dominio: "obito",
        fazendaId: animal.fazenda_id,
        animalId: animal.id,
        occurredAt: new Date(`${obitoData}T12:00:00`).toISOString(),
        dataObito: obitoData,
        causa: obitoCausa,
        observacoes: obitoObs || `Óbito registrado: ${obitoCausa}`,
        cancelAgendaIds: pendingTasks,
      });

      await createGesture(animal.fazenda_id, ops);
      setShowObitoDialog(false);
      showSuccess("Óbito registrado com sucesso.");
      // Redirect or let the UI reflect status (animal detail will show 'morto' and hide buttons)
    } catch (error) {
      console.error(error);
      showError("Erro ao registrar óbito.");
    } finally {
      setIsRegisteringObito(false);
    }
  }, [animal, obitoData, obitoCausa, obitoObs, agenda]);

  const handleOpenSanitaryAlert = useCallback(async () => {
    if (!animal) return;
    if (!selectedOfficialDisease) {
      showError("Catalogo oficial de doencas notificaveis ainda nao esta disponivel.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const alertSignals = [
      sanitaryAlertForm.sinaisDesconhecidos
        ? "sinais de causa desconhecida"
        : null,
      sanitaryAlertForm.mortalidadeAlta
        ? "mortalidade alta ou inesperada"
        : null,
    ].filter((value): value is string => Boolean(value));
    const routeLabel =
      sanitaryAlertForm.routeLabel.trim() ||
      "Acionar SVO e registrar a rota local/e-Sisbravet";

    setIsSubmittingSanitaryAlert(true);
    try {
      const eventPayload = buildSanitaryAlertEventPayload({
        alertKind: "suspeita_aberta",
        diseaseCode: selectedOfficialDisease.codigo,
        diseaseName: selectedOfficialDisease.nome,
        notificationType: selectedOfficialDisease.tipo_notificacao,
        routeLabel,
        notes: sanitaryAlertForm.observacoes,
        immediateActions: selectedOfficialDiseaseActions,
        alertSignals,
      });
      const animalPayload = buildOpenSanitaryAlertPayload(animal.payload, {
        diseaseCode: selectedOfficialDisease.codigo,
        diseaseName: selectedOfficialDisease.nome,
        notificationType: selectedOfficialDisease.tipo_notificacao,
        occurredAt,
        notes: sanitaryAlertForm.observacoes,
        routeLabel,
        immediateActions: selectedOfficialDiseaseActions,
        alertSignals,
      });

      const { ops } = buildEventGesture({
        dominio: "alerta_sanitario",
        fazendaId: animal.fazenda_id,
        animalId: animal.id,
        loteId: animal.lote_id ?? null,
        occurredAt,
        observacoes:
          sanitaryAlertForm.observacoes.trim() ||
          `Suspeita sanitaria aberta: ${selectedOfficialDisease.nome}`,
        payload: eventPayload,
        alertKind: "suspeita_aberta",
        animalPayload,
      });

      await createGesture(animal.fazenda_id, ops);
      setShowSanitaryAlertDialog(false);
      setSanitaryAlertForm((prev) => ({
        ...prev,
        observacoes: "",
        sinaisDesconhecidos: false,
        mortalidadeAlta: false,
      }));
      showSuccess("Suspeita sanitaria aberta com bloqueio local de movimentacao.");
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel abrir a suspeita sanitaria.");
    } finally {
      setIsSubmittingSanitaryAlert(false);
    }
  }, [
    animal,
    sanitaryAlertForm,
    selectedOfficialDisease,
    selectedOfficialDiseaseActions,
  ]);

  const handleCloseSanitaryAlert = useCallback(async () => {
    if (!animal || !activeSanitaryAlert) return;

    const occurredAt = new Date().toISOString();

    setIsClosingSanitaryAlert(true);
    try {
      const eventPayload = buildSanitaryAlertEventPayload({
        alertKind: "suspeita_encerrada",
        diseaseCode: activeSanitaryAlert.diseaseCode,
        diseaseName: activeSanitaryAlert.diseaseName,
        notificationType: activeSanitaryAlert.notificationType,
        routeLabel: activeSanitaryAlert.routeLabel,
        notes: activeSanitaryAlert.notes,
        immediateActions: activeSanitaryAlert.immediateActions,
        alertSignals: activeSanitaryAlert.alertSignals,
        closureReason: sanitaryAlertResolution.closureReason,
        closureNotes: sanitaryAlertResolution.closureNotes,
      });
      const animalPayload = buildClosedSanitaryAlertPayload(animal.payload, {
        occurredAt,
        closureReason: sanitaryAlertResolution.closureReason,
        closureNotes: sanitaryAlertResolution.closureNotes,
      });

      const { ops } = buildEventGesture({
        dominio: "alerta_sanitario",
        fazendaId: animal.fazenda_id,
        animalId: animal.id,
        loteId: animal.lote_id ?? null,
        occurredAt,
        observacoes:
          sanitaryAlertResolution.closureNotes.trim() ||
          "Suspeita sanitaria encerrada",
        payload: eventPayload,
        alertKind: "suspeita_encerrada",
        animalPayload,
      });

      await createGesture(animal.fazenda_id, ops);
      setShowCloseSanitaryAlertDialog(false);
      setSanitaryAlertResolution({
        closureReason: "descartada",
        closureNotes: "",
      });
      showSuccess("Suspeita sanitaria encerrada e bloqueio local removido.");
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel encerrar a suspeita sanitaria.");
    } finally {
      setIsClosingSanitaryAlert(false);
    }
  }, [activeSanitaryAlert, animal, sanitaryAlertResolution]);

  if (!animal) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando animal...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/animais">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{animal.identificacao}</h1>
            <AnimalCategoryBadge animal={animal} categoriaLabel={categoriaLabel} />
            <Badge
              variant="outline"
              className={
                animal.sexo === "F"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }
            >
              {animal.sexo === "M" ? "Macho" : "Femea"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {lote ? `Lote: ${lote.nome}` : "Sem lote definido"}
          </p>
        </div>
        <div className="flex gap-2">
          {hasMovementBlockedSanitaryAlert ? (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
              onClick={() => setShowCloseSanitaryAlertDialog(true)}
              disabled={animal.status !== "ativo"}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Encerrar suspeita
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
              onClick={() => setShowSanitaryAlertDialog(true)}
              disabled={animal.status !== "ativo"}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Abrir suspeita sanitaria
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowObitoDialog(true)}
            disabled={animal.status !== "ativo"}
          >
            <Skull className="mr-2 h-4 w-4" />
            Registrar obito
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("dominio", "financeiro");
              params.set("animalId", animal.id);
              if (animal.lote_id) {
                params.set("loteId", animal.lote_id);
              }
              navigate(`/registrar?${params.toString()}`);
            }}
            disabled={animal.status !== "ativo" || hasMovementBlockedSanitaryAlert}
          >
            Registrar venda
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMoverLote(true)}
            disabled={hasMovementBlockedSanitaryAlert}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Mover lote
          </Button>
          <Link to={`/animais/${id}/editar`}>
            <Button variant="outline" size="sm">
              Editar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-none bg-primary/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Peso atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ultimoPeso ? (
              <div>
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <Scale className="h-5 w-5 text-primary" />
                  {formatWeight(
                    ultimoPeso.peso_kg,
                    farmMeasurementConfig.weight_unit,
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(ultimoPeso.data)}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-2xl font-bold text-muted-foreground">
                <Scale className="h-5 w-5" />
                Sem pesagem
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Informacoes basicas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <AnimalCategoryBadge animal={animal} categoriaLabel={categoriaLabel} />
            <Badge
              variant="outline"
              className={
                animal.sexo === "F"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }
            >
              {animal.sexo === "M" ? "Macho" : "Femea"}
            </Badge>
            <Badge variant="default">{animal.status}</Badge>
            {animal.origem && animal.origem !== "nascimento" && (
              <Badge variant="secondary">
                {animal.origem.charAt(0).toUpperCase() + animal.origem.slice(1)}
              </Badge>
            )}
            {animal.raca && (
              <Badge variant="outline">{getAnimalBreedLabel(animal.raca)}</Badge>
            )}
            {animal.sexo === "M" && maleDestination && (
              <Badge variant="outline" className="border-sky-200 bg-white text-sky-800">
                {getAnimalProductiveDestinationLabel(maleDestination)}
              </Badge>
            )}
            {animal.sexo === "M" && maleReproductiveStatus && (
              <Badge
                variant="outline"
                className={
                  maleReproductiveStatus === "apto"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }
              >
                {getMaleReproductiveStatusLabel(maleReproductiveStatus)}
              </Badge>
            )}
            {animal.sexo === "M" && effectiveTransitionMode && (
              <Badge variant="secondary">
                {getTransitionModeLabel(effectiveTransitionMode)}
              </Badge>
            )}
            {animal.origem === "sociedade" && sociedadeAtiva && contraparte && (
              <Badge variant="default" className="bg-blue-600">
                {contraparte.nome}
                {sociedadeAtiva.percentual && ` (${sociedadeAtiva.percentual}%)`}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-primary/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Proximo manejo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {proximaAgenda ? formatDate(proximaAgenda.item.data_prevista) : "Sem agenda"}
            </div>
            {proximaAgenda ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {formatAgendaTipoLabel(proximaAgenda.item.tipo)}
                </p>
                {proximaAgenda.scheduleLabel ? (
                  <p className="text-xs text-muted-foreground">
                    {proximaAgenda.scheduleLabel}
                  </p>
                ) : null}
                {proximaAgenda.scheduleModeLabel || proximaAgenda.scheduleAnchorLabel ? (
                  <div className="flex flex-wrap gap-2">
                    {proximaAgenda.scheduleModeLabel ? (
                      <Badge variant="outline" className="text-[10px]">
                        {proximaAgenda.scheduleModeLabel}
                      </Badge>
                    ) : null}
                    {proximaAgenda.scheduleAnchorLabel ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {proximaAgenda.scheduleAnchorLabel}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {activeSanitaryAlert?.status === "suspeita_aberta" ? (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Suspeita sanitaria aberta
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-amber-600 text-white">Movimentacao bloqueada</Badge>
                {activeSanitaryAlert.notificationType ? (
                  <Badge variant="outline" className="border-amber-300 text-amber-900">
                    Notificacao {activeSanitaryAlert.notificationType}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Doenca / suspeita
                </p>
                <p className="mt-1 font-semibold text-amber-950">
                  {activeSanitaryAlert.diseaseName ?? "Suspeita sanitaria"}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Aberta em
                </p>
                <p className="mt-1 font-semibold text-amber-950">
                  {formatDate(activeSanitaryAlert.openedAt)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Rota imediata
                </p>
                <p className="mt-1 text-sm text-amber-950">
                  {activeSanitaryAlert.routeLabel ?? "Acionar SVO e registrar rota local"}
                </p>
              </div>
            </div>

            {activeSanitaryAlert.alertSignals.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-950">
                  Sinais que motivaram o bloqueio
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSanitaryAlert.alertSignals.map((signal) => (
                    <Badge
                      key={signal}
                      variant="outline"
                      className="border-amber-200 bg-white text-amber-900"
                    >
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {activeSanitaryAlert.immediateActions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-950">
                  Passos imediatos recomendados
                </p>
                <ul className="space-y-1 text-sm text-amber-900">
                  {activeSanitaryAlert.immediateActions.map((action) => (
                    <li key={action}>- {action}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeSanitaryAlert.notes ? (
              <div className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm text-amber-950">
                {activeSanitaryAlert.notes}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={() => setShowCloseSanitaryAlertDialog(true)}
              >
                Encerrar suspeita
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {taxonomySnapshot && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Taxonomia canônica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Categoria zootécnica
                </p>
                <p className="mt-1 font-semibold">{taxonomySnapshot.display.categoria}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aliases: {getCategoriaZootecnicaAliases(taxonomySnapshot.categoria_zootecnica).join(", ")}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Fase veterinária
                </p>
                <p className="mt-1 font-semibold">
                  {taxonomySnapshot.display.fase_veterinaria}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estado produtivo/reprodutivo
                </p>
                <p className="mt-1 font-semibold">
                  {taxonomySnapshot.display.estado_alias}
                </p>
                {taxonomySnapshot.display.estado_alias !==
                  taxonomySnapshot.display.estado_canonico && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Canonico: {taxonomySnapshot.display.estado_canonico}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {taxonomySnapshot.facts.data_desmama && (
                <Badge variant="outline">
                  Desmama: {formatDate(taxonomySnapshot.facts.data_desmama)}
                </Badge>
              )}
              {taxonomySnapshot.facts.prenhez_confirmada && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  Prenhez confirmada
                </Badge>
              )}
              {taxonomySnapshot.facts.data_ultimo_parto && (
                <Badge variant="outline">
                  Último parto: {formatDate(taxonomySnapshot.facts.data_ultimo_parto)}
                </Badge>
              )}
              {taxonomySnapshot.facts.secagem_realizada && (
                <Badge variant="outline">Secagem realizada</Badge>
              )}
              {taxonomySnapshot.facts.em_lactacao && (
                <Badge variant="outline">Em lactação</Badge>
              )}
              {taxonomySnapshot.facts.castrado && (
                <Badge variant="outline">Castrado</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {lifecycleSnapshot && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Estagio de vida</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-800">
                  Atual: {getAnimalLifeStageLabel(lifecycleSnapshot.currentStage)}
                </Badge>
                <Badge variant="secondary">
                  {getTransitionModeLabel(lifecycleSnapshot.transitionMode)}
                </Badge>
                {lifecycleSnapshot.currentStageSource === "inferred" && (
                  <Badge variant="outline">Estagio ainda nao registrado</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estagio atual
                </p>
                <p className="mt-1 font-semibold">
                  {getAnimalLifeStageLabel(lifecycleSnapshot.currentStage)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Alvo calculado
                </p>
                <p className="mt-1 font-semibold">
                  {getAnimalLifeStageLabel(lifecycleSnapshot.targetStage)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Regra usada
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lifecycleSnapshot.targetStageReason}
                </p>
              </div>
            </div>

            {lifecycleSnapshot.shouldSuggestTransition ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-amber-900">
                      {lifecycleSnapshot.suggestionKind === "initialize"
                        ? "Registrar estagio inicial"
                        : "Transicao sugerida"}
                    </p>
                    <p className="text-sm text-amber-800">
                      {lifecycleSnapshot.suggestionKind === "initialize"
                        ? `Salvar ${getAnimalLifeStageLabel(
                            lifecycleSnapshot.targetStage,
                          ).toLowerCase()} como estagio atual deste animal.`
                        : `Mover de ${getAnimalLifeStageLabel(
                            lifecycleSnapshot.currentStage,
                          ).toLowerCase()} para ${getAnimalLifeStageLabel(
                            lifecycleSnapshot.targetStage,
                          ).toLowerCase()}.`}
                    </p>
                  </div>
                  {!lifecycleSnapshot.canAutoApply && (
                    <Button
                      size="sm"
                      onClick={() => void applyLifecycleTransition("manual")}
                      disabled={isApplyingLifecycle}
                    >
                      {isApplyingLifecycle ? "Aplicando..." : "Confirmar transicao"}
                    </Button>
                  )}
                </div>
                {lifecycleSnapshot.canAutoApply && (
                  <p className="mt-3 text-sm text-amber-800">
                    Este marco sera aplicado automaticamente pelo modo{" "}
                    {lifecycleSnapshot.transitionMode}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O estagio registrado ja esta alinhado com as regras atuais da fazenda.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Evolucao de peso</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {resumoPeso && (
                <Badge
                  variant="outline"
                  className={
                    resumoPeso.variacaoKg >= 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {resumoPeso.variacaoKg >= 0 ? "+" : ""}
                  {formatWeight(
                    Math.abs(resumoPeso.variacaoKg),
                    farmMeasurementConfig.weight_unit,
                  )}{" "}
                  no periodo
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("dominio", "pesagem");
                  params.set("animalId", animal.id);
                  if (animal.lote_id) {
                    params.set("loteId", animal.lote_id);
                  }
                  navigate(`/registrar?${params.toString()}`);
                }}
              >
                Registrar pesagem
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {historicoPeso && historicoPeso.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pesagens
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso?.totalPesagens ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Primeiro registro
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso
                      ? formatWeight(
                          resumoPeso.primeiro.pesoKg,
                          farmMeasurementConfig.weight_unit,
                        )
                      : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resumoPeso?.primeiro.dataLabel ?? "Sem data"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ultimo registro
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso
                      ? formatWeight(
                          resumoPeso.ultimo.pesoKg,
                          farmMeasurementConfig.weight_unit,
                        )
                      : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resumoPeso?.ultimo.dataLabel ?? "Sem data"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    GMD
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatWeightPerDay(
                      resumoPeso?.ganhoMedioDiaKg,
                      farmMeasurementConfig.weight_unit,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Media entre o primeiro e o ultimo registro
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicoPeso}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dataLabel" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(value) =>
                        formatWeightValue(
                          value,
                          farmMeasurementConfig.weight_unit,
                        )
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatWeight(value, farmMeasurementConfig.weight_unit),
                        "Peso",
                      ]}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="pesoKg"
                      stroke="#059669"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem historico de pesagem para acompanhar a evolucao deste animal.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {animal.sexo === "F" && (
          <Card className="border-rose-200 bg-rose-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-rose-900">
                <HeartPulse className="h-4 w-4" />
                Ciclo reprodutivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isReproductionEligible && reproResumo ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-white text-rose-800"
                    >
                      Status: {getReproStatusLabel(reproResumo.reproStatus.status)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        reproResumo.urgency === "atencao"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }
                    >
                      {reproResumo.urgency === "atencao"
                        ? "Acao prioritaria"
                        : "Fluxo sob controle"}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                      {reproResumo.loteNome ? `Lote ${reproResumo.loteNome}` : "Sem lote"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Ultimo marco
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {reproResumo.lastEventLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.lastEventDateLabel
                          ? formatDate(reproResumo.lastEventDateLabel)
                          : "Sem registro"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Proximo passo
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {reproResumo.nextActionLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.nextActionDate
                          ? formatDate(reproResumo.nextActionDate)
                          : "Sem data prevista"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Faixa do ciclo
                      </p>
                      <p className="mt-1 font-semibold capitalize text-slate-900">
                        {reproResumo.lane}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.actionLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {reproResumo.reproStatus.status !== "SERVIDA" && reproResumo.reproStatus.status !== "PRENHA" && (
                      <Link to={`/animais/${animal.id}/reproducao?tipo=cobertura`}>
                        <Button size="sm">Cobertura / IA</Button>
                      </Link>
                    )}
                    {(reproResumo.reproStatus.status === "SERVIDA" || reproResumo.reproStatus.status === "PRENHA") && (
                      <Link to={`/animais/${animal.id}/reproducao?tipo=diagnostico`}>
                        <Button variant="outline" size="sm">
                          Diagnóstico
                        </Button>
                      </Link>
                    )}
                    {reproResumo.reproStatus.status === "PRENHA" && (
                      <Link to={`/animais/${animal.id}/reproducao?tipo=parto`}>
                        <Button variant="outline" size="sm">
                          Parto
                        </Button>
                      </Link>
                    )}
                    {pendingNeonatalCount > 0 && (
                      <Link to={`/animais/${animal.id}/pos-parto`}>
                        <Button variant="outline" size="sm">
                          Pos-parto ({pendingNeonatalCount})
                        </Button>
                      </Link>
                    )}
                  </div>
                </>
              ) : isReproductionEligible ? (
                <p className="text-sm text-muted-foreground">
                  Sem historico reprodutivo consolidado para esta matriz.
                </p>
              ) : (
                <div className="space-y-2">
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-white text-slate-700"
                  >
                    Categoria atual: {categoriaLabel ?? "Nao classificada"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Esta femea ainda nao esta em fase reprodutiva. O fluxo de
                    reproducao so fica disponivel para novilhas e vacas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {animal.sexo === "M" && (
          <Card className="border-sky-200 bg-sky-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sky-900">
                <HeartPulse className="h-4 w-4" />
                Perfil de manejo do macho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="border-sky-200 bg-white text-sky-800"
                >
                  {getAnimalProductiveDestinationLabel(maleDestination) ??
                    "Destino: nao definido"}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    maleReproductiveStatus === "apto"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {getMaleReproductiveStatusLabel(maleReproductiveStatus) ??
                    "Status: nao definido"}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-700"
                >
                  {getTransitionModeLabel(effectiveTransitionMode) ??
                    "Transicao manual"}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    isBreedingMale
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }
                >
                  {isBreedingMale
                    ? "Elegivel para touro de lote"
                    : "Ainda fora da liberacao para cobertura"}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Destino
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {maleDestination ?? "Nao definido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Decide se o animal segue para reproducao, engorda ou saida.
                  </p>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status reprodutivo
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {maleReproductiveStatus ?? "Nao definido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Separa candidato, apto, suspenso ou inativo.
                  </p>
                </div>

                <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Modo de transicao
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {transitionMode ?? "manual"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Define se a troca de marco fica manual, automatica ou mista.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link to={`/animais/${animal.id}/editar`}>
                  <Button size="sm">Ajustar perfil</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-slate-600" />
              Vinculos familiares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimalKinshipBadges mother={mae} father={pai} calves={crias ?? []} />
            <div className="space-y-1 text-sm text-muted-foreground">
              {mae && <p>Matriz de origem: {mae.identificacao}</p>}
              {pai && <p>Pai vinculado: {pai.identificacao}</p>}
              {calfJourneyPendingCount > 0 && (
                <p>{calfJourneyPendingCount} marco(s) da jornada da cria em aberto.</p>
              )}
              {(crias?.length ?? 0) > 0 && (
                <p>
                  {animal.identificacao} tem {(crias?.length ?? 0)} cria(s)
                  vinculada(s).
                </p>
              )}
              {!mae && !pai && (crias?.length ?? 0) === 0 && (
                <p>Sem vinculos maternos registrados para este animal.</p>
              )}
            </div>
            {isNeonatalCalf && calfInitialRoute && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={calfInitialRoute}>
                    {hasPendingNeonatalSetup(animal.payload)
                      ? "Fechar ficha inicial da cria"
                      : "Acompanhar crescimento inicial"}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {animal.origem === "sociedade" && sociedadeAtiva && contraparte && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-900">
                Detalhes da sociedade
              </CardTitle>
              <Badge variant="default" className="bg-blue-600">
                {sociedadeAtiva.fim ? "Encerrada" : "Ativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Contraparte</p>
                <p className="font-semibold text-blue-900">{contraparte.nome}</p>
              </div>

              {sociedadeAtiva.percentual && (
                <div>
                  <p className="text-xs text-muted-foreground">Participacao da fazenda</p>
                  <p className="font-semibold text-blue-900">
                    {sociedadeAtiva.percentual}%
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Data de inicio</p>
                <p className="font-medium">{formatDate(sociedadeAtiva.inicio)}</p>
              </div>

              {sociedadeAtiva.fim && (
                <div>
                  <p className="text-xs text-muted-foreground">Data de encerramento</p>
                  <p className="font-medium">{formatDate(sociedadeAtiva.fim)}</p>
                </div>
              )}
            </div>

            {!sociedadeAtiva.fim && (
              <div className="border-t border-blue-200 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowCloseSociedadeDialog(true)}
                >
                  Encerrar sociedade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid max-w-[400px] w-full grid-cols-2 bg-muted/50 p-1">
          <TabsTrigger value="timeline" className="gap-2 rounded-md">
            <History className="h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2 rounded-md">
            <Calendar className="h-4 w-4" /> Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="ml-4 space-y-6 border-l-2 border-muted pl-4">
            {eventos?.length === 0 ? (
              <p className="py-4 text-muted-foreground">
                Nenhum evento registrado.
              </p>
            ) : (
              eventos?.map((evt) => (
                <div key={evt.id} className="relative">
                  <div
                    className={`absolute -left-[25px] h-4 w-4 rounded-full border-2 border-background ${
                      evt.dominio === "sanitario"
                        ? "bg-blue-500"
                        : evt.dominio === "alerta_sanitario"
                          ? "bg-amber-500"
                        : evt.dominio === "pesagem"
                          ? "bg-emerald-500"
                          : evt.dominio === "reproducao"
                            ? "bg-rose-500"
                            : "bg-slate-500"
                    }`}
                  />
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="text-sm font-bold capitalize">
                      {evt.dominio === "reproducao" && evt.details
                        ? `Reproducao: ${evt.details.tipo}`
                        : evt.dominio === "alerta_sanitario"
                          ? "Alerta sanitario"
                        : evt.dominio}
                    </h4>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {formatDate(evt.occurred_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {evt.dominio === "alerta_sanitario"
                      ? describeSanitaryAlertEvent(evt.payload)
                      : evt.observacoes || "Manejo realizado no campo."}
                  </p>
                  {evt.dominio === "alerta_sanitario" && (
                    <div className="mt-1 rounded border border-amber-100 bg-amber-50/50 p-2 text-xs">
                      {(() => {
                        const immediateActions = readStringArray(
                          evt.payload,
                          "immediate_actions",
                        );
                        const routeLabel =
                          typeof evt.payload.route_label === "string"
                            ? evt.payload.route_label
                            : null;
                        const closureReason =
                          typeof evt.payload.closure_reason === "string"
                            ? evt.payload.closure_reason
                            : null;

                        return (
                          <>
                            {routeLabel ? <p>Rota: {routeLabel}</p> : null}
                            {closureReason ? (
                              <p>Desfecho: {closureReason.replaceAll("_", " ")}</p>
                            ) : null}
                            {immediateActions.length > 0 ? (
                              <p>Passos: {immediateActions.join(" | ")}</p>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {evt.dominio === "reproducao" && evt.details && (
                    <div className="mt-1 rounded border border-rose-100 bg-rose-50/50 p-2 text-xs">
                      {evt.details.macho_id && (
                        <p>Reprodutor: {evt.machoIdentificacao || evt.details.macho_id}</p>
                      )}
                      {evt.details.payload && (
                        <>
                          {typeof (evt.details.payload as ReproDetailsPayload).diagnostico_resultado ===
                            "string" && (
                            <p>
                              Diagnostico:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload)
                                  .diagnostico_resultado as string
                              }
                            </p>
                          )}
                          {typeof (evt.details.payload as ReproDetailsPayload).resultado ===
                            "string" && (
                            <p>
                              Diagnostico:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload).resultado as string
                              }
                            </p>
                          )}
                          {typeof (evt.details.payload as ReproDetailsPayload).numero_crias ===
                            "number" && (
                            <p>
                              Crias:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload)
                                  .numero_crias as number
                              }
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <div className="grid gap-3">
            {agenda?.map((entry) => (
              <Card
                key={entry.item.id}
                className={
                  entry.item.status === "agendado"
                    ? "border-amber-200 bg-amber-50/30"
                    : ""
                }
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {formatAgendaTipoLabel(entry.item.tipo)}
                      </p>
                      {entry.scheduleModeLabel || entry.scheduleAnchorLabel ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {entry.scheduleModeLabel ? (
                            <Badge variant="outline" className="text-[10px]">
                              {entry.scheduleModeLabel}
                            </Badge>
                          ) : null}
                          {entry.scheduleAnchorLabel ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {entry.scheduleAnchorLabel}
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="text-[10px] text-muted-foreground">
                        Previsto: {formatDate(entry.item.data_prevista)}
                        {entry.scheduleLabel ? ` | ${entry.scheduleLabel}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      entry.item.status === "agendado" ? "default" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {entry.item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {agenda?.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                Sem tarefas agendadas.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <MoverAnimalLote
        animal={animal}
        open={showMoverLote}
        onOpenChange={setShowMoverLote}
        onSuccess={() => {}}
      />

      <Dialog open={showSanitaryAlertDialog} onOpenChange={setShowSanitaryAlertDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Abrir suspeita sanitaria para {animal.identificacao}
            </DialogTitle>
            <DialogDescription>
              Este fluxo registra a suspeita como evento append-only e congela a
              movimentacao do animal ate o desfecho local.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Doenca / suspeita oficial</Label>
                <Select
                  value={selectedOfficialDisease?.codigo ?? sanitaryAlertForm.diseaseCode}
                  onValueChange={(value) =>
                    setSanitaryAlertForm((prev) => ({ ...prev, diseaseCode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a suspeita" />
                  </SelectTrigger>
                  <SelectContent>
                    {(officialDiseases ?? []).map((disease) => (
                      <SelectItem key={disease.codigo} value={disease.codigo}>
                        {disease.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de notificacao</Label>
                <Input
                  value={selectedOfficialDisease?.tipo_notificacao ?? "imediata"}
                  readOnly
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={sanitaryAlertForm.sinaisDesconhecidos}
                  onChange={(event) =>
                    setSanitaryAlertForm((prev) => ({
                      ...prev,
                      sinaisDesconhecidos: event.target.checked,
                    }))
                  }
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">
                    Sinais de causa desconhecida
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Aciona suspeita notificavel imediata.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={sanitaryAlertForm.mortalidadeAlta}
                  onChange={(event) =>
                    setSanitaryAlertForm((prev) => ({
                      ...prev,
                      mortalidadeAlta: event.target.checked,
                    }))
                  }
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">
                    Mortalidade alta ou inesperada
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Mantem o bloqueio local ate avaliacao do caso.
                  </p>
                </div>
              </label>
            </div>

            {selectedOfficialDiseaseSignals.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm font-medium text-amber-950">
                  Sinais oficiais de alerta
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedOfficialDiseaseSignals.map((signal) => (
                    <Badge
                      key={signal}
                      variant="outline"
                      className="border-amber-200 bg-white text-amber-900"
                    >
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedOfficialDiseaseActions.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm font-medium text-amber-950">
                  Passos imediatos recomendados
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {selectedOfficialDiseaseActions.map((action) => (
                    <li key={action}>- {action}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="sanitary_alert_route">Rota imediata / contato</Label>
              <Input
                id="sanitary_alert_route"
                value={sanitaryAlertForm.routeLabel}
                onChange={(event) =>
                  setSanitaryAlertForm((prev) => ({
                    ...prev,
                    routeLabel: event.target.value,
                  }))
                }
                placeholder="Ex.: Acionar SVO e registrar no e-Sisbravet"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sanitary_alert_obs">Observacoes</Label>
              <Textarea
                id="sanitary_alert_obs"
                value={sanitaryAlertForm.observacoes}
                onChange={(event) =>
                  setSanitaryAlertForm((prev) => ({
                    ...prev,
                    observacoes: event.target.value,
                  }))
                }
                placeholder="Descreva sinais, lote exposto, mortalidade ou contexto do caso."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSanitaryAlertDialog(false)}
              disabled={isSubmittingSanitaryAlert}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleOpenSanitaryAlert()}
              disabled={isSubmittingSanitaryAlert || !selectedOfficialDisease}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isSubmittingSanitaryAlert ? "Abrindo..." : "Abrir suspeita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCloseSanitaryAlertDialog}
        onOpenChange={setShowCloseSanitaryAlertDialog}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Encerrar suspeita sanitaria
            </DialogTitle>
            <DialogDescription>
              O bloqueio local de movimentacao sera removido, mas o historico do
              alerta continuara append-only na timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              {activeSanitaryAlert?.diseaseName ?? "Suspeita sanitaria"} em{" "}
              {formatDate(activeSanitaryAlert?.openedAt)}
            </div>

            <div className="space-y-2">
              <Label>Desfecho local</Label>
              <Select
                value={sanitaryAlertResolution.closureReason}
                onValueChange={(value) =>
                  setSanitaryAlertResolution((prev) => ({
                    ...prev,
                    closureReason: value as SanitaryAlertClosureReason,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o desfecho" />
                </SelectTrigger>
                <SelectContent>
                  {SANITARY_ALERT_CLOSURE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sanitary_alert_close_notes">Observacoes de encerramento</Label>
              <Textarea
                id="sanitary_alert_close_notes"
                value={sanitaryAlertResolution.closureNotes}
                onChange={(event) =>
                  setSanitaryAlertResolution((prev) => ({
                    ...prev,
                    closureNotes: event.target.value,
                  }))
                }
                placeholder="Descreva o exame, orientacao veterinaria ou desfecho local."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCloseSanitaryAlertDialog(false)}
              disabled={isClosingSanitaryAlert}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCloseSanitaryAlert()}
              disabled={isClosingSanitaryAlert || !activeSanitaryAlert}
            >
              {isClosingSanitaryAlert ? "Encerrando..." : "Confirmar encerramento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showObitoDialog} onOpenChange={setShowObitoDialog}>
        <AlertDialogContent className="sm:max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Skull className="h-5 w-5" />
              Registrar obito de {animal.identificacao}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao marcara o animal como morto, removendo-o de lotes ativos e cancelando todas as tarefas agendadas. Esta operacao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="data_obito">Data do obito</Label>
              <Input
                id="data_obito"
                type="date"
                value={obitoData}
                onChange={(e) => setObitoData(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="causa_obito">Causa provavel</Label>
              <Select
                value={obitoCausa}
                onValueChange={(v) => setObitoCausa(v as CausaObitoEnum)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a causa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doenca">Doença</SelectItem>
                  <SelectItem value="acidente">Acidente</SelectItem>
                  <SelectItem value="predador">Predador</SelectItem>
                  <SelectItem value="outro">Outro / Desconhecida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obs_obito">Observacoes/Detalhes</Label>
              <Textarea
                id="obs_obito"
                placeholder="Descreva detalhes ou sintomas se houver..."
                value={obitoObs}
                onChange={(e) => setObitoObs(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegisteringObito}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegisterObito}
              disabled={isRegisteringObito}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRegisteringObito ? "Registrando..." : "Confirmar obito"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showCloseSociedadeDialog}
        onOpenChange={setShowCloseSociedadeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sociedade?</AlertDialogTitle>
            <AlertDialogDescription>
              O vinculo societario deste animal sera encerrado na fazenda ativa.
              Use apenas quando o compartilhamento realmente terminou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosingSociedade}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseSociedade}
              disabled={isClosingSociedade}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClosingSociedade ? "Encerrando..." : "Confirmar encerramento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnimalDetalhe;
