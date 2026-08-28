import type { AgendaItem, Evento, EventoPesagem } from "@/lib/offline/types";
import type {
  MetricCoverage,
  MetricCoverageState,
  MetricPeriod,
  MetricResult,
  MetricStatus,
} from "@/lib/reports/metricContract";

export type DecisionRecommendationStatus =
  | "confirmed"
  | "partial"
  | "unknown"
  | "ambiguous"
  | "not_permitted";

export type DecisionConvergenceMode =
  | "standard_pull"
  | "specialized_pull"
  | "local_derived"
  | "not_applicable"
  | "not_verified";

export type DecisionSourceAvailability =
  | "loaded"
  | "not_loaded"
  | "not_available";

export interface DecisionEvidenceSource {
  name: string;
  role: "primary" | "auxiliary";
  kind: "event" | "event_detail" | "state" | "technical";
  recordIds: string[];
  fieldsPresent: string[];
  fieldsMissing: string[];
}

export interface DecisionEvidenceConflict {
  code: string;
  source: string;
  recordIds: string[];
  description: string;
}

export interface DecisionRecommendation<T> {
  id: string;
  decisionId: string;
  question: string;
  scope: {
    fazendaId: string;
    entityType?: string;
    entityId?: string;
  };
  generatedAt: string;
  period: {
    start?: string;
    end?: string;
    timezone: string | null;
    cutoffAt: string;
  };
  status: DecisionRecommendationStatus;
  statusReason: string;
  data: T | null;
  evidence: {
    primarySources: DecisionEvidenceSource[];
    auxiliarySources: DecisionEvidenceSource[];
    convergence: Array<{
      source: string;
      mode: DecisionConvergenceMode;
      verified: boolean;
    }>;
    coverage: string[];
    limitations: string[];
    conflicts: DecisionEvidenceConflict[];
  };
  prohibitedActions: string[];
  suggestedAction?: {
    label: string;
    href: string;
  };
}

export interface DecisionSourceState<T> {
  availability: DecisionSourceAvailability;
  records?: readonly T[] | null;
  convergence: {
    mode: DecisionConvergenceMode;
    verified: boolean;
  };
}

export interface WeightDataQuality {
  summary: string;
  quality: "fresh" | "stale" | "missing_detail";
  eventId?: string;
  weightKg?: number;
  weighedAt?: string;
  ageDays?: number;
  freshnessLimitDays: number;
}

export interface OverdueAgendaData {
  summary: string;
  count: number;
  items: Array<{
    id: string;
    dueDate: string;
    animalId: string | null;
    loteId: string | null;
    domain: string;
  }>;
}

export interface OperationalHistoryReviewData {
  summary: string;
  metricKey: "eventos_periodo";
  observedEventCount: number | null;
  metricStatus: MetricStatus;
  coverageState: MetricCoverageState;
}

export interface HerdFlowReviewData {
  summary: string;
  observedEntries: number;
  observedExits: number;
  entryMetricStatus: MetricStatus;
  exitMetricStatus: MetricStatus;
  coverageStates: MetricCoverageState[];
}

export interface OperationalMetricSnapshot<T> {
  metricKey: string;
  result: MetricResult<T>;
}

type SharedDecisionInput = {
  fazendaId: string;
  cutoffAt: string;
  timezone: string | null;
  timezoneVerified: boolean;
  retainedQueueRejectionCount?: number;
};

export type BuildWeightDataQualityInput = SharedDecisionInput & {
  animalId: string;
  freshnessLimitDays?: number;
  events: DecisionSourceState<Evento>;
  weightDetails: DecisionSourceState<EventoPesagem>;
};

export type BuildOverdueAgendaInput = SharedDecisionInput & {
  referenceDate: string;
  agenda: DecisionSourceState<AgendaItem>;
};

export type BuildOperationalHistoryReviewInput = SharedDecisionInput & {
  metrics: DecisionSourceState<OperationalMetricSnapshot<number>>;
};

export type BuildHerdFlowReviewInput = SharedDecisionInput & {
  metrics: DecisionSourceState<OperationalMetricSnapshot<number>>;
};

const WEIGHT_DECISION_ID = "weight_data_quality";
const OVERDUE_AGENDA_DECISION_ID = "overdue_agenda_review";
const OPERATIONAL_HISTORY_DECISION_ID = "operational_history_review";
const OPERATIONAL_HISTORY_METRIC_KEY = "eventos_periodo";
const HERD_FLOW_DECISION_ID = "herd_flow_review";
const HERD_FLOW_METRIC_KEYS = ["rebanho_entradas", "rebanho_saidas"] as const;
type HerdFlowMetricKey = (typeof HERD_FLOW_METRIC_KEYS)[number];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function validInstant(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}

function assertSharedInput(input: SharedDecisionInput): number {
  if (!input.fazendaId.trim()) throw new Error("fazendaId is required");
  const cutoffTimestamp = validInstant(input.cutoffAt);
  if (cutoffTimestamp === null)
    throw new Error("cutoffAt must be a valid instant");
  if ((input.retainedQueueRejectionCount ?? 0) < 0) {
    throw new Error("retainedQueueRejectionCount must be non-negative");
  }
  return cutoffTimestamp;
}

function technicalLimitations(input: SharedDecisionInput): string[] {
  const limitations = [
    "queue_rejections e evidencia tecnica temporaria; sua ausencia nao prova que rejeicoes nunca ocorreram.",
  ];
  if ((input.retainedQueueRejectionCount ?? 0) > 0) {
    limitations.push(
      "Ha operacoes rejeitadas ainda retidas; isso pode indicar incompletude de sync, mas nao prova nem nega fato de dominio.",
    );
  }
  if (!input.timezoneVerified) {
    limitations.push(
      "Timezone da fazenda nao foi comprovado; o timezone informado e fallback e reduz a qualidade temporal.",
    );
  }
  return limitations;
}

function technicalSources(
  input: SharedDecisionInput,
): DecisionEvidenceSource[] {
  if ((input.retainedQueueRejectionCount ?? 0) === 0) return [];
  return [
    {
      name: "queue_rejections",
      role: "auxiliary",
      kind: "technical",
      recordIds: [],
      fieldsPresent: ["fazenda_id", "retained_count"],
      fieldsMissing: ["historico_completo_de_rejeicoes"],
    },
  ];
}

function unavailableStatus(
  states: readonly DecisionSourceState<unknown>[],
): DecisionRecommendationStatus | null {
  if (states.some((state) => state.availability === "not_available")) {
    return "not_permitted";
  }
  if (states.some((state) => state.availability === "not_loaded"))
    return "unknown";
  return null;
}

function unavailableReason(status: DecisionRecommendationStatus): string {
  return status === "not_permitted"
    ? "Uma fonte tecnica obrigatoria nao existe nesta superficie; a conclusao nao e permitida."
    : "Uma fonte obrigatoria nao foi carregada no snapshot local.";
}

function sourceConvergence(
  source: string,
  state: DecisionSourceState<unknown>,
): { source: string; mode: DecisionConvergenceMode; verified: boolean } {
  return {
    source,
    mode: state.convergence.mode,
    verified: state.convergence.verified,
  };
}

