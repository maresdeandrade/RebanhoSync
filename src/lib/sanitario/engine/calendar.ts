export const SANITARY_BASE_CALENDAR_VERSION = 1;

export type SanitaryLegacyCalendarMode =
  | "campanha"
  | "janela_etaria"
  | "rotina_recorrente"
  | "procedimento_imediato"
  | "nao_estruturado";

export type SanitarySqlCalendarMode =
  | "campaign"
  | "age_window"
  | "rolling_interval"
  | "immediate"
  | "clinical_protocol";

export type SanitaryBaseCalendarMode =
  | SanitaryLegacyCalendarMode
  | SanitarySqlCalendarMode;

export type SanitaryLegacyCalendarAnchor =
  | "nascimento"
  | "entrada_fazenda"
  | "conclusao_etapa_dependente"
  | "ultima_conclusao_mesma_familia"
  | "desmama"
  | "parto_previsto"
  | "movimentacao"
  | "diagnostico_evento"
  | "sem_ancora";

export type SanitarySqlCalendarAnchor =
  | "birth"
  | "farm_entry"
  | "previous_completion"
  | "last_family_completion"
  | "weaning"
  | "expected_calving"
  | "movement"
  | "clinical_need"
  | "none"
  | "calendar_month"
  | "pre_breeding_season"
  | "dry_off";

export type SanitaryBaseCalendarAnchor =
  | SanitaryLegacyCalendarAnchor
  | SanitarySqlCalendarAnchor;

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

const LEGACY_TO_SQL_CALENDAR_MODE: Record<
  SanitaryLegacyCalendarMode,
  SanitarySqlCalendarMode
> = {
  campanha: "campaign",
  janela_etaria: "age_window",
  rotina_recorrente: "rolling_interval",
  procedimento_imediato: "immediate",
  nao_estruturado: "clinical_protocol",
};

const SQL_TO_LEGACY_CALENDAR_MODE: Record<
  SanitarySqlCalendarMode,
  SanitaryLegacyCalendarMode
> = {
  campaign: "campanha",
  age_window: "janela_etaria",
  rolling_interval: "rotina_recorrente",
  immediate: "procedimento_imediato",
  clinical_protocol: "nao_estruturado",
};

const LEGACY_TO_SQL_CALENDAR_ANCHOR: Record<
  SanitaryLegacyCalendarAnchor,
  SanitarySqlCalendarAnchor
> = {
  nascimento: "birth",
  entrada_fazenda: "farm_entry",
  conclusao_etapa_dependente: "previous_completion",
  ultima_conclusao_mesma_familia: "last_family_completion",
  desmama: "weaning",
  parto_previsto: "expected_calving",
  movimentacao: "movement",
  diagnostico_evento: "clinical_need",
  sem_ancora: "none",
};

const SQL_TO_LEGACY_CALENDAR_ANCHOR: Record<
  SanitarySqlCalendarAnchor,
  SanitaryBaseCalendarAnchor
> = {
  birth: "nascimento",
  farm_entry: "entrada_fazenda",
  previous_completion: "conclusao_etapa_dependente",
  last_family_completion: "ultima_conclusao_mesma_familia",
  weaning: "desmama",
  expected_calving: "parto_previsto",
  movement: "movimentacao",
  clinical_need: "diagnostico_evento",
  none: "sem_ancora",
  calendar_month: "calendar_month",
  pre_breeding_season: "pre_breeding_season",
  dry_off: "dry_off",
};

function isLegacyCalendarMode(value: string): value is SanitaryLegacyCalendarMode {
  return value in LEGACY_TO_SQL_CALENDAR_MODE;
}

function isSqlCalendarMode(value: string): value is SanitarySqlCalendarMode {
  return value in SQL_TO_LEGACY_CALENDAR_MODE;
}

function isLegacyCalendarAnchor(value: string): value is SanitaryLegacyCalendarAnchor {
  return value in LEGACY_TO_SQL_CALENDAR_ANCHOR;
}

