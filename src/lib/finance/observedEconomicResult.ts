import type { EconomicCoverageResult } from "./economicCoverage";

export type ObservedEconomicResultReason =
  | "CONFLICT"
  | "INSUFFICIENT_COVERAGE"
  | "REVENUE_UNAVAILABLE"
  | "COST_UNAVAILABLE"
  | "INVALID_NUMERIC_INPUT"
  | "NON_FINITE_RESULT";

interface ObservedEconomicResultContext {
  /** Original F22B.1 evidence, including tenant, period, gaps and conflicts. */
  coverage: Readonly<EconomicCoverageResult>;
  limitations: readonly string[];
  interpretation: "OBSERVED_SCOPE_ONLY";
  completeAccounting: false;
  profit: "NOT_DEMONSTRATED";
}

export type ObservedEconomicResult = ObservedEconomicResultContext &
  (
    | {
        status: "CALCULATED";
        observedRevenue: number;
        observedCost: number;
        observedResult: number;
      }
    | {
        status: "NOT_CALCULATED";
        reason: ObservedEconomicResultReason;
      }
  );

/** Derives only the observed difference; never reclassifies ledger evidence. */
export function calculateObservedEconomicResult(
  coverage: Readonly<EconomicCoverageResult>,
): ObservedEconomicResult {
  const context: ObservedEconomicResultContext = {
    coverage,
    limitations: coverage.limitations,
    interpretation: "OBSERVED_SCOPE_ONLY",
    completeAccounting: false,
    profit: "NOT_DEMONSTRATED",
  };
  const blocked = (
    reason: ObservedEconomicResultReason,
  ): ObservedEconomicResult => ({
    ...context,
    status: "NOT_CALCULATED",
    reason,
  });

  if (coverage.status === "CONFLICT" || coverage.conflicts.length > 0) {
    return blocked("CONFLICT");
  }
  if (coverage.status === "INSUFFICIENT_COVERAGE") {
    return blocked("INSUFFICIENT_COVERAGE");
  }
  const revenue = coverage.observedRevenue.amount;
  const cost = coverage.observedCosts.amount;
  if (revenue === null) return blocked("REVENUE_UNAVAILABLE");
  if (cost === null) return blocked("COST_UNAVAILABLE");
  if (!Number.isFinite(revenue) || !Number.isFinite(cost)) {
    return blocked("INVALID_NUMERIC_INPUT");
  }
  const observedResult = revenue - cost;
  if (!Number.isFinite(observedResult)) return blocked("NON_FINITE_RESULT");
  return {
    ...context,
    status: "CALCULATED",
    observedRevenue: revenue,
    observedCost: cost,
    observedResult,
  };
}