function baseWeightSources(
  eventIds: string[],
  detailIds: string[],
  missingDetailEventIds: string[],
): DecisionEvidenceSource[] {
  return [
    {
      name: "eventos",
      role: "primary",
      kind: "event",
      recordIds: eventIds,
      fieldsPresent:
        eventIds.length > 0
          ? ["id", "fazenda_id", "animal_id", "dominio", "occurred_at"]
          : [],
      fieldsMissing: eventIds.length > 0 ? [] : ["evento_pesagem"],
    },
    {
      name: "eventos_pesagem",
      role: "primary",
      kind: "event_detail",
      recordIds: detailIds,
      fieldsPresent:
        detailIds.length > 0 ? ["evento_id", "fazenda_id", "peso_kg"] : [],
      fieldsMissing:
        detailIds.length > 0
          ? missingDetailEventIds.map((eventId) => `detail:${eventId}`)
          : ["detail_de_pesagem"],
    },
  ];
}

export function buildWeightDataQualityRecommendation(
  input: BuildWeightDataQualityInput,
): DecisionRecommendation<WeightDataQuality> {
  const cutoffTimestamp = assertSharedInput(input);
  if (!input.animalId.trim()) throw new Error("animalId is required");
  const freshnessLimitDays = input.freshnessLimitDays;
  if (
    freshnessLimitDays !== undefined &&
    (!Number.isInteger(freshnessLimitDays) || freshnessLimitDays < 0)
  ) {
    throw new Error("freshnessLimitDays must be a non-negative integer");
  }

  const base = {
    id: `${WEIGHT_DECISION_ID}:${input.fazendaId}:${input.animalId}`,
    decisionId: WEIGHT_DECISION_ID,
    question:
      "A evidencia de pesagem e suficiente e atual para apoiar uma decisao dependente de peso?",
    scope: {
      fazendaId: input.fazendaId,
      entityType: "animal",
      entityId: input.animalId,
    },
    generatedAt: input.cutoffAt,
    period: {
      timezone: input.timezone,
      cutoffAt: input.cutoffAt,
    },
    prohibitedActions: [
      "nao autoriza venda ou abate",
      "nao declara aptidao operacional",
      "nao transforma o ultimo peso em peso atual garantido",
      "nao cria Evento, Agenda ou state_*",
    ],
  } as const;

  const states = [input.events, input.weightDetails];
  const unavailable = unavailableStatus(states);
  const convergence = [
    sourceConvergence("eventos", input.events),
    sourceConvergence("eventos_pesagem", input.weightDetails),
  ];
  const limitations = technicalLimitations(input);
  if (freshnessLimitDays === undefined) {
    limitations.push(
      "Limite tecnico de freshness do peso nao esta configurado; o sistema nao pode declarar atualidade.",
    );
    return {
      ...base,
      status: "not_permitted",
      statusReason:
        "Sem limite tecnico explicito de freshness, a conclusao sobre atualidade do peso nao e permitida.",
      data: null,
      evidence: {
        primarySources: baseWeightSources([], [], []),
        auxiliarySources: technicalSources(input),
        convergence,
        coverage: [],
        limitations,
        conflicts: [],
      },
      suggestedAction: {
        label: "Atualizar peso",
        href: "/registrar?dominio=pesagem",
      },
    };
  }
  if (unavailable) {
    return {
      ...base,
      status: unavailable,
      statusReason: unavailableReason(unavailable),
      data: null,
      evidence: {
        primarySources: baseWeightSources([], [], []),
        auxiliarySources: technicalSources(input),
        convergence,
        coverage: [],
        limitations,
        conflicts: [],
      },
      suggestedAction: {
        label: "Atualizar peso",
        href: "/registrar?dominio=pesagem",
      },
    };
  }

  const localEvents = (input.events.records ?? []).filter(
    (event) =>
      event.fazenda_id === input.fazendaId &&
      event.animal_id === input.animalId &&
      event.dominio === "pesagem" &&
      !event.deleted_at,
  );
  const eligibleEvents = localEvents.filter((event) => {
    const timestamp = validInstant(event.occurred_at);
    return timestamp !== null && timestamp <= cutoffTimestamp;
  });
  const invalidEventIds = localEvents
    .filter((event) => validInstant(event.occurred_at) === null)
    .map((event) => event.id);
  const localDetails = (input.weightDetails.records ?? []).filter(
    (detail) => detail.fazenda_id === input.fazendaId && !detail.deleted_at,
  );
  const detailsByEvent = new Map<string, EventoPesagem[]>();
  for (const detail of localDetails) {
    const list = detailsByEvent.get(detail.evento_id) ?? [];
    list.push(detail);
    detailsByEvent.set(detail.evento_id, list);
  }

  const conflicts: DecisionEvidenceConflict[] = [];
  for (const [eventId, details] of detailsByEvent) {
    const weights = unique(
      details
        .filter(
          (detail) => Number.isFinite(detail.peso_kg) && detail.peso_kg > 0,
        )
        .map((detail) => String(detail.peso_kg)),
    );
    if (weights.length > 1) {
      conflicts.push({
        code: "conflicting_weight_details",
        source: "eventos_pesagem",
        recordIds: details.map((detail) => detail.evento_id),
        description: `O Evento ${eventId} possui details de peso divergentes.`,
      });
    }
  }

  const joined = eligibleEvents.flatMap((event) =>
    (detailsByEvent.get(event.id) ?? [])
      .filter((detail) => Number.isFinite(detail.peso_kg) && detail.peso_kg > 0)
      .map((detail) => ({
        event,
        detail,
        timestamp: Date.parse(event.occurred_at),
      })),
  );
  const latestTimestamp = joined.reduce(
    (latest, entry) => Math.max(latest, entry.timestamp),
    Number.NEGATIVE_INFINITY,
  );
  const latestEntries = joined.filter(
    (entry) => entry.timestamp === latestTimestamp,
  );
  if (
    unique(latestEntries.map((entry) => String(entry.detail.peso_kg))).length >
    1
  ) {
    conflicts.push({
      code: "conflicting_latest_weights",
      source: "eventos + eventos_pesagem",
      recordIds: latestEntries.map((entry) => entry.event.id),
      description:
        "Existem pesagens mais recentes no mesmo instante com valores divergentes.",
    });
  }

  const missingDetailEventIds = eligibleEvents
    .filter(
      (event) =>
        !(detailsByEvent.get(event.id) ?? []).some(
          (detail) => detail.peso_kg > 0,
        ),
    )
    .map((event) => event.id);
  const eventIds = eligibleEvents.map((event) => event.id);
  const detailIds = joined.map((entry) => entry.detail.evento_id);
  const primarySources = baseWeightSources(
    eventIds,
    detailIds,
    missingDetailEventIds,
  );
  const coverage = [
    `eventos_pesagem_ate:${input.cutoffAt}`,
    `animal:${input.animalId}`,
    `fazenda:${input.fazendaId}`,
  ];
  if (invalidEventIds.length > 0) {
    limitations.push(
      "Ha Evento de pesagem com occurred_at invalido no escopo.",
    );
  }
  if (missingDetailEventIds.length > 0) {
    limitations.push(
      "Evento-base de pesagem sem detail nao sustenta peso; a cobertura factual esta incompleta.",
    );
  }
  if (
    convergence.some(
      (entry) => !entry.verified || entry.mode === "not_verified",
    )
  ) {
    limitations.push(
      "A convergencia de ao menos uma fonte nao foi comprovada; o resultado nao pode ser confirmed.",
    );
  }

  if (conflicts.length > 0) {
    return {
      ...base,
      status: "ambiguous",
      statusReason:
        "Fontes factuais validas apresentam conflito sem regra autorizada de desempate.",
      data: null,
      evidence: {
        primarySources,
        auxiliarySources: technicalSources(input),
        convergence,
        coverage,
        limitations,
        conflicts,
      },
      suggestedAction: {
        label: "Atualizar peso",
        href: "/registrar?dominio=pesagem",
      },
    };
  }

  const latest = latestEntries[0];
  if (!latest) {
    const hasBaseEvidence = eligibleEvents.length > 0;
    return {
      ...base,
      status: hasBaseEvidence ? "partial" : "unknown",
      statusReason: hasBaseEvidence
        ? "Existe Evento-base de pesagem, mas o detail factual obrigatorio esta ausente ou invalido."
        : "Nao ha Evento de pesagem elegivel ate o cutoff informado.",
      data: hasBaseEvidence
        ? {
            summary:
              "Detail de pesagem ausente; atualizar ou revisar a pesagem.",
            quality: "missing_detail",
            freshnessLimitDays,
          }
        : null,
      evidence: {
        primarySources,
        auxiliarySources: technicalSources(input),
        convergence,
        coverage,
        limitations,
        conflicts: [],
      },
      suggestedAction: {
        label: "Atualizar peso",
        href: "/registrar?dominio=pesagem",
      },
    };
  }

  const ageDays = Math.floor((cutoffTimestamp - latest.timestamp) / 86_400_000);
  const stale = ageDays > freshnessLimitDays;
  if (stale)
    limitations.push(`A ultima pesagem excede ${freshnessLimitDays} dias.`);
  const completeCoverage =
    convergence.every(
      (entry) => entry.verified && entry.mode !== "not_verified",
    ) &&
    input.timezoneVerified &&
    invalidEventIds.length === 0 &&
    missingDetailEventIds.length === 0;
  const status: DecisionRecommendationStatus =
    !stale && completeCoverage ? "confirmed" : "partial";

  return {
    ...base,
    status,
    statusReason:
      status === "confirmed"
        ? "Evento e detail de pesagem estao presentes, atuais e com cobertura declarada."
        : stale
          ? "A pesagem factual existe, mas esta desatualizada para o limite informado."
          : "A pesagem e util, mas a cobertura temporal ou de convergencia esta incompleta.",
    data: {
      summary: stale
        ? `Pesagem de ${latest.detail.peso_kg} kg desatualizada; atualizar antes de decidir.`
        : `Pesagem de ${latest.detail.peso_kg} kg dentro do limite de freshness.`,
      quality: stale ? "stale" : "fresh",
      eventId: latest.event.id,
      weightKg: latest.detail.peso_kg,
      weighedAt: latest.event.occurred_at,
      ageDays,
      freshnessLimitDays,
    },
    evidence: {
      primarySources,
      auxiliarySources: technicalSources(input),
      convergence,
      coverage,
      limitations,
      conflicts: [],
    },
    suggestedAction: stale
      ? { label: "Atualizar peso", href: "/registrar?dominio=pesagem" }
      : undefined,
  };
}

