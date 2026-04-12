import type { ConformidadeEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateConformidadeInput = (
  input: ConformidadeEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (
    input.complianceKind !== "feed_ban" &&
    input.complianceKind !== "checklist"
  ) {
    issues.push({
      code: "INVALID_ENUM",
      field: "complianceKind",
      message: "Tipo de conformidade invalido.",
    });
  }

  return issues;
};