function isSqlCalendarAnchor(value: string): value is SanitarySqlCalendarAnchor {
  return value in SQL_TO_LEGACY_CALENDAR_ANCHOR;
}

export function toSqlCalendarMode(
  mode: string | null | undefined,
): SanitarySqlCalendarMode | null {
  if (!mode) return null;
  const normalized = mode.trim();
  if (isSqlCalendarMode(normalized)) return normalized;
  if (isLegacyCalendarMode(normalized)) {
    return LEGACY_TO_SQL_CALENDAR_MODE[normalized];
  }
  return null;
}

export function fromSqlOrLegacyCalendarMode(
  mode: string | null | undefined,
): SanitaryLegacyCalendarMode | null {
  if (!mode) return null;
  const normalized = mode.trim();
  if (isSqlCalendarMode(normalized)) {
    return SQL_TO_LEGACY_CALENDAR_MODE[normalized];
  }
  if (isLegacyCalendarMode(normalized)) return normalized;
  return null;
}

export function toSqlCalendarAnchor(
  anchor: string | null | undefined,
): SanitarySqlCalendarAnchor | null {
  if (!anchor) return null;
  const normalized = anchor.trim();
  if (isSqlCalendarAnchor(normalized)) return normalized;
  if (isLegacyCalendarAnchor(normalized)) {
    return LEGACY_TO_SQL_CALENDAR_ANCHOR[normalized];
  }
  return null;
}

export function fromSqlOrLegacyCalendarAnchor(
  anchor: string | null | undefined,
): SanitaryBaseCalendarAnchor | null {
  if (!anchor) return null;
  const normalized = anchor.trim();
  if (isSqlCalendarAnchor(normalized)) {
    return SQL_TO_LEGACY_CALENDAR_ANCHOR[normalized];
  }
  if (isLegacyCalendarAnchor(normalized)) return normalized;
  return null;
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
      mode: toSqlCalendarMode(rule.mode),
      anchor: toSqlCalendarAnchor(rule.anchor),
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
  const mode = fromSqlOrLegacyCalendarMode(readString(record, "mode"));
  const anchor = fromSqlOrLegacyCalendarAnchor(readString(record, "anchor"));
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
  const normalized = fromSqlOrLegacyCalendarMode(mode) ?? mode;
  if (normalized === "campanha") return "Campanha";
  if (normalized === "janela_etaria") return "Janela etaria";
  if (normalized === "rotina_recorrente") return "Rotina recorrente";
  if (normalized === "procedimento_imediato") return "Procedimento imediato";
  if (normalized === "nao_estruturado") return "Nao estruturado";
  return "Uso imediato";
}

export function describeSanitaryCalendarAnchor(
  anchor: SanitaryBaseCalendarAnchor | null,
) {
  if (!anchor) return null;
  const normalized = fromSqlOrLegacyCalendarAnchor(anchor) ?? anchor;
  if (normalized === "nascimento") return "Nascimento";
  if (normalized === "entrada_fazenda") return "Entrada na fazenda";
  if (normalized === "conclusao_etapa_dependente") return "Conclusao de etapa anterior";
  if (normalized === "ultima_conclusao_mesma_familia") return "Ultima conclusao da mesma familia";
  if (normalized === "desmama") return "Desmama";
  if (normalized === "parto_previsto") return "Parto previsto";
  if (normalized === "movimentacao") return "Movimentacao";
  if (normalized === "diagnostico_evento") return "Diagnostico de evento";
  if (normalized === "sem_ancora") return "Sem ancora";
  if (normalized === "calendar_month") return "Mes calendario";
  if (normalized === "pre_breeding_season") return "Pre-estacao de monta";
  if (normalized === "dry_off") return "Secagem";
  return null;
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
    intervalDays <= 1 ? "procedimento_imediato" : "rotina_recorrente";

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
