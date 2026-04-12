import type { AlertaSanitarioEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateAlertaSanitarioInput = (
  input: AlertaSanitarioEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.animalId) {
    issues.push({
      code: "REQUIRED",
      field: "animalId",
      message: "Alerta sanitario exige um animal vinculado.",
    });
  }

  if (
    input.alertKind !== "suspeita_aberta" &&
    input.alertKind !== "suspeita_encerrada"
  ) {
    issues.push({
      code: "INVALID_ENUM",
      field: "alertKind",
      message: "Tipo de alerta sanitario invalido.",
    });
  }

  if (
    !input.animalPayload ||
    typeof input.animalPayload !== "object" ||
    Array.isArray(input.animalPayload)
  ) {
    issues.push({
      code: "REQUIRED",
      field: "animalPayload",
      message: "Atualizacao do estado sanitario do animal obrigatoria.",
    });
  }

  return issues;
};
