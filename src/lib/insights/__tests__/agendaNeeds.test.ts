import { describe, expect, it } from "vitest";

import {
  createAgendaNeedsInsight,
  getAgendaNeedsDueToday,
  getAgendaNeedsDueWithinDays,
  getOpenAgendaNeeds,
  getOverdueAgendaNeeds,
  type AgendaNeedItemInput,
} from "@/lib/insights/agendaNeeds";

const generatedAt = "2026-05-06T12:00:00.000Z";
const referenceDate = "2026-05-06";

function createAgendaItem(
  overrides: Partial<AgendaNeedItemInput> = {},
): AgendaNeedItemInput {
  return {
    id: "agenda-1",
    status: "agendado",
    dueDate: "2026-05-06",
    deletedAt: null,
    animalId: "animal-1",
    loteId: "lote-1",
    domain: "sanitario",
    protocolId: "protocol-1",
    protocolItemId: "protocol-item-1",
    productId: "product-1",
    productName: "Vacina A",
    title: "Vacinar",
    ...overrides,
  };
}

describe("agenda needs insights", () => {
  it("includes open agenda in needs", () => {
    const item = createAgendaItem();

    expect(getOpenAgendaNeeds([item])).toEqual([item]);
  });

  it("excludes concluded agenda from future_need", () => {
    const concluded = createAgendaItem({
      id: "concluded",
      status: "concluido",
    });

    const insight = createAgendaNeedsInsight({
      questionKind: "future_need",
      scope: "all_open",
      question: "O que precisa ser feito?",
      generatedAt,
      items: [concluded],
    });

    expect(insight.answerability).toBe("answerable");
    expect(insight.resultStatus).toBe("empty");
    expect(insight.data).toEqual([]);
  });

  it("excludes cancelled agenda from open needs", () => {
    const cancelled = createAgendaItem({
      id: "cancelled",
      status: "cancelado",
    });

    expect(getOpenAgendaNeeds([cancelled])).toEqual([]);
  });

  it("excludes deleted agenda from open needs", () => {
    const deleted = createAgendaItem({
      id: "deleted",
      deletedAt: "2026-05-05T10:00:00.000Z",
    });

    expect(getOpenAgendaNeeds([deleted])).toEqual([]);
  });

  it("createAgendaNeedsInsight with all_open returns open agenda", () => {
    const open = createAgendaItem({ id: "open" });
    const concluded = createAgendaItem({ id: "concluded", status: "concluido" });

    const insight = createAgendaNeedsInsight({
      questionKind: "current_pending",
      scope: "all_open",
      question: "O que esta pendente agora?",
      generatedAt,
      items: [open, concluded],
    });

    expect(insight.resultStatus).toBe("complete");
    expect(insight.data).toEqual([open]);
    expect(insight.source.limitations).not.toContain(
      "Escopo due_within_days exclui agendas vencidas; atrasadas ficam em overdue.",
    );
  });

  it("scope due_today requires referenceDate", () => {
    expect(() =>
      createAgendaNeedsInsight({
        questionKind: "current_pending",
        scope: "due_today",
        question: "O que vence hoje?",
        generatedAt,
        items: [createAgendaItem()],
      }),
    ).toThrow(/referenceDate/);
  });

  it("scope due_today filters agenda correctly", () => {
    const dueToday = createAgendaItem({ id: "today", dueDate: "2026-05-06" });
    const tomorrow = createAgendaItem({ id: "tomorrow", dueDate: "2026-05-07" });

    const insight = createAgendaNeedsInsight({
      questionKind: "current_pending",
      scope: "due_today",
      question: "O que vence hoje?",
      generatedAt,
      referenceDate,
      items: [dueToday, tomorrow],
    });

    expect(insight.data).toEqual([dueToday]);
  });

  it("filters agenda due today with pure helper", () => {
    const dueToday = createAgendaItem({ id: "today", dueDate: "2026-05-06" });
    const tomorrow = createAgendaItem({ id: "tomorrow", dueDate: "2026-05-07" });

    expect(getAgendaNeedsDueToday([dueToday, tomorrow], referenceDate)).toEqual([
      dueToday,
    ]);
  });

  it("scope overdue filters agenda correctly", () => {
    const overdue = createAgendaItem({ id: "overdue", dueDate: "2026-05-05" });
    const today = createAgendaItem({ id: "today", dueDate: "2026-05-06" });

    const insight = createAgendaNeedsInsight({
      questionKind: "current_pending",
      scope: "overdue",
      question: "O que esta atrasado?",
      generatedAt,
      referenceDate,
      items: [overdue, today],
    });

    expect(insight.data).toEqual([overdue]);
  });

  it("filters overdue agenda with pure helper", () => {
    const overdue = createAgendaItem({ id: "overdue", dueDate: "2026-05-05" });
    const today = createAgendaItem({ id: "today", dueDate: "2026-05-06" });

    expect(getOverdueAgendaNeeds([overdue, today], referenceDate)).toEqual([
      overdue,
    ]);
  });

  it("scope due_within_days requires days", () => {
    expect(() =>
      createAgendaNeedsInsight({
        questionKind: "future_need",
        scope: "due_within_days",
        question: "O que vence nos proximos dias?",
        generatedAt,
        referenceDate,
        items: [createAgendaItem()],
      }),
    ).toThrow(/days/);
  });

  it("scope due_within_days rejects negative days", () => {
    expect(() =>
      createAgendaNeedsInsight({
        questionKind: "future_need",
        scope: "due_within_days",
        question: "O que vence nos proximos dias?",
        generatedAt,
        referenceDate,
        days: -1,
        items: [createAgendaItem()],
      }),
    ).toThrow(/days/);
  });

  it("filters next seven days without overdue agenda", () => {
    const overdue = createAgendaItem({ id: "overdue", dueDate: "2026-05-05" });
    const today = createAgendaItem({ id: "today", dueDate: "2026-05-06" });
    const withinWindow = createAgendaItem({ id: "within", dueDate: "2026-05-13" });
    const outsideWindow = createAgendaItem({ id: "outside", dueDate: "2026-05-14" });

    expect(
      getAgendaNeedsDueWithinDays(
        [overdue, today, withinWindow, outsideWindow],
        referenceDate,
        7,
      ),
    ).toEqual([today, withinWindow]);
  });

  it("adds due_within_days limitation only for due_within_days scope", () => {
    const insight = createAgendaNeedsInsight({
      questionKind: "future_need",
      scope: "due_within_days",
      question: "O que vence nos proximos dias?",
      generatedAt,
      referenceDate,
      days: 7,
      items: [createAgendaItem()],
    });

    expect(insight.source.limitations).toContain(
      "Escopo due_within_days exclui agendas vencidas; atrasadas ficam em overdue.",
    );
  });

  it("invalid referenceDate fails", () => {
    expect(() =>
      getAgendaNeedsDueToday([createAgendaItem()], "2026-02-31"),
    ).toThrow(/referenceDate/);
  });

  it("invalid dueDate fails when a date filter is used", () => {
    expect(() =>
      getAgendaNeedsDueToday(
        [createAgendaItem({ dueDate: "2026-99-99" })],
        referenceDate,
      ),
    ).toThrow(/dueDate/);
  });

  it("returns empty result when no open agenda exists", () => {
    const insight = createAgendaNeedsInsight({
      questionKind: "current_pending",
      scope: "all_open",
      question: "O que esta pendente agora?",
      generatedAt,
      items: [
        createAgendaItem({ status: "concluido" }),
        createAgendaItem({ status: "cancelado" }),
      ],
    });

    expect(insight.answerability).toBe("answerable");
    expect(insight.resultStatus).toBe("empty");
    expect(insight.data).toEqual([]);
  });

  it("declares future_need questionKind and agenda primary source", () => {
    const item = createAgendaItem();

    const insight = createAgendaNeedsInsight({
      questionKind: "future_need",
      scope: "all_open",
      question: "O que precisa ser feito?",
      generatedAt,
      items: [item],
    });

    expect(insight.answerability).toBe("answerable");
    expect(insight.questionKind).toBe("future_need");
    expect(insight.source.primarySource).toBe("state_agenda_itens");
    expect(insight.data).toEqual([item]);
  });

  it.each([
    "workflow_kpi",
    "historical_kpi",
    "current_state",
    "configured_rule",
    "operational_report",
  ] as const)("rejects %s in agendaNeeds", (questionKind) => {
    expect(() =>
      createAgendaNeedsInsight({
        questionKind,
        scope: "all_open",
        question: "Pergunta fora do escopo de agendaNeeds",
        generatedAt,
        items: [createAgendaItem()],
      }),
    ).toThrow(/agendaNeeds supports only/);
  });

  it("does not depend on the global clock", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      expect(
        getAgendaNeedsDueWithinDays(
          [createAgendaItem({ dueDate: "2026-05-07" })],
          referenceDate,
          7,
        ),
      ).toHaveLength(1);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it("blocks product needs when product source is required but absent", () => {
    const itemWithoutProduct = createAgendaItem({
      productId: null,
      productName: null,
    });

    const insight = createAgendaNeedsInsight({
      questionKind: "future_need",
      scope: "all_open",
      question: "Quantos produtos preciso?",
      generatedAt,
      items: [itemWithoutProduct],
      requiresProductSource: true,
    });

    expect(insight.answerability).toBe("blocked");
    expect(insight.source.block.requiredSources).toEqual([
      "produto/protocolo carregado",
    ]);
  });
});
