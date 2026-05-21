import type { SanitarioEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateSanitarioInput = (
  input: SanitarioEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.tipo) {
    issues.push({
      code: "REQUIRED",
      field: "tipo",
      message: "Tipo sanitario obrigatorio.",
    });
  }

  if (!input.produto?.trim()) {
    issues.push({
      code: "REQUIRED",
      field: "produto",
      message: "Produto sanitario obrigatorio.",
    });
  }

  if (input.protocoloItem) {
    if (!input.protocoloItem.id) {
      issues.push({
        code: "REQUIRED",
        field: "protocoloItem.id",
        message: "Item de protocolo invalido.",
      });
    }

    if (input.protocoloItem.intervalDays <= 0) {
      issues.push({
        code: "INVALID_RANGE",
        field: "protocoloItem.intervalDays",
        message: "Intervalo do protocolo deve ser maior que zero.",
      });
    }
  }

  if (input.sanitarioCaso) {
    if (input.sanitarioCaso.action === "link" && !input.sanitarioCaso.id) {
      issues.push({
        code: "REQUIRED",
        field: "sanitarioCaso.id",
        message: "Caso sanitario invalido.",
      });
    }

    if (!input.animalId) {
      issues.push({
        code: "REQUIRED",
        field: "animalId",
        message: "Caso sanitario exige um animal vinculado.",
      });
    }

    if (
      input.sanitarioCaso.action === "open" &&
      input.sanitarioCaso.tipo !== "clinico"
    ) {
      issues.push({
        code: "INVALID_ENUM",
        field: "sanitarioCaso.tipo",
        message: "Registro sanitario operacional so pode abrir caso clinico.",
      });
    }
  }

  return issues;
};
