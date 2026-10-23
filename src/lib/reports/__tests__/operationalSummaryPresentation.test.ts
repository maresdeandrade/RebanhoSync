import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  selectEconomicCoverage,
  type EconomicCoverageStatus,
} from "@/lib/finance/economicCoverage";
import { calculateObservedEconomicResult } from "@/lib/finance/observedEconomicResult";
import type { FinanceCategory, FinanceTransaction } from "@/lib/offline/types";
import {
  buildOperationalSummary,
  buildOperationalSummaryCsv,
  buildOperationalSummaryPrintHtml,
  resolveReportRange,
} from "../operationalSummary";

const date = new Date("2026-09-20T12:00:00Z");
// SHA-256 calculados com o serializador de main@35d5b39 e horário fixo da fixture.
const BASELINE_CSV_HASHES = {
  AVAILABLE: "029016fa4347b343c9804230908860eabc41236b5c72dd443effccd0a3244197",
  PARTIAL: "a25df6e966a7aa94c8b105a8e4d3cfa046fce0cf894facc69c9bedde92baa29d",
  INSUFFICIENT_COVERAGE:
    "b241c5f7d49c20670fee9baabec89562b5bf44de364d2808830f51a2227ad74e",
  CONFLICT: "291d349021402afdbab5221e083ddf185af63d0edbe1e190d7928d5433922508",
};
const period = { from: "2026-09-01", to: "2026-09-30", timezone: "UTC" };
const metadata = {
  fazenda_id: "farm-1",
  client_id: "fixture",
  client_tx_id: null,
  client_recorded_at: date.toISOString(),
  server_received_at: date.toISOString(),
  created_at: date.toISOString(),
  updated_at: date.toISOString(),
  deleted_at: null,
};
function transaction(
  id: string,
  cost: boolean,
  value: number,
): FinanceTransaction {
  return {
    ...metadata,
    id,
    client_op_id: id,
    occurred_at: date.toISOString(),
    competence_date: null,
    due_date: null,
    paid_at: date.toISOString(),
    direction: cost ? "saida" : "entrada",
    status: "realizado",
    category_id: cost ? "cost" : "revenue",
    valor_total: value,
    quantidade: null,
    valor_unitario: null,
    descricao: null,
    observacoes: null,
    contraparte_id: null,
    centro_custo_tipo: "fazenda",
    centro_custo_id: null,
    evento_id: null,
    documento_ref: null,
    payload: {},
    reverses_transaction_id: null,
  } as FinanceTransaction;
}
const categories = [false, true].map((cost) => ({
  ...metadata,
  id: cost ? "cost" : "revenue",
  client_op_id: cost ? "cat-c" : "cat-r",
  nome: "Categoria",
  tipo: cost ? "custo_variavel" : "receita",
  grupo: cost ? "compra_animais" : "venda_animais",
  slug: cost ? "cost" : "revenue",
  is_default: false,
  ativo: true,
  observacoes: null,
})) as FinanceCategory[];

function reportWithCoverage(status: EconomicCoverageStatus) {
  const transactions =
    status === "INSUFFICIENT_COVERAGE"
      ? []
      : [
          transaction("r", false, 1000),
          transaction("c", true, 600),
          ...(status === "CONFLICT" ? [transaction("r", false, 2000)] : []),
        ];
  const coverage = selectEconomicCoverage({
    fazendaId: "farm-1",
    period,
    transactions,
    categories,
    events: [],
    commercialDetails: [],
    sourceCoverage: {
      financeTransactions: status === "PARTIAL" ? "PARTIAL" : "VERIFIED",
      financeCategories: "VERIFIED",
      commercialOperations: "VERIFIED",
    },
  });
  expect(coverage.status).toBe(status);
  const result = calculateObservedEconomicResult(coverage);
  const base = buildOperationalSummary(
    {
      fazendaId: "farm-1",
      animals: [],
      lotes: [],
      pastos: [],
      agenda: [],
      eventos: [],
      eventosPesagem: [],
      eventosFinanceiro: [],
      gestures: [],
      rejections: [],
      farmTimezone: "UTC",
    },
    resolveReportRange("30d", date, "UTC"),
    date,
  );
  return {
    ...base,
    generatedAt: date.toISOString(),
    financeiro: {
      ...base.financeiro,
      observedEconomicResult: result,
      entradas: result.status === "CALCULATED" ? result.observedRevenue : null,
      saidas: result.status === "CALCULATED" ? result.observedCost : null,
      saldo: result.status === "CALCULATED" ? result.observedResult : null,
    },
  };
}

describe("UX14 — HTML humano e CSV canonico", () => {
  it.each([
    "AVAILABLE",
    "PARTIAL",
    "INSUFFICIENT_COVERAGE",
    "CONFLICT",
  ] as const)(
    "apresenta %s em portugues, preservando numeros e CSV",
    (status) => {
      const report = reportWithCoverage(status);
      const canonical = JSON.stringify(report);
      const csv = buildOperationalSummaryCsv(report, "Fazenda UX14");
      // Contract 04 adds exactly one zero-count pasture row to these empty fixtures.
      // Preserve the old hash for every other byte instead of replacing golden hashes.
      const pastureRow = "manejo;Pastagem;0";
      const csvLines = csv.split("\r\n");
      expect(csvLines.filter((line) => line === pastureRow)).toEqual([pastureRow]);
      const csvBeforePasture = csvLines
        .filter((line) => line !== pastureRow)
        .join("\r\n");
      expect(createHash("sha256").update(csvBeforePasture).digest("hex")).toBe(
        BASELINE_CSV_HASHES[status],
      );
      const html = buildOperationalSummaryPrintHtml(report, "Fazenda UX14");
      expect(csv).toContain(`financeiro_observado;coverage;${status}`);
      expect(csv).toContain(
        "financeiro_observado;interpretation;OBSERVED_SCOPE_ONLY",
      );
      expect(csv).toContain("financeiro_observado;completeAccounting;false");
      expect(csv).toContain("financeiro_observado;profit;NOT_DEMONSTRATED");
      expect(html).not.toMatch(
        /INSUFFICIENT_COVERAGE|OBSERVED_SCOPE_ONLY|completeAccounting|NOT_DEMONSTRATED|coverage:|Status: (NOT_CALCULATED|CALCULATED)/i,
      );
      expect(html).toContain("não comprovam contabilidade completa nem lucro");
      expect(html).toContain("Ausência de informação não equivale a R$ 0");
      if (status === "AVAILABLE" || status === "PARTIAL") {
        expect(report.financeiro.saldo).toBe(400);
        expect(csv).toContain(
          "financeiro_observado;resultado_observado;400.00",
        );
        expect(html).toContain("400,00");
        expect(html).toContain(
          status === "AVAILABLE" ? "Cobertura disponível" : "Cobertura parcial",
        );
      } else {
        expect(report.financeiro.saldo).toBeNull();
        expect(html).toContain(
          status === "CONFLICT" ? "Conflito factual" : "Cobertura insuficiente",
        );
      }
      expect(JSON.stringify(report)).toBe(canonical);
      expect(buildOperationalSummaryCsv(report, "Fazenda UX14")).toBe(csv);
    },
  );
});