function agendaSource(records: readonly AgendaItem[]): DecisionEvidenceSource {
  return {
    name: "state_agenda_itens",
    role: "primary",
    kind: "state",
    recordIds: records.map((item) => item.id),
    fieldsPresent:
      records.length > 0 ? ["id", "fazenda_id", "status", "data_prevista"] : [],
    fieldsMissing: records.length > 0 ? [] : ["itens_no_recorte"],
  };
}

export function buildOverdueAgendaRecommendation(
  input: BuildOverdueAgendaInput,
): DecisionRecommendation<OverdueAgendaData> {
  assertSharedInput(input);
  if (!isValidDateKey(input.referenceDate)) {
    throw new Error("referenceDate must be a valid YYYY-MM-DD date");
  }

  const base = {
    id: `${OVERDUE_AGENDA_DECISION_ID}:${input.fazendaId}`,
    decisionId: OVERDUE_AGENDA_DECISION_ID,
    question:
      "Quais intencoes de Agenda abertas e vencidas precisam de revisao?",
    scope: { fazendaId: input.fazendaId, entityType: "agenda" },
    generatedAt: input.cutoffAt,
    period: {
      end: input.referenceDate,
      timezone: input.timezone,
      cutoffAt: input.cutoffAt,
    },
    prohibitedActions: [
      "nao conclui nem altera Agenda",
      "nao cria Evento",
      "nao infere execucao a partir de Agenda concluida",
      "nao usa Protocolo, tag ou insight como prova de execucao",
    ],
  } as const;
  const convergence = [sourceConvergence("state_agenda_itens", input.agenda)];
  const limitations = technicalLimitations(input);
  const unavailable = unavailableStatus([input.agenda]);
  if (unavailable) {
    return {
      ...base,
      status: unavailable,
      statusReason: unavailableReason(unavailable),
      data: null,
      evidence: {
        primarySources: [agendaSource([])],
        auxiliarySources: technicalSources(input),
        convergence,
        coverage: [],
        limitations,
        conflicts: [],
      },
      suggestedAction: { label: "Revisar Agenda", href: "/agenda" },
    };
  }

  const localRecords = (input.agenda.records ?? []).filter(
    (item) => item.fazenda_id === input.fazendaId && !item.deleted_at,
  );
  const byId = new Map<string, AgendaItem[]>();
  for (const item of localRecords) {
    const entries = byId.get(item.id) ?? [];
    entries.push(item);
    byId.set(item.id, entries);
  }
  const conflicts: DecisionEvidenceConflict[] = [];
  for (const [id, entries] of byId) {
    const variants = unique(
      entries.map(
        (item) =>
          `${item.status}|${item.data_prevista}|${item.animal_id}|${item.lote_id}`,
      ),
    );
    if (variants.length > 1) {
      conflicts.push({
        code: "conflicting_agenda_state",
        source: "state_agenda_itens",
        recordIds: [id],
        description: `O item ${id} possui estados atuais divergentes no snapshot.`,
      });
    }
  }

  const uniqueRecords = Array.from(byId.values()).map((entries) => entries[0]);
  const openRecords = uniqueRecords.filter((item) =>
    ["agendado", "pendente"].includes(item.status.trim().toLowerCase()),
  );
  const invalidOpenRecords = openRecords.filter(
    (item) => !isValidDateKey(item.data_prevista),
  );
  const overdue = openRecords
    .filter(
      (item) =>
        isValidDateKey(item.data_prevista) &&
        item.data_prevista < input.referenceDate,
    )
    .sort((left, right) =>
      left.data_prevista === right.data_prevista
        ? left.id.localeCompare(right.id)
        : left.data_prevista.localeCompare(right.data_prevista),
    );
  if (invalidOpenRecords.length > 0) {
    limitations.push(
      "Ha Agenda aberta sem data prevista valida; a cobertura da pendencia e parcial.",
    );
  }
  if (
    !input.agenda.convergence.verified ||
    input.agenda.convergence.mode === "not_verified"
  ) {
    limitations.push(
      "A convergencia de state_agenda_itens nao foi comprovada; ausencia local nao confirma ausencia entre dispositivos.",
    );
  }
  limitations.push(
    "Agenda prova intencao pendente; status concluido ou cancelado nao comprova Evento executado.",
  );

  const data: OverdueAgendaData = {
    summary:
      overdue.length > 0
        ? `${overdue.length} pendencia(s) vencida(s) para revisar na Agenda.`
        : "Nenhuma pendencia vencida no snapshot com cobertura declarada.",
    count: overdue.length,
    items: overdue.map((item) => ({
      id: item.id,
      dueDate: item.data_prevista,
      animalId: item.animal_id,
      loteId: item.lote_id,
      domain: item.dominio,
    })),
  };
  const coverage = [
    `agenda_aberta_ate:${input.referenceDate}`,
    `fazenda:${input.fazendaId}`,
  ];
  if (conflicts.length > 0) {
    return {
      ...base,
      status: "ambiguous",
      statusReason:
        "O snapshot contem estados de Agenda conflitantes sem desempate autorizado.",
      data,
      evidence: {
        primarySources: [agendaSource(localRecords)],
        auxiliarySources: technicalSources(input),
        convergence,
        coverage,
        limitations,
        conflicts,
      },
      suggestedAction: { label: "Revisar Agenda", href: "/agenda" },
    };
  }

  const convergenceVerified =
    input.agenda.convergence.verified &&
    input.agenda.convergence.mode !== "not_verified";
  const status: DecisionRecommendationStatus =
    invalidOpenRecords.length > 0 || !input.timezoneVerified
      ? "partial"
      : !convergenceVerified
        ? overdue.length > 0
          ? "partial"
          : "unknown"
        : "confirmed";

  return {
    ...base,
    status,
    statusReason:
      status === "confirmed"
        ? "Agenda aberta foi avaliada no cutoff, com fazenda e convergencia declaradas."
        : status === "unknown"
          ? "Sem convergencia comprovada, o snapshot vazio nao confirma ausencia de pendencias."
          : "Ha pendencias uteis, mas campos, timezone ou convergencia estao incompletos.",
    data: status === "unknown" ? null : data,
    evidence: {
      primarySources: [agendaSource(localRecords)],
      auxiliarySources: technicalSources(input),
      convergence,
      coverage,
      limitations,
      conflicts: [],
    },
    suggestedAction:
      overdue.length > 0
        ? { label: "Revisar Agenda", href: "/agenda" }
        : undefined,
  };
}

