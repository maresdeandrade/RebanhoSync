import { describe, expect, it } from "vitest";

import {
  createHerdStageSummaryInsight,
  getCurrentHerdAnimals,
  groupHerdByLote,
  groupHerdByStage,
  groupHerdByStatus,
  type HerdStageAnimalInput,
} from "@/lib/insights/herdStageSummary";

const generatedAt = "2026-05-07T12:00:00.000Z";

function createAnimal(
  overrides: Partial<HerdStageAnimalInput> = {},
): HerdStageAnimalInput {
  return {
    id: "animal-1",
    status: "ativo",
    deletedAt: null,
    loteId: "lote-1",
    sexo: "femea",
    stage: "vaca",
    category: "matriz",
    reproductiveStatus: "prenhe",
    ...overrides,
  };
}

describe("herd stage summary insights", () => {
  it("accepts only current_state", () => {
    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Quantos animais estao por estagio?",
      generatedAt,
      animals: [createAnimal()],
    });

    expect(insight.questionKind).toBe("current_state");
    expect(insight.answerability).toBe("answerable");
  });

  it.each([
    "future_need",
    "current_pending",
    "historical_kpi",
    "workflow_kpi",
    "configured_rule",
    "operational_report",
  ] as const)("rejects %s", (questionKind) => {
    expect(() =>
      createHerdStageSummaryInsight({
        questionKind,
        question: "Pergunta fora do escopo",
        generatedAt,
        animals: [createAnimal()],
      }),
    ).toThrow(/herdStageSummary supports only current_state/);
  });

  it("rejects historical_kpi", () => {
    expect(() =>
      createHerdStageSummaryInsight({
        questionKind: "historical_kpi",
        question: "Mudancas de categoria no periodo",
        generatedAt,
        animals: [createAnimal()],
      }),
    ).toThrow(/herdStageSummary supports only current_state/);
  });

  it("rejects future_need", () => {
    expect(() =>
      createHerdStageSummaryInsight({
        questionKind: "future_need",
        question: "O que precisa ser feito?",
        generatedAt,
        animals: [createAnimal()],
      }),
    ).toThrow(/herdStageSummary supports only current_state/);
  });

  it("excludes deleted animals", () => {
    const active = createAnimal({ id: "active" });
    const deleted = createAnimal({
      id: "deleted",
      deletedAt: "2026-05-07T10:00:00.000Z",
    });

    expect(getCurrentHerdAnimals({ animals: [active, deleted] })).toEqual([active]);
  });

  it("includes only active status by default", () => {
    const active = createAnimal({ id: "active", status: "ativo" });
    const sold = createAnimal({ id: "sold", status: "vendido" });
    const dead = createAnimal({ id: "dead", status: "morto" });

    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual do rebanho",
      generatedAt,
      animals: [active, sold, dead],
    });

    expect(insight.data.totalAnimals).toBe(1);
    expect(insight.data.byStatus).toEqual([{ status: "ativo", count: 1 }]);
    expect(insight.filters).toEqual({ statuses: ["ativo"] });
  });

  it("status filter can include sold and dead animals", () => {
    const active = createAnimal({ id: "active", status: "ativo" });
    const sold = createAnimal({ id: "sold", status: "vendido" });
    const dead = createAnimal({ id: "dead", status: "morto" });

    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual por status",
      generatedAt,
      filters: { statuses: ["vendido", "morto"] },
      animals: [active, sold, dead],
    });

    expect(insight.data.totalAnimals).toBe(2);
    expect(insight.data.byStatus).toEqual([
      { status: "morto", count: 1 },
      { status: "vendido", count: 1 },
    ]);
  });

  it("groups by stage", () => {
    expect(
      groupHerdByStage([
        createAnimal({ id: "vaca", stage: "vaca" }),
        createAnimal({ id: "novilha", stage: "novilha" }),
        createAnimal({ id: "vaca-2", stage: "vaca" }),
      ]),
    ).toEqual([
      { stage: "novilha", count: 1 },
      { stage: "vaca", count: 2 },
    ]);
  });

  it("missing stage becomes estagio_desconhecido", () => {
    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual por estagio",
      generatedAt,
      animals: [createAnimal({ stage: null })],
    });

    expect(insight.resultStatus).toBe("partial");
    expect(insight.data.unknownStageCount).toBe(1);
    expect(insight.data.byStage).toEqual([
      { stage: "estagio_desconhecido", count: 1 },
    ]);
    expect(insight.source.limitations).toContain(
      "Animais sem stage informado foram agrupados em estagio_desconhecido.",
    );
  });

  it("animal without lot becomes sem_lote", () => {
    expect(groupHerdByLote([createAnimal({ loteId: null })])).toEqual([
      { loteId: "sem_lote", count: 1 },
    ]);
  });

  it("filters by lot", () => {
    const lote1 = createAnimal({ id: "lote-1-animal", loteId: " lote-1 " });
    const lote2 = createAnimal({ id: "lote-2-animal", loteId: "lote-2" });

    const animals = getCurrentHerdAnimals({
      animals: [lote1, lote2],
      filters: { loteIds: ["lote-1"] },
    });

    expect(animals).toEqual([lote1]);
  });

  it("filters by sex", () => {
    const female = createAnimal({ id: "female", sexo: " femea " });
    const male = createAnimal({ id: "male", sexo: "macho" });

    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo por sexo",
      generatedAt,
      filters: { sexos: ["femea"] },
      animals: [female, male],
    });

    expect(insight.data.totalAnimals).toBe(1);
    expect(insight.data.byLote).toEqual([{ loteId: "lote-1", count: 1 }]);
  });

  it("filters by category", () => {
    const matriz = createAnimal({ id: "matriz", category: " matriz " });
    const recria = createAnimal({ id: "recria", category: "recria" });

    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo por categoria",
      generatedAt,
      filters: { categories: ["matriz"] },
      animals: [matriz, recria],
    });

    expect(insight.data.totalAnimals).toBe(1);
    expect(insight.data.byStage).toEqual([{ stage: "vaca", count: 1 }]);
  });

  it("filters by stage", () => {
    const vaca = createAnimal({ id: "vaca", stage: " vaca " });
    const novilha = createAnimal({ id: "novilha", stage: "novilha" });

    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo por estagio",
      generatedAt,
      filters: { stages: ["vaca"] },
      animals: [vaca, novilha],
    });

    expect(insight.data.totalAnimals).toBe(1);
    expect(insight.data.byStage).toEqual([{ stage: "vaca", count: 1 }]);
  });

  it("insight filters reflect normalized applied filters", () => {
    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo filtrado",
      generatedAt,
      filters: {
        loteIds: [" lote-1 ", "lote-1", " "],
        statuses: [" ativo "],
        sexos: [" femea "],
        stages: [" vaca "],
        categories: [" matriz "],
      },
      animals: [createAnimal()],
    });

    expect(insight.filters).toEqual({
      loteIds: ["lote-1"],
      statuses: ["ativo"],
      sexos: ["femea"],
      stages: ["vaca"],
      categories: ["matriz"],
    });
  });

  it("declares state_animais as primary source", () => {
    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual do rebanho",
      generatedAt,
      animals: [createAnimal()],
    });

    expect(insight.source.primarySource).toBe("state_animais");
    expect(insight.source.excludedSources).toContain("eventos");
    expect(insight.source.excludedSources).toContain("agenda_itens");
  });

  it("groups by status", () => {
    expect(
      groupHerdByStatus([
        createAnimal({ id: "active", status: "ativo" }),
        createAnimal({ id: "sold", status: "vendido" }),
        createAnimal({ id: "active-2", status: "ativo" }),
      ]),
    ).toEqual([
      { status: "ativo", count: 2 },
      { status: "vendido", count: 1 },
    ]);
  });

  it("does not use the global clock", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      const insight = createHerdStageSummaryInsight({
        questionKind: "current_state",
        question: "Resumo atual do rebanho",
        generatedAt,
        animals: [createAnimal()],
      });

      expect(insight.data.totalAnimals).toBe(1);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
