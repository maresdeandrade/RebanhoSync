import { describe, expect, it } from "vitest";

import {
  createHistoricalActivityInsight,
  filterHistoricalActivityEvents,
  getHistoricalEventsInPeriod,
  groupHistoricalEventsByDomain,
  groupHistoricalEventsByLote,
  type HistoricalActivityEventInput,
} from "@/lib/insights/historicalActivitySummary";
import type { InsightPeriod, InsightQuestionKind } from "@/lib/insights/types";

const generatedAt = "2026-05-07T12:00:00.000Z";
const period: InsightPeriod = {
  start: "2026-05-01",
  end: "2026-05-31",
};

function createEvent(
  overrides: Partial<HistoricalActivityEventInput> = {},
): HistoricalActivityEventInput {
  return {
    id: "event-1",
    domain: "sanitario",
    occurredAt: "2026-05-07T10:00:00.000Z",
    animalId: "animal-1",
    loteIdAtEvent: "lote-evento-1",
    currentLoteId: "lote-atual-1",
    detailType: "vacinacao",
    protocolId: "protocol-1",
    protocolItemVersionId: "protocol-item-version-1",
    productId: "product-1",
    productName: "Vacina A",
    status: "registrado",
    metadata: null,
    deletedAt: null,
    ...overrides,
  };
}

function createInsightInput(
  overrides: Partial<Parameters<typeof createHistoricalActivityInsight>[0]> = {},
): Parameters<typeof createHistoricalActivityInsight>[0] {
  return {
    questionKind: "historical_kpi",
    question: "KPIs historicos",
    generatedAt,
    period,
    events: [createEvent()],
    ...overrides,
  };
}

