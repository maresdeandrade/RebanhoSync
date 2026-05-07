import { describe, expect, it } from "vitest";

import {
  createSanitarySupplyNeedsInsight,
  getSanitarySupplyAgendaItems,
  groupSanitarySupplyNeeds,
  type SanitarySupplyAgendaItemInput,
} from "@/lib/insights/sanitarySupplyNeeds";

const generatedAt = "2026-05-07T12:00:00.000Z";
const referenceDate = "2026-05-07";

function createAgendaItem(
  overrides: Partial<SanitarySupplyAgendaItemInput> = {},
): SanitarySupplyAgendaItemInput {
  return {
    id: "agenda-1",
    status: "agendado",
    dueDate: "2026-05-07",
    deletedAt: null,
    domain: "sanitario",
    animalId: "animal-1",
    loteId: "lote-1",
    protocolId: "protocol-1",
    protocolItemId: "protocol-item-1",
    productId: "product-1",
    productName: "Vacina A",
    productUnit: "dose",
    quantityPerAnimal: 1,
    animalCount: 1,
    ...overrides,
  };
}

describe("sanitary supply needs insights", () => {
  it("uses only open agenda", () => {
    const open = createAgendaItem({ id: "open" });
    const concluded = createAgendaItem({ id: "concluded", status: "concluido" });

    expect(
      getSanitarySupplyAgendaItems({
        items: [open, concluded],
        scope: "all_open",
      }),
    ).toEqual([open]);
  });

  it("excludes concluded agenda", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios preciso?",
      generatedAt,
      scope: "all_open",
      items: [createAgendaItem({ status: "concluido" })],
    });

    expect(insight.resultStatus).toBe("empty");
    expect(insight.data.groups).toEqual([]);
  });

  it("excludes cancelled agenda", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios preciso?",
      generatedAt,
      scope: "all_open",
      items: [createAgendaItem({ status: "cancelado" })],
    });

    expect(insight.resultStatus).toBe("empty");
    expect(insight.data.groups).toEqual([]);
  });

  it("excludes deleted agenda", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "current_pending",
      question: "Quais insumos sanitarios estao pendentes?",
      generatedAt,
      scope: "all_open",
      items: [
        createAgendaItem({
          deletedAt: "2026-05-06T12:00:00.000Z",
        }),
      ],
    });

    expect(insight.resultStatus).toBe("empty");
  });

  it("filters by due_today", () => {
    const today = createAgendaItem({ id: "today", dueDate: "2026-05-07" });
    const tomorrow = createAgendaItem({ id: "tomorrow", dueDate: "2026-05-08" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "current_pending",
      question: "Quais insumos vencem hoje?",
      generatedAt,
      scope: "due_today",
      referenceDate,
      items: [today, tomorrow],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["today"]);
  });

  it("filters by overdue", () => {
    const overdue = createAgendaItem({ id: "overdue", dueDate: "2026-05-06" });
    const today = createAgendaItem({ id: "today", dueDate: "2026-05-07" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "current_pending",
      question: "Quais insumos estao atrasados?",
      generatedAt,
      scope: "overdue",
      referenceDate,
      items: [overdue, today],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["overdue"]);
  });

  it("filters by due_within_days", () => {
    const overdue = createAgendaItem({ id: "overdue", dueDate: "2026-05-06" });
    const today = createAgendaItem({ id: "today", dueDate: "2026-05-07" });
    const within = createAgendaItem({ id: "within", dueDate: "2026-05-14" });
    const outside = createAgendaItem({ id: "outside", dueDate: "2026-05-15" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos vencem nos proximos dias?",
      generatedAt,
      scope: "due_within_days",
      referenceDate,
      days: 7,
      items: [overdue, today, within, outside],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["today", "within"]);
  });

  it("filters by loteIds", () => {
    const lote1 = createAgendaItem({ id: "lote-1-item", loteId: " lote-1 " });
    const lote2 = createAgendaItem({ id: "lote-2-item", loteId: "lote-2" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos por lote?",
      generatedAt,
      scope: "all_open",
      filters: { loteIds: ["lote-1"] },
      items: [lote1, lote2],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["lote-1-item"]);
  });

  it("filters by animalIds", () => {
    const animal1 = createAgendaItem({ id: "animal-1-item", animalId: " animal-1 " });
    const animal2 = createAgendaItem({ id: "animal-2-item", animalId: "animal-2" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos por animal?",
      generatedAt,
      scope: "all_open",
      filters: { animalIds: ["animal-1"] },
      items: [animal1, animal2],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["animal-1-item"]);
  });

  it("filters by protocolIds", () => {
    const protocol1 = createAgendaItem({ id: "protocol-1-item", protocolId: " protocol-1 " });
    const protocol2 = createAgendaItem({ id: "protocol-2-item", protocolId: "protocol-2" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos por protocolo?",
      generatedAt,
      scope: "all_open",
      filters: { protocolIds: ["protocol-1"] },
      items: [protocol1, protocol2],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["protocol-1-item"]);
  });

  it("filters by protocolItemIds", () => {
    const item1 = createAgendaItem({
      id: "protocol-item-1-agenda",
      protocolItemId: " protocol-item-1 ",
    });
    const item2 = createAgendaItem({
      id: "protocol-item-2-agenda",
      protocolItemId: "protocol-item-2",
    });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos por item de protocolo?",
      generatedAt,
      scope: "all_open",
      filters: { protocolItemIds: ["protocol-item-1"] },
      items: [item1, item2],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["protocol-item-1-agenda"]);
  });

  it("filters by productIds", () => {
    const product1 = createAgendaItem({ id: "product-1-agenda", productId: " product-1 " });
    const product2 = createAgendaItem({ id: "product-2-agenda", productId: "product-2" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos por produto?",
      generatedAt,
      scope: "all_open",
      filters: { productIds: ["product-1"] },
      items: [product1, product2],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["product-1-agenda"]);
  });

  it("filters by productNames", () => {
    const vacina = createAgendaItem({
      id: "vacina-agenda",
      productId: null,
      productName: " Vacina A ",
    });
    const vermifugo = createAgendaItem({
      id: "vermifugo-agenda",
      productId: null,
      productName: "Vermifugo A",
    });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos por nome de produto?",
      generatedAt,
      scope: "all_open",
      filters: { productNames: ["Vacina A"] },
      items: [vacina, vermifugo],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["vacina-agenda"]);
  });

  it("keeps insight filters equal to normalized filters actually applied", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos filtrados?",
      generatedAt,
      scope: "all_open",
      filters: {
        loteIds: [" lote-1 ", "lote-1", " "],
        animalIds: ["animal-1"],
        domains: [],
        protocolIds: [" protocol-1 "],
        protocolItemIds: ["protocol-item-1"],
        productIds: ["product-1"],
        productNames: ["Vacina A"],
      },
      items: [createAgendaItem()],
    });

    expect(insight.filters).toEqual({
      loteIds: ["lote-1"],
      animalIds: ["animal-1"],
      domains: ["sanitario"],
      protocolIds: ["protocol-1"],
      protocolItemIds: ["protocol-item-1"],
      productIds: ["product-1"],
      productNames: ["Vacina A"],
    });
  });

  it("excludes item with non-sanitary domain", () => {
    const sanitario = createAgendaItem({ id: "sanitario", domain: "sanitario" });
    const financeiro = createAgendaItem({ id: "financeiro", domain: "financeiro" });

    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios?",
      generatedAt,
      scope: "all_open",
      items: [sanitario, financeiro],
    });

    expect(insight.data.groups[0].agendaItemIds).toEqual(["sanitario"]);
  });

  it("excludes item without domain", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios?",
      generatedAt,
      scope: "all_open",
      items: [createAgendaItem({ domain: null })],
    });

    expect(insight.resultStatus).toBe("empty");
    expect(insight.data.groups).toEqual([]);
  });

  it("groups by productId", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({ id: "a", productId: "product-1", productName: "Vacina A" }),
      createAgendaItem({ id: "b", productId: "product-1", productName: "Vacina A" }),
    ]);

    expect(summary.groups).toEqual([
      {
        productKey: "id:product-1",
        productId: "product-1",
        productName: "Vacina A",
        productUnit: "dose",
        agendaItemCount: 2,
        animalCount: 2,
        estimatedQuantity: 2,
        missingQuantityCount: 0,
        agendaItemIds: ["a", "b"],
      },
    ]);
  });

  it("groups by productName when productId is absent", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({
        id: "a",
        productId: null,
        productName: "Vermifugo A",
      }),
    ]);

    expect(summary.groups[0].productKey).toBe("name:Vermifugo A");
    expect(summary.groups[0].productName).toBe("Vermifugo A");
    expect(summary.groups[0].productId).toBeUndefined();
  });

  it("does not infer absent product", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({
        id: "without-product",
        productId: null,
        productName: null,
      }),
    ]);

    expect(summary.groups).toEqual([]);
    expect(summary.incompleteAgendaItemIds).toEqual(["without-product"]);
  });

  it("missing product creates partial insight with limitation when partial data exists", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios preciso?",
      generatedAt,
      scope: "all_open",
      items: [
        createAgendaItem({ id: "with-product" }),
        createAgendaItem({ id: "without-product", productId: null, productName: null }),
      ],
    });

    expect(insight.resultStatus).toBe("partial");
    expect(insight.partialReason).toMatch(/produto identificado/);
    expect(insight.data.incompleteAgendaItemIds).toEqual(["without-product"]);
    expect(insight.source.limitations).toContain(
      "Existem agendas sem produto identificado; elas nao foram inferidas.",
    );
  });

  it("blocks only when product is required and no item can be grouped by product", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quantos produtos preciso?",
      generatedAt,
      scope: "all_open",
      requireProductSource: true,
      items: [
        createAgendaItem({
          id: "without-product",
          productId: null,
          productName: null,
        }),
      ],
    });

    expect(insight.answerability).toBe("blocked");
    expect(insight.source.block.requiredSources).toEqual([
      "produto identificado em agenda sanitaria materializada",
    ]);
  });

  it("calculates estimatedQuantity when quantityPerAnimal exists", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({
        id: "multi-animal",
        quantityPerAnimal: 2,
        animalCount: 3,
      }),
    ]);

    expect(summary.groups[0].estimatedQuantity).toBe(6);
    expect(summary.groups[0].animalCount).toBe(3);
  });

  it("increments missingQuantityCount when quantity is missing", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({
        id: "missing-quantity",
        quantityPerAnimal: null,
        animalCount: 5,
      }),
    ]);

    expect(summary.groups[0].estimatedQuantity).toBeUndefined();
    expect(summary.groups[0].missingQuantityCount).toBe(1);
    expect(summary.groups[0].animalCount).toBe(5);
  });

  it("does not use zero quantityPerAnimal in estimatedQuantity", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({
        id: "zero-quantity",
        quantityPerAnimal: 0,
        animalCount: 5,
      }),
    ]);

    expect(summary.groups[0].estimatedQuantity).toBeUndefined();
    expect(summary.groups[0].missingQuantityCount).toBe(1);
  });

  it("does not use negative quantityPerAnimal in estimatedQuantity", () => {
    const summary = groupSanitarySupplyNeeds([
      createAgendaItem({
        id: "negative-quantity",
        quantityPerAnimal: -1,
        animalCount: 5,
      }),
    ]);

    expect(summary.groups[0].estimatedQuantity).toBeUndefined();
    expect(summary.groups[0].missingQuantityCount).toBe(1);
  });

  it("counts invalid quantity as missing quantity in the insight limitation", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios preciso?",
      generatedAt,
      scope: "all_open",
      items: [createAgendaItem({ quantityPerAnimal: 0 })],
    });

    expect(insight.data.groups[0].missingQuantityCount).toBe(1);
    expect(insight.source.limitations).toContain(
      "Agendas sem quantityPerAnimal valido maior que zero nao contribuem para estimatedQuantity; missingQuantityCount inclui quantidade ausente ou invalida.",
    );
  });

  it.each([
    "historical_kpi",
    "workflow_kpi",
    "current_state",
    "configured_rule",
    "operational_report",
  ] as const)("rejects %s", (questionKind) => {
    expect(() =>
      createSanitarySupplyNeedsInsight({
        questionKind,
        question: "Pergunta fora do escopo",
        generatedAt,
        scope: "all_open",
        items: [createAgendaItem()],
      }),
    ).toThrow(/sanitarySupplyNeeds supports only/);
  });

  it("declares future_need and state_agenda_itens as primary source", () => {
    const insight = createSanitarySupplyNeedsInsight({
      questionKind: "future_need",
      question: "Quais insumos sanitarios preciso?",
      generatedAt,
      scope: "all_open",
      items: [createAgendaItem()],
    });

    expect(insight.answerability).toBe("answerable");
    expect(insight.questionKind).toBe("future_need");
    expect(insight.source.primarySource).toBe("state_agenda_itens");
    expect(insight.source.excludedSources).toContain("eventos");
  });

  it("does not use the global clock", () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now should not be used");
    };

    try {
      const insight = createSanitarySupplyNeedsInsight({
        questionKind: "future_need",
        question: "Quais insumos vencem nos proximos dias?",
        generatedAt,
        scope: "due_within_days",
        referenceDate,
        days: 7,
        items: [createAgendaItem({ dueDate: "2026-05-08" })],
      });

      expect(insight.data.groups).toHaveLength(1);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
