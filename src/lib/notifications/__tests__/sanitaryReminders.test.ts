import { describe, expect, it } from "vitest";

import {
  buildSanitaryReminderPlan,
  DEFAULT_NOTIFICATION_PREFERENCES,
  isWithinQuietHours,
  resolveNotificationPreferences,
} from "@/lib/notifications/sanitaryReminders";
import type { SanitaryAttentionSummary } from "@/lib/sanitario/compliance/attention";

const baseSummary: SanitaryAttentionSummary = {
  totalOpen: 3,
  criticalCount: 1,
  warningCount: 1,
  overdueCount: 1,
  dueTodayCount: 1,
  mandatoryCount: 2,
  requiresVetCount: 1,
  scheduleModes: [
    {
      key: "rolling_interval",
      label: "Recorrente",
      count: 3,
    },
  ],
  scheduleAnchors: [],
  topItems: [
    {
      id: "agenda-1",
      data: "2026-04-09",
      titulo: "Calendario oficial: Vacina Aftosa",
      contexto: "BR-001",
      produto: "Vacina Aftosa",
      scheduleLabel: "A cada 180 dias",
      scheduleMode: "rolling_interval",
      scheduleModeLabel: "Recorrente",
      scheduleAnchor: null,
      scheduleAnchorLabel: null,
      status: "atrasado",
      priorityLabel: "Critico 2d",
      priorityTone: "danger",
      mandatory: true,
      requiresVet: true,
      daysDelta: -2,
    },
    {
      id: "agenda-2",
      data: "2026-04-11",
      titulo: "Calendario oficial: Reforco",
      contexto: "Matrizes",
      produto: "Reforco",
      scheduleLabel: "A cada 180 dias",
      scheduleMode: "rolling_interval",
      scheduleModeLabel: "Recorrente",
      scheduleAnchor: null,
      scheduleAnchorLabel: null,
      status: "proximo",
      priorityLabel: "Obrigatorio em 2d",
      priorityTone: "warning",
      mandatory: true,
      requiresVet: false,
      daysDelta: 2,
    },
    {
      id: "agenda-3",
      data: "2026-04-16",
      titulo: "Sanitario: vermifugacao",
      contexto: "Lote 3",
      produto: "Endectocida",
      scheduleLabel: "A cada 90 dias",
      scheduleMode: "rolling_interval",
      scheduleModeLabel: "Recorrente",
      scheduleAnchor: null,
      scheduleAnchorLabel: null,
      status: "proximo",
      priorityLabel: "Rotina",
      priorityTone: "neutral",
      mandatory: false,
      requiresVet: false,
      daysDelta: 7,
    },
  ],
};

describe("resolveNotificationPreferences", () => {
  it("applies defaults and sanitizes invalid fields", () => {
    const resolved = resolveNotificationPreferences({
      enabled: false,
      days_before: [7, 3, 3, 0, 60],
      sanitary_upcoming: false,
      quiet_hours: { start: "22:00", end: "06:00" },
    });

    expect(resolved).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: false,
      daysBefore: [7, 3],
      sanitaryUpcoming: false,
      quietHours: { start: "22:00", end: "06:00" },
    });
  });
});

describe("isWithinQuietHours", () => {
  it("handles overnight windows", () => {
    expect(
      isWithinQuietHours(new Date("2026-04-09T23:30:00"), {
        start: "22:00",
        end: "06:00",
      }),
    ).toBe(true);

    expect(
      isWithinQuietHours(new Date("2026-04-09T07:30:00"), {
        start: "22:00",
        end: "06:00",
      }),
    ).toBe(false);
  });
});

describe("buildSanitaryReminderPlan", () => {
  it("prioritizes critical sanitary reminders", () => {
    const plan = buildSanitaryReminderPlan({
      summary: baseSummary,
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      experienceMode: "essencial",
    });

    expect(plan).toMatchObject({
      level: "critical",
      title: "Sanitario critico",
    });
    expect(plan?.message).toContain("Vacina Aftosa");
    expect(plan?.message).toContain("Ha item exigindo veterinario.");
  });

  it("falls back to followup reminders in complete mode", () => {
    const plan = buildSanitaryReminderPlan({
      summary: {
        ...baseSummary,
        criticalCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        topItems: baseSummary.topItems.slice(1),
      },
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      experienceMode: "completo",
    });

    expect(plan).toMatchObject({
      level: "followup",
      title: "Proximo procedimento sanitario",
    });
  });

  it("uses upcoming window reminders only in complete mode", () => {
    const plan = buildSanitaryReminderPlan({
      summary: {
        ...baseSummary,
        criticalCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        mandatoryCount: 0,
        topItems: [baseSummary.topItems[2]!],
      },
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      experienceMode: "completo",
    });

    expect(plan).toMatchObject({
      level: "upcoming",
      title: "Lembrete sanitario",
    });
  });
});