describe("historical activity summary insights", () => {
  it("requires period", () => {
    expect(() =>
      createHistoricalActivityInsight({
        ...createInsightInput(),
        period: undefined as unknown as InsightPeriod,
      }),
    ).toThrow(/historical_kpi requires period/);
  });

  it("rejects invalid period", () => {
    expect(() =>
      createHistoricalActivityInsight({
        ...createInsightInput(),
        period: { start: "2026-02-31", end: "2026-05-31" },
      }),
    ).toThrow(/period.start/);
  });

  it("rejects period with end before start", () => {
    expect(() =>
      createHistoricalActivityInsight({
        ...createInsightInput(),
        period: { start: "2026-06-01", end: "2026-05-31" },
      }),
    ).toThrow(/period.end/);
  });

  it("includes events inside the inclusive period", () => {
    const firstDay = createEvent({ id: "first", occurredAt: "2026-05-01" });
    const lastDay = createEvent({ id: "last", occurredAt: "2026-05-31T23:00:00.000Z" });

    expect(getHistoricalEventsInPeriod({ events: [firstDay, lastDay], period })).toEqual([
      firstDay,
      lastDay,
    ]);
  });

  it("excludes events outside the period", () => {
    const inside = createEvent({ id: "inside", occurredAt: "2026-05-15" });
    const before = createEvent({ id: "before", occurredAt: "2026-04-30" });
    const after = createEvent({ id: "after", occurredAt: "2026-06-01" });

    expect(getHistoricalEventsInPeriod({ events: [inside, before, after], period })).toEqual([
      inside,
    ]);
  });

  it("excludes deleted events", () => {
    const deleted = createEvent({
      id: "deleted",
      deletedAt: "2026-05-08T12:00:00.000Z",
    });

    const insight = createHistoricalActivityInsight(
      createInsightInput({ events: [deleted] }),
    );

    expect(insight.resultStatus).toBe("empty");
    expect(insight.data.totalEvents).toBe(0);
  });

  it("groups events by domain", () => {
    const sanitario = createEvent({ id: "sanitario-1", domain: "sanitario" });
    const financeiro = createEvent({ id: "financeiro-1", domain: "financeiro" });
    const sanitarioAgain = createEvent({ id: "sanitario-2", domain: "sanitario" });

    expect(groupHistoricalEventsByDomain([sanitario, financeiro, sanitarioAgain])).toEqual([
      { domain: "financeiro", count: 1 },
      { domain: "sanitario", count: 2 },
    ]);
  });

  it("counts unique animals", () => {
    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [
          createEvent({ id: "event-1", animalId: "animal-1" }),
          createEvent({ id: "event-2", animalId: "animal-1" }),
          createEvent({ id: "event-3", animalId: "animal-2" }),
          createEvent({ id: "event-4", animalId: null }),
        ],
      }),
    );

    expect(insight.data.uniqueAnimalCount).toBe(2);
    expect(insight.data.byAnimal).toEqual([
      { animalId: "animal-1", count: 2 },
      { animalId: "animal-2", count: 1 },
    ]);
  });

  it("groups by lot using loteIdAtEvent", () => {
    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [
          createEvent({
            id: "event-1",
            loteIdAtEvent: "lote-historico",
            currentLoteId: "lote-atual",
          }),
          createEvent({
            id: "event-2",
            loteIdAtEvent: "lote-historico",
            currentLoteId: "outro-lote-atual",
          }),
        ],
      }),
    );

    expect(insight.data.byLote).toEqual([
      { loteId: "lote-historico", count: 2, source: "event" },
    ]);
  });

  it("uses currentLoteId fallback as partial with explicit limitation", () => {
    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [
          createEvent({
            id: "event-with-current-lote",
            loteIdAtEvent: null,
            currentLoteId: "lote-atual",
          }),
        ],
      }),
    );

    expect(insight.resultStatus).toBe("partial");
    expect(insight.partialReason).toMatch(/currentLoteId/);
    expect(insight.source.auxiliarySources).toEqual(["state_animais", "state_lotes"]);
    expect(insight.source.limitations).toContain(
      "Agrupamento por lote usou currentLoteId como fallback para eventos sem loteIdAtEvent; isso representa estado atual, nao snapshot historico do evento.",
    );
    expect(insight.data.byLote).toEqual([
      { loteId: "lote-atual", count: 1, source: "current_state" },
    ]);
  });

  it("filters by domain", () => {
    const sanitario = createEvent({ id: "sanitario", domain: " sanitario " });
    const financeiro = createEvent({ id: "financeiro", domain: "financeiro" });

    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [sanitario, financeiro],
        filters: { domains: ["sanitario"] },
      }),
    );

    expect(insight.data.totalEvents).toBe(1);
    expect(insight.data.byDomain).toEqual([{ domain: "sanitario", count: 1 }]);
  });

  it("filters by detailType", () => {
    const vacinacao = createEvent({ id: "vacinacao", detailType: " vacinacao " });
    const exame = createEvent({ id: "exame", detailType: "exame" });

    expect(
      filterHistoricalActivityEvents({
        events: [vacinacao, exame],
        filters: { detailTypes: ["vacinacao"] },
      }),
    ).toEqual([vacinacao]);
  });

  it("filters by productId", () => {
    const vacinaA = createEvent({ id: "product-1", productId: " product-1 " });
    const vacinaB = createEvent({ id: "product-2", productId: "product-2" });

    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [vacinaA, vacinaB],
        filters: { productIds: ["product-1"] },
      }),
    );

    expect(insight.data.totalEvents).toBe(1);
    expect(insight.data.byAnimal).toEqual([{ animalId: "animal-1", count: 1 }]);
  });

  it("filters by protocolId", () => {
    const protocoloA = createEvent({ id: "protocol-1", protocolId: " protocol-1 " });
    const protocoloB = createEvent({ id: "protocol-2", protocolId: "protocol-2" });

    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [protocoloA, protocoloB],
        filters: { protocolIds: ["protocol-1"] },
      }),
    );

    expect(insight.data.totalEvents).toBe(1);
    expect(insight.data.byDomain).toEqual([{ domain: "sanitario", count: 1 }]);
  });

  it("keeps insight filters equal to normalized filters actually applied", () => {
    const insight = createHistoricalActivityInsight(
      createInsightInput({
        filters: {
          domains: [" sanitario ", "sanitario", " "],
          detailTypes: [],
          animalIds: [" animal-1 "],
          loteIdsAtEvent: ["lote-evento-1"],
          productIds: undefined,
          protocolIds: ["protocol-1"],
        },
      }),
    );

    expect(insight.filters).toEqual({
      domains: ["sanitario"],
      animalIds: ["animal-1"],
      loteIdsAtEvent: ["lote-evento-1"],
      protocolIds: ["protocol-1"],
    });
  });

  it("empty filters do not filter events", () => {
    const first = createEvent({ id: "first", domain: "sanitario" });
    const second = createEvent({ id: "second", domain: "financeiro" });

    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [first, second],
        filters: {
          domains: [],
          detailTypes: [" "],
        },
      }),
    );

    expect(insight.data.totalEvents).toBe(2);
    expect(insight.filters).toEqual({});
  });

  it("keeps events without lot in sem_lote instead of omitting them", () => {
    const withoutLot = createEvent({
      id: "without-lot",
      loteIdAtEvent: null,
      currentLoteId: null,
    });

    const insight = createHistoricalActivityInsight(
      createInsightInput({
        events: [withoutLot],
      }),
    );

    expect(insight.data.byLote).toEqual([
      { loteId: "sem_lote", count: 1, source: "missing" },
    ]);
    expect(insight.source.limitations).toContain(
      "Eventos sem loteIdAtEvent e sem currentLoteId sao agrupados em sem_lote para nao serem omitidos do KPI por lote.",
    );
  });

  it("lot grouping count does not silently omit events without lot", () => {
    const withLot = createEvent({ id: "with-lot", loteIdAtEvent: "lote-1" });
    const withoutLot = createEvent({
      id: "without-lot",
      loteIdAtEvent: null,
      currentLoteId: null,
    });

    const byLote = groupHistoricalEventsByLote([withLot, withoutLot]);
    const groupedTotal = byLote.reduce((total, lote) => total + lote.count, 0);

    expect(groupedTotal).toBe(2);
    expect(byLote).toContainEqual({ loteId: "sem_lote", count: 1, source: "missing" });
  });

  it.each([
    "future_need",
    "current_pending",
    "current_state",
    "workflow_kpi",
    "configured_rule",
    "operational_report",
  ] as const)("rejects %s", (questionKind: InsightQuestionKind) => {
    expect(() =>
      createHistoricalActivityInsight(
        createInsightInput({
          questionKind,
        }),
      ),
    ).toThrow(/historicalActivitySummary supports only historical_kpi/);
  });

  it("declares historical_kpi and factual primary source", () => {
    const insight = createHistoricalActivityInsight(createInsightInput());

    expect(insight.questionKind).toBe("historical_kpi");
    expect(insight.source.primarySource).toBe("eventos");
    expect(insight.source.excludedSources).toContain("agenda_itens");
    expect(insight.resultStatus).toBe("complete");
  });

  it("rejects agenda as primary source", () => {
    expect(() =>
      createHistoricalActivityInsight(
        createInsightInput({
          primarySource: "state_agenda_itens",
        }),
      ),
    ).toThrow(/historical_kpi requires events/);
  });

  it("rejects invalid occurredAt", () => {
    expect(() =>
      getHistoricalEventsInPeriod({
        events: [createEvent({ occurredAt: "2026-99-99" })],
        period,
      }),
    ).toThrow(/occurredAt/);
  });

  it("does not use the global clock", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      const insight = createHistoricalActivityInsight(createInsightInput());

      expect(insight.data.totalEvents).toBe(1);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
