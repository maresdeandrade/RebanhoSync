import { describe, expect, it } from "vitest";

import {
  describeSanitaryAgendaScheduleMeta,
  describeSanitaryAgendaSchedule,
  buildSanitaryBaseCalendarPayload,
  describeSanitaryCalendarSchedule,
  describeSanitaryCalendarAnchor,
  describeSanitaryCalendarMode,
  readSanitaryBaseCalendar,
} from "@/lib/sanitario/calendar";

describe("sanitary calendar base", () => {
  it("round-trips a structured calendar rule through payload", () => {
    const payload = buildSanitaryBaseCalendarPayload({
      mode: "janela_etaria",
      anchor: "nascimento",
      label: "Dose unica entre 90 e 240 dias",
      ageStartDays: 90,
      ageEndDays: 240,
    });

    expect(readSanitaryBaseCalendar(payload)).toEqual({
      mode: "janela_etaria",
      anchor: "nascimento",
      label: "Dose unica entre 90 e 240 dias",
      ageStartDays: 90,
      ageEndDays: 240,
      intervalDays: null,
      months: undefined,
      notes: undefined,
    });
  });

  it("prefers the explicit calendar-base label when describing schedule", () => {
    const payload = buildSanitaryBaseCalendarPayload({
      mode: "campanha",
      anchor: "sem_ancora",
      label: "Campanha semestral (maio/novembro)",
      months: [5, 11],
      intervalDays: 180,
    });

    expect(
      describeSanitaryCalendarSchedule({
        intervalDays: 180,
        geraAgenda: true,
        payload,
      }),
    ).toBe("Campanha semestral (maio/novembro)");
  });

  it("falls back to operational defaults when no calendar-base metadata exists", () => {
    expect(
      describeSanitaryCalendarSchedule({
        intervalDays: 0,
        geraAgenda: false,
        payload: null,
      }),
    ).toBe("Uso imediato");

    expect(
      describeSanitaryCalendarSchedule({
        intervalDays: 1,
        geraAgenda: true,
        payload: null,
      }),
    ).toBe("Dose unica / retorno tecnico");

    expect(
      describeSanitaryCalendarSchedule({
        intervalDays: 365,
        geraAgenda: true,
        payload: null,
      }),
    ).toBe("A cada 365 dias");
  });

  it("prefers the first payload carrying calendario_base when describing an agenda item", () => {
    expect(
      describeSanitaryAgendaSchedule({
        intervalDays: 365,
        payloads: [
          {
            produto: "Vacina X",
          },
          buildSanitaryBaseCalendarPayload({
            mode: "campanha",
            anchor: "sem_ancora",
            label: "Campanha oficial de maio",
            months: [5],
            intervalDays: 365,
          }),
        ],
      }),
    ).toBe("Campanha oficial de maio");
  });

  it("derives mode and anchor metadata for agenda read surfaces", () => {
    expect(
      describeSanitaryAgendaScheduleMeta({
        intervalDays: 365,
        payloads: [
          buildSanitaryBaseCalendarPayload({
            mode: "campanha",
            anchor: "sem_ancora",
            label: "Campanha oficial de maio",
            months: [5],
            intervalDays: 365,
          }),
        ],
      }),
    ).toEqual({
      label: "Campanha oficial de maio",
      mode: "campanha",
      modeLabel: "Campanha",
      anchor: "sem_ancora",
      anchorLabel: "Sem ancora",
    });

    expect(
      describeSanitaryAgendaScheduleMeta({
        intervalDays: 45,
        payloads: [null],
      }),
    ).toEqual({
      label: "A cada 45 dias",
      mode: "rotina_recorrente",
      modeLabel: "Rotina recorrente",
      anchor: null,
      anchorLabel: null,
    });
  });

  it("describes mode and anchor labels for toolbar filters", () => {
    expect(describeSanitaryCalendarMode("janela_etaria")).toBe("Janela etaria");
    expect(describeSanitaryCalendarAnchor("nascimento")).toBe("Nascimento");
    expect(describeSanitaryCalendarAnchor(null)).toBeNull();
  });
});
