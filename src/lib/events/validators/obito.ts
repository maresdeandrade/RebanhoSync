import type { ObitoEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateObitoInput = (
  input: ObitoEventInput
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.animalId) {
    issues.push({
      code: "REQUIRED",
      field: "animalId",
      message: "Selecione um animal para o registro de óbito.",
    });
  }

  // causa is requested as enum: 'doenca', 'acidente', 'predador', 'outro'
  if (input.causa && !["doenca", "acidente", "predador", "outro"].includes(input.causa)) {
    issues.push({
      code: "INVALID_CAUSE",
      field: "causa",
      message: "Causa do óbito inválida.",
    });
  }

  return issues;
};
