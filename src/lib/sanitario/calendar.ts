export const SANITARY_BASE_CALENDAR_VERSION = 1;

export type SanitaryBaseCalendarMode =
  | "campaign"
  | "age_window"
  | "rolling_interval"
  | "immediate"
  | "clinical_protocol";

export type SanitaryBaseCalendarAnchor =
  | "calendar_month"
  | "birth"
  | "weaning"
  | "pre_breeding_season"
  | "clinical_need"
  | "dry_off";

export interface SanitaryBaseCalendarRule {
  mode: SanitaryBaseCalendarMode;
  anchor: SanitaryBaseCalendarAnchor;
  label: string;
  months?: number[];
  intervalDays?: number | null;
  ageStartDays?: number | null;
  ageEndDays?: number | null;
  notes?: string;
}

export interface SanitaryAgendaScheduleMeta {
  label: string;
  mode: SanitaryBaseCalendarMode;
  modeLabel: string;
  anchor: SanitaryBaseCalendarAnchor | null;
  anchorLabel: string | null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMonths(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;

  const months = value
    .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    .map((entry) => Math.trunc(entry))
    .filter((entry) => entry >= 1 && entry <= 12);

  return months.length > 0 ? months : undefined;
}

export function buildSanitaryBaseCalendarPayload(
  rule: SanitaryBaseCalendarRule,
): Record<string, unknown> {
  return {
    calendario_base: {
      version: SANITARY_BASE_CALENDAR_VERSION,
      mode: rule.mode,
      anchor: rule.anchor,
      label: rule.label,
      months: rule.months ?? null,
      interval_days: rule.intervalDays ?? null,
      age_start_days: rule.ageStartDays ?? null,
      age_end_days: rule.ageEndDays ?? null,
      notes: rule.notes ?? null,
    },
  };
}

export function readSanitaryBaseCalendar(
  payload: Record<string, unknown> | null | undefined,
): SanitaryBaseCalendarRule | null {
  const rawRule = payload?.calendario_base;
  if (!rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) {
    return null;
  }

  const record = rawRule as Record<string, unknown>;
  const mode = readString(record, "mode");
  const anchor = readString(record, "anchor");
  const label = readString(record, "label");

  if (!mode || !anchor || !label) return null;

  return {
    mode: mode as SanitaryBaseCalendarMode,
    anchor: anchor as SanitaryBaseCalendarAnchor,
    label,
    months: readMonths(record, "months"),
    intervalDays: readNumber(record, "interval_days"),
    ageStartDays: readNumber(record, "age_start_days"),
    ageEndDays: readNumber(record, "age_end_days"),
    notes: readString(record, "notes") ?? undefined,
  };
}

export function describeSanitaryCalendarSchedule(input: {
  intervalDays: number;
  geraAgenda: boolean;
  payload?: Record<string, unknown> | null;
}) {
  const rule = readSanitaryBaseCalendar(input.payload);
  if (rule?.label) return rule.label;

  if (!input.geraAgenda) return "Uso imediato";
  if (input.intervalDays <= 1) return "Dose unica / retorno tecnico";
  return `A cada ${input.intervalDays} dias`;
}

export function describeSanitaryCalendarMode(mode: SanitaryBaseCalendarMode) {
  if (mode === "campaign") return "Campanha";
  if (mode === "age_window") return "Janela etaria";
  if (mode === "rolling_interval") return "Recorrente";
  if (mode === "clinical_protocol") return "Protocolo clinico";
  return "Uso imediato";
}

export function describeSanitaryCalendarAnchor(
  anchor: SanitaryBaseCalendarAnchor | null,
) {
  if (!anchor) return null;
  if (anchor === "calendar_month") return "Calendario";
  if (anchor === "birth") return "Nascimento";
  if (anchor === "weaning") return "Desmama";
  if (anchor === "pre_breeding_season") return "Pre-estacao";
  if (anchor === "clinical_need") return "Necessidade clinica";
  return "Secagem";
}

export function describeSanitaryAgendaScheduleMeta(input: {
  intervalDays?: number | null;
  payloads?: Array<Record<string, unknown> | null | undefined>;
}): SanitaryAgendaScheduleMeta {
  const payload =
    input.payloads?.find((entry) => readSanitaryBaseCalendar(entry) !== null) ??
    input.payloads?.find(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    ) ??
    null;

  const rule = readSanitaryBaseCalendar(payload);
  if (rule) {
    return {
      label: rule.label,
      mode: rule.mode,
      modeLabel: describeSanitaryCalendarMode(rule.mode),
      anchor: rule.anchor,
      anchorLabel: describeSanitaryCalendarAnchor(rule.anchor),
    };
  }

  const intervalDays =
    typeof input.intervalDays === "number" && Number.isFinite(input.intervalDays)
      ? input.intervalDays
      : 0;
  const fallbackMode: SanitaryBaseCalendarMode =
    intervalDays <= 1 ? "immediate" : "rolling_interval";

  return {
    label: describeSanitaryCalendarSchedule({
      intervalDays,
      geraAgenda: true,
      payload,
    }),
    mode: fallbackMode,
    modeLabel: describeSanitaryCalendarMode(fallbackMode),
    anchor: null,
    anchorLabel: null,
  };
}

export function describeSanitaryAgendaSchedule(input: {
  intervalDays?: number | null;
  payloads?: Array<Record<string, unknown> | null | undefined>;
}) {
  return describeSanitaryAgendaScheduleMeta(input).label;
}