function operationalHistorySource(
  metric: MetricResult<number> | null,
): DecisionEvidenceSource {
  const primarySource = metric?.sources.find(
    (source) => source.role === "primary",
  );
  const fields = [
    ["MetricResult.value", metric?.value !== null],
    ["MetricResult.period", Boolean(metric?.period)],
    ["MetricResult.coverage", Boolean(metric?.coverage)],
  ] as const;
  return {
    name: primarySource?.name ?? "event_eventos",
    role: "primary",
    kind: "event",
    recordIds: [],
    fieldsPresent: metric
      ? [
          "MetricResult.status",
          ...fields.filter(([, present]) => present).map(([field]) => field),
        ]
      : [],
    fieldsMissing: metric
      ? fields.filter(([, present]) => !present).map(([field]) => field)
      : ["MetricResult:eventos_periodo"],
  };
}

function canonicalMetricResult(metric: MetricResult<number>): string {
  return JSON.stringify({
    value: metric.value,
    status: metric.status,
    period: metric.period ?? null,
    coverage: metric.coverage
      ? {
          ...metric.coverage,
          evidence: [...metric.coverage.evidence].sort(),
        }
      : null,
    sources: [...metric.sources].sort((left, right) =>
      `${left.role}:${left.name}`.localeCompare(`${right.role}:${right.name}`),
    ),
    limitations: [...metric.limitations].sort(),
  });
}

function cutoffDateKey(cutoffAt: string, timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(cutoffAt));
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return null;
  }
}

const OPERATIONAL_HISTORY_ACTION = {
  label: "Revisar relatorios",
  href: "/relatorios",
};
const OPERATIONAL_HISTORY_PROHIBITED_ACTIONS = [
  "nao cria nem altera Evento",
  "nao conclui nem altera Agenda",
  "nao persiste recomendacao ou MetricResult",
  "nao autoriza operacao comercial, sanitaria ou de manejo",
];

type OperationalHistorySelection =
  | { kind: "unavailable"; status: DecisionRecommendationStatus }
  | {
      kind: "missing";
      status: "unknown" | "not_permitted";
      reason: string;
      metric: MetricResult<number> | null;
    }
  | { kind: "conflict"; metric: MetricResult<number> }
  | { kind: "selected"; metric: MetricResult<number> };

type OperationalHistoryContract =
  | { kind: "invalid"; metric: MetricResult<number> }
  | {
      kind: "timezone_conflict";
      metric: MetricResult<number>;
      period: MetricPeriod;
      coverage: MetricCoverage;
    }
  | {
      kind: "valid";
      metric: MetricResult<number>;
      period: MetricPeriod;
      coverage: MetricCoverage;
      periodExceedsCutoff: boolean;
    };

type OperationalHistoryAssessment = {
  status: "confirmed" | "partial" | "unknown";
  statusReason: string;
  data: OperationalHistoryReviewData | null;
  limitations: string[];
};

function operationalHistoryBase(
  input: BuildOperationalHistoryReviewInput,
): Pick<
  DecisionRecommendation<OperationalHistoryReviewData>,
  | "id"
  | "decisionId"
  | "question"
  | "scope"
  | "generatedAt"
  | "period"
  | "prohibitedActions"
> {
  return {
    id: `${OPERATIONAL_HISTORY_DECISION_ID}:${input.fazendaId}`,
    decisionId: OPERATIONAL_HISTORY_DECISION_ID,
    question:
      "A cobertura dos Eventos do periodo permite interpretar o volume operacional observado?",
    scope: { fazendaId: input.fazendaId, entityType: "operational_metric" },
    generatedAt: input.cutoffAt,
    period: {
      timezone: input.timezone,
      cutoffAt: input.cutoffAt,
    },
    prohibitedActions: [...OPERATIONAL_HISTORY_PROHIBITED_ACTIONS],
  };
}

function resolveOperationalHistoryMetric(
  input: BuildOperationalHistoryReviewInput,
): OperationalHistorySelection {
  const unavailable = unavailableStatus([input.metrics]);
  if (unavailable) return { kind: "unavailable", status: unavailable };

  const metricSnapshots = (input.metrics.records ?? []).filter(
    (snapshot) => snapshot.metricKey === OPERATIONAL_HISTORY_METRIC_KEY,
  );
  const unscopedMetric = metricSnapshots.find(
    (snapshot) => !snapshot.result.coverage?.scope.fazendaId,
  );
  const localMetrics = metricSnapshots
    .filter(
      (snapshot) =>
        snapshot.result.coverage?.scope.fazendaId === input.fazendaId,
    )
    .map((snapshot) => snapshot.result);

  if (localMetrics.length === 0) {
    return {
      kind: "missing",
      status: unscopedMetric ? "not_permitted" : "unknown",
      reason: unscopedMetric
        ? "O MetricResult nao declara escopo por fazenda; usar a leitura para conclusao nao e permitido."
        : "Nenhum MetricResult do periodo foi localizado para a fazenda informada.",
      metric: unscopedMetric?.result ?? null,
    };
  }

  const variants = unique(localMetrics.map(canonicalMetricResult));
  return variants.length > 1
    ? { kind: "conflict", metric: localMetrics[0] }
    : { kind: "selected", metric: localMetrics[0] };
}

function validOperationalHistoryPeriod(period: MetricPeriod): boolean {
  return [
    isValidDateKey(period.from),
    isValidDateKey(period.to),
    period.from <= period.to,
  ].every(Boolean);
}

function validOperationalHistoryCoverage(
  coverage: MetricCoverage,
  fazendaId: string,
): boolean {
  return [
    coverage.kind === "historical",
    coverage.scope.fazendaId === fazendaId,
  ].every(Boolean);
}

