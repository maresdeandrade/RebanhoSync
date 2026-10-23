import type { Evento } from "@/lib/offline/types";
import type { MetricTimezoneSource } from "./metricContract";
import type { ReportPreset, ReportRange } from "./operationalSummaryTypes";

export function resolveMetricTimezone(timezone: string | null | undefined): {
  timezone: string | null;
  source: MetricTimezoneSource;
  limitation: string | null;
} {
  const normalized = timezone?.trim() || null;
  if (normalized) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format();
      return { timezone: normalized, source: "farm", limitation: null };
    } catch {
      return {
        timezone: null,
        source: "runtime",
        limitation: `Timezone da fazenda invalido (${normalized}); fronteiras usam o timezone de runtime disponivel.`,
      };
    }
  }

  return {
    timezone: null,
    source: "runtime",
    limitation:
      "Timezone da fazenda nao foi carregado; fronteiras usam o timezone de runtime disponivel e nao representam necessariamente o calendario da fazenda.",
  };
}

export function getDateKeyInTimezone(
  date: Date,
  timezone: string | null,
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    ...(timezone ? { timeZone: timezone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToCalendarDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function getTimestampDateKey(
  timestamp: string,
  timezone: string | null,
): string {
  try {
    return getDateKeyInTimezone(new Date(timestamp), timezone);
  } catch {
    return timestamp.slice(0, 10);
  }
}

export function getEventDateKey(
  evento: Pick<Evento, "occurred_on" | "occurred_at">,
  timezone: string | null,
): string {
  return (
    evento.occurred_on ?? getTimestampDateKey(evento.occurred_at, timezone)
  );
}

export function resolveReportRange(
  preset: ReportPreset,
  now = new Date(),
  farmTimezone?: string | null,
): ReportRange {
  const timezone = resolveMetricTimezone(farmTimezone).timezone;
  const endDate = dateKeyToCalendarDate(getDateKeyInTimezone(now, timezone));

  if (preset === "mes_atual") {
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    return {
      preset,
      from: toDateKey(startDate),
      to: toDateKey(endDate),
      label: "Mes atual",
      filenameTag: `${startDate.getFullYear()}-${`${startDate.getMonth() + 1}`.padStart(2, "0")}`,
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const startDate = shiftDays(endDate, -(days - 1));

  return {
    preset,
    from: toDateKey(startDate),
    to: toDateKey(endDate),
    label: `Ultimos ${days} dias`,
    filenameTag: `${days}d`,
  };
}
