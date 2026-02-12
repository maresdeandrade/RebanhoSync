import type { NutricaoEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateNutricaoInput = (
  input: NutricaoEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.alimentoNome?.trim()) {
    issues.push({
      code: "REQUIRED",
      field: "alimentoNome",
      message: "Alimento obrigatorio.",
    });
  }

  if (!Number.isFinite(input.quantidadeKg) || input.quantidadeKg <= 0) {
    issues.push({
      code: "INVALID_RANGE",
      field: "quantidadeKg",
      message: "Quantidade deve ser maior que zero.",
    });
  }

  return issues;
};

