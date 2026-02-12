import type { FinanceiroEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateFinanceiroInput = (
  input: FinanceiroEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.tipo) {
    issues.push({
      code: "REQUIRED",
      field: "tipo",
      message: "Tipo financeiro obrigatorio.",
    });
  }

  if (!Number.isFinite(input.valorTotal) || input.valorTotal <= 0) {
    issues.push({
      code: "INVALID_RANGE",
      field: "valorTotal",
      message: "Valor total deve ser maior que zero.",
    });
  }

  return issues;
};

