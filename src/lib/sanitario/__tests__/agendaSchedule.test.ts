import { describe, expect, it } from "vitest";

import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/infrastructure/agendaSchedule";
import { buildSanitaryBaseCalendarPayload } from "@/lib/sanitario/engine/calendar";

describe("resolveSanitaryAgendaItemScheduleMeta", () => {
  it("returns null for non-sanitary agenda items", () => {
    expect(
      resolveSanitaryAgendaItemScheduleMeta({
        dominio: "pesagem",
        interval_days_applied: null,
        payload: {},
        source_ref: null,
      }),
    ).toBeNull();
  });

  it("prefers protocol-item calendario_base metadata over raw interval fallbacks", () => {
    expect(
      resolveSanitaryAgendaItemScheduleMeta(
        {
          dominio: "sanitario",
          interval_days_applied: 365,
          payload: {},
          source_ref: null,
        },
        {
          intervalo_dias: 180,
          payload: buildSanitaryBaseCalendarPayload({
            mode: "janela_etaria",
            anchor: "nascimento",
            label: "Aplicar entre 3 e 8 meses",
            ageStartDays: 90,
            ageEndDays: 240,
          }),
        },
      ),
    ).toEqual({
      label: "Aplicar entre 3 e 8 meses",
      mode: "janela_etaria",
      modeLabel: "Janela etaria",
      anchor: "nascimento",
      anchorLabel: "Nascimento",
    });
  });
});
