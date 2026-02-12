import type { EventInput } from "../types";
import {
  EventValidationError,
  type EventValidationIssue,
  validateBaseEventInput,
} from "./common";
import { validateFinanceiroInput } from "./financeiro";
import { validateMovimentacaoInput } from "./movimentacao";
import { validateNutricaoInput } from "./nutricao";
import { validatePesagemInput } from "./pesagem";
import { validateSanitarioInput } from "./sanitario";

export const validateEventInput = (input: EventInput): EventValidationIssue[] => {
  const issues = [...validateBaseEventInput(input)];

  if (input.dominio === "sanitario") {
    issues.push(...validateSanitarioInput(input));
  } else if (input.dominio === "pesagem") {
    issues.push(...validatePesagemInput(input));
  } else if (input.dominio === "movimentacao") {
    issues.push(...validateMovimentacaoInput(input));
  } else if (input.dominio === "nutricao") {
    issues.push(...validateNutricaoInput(input));
  } else if (input.dominio === "financeiro") {
    issues.push(...validateFinanceiroInput(input));
  }

  return issues;
};

export {
  EventValidationError,
  type EventValidationIssue,
} from "./common";

export const assertValidEventInput = (input: EventInput): void => {
  const issues = validateEventInput(input);
  if (issues.length > 0) {
    throw new EventValidationError(issues);
  }
};

