import { describe, expect, it } from "vitest";

import {
  describeSanitaryAgendaScheduleMeta,
  describeSanitaryAgendaSchedule,
  buildSanitaryBaseCalendarPayload,
  describeSanitaryCalendarSchedule,
  describeSanitaryCalendarAnchor,
  describeSanitaryCalendarMode,
  fromSqlOrLegacyCalendarAnchor,
  fromSqlOrLegacyCalendarMode,
  readSanitaryBaseCalendar,
  toSqlCalendarAnchor,
  toSqlCalendarMode,
} from "@/lib/sanitario/engine/calendar";

describe("sanitary calendar base", () => {
  it("contract: serializes TS calendar modes and anchors to SQL vocabulary", () => {
    expect(toSqlCalendarMode("campanha")).toBe("campaign");
    expect(toSqlCalendarMode("janela_etaria")).toBe("age_window");
    expect(toSqlCalendarMode("rotina_recorrente")).toBe("rolling_interval");

    expect(toSqlCalendarAnchor("nascimento")).toBe("birth");
    expect(toSqlCalendarAnchor("ultima_conclusao_mesma_familia")).toBe(
      "last_family_completion",
    );
    expect(toSqlCalendarAnchor("diagnostico_evento")).toBe("clinical_need");
  });

  it("contract: reads SQL and legacy calendar vocabulary into TS vocabulary", () => {
    expect(fromSqlOrLegacyCalendarMode("campaign")).toBe("campanha");
    expect(fromSqlOrLegacyCalendarMode("age_window")).toBe("janela_etaria");
    expect(fromSqlOrLegacyCalendarMode("rolling_interval")).toBe(
      "rotina_recorrente",
    );
    expect(fromSqlOrLegacyCalendarMode("campanha")).toBe("campanha");
    expect(fromSqlOrLegacyCalendarMode("janela_etaria")).toBe("janela_etaria");
    expect(fromSqlOrLegacyCalendarMode("rotina_recorrente")).toBe(
      "rotina_recorrente",
    );

    expect(fromSqlOrLegacyCalendarAnchor("birth")).toBe("nascimento");
    expect(fromSqlOrLegacyCalendarAnchor("last_family_completion")).toBe(
      "ultima_conclusao_mesma_familia",
    );
    expect(fromSqlOrLegacyCalendarAnchor("clinical_need")).toBe(
      "diagnostico_evento",
    );
    expect(fromSqlOrLegacyCalendarAnchor("nascimento")).toBe("nascimento");
  });

  it("round-trips a structured calendar rule through payload", () => {
    const payload = buildSanitaryBaseCalendarPayload({
      mode: "janela_etaria",
      anchor: "nascimento",
      label: "Dose unica entre 90 e 240 dias",
      ageStartDays: 90,
      ageEndDays: 240,
    });

    expect(payload).toMatchObject({
      calendario_base: {
        mode: "age_window",
        anchor: "birth",
      },
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

  it("keeps legacy PT-BR payloads readable", () => {
    expect(
      readSanitaryBaseCalendar({
        calendario_base: {
          version: 1,
          mode: "rotina_recorrente",
          anchor: "ultima_conclusao_mesma_familia",
          label: "Revisao anual",
          interval_days: 365,
        },
      }),
    ).toMatchObject({
      mode: "rotina_recorrente",
      anchor: "ultima_conclusao_mesma_familia",
      label: "Revisao anual",
      intervalDays: 365,
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
