import { describe, expect, it } from "vitest";

import { createAgendaNeedsInsight, type AgendaNeedItemInput } from "@/lib/insights/agendaNeeds";
import {
  createHerdStageSummaryInsight,
  type HerdStageAnimalInput,
} from "@/lib/insights/herdStageSummary";
import {
  createBlockedInsight,
  createBlockedSourceContract,
} from "@/lib/insights/sourceContract";
import {
  createOperationalSignal,
  createOperationalSignalsFromInsights,
  createSignalsFromAgendaInsight,
  createSignalsFromHerdStageInsight,
  type OperationalSignalCode,
} from "@/lib/insights/tagSignals";

const generatedAt = "2026-05-07T12:00:00.000Z";

function createAgendaItem(
  overrides: Partial<AgendaNeedItemInput> = {},
): AgendaNeedItemInput {
  return {
    id: "agenda-1",
    status: "agendado",
    dueDate: "2026-05-07",
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

describe("operational tag signals", () => {
  it("requires primary source for a signal", () => {
    expect(() =>
      createOperationalSignal({
        code: "agenda:pendente",
        label: "Agenda pendente",
        primarySource: " ",
        questionKind: "future_need",
        generatedAt,
        sourceInsightQuestion: "O que precisa ser feito?",
      }),
    ).toThrow(/primarySource/);
  });

  it("does not emit signal from blocked insight", () => {
    const blockedInsight = createBlockedInsight({
      questionKind: "future_need",
      question: "Necessidade sem fonte primaria",
      generatedAt,
      filters: {},
      source: createBlockedSourceContract({
        block: {
          code: "missing_primary_source",
          reason: "Fonte primaria ausente.",
          requiredSources: ["state_agenda_itens"],
        },
      }),
    });

    expect(() => createSignalsFromAgendaInsight(blockedInsight)).toThrow(/blocked insight/);
  });

  it("derives agenda:pendente from future_need agenda insight", () => {
    const insight = createAgendaNeedsInsight({
      questionKind: "future_need",
      scope: "all_open",
      question: "O que precisa ser feito?",
      generatedAt,
      items: [createAgendaItem()],
    });

    const signals = createSignalsFromAgendaInsight(insight);

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "agenda:pendente",
          primarySource: "state_agenda_itens",
          questionKind: "future_need",
          generatedAt,
          count: 1,
        }),
      ]),
    );
  });

  it("derives sanitary agenda signals from sanitary agenda insight", () => {
    const insight = createAgendaNeedsInsight({
      questionKind: "current_pending",
      scope: "overdue",
      question: "Quais agendas estao atrasadas?",
      generatedAt,
      referenceDate: "2026-05-08",
      items: [createAgendaItem({ dueDate: "2026-05-07", domain: "sanitario" })],
    });

    const codes = createSignalsFromAgendaInsight(insight).map((signal) => signal.code);

    expect(codes).toContain("agenda:atrasada");
    expect(codes).toContain("sanitario:pendencia_aberta");
    expect(codes).toContain("sanitario:pendencia_atrasada");
  });

  it("derives estagio:desconhecido from partial herd stage insight", () => {
    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual do rebanho",
      generatedAt,
      animals: [createAnimal({ stage: null })],
    });

    const signals = createSignalsFromHerdStageInsight(insight);

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "estagio:desconhecido",
          primarySource: "state_animais",
          questionKind: "current_state",
          count: 1,
        }),
      ]),
    );
  });

  it("derives current state signals without using manual markers", () => {
    const insight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual por status e lote",
      generatedAt,
      filters: { statuses: ["ativo", "vendido", "morto"] },
      animals: [
        createAnimal({ id: "active", status: "ativo", loteId: null }),
        createAnimal({ id: "sold", status: "vendido" }),
        createAnimal({ id: "dead", status: "morto" }),
      ],
    });

    const signals = createSignalsFromHerdStageInsight(insight);
    const codes = signals.map((signal) => signal.code);

    expect(codes).toContain("animal:ativo");
    expect(codes).toContain("animal:vendido");
    expect(codes).toContain("animal:morto");
    expect(codes).toContain("lote:sem_lote");
    expect(signals.some((signal) => "manual" in signal)).toBe(false);
  });

  it.each([
    "sanitario:livre_carencia",
    "sanitario:carencia_ativa",
    "comercial:pronto_venda",
    "comercial:apto_abate",
    "peso:atual_confiavel",
    "protocolo:executado",
    "agenda:concluida_como_fato",
    "reproducao:iatf_pendente",
  ] as const)("does not emit blocked signal %s", (code) => {
    expect(() =>
      createOperationalSignal({
        code,
        label: "Sinal bloqueado",
        primarySource: "state_animais",
        questionKind: "current_state",
        generatedAt,
        sourceInsightQuestion: "Pergunta bloqueada",
      }),
    ).toThrow(/blocked/);
  });

  it("does not emit shortage, sale readiness or slaughter readiness signals", () => {
    const agendaInsight = createAgendaNeedsInsight({
      questionKind: "future_need",
      scope: "all_open",
      question: "O que precisa ser feito?",
      generatedAt,
      items: [createAgendaItem()],
    });
    const herdInsight = createHerdStageSummaryInsight({
      questionKind: "current_state",
      question: "Resumo atual do rebanho",
      generatedAt,
      animals: [createAnimal()],
    });

    const codes = createOperationalSignalsFromInsights([
      agendaInsight,
      herdInsight,
    ]).map((signal) => signal.code);

    const forbidden: readonly OperationalSignalCode[] = [
      "sanitario:livre_carencia",
      "sanitario:carencia_ativa",
      "comercial:pronto_venda",
      "comercial:apto_abate",
      "peso:atual_confiavel",
    ];

    expect(codes.some((code) => forbidden.includes(code))).toBe(false);
  });

  it("does not depend on the global clock", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      const insight = createAgendaNeedsInsight({
        questionKind: "current_pending",
        scope: "all_open",
        question: "O que esta pendente?",
        generatedAt,
        items: [createAgendaItem()],
      });

      expect(createSignalsFromAgendaInsight(insight)).toHaveLength(2);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
