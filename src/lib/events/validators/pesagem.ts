import type { PesagemEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validatePesagemInput = (
  input: PesagemEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!Number.isFinite(input.pesoKg) || input.pesoKg <= 0) {
    issues.push({
      code: "INVALID_RANGE",
      field: "pesoKg",
      message: "Peso deve ser maior que zero.",
    });
  }

  return issues;
};

