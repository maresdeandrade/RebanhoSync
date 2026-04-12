import type { FarmExperienceMode } from "@/lib/farms/experienceMode";
import type { SanitaryAttentionRow, SanitaryAttentionSummary } from "@/lib/sanitario/attention";

export interface NotificationPreferences {
  enabled: boolean;
  agendaReminders: boolean;
  daysBefore: number[];
  quietHours: { start: string; end: string } | null;
  sanitaryCritical: boolean;
  sanitaryMandatory: boolean;
  sanitaryUpcoming: boolean;
  sanitaryFollowups: boolean;
}

export interface SanitaryReminderPlan {
  level: "critical" | "mandatory" | "followup" | "upcoming";
  title: string;
  message: string;
  dedupKey: string;
  itemIds: string[];
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  agendaReminders: true,
  daysBefore: [7, 3, 1],
  quietHours: null,
  sanitaryCritical: true,
  sanitaryMandatory: true,
  sanitaryUpcoming: true,
  sanitaryFollowups: true,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readBoolean(record: Record<string, unknown> | null, key: string): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDaysBefore(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_NOTIFICATION_PREFERENCES.daysBefore;

  const normalized = Array.from(
    new Set(
      value
        .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
        .map((entry) => Math.floor(entry))
        .filter((entry) => entry >= 1 && entry <= 30),
    ),
  ).sort((left, right) => right - left);

  return normalized.length > 0
    ? normalized
    : DEFAULT_NOTIFICATION_PREFERENCES.daysBefore;
}

export function resolveNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  const record = asRecord(value);
  const quietHours = asRecord(record?.quiet_hours);
  const quietHoursStart = readString(quietHours, "start");
  const quietHoursEnd = readString(quietHours, "end");

  return {
    enabled:
      readBoolean(record, "enabled") ?? DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    agendaReminders:
      readBoolean(record, "agenda_reminders") ??
      DEFAULT_NOTIFICATION_PREFERENCES.agendaReminders,
    daysBefore: normalizeDaysBefore(record?.days_before),
    quietHours:
      quietHoursStart && quietHoursEnd
        ? { start: quietHoursStart, end: quietHoursEnd }
        : DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
    sanitaryCritical:
      readBoolean(record, "sanitary_critical") ??
      DEFAULT_NOTIFICATION_PREFERENCES.sanitaryCritical,
    sanitaryMandatory:
      readBoolean(record, "sanitary_mandatory") ??
      DEFAULT_NOTIFICATION_PREFERENCES.sanitaryMandatory,
    sanitaryUpcoming:
      readBoolean(record, "sanitary_upcoming") ??
      DEFAULT_NOTIFICATION_PREFERENCES.sanitaryUpcoming,
    sanitaryFollowups:
      readBoolean(record, "sanitary_followups") ??
      DEFAULT_NOTIFICATION_PREFERENCES.sanitaryFollowups,
  };
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function isWithinQuietHours(
  now: Date,
  quietHours: NotificationPreferences["quietHours"],
): boolean {
  if (!quietHours) return false;

  const start = timeToMinutes(quietHours.start);
  const end = timeToMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

function makeDigest(
  level: SanitaryReminderPlan["level"],
  title: string,
  items: SanitaryAttentionRow[],
  suffix?: string,
): SanitaryReminderPlan | null {
  const primary = items[0];
  if (!primary) return null;

  const count = items.length;
  const header =
    count > 1
      ? `${title}: ${count} item(ns).`
      : `${title}: ${primary.contexto}.`;
  const base = `${primary.contexto} - ${primary.produto} (${primary.priorityLabel}).`;
  const message = count > 1 ? `${header} Primeiro: ${base}` : `${title}: ${base}`;

  return {
    level,
    title,
    message: suffix ? `${message} ${suffix}` : message,
    dedupKey: `${level}:${items.map((item) => item.id).join(",")}`,
    itemIds: items.map((item) => item.id),
  };
}

function filterMatchingDays(
  rows: SanitaryAttentionRow[],
  daysBefore: number[],
): SanitaryAttentionRow[] {
  return rows.filter(
    (row) => row.daysDelta > 0 && daysBefore.includes(row.daysDelta),
  );
}

export function buildSanitaryReminderPlan(input: {
  summary: SanitaryAttentionSummary;
  preferences: NotificationPreferences;
  experienceMode: FarmExperienceMode;
}): SanitaryReminderPlan | null {
  const { summary, preferences, experienceMode } = input;

  if (
    !preferences.enabled ||
    !preferences.agendaReminders ||
    summary.totalOpen === 0 ||
    summary.topItems.length === 0
  ) {
    return null;
  }

  const criticalItems = summary.topItems.filter(
    (item) => item.priorityTone === "danger" && item.daysDelta < 0,
  );
  if (preferences.sanitaryCritical && criticalItems.length > 0) {
    return makeDigest(
      "critical",
      "Sanitario critico",
      criticalItems.slice(0, 2),
      criticalItems[0]?.requiresVet ? "Ha item exigindo veterinario." : undefined,
    );
  }

  const mandatoryNow = summary.topItems.filter(
    (item) => item.mandatory && item.daysDelta === 0,
  );
  if (preferences.sanitaryMandatory && mandatoryNow.length > 0) {
    return makeDigest(
      "mandatory",
      "Sanitario obrigatorio hoje",
      mandatoryNow.slice(0, 2),
    );
  }

  if (experienceMode === "completo" && preferences.sanitaryFollowups) {
    const followups = summary.topItems.filter(
      (item) => item.mandatory && item.daysDelta > 0 && item.daysDelta <= 3,
    );
    if (followups.length > 0) {
      return makeDigest(
        "followup",
        "Proximo procedimento sanitario",
        followups.slice(0, 2),
      );
    }
  }

  if (experienceMode === "completo" && preferences.sanitaryUpcoming) {
    const upcoming = filterMatchingDays(summary.topItems, preferences.daysBefore);
    if (upcoming.length > 0) {
      return makeDigest(
        "upcoming",
        "Lembrete sanitario",
        upcoming.slice(0, 2),
      );
    }
  }

  return null;
}