function validateOperationalHistoryContract(
  input: BuildOperationalHistoryReviewInput,
  metric: MetricResult<number>,
): OperationalHistoryContract {
  const hasPrimarySource = metric.sources.some(
    (source) => source.role === "primary" && source.name === "event_eventos",
  );
  const period = metric.period;
  const coverage = metric.coverage;
  if (!hasPrimarySource || !period || !coverage || !input.timezone) {
    return { kind: "invalid", metric };
  }
  const cutoffKey = cutoffDateKey(input.cutoffAt, input.timezone);
  const validContract = [
    validOperationalHistoryPeriod(period),
    validOperationalHistoryCoverage(coverage, input.fazendaId),
    Boolean(cutoffKey),
  ].every(Boolean);
  if (!validContract || !cutoffKey) {
    return { kind: "invalid", metric };
  }
  if (period.timezone !== input.timezone) {
    return { kind: "timezone_conflict", metric, period, coverage };
  }
  return {
    kind: "valid",
    metric,
    period,
    coverage,
    periodExceedsCutoff: period.to > cutoffKey,
  };
}

function optionalLimitation(condition: boolean, message: string): string[] {
  return condition ? [message] : [];
}

function operationalHistoryStatus(
  complete: boolean,
  metric: MetricResult<number>,
): "confirmed" | "partial" | "unknown" {
  if (complete) return "confirmed";
  if (metric.status === "unavailable" || metric.value === null) return "unknown";
  return "partial";
}

function operationalHistoryStatusReason(
  status: "confirmed" | "partial" | "unknown",
): string {
  if (status === "confirmed") {
    return "Fonte factual, escopo, periodo, timezone e cobertura historica estao explicitos.";
  }
  if (status === "unknown") {
    return "O MetricResult nao possui valor interpretavel com a cobertura disponivel.";
  }
  return "O volume local e util, mas cobertura, cutoff, timezone ou convergencia ainda limitam a interpretacao.";
}

function operationalHistoryData(
  status: "confirmed" | "partial" | "unknown",
  metric: MetricResult<number>,
  coverage: MetricCoverage,
): OperationalHistoryReviewData | null {
  if (status === "unknown") return null;
  const summary =
    status === "confirmed"
      ? `${metric.value} Evento(s) no periodo com cobertura historica verificada.`
      : `${metric.value} Evento(s) observados; interprete o volume com as limitacoes declaradas.`;
  return {
    summary,
    metricKey: OPERATIONAL_HISTORY_METRIC_KEY,
    observedEventCount: metric.value,
    metricStatus: metric.status,
    coverageState: coverage.state,
  };
}

function deriveOperationalHistoryAssessment(
  input: BuildOperationalHistoryReviewInput,
  contract: Extract<OperationalHistoryContract, { kind: "valid" }>,
): OperationalHistoryAssessment {
  const { metric, period, coverage, periodExceedsCutoff } = contract;
  const limitations = unique([
    ...technicalLimitations(input),
    ...optionalLimitation(
      periodExceedsCutoff,
      "O periodo metrico termina depois do cutoff; a leitura representa somente o conjunto observado ate o cutoff.",
    ),
    ...metric.limitations,
    ...optionalLimitation(
      !input.metrics.convergence.verified,
      "A derivacao local do MetricResult nao foi declarada como verificada.",
    ),
  ]);
  const isComplete = [
    metric.status === "complete",
    coverage.state === "verified",
    period.timezoneSource === "farm",
    input.timezoneVerified,
    input.metrics.convergence.verified,
    input.metrics.convergence.mode !== "not_verified",
    !periodExceedsCutoff,
  ].every(Boolean);
  const status = operationalHistoryStatus(isComplete, metric);
  return {
    status,
    statusReason: operationalHistoryStatusReason(status),
    data: operationalHistoryData(status, metric, coverage),
    limitations,
  };
}

function operationalHistoryMetricSource(): DecisionEvidenceSource {
  return {
    name: `MetricResult:${OPERATIONAL_HISTORY_METRIC_KEY}`,
    role: "auxiliary",
    kind: "technical",
    recordIds: [],
    fieldsPresent: ["status", "period", "coverage", "sources", "limitations"],
    fieldsMissing: [],
  };
}

function buildOperationalHistoryEvidence(
  input: BuildOperationalHistoryReviewInput,
  options: {
    metric: MetricResult<number> | null;
    coverage?: string[];
    limitations?: string[];
    conflicts?: DecisionEvidenceConflict[];
    includeMetricSource?: boolean;
  },
): DecisionRecommendation<OperationalHistoryReviewData>["evidence"] {
  return {
    primarySources: [operationalHistorySource(options.metric)],
    auxiliarySources: [
      ...(options.includeMetricSource ? [operationalHistoryMetricSource()] : []),
      ...technicalSources(input),
    ],
    convergence: [
      sourceConvergence(
        `MetricResult:${OPERATIONAL_HISTORY_METRIC_KEY}`,
        input.metrics,
      ),
    ],
    coverage: options.coverage ?? [],
    limitations: options.limitations ?? technicalLimitations(input),
    conflicts: options.conflicts ?? [],
  };
}

function buildOperationalHistorySelectionRecommendation(
  input: BuildOperationalHistoryReviewInput,
  selection: Exclude<OperationalHistorySelection, { kind: "selected" }>,
): DecisionRecommendation<OperationalHistoryReviewData> {
  const base = operationalHistoryBase(input);
  if (selection.kind === "unavailable") {
    return {
      ...base,
      status: selection.status,
      statusReason: unavailableReason(selection.status),
      data: null,
      evidence: buildOperationalHistoryEvidence(input, { metric: null }),
      suggestedAction: { ...OPERATIONAL_HISTORY_ACTION },
    };
  }
  const conflict = selection.kind === "conflict";
  return {
    ...base,
    status: conflict ? "ambiguous" : selection.status,
    statusReason: conflict
      ? "Ha MetricResult divergente para a mesma fazenda, metrica e periodo; nenhum desempate foi autorizado."
      : selection.reason,
    data: null,
    evidence: buildOperationalHistoryEvidence(input, {
      metric: selection.metric,
      coverage: conflict ? [`fazenda:${input.fazendaId}`] : [],
      conflicts: conflict
        ? [
            {
              code: "conflicting_metric_result",
              source: `MetricResult:${OPERATIONAL_HISTORY_METRIC_KEY}`,
              recordIds: [],
              description:
                "Snapshots metricos da mesma fazenda apresentam valor, status, periodo, cobertura ou fonte divergente.",
            },
          ]
        : [],
    }),
    suggestedAction: { ...OPERATIONAL_HISTORY_ACTION },
  };
}

function buildInvalidOperationalHistoryRecommendation(
  input: BuildOperationalHistoryReviewInput,
  contract: Extract<OperationalHistoryContract, { kind: "invalid" }>,
): DecisionRecommendation<OperationalHistoryReviewData> {
  const period = contract.metric.period;
  return {
    ...operationalHistoryBase(input),
    period: {
      start: period?.from,
      end: period?.to,
      timezone: period?.timezone ?? input.timezone,
      cutoffAt: input.cutoffAt,
    },
    status: "not_permitted",
    statusReason:
      "Fonte primaria, periodo, timezone ou cobertura historica obrigatoria nao esta explicita no MetricResult.",
    data: null,
    evidence: buildOperationalHistoryEvidence(input, {
      metric: contract.metric,
      coverage: [`fazenda:${input.fazendaId}`],
      limitations: unique([
        ...technicalLimitations(input),
        ...contract.metric.limitations,
      ]),
    }),
    suggestedAction: { ...OPERATIONAL_HISTORY_ACTION },
  };
}

