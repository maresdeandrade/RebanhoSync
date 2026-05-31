import { describe, expect, it } from "vitest";

import {
  buildOperationalInsights,
  type BuildOperationalInsightsInput,
  type OperationalInsightsAgendaRow,
  type OperationalInsightsAnimalRow,
  type OperationalInsightsEventRow,
  type OperationalInsightsProtocolItemRow,
} from "@/features/operationalInsights/operationalInsightsAdapter";

const generatedAt = "2026-05-07T12:00:00.000Z";
const referenceDate = "2026-05-07";
const monthlyPeriod = { start: "2026-05-01", end: "2026-05-31" };

function createInput(
  overrides: Partial<BuildOperationalInsightsInput> = {},
): BuildOperationalInsightsInput {
  return {
    generatedAt,
    referenceDate,
    monthlyPeriod,
    sources: {},
    ...overrides,
  };
}

describe("operational insights adapter", () => {
  it("normalizes loaded app rows into passive insight sections", () => {
    const agendaItems: OperationalInsightsAgendaRow[] = [
      {
        id: "agenda-overdue",
        status: "agendado",
        data_prevista: "2026-05-06",
        dominio: "sanitario",
        tipo: "brucelose",
        animal_id: "animal-1",
        lote_id: "lote-1",
        source_ref: { protocolo_id: "protocol-1" },
        protocol_item_version_id: "protocol-item-version-1",
      },
      {
        id: "agenda-today",
        status: "agendado",
        data_prevista: "2026-05-07",
        dominio: "sanitario",
        tipo: "raiva",
        lote_id: "lote-1",
        source_ref: {
          produto: "Vacina Raiva",
          quantity_per_animal: 1,
          animal_count: 2,
        },
      },
      {
        id: "agenda-future",
        status: "agendado",
        data_prevista: "2026-05-08",
        dominio: "sanitario",
        tipo: "brucelose",
        animal_id: "animal-1",
        lote_id: "lote-1",
        source_ref: { protocolo_id: "protocol-1" },
        protocol_item_version_id: "protocol-item-version-1",
      },
      {
        id: "agenda-concluded",
        status: "concluido",
        data_prevista: "2026-05-07",
        dominio: "sanitario",
        tipo: "concluida",
      },
    ];
    const protocolItems: OperationalInsightsProtocolItemRow[] = [
      {
        id: "protocol-item-version-1",
        protocolo_id: "protocol-1",
        item_code: "dose_1",
        version: 1,
        produto: "Vacina Brucelose",
      },
    ];
    const animals: OperationalInsightsAnimalRow[] = [
      {
        id: "animal-1",
        status: "ativo",
        lote_id: "lote-1",
        sexo: "F",
        payload: {
          taxonomy_facts: {
            categoria_zootecnica: "vaca",
            estado_produtivo_reprodutivo: "prenhe",
          },
        },
      },
    ];
    const events: OperationalInsightsEventRow[] = [
      {
        id: "event-1",
        dominio: "sanitario",
        occurred_at: "2026-05-05T10:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
      },
      {
        id: "event-deleted",
        dominio: "pesagem",
        occurred_at: "2026-05-06T10:00:00.000Z",
        animal_id: "animal-1",
        deleted_at: "2026-05-06T11:00:00.000Z",
      },
    ];

    const result = buildOperationalInsights(
      createInput({
        sources: { agendaItems, animals, events, protocolItems },
      }),
    );

    expect(result.agendaNeeds.allOpen.insight.answerability).toBe("answerable");
    expect(result.agendaNeeds.allOpen.insight.resultStatus).toBe("complete");
    expect(result.agendaNeeds.allOpen.insight.data.map((item) => item.id)).toEqual([
      "agenda-overdue",
      "agenda-today",
      "agenda-future",
    ]);
    expect(result.agendaNeeds.dueToday.insight.data.map((item) => item.id)).toEqual([
      "agenda-today",
    ]);
    expect(result.agendaNeeds.overdue.insight.data.map((item) => item.id)).toEqual([
      "agenda-overdue",
    ]);

    expect(result.sanitarySupplyNeeds.insight.answerability).toBe("answerable");
    expect(result.sanitarySupplyNeeds.insight.data.groups.map((group) => group.productName)).toEqual([
      "Vacina Brucelose",
      "Vacina Raiva",
    ]);
    expect(result.sanitarySupplyNeeds.insight.source.primarySource).toBe(
      "state_agenda_itens",
    );

    expect(result.herdStageSummary.insight.data.byStage).toEqual([
      { stage: "vaca", count: 1 },
    ]);
    expect(result.herdStageSummary.insight.source.primarySource).toBe("state_animais");

    expect(result.monthlyOperationalKpis.insight.data.totalEvents).toBe(1);
    expect(result.monthlyOperationalKpis.insight.source.primarySource).toBe("eventos");

    const signalCodes = result.tagSignals.signals.map((signal) => signal.code);
    expect(signalCodes).toContain("agenda:atrasada");
    expect(signalCodes).toContain("sanitario:pendencia_atrasada");
    expect(signalCodes).toContain("animal:ativo");
    expect(result.tagSignals.signals.every((signal) => signal.primarySource)).toBe(true);
  });

  it("keeps missing primary sources as blocked UI sections", () => {
    const result = buildOperationalInsights(createInput());

    expect(result.agendaNeeds.allOpen.insight.answerability).toBe("blocked");
    expect(result.herdStageSummary.insight.answerability).toBe("blocked");
    expect(result.monthlyOperationalKpis.insight.answerability).toBe("blocked");
    expect(result.sections.map((section) => section.insight.resultStatus)).toContain(
      "blocked",
    );
    expect(result.tagSignals.signals).toEqual([]);
    expect(result.tagSignals.skippedBlockedInsightIds).toEqual([
      "agendaNeeds.allOpen",
      "agendaNeeds.dueToday",
      "agendaNeeds.overdue",
      "herdStageSummary",
    ]);
    expect(
      result.tagSignals.sourceSummaries.every(
        (summary) => summary.answerability === "blocked",
      ),
    ).toBe(true);
  });

  it("treats loaded empty arrays as answerable empty results", () => {
    const result = buildOperationalInsights(
      createInput({
        sources: {
          agendaItems: [],
          animals: [],
          events: [],
        },
      }),
    );

    expect(result.agendaNeeds.allOpen.insight.answerability).toBe("answerable");
    expect(result.agendaNeeds.allOpen.insight.resultStatus).toBe("empty");
    expect(result.herdStageSummary.insight.resultStatus).toBe("empty");
    expect(result.monthlyOperationalKpis.insight.resultStatus).toBe("empty");
    expect(result.tagSignals.resultStatus).toBe("empty");
    expect(result.tagSignals.skippedBlockedInsightIds).toEqual([]);
  });

  it("does not hide a blocked sanitary supply insight when product source is absent", () => {
    const result = buildOperationalInsights(
      createInput({
        sources: {
          agendaItems: [
            {
              id: "agenda-without-product",
              status: "agendado",
              data_prevista: "2026-05-07",
              dominio: "sanitario",
              tipo: "sanitario_sem_produto",
            },
          ],
          animals: [],
          events: [],
        },
      }),
    );

    expect(result.sanitarySupplyNeeds.insight.answerability).toBe("blocked");
    expect(result.sanitarySupplyNeeds.insight.source.primarySource).toBeNull();
    expect(result.sections.find((section) => section.id === "sanitarySupplyNeeds")?.insight)
      .toBe(result.sanitarySupplyNeeds.insight);
  });

  it("uses only explicit date parameters and not the global clock", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      const result = buildOperationalInsights(
        createInput({
          sources: {
            agendaItems: [
              {
                id: "agenda-today",
                status: "agendado",
                data_prevista: referenceDate,
                dominio: "sanitario",
                tipo: "vacina",
                source_ref: { produto: "Vacina" },
              },
            ],
            animals: [],
            events: [],
          },
        }),
      );

      expect(result.agendaNeeds.dueToday.insight.data).toHaveLength(1);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
