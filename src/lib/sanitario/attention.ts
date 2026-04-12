import type {
  AgendaItem,
  Animal,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  type SanitaryBaseCalendarAnchor,
  type SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/agendaSchedule";
import {
  getSanitaryAgendaPriority,
  readSanitaryProtocolRestrictions,
  type SanitaryAgendaPriority,
} from "@/lib/sanitario/protocolRules";

type AgendaStatusLabel = "atrasado" | "hoje" | "proximo";

export interface SanitaryAttentionRow {
  id: string;
  data: string;
  titulo: string;
  contexto: string;
  produto: string;
  scheduleLabel: string;
  scheduleMode: SanitaryBaseCalendarMode;
  scheduleModeLabel: string;
  scheduleAnchor: SanitaryBaseCalendarAnchor | null;
  scheduleAnchorLabel: string | null;
  status: AgendaStatusLabel;
  priorityLabel: string;
  priorityTone: SanitaryAgendaPriority["tone"];
  mandatory: boolean;
  requiresVet: boolean;
  daysDelta: number;
}

export interface SanitaryAttentionScheduleModeCount {
  key: SanitaryBaseCalendarMode;
  label: string;
  count: number;
}

export interface SanitaryAttentionScheduleAnchorCount {
  key: SanitaryBaseCalendarAnchor;
  label: string;
  count: number;
}

export interface SanitaryAttentionSummary {
  totalOpen: number;
  criticalCount: number;
  warningCount: number;
  overdueCount: number;
  dueTodayCount: number;
  mandatoryCount: number;
  requiresVetCount: number;
  scheduleModes: SanitaryAttentionScheduleModeCount[];
  scheduleAnchors: SanitaryAttentionScheduleAnchorCount[];
  topItems: SanitaryAttentionRow[];
}

const TONE_RANK: Record<SanitaryAgendaPriority["tone"], number> = {
  danger: 0,
  warning: 1,
  info: 2,
  neutral: 3,
};

export const EMPTY_SANITARY_ATTENTION_SUMMARY: SanitaryAttentionSummary = {
  totalOpen: 0,
  criticalCount: 0,
  warningCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  mandatoryCount: 0,
  requiresVetCount: 0,
  scheduleModes: [],
  scheduleAnchors: [],
  topItems: [],
};

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveAgendaStatus(
  item: Pick<AgendaItem, "data_prevista">,
  todayKey: string,
): AgendaStatusLabel {
  if (item.data_prevista < todayKey) return "atrasado";
  if (item.data_prevista === todayKey) return "hoje";
  return "proximo";
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveProdutoLabel(
  item: Pick<AgendaItem, "tipo" | "source_ref" | "payload">,
  protocolItem: Pick<ProtocoloSanitarioItem, "produto"> | null,
): string {
  return (
    readString(item.source_ref, "produto") ??
    readString(item.payload, "produto") ??
    protocolItem?.produto ??
    item.tipo.replaceAll("_", " ")
  );
}

function resolveTitulo(
  item: Pick<AgendaItem, "tipo">,
  protocol: Pick<ProtocoloSanitario, "nome"> | null,
  produto: string,
): string {
  if (protocol?.nome) {
    return `${protocol.nome}: ${produto}`;
  }
  return `Sanitario: ${item.tipo.replaceAll("_", " ")}`;
}

function resolveContexto(
  item: Pick<AgendaItem, "animal_id" | "lote_id">,
  animalById: Map<string, string>,
  loteById: Map<string, string>,
): string {
  return (
    animalById.get(item.animal_id ?? "") ??
    loteById.get(item.lote_id ?? "") ??
    "Sem animal ou lote vinculado"
  );
}

function compareSanitaryAttentionRows(
  left: SanitaryAttentionRow,
  right: SanitaryAttentionRow,
): number {
  const toneDiff = TONE_RANK[left.priorityTone] - TONE_RANK[right.priorityTone];
  if (toneDiff !== 0) return toneDiff;

  const deltaDiff = left.daysDelta - right.daysDelta;
  if (deltaDiff !== 0) return deltaDiff;

  return left.data.localeCompare(right.data);
}

export function summarizeSanitaryAgendaAttention(input: {
  agenda: AgendaItem[];
  animals?: Array<Pick<Animal, "id" | "identificacao" | "nome">>;
  lotes?: Array<Pick<Lote, "id" | "nome">>;
  protocols?: Array<Pick<ProtocoloSanitario, "id" | "nome" | "payload">>;
  protocolItems?: Array<
    Pick<
      ProtocoloSanitarioItem,
      "id" | "protocolo_id" | "produto" | "payload" | "intervalo_dias"
    >
  >;
  limit?: number;
  today?: Date;
}): SanitaryAttentionSummary {
  const today = input.today ?? new Date();
  const todayKey = toDateKey(today);
  const limit = Math.max(0, input.limit ?? 4);
  const agendaAberta = input.agenda.filter(
    (item) =>
      item.dominio === "sanitario" &&
      item.status === "agendado" &&
      !item.deleted_at,
  );

  if (agendaAberta.length === 0) {
    return EMPTY_SANITARY_ATTENTION_SUMMARY;
  }

  const animalById = new Map(
    (input.animals ?? []).map((animal) => [
      animal.id,
      animal.identificacao || animal.nome || "Animal sem identificacao",
    ]),
  );
  const loteById = new Map((input.lotes ?? []).map((lote) => [lote.id, lote.nome]));
  const protocolById = new Map(
    (input.protocols ?? []).map((protocol) => [protocol.id, protocol]),
  );
  const protocolItemById = new Map(
    (input.protocolItems ?? []).map((protocolItem) => [protocolItem.id, protocolItem]),
  );

  const rows = agendaAberta.map((item) => {
    const protocolId = readString(item.source_ref, "protocolo_id");
    const protocol =
      protocolId ? protocolById.get(protocolId) ?? null : null;
    const protocolItem =
      item.protocol_item_version_id
        ? protocolItemById.get(item.protocol_item_version_id) ?? null
        : null;
    const restrictions = protocolItem
      ? readSanitaryProtocolRestrictions(protocolItem, protocol)
      : readSanitaryProtocolRestrictions({ payload: {} }, protocol);
    const priority = getSanitaryAgendaPriority({
      item,
      protocol,
      protocolItem,
      today,
    });
    const produto = resolveProdutoLabel(item, protocolItem);
    const scheduleMeta = resolveSanitaryAgendaItemScheduleMeta(
      item,
      protocolItem,
    );

    return {
      id: item.id,
      data: item.data_prevista,
      titulo: resolveTitulo(item, protocol, produto),
      contexto: resolveContexto(item, animalById, loteById),
      produto,
      scheduleLabel: scheduleMeta?.label ?? "Uso imediato",
      scheduleMode: scheduleMeta?.mode ?? "immediate",
      scheduleModeLabel: scheduleMeta?.modeLabel ?? "Uso imediato",
      scheduleAnchor: scheduleMeta?.anchor ?? null,
      scheduleAnchorLabel: scheduleMeta?.anchorLabel ?? null,
      status: resolveAgendaStatus(item, todayKey),
      priorityLabel: priority.label,
      priorityTone: priority.tone,
      mandatory: priority.mandatory,
      requiresVet: restrictions.requiresVet,
      daysDelta: priority.daysDelta,
    } satisfies SanitaryAttentionRow;
  });

  const sortedRows = rows.slice().sort(compareSanitaryAttentionRows);
  const scheduleModes = Array.from(
    rows.reduce((acc, row) => {
      const current = acc.get(row.scheduleMode);
      if (current) {
        current.count += 1;
      } else {
        acc.set(row.scheduleMode, {
          key: row.scheduleMode,
          label: row.scheduleModeLabel,
          count: 1,
        });
      }
      return acc;
    }, new Map<SanitaryBaseCalendarMode, SanitaryAttentionScheduleModeCount>()).values(),
  ).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const scheduleAnchors = Array.from(
    rows.reduce((acc, row) => {
      if (!row.scheduleAnchor || !row.scheduleAnchorLabel) return acc;

      const current = acc.get(row.scheduleAnchor);
      if (current) {
        current.count += 1;
      } else {
        acc.set(row.scheduleAnchor, {
          key: row.scheduleAnchor,
          label: row.scheduleAnchorLabel,
          count: 1,
        });
      }

      return acc;
    }, new Map<SanitaryBaseCalendarAnchor, SanitaryAttentionScheduleAnchorCount>()).values(),
  ).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return {
    totalOpen: rows.length,
    criticalCount: rows.filter((row) => row.priorityTone === "danger").length,
    warningCount: rows.filter((row) => row.priorityTone === "warning").length,
    overdueCount: rows.filter((row) => row.status === "atrasado").length,
    dueTodayCount: rows.filter((row) => row.status === "hoje").length,
    mandatoryCount: rows.filter((row) => row.mandatory).length,
    requiresVetCount: rows.filter((row) => row.requiresVet).length,
    scheduleModes,
    scheduleAnchors,
    topItems: sortedRows.slice(0, limit),
  };
}
