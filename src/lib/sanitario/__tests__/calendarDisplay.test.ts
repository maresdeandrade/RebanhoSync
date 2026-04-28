import { describe, expect, it } from "vitest";

import { describeRegistrarSanitaryCalendarSchedule } from "@/lib/sanitario/models/calendarDisplay";

describe("calendarDisplay", () => {
  it("preserves calendario_base labels for Registrar display", () => {
    expect(
      describeRegistrarSanitaryCalendarSchedule({
        intervalDays: 30,
        geraAgenda: true,
        payload: {
          calendario_base: {
            version: 1,
            mode: "campaign",
            anchor: "calendar_month",
            label: "Campanha de maio",
            months: [5],
            interval_days: null,
            age_start_days: null,
            age_end_days: null,
            notes: null,
          },
        },
      }),
    ).toBe("Campanha de maio");
  });

  it("keeps fallback labels for incomplete inputs", () => {
    expect(
      describeRegistrarSanitaryCalendarSchedule({
        intervalDays: null,
        geraAgenda: false,
        payload: null,
      }),
    ).toBe("Uso imediato");

    expect(
      describeRegistrarSanitaryCalendarSchedule({
        intervalDays: 45,
        geraAgenda: true,
        payload: "invalid",
      }),
    ).toBe("A cada 45 dias");
  });
});