function buildTimezoneConflictRecommendation(
  input: BuildOperationalHistoryReviewInput,
  contract: Extract<
    OperationalHistoryContract,
    { kind: "timezone_conflict" }
  >,
): DecisionRecommendation<OperationalHistoryReviewData> {
  const { metric, period } = contract;
  return {
    ...operationalHistoryBase(input),
    period: {
      start: period.from,
      end: period.to,
      timezone: period.timezone,
      cutoffAt: input.cutoffAt,
    },
    status: "ambiguous",
    statusReason:
      "O timezone do MetricResult diverge do timezone declarado para a decisao.",
    data: null,
    evidence: buildOperationalHistoryEvidence(input, {
      metric,
      coverage: [
        `fazenda:${input.fazendaId}`,
        `periodo:${period.from}/${period.to}`,
      ],
      limitations: unique([
        ...technicalLimitations(input),
        ...metric.limitations,
      ]),
      conflicts: [
        {
          code: "metric_timezone_conflict",
          source: `MetricResult:${OPERATIONAL_HISTORY_METRIC_KEY}`,
          recordIds: [],
          description: `Timezone metrico ${period.timezone ?? "ausente"} diverge de ${input.timezone}.`,
        },
      ],
    }),
    suggestedAction: { ...OPERATIONAL_HISTORY_ACTION },
  };
}

function buildOperationalHistoryAssessmentRecommendation(
  input: BuildOperationalHistoryReviewInput,
  contract: Extract<OperationalHistoryContract, { kind: "valid" }>,
  assessment: OperationalHistoryAssessment,
): DecisionRecommendation<OperationalHistoryReviewData> {
  const { metric, period, coverage } = contract;
  return {
    ...operationalHistoryBase(input),
    period: {
      start: period.from,
      end: period.to,
      timezone: period.timezone,
      cutoffAt: input.cutoffAt,
    },
    status: assessment.status,
    statusReason: assessment.statusReason,
    data: assessment.data,
    evidence: buildOperationalHistoryEvidence(input, {
      metric,
      includeMetricSource: true,
      coverage: [
        `fazenda:${input.fazendaId}`,
        `periodo:${period.from}/${period.to}`,
        `historico:${coverage.state}`,
      ],
      limitations: assessment.limitations,
    }),
    suggestedAction:
      assessment.status === "confirmed"
        ? undefined
        : { ...OPERATIONAL_HISTORY_ACTION },
  };
}

export function buildOperationalHistoryReviewRecommendation(
  input: BuildOperationalHistoryReviewInput,
): DecisionRecommendation<OperationalHistoryReviewData> {
  assertSharedInput(input);
  const selection = resolveOperationalHistoryMetric(input);
  if (selection.kind !== "selected") {
    return buildOperationalHistorySelectionRecommendation(input, selection);
  }
  const contract = validateOperationalHistoryContract(input, selection.metric);
  if (contract.kind === "invalid") {
    return buildInvalidOperationalHistoryRecommendation(input, contract);
  }
  if (contract.kind === "timezone_conflict") {
    return buildTimezoneConflictRecommendation(input, contract);
  }
  return buildOperationalHistoryAssessmentRecommendation(
    input,
    contract,
    deriveOperationalHistoryAssessment(input, contract),
  );
}

const HERD_FLOW_ACTION = {
  label: "Revisar relatorios",
  href: "/relatorios",
};
const HERD_FLOW_PROHIBITED_ACTIONS = [
  "nao cria nem altera Evento",
  "nao conclui nem altera Agenda",
  "nao move animal nem altera state_*",
  "nao persiste recomendacao ou MetricResult",
  "nao infere saldo populacional nem autoriza operacao",
];

type HerdFlowMetrics = Record<HerdFlowMetricKey, MetricResult<number>>;
type HerdFlowMetricResolution =
  | { kind: "selected"; key: HerdFlowMetricKey; metric: MetricResult<number> }
  | {
      kind: "missing";
      key: HerdFlowMetricKey;
      status: "unknown" | "not_permitted";
      metric: MetricResult<number> | null;
    }
  | {
      kind: "conflict";
      key: HerdFlowMetricKey;
      metric: MetricResult<number>;
    };
type HerdFlowSelection =
  | { kind: "unavailable"; status: DecisionRecommendationStatus }
  | {
      kind: "missing";
      status: "unknown" | "not_permitted";
      metrics: Partial<HerdFlowMetrics>;
      missingKeys: HerdFlowMetricKey[];
    }
  | {
      kind: "conflict";
      metrics: Partial<HerdFlowMetrics>;
      conflictKeys: HerdFlowMetricKey[];
    }
  | { kind: "selected"; metrics: HerdFlowMetrics };
type HerdFlowContract =
  | { kind: "invalid"; metrics: HerdFlowMetrics; reason: string }
  | {
      kind: "conflict";
      metrics: HerdFlowMetrics;
      conflicts: DecisionEvidenceConflict[];
    }
  | {
      kind: "valid";
      metrics: HerdFlowMetrics;
      period: MetricPeriod;
      coverages: Record<HerdFlowMetricKey, MetricCoverage>;
      periodExceedsCutoff: boolean;
    };
type HerdFlowAssessment = {
  status: "confirmed" | "partial" | "unknown";
  statusReason: string;
  data: HerdFlowReviewData | null;
  limitations: string[];
};

function herdFlowBase(
  input: BuildHerdFlowReviewInput,
): Pick<
  DecisionRecommendation<HerdFlowReviewData>,
  | "id"
  | "decisionId"
  | "question"
  | "scope"
  | "generatedAt"
  | "period"
  | "prohibitedActions"
> {
  return {
    id: `${HERD_FLOW_DECISION_ID}:${input.fazendaId}`,
    decisionId: HERD_FLOW_DECISION_ID,
    question:
      "As entradas e saidas factuais observadas permitem revisar o fluxo do rebanho no periodo?",
    scope: { fazendaId: input.fazendaId, entityType: "herd_flow_metric" },
    generatedAt: input.cutoffAt,
    period: { timezone: input.timezone, cutoffAt: input.cutoffAt },
    prohibitedActions: [...HERD_FLOW_PROHIBITED_ACTIONS],
  };
}

function resolveHerdFlowMetric(
  input: BuildHerdFlowReviewInput,
  key: HerdFlowMetricKey,
): HerdFlowMetricResolution {
  const snapshots = (input.metrics.records ?? []).filter(
    (snapshot) => snapshot.metricKey === key,
  );
  const unscoped = snapshots.find(
    (snapshot) => !snapshot.result.coverage?.scope.fazendaId,
  );
  const localMetrics = snapshots
    .filter(
      (snapshot) =>
        snapshot.result.coverage?.scope.fazendaId === input.fazendaId,
    )
    .map((snapshot) => snapshot.result);
  if (localMetrics.length === 0) {
    return {
      kind: "missing",
      key,
      status: unscoped ? "not_permitted" : "unknown",
      metric: unscoped?.result ?? null,
    };
  }
  const variants = unique(localMetrics.map(canonicalMetricResult));
  return variants.length > 1
    ? { kind: "conflict", key, metric: localMetrics[0] }
    : { kind: "selected", key, metric: localMetrics[0] };
}

function resolvedHerdFlowMetrics(
  resolutions: readonly HerdFlowMetricResolution[],
): Partial<HerdFlowMetrics> {
  return Object.fromEntries(
    resolutions
      .filter(
        (
          resolution,
        ): resolution is Extract<
          HerdFlowMetricResolution,
          { kind: "selected" | "conflict" }
        > => resolution.kind !== "missing",
      )
      .map((resolution) => [resolution.key, resolution.metric]),
  );
}

