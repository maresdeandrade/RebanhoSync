import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  ClipboardCheck,
  Dna,
  DollarSign,
  FileText,
  Handshake,
  HeartPulse,
  History,
  Lock,
  MoreHorizontal,
  MoreVertical,
  MoveRight,
  Pencil,
  Scale,
  Skull,
  Syringe,
  Trash2,
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
import { AnimalVisualAvatar } from "@/components/animals/AnimalVisualAvatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils";
import type {
  AgendaItem,
  Animal,
  Evento,
  EventoReproducao,
  CausaObitoEnum,
  SanitarioCaso,
  EventoComercial,
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
import { buildSanitaryCaseFlowSummary } from "@/lib/sanitario/compliance/caseFlow";
import {
  buildClinicalProtocolSupport,
  buildClinicalProtocolTimelineSummary,
} from "@/lib/sanitario/compliance/clinicalProtocols";
import { useAnimalWithdrawal } from "@/lib/sanitario/hooks/useWithdrawal";
import { WithdrawalBadgePanel } from "@/components/sanitario/WithdrawalBadgePanel";
import {
  formatWeight,
  formatWeightPerDay,
  formatWeightValue,
} from "@/lib/format/weight";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/infrastructure/agendaSchedule";
import { resolveCurrentWeight } from "@/lib/insights/pesoAtual";
import { showError, showSuccess } from "@/utils/toast";
import {
  CLINICAL_CASE_CLOSURE_REASONS,
  getClinicalCaseClosureReason,
  isOpenSanitaryCase,
  validateClinicalCaseClosureInput,
  type ClinicalCaseClosureReason,
} from "./animalDetalheClinicalCase";

type EnrichedEvent = Evento & {
  details?: EventoReproducao;
  machoIdentificacao?: string;
  detailsComercial?: EventoComercial;
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

type ClinicalCaseClosureState = {
  caseId: string | null;
  reason: ClinicalCaseClosureReason;
  notes: string;
};

const resolveSanitaryCaseStatusOnAlertClosure = (
  closureReason: SanitaryAlertClosureReason,
) =>
  closureReason === "notificada_em_acompanhamento"
    ? "em_acompanhamento"
    : "encerrado";

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

function formatSanitaryCaseStatus(value: SanitarioCaso["status"]) {
  return value.replaceAll("_", " ");
}

function formatSanitaryCaseScope(value: SanitarioCaso) {
  if (value.tipo === "notificavel") {
    return value.notification_type
      ? `Notificacao ${value.notification_type}`
      : "Caso notificavel";
  }

  return "Caso clinico";
}

function formatCaseTimelineEventLabel(event: EnrichedEvent) {
  const payloadTipo = event.payload.tipo;

  if (typeof payloadTipo === "string" && payloadTipo.length > 0) {
    return formatAgendaTipoLabel(payloadTipo);
  }

  return formatAgendaTipoLabel(event.dominio);
}

type AnimalSanitaryCasesPanelProps = {
  animalId: string;
  cases: SanitarioCaso[] | undefined;
  eventsByCase: Map<string, EnrichedEvent[]>;
  onCloseClinicalCase: (caseRecord: SanitarioCaso) => void;
};

function buildClinicalGuidanceRegisterUrl(input: {
  animalId: string;
  caseId: string;
  protocolId: string;
  itemId: string;
  productName: string;
}) {
  const params = new URLSearchParams({
    dominio: "sanitario",
    animalId: input.animalId,
    sanitarioTipo: "medicamento",
    sanitarioCasoId: input.caseId,
    produto: input.productName,
    clinicalProtocolId: input.protocolId,
    clinicalProtocolItemId: input.itemId,
  });

  return `/registrar?${params.toString()}`;
}

export function AnimalSanitaryCasesPanel({
  animalId,
  cases,
  eventsByCase,
  onCloseClinicalCase,
}: AnimalSanitaryCasesPanelProps) {
  const [clinicalProtocolFilter, setClinicalProtocolFilter] = useState("todos");
  const caseEntries = useMemo(
    () =>
      (cases ?? []).map((caseRecord) => {
        const linkedEvents = eventsByCase.get(caseRecord.id) ?? [];
        const clinicalProtocolSupport = buildClinicalProtocolSupport({
          caseRecord,
          events: linkedEvents,
        });
        const timelineSummaries = linkedEvents
          .map((event) => buildClinicalProtocolTimelineSummary(event.payload))
          .filter(
            (
              summary,
            ): summary is NonNullable<ReturnType<typeof buildClinicalProtocolTimelineSummary>> =>
              Boolean(summary),
          );

        return {
          caseRecord,
          linkedEvents,
          clinicalProtocolSupport,
          timelineSummaries,
        };
      }),
    [cases, eventsByCase],
  );
  const clinicalProtocolFilterOptions = useMemo(() => {
    const byProtocol = new Map<
      string,
      { protocolId: string; title: string; caseIds: Set<string> }
    >();

    for (const entry of caseEntries) {
      const summaries = [
        entry.clinicalProtocolSupport
          ? {
              protocolId: entry.clinicalProtocolSupport.protocolId,
              title: entry.clinicalProtocolSupport.title,
            }
          : null,
        ...entry.timelineSummaries.map((summary) => ({
          protocolId: summary.protocolId,
          title: summary.protocolTitle,
        })),
      ].filter(
        (
          summary,
        ): summary is { protocolId: string; title: string } => summary !== null,
      );

      for (const summary of summaries) {
        const current =
          byProtocol.get(summary.protocolId) ??
          {
            protocolId: summary.protocolId,
            title: summary.title,
            caseIds: new Set<string>(),
          };
        current.caseIds.add(entry.caseRecord.id);
        byProtocol.set(summary.protocolId, current);
      }
    }

    return Array.from(byProtocol.values()).sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }, [caseEntries]);
  const filteredCaseEntries =
    clinicalProtocolFilter === "todos"
      ? caseEntries
      : caseEntries.filter((entry) => {
          if (
            entry.clinicalProtocolSupport?.protocolId === clinicalProtocolFilter
          ) {
            return true;
          }

          return entry.timelineSummaries.some(
            (summary) => summary.protocolId === clinicalProtocolFilter,
          );
        });

  return (
    <div className="grid gap-3">
      {clinicalProtocolFilterOptions.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-background/80 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Roteiro clinico
              </p>
              <p className="text-sm text-muted-foreground">
                {filteredCaseEntries.length} de {caseEntries.length} casos
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={
                  clinicalProtocolFilter === "todos" ? "default" : "outline"
                }
                onClick={() => setClinicalProtocolFilter("todos")}
              >
                Todos
              </Button>
              {clinicalProtocolFilterOptions.map((option) => (
                <Button
                  key={option.protocolId}
                  type="button"
                  size="sm"
                  variant={
                    clinicalProtocolFilter === option.protocolId
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setClinicalProtocolFilter(option.protocolId)}
                >
                  {option.title} ({option.caseIds.size})
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {filteredCaseEntries.map((entry) => {
        const { caseRecord, linkedEvents, clinicalProtocolSupport } = entry;
        const summary = buildSanitaryCaseFlowSummary({
          caseRecord,
          alert: null,
        });
        const timelineEvents = linkedEvents
          .slice()
          .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
        const isOpen = isOpenSanitaryCase(caseRecord);

        return (
          <Card
            key={caseRecord.id}
            className={
              isOpen
                ? "border-warning/25 bg-warning-muted/30 shadow-none"
                : "shadow-none"
            }
          >
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {summary?.primaryLabel ??
                        caseRecord.disease_name ??
                        "Caso sanitario"}
                    </p>
                    <Badge variant={isOpen ? "default" : "secondary"}>
                      {formatSanitaryCaseStatus(caseRecord.status)}
                    </Badge>
                    <Badge variant="outline">
                      {formatSanitaryCaseScope(caseRecord)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aberto em {formatDate(caseRecord.opened_at)}
                    {caseRecord.closed_at
                      ? ` | Encerrado em ${formatDate(caseRecord.closed_at)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isOpen ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to={`/registrar?dominio=sanitario&animalId=${encodeURIComponent(
                          animalId,
                        )}&sanitarioTipo=medicamento&sanitarioCasoId=${encodeURIComponent(
                          caseRecord.id,
                        )}`}
                      >
                        Registrar manejo
                      </Link>
                    </Button>
                  ) : null}
                  {isOpen && caseRecord.tipo === "clinico" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => onCloseClinicalCase(caseRecord)}
                    >
                      Encerrar caso
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Eventos vinculados
                  </p>
                  <p className="mt-1 font-semibold">{linkedEvents.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Bloqueio
                  </p>
                  <p className="mt-1 font-semibold">
                    {caseRecord.movement_blocked ? "Ativo" : "Inativo"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Desfecho
                  </p>
                  <p className="mt-1 font-semibold">
                    {caseRecord.closure_reason
                      ? caseRecord.closure_reason.replaceAll("_", " ")
                      : "-"}
                  </p>
                </div>
              </div>

              {caseRecord.observacoes ? (
                <p className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                  {caseRecord.observacoes}
                </p>
              ) : null}

              {clinicalProtocolSupport ? (
                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-sky-900 dark:text-sky-200">
                        Apoio clinico
                      </p>
                      <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
                        {clinicalProtocolSupport.title}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-sky-300 text-sky-900">
                      {clinicalProtocolSupport.sourceLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-sky-950/80 dark:text-sky-100/80">
                    {clinicalProtocolSupport.summary}
                  </p>
                  {clinicalProtocolSupport.reference ? (
                    <p className="text-xs text-sky-900/75 dark:text-sky-200/80">
                      Referencia: {clinicalProtocolSupport.reference}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    {clinicalProtocolSupport.guidanceItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-sky-200/80 bg-background/80 p-3 dark:border-sky-900/50"
                      >
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.detail}
                        </p>
                        {item.note ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.note}
                          </p>
                        ) : null}
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="mt-3 h-8 rounded-full border-sky-300 text-xs text-sky-900 shadow-none"
                        >
                          <Link
                            to={buildClinicalGuidanceRegisterUrl({
                              animalId,
                              caseId: caseRecord.id,
                              protocolId: clinicalProtocolSupport.protocolId,
                              itemId: item.id,
                              productName: item.label,
                            })}
                          >
                            Registrar conduta
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 text-xs text-sky-900/80 dark:text-sky-200/80">
                    {clinicalProtocolSupport.safetyNotes.map((note) => (
                      <p key={note}>- {note}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Timeline do caso
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {timelineEvents.length}
                  </Badge>
                </div>

                {timelineEvents.length > 0 ? (
                  <div className="space-y-3">
                    {timelineEvents.map((event) => {
                      const clinicalTimelineSummary =
                        buildClinicalProtocolTimelineSummary(event.payload);

                      return (
                        <div
                          key={event.id}
                          className="border-l-2 border-primary/30 pl-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {formatCaseTimelineEventLabel(event)}
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              {formatDate(event.occurred_at)}
                            </Badge>
                            {clinicalTimelineSummary ? (
                              <Badge variant="outline" className="text-[10px]">
                                Roteiro clinico
                              </Badge>
                            ) : null}
                          </div>
                          {event.observacoes ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {event.observacoes}
                            </p>
                          ) : null}
                          {clinicalTimelineSummary ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Roteiro: {clinicalTimelineSummary.protocolTitle}
                              {clinicalTimelineSummary.itemLabel
                                ? ` | Conduta: ${clinicalTimelineSummary.itemLabel}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum evento vinculado a este caso.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {cases?.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          Sem casos sanitarios registrados.
        </p>
      )}
      {(cases?.length ?? 0) > 0 && filteredCaseEntries.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum caso sanitario encontrado para este roteiro clinico.
        </p>
      ) : null}
    </div>
  );
}

const AnimalDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { farmLifecycleConfig, farmMeasurementConfig, activeFarmId: fazendaId } = useAuth();
  const carenciaModel = useAnimalWithdrawal(id ?? null, fazendaId ?? null);
  const [showMoverLote, setShowMoverLote] = useState(false);
  const [showCloseSociedadeDialog, setShowCloseSociedadeDialog] =
    useState(false);
  const [isApplyingLifecycle, setIsApplyingLifecycle] = useState(false);
  const [isClosingSociedade, setIsClosingSociedade] = useState(false);
  const [showObitoDialog, setShowObitoDialog] = useState(false);
  const [isRegisteringObito, setIsRegisteringObito] = useState(false);
  const [obitoData, setObitoData] = useState(
    new Date().toISOString().split("T")[0],
  );
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
  const [clinicalCaseClosure, setClinicalCaseClosure] =
    useState<ClinicalCaseClosureState>({
      caseId: null,
      reason: "resolvido",
      notes: "",
    });
  const [isClosingClinicalCase, setIsClosingClinicalCase] = useState(false);
  const autoAppliedStageRef = useRef<string | null>(null);

  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const animalLote = useLiveQuery(
    () =>
      animal?.lote_id && fazendaId
        ? db.state_lotes.get({ id: animal.lote_id, fazenda_id: fazendaId })
        : undefined,
    [animal?.lote_id, fazendaId],
  );

  const activeSocietyLink = useLiveQuery(
    async () => {
      if (!animal?.id || !fazendaId) return null;
      const links = await db.state_sociedade_animais.where({ fazenda_id: fazendaId, animal_id: animal.id, status: "ativo" }).toArray();
      if (links.length === 0) return null;
      const society = await db.state_sociedades_pecuarias.get({ id: links[0].sociedade_id, fazenda_id: fazendaId });
      return society ? { ...society, ...links[0] } : null;
    },
    [animal?.id, fazendaId]
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
      .filter(
        (candidate) => candidate.mae_id === animal.id && !candidate.deleted_at,
      )
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
        if (evt.dominio === "comercial") {
          const detailsComercial = await db.event_eventos_comercial.get(evt.id);
          return { ...evt, detailsComercial } as EnrichedEvent;
        }
        return evt as EnrichedEvent;
      }),
    );
  }, [id]);

  const animalComerciais = useMemo(() => {
    if (!eventos) return [];
    return eventos
      .filter((evt) => evt.dominio === "comercial" && evt.detailsComercial && !evt.deleted_at)
      .map((evt) => evt.detailsComercial!);
  }, [eventos]);

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
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          ),
      ),
    );
    const protocolItems =
      protocolItemIds.length > 0
        ? await db.state_protocolos_sanitarios_itens.bulkGet(protocolItemIds)
        : [];
    const protocolItemById = new Map(
      protocolItems
        .filter((item): item is NonNullable<(typeof protocolItems)[number]> =>
          Boolean(item),
        )
        .map((item) => [item.id, item]),
    );

    return items
      .slice()
      .sort((left, right) =>
        left.data_prevista.localeCompare(right.data_prevista),
      )
      .map((item): AnimalAgendaRow => {
        const protocolItem = item.protocol_item_version_id
          ? (protocolItemById.get(item.protocol_item_version_id) ?? null)
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
      .filter((event) => event.dominio === "pesagem" && !event.deleted_at)
      .toArray();

    if (!registros.length) return null;

    const withDetails = await Promise.all(
      registros.map(async (event) => {
        const detail = await db.event_eventos_pesagem.get(event.id);
        return detail?.peso_kg != null
          ? {
              animal_id: event.animal_id ?? null,
              fazenda_id: event.fazenda_id,
              dominio: event.dominio,
              occurred_at: event.occurred_at,
              deleted_at: event.deleted_at ?? null,
              detail_deleted_at: detail.deleted_at ?? null,
              peso_kg: detail.peso_kg,
            }
          : null;
      }),
    );

    const eligible = withDetails.filter(
      (e): e is NonNullable<typeof e> => e !== null,
    );

    const resolved = resolveCurrentWeight(eligible);
    return resolved
      ? { peso_kg: resolved.peso_kg, data: resolved.pesado_em }
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

  const ultimoEcc = useLiveQuery(async () => {
    if (!id) return null;

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "ecc" && !event.deleted_at)
      .toArray();

    if (!registros.length) return null;

    const withDetails = await Promise.all(
      registros.map(async (event) => {
        const detail = await db.event_eventos_ecc.get(event.id);
        return detail?.ecc != null
          ? {
              event_id: event.id,
              occurred_at: event.occurred_at,
              deleted_at: event.deleted_at ?? null,
              ecc: detail.ecc,
              escala_min: detail.escala_min,
              escala_max: detail.escala_max,
              escala_passo: detail.escala_passo,
              observacoes: detail.observacoes,
            }
          : null;
      }),
    );

    const eligible = withDetails
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    return eligible[0] ?? null;
  }, [id]);

  const historicoEcc = useLiveQuery(async () => {
    if (!id) return [];

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "ecc" && !event.deleted_at)
      .toArray();

    const pontos = await Promise.all(
      registros.map(async (event) => {
        const details = await db.event_eventos_ecc.get(event.id);
        if (!details?.ecc) return null;

        const dataReferencia = event.occurred_at;
        return {
          id: event.id,
          data: dataReferencia.slice(0, 10),
          dataLabel: formatDate(dataReferencia),
          occurred_at: event.occurred_at,
          ecc: details.ecc,
          escalaMin: details.escala_min,
          escalaMax: details.escala_max,
          escalaPasso: details.escala_passo,
          observacoes: details.observacoes,
        };
      }),
    );

    return pontos
      .filter((ponto): ponto is NonNullable<typeof ponto> => ponto !== null)
      .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
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
  const sanitaryCases = useLiveQuery(async () => {
    if (!animal?.id || !animal.fazenda_id) return [] as SanitarioCaso[];

    const cases = await db.state_sanitario_casos
      .where("[fazenda_id+animal_id]")
      .equals([animal.fazenda_id, animal.id])
      .filter((caseRecord) => !caseRecord.deleted_at)
      .toArray();

    return cases.sort((left, right) =>
      right.opened_at.localeCompare(left.opened_at),
    );
  }, [animal?.fazenda_id, animal?.id]);
  const activeSanitaryCase = useLiveQuery(async () => {
    if (!animal?.id || !animal.fazenda_id) return null;
    const cases = await db.state_sanitario_casos
      .where("[fazenda_id+animal_id]")
      .equals([animal.fazenda_id, animal.id])
      .and(
        (caseRecord) =>
          !caseRecord.deleted_at &&
          (caseRecord.status === "aberto" ||
            caseRecord.status === "em_acompanhamento"),
      )
      .toArray();

    return (
      cases.sort((left, right) =>
        right.opened_at.localeCompare(left.opened_at),
      )[0] ?? null
    );
  }, [animal?.fazenda_id, animal?.id]);
  const sanitaryCaseFlowSummary = useMemo(
    () =>
      buildSanitaryCaseFlowSummary({
        caseRecord: activeSanitaryCase ?? null,
        alert: activeSanitaryAlert,
      }),
    [activeSanitaryAlert, activeSanitaryCase],
  );
  const sanitaryEventsByCase = useMemo(() => {
    const byCase = new Map<string, EnrichedEvent[]>();

    for (const event of eventos ?? []) {
      if (!event.sanitario_caso_id) continue;
      const current = byCase.get(event.sanitario_caso_id) ?? [];
      current.push(event);
      byCase.set(event.sanitario_caso_id, current);
    }

    return byCase;
  }, [eventos]);
  const hasMovementBlockedSanitaryAlert = hasOpenSanitaryAlert(animal?.payload);
  const selectedOfficialDisease = useMemo(() => {
    const diseases = officialDiseases ?? [];
    return (
      diseases.find(
        (disease) => disease.codigo === sanitaryAlertForm.diseaseCode,
      ) ??
      diseases[0] ??
      null
    );
  }, [officialDiseases, sanitaryAlertForm.diseaseCode]);
  const selectedOfficialDiseaseSignals = useMemo(
    () =>
      readStringArray(selectedOfficialDisease?.sinais_alerta_json, "sinais"),
    [selectedOfficialDisease],
  );
  const selectedOfficialDiseaseActions = useMemo(
    () =>
      readStringArray(selectedOfficialDisease?.acao_imediata_json, "passos"),
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
  const maleDestination = animal
    ? getAnimalProductiveDestination(animal)
    : null;
  const maleReproductiveStatus = animal
    ? getMaleReproductiveStatus(animal)
    : null;
  const transitionMode = animal ? getAnimalTransitionMode(animal) : null;
  const effectiveTransitionMode =
    lifecycleSnapshot?.transitionMode ?? transitionMode;
  const isBreedingMale = animal ? isAnimalBreedingEligible(animal) : false;
  const reproResumo = useMemo(() => {
    if (!animal || !isReproductionEligible) return null;

    const dashboard = buildReproductionDashboard({
      animals: [animal],
      lotes: animalLote ? [animalLote] : [],
      events: (eventos ?? [])
        .filter((evt) => evt.dominio === "reproducao" && !evt.deleted_at)
        .map((evt) => ({
          ...evt,
          details: evt.details,
        })),
    });

    return dashboard.animals[0] ?? null;
  }, [animal, isReproductionEligible, animalLote, eventos]);
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
      (crias ?? []).filter((calf) => hasPendingNeonatalSetup(calf.payload))
        .length,
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

  const applyLifecycleTransition = useCallback(
    async (source: "manual" | "automatico", silent = false) => {
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
    },
    [animal, lifecycleSnapshot],
  );

  useEffect(() => {
    if (!animal || !lifecycleSnapshot?.canAutoApply || isApplyingLifecycle) {
      return;
    }

    if (autoAppliedStageRef.current === lifecycleSnapshot.targetStage) {
      return;
    }

    autoAppliedStageRef.current = lifecycleSnapshot.targetStage;
    void applyLifecycleTransition("automatico", true);
  }, [
    animal,
    applyLifecycleTransition,
    isApplyingLifecycle,
    lifecycleSnapshot,
  ]);

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
      const pendingTasks =
        agenda
          ?.filter((item) => item.status === "agendado")
          .map((item) => item.id) || [];

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
      showError(
        "Catalogo oficial de doencas notificaveis ainda nao esta disponivel.",
      );
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
        sanitarioCaso: {
          action: "open",
          tipo: "notificavel",
          diseaseCode: selectedOfficialDisease.codigo,
          diseaseName: selectedOfficialDisease.nome,
          notificationType: selectedOfficialDisease.tipo_notificacao,
          requiresImmediateNotification:
            selectedOfficialDisease.tipo_notificacao === "imediata",
          movementBlocked: true,
          observacoes: sanitaryAlertForm.observacoes,
          payload: {
            route_label: routeLabel,
            immediate_actions: selectedOfficialDiseaseActions,
            alert_signals: alertSignals,
          },
        },
      });

      await createGesture(animal.fazenda_id, ops);
      setShowSanitaryAlertDialog(false);
      setSanitaryAlertForm((prev) => ({
        ...prev,
        observacoes: "",
        sinaisDesconhecidos: false,
        mortalidadeAlta: false,
      }));
      showSuccess(
        "Suspeita sanitaria aberta com bloqueio local de movimentacao.",
      );
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
        sanitarioCaso: activeSanitaryCase
          ? {
              action: "close",
              id: activeSanitaryCase.id,
              status: resolveSanitaryCaseStatusOnAlertClosure(
                sanitaryAlertResolution.closureReason,
              ),
              closureReason: sanitaryAlertResolution.closureReason,
              observacoes: sanitaryAlertResolution.closureNotes,
              movementBlocked: false,
            }
          : undefined,
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
  }, [activeSanitaryAlert, activeSanitaryCase, animal, sanitaryAlertResolution]);

  const handleOpenCloseClinicalCaseDialog = useCallback(
    (caseRecord: SanitarioCaso) => {
      setClinicalCaseClosure({
        caseId: caseRecord.id,
        reason: "resolvido",
        notes: "",
      });
    },
    [],
  );

  const handleCloseClinicalCase = useCallback(async () => {
    if (!animal || !clinicalCaseClosure.caseId) return;

    const caseToClose =
      sanitaryCases?.find((caseRecord) => caseRecord.id === clinicalCaseClosure.caseId) ??
      null;
    const reason = clinicalCaseClosure.reason;
    const notes = clinicalCaseClosure.notes.trim();
    const validationMessage = validateClinicalCaseClosureInput({
      caseRecord: caseToClose,
      reason,
      notes,
    });

    if (validationMessage) {
      showError(validationMessage);
      return;
    }

    setIsClosingClinicalCase(true);
    try {
      await createGesture(animal.fazenda_id, [
        {
          table: "sanitario_casos",
          action: "UPDATE",
          record: {
            id: clinicalCaseClosure.caseId,
            status: "encerrado",
            closed_at: new Date().toISOString(),
            closure_reason: reason,
            observacoes: notes || caseToClose?.observacoes || null,
            movement_blocked: false,
          },
        },
      ]);

      setClinicalCaseClosure({
        caseId: null,
        reason: "resolvido",
        notes: "",
      });
      showSuccess("Caso clinico encerrado.");
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel encerrar o caso clinico.");
    } finally {
      setIsClosingClinicalCase(false);
    }
  }, [animal, clinicalCaseClosure, sanitaryCases]);

  if (!animal) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando animal...
      </div>
    );
  }

  const registrarAnimalPath = `/registrar?animalId=${encodeURIComponent(animal.id)}${animal.lote_id ? `&loteId=${encodeURIComponent(animal.lote_id)}` : ""}`;
  const selectedClinicalCaseClosureReason = getClinicalCaseClosureReason(
    clinicalCaseClosure.reason,
  );
  const clinicalCaseClosureNotesLength = clinicalCaseClosure.notes.trim().length;
  const canConfirmClinicalCaseClosure =
    Boolean(clinicalCaseClosure.caseId) &&
    (!selectedClinicalCaseClosureReason.requiresNotes ||
      clinicalCaseClosureNotesLength >= 10) &&
    clinicalCaseClosureNotesLength <= 1000;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3 sm:gap-4">
            <Link to="/animais">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <AnimalVisualAvatar
              categoriaLabel={categoriaLabel}
              sexo={animal.sexo}
              size="lg"
              className="border-border bg-muted text-primary"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-normal text-foreground">
                    {animal.identificacao}
                  </h1>
                  <Badge variant="outline">
                    {animal.sexo === "M" ? "Macho" : "Femea"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[
                    animal.raca ? getAnimalBreedLabel(animal.raca) : null,
                    animalLote ? `Lote: ${animalLote.nome}` : "Sem lote definido",
                    animal.nome ? `Nome: ${animal.nome}` : null,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AnimalCategoryBadge categoriaLabel={categoriaLabel} />
                <Badge variant="outline">
                  Status: {animal.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto lg:justify-end">
            {hasMovementBlockedSanitaryAlert && (
              <Button
                size="sm"
                variant="outline"
                className="border-warning/40 text-warning-foreground hover:bg-warning-muted"
                onClick={() => setShowCloseSanitaryAlertDialog(true)}
                disabled={animal.status !== "ativo"}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Encerrar suspeita
              </Button>
            )}
            {animal.status === "ativo" && !hasMovementBlockedSanitaryAlert ? (
              <Button size="sm" asChild>
                <Link to={registrarAnimalPath}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Registrar manejo
                </Link>
              </Button>
            ) : (
              <Button size="sm" disabled>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Registrar manejo
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Mais acoes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("quick", "venda");
                    params.set("animalId", animal.id);
                    if (animal.lote_id) {
                      params.set("loteId", animal.lote_id);
                    }
                    navigate(`/registrar?${params.toString()}`);
                  }}
                  disabled={
                    animal.status !== "ativo" || hasMovementBlockedSanitaryAlert
                  }
                >
                  <Handshake className="mr-2 h-4 w-4" />
                  Registrar venda
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowObitoDialog(true)}
                  disabled={animal.status !== "ativo"}
                >
                  <Skull className="mr-2 h-4 w-4" />
                  Registrar obito
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowMoverLote(true)}
                  disabled={hasMovementBlockedSanitaryAlert}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Mover lote
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/animais/${id}/editar`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar cadastro
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">
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

        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Informacoes basicas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <AnimalCategoryBadge categoriaLabel={categoriaLabel} />
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
              <Badge variant="outline">
                {getAnimalBreedLabel(animal.raca)}
              </Badge>
            )}
            {animal.sexo === "M" && maleDestination && (
              <Badge
                variant="outline"
                className="border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
              >
                {getAnimalProductiveDestinationLabel(maleDestination)}
              </Badge>
            )}
            {activeSocietyLink && (
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                <Handshake className="h-3 w-3 mr-1" />
                Sociedade {activeSocietyLink.percentual_fazenda}/{activeSocietyLink.percentual_parceiro}
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
                {sociedadeAtiva.percentual &&
                  ` (${sociedadeAtiva.percentual}%)`}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">
              Proximo manejo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {proximaAgenda
                ? formatDate(proximaAgenda.item.data_prevista)
                : "Sem agenda"}
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
                {proximaAgenda.scheduleModeLabel ||
                proximaAgenda.scheduleAnchorLabel ? (
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

      {(animal.payload as Record<string, unknown> | undefined)?.compliance_state === "catch_up_required" ||
      (animal.payload as Record<string, unknown> | undefined)?.history_confidence === "unknown" ? (
        <Card className="border-amber-200 bg-amber-50/50 shadow-none dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Catch-up sanitario necessario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {(animal.payload as Record<string, unknown> | undefined)?.history_confidence === "unknown"
                ? "Este animal entrou sem historico sanitario confirmado. Documente o atestado de compra ou execute o protocolo de entrada para estabilizar a agenda."
                : "A conformidade sanitaria deste animal esta pendente de atualizacao. Execute as acoes recomendadas para regularizar."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("dominio", "sanitario");
                  params.set("animalId", animal.id);
                  if (animal.lote_id) {
                    params.set("loteId", animal.lote_id);
                  }
                  navigate(`/registrar?${params.toString()}`);
                }}
                disabled={animal.status !== "ativo"}
              >
                <HeartPulse className="mr-2 h-4 w-4" />
                Registrar manejo sanitario
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("dominio", "conformidade");
                  params.set("animalId", animal.id);
                  navigate(`/registrar?${params.toString()}`);
                }}
                disabled={animal.status !== "ativo"}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Documentar atestado
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeSanitaryAlert?.status === "suspeita_aberta" ? (
        <Card className="border-warning/25 bg-warning-muted/50 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Suspeita sanitaria aberta
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {sanitaryCaseFlowSummary ? (
                  <Badge variant="secondary">
                    {sanitaryCaseFlowSummary.statusLabel}
                  </Badge>
                ) : null}
                <Badge className="bg-warning text-warning-foreground">
                  Movimentacao bloqueada
                </Badge>
                {activeSanitaryAlert.notificationType ? (
                  <Badge variant="outline">
                    Notificacao {activeSanitaryAlert.notificationType}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Doenca / suspeita
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {activeSanitaryAlert.diseaseName ?? "Suspeita sanitaria"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Aberta em
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {formatDate(activeSanitaryAlert.openedAt)}
                </p>
              </div>
              {sanitaryCaseFlowSummary ? (
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Fluxo
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {sanitaryCaseFlowSummary.scopeLabel}
                  </p>
                </div>
              ) : null}
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Rota imediata
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {activeSanitaryAlert.routeLabel ??
                    "Acionar SVO e registrar rota local"}
                </p>
              </div>
            </div>

            {activeSanitaryAlert.alertSignals.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Sinais que motivaram o bloqueio
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSanitaryAlert.alertSignals.map((signal) => (
                    <Badge
                      key={signal}
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {activeSanitaryAlert.immediateActions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Passos imediatos recomendados
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {activeSanitaryAlert.immediateActions.map((action) => (
                    <li key={action}>- {action}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeSanitaryAlert.notes ? (
              <div className="rounded-xl border border-border/70 bg-background/80 p-3 text-sm text-muted-foreground">
                {activeSanitaryAlert.notes}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-warning/40 text-warning-foreground hover:bg-warning-muted"
                onClick={() => setShowCloseSanitaryAlertDialog(true)}
              >
                Encerrar suspeita
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {taxonomySnapshot && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Taxonomia canônica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Categoria zootécnica
                </p>
                <p className="mt-1 font-semibold">
                  {taxonomySnapshot.display.categoria}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aliases:{" "}
                  {getCategoriaZootecnicaAliases(
                    taxonomySnapshot.categoria_zootecnica,
                  ).join(", ")}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Fase veterinária
                </p>
                <p className="mt-1 font-semibold">
                  {taxonomySnapshot.display.fase_veterinaria}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
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
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-800"
                >
                  Prenhez confirmada
                </Badge>
              )}
              {taxonomySnapshot.facts.data_ultimo_parto && (
                <Badge variant="outline">
                  Último parto:{" "}
                  {formatDate(taxonomySnapshot.facts.data_ultimo_parto)}
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
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Estagio de vida</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="border-border bg-background/80 text-foreground"
                >
                  Atual:{" "}
                  {getAnimalLifeStageLabel(lifecycleSnapshot.currentStage)}
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
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Estagio atual
                </p>
                <p className="mt-1 font-semibold">
                  {getAnimalLifeStageLabel(lifecycleSnapshot.currentStage)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Alvo calculado
                </p>
                <p className="mt-1 font-semibold">
                  {getAnimalLifeStageLabel(lifecycleSnapshot.targetStage)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Regra usada
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lifecycleSnapshot.targetStageReason}
                </p>
              </div>
            </div>

            {lifecycleSnapshot.shouldSuggestTransition ? (
              <div className="rounded-xl border border-warning/25 bg-warning-muted/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {lifecycleSnapshot.suggestionKind === "initialize"
                        ? "Registrar estagio inicial"
                        : "Transicao sugerida"}
                    </p>
                    <p className="text-sm text-muted-foreground">
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
                      {isApplyingLifecycle
                        ? "Aplicando..."
                        : "Confirmar transicao"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O estagio registrado ja esta alinhado com as regras atuais da
                fazenda.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 shadow-none">
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
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Pesagens
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso?.totalPesagens ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
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
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
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
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
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
                    <XAxis
                      dataKey="dataLabel"
                      tickLine={false}
                      axisLine={false}
                    />
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

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Escore de Condição Corporal (ECC)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigate(`/registrar?dominio=ecc&animalId=${encodeURIComponent(animal.id)}`);
              }}
            >
              Registrar ECC
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ultimoEcc ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground font-semibold">
                      Último ECC Factual
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-primary">
                      {ultimoEcc.ecc.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Escala: {ultimoEcc.escala_min.toFixed(1)} a {ultimoEcc.escala_max.toFixed(1)} (passo {ultimoEcc.escala_passo.toFixed(2)})
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground font-semibold">
                      Data da Avaliação
                    </p>
                    <p className="mt-2 text-xl font-bold text-foreground">
                      {formatDate(ultimoEcc.occurred_at)}
                    </p>
                  </div>
                  {ultimoEcc.observacoes ? (
                    <p className="text-xs text-muted-foreground mt-2 italic truncate">
                      obs: "{ultimoEcc.observacoes}"
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">Sem observações</p>
                  )}
                </div>
              </div>

              {historicoEcc && historicoEcc.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Histórico de Avaliações ({historicoEcc.length})
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
                    <div className="max-h-60 overflow-y-auto divide-y divide-border/40">
                      {historicoEcc.map((item) => (
                        <div key={item.id} className="flex justify-between items-start gap-4 p-3 hover:bg-muted/10 transition-colors">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{item.dataLabel}</p>
                            {item.observacoes && (
                              <p className="text-xs text-muted-foreground italic leading-relaxed">
                                {item.observacoes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-primary">
                              {item.ecc.toFixed(2)}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              escala: {item.escalaMin.toFixed(0)}-{item.escalaMax.toFixed(0)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-muted-foreground">Sem ECC factual registrado</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                Registre avaliações regulares de escore de condição corporal para acompanhar a evolução nutricional.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {animal.sexo === "F" && (
          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
                Ciclo reprodutivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isReproductionEligible && reproResumo ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                    >
                      Status:{" "}
                      {getReproStatusLabel(reproResumo.reproStatus.status)}
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
                    <Badge
                      variant="outline"
                      className="border-border bg-background/80 text-foreground"
                    >
                      {reproResumo.loteNome
                        ? `Lote ${reproResumo.loteNome}`
                        : "Sem lote"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        Ultimo marco
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {reproResumo.lastEventLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.lastEventDateLabel
                          ? formatDate(reproResumo.lastEventDateLabel)
                          : "Sem registro"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        Proximo passo
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {reproResumo.nextActionLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.nextActionDate
                          ? formatDate(reproResumo.nextActionDate)
                          : "Sem data prevista"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        Faixa do ciclo
                      </p>
                      <p className="mt-1 font-semibold capitalize text-foreground">
                        {reproResumo.lane}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.actionLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {reproResumo.reproStatus.status !== "SERVIDA" &&
                      reproResumo.reproStatus.status !== "PRENHA" && (
                        <Link
                          to={`/animais/${animal.id}/reproducao?tipo=cobertura`}
                        >
                          <Button size="sm">Cobertura / IA</Button>
                        </Link>
                      )}
                    {(reproResumo.reproStatus.status === "SERVIDA" ||
                      reproResumo.reproStatus.status === "PRENHA") && (
                      <Link
                        to={`/animais/${animal.id}/reproducao?tipo=diagnostico`}
                      >
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
                    className="border-border bg-background/80 text-foreground"
                  >
                    Categoria atual: {categoriaLabel ?? "Nao classificada"}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {animal.sexo === "M" && (
          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
                Perfil de manejo do macho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
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
                  className="border-border bg-background/80 text-foreground"
                >
                  {getTransitionModeLabel(effectiveTransitionMode) ??
                    "Transicao manual"}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    isBreedingMale
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-border bg-background/80 text-foreground"
                  }
                >
                  {isBreedingMale
                    ? "Elegivel para touro de lote"
                    : "Ainda fora da liberacao para cobertura"}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Destino
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {maleDestination ?? "Nao definido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Decide se o animal segue para reproducao, engorda ou saida.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Status reprodutivo
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {maleReproductiveStatus ?? "Nao definido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Separa candidato, apto, suspenso ou inativo.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Modo de transicao
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
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

        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-muted-foreground" />
              Vinculos familiares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimalKinshipBadges
              mother={mae}
              father={pai}
              calves={crias ?? []}
            />
            <div className="space-y-1 text-sm text-muted-foreground">
              {mae && <p>Matriz de origem: {mae.identificacao}</p>}
              {pai && <p>Pai vinculado: {pai.identificacao}</p>}
              {calfJourneyPendingCount > 0 && (
                <p>
                  {calfJourneyPendingCount} marco(s) da jornada da cria em
                  aberto.
                </p>
              )}
              {(crias?.length ?? 0) > 0 && (
                <p>
                  {animal.identificacao} tem {crias?.length ?? 0} cria(s)
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
        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detalhes da sociedade</CardTitle>
              <Badge variant="default">
                {sociedadeAtiva.fim ? "Encerrada" : "Ativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Contraparte</p>
                <p className="font-semibold">{contraparte.nome}</p>
              </div>

              {sociedadeAtiva.percentual && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Participacao da fazenda
                  </p>
                  <p className="font-semibold">
                    {sociedadeAtiva.percentual}%
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Data de inicio</p>
                <p className="font-medium">
                  {formatDate(sociedadeAtiva.inicio)}
                </p>
              </div>

              {sociedadeAtiva.fim && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Data de encerramento
                  </p>
                  <p className="font-medium">
                    {formatDate(sociedadeAtiva.fim)}
                  </p>
                </div>
              )}
            </div>

            {!sociedadeAtiva.fim && (
              <div className="border-t border-border/70 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setShowCloseSociedadeDialog(true)}
                >
                  Encerrar sociedade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <WithdrawalBadgePanel readModel={carenciaModel} className="mb-6" />

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full max-w-[640px] grid-cols-4 bg-muted/40 p-1">
          <TabsTrigger value="timeline" className="gap-2 rounded-md">
            <History className="h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="casos" className="gap-2 rounded-md">
            <HeartPulse className="h-4 w-4" /> Casos
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2 rounded-md">
            <Calendar className="h-4 w-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="comercial" className="gap-2 rounded-md">
            <DollarSign className="h-4 w-4" /> Comercial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="space-y-3">
            {eventos?.length === 0 ? (
              <p className="py-4 text-muted-foreground">
                Nenhum evento registrado.
              </p>
            ) : (
              eventos?.map((evt) => (
                <article
                  key={evt.id}
                  className="rounded-xl border border-border/70 bg-background/95 p-4 shadow-none"
                >
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="text-sm font-semibold capitalize">
                      {evt.dominio === "reproducao" && evt.details
                        ? `Reproducao: ${evt.details.tipo}`
                        : evt.dominio === "alerta_sanitario"
                          ? "Alerta sanitario"
                          : evt.dominio === "comercial" && evt.detailsComercial
                            ? `Operação Comercial: ${evt.detailsComercial.operation_type === "compra" ? "Compra" : "Venda"}`
                            : evt.dominio}
                    </h4>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {formatDate(evt.occurred_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {evt.dominio === "alerta_sanitario"
                      ? describeSanitaryAlertEvent(evt.payload)
                      : evt.dominio === "comercial" && evt.detailsComercial
                        ? `Operação comercial registrada: ${evt.detailsComercial.operation_type === "compra" ? "Compra" : "Venda"}. Contraparte: ${evt.detailsComercial.contraparte_nome || "Não informada"}.`
                        : evt.observacoes || "Manejo realizado no campo."}
                  </p>
                  {evt.dominio === "alerta_sanitario" && (
                    <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
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
                              <p>
                                Desfecho: {closureReason.replaceAll("_", " ")}
                              </p>
                            ) : null}
                            {immediateActions.length > 0 ? (
                              <p>Passos: {immediateActions.join(" | ")}</p>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {evt.dominio === "comercial" && evt.detailsComercial && (
                    <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                      <div className="grid grid-cols-2 gap-2">
                        <p>Quantidade: {evt.detailsComercial.quantidade_animais} cab.</p>
                        <p>Peso Vivo Total: {evt.detailsComercial.peso_vivo_total ? `${evt.detailsComercial.peso_vivo_total} kg` : "—"}</p>
                        <p>Valor Bruto: {evt.detailsComercial.valor_bruto ? `R$ ${evt.detailsComercial.valor_bruto.toFixed(2)}` : "—"}</p>
                        <p>Valor Líquido: {evt.detailsComercial.valor_liquido_derivado ? `R$ ${evt.detailsComercial.valor_liquido_derivado.toFixed(2)}` : "—"}</p>
                      </div>
                      {evt.detailsComercial.observacoes && (
                        <p className="border-t border-border/20 pt-1 italic">Obs: "{evt.detailsComercial.observacoes}"</p>
                      )}
                    </div>
                  )}
                  {evt.dominio === "reproducao" && evt.details && (
                    <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                      {evt.details.macho_id && (
                        <p>
                          Reprodutor:{" "}
                          {evt.machoIdentificacao || evt.details.macho_id}
                        </p>
                      )}
                      {evt.details.payload && (
                        <>
                          {typeof (evt.details.payload as ReproDetailsPayload)
                            .diagnostico_resultado === "string" && (
                            <p>
                              Diagnostico:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload)
                                  .diagnostico_resultado as string
                              }
                            </p>
                          )}
                          {typeof (evt.details.payload as ReproDetailsPayload)
                            .resultado === "string" && (
                            <p>
                              Diagnostico:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload)
                                  .resultado as string
                              }
                            </p>
                          )}
                          {typeof (evt.details.payload as ReproDetailsPayload)
                            .numero_crias === "number" && (
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
                </article>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="casos" className="mt-6">
          {!hasMovementBlockedSanitaryAlert && animal.status === "ativo" && (
            <div className="mb-4">
              <Button
                size="sm"
                variant="outline"
                className="border-warning/40 text-warning-foreground hover:bg-warning-muted"
                onClick={() => setShowSanitaryAlertDialog(true)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Abrir suspeita sanitaria
              </Button>
            </div>
          )}
          <AnimalSanitaryCasesPanel
            animalId={animal.id}
            cases={sanitaryCases}
            eventsByCase={sanitaryEventsByCase}
            onCloseClinicalCase={handleOpenCloseClinicalCaseDialog}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <div className="grid gap-3">
            {agenda?.map((entry) => (
              <Card
                key={entry.item.id}
                className={
                  entry.item.status === "agendado"
                    ? "border-warning/25 bg-warning-muted/40 shadow-none"
                    : "shadow-none"
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

        <TabsContent value="comercial" className="mt-6">
          {animalComerciais.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {animalComerciais.map((com) => {
                const isCompra = com.operation_type === "compra";
                return (
                  <div key={com.evento_id} className="rounded-xl border p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-border/40">
                      <span className={cn(
                        "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        isCompra ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800"
                      )}>
                        {com.operation_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {com.occurred_at ? new Date(com.occurred_at).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground font-medium">Quantidade:</span>
                        <p className="font-semibold mt-0.5">{com.quantidade_animais} cab.</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Peso Vivo Total:</span>
                        <p className="font-semibold mt-0.5">{com.peso_vivo_total ? `${com.peso_vivo_total} kg` : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Peso Médio:</span>
                        <p className="font-semibold mt-0.5">
                          {com.peso_medio_derivado ? `${com.peso_medio_derivado.toFixed(1)} kg` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Valor Bruto:</span>
                        <p className="font-semibold mt-0.5">{com.valor_bruto ? `R$ ${com.valor_bruto.toFixed(2)}` : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Valor Líquido Estimado:</span>
                        <p className="font-semibold mt-0.5">{com.valor_liquido_derivado ? `R$ ${com.valor_liquido_derivado.toFixed(2)}` : "—"}</p>
                      </div>
                      <div className="col-span-2 border-t pt-2 border-border/20">
                        <span className="text-muted-foreground font-medium">Contraparte:</span>
                        <p className="font-semibold mt-0.5">{com.contraparte_nome || "—"}</p>
                      </div>
                      {com.finance_transaction_id && (
                        <div className="col-span-2">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">• Vínculo financeiro ativo</span>
                        </div>
                      )}
                    </div>
                    {com.limitations && com.limitations.length > 0 && (
                      <div className="bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 rounded-lg p-2 text-[10px] text-amber-800 space-y-0.5">
                        <span className="font-semibold">Notas de conformidade:</span>
                        {com.limitations.map((lim, idx) => (
                          <p key={idx}>- {lim}</p>
                        ))}
                      </div>
                    )}
                    {com.observacoes && (
                      <p className="text-[10px] text-muted-foreground border-t pt-2 italic">
                        {com.observacoes}
                      </p>
                    )}
                    <div className="text-[9px] text-muted-foreground/60 text-right pt-1 uppercase">
                      operação registrada conforme dados informados. não representa recomendação comercial ou substitui validação operacional/financeira.
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              Sem operações comerciais registradas para este animal.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <MoverAnimalLote
        animal={animal}
        open={showMoverLote}
        onOpenChange={setShowMoverLote}
        onSuccess={() => {}}
      />

      <Dialog
        open={Boolean(clinicalCaseClosure.caseId)}
        onOpenChange={(open) => {
          if (!open) {
            setClinicalCaseClosure({
              caseId: null,
              reason: "resolvido",
              notes: "",
            });
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              Encerrar caso clinico
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select
                value={clinicalCaseClosure.reason}
                onValueChange={(value) =>
                  setClinicalCaseClosure((prev) => ({
                    ...prev,
                    reason: value as ClinicalCaseClosureReason,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {CLINICAL_CASE_CLOSURE_REASONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedClinicalCaseClosureReason.helper}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="clinical_case_close_notes">
                  Observacoes de encerramento
                </Label>
                <span className="text-xs text-muted-foreground">
                  {clinicalCaseClosureNotesLength}/1000
                </span>
              </div>
              <Textarea
                id="clinical_case_close_notes"
                value={clinicalCaseClosure.notes}
                onChange={(event) =>
                  setClinicalCaseClosure((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                maxLength={1000}
                placeholder="Descreva resposta ao manejo, orientacao veterinaria ou motivo do encerramento."
              />
              {selectedClinicalCaseClosureReason.requiresNotes &&
              clinicalCaseClosureNotesLength < 10 ? (
                <p className="text-xs text-destructive">
                  Este desfecho exige observacao com pelo menos 10 caracteres.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
              O encerramento atualiza apenas o estado do caso clinico. Manejos
              realizados continuam registrados pela timeline de eventos.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setClinicalCaseClosure({
                  caseId: null,
                  reason: "resolvido",
                  notes: "",
                })
              }
              disabled={isClosingClinicalCase}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCloseClinicalCase()}
              disabled={isClosingClinicalCase || !canConfirmClinicalCaseClosure}
            >
              {isClosingClinicalCase ? "Encerrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showSanitaryAlertDialog}
        onOpenChange={setShowSanitaryAlertDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Abrir suspeita sanitaria para {animal.identificacao}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Doenca / suspeita oficial</Label>
                <Select
                  value={
                    selectedOfficialDisease?.codigo ??
                    sanitaryAlertForm.diseaseCode
                  }
                  onValueChange={(value) =>
                    setSanitaryAlertForm((prev) => ({
                      ...prev,
                      diseaseCode: value,
                    }))
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
                  value={
                    selectedOfficialDisease?.tipo_notificacao ?? "imediata"
                  }
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
                      className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
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
              <Label htmlFor="sanitary_alert_route">
                Rota imediata / contato
              </Label>
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
              <Label htmlFor="sanitary_alert_close_notes">
                Observacoes de encerramento
              </Label>
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
              {isClosingSanitaryAlert
                ? "Encerrando..."
                : "Confirmar encerramento"}
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
              Remove o animal da operacao ativa. Acao irreversivel.
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
              Encerra o vinculo deste animal na fazenda ativa.
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

