import type { AgendaItem, Evento } from "@/lib/offline/types";
import {
  readBiosecurityOccurrencePayload,
  type BiosecurityOccurrenceCategory,
  type BiosecurityOccurrenceKind,
  type BiosecurityOccurrencePayload,
  type BiosecurityOccurrenceScope,
  type BiosecurityOccurrenceSeverity,
  type BiosecurityOccurrenceStatus,
} from "@/lib/sanitario/compliance/biosecurityOccurrence";
import { readSanitaryCorrectionPayload } from "@/lib/sanitario/reconciliation/sanitaryCorrections";

export type BiosecurityOccurrenceSignalCode =
  | "biosseguranca:ocorrencia_aberta"
  | "biosseguranca:ocorrencia_com_pendencia"
  | "biosseguranca:alta_gravidade"
  | "sanitario:suspeita_notificavel"
  | "sanitario:notificacao_pendente";

export type BiosecurityOccurrenceSignal = {
  code: BiosecurityOccurrenceSignalCode;
  label: string;
  source: "eventos.payload.biosseguranca_ocorrencia";
  eventoId: string;
  agendaItemId?: string;
  severity: "info" | "warning" | "critical";
};

export type BiosecurityOccurrenceProjection = {
  eventoId: string;
  occurredAt: string;
  animalId: string | null;
  loteId: string | null;
  localId: string | null;
  sourceAgendaItemId: string | null;
  linkedEventoId: string | null;
  category: BiosecurityOccurrenceCategory;
  tipoOcorrencia: string;
  tiposOcorrencia: BiosecurityOccurrenceKind[];
  escopoTipo: BiosecurityOccurrenceScope;
  escoposTipo: BiosecurityOccurrenceScope[];
  gravidade: BiosecurityOccurrenceSeverity;
  status: BiosecurityOccurrenceStatus;
  geraPendencia: boolean;
  prazoCorrecao: string | null;
  pendingAgendaItemIds: string[];
  notificationPending: boolean;
  source: "eventos.payload.biosseguranca_ocorrencia";
  payload: BiosecurityOccurrencePayload;
};

export type BiosecurityOccurrenceReportSummary = {
  source: "eventos.payload.biosseguranca_ocorrencia";
  total: number;
  openCount: number;
  pendingCount: number;
  notifiableOpenCount: number;
  unresolvedResolutionTimeReason: string | null;
  byTipoOcorrencia: Array<{ key: string; count: number }>;
  byGravidade: Array<{ key: BiosecurityOccurrenceSeverity; count: number }>;
  byEscopo: Array<{ key: BiosecurityOccurrenceScope; count: number }>;
  byAnimal: Array<{ key: string; count: number }>;
  byLote: Array<{ key: string; count: number }>;
  byLocal: Array<{ key: string; count: number }>;
  byStatus: Array<{ key: BiosecurityOccurrenceStatus; count: number }>;
  pendingAgendaItemIds: string[];
};

export type BuildBiosecurityOccurrenceReadModelInput = {
  eventos: readonly Evento[];
  agenda?: readonly AgendaItem[];
  from?: string;
  to?: string;
};

export function buildBiosecurityOccurrenceReadModel({
  eventos,
  agenda = [],
  from,
  to,
}: BuildBiosecurityOccurrenceReadModelInput): BiosecurityOccurrenceProjection[] {
  const openAgendaBySourceEvent = groupOpenAgendaBySourceEvent(agenda);
  const correctionByOriginEvent = groupBiosecurityCorrectionsByOriginEvent(eventos);

  return eventos
    .filter((evento) => isWithinPeriod(evento.occurred_at, from, to))
    .map((evento) => {
      const occurrence = readBiosecurityOccurrencePayload(evento.payload);
      if (!occurrence) return null;
      const correction = correctionByOriginEvent.get(evento.id);
      const status = correction?.status ?? occurrence.status;

      const pendingAgendaItems = openAgendaBySourceEvent.get(evento.id) ?? [];

      return {
        eventoId: evento.id,
        occurredAt: evento.occurred_at,
        animalId: occurrence.animal_id ?? evento.animal_id ?? null,
        loteId: occurrence.lote_id ?? evento.lote_id ?? null,
        localId: occurrence.local_id ?? null,
        sourceAgendaItemId: occurrence.agenda_item_id ?? evento.source_task_id ?? null,
        linkedEventoId: occurrence.evento_id ?? null,
        category: occurrence.categoria_ocorrencia,
        tipoOcorrencia: occurrence.tipo_ocorrencia,
        tiposOcorrencia: occurrence.tipos_ocorrencia,
        escopoTipo: occurrence.escopo_tipo,
        escoposTipo: occurrence.escopos_tipo,
        gravidade: occurrence.gravidade,
        status,
        geraPendencia: occurrence.gera_pendencia,
        prazoCorrecao: occurrence.prazo_correcao,
        pendingAgendaItemIds: pendingAgendaItems.map((item) => item.id),
        notificationPending:
          occurrence.categoria_ocorrencia === "suspeita_doenca_notificavel" &&
          pendingAgendaItems.length > 0,
        source: "eventos.payload.biosseguranca_ocorrencia",
        payload: occurrence,
      } satisfies BiosecurityOccurrenceProjection;
    })
    .filter((item): item is BiosecurityOccurrenceProjection => item !== null);
}

