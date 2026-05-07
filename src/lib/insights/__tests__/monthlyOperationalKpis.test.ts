import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createMonthlyOperationalKpisInsight,
  getMonthlyOperationalEventsInPeriod,
  groupMonthlyOperationalKpisByAnimal,
  groupMonthlyOperationalKpisByDomain,
  groupMonthlyOperationalKpisByLote,
  type MonthlyOperationalKpiEventInput,
} from "@/lib/insights/monthlyOperationalKpis";

const generatedAt = "2026-05-07T12:00:00.000Z";
const periodStart = "2026-05-01";
const periodEnd = "2026-05-31";

function createEvent(
  overrides: Partial<MonthlyOperationalKpiEventInput> = {},
): MonthlyOperationalKpiEventInput {
  return {
    id: "event-1",
    domain: "sanitario",
    occurredAt: "2026-05-07T10:00:00.000Z",
    animalId: "animal-1",
    loteIdAtEvent: "lote-1",
    detailType: "vacinacao",
    status: "registrado",
    deletedAt: null,
    ...overrides,
  };
}

function createInsightInput(
  overrides: Partial<Parameters<typeof createMonthlyOperationalKpisInsight>[0]> = {},
): Parameters<typeof createMonthlyOperationalKpisInsight>[0] {
  return {
    questionKind: "historical_kpi",
    question: "KPIs operacionais mensais",
    generatedAt,
    periodStart,
    periodEnd,
    events: [createEvent()],
    ...overrides,
  };
}

describe("monthly operational KPIs", () => {
  it("blocks when primary source is missing", () => {
    const insight = createMonthlyOperationalKpisInsight(
      createInsightInput({ primarySource: " " }),
    );

    expect(insight.answerability).toBe("blocked");
    expect(insight.resultStatus).toBe("blocked");
    expect(insight.source.block.code).toBe("missing_primary_source");
    expect(insight.source.block.requiredSources).toEqual(["eventos"]);
  });

  it("returns empty when there are no events in the period", () => {
    const insight = createMonthlyOperationalKpisInsight(
      createInsightInput({
        events: [createEvent({ occurredAt: "2026-04-30" })],
      }),
    );

    expect(insight.answerability).toBe("answerable");
    expect(insight.resultStatus).toBe("empty");
    expect(insight.data.totalEvents).toBe(0);
    expect(insight.data.month).toBe("2026-05");
  });

  it("ignores events outside the monthly period", () => {
    const inside = createEvent({ id: "inside", occurredAt: "2026-05-15" });
    const before = createEvent({ id: "before", occurredAt: "2026-04-30" });
    const after = createEvent({ id: "after", occurredAt: "2026-06-01" });

    expect(
      getMonthlyOperationalEventsInPeriod({
        events: [inside, before, after],
        periodStart,
        periodEnd,
      }),
    ).toEqual([inside]);
  });

  it("ignores events with deletedAt", () => {
    const deleted = createEvent({
      id: "deleted",
      deletedAt: "2026-05-08T10:00:00.000Z",
    });

    const insight = createMonthlyOperationalKpisInsight(
      createInsightInput({ events: [deleted] }),
    );

    expect(insight.resultStatus).toBe("empty");
    expect(insight.data.totalEvents).toBe(0);
  });

  it("groups correctly by operational domain", () => {
    const sanitario = createEvent({ id: "sanitario-1", domain: "sanitario" });
    const financeiro = createEvent({ id: "financeiro-1", domain: "financeiro" });
    const sanitarioAgain = createEvent({ id: "sanitario-2", domain: " sanitario " });

    expect(
      groupMonthlyOperationalKpisByDomain([
        sanitario,
        financeiro,
        sanitarioAgain,
      ]),
    ).toEqual([
      { domain: "financeiro", count: 1 },
      { domain: "sanitario", count: 2 },
    ]);
  });

  it("groups correctly by lot using loteIdAtEvent", () => {
    expect(
      groupMonthlyOperationalKpisByLote([
        createEvent({ id: "lote-1-event-1", loteIdAtEvent: "lote-1" }),
        createEvent({ id: "lote-1-event-2", loteIdAtEvent: " lote-1 " }),
        createEvent({ id: "lote-2-event-1", loteIdAtEvent: "lote-2" }),
        createEvent({ id: "without-lote", loteIdAtEvent: null }),
      ]),
    ).toEqual([
      { loteId: "lote-1", count: 2 },
      { loteId: "lote-2", count: 1 },
      { loteId: "sem_lote", count: 1 },
    ]);
  });

  it("groups correctly by animal", () => {
    expect(
      groupMonthlyOperationalKpisByAnimal([
        createEvent({ id: "animal-1-event-1", animalId: "animal-1" }),
        createEvent({ id: "animal-1-event-2", animalId: " animal-1 " }),
        createEvent({ id: "animal-2-event-1", animalId: "animal-2" }),
        createEvent({ id: "without-animal", animalId: null }),
      ]),
    ).toEqual([
      { animalId: "animal-1", count: 2 },
      { animalId: "animal-2", count: 1 },
    ]);
  });

  it("does not accept operational_report as directly answerable insight", () => {
    expect(() =>
      createMonthlyOperationalKpisInsight(
        createInsightInput({ questionKind: "operational_report" }),
      ),
    ).toThrow(/monthlyOperationalKpis supports only historical_kpi/);
  });

  it("does not depend on Date.now", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      const insight = createMonthlyOperationalKpisInsight(createInsightInput());

      expect(insight.data.totalEvents).toBe(1);
      expect(insight.generatedAt).toBe(generatedAt);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it("does not import Supabase, Dexie or UI modules", () => {
    const source = readFileSync(
      "src/lib/insights/monthlyOperationalKpis.ts",
      "utf8",
    );

    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/dexie/i);
    expect(source).not.toMatch(/@\/components|@\/pages|@\/ui/);
  });

  it("keeps events as primary source", () => {
    const insight = createMonthlyOperationalKpisInsight(createInsightInput());

    expect(insight.questionKind).toBe("historical_kpi");
    expect(insight.source.primarySource).toBe("eventos");
    expect(insight.source.auxiliarySources).toEqual([]);
    expect(insight.source.excludedSources).toEqual(
      expect.arrayContaining([
        "agenda",
        "agenda_itens",
        "state_agenda_itens",
        "state_animais",
        "protocolos",
        "tags/marcadores",
      ]),
    );
  });

  it("rejects agenda as primary source", () => {
    expect(() =>
      createMonthlyOperationalKpisInsight(
        createInsightInput({ primarySource: "state_agenda_itens" }),
      ),
    ).toThrow(/historical_kpi requires events/);
  });

  it("rejects period across more than one month", () => {
    expect(() =>
      createMonthlyOperationalKpisInsight(
        createInsightInput({ periodStart: "2026-05-01", periodEnd: "2026-06-01" }),
      ),
    ).toThrow(/same month/);
  });
});