function resolveHerdFlowMetrics(
  input: BuildHerdFlowReviewInput,
): HerdFlowSelection {
  const unavailable = unavailableStatus([input.metrics]);
  if (unavailable) return { kind: "unavailable", status: unavailable };

  const resolutions = HERD_FLOW_METRIC_KEYS.map((key) =>
    resolveHerdFlowMetric(input, key),
  );
  const metrics = resolvedHerdFlowMetrics(resolutions);
  const conflictKeys = resolutions
    .filter((resolution) => resolution.kind === "conflict")
    .map((resolution) => resolution.key);
  if (conflictKeys.length > 0) {
    return { kind: "conflict", metrics, conflictKeys };
  }
  const missing = resolutions.filter(
    (
      resolution,
    ): resolution is Extract<HerdFlowMetricResolution, { kind: "missing" }> =>
      resolution.kind === "missing",
  );
  if (missing.length > 0) {
    return {
      kind: "missing",
      status: missing.some(
        (resolution) => resolution.status === "not_permitted",
      )
        ? "not_permitted"
        : "unknown",
      metrics,
      missingKeys: missing.map((resolution) => resolution.key),
    };
  }
  return { kind: "selected", metrics: metrics as HerdFlowMetrics };
}

function validHerdFlowMetric(
  input: BuildHerdFlowReviewInput,
  metric: MetricResult<number>,
): boolean {
  const valueIsValid =
    metric.value === null ||
    (Number.isFinite(metric.value) && metric.value >= 0);
  return [
    metric.sources.some(
      (source) => source.role === "primary" && source.name === "event_eventos",
    ),
    Boolean(metric.period && validOperationalHistoryPeriod(metric.period)),
    Boolean(
      metric.coverage &&
      validOperationalHistoryCoverage(metric.coverage, input.fazendaId),
    ),
    valueIsValid,
    Boolean(input.timezone),
  ].every(Boolean);
}

function herdFlowPeriodConflict(
  entries: MetricPeriod,
  exits: MetricPeriod,
): DecisionEvidenceConflict | null {
  const samePeriod =
    entries.from === exits.from &&
    entries.to === exits.to &&
    entries.timezone === exits.timezone;
  return samePeriod
    ? null
    : {
        code: "herd_flow_period_conflict",
        source: "MetricResult:rebanho_entradas+rebanho_saidas",
        recordIds: [],
        description:
          "Os MetricResult de entradas e saidas usam periodo ou timezone divergente.",
      };
}

function validateHerdFlowContract(
  input: BuildHerdFlowReviewInput,
  metrics: HerdFlowMetrics,
): HerdFlowContract {
  const validMetrics = HERD_FLOW_METRIC_KEYS.every((key) =>
    validHerdFlowMetric(input, metrics[key]),
  );
  if (!validMetrics) {
    return {
      kind: "invalid",
      metrics,
      reason:
        "Fonte primaria, valor, periodo ou cobertura historica obrigatoria nao esta explicita nos MetricResult.",
    };
  }
  const entriesPeriod = metrics.rebanho_entradas.period!;
  const exitsPeriod = metrics.rebanho_saidas.period!;
  const periodConflict = herdFlowPeriodConflict(entriesPeriod, exitsPeriod);
  const timezoneConflict =
    entriesPeriod.timezone !== input.timezone
      ? {
          code: "herd_flow_timezone_conflict",
          source: "MetricResult:rebanho_entradas+rebanho_saidas",
          recordIds: [],
          description: `Timezone metrico ${entriesPeriod.timezone ?? "ausente"} diverge de ${input.timezone}.`,
        }
      : null;
  const conflicts = [periodConflict, timezoneConflict].filter(
    (conflict): conflict is DecisionEvidenceConflict => conflict !== null,
  );
  if (conflicts.length > 0) return { kind: "conflict", metrics, conflicts };

  const cutoffKey = cutoffDateKey(input.cutoffAt, input.timezone!);
  if (!cutoffKey) {
    return {
      kind: "invalid",
      metrics,
      reason: "Cutoff ou timezone nao permite delimitar o periodo da leitura.",
    };
  }
  return {
    kind: "valid",
    metrics,
    period: entriesPeriod,
    coverages: {
      rebanho_entradas: metrics.rebanho_entradas.coverage!,
      rebanho_saidas: metrics.rebanho_saidas.coverage!,
    },
    periodExceedsCutoff: entriesPeriod.to > cutoffKey,
  };
}

function herdFlowPrimarySource(
  metrics: Partial<HerdFlowMetrics>,
): DecisionEvidenceSource {
  const presentKeys = HERD_FLOW_METRIC_KEYS.filter((key) => metrics[key]);
  const missingKeys = HERD_FLOW_METRIC_KEYS.filter((key) => !metrics[key]);
  return {
    name: "event_eventos",
    role: "primary",
    kind: "event",
    recordIds: [],
    fieldsPresent: presentKeys.map((key) => `MetricResult:${key}`),
    fieldsMissing: missingKeys.map((key) => `MetricResult:${key}`),
  };
}

function herdFlowAuxiliarySources(
  metrics: Partial<HerdFlowMetrics>,
): DecisionEvidenceSource[] {
  const detailNames = unique(
    Object.values(metrics).flatMap((metric) =>
      metric.sources
        .filter((source) => source.role === "auxiliary")
        .map((source) => source.name),
    ),
  );
  return detailNames.map((name) => ({
    name,
    role: "auxiliary",
    kind: "event_detail",
    recordIds: [],
    fieldsPresent: ["MetricResult.sources"],
    fieldsMissing: [],
  }));
}

function buildHerdFlowEvidence(
  input: BuildHerdFlowReviewInput,
  options: {
    metrics?: Partial<HerdFlowMetrics>;
    coverage?: string[];
    limitations?: string[];
    conflicts?: DecisionEvidenceConflict[];
  } = {},
): DecisionRecommendation<HerdFlowReviewData>["evidence"] {
  const metrics = options.metrics ?? {};
  return {
    primarySources: [herdFlowPrimarySource(metrics)],
    auxiliarySources: [
      ...HERD_FLOW_METRIC_KEYS.map((key) => ({
        name: `MetricResult:${key}`,
        role: "auxiliary" as const,
        kind: "technical" as const,
        recordIds: [],
        fieldsPresent: metrics[key]
          ? ["status", "period", "coverage", "sources", "limitations"]
          : [],
        fieldsMissing: metrics[key] ? [] : ["MetricResult"],
      })),
      ...herdFlowAuxiliarySources(metrics),
      ...technicalSources(input),
    ],
    convergence: HERD_FLOW_METRIC_KEYS.map((key) =>
      sourceConvergence(`MetricResult:${key}`, input.metrics),
    ),
    coverage: options.coverage ?? [],
    limitations: options.limitations ?? technicalLimitations(input),
    conflicts: options.conflicts ?? [],
  };
}

