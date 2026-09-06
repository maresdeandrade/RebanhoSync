import { expect, it } from "vitest";
import {
  selectEconomicCoverage,
  type EconomicCoverageResult,
} from "../economicCoverage";
import { calculateObservedEconomicResult } from "../observedEconomicResult";
import type { FinanceCategory, FinanceTransaction } from "@/lib/offline/types";

const metadata = {
  fazenda_id: "farm-1",
  client_id: "client-1",
  client_tx_id: null,
  client_recorded_at: "2026-09-01T12:00:00Z",
  server_received_at: "2026-09-01T12:00:00Z",
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
  deleted_at: null,
};

function transaction(
  id: string,
  cost: boolean,
  amount: number,
): FinanceTransaction {
  return {
    ...metadata,
    id,
    client_op_id: id,
    occurred_at: "2026-09-01T12:00:00Z",
    competence_date: null,
    due_date: null,
    paid_at: "2026-09-01T12:00:00Z",
    direction: cost ? "saida" : "entrada",
    status: "realizado",
    category_id: cost ? "cost" : "revenue",
    valor_total: amount,
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
  };
}

function coverage(
  transactions = [transaction("r", false, 1000), transaction("c", true, 600)],
) {
  const categories: FinanceCategory[] = [false, true].map((cost) => ({
    ...metadata,
    id: cost ? "cost" : "revenue",
    client_op_id: cost ? "cat-c" : "cat-r",
    nome: "category",
    tipo: cost ? "custo_variavel" : "receita",
    grupo: cost ? "compra_animais" : "venda_animais",
    slug: cost ? "cost" : "revenue",
    is_default: false,
    ativo: true,
    observacoes: null,
  }));
  return selectEconomicCoverage({
    fazendaId: "farm-1",
    period: { from: "2026-09-01", to: "2026-09-30", timezone: "UTC" },
    sourceCoverage: {
      financeTransactions: "VERIFIED",
      financeCategories: "VERIFIED",
      commercialOperations: "VERIFIED",
    },
    transactions,
    categories,
    events: [],
    commercialDetails: [],
  });
}

it.each([
  [1000, 600, 400],
  [600, 1000, -400],
  [1000, 1000, 0],
])(
  "derives %s minus %s as %s through canonical coverage",
  (revenue, cost, expected) => {
    const result = calculateObservedEconomicResult(
      coverage([
        transaction("r", false, revenue),
        transaction("c", true, cost),
      ]),
    );
    expect(result).toMatchObject({
      status: "CALCULATED",
      observedResult: expected,
      interpretation: "OBSERVED_SCOPE_ONLY",
      completeAccounting: false,
      profit: "NOT_DEMONSTRATED",
    });
  },
);

it("preserves factual zero from a full cost reversal, without double counting", () => {
  const original = transaction("c", true, 600);
  const source = coverage([
    transaction("r", false, 1000),
    original,
    {
      ...original,
      id: "reversal",
      client_op_id: "reversal",
      direction: "entrada",
      origem: "estorno",
      reverses_transaction_id: original.id,
    },
  ]);
  expect(source.observedCosts.amount).toBe(0);
  expect(calculateObservedEconomicResult(source)).toMatchObject({
    status: "CALCULATED",
    observedCost: 0,
    observedResult: 1000,
  });
});

it.each([
  [false, "COST_UNAVAILABLE"],
  [true, "REVENUE_UNAVAILABLE"],
] as const)(
  "does not substitute zero for a missing side (%s)",
  (cost, reason) => {
    const result = calculateObservedEconomicResult(
      coverage([transaction("only", cost, 100)]),
    );
    expect(result).toMatchObject({ status: "NOT_CALCULATED", reason });
    expect(result).not.toHaveProperty("observedResult");
  },
);

it("keeps partial coverage, limitations and commercial gaps attached", () => {
  const source = coverage();
  source.status = "PARTIAL";
  source.coverage.sources.commercialOperations = "PARTIAL";
  source.limitations.push("Commercial coverage is incomplete.");
  source.commercialEventsWithoutFinance.push({
    eventId: "sale",
    operationType: "venda",
    occurredAt: "2026-09-01T12:00:00Z",
    financeTransactionId: null,
    reason: "MISSING_FINANCE_REFERENCE",
  });
  const result = calculateObservedEconomicResult(source);
  expect(result).toMatchObject({
    status: "CALCULATED",
    observedResult: 400,
    coverage: { status: "PARTIAL" },
  });
  expect(result.coverage).toBe(source);
  expect(result.limitations).toEqual(source.limitations);
  expect(result.coverage.commercialEventsWithoutFinance).toHaveLength(1);
});

it.each(["CONFLICT", "INSUFFICIENT_COVERAGE"] as const)(
  "blocks %s even if numbers are present",
  (status) => {
    const result = calculateObservedEconomicResult({ ...coverage(), status });
    expect(result).toMatchObject({ status: "NOT_CALCULATED", reason: status });
    expect(result).not.toHaveProperty("observedResult");
  },
);

it("also blocks explicit conflict evidence without relying on status alone", () => {
  const source = coverage();
  source.conflicts.push({
    code: "INVALID_TRANSACTION_VALUE",
    recordIds: ["bad"],
    description: "Invalid value",
  });
  expect(calculateObservedEconomicResult(source)).toMatchObject({
    status: "NOT_CALCULATED",
    reason: "CONFLICT",
  });
});

it.each([NaN, Infinity, -Infinity])(
  "rejects non-finite input %s on either side",
  (amount) => {
    for (const key of ["observedRevenue", "observedCosts"] as const) {
      const source = coverage();
      source[key].amount = amount;
      const result = calculateObservedEconomicResult(source);
      expect(result).toMatchObject({
        status: "NOT_CALCULATED",
        reason: "INVALID_NUMERIC_INPUT",
      });
      expect(result).not.toHaveProperty("observedResult");
    }
  },
);

it("blocks numeric overflow and does not round finite differences", () => {
  const source = coverage();
  source.observedRevenue.amount = Number.MAX_VALUE;
  source.observedCosts.amount = -Number.MAX_VALUE;
  expect(calculateObservedEconomicResult(source)).toMatchObject({
    status: "NOT_CALCULATED",
    reason: "NON_FINITE_RESULT",
  });
  source.observedRevenue.amount = 0.3;
  source.observedCosts.amount = 0.1;
  expect(calculateObservedEconomicResult(source)).toMatchObject({
    status: "CALCULATED",
    observedResult: 0.3 - 0.1,
  });
});

function deepFreeze(value: object): void {
  Object.values(value).forEach((child: unknown) => {
    if (child !== null && typeof child === "object") deepFreeze(child);
  });
  Object.freeze(value);
}

it("never mutates the canonical coverage, for calculated or blocked output", () => {
  for (const source of [
    coverage(),
    coverage([]),
  ] satisfies EconomicCoverageResult[]) {
    const before = structuredClone(source);
    deepFreeze(source);
    expect(() => calculateObservedEconomicResult(source)).not.toThrow();
    expect(source).toEqual(before);
  }
});
