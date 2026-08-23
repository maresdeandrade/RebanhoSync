import type { AgendaItem, Evento, EventoPesagem } from "@/lib/offline/types";

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

const WEIGHT_DECISION_ID = "weight_data_quality";
const OVERDUE_AGENDA_DECISION_ID = "overdue_agenda_review";
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
