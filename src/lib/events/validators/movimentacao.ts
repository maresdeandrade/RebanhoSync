import type { MovimentacaoEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateMovimentacaoInput = (
  input: MovimentacaoEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.allowDestinationNull && !input.toLoteId && !input.toPastoId) {
    issues.push({
      code: "REQUIRED_DESTINATION",
      field: "toLoteId|toPastoId",
      message: "Destino de movimentacao obrigatorio.",
    });
  }

  if (
    input.fromLoteId &&
    input.toLoteId &&
    input.fromLoteId === input.toLoteId
  ) {
    issues.push({
      code: "INVALID_DESTINATION",
      field: "toLoteId",
      message: "Lote de destino deve ser diferente do lote de origem.",
    });
  }

  if (
    input.fromPastoId &&
    input.toPastoId &&
    input.fromPastoId === input.toPastoId
  ) {
    issues.push({
      code: "INVALID_DESTINATION",
      field: "toPastoId",
      message: "Pasto de destino deve ser diferente do pasto de origem.",
    });
  }

  return issues;
};
