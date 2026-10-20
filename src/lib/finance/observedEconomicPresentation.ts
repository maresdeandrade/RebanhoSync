import type { EconomicCoverageStatus } from "./economicCoverage";
import type {
  ObservedEconomicResult,
  ObservedEconomicResultReason,
} from "./observedEconomicResult";

const COVERAGE_TEXT: Record<EconomicCoverageStatus, string> = {
  AVAILABLE: "Cobertura disponível para os registros observados.",
  PARTIAL: "Cobertura parcial dos registros observados.",
  INSUFFICIENT_COVERAGE: "Cobertura insuficiente para calcular o resultado.",
  CONFLICT: "Conflito factual nos registros; o cálculo está bloqueado.",
};

const REASON_TEXT: Record<ObservedEconomicResultReason, string> = {
  CONFLICT: COVERAGE_TEXT.CONFLICT,
  INSUFFICIENT_COVERAGE: COVERAGE_TEXT.INSUFFICIENT_COVERAGE,
  REVENUE_UNAVAILABLE: "Receita observada indisponível para este cálculo.",
  COST_UNAVAILABLE: "Custo observado indisponível para este cálculo.",
  INVALID_NUMERIC_INPUT:
    "Há valores numéricos inválidos nos registros; o cálculo está bloqueado.",
  NON_FINITE_RESULT:
    "O resultado excede os limites numéricos suportados; o cálculo está bloqueado.",
};

/** Texto humano apenas; não modifica o resultado nem os valores canônicos do CSV. */
export function describeObservedEconomicResult(
  result: ObservedEconomicResult | null | undefined,
): string {
  const statusText = !result
    ? "Resultado indisponível: não há dados disponíveis para avaliação."
    : result.status === "CALCULATED"
      ? `Resultado calculado. ${COVERAGE_TEXT[result.coverage.status]}`
      : `Resultado não calculado. ${REASON_TEXT[result.reason]}`;
  const limitations = result?.limitations
    .map((text) =>
      text
        .replaceAll("Coverage", "Cobertura")
        .replaceAll("coverage", "cobertura")
        .replaceAll("bucket", "grupo de valores"),
    )
    .join(" ");
  return [
    statusText,
    "Os valores se limitam aos registros observados e não comprovam contabilidade completa nem lucro.",
    "Ausência de informação não equivale a R$ 0. Não é DRE, ROI ou margem.",
    limitations ? `Limitações: ${limitations}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
