import { describe, expect, it } from "vitest";

import {
  assertBlockedSourceContract,
  assertOperationalInsight,
  createAnswerableInsight,
  createAnswerableSourceContract,
  createBlockedInsight,
  createBlockedSourceContract,
  hasPrimarySource,
  isAnswerableInsight,
  isBlockedInsight,
} from "@/lib/insights/sourceContract";
import type { InsightPeriod, InsightQuestionKind } from "@/lib/insights/types";

const generatedAt = "2026-05-06T12:00:00.000Z";
const period: InsightPeriod = {
  start: "2026-05-01",
  end: "2026-05-31",
};

function createSource(primarySource: string, overrides = {}) {
  return createAnswerableSourceContract({
    primarySource,
    evidenceStatus: "comprovado",
    ...overrides,
  });
}

function createInsight(
  questionKind: InsightQuestionKind,
  primarySource: string,
  overrides = {},
) {
  return createAnswerableInsight({
    questionKind,
    question: "Pergunta operacional",
    generatedAt,
    filters: {},
    source: createSource(primarySource),
    data: [],
    ...overrides,
  });
}

describe("insight source contract", () => {
  it("creates an answerable insight only with a primary source", () => {
    const source = createAnswerableSourceContract({
      primarySource: "state_agenda_itens",
      auxiliarySources: ["state_animais", "state_animais", " "],
      excludedSources: ["eventos_historicos_isolados"],
      evidenceStatus: "comprovado",
    });

    const insight = createAnswerableInsight({
      questionKind: "current_pending",
      question: "Quais agendas vencem hoje?",
      generatedAt,
      filters: { data: "2026-05-06" },
      source,
      data: [{ id: "agenda-1" }],
    });

    expect(insight.answerability).toBe("answerable");
    expect(insight.questionKind).toBe("current_pending");
    expect(insight.resultStatus).toBe("complete");
    expect(insight.source.primarySource).toBe("state_agenda_itens");
    expect(insight.source.auxiliarySources).toEqual(["state_animais"]);
    expect(hasPrimarySource(insight.source)).toBe(true);
    expect(isAnswerableInsight(insight)).toBe(true);
  });

  it("keeps empty as a valid answered result with declared source", () => {
    const source = createAnswerableSourceContract({
      primarySource: "state_agenda_itens",
      evidenceStatus: "comprovado",
    });

    const insight = createAnswerableInsight({
      questionKind: "current_pending",
      question: "Quais agendas estao atrasadas?",
      generatedAt,
      filters: {},
      resultStatus: "empty",
      source,
      data: [],
    });

    expect(insight.resultStatus).toBe("empty");
    expect(insight.data).toEqual([]);
  });

  it("blocks answers when the primary source is not consolidated", () => {
    const source = createBlockedSourceContract({
      block: {
        code: "unvalidated_read_model",
        reason: "Carencia ativa operacional consolidada nao foi confirmada.",
        requiredSources: ["vw_carencia_ativa"],
      },
      excludedSources: ["marcador_manual", "agenda_concluida_generica"],
      evidenceStatus: "bloqueado",
    });

    const insight = createBlockedInsight({
      questionKind: "current_state",
      question: "Quais animais estao em carencia ativa?",
      generatedAt,
      filters: {},
      source,
    });

    expect(insight.answerability).toBe("blocked");
    expect(insight.questionKind).toBe("current_state");
    expect(insight.source.primarySource).toBeNull();
    expect(insight.source.block.requiredSources).toEqual(["vw_carencia_ativa"]);
    expect(isBlockedInsight(insight)).toBe(true);
  });

  it("rejects answerable contracts without a primary source", () => {
    expect(() =>
      createAnswerableSourceContract({
        primarySource: " ",
      }),
    ).toThrow(/primarySource/);
  });

  it("rejects blocked contracts without an explicit reason", () => {
    expect(() =>
      createBlockedSourceContract({
        block: {
          code: "blocked_domain",
          reason: "",
        },
      }),
    ).toThrow(/block.reason/);
  });

  it("rejects unvalidated_read_model blocks without required sources", () => {
    expect(() =>
      createBlockedSourceContract({
        block: {
          code: "unvalidated_read_model",
          reason: "Read model ainda nao validado.",
        },
      }),
    ).toThrow(/requiredSources/);
  });

  it("rejects requires_code_validation blocks without required sources", () => {
    expect(() =>
      createBlockedSourceContract({
        block: {
          code: "requires_code_validation",
          reason: "Exige nova validacao no codigo.",
          requiredSources: [" "],
        },
      }),
    ).toThrow(/requiredSources/);
  });

  it("rejects missing_primary_source blocks without required sources", () => {
    expect(() =>
      createBlockedSourceContract({
        block: {
          code: "missing_primary_source",
          reason: "Fonte primaria ausente.",
          requiredSources: [],
        },
      }),
    ).toThrow(/requiredSources/);
  });

  it("allows blocked_domain blocks without required sources", () => {
    const source = createBlockedSourceContract({
      block: {
        code: "blocked_domain",
        reason: "Aptidao para venda e abate permanece bloqueada.",
      },
    });

    expect(source.block.requiredSources).toEqual([]);
  });

  it("allows prohibited_source blocks without required sources", () => {
    const source = createBlockedSourceContract({
      block: {
        code: "prohibited_source",
        reason: "Marcador manual nao pode ser fonte primaria.",
      },
    });

    expect(source.block.requiredSources).toEqual([]);
  });

  it("rejects operational insights without a source contract", () => {
    expect(() =>
      assertOperationalInsight({
        answerability: "answerable",
        questionKind: "future_need",
        question: "Quantas vacinas preciso?",
        generatedAt,
        filters: {},
        resultStatus: "complete",
        data: [],
      }),
    ).toThrow(/source/);
  });

  it("requires partial insights to declare a limitation or partial reason", () => {
    const sourceWithoutLimitations = createAnswerableSourceContract({
      primarySource: "state_animais",
      evidenceStatus: "depende_validacao",
    });

    expect(() =>
      createAnswerableInsight({
        questionKind: "current_state",
        question: "Quantos animais estao por estagio?",
        generatedAt,
        filters: {},
        resultStatus: "partial",
        source: sourceWithoutLimitations,
        data: [],
      }),
    ).toThrow(/partial insight/);

    const sourceWithLimitations = createAnswerableSourceContract({
      primarySource: "state_animais",
      limitations: ["Paridade TS/SQL de estagio ainda deve ser validada."],
      evidenceStatus: "depende_validacao",
    });

    expect(
      createAnswerableInsight({
        questionKind: "current_state",
        question: "Quantos animais estao por estagio?",
        generatedAt,
        filters: {},
        resultStatus: "partial",
        source: sourceWithLimitations,
        data: [],
      }).resultStatus,
    ).toBe("partial");
  });

  it("requires period for historical_kpi", () => {
    expect(() =>
      createInsight("historical_kpi", "eventos_sanitario"),
    ).toThrow(/historical_kpi requires period/);
  });

  it("rejects agenda as primary source for historical_kpi", () => {
    expect(() =>
      createInsight("historical_kpi", "state_agenda_itens", { period }),
    ).toThrow(/historical_kpi requires events/);
  });

  it("accepts eventos_sanitario as primary source for historical_kpi", () => {
    const insight = createInsight("historical_kpi", "eventos_sanitario", {
      period,
    });

    expect(insight.source.primarySource).toBe("eventos_sanitario");
  });

  it("accepts state_agenda_itens as primary source for future_need", () => {
    const insight = createInsight("future_need", "state_agenda_itens");

    expect(insight.questionKind).toBe("future_need");
    expect(insight.source.primarySource).toBe("state_agenda_itens");
  });

  it("rejects eventos_sanitario as primary source for future_need", () => {
    expect(() => createInsight("future_need", "eventos_sanitario")).toThrow(
      /future_need requires agenda/,
    );
  });

  it("accepts agenda_itens as primary source for workflow_kpi", () => {
    const insight = createInsight("workflow_kpi", "agenda_itens");

    expect(insight.source.primarySource).toBe("agenda_itens");
  });

  it("accepts state_animais as primary source for current_state", () => {
    const insight = createInsight("current_state", "state_animais");

    expect(insight.source.primarySource).toBe("state_animais");
  });

  it("rejects agenda_itens as primary source for current_state", () => {
    expect(() => createInsight("current_state", "agenda_itens")).toThrow(
      /current_state requires state/,
    );
  });

  it("accepts protocolos_sanitarios as primary source for configured_rule", () => {
    const insight = createInsight("configured_rule", "protocolos_sanitarios");

    expect(insight.source.primarySource).toBe("protocolos_sanitarios");
  });

  it("rejects eventos_sanitario as primary source for configured_rule", () => {
    expect(() =>
      createInsight("configured_rule", "eventos_sanitario"),
    ).toThrow(/configured_rule requires protocol/);
  });

  it("requires limitations when historical_kpi uses state_animais as auxiliary source", () => {
    const sourceWithoutLimitations = createAnswerableSourceContract({
      primarySource: "eventos_sanitario",
      auxiliarySources: ["state_animais"],
      evidenceStatus: "comprovado",
    });

    expect(() =>
      createAnswerableInsight({
        questionKind: "historical_kpi",
        question: "KPI historico por animal",
        period,
        generatedAt,
        filters: {},
        source: sourceWithoutLimitations,
        data: [],
      }),
    ).toThrow(/current state auxiliary source requires limitations/);

    const sourceWithLimitations = createAnswerableSourceContract({
      primarySource: "eventos_sanitario",
      auxiliarySources: ["state_animais"],
      limitations: ["Usa estado atual do animal, nao snapshot historico do evento."],
      evidenceStatus: "comprovado",
    });

    const insight = createAnswerableInsight({
      questionKind: "historical_kpi",
      question: "KPI historico por animal",
      period,
      generatedAt,
      filters: {},
      source: sourceWithLimitations,
      data: [],
    });

    expect(insight.source.limitations).toEqual([
      "Usa estado atual do animal, nao snapshot historico do evento.",
    ]);
  });

  it("keeps questionKind on blocked insights", () => {
    const source = createBlockedSourceContract({
      block: {
        code: "missing_primary_source",
        reason: "Fonte historica de producao mensal ainda nao confirmada.",
        requiredSources: ["eventos_producao"],
      },
    });

    const insight = createBlockedInsight({
      questionKind: "historical_kpi",
      question: "Producao mensal por lote",
      generatedAt,
      filters: {},
      source,
    });

    expect(insight.questionKind).toBe("historical_kpi");
    expect(insight.answerability).toBe("blocked");
  });

  it("rejects operational_report as a directly answerable insight", () => {
    expect(() =>
      createInsight("operational_report", "state_agenda_itens"),
    ).toThrow(/operational_report requires composed section insights/);
  });

  it("allows operational_report as a blocked insight", () => {
    const source = createBlockedSourceContract({
      block: {
        code: "blocked_domain",
        reason: "Relatorio operacional composto ainda nao foi montado.",
      },
    });

    const insight = createBlockedInsight({
      questionKind: "operational_report",
      question: "Relatorio operacional",
      generatedAt,
      filters: {},
      source,
    });

    expect(insight.questionKind).toBe("operational_report");
    expect(insight.answerability).toBe("blocked");
  });

  it("assertOperationalInsight rejects historical_kpi with state_agenda_itens", () => {
    expect(() =>
      assertOperationalInsight({
        answerability: "answerable",
        questionKind: "historical_kpi",
        question: "KPI historico por agenda",
        period,
        generatedAt,
        filters: {},
        resultStatus: "complete",
        source: createSource("state_agenda_itens"),
        data: [],
      }),
    ).toThrow(/historical_kpi requires events/);
  });

  it("assertOperationalInsight rejects historical_kpi without period", () => {
    expect(() =>
      assertOperationalInsight({
        answerability: "answerable",
        questionKind: "historical_kpi",
        question: "KPI historico sem periodo",
        generatedAt,
        filters: {},
        resultStatus: "complete",
        source: createSource("eventos_sanitario"),
        data: [],
      }),
    ).toThrow(/historical_kpi requires period/);
  });

  it("assertBlockedSourceContract rejects unvalidated_read_model without requiredSources", () => {
    expect(() =>
      assertBlockedSourceContract({
        answerability: "blocked",
        primarySource: null,
        auxiliarySources: [],
        excludedSources: [],
        limitations: [],
        evidenceStatus: "bloqueado",
        block: {
          code: "unvalidated_read_model",
          reason: "Read model futuro ainda nao validado.",
          requiredSources: [],
        },
      }),
    ).toThrow(/requiredSources/);
  });

  it("assertBlockedSourceContract allows blocked_domain without requiredSources", () => {
    expect(() =>
      assertBlockedSourceContract({
        answerability: "blocked",
        primarySource: null,
        auxiliarySources: [],
        excludedSources: [],
        limitations: [],
        evidenceStatus: "bloqueado",
        block: {
          code: "blocked_domain",
          reason: "Dominio conceitualmente bloqueado.",
          requiredSources: [],
        },
      }),
    ).not.toThrow();
  });
});
