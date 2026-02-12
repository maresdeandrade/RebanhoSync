import type { BaseEventInput } from "../types";

export interface EventValidationIssue {
  code: string;
  field: string;
  message: string;
}

export class EventValidationError extends Error {
  issues: EventValidationIssue[];

  constructor(issues: EventValidationIssue[]) {
    super(issues[0]?.message ?? "Invalid event input.");
    this.name = "EventValidationError";
    this.issues = issues;
  }
}

export const parseDateSafe = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const validateBaseEventInput = (
  input: BaseEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.fazendaId) {
    issues.push({
      code: "REQUIRED",
      field: "fazendaId",
      message: "Fazenda obrigatoria.",
    });
  }

  if (!input.animalId && !input.loteId) {
    issues.push({
      code: "REQUIRED_TARGET",
      field: "animalId|loteId",
      message: "Selecione um animal ou lote para o evento.",
    });
  }

  if (input.occurredAt) {
    const occurredAt = parseDateSafe(input.occurredAt);
    if (!occurredAt) {
      issues.push({
        code: "INVALID_DATETIME",
        field: "occurredAt",
        message: "Data/hora do evento invalida.",
      });
    } else {
      const allowedFutureMs = 5 * 60 * 1000;
      const now = Date.now();
      if (occurredAt.getTime() - now > allowedFutureMs) {
        issues.push({
          code: "FUTURE_DATETIME",
          field: "occurredAt",
          message: "Data/hora do evento nao pode estar no futuro.",
        });
      }
    }
  }

  return issues;
};

