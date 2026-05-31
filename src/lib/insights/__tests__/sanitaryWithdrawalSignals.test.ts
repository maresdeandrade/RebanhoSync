import { createOperationalSignalsFromInsights } from "@/lib/insights/tagSignals";
import {
  createSanitaryTraceabilitySignalsInsight,
  createSanitaryWithdrawalSignalsInsight,
} from "@/lib/insights/sanitaryWithdrawalSignals";

describe("sanitary withdrawal insight signals", () => {
  it("emits active and free withdrawal signals exclusively from structured sanitary events", () => {
    const insight = createSanitaryWithdrawalSignalsInsight({
      question: "Quais eventos sanitarios estruturados indicam carencia?",
      generatedAt: "2026-05-31T12:00:00.000Z",
      referenceDate: "2026-05-31",
      events: [
        {
          id: "evt-active",
          animalId: "animal-1",
          carenciaCarneDias: 30,
          carenciaCarneAte: "2026-06-10",
        },
        {
          id: "evt-free",
          animalId: "animal-2",
          carenciaLeiteDias: 3,
          carenciaLeiteAte: "2026-05-01",
        },
      ],
    });

    const signals = createOperationalSignalsFromInsights([insight]);
    expect(signals.map((signal) => signal.code)).toEqual([
      "sanitario:carencia_ativa",
      "sanitario:livre_carencia",
    ]);
    expect(signals.every((signal) => signal.primarySource === "eventos_sanitario")).toBe(true);
    expect(insight.source.excludedSources).toContain("agenda_itens");
    expect(insight.source.excludedSources).toContain("protocolos_sanitarios");
  });

  it("does not infer withdrawal from events without structured withdrawal columns", () => {
    const insight = createSanitaryWithdrawalSignalsInsight({
      question: "Quais eventos sanitarios estruturados indicam carencia?",
      generatedAt: "2026-05-31T12:00:00.000Z",
      referenceDate: "2026-05-31",
      events: [
        {
          id: "evt-agenda-like",
          animalId: "animal-1",
        },
      ],
    });

    expect(insight.data.evaluatedEventCount).toBe(0);
    expect(createOperationalSignalsFromInsights([insight])).toEqual([]);
  });

  it("keeps commercial sale and slaughter signals blocked", () => {
    expect(() =>
      createOperationalSignalsFromInsights([
        {
          answerability: "answerable",
          questionKind: "historical_kpi",
          question: "Venda",
          generatedAt: "2026-05-31T12:00:00.000Z",
          resultStatus: "complete",
          source: {
            answerability: "answerable",
            primarySource: "eventos_sanitario",
            auxiliarySources: [],
            excludedSources: [],
            limitations: [],
            evidenceStatus: "comprovado",
          },
          data: {
            source: "eventos_sanitario_structured",
            activeCount: 0,
            freeCount: 0,
            evaluatedEventCount: 0,
            activeEventIds: [],
            freeEventIds: [],
          },
        },
      ]),
    ).not.toThrow();
  });

  it("emits sanitary traceability signals only from structured sanitary events", () => {
    const insight = createSanitaryTraceabilitySignalsInsight({
      question: "Quais eventos sanitarios estruturados têm falhas de rastreabilidade?",
      generatedAt: "2026-05-31T12:00:00.000Z",
      events: [
        {
          id: "evt-no-product",
          occurredAt: "2026-05-20T12:00:00.000Z",
          animalId: "animal-1",
        },
        {
          id: "evt-manual-product",
          occurredAt: "2026-05-20T12:00:00.000Z",
          animalId: "animal-2",
          produtoNome: "Produto manual",
          doseQuantidade: 1,
          doseUnidade: "mL",
          viaAplicacao: "SC",
        },
        {
          id: "evt-expired-stock",
          occurredAt: "2026-05-20T12:00:00.000Z",
          animalId: "animal-3",
          produtoVeterinarioId: "prod-1",
          produtoNome: "Vacina A",
          estoqueLoteId: "stock-1",
          estoqueLoteCodigo: "L-2025",
          validadeProduto: "2026-05-01",
          doseQuantidade: 2,
          doseUnidade: "mL",
          viaAplicacao: "IM",
          custoTotalSnapshot: 12,
        },
      ],
    });

    const signals = createOperationalSignalsFromInsights([insight]);

    expect(signals.map((signal) => signal.code)).toEqual([
      "sanitario:evento_sem_rastreabilidade",
      "sanitario:produto_sem_lote",
      "sanitario:estoque_inconsistente",
      "sanitario:custo_ausente",
    ]);
    expect(insight.source.primarySource).toBe("eventos_sanitario");
    expect(insight.source.excludedSources).toContain("agenda_itens");
    expect(insight.source.excludedSources).toContain("protocolos_sanitarios");
  });
});