function buildHerdFlowSelectionRecommendation(
  input: BuildHerdFlowReviewInput,
  selection: Exclude<HerdFlowSelection, { kind: "selected" }>,
): DecisionRecommendation<HerdFlowReviewData> {
  const base = herdFlowBase(input);
  if (selection.kind === "unavailable") {
    return {
      ...base,
      status: selection.status,
      statusReason: unavailableReason(selection.status),
      data: null,
      evidence: buildHerdFlowEvidence(input),
      suggestedAction: { ...HERD_FLOW_ACTION },
    };
  }
  if (selection.kind === "missing") {
    return {
      ...base,
      status: selection.status,
      statusReason:
        selection.status === "not_permitted"
          ? "Um MetricResult obrigatorio nao declara escopo por fazenda; a conclusao nao e permitida."
          : "Um ou mais MetricResult obrigatorios nao foram localizados para a fazenda.",
      data: null,
      evidence: buildHerdFlowEvidence(input, {
        metrics: selection.metrics,
        limitations: [
          ...technicalLimitations(input),
          `MetricResult ausente: ${selection.missingKeys.join(", ")}.`,
        ],
      }),
      suggestedAction: { ...HERD_FLOW_ACTION },
    };
  }
  return {
    ...base,
    status: "ambiguous",
    statusReason:
      "Ha MetricResult divergente para a mesma fazenda e metrica; nenhum desempate foi autorizado.",
    data: null,
    evidence: buildHerdFlowEvidence(input, {
      metrics: selection.metrics,
      coverage: [`fazenda:${input.fazendaId}`],
      conflicts: selection.conflictKeys.map((key) => ({
        code: "conflicting_herd_flow_metric",
        source: `MetricResult:${key}`,
        recordIds: [],
        description: `Snapshots divergentes foram recebidos para ${key}.`,
      })),
    }),
    suggestedAction: { ...HERD_FLOW_ACTION },
  };
}

function buildHerdFlowContractRecommendation(
  input: BuildHerdFlowReviewInput,
  contract: Exclude<HerdFlowContract, { kind: "valid" }>,
): DecisionRecommendation<HerdFlowReviewData> {
  const entriesPeriod = contract.metrics.rebanho_entradas.period;
  const base = {
    ...herdFlowBase(input),
    period: {
      start: entriesPeriod?.from,
      end: entriesPeriod?.to,
      timezone: entriesPeriod?.timezone ?? input.timezone,
      cutoffAt: input.cutoffAt,
    },
  };
  return {
    ...base,
    status: contract.kind === "conflict" ? "ambiguous" : "not_permitted",
    statusReason:
      contract.kind === "conflict"
        ? "Periodo ou timezone diverge entre as fontes obrigatorias do fluxo do rebanho."
        : contract.reason,
    data: null,
    evidence: buildHerdFlowEvidence(input, {
      metrics: contract.metrics,
      limitations: unique([
        ...technicalLimitations(input),
        ...HERD_FLOW_METRIC_KEYS.flatMap(
          (key) => contract.metrics[key].limitations,
        ),
      ]),
      conflicts: contract.kind === "conflict" ? contract.conflicts : [],
    }),
    suggestedAction: { ...HERD_FLOW_ACTION },
  };
}

function herdFlowData(
  status: HerdFlowAssessment["status"],
  metrics: HerdFlowMetrics,
  coverages: Record<HerdFlowMetricKey, MetricCoverage>,
): HerdFlowReviewData | null {
  const entries = metrics.rebanho_entradas.value;
  const exits = metrics.rebanho_saidas.value;
  if (status === "unknown" || entries === null || exits === null) return null;
  return {
    summary:
      status === "confirmed"
        ? `${entries} entrada(s) e ${exits} saida(s) factuais no periodo com cobertura verificada.`
        : `${entries} entrada(s) e ${exits} saida(s) observadas; revise as limitacoes antes de interpretar o fluxo.`,
    observedEntries: entries,
    observedExits: exits,
    entryMetricStatus: metrics.rebanho_entradas.status,
    exitMetricStatus: metrics.rebanho_saidas.status,
    coverageStates: [
      coverages.rebanho_entradas.state,
      coverages.rebanho_saidas.state,
    ],
  };
}

function deriveHerdFlowAssessment(
  input: BuildHerdFlowReviewInput,
  contract: Extract<HerdFlowContract, { kind: "valid" }>,
): HerdFlowAssessment {
  const { metrics, period, coverages, periodExceedsCutoff } = contract;
  const limitations = unique([
    ...technicalLimitations(input),
    ...HERD_FLOW_METRIC_KEYS.flatMap((key) => metrics[key].limitations),
    "A leitura nao infere transferencias externas, descartes sem Evento ou saldo populacional do rebanho.",
    ...optionalLimitation(
      periodExceedsCutoff,
      "O periodo metrico termina depois do cutoff; a leitura representa somente o conjunto observado ate o cutoff.",
    ),
    ...optionalLimitation(
      !input.metrics.convergence.verified,
      "A derivacao local dos MetricResult nao foi declarada como verificada.",
    ),
  ]);
  const complete = [
    ...HERD_FLOW_METRIC_KEYS.map((key) => metrics[key].status === "complete"),
    ...HERD_FLOW_METRIC_KEYS.map((key) => coverages[key].state === "verified"),
    ...HERD_FLOW_METRIC_KEYS.map(
      (key) => metrics[key].period?.timezoneSource === "farm",
    ),
    input.timezoneVerified,
    input.metrics.convergence.verified,
    input.metrics.convergence.mode !== "not_verified",
    !periodExceedsCutoff,
  ].every(Boolean);
  const unavailable = HERD_FLOW_METRIC_KEYS.some(
    (key) =>
      metrics[key].status === "unavailable" || metrics[key].value === null,
  );
  const status = complete ? "confirmed" : unavailable ? "unknown" : "partial";
  return {
    status,
    statusReason:
      status === "confirmed"
        ? "Entradas, saidas, escopo, periodo, timezone e cobertura historica estao explicitos."
        : status === "unknown"
          ? "Ao menos um MetricResult nao possui valor interpretavel com a cobertura disponivel."
          : "Os volumes observados sao uteis, mas cobertura, detalhe, cutoff, timezone ou convergencia limitam a interpretacao.",
    data: herdFlowData(status, metrics, coverages),
    limitations,
  };
}

function buildHerdFlowAssessmentRecommendation(
  input: BuildHerdFlowReviewInput,
  contract: Extract<HerdFlowContract, { kind: "valid" }>,
  assessment: HerdFlowAssessment,
): DecisionRecommendation<HerdFlowReviewData> {
  const { metrics, period, coverages } = contract;
  return {
    ...herdFlowBase(input),
    period: {
      start: period.from,
      end: period.to,
      timezone: period.timezone,
      cutoffAt: input.cutoffAt,
    },
    status: assessment.status,
    statusReason: assessment.statusReason,
    data: assessment.data,
    evidence: buildHerdFlowEvidence(input, {
      metrics,
      coverage: [
        `fazenda:${input.fazendaId}`,
        `periodo:${period.from}/${period.to}`,
        `entradas:${coverages.rebanho_entradas.state}`,
        `saidas:${coverages.rebanho_saidas.state}`,
      ],
      limitations: assessment.limitations,
    }),
    suggestedAction: { ...HERD_FLOW_ACTION },
  };
}

export function buildHerdFlowReviewRecommendation(
  input: BuildHerdFlowReviewInput,
): DecisionRecommendation<HerdFlowReviewData> {
  assertSharedInput(input);
  const selection = resolveHerdFlowMetrics(input);
  if (selection.kind !== "selected") {
    return buildHerdFlowSelectionRecommendation(input, selection);
  }
  const contract = validateHerdFlowContract(input, selection.metrics);
  if (contract.kind !== "valid") {
    return buildHerdFlowContractRecommendation(input, contract);
  }
  return buildHerdFlowAssessmentRecommendation(
    input,
    contract,
    deriveHerdFlowAssessment(input, contract),
  );
}
