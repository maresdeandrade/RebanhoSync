import { expect, it } from "vitest";
import type {
  Evento,
  EventoComercial,
  FinanceCategory,
  FinanceCategoryTipoEnum,
  FinanceTransaction,
} from "@/lib/offline/types";
import {
  selectEconomicCoverage,
  type EconomicSourceCoverage,
  type SelectEconomicCoverageInput,
} from "../economicCoverage";

const VERIFIED_SOURCES: EconomicSourceCoverage = {
  financeTransactions: "VERIFIED",
  financeCategories: "VERIFIED",
  commercialOperations: "VERIFIED",
};

function category(
  id: string,
  tipo: FinanceCategoryTipoEnum,
  overrides: Partial<FinanceCategory> = {},
): FinanceCategory {
  return {
    id,
    fazenda_id: "farm-1",
    nome: id,
    tipo,
    grupo: tipo === "receita" ? "venda_animais" : "compra_animais",
    slug: id,
    is_default: false,
    ativo: true,
    observacoes: null,
    client_id: "client-1",
    client_op_id: `category-op-${id}`,
    client_tx_id: null,
    client_recorded_at: "2026-08-10T10:00:00.000Z",
    server_received_at: "2026-08-10T10:00:00.000Z",
    created_at: "2026-08-10T10:00:00.000Z",
    updated_at: "2026-08-10T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function transaction(
  id: string,
  overrides: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    fazenda_id: "farm-1",
    occurred_at: "2026-08-10T10:00:00.000Z",
    competence_date: null,
    due_date: null,
    paid_at: "2026-08-10T10:00:00.000Z",
    direction: "entrada",
    status: "realizado",
    category_id: "revenue",
    valor_total: 100,
    quantidade: null,
    unidade: null,
    valor_unitario: null,
    contraparte_id: null,
    animal_id: null,
    lote_id: null,
    pasto_id: null,
    centro_custo_tipo: null,
    centro_custo_id: null,
    rateio_metodo: null,
    origem: "manual",
    source_event_id: null,
    source_inventory_movement_id: null,
    observacoes: null,
    reverses_transaction_id: null,
    client_id: "client-1",
    client_op_id: `transaction-op-${id}`,
    client_tx_id: null,
    client_recorded_at: "2026-08-10T10:00:00.000Z",
    server_received_at: "2026-08-10T10:00:00.000Z",
    created_at: "2026-08-10T10:00:00.000Z",
    updated_at: "2026-08-10T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function commercialEvent(id: string): Evento {
  return {
    id,
    fazenda_id: "farm-1",
    dominio: "comercial",
    occurred_at: "2026-08-10T10:00:00.000Z",
    occurred_on: null,
    tipo: "venda",
    animal_id: null,
    lote_id: null,
    pasto_id: null,
    produto_id: null,
    protocolo_id: null,
    origem_id: null,
    destino_id: null,
    source_task_id: null,
    source_protocol_id: null,
    payload: { kind: "commercial_operation_v2" },
    observacoes: null,
    client_id: "client-1",
    client_op_id: `event-op-${id}`,
    client_tx_id: null,
    client_recorded_at: "2026-08-10T10:00:00.000Z",
    server_received_at: "2026-08-10T10:00:00.000Z",
    created_at: "2026-08-10T10:00:00.000Z",
    updated_at: "2026-08-10T10:00:00.000Z",
    deleted_at: null,
  } as Evento;
}

function commercialDetail(
  id: string,
  overrides: Partial<EventoComercial> = {},
): EventoComercial {
  return {
    evento_id: id,
    fazenda_id: "farm-1",
    operation_type: "venda",
    scope: "animal",
    occurred_at: "2026-08-10T10:00:00.000Z",
    quantidade_animais: 1,
    peso_vivo_total: null,
    peso_medio_derivado: null,
    valor_bruto: 100,
    frete: null,
    comissao: null,
    descontos: null,
    taxas_impostos: null,
    valor_liquido_derivado: 100,
    contraparte_id: null,
    contraparte_nome: null,
    animal_ids: ["animal-1"],
    lote_id: null,
    finance_transaction_id: null,
    snapshot: {},
    calculation_status: "complete",
    issues: [],
    limitations: [],
    observacoes: null,
    client_id: "client-1",
    client_op_id: `commercial-op-${id}`,
    client_tx_id: null,
    client_recorded_at: "2026-08-10T10:00:00.000Z",
    created_at: "2026-08-10T10:00:00.000Z",
    updated_at: "2026-08-10T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function input(
  overrides: Partial<SelectEconomicCoverageInput> = {},
): SelectEconomicCoverageInput {
  return {
    fazendaId: "farm-1",
    period: {
      from: "2026-08-01",
      to: "2026-08-31",
      timezone: "America/Sao_Paulo",
    },
    sourceCoverage: VERIFIED_SOURCES,
    transactions: [],
    categories: [
      category("revenue", "receita"),
      category("cost", "custo_variavel"),
    ],
    events: [],
    commercialDetails: [],
    ...overrides,
  };
}

it("keeps an empty period insufficient instead of asserting zero revenue or cost", () => {
  const result = selectEconomicCoverage(input());

  expect(result.status).toBe("INSUFFICIENT_COVERAGE");
  expect(result.observedRevenue.amount).toBeNull();
  expect(result.observedCosts.amount).toBeNull();
});

it("classifies factual realized revenue from explicit category and direction", () => {
  const result = selectEconomicCoverage(
    input({ transactions: [transaction("revenue-1")] }),
  );

  expect(result.status).toBe("AVAILABLE");
  expect(result.observedRevenue.amount).toBe(100);
  expect(result.observedCosts.amount).toBeNull();
});

it("classifies factual realized cost from explicit category and direction", () => {
  const result = selectEconomicCoverage(
    input({
      transactions: [
        transaction("cost-1", {
          direction: "saida",
          category_id: "cost",
          valor_total: 40,
        }),
      ],
    }),
  );

  expect(result.observedRevenue.amount).toBeNull();
  expect(result.observedCosts.amount).toBe(40);
});

it("preserves observed revenue and cost as separate buckets", () => {
  const result = selectEconomicCoverage(
    input({
      transactions: [
        transaction("revenue-1", { valor_total: 150 }),
        transaction("cost-1", {
          direction: "saida",
          category_id: "cost",
          valor_total: 60,
        }),
      ],
    }),
  );

  expect(result.observedRevenue.amount).toBe(150);
  expect(result.observedCosts.amount).toBe(60);
  expect(result).not.toHaveProperty("observedResult");
});

it("represents mathematical zero when factual revenue is fully reversed", () => {
  const original = transaction("revenue-1");
  const reversal = transaction("reversal-1", {
    direction: "saida",
    origem: "estorno",
    reverses_transaction_id: original.id,
    category_id: original.category_id,
    valor_total: original.valor_total,
    paid_at: "2026-08-11T10:00:00.000Z",
  });
  const result = selectEconomicCoverage(
    input({ transactions: [original, reversal] }),
  );

  expect(result.observedRevenue).toMatchObject({
    amount: 0,
    grossAmount: 100,
    reversalAmount: 100,
  });
  expect(result.observedRevenue.facts).toHaveLength(2);
  expect(result.observedCosts.amount).toBeNull();
  expect(result.reversals[0].appliedTo).toBe("REVENUE");
});

it("keeps a missing category reference unclassified and outside totals", () => {
  const result = selectEconomicCoverage(
    input({
      transactions: [transaction("unclassified", { category_id: "" })],
    }),
  );

  expect(result.status).toBe("INSUFFICIENT_COVERAGE");
  expect(result.unclassifiedTransactions).toEqual([
    {
      transactionId: "unclassified",
      categoryId: null,
      reason: "MISSING_CATEGORY_REFERENCE",
    },
  ]);
});

it("does not count a reversal as an independent opposite economic fact", () => {
  const original = transaction("cost-1", {
    direction: "saida",
    category_id: "cost",
    valor_total: 75,
  });
  const reversal = transaction("reversal-1", {
    direction: "entrada",
    category_id: "cost",
    valor_total: 75,
    origem: "estorno",
    reverses_transaction_id: original.id,
  });
  const result = selectEconomicCoverage(
    input({ transactions: [reversal, original] }),
  );

  expect(result.observedCosts.amount).toBe(0);
  expect(result.observedRevenue.amount).toBeNull();
  expect(result.reversals).toHaveLength(1);
});

it("lists commercial facts without financial association as coverage gaps", () => {
  const result = selectEconomicCoverage(
    input({
      transactions: [transaction("revenue-1")],
      events: [commercialEvent("commercial-1")],
      commercialDetails: [commercialDetail("commercial-1")],
    }),
  );

  expect(result.status).toBe("PARTIAL");
  expect(result.commercialEventsWithoutFinance).toEqual([
    expect.objectContaining({
      eventId: "commercial-1",
      reason: "MISSING_FINANCE_REFERENCE",
    }),
  ]);
});

it("isolates another farm in transactions, categories and commercial facts", () => {
  const result = selectEconomicCoverage(
    input({
      transactions: [
        transaction("farm-1-revenue"),
        transaction("farm-2-revenue", { fazenda_id: "farm-2" }),
      ],
      categories: [
        category("revenue", "receita"),
        category("revenue", "receita", { fazenda_id: "farm-2" }),
      ],
      events: [
        commercialEvent("farm-1-commercial"),
        {
          ...commercialEvent("farm-2-commercial"),
          fazenda_id: "farm-2",
        },
      ],
      commercialDetails: [
        {
          ...commercialDetail("farm-2-commercial"),
          fazenda_id: "farm-2",
        },
      ],
    }),
  );

  expect(result.observedRevenue.amount).toBe(100);
  expect(result.coverage.farmTransactionCount).toBe(1);
  expect(result.commercialEventsWithoutFinance).toEqual([]);
});

it("excludes paid transactions outside the inclusive farm-timezone period", () => {
  const result = selectEconomicCoverage(
    input({
      period: {
        from: "2026-08-10",
        to: "2026-08-10",
        timezone: "America/Sao_Paulo",
      },
      transactions: [
        transaction("inside", { paid_at: "2026-08-11T02:30:00.000Z" }),
        transaction("outside", { paid_at: "2026-08-11T03:30:00.000Z" }),
      ],
    }),
  );

  expect(result.observedRevenue.amount).toBe(100);
  expect(result.coverage.excludedOutsidePeriod).toBe(1);
});

it("is deterministic for different physical input orders", () => {
  const transactions = [
    transaction("revenue-2", { valor_total: 20 }),
    transaction("revenue-1", { valor_total: 10 }),
  ];
  const first = selectEconomicCoverage(input({ transactions }));
  const second = selectEconomicCoverage(
    input({ transactions: [...transactions].reverse() }),
  );

  expect(second).toEqual(first);
  expect(first.observedRevenue.amount).toBe(30);
});

it("deduplicates identical retries by client_op_id", () => {
  const original = transaction("revenue-1", {
    client_op_id: "same-operation",
  });
  const retry = transaction("revenue-2", {
    client_op_id: "same-operation",
  });
  const result = selectEconomicCoverage(
    input({ transactions: [original, retry] }),
  );

  expect(result.observedRevenue.amount).toBe(100);
  expect(result.coverage.deduplicatedTransactionCount).toBe(1);
});

it.each([Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid economic value %s instead of coercing it",
  (valorTotal) => {
    const result = selectEconomicCoverage(
      input({
        transactions: [transaction("invalid", { valor_total: valorTotal })],
      }),
    );

    expect(result.status).toBe("CONFLICT");
    expect(result.observedRevenue.amount).toBeNull();
    expect(result.conflicts[0].code).toBe("INVALID_TRANSACTION_VALUE");
  },
);

it("marks source coverage gaps without discarding observed facts", () => {
  const result = selectEconomicCoverage(
    input({
      sourceCoverage: {
        ...VERIFIED_SOURCES,
        financeTransactions: "PARTIAL",
      },
      transactions: [transaction("revenue-1")],
    }),
  );

  expect(result.status).toBe("PARTIAL");
  expect(result.observedRevenue.amount).toBe(100);
});