export function buildBiosecurityOccurrenceSignals(
  input: BuildBiosecurityOccurrenceReadModelInput,
): BiosecurityOccurrenceSignal[] {
  const projections = buildBiosecurityOccurrenceReadModel(input);
  const signals: BiosecurityOccurrenceSignal[] = [];

  for (const occurrence of projections) {
    if (occurrence.status === "aberta") {
      signals.push(createSignal(occurrence, "biosseguranca:ocorrencia_aberta"));
    }

    if (occurrence.pendingAgendaItemIds.length > 0) {
      signals.push(createSignal(occurrence, "biosseguranca:ocorrencia_com_pendencia"));
    }

    if (occurrence.gravidade === "alta") {
      signals.push(createSignal(occurrence, "biosseguranca:alta_gravidade"));
    }

    if (occurrence.category === "suspeita_doenca_notificavel") {
      signals.push(createSignal(occurrence, "sanitario:suspeita_notificavel"));
      if (occurrence.notificationPending) {
        signals.push(createSignal(occurrence, "sanitario:notificacao_pendente"));
      }
    }
  }

  return signals;
}

export function summarizeBiosecurityOccurrences(
  input: BuildBiosecurityOccurrenceReadModelInput,
): BiosecurityOccurrenceReportSummary {
  const projections = buildBiosecurityOccurrenceReadModel(input);
  const pendingAgendaItemIds = projections.flatMap(
    (occurrence) => occurrence.pendingAgendaItemIds,
  );

  return {
    source: "eventos.payload.biosseguranca_ocorrencia",
    total: projections.length,
    openCount: projections.filter((item) => item.status === "aberta").length,
    pendingCount: projections.filter((item) => item.pendingAgendaItemIds.length > 0).length,
    notifiableOpenCount: projections.filter(
      (item) =>
        item.category === "suspeita_doenca_notificavel" &&
        item.status === "aberta",
    ).length,
    unresolvedResolutionTimeReason:
      projections.some((item) => item.status === "resolvida")
        ? "Tempo ate resolucao exige data estruturada de resolucao no payload."
        : null,
    byTipoOcorrencia: countBy(projections.flatMap((item) => item.tiposOcorrencia)),
    byGravidade: countBy(projections.map((item) => item.gravidade)),
    byEscopo: countBy(projections.flatMap((item) => item.escoposTipo)),
    byAnimal: countBy(projections.map((item) => item.animalId ?? "sem_animal")),
    byLote: countBy(projections.map((item) => item.loteId ?? "sem_lote")),
    byLocal: countBy(projections.map((item) => item.localId ?? "sem_local")),
    byStatus: countBy(projections.map((item) => item.status)),
  pendingAgendaItemIds,
  };
}

function groupBiosecurityCorrectionsByOriginEvent(
  eventos: readonly Evento[],
): Map<string, { status: BiosecurityOccurrenceStatus; resolvedAt: string | null }> {
  const grouped = new Map<
    string,
    { status: BiosecurityOccurrenceStatus; resolvedAt: string | null }
  >();

  for (const event of eventos) {
    const correction = readSanitaryCorrectionPayload(event.payload);
    if (!correction) continue;
    if (
      correction.tipo_correcao !== "resolucao_ocorrencia_biosseguranca" &&
      correction.tipo_correcao !== "cancelamento_ocorrencia_biosseguranca"
    ) {
      continue;
    }

    const status =
      correction.tipo_correcao === "cancelamento_ocorrencia_biosseguranca"
        ? "cancelada"
        : "resolvida";
    const resolvedAt =
      typeof correction.payload_correcao.resolvida_em === "string"
        ? correction.payload_correcao.resolvida_em
        : correction.created_at;
    grouped.set(correction.evento_origem_id, { status, resolvedAt });
  }

  return grouped;
}

function createSignal(
  occurrence: BiosecurityOccurrenceProjection,
  code: BiosecurityOccurrenceSignalCode,
): BiosecurityOccurrenceSignal {
  return {
    code,
    label: SIGNAL_LABELS[code],
    source: "eventos.payload.biosseguranca_ocorrencia",
    eventoId: occurrence.eventoId,
    agendaItemId: occurrence.pendingAgendaItemIds[0],
    severity:
      code === "biosseguranca:alta_gravidade" ||
      code === "sanitario:notificacao_pendente"
        ? "critical"
        : code === "biosseguranca:ocorrencia_com_pendencia"
          ? "warning"
          : "info",
  };
}

const SIGNAL_LABELS: Record<BiosecurityOccurrenceSignalCode, string> = {
  "biosseguranca:ocorrencia_aberta": "Ocorrencia de biosseguranca aberta",
  "biosseguranca:ocorrencia_com_pendencia": "Ocorrencia com pendencia especifica",
  "biosseguranca:alta_gravidade": "Ocorrencia de alta gravidade",
  "sanitario:suspeita_notificavel": "Suspeita notificavel registrada",
  "sanitario:notificacao_pendente": "Notificacao sanitaria pendente",
};

function groupOpenAgendaBySourceEvent(
  agenda: readonly AgendaItem[],
): Map<string, AgendaItem[]> {
  const grouped = new Map<string, AgendaItem[]>();

  for (const item of agenda) {
    if (item.status !== "agendado" || item.deleted_at) continue;
    const sourceEventId = readAgendaSourceEventId(item);
    if (!sourceEventId) continue;

    const nextItems = grouped.get(sourceEventId) ?? [];
    nextItems.push(item);
    grouped.set(sourceEventId, nextItems);
  }

  return grouped;
}

function readAgendaSourceEventId(item: AgendaItem): string | null {
  if (item.source_evento_id) return item.source_evento_id;
  const payloadEventId = readStringField(item.payload, "occurrence_evento_id");
  if (payloadEventId) return payloadEventId;
  return readStringField(item.source_ref, "evento_id");
}

function readStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" && fieldValue.trim()
    ? fieldValue
    : null;
}

function isWithinPeriod(value: string, from?: string, to?: string): boolean {
  const dateKey = value.slice(0, 10);
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

function countBy<T extends string>(values: readonly T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}
