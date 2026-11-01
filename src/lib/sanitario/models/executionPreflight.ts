export type SanitaryExecutionPreflightSeverity = "block" | "warn";

export type SanitaryExecutionPreflightReason =
  | "not_sanitary"
  | "missing_agenda_task"
  | "missing_type"
  | "missing_product"
  | "protocol_ineligible"
  | "movement_blocked"
  | "transit_checklist"
  | "compliance_block";

export type SanitaryExecutionPreflightResult =
  | { ok: true; status: "ready" | "skip"; warnings?: string[] }
  | {
      ok: false;
      reason: SanitaryExecutionPreflightReason;
      message: string;
      severity?: SanitaryExecutionPreflightSeverity;
    };

export type SanitaryExecutionPreflightInput = {
  registrationMode?: "executed_fact";
  tipoManejo: string | null | undefined;
  sourceTaskId?: string | null;
  sanitaryType?: string | null;
  sanitaryProductName?: string | null;
  sanitaryProductMetadata?: Record<string, unknown> | null;
  requireAgendaTask?: boolean;
  requireSanitaryType?: boolean;
  requireProduct?: boolean;
  protocolEligibilityIssues?: readonly string[];
  sanitaryMovementBlockIssues?: readonly string[];
  transitChecklistIssues?: readonly string[];
  complianceFlowIssues?: readonly string[];
  issueScope?: "sanitary_only" | "all_flows";
};

const firstIssue = (
  issues: readonly string[] | undefined,
  fallback: string,
) => issues?.[0] ?? fallback;

function validateRequiredSanitaryStructure(input: SanitaryExecutionPreflightInput): SanitaryExecutionPreflightResult | undefined {
  if (input.requireAgendaTask && !input.sourceTaskId) {
    return {
      ok: false,
      reason: "missing_agenda_task",
      message: "Item de agenda sanitario ausente.",
      severity: "block",
    };
  }

  if (input.requireSanitaryType && !input.sanitaryType) {
    return {
      ok: false,
      reason: "missing_type",
      message: "Tipo sanitario invalido.",
      severity: "block",
    };
  }

  if (
    input.requireProduct &&
    !input.sanitaryProductName?.trim()
  ) {
    return {
      ok: false,
      reason: "missing_product",
      message: "Informe o produto sanitario antes de confirmar.",
      severity: "block",
    };
  }

  return undefined;
}

export function validateSanitaryExecutionPreflight(
  input: SanitaryExecutionPreflightInput,
): SanitaryExecutionPreflightResult {
  const isSanitary = input.tipoManejo === "sanitario";

  if (!isSanitary && input.issueScope !== "all_flows" && input.registrationMode !== "executed_fact") {
    return { ok: true, status: "skip" };
  }

  if (isSanitary) {
    const structuralIssue = validateRequiredSanitaryStructure(input);
    if (structuralIssue) return structuralIssue;
  }

  // This is an explicit factual caller, not approval for a future execution.
  // Required structure above remains mandatory; eligibility is assessed separately.
  if (input.registrationMode === "executed_fact") {
    const warnings = [...new Set([
      ...(input.protocolEligibilityIssues ?? []),
      ...(input.sanitaryMovementBlockIssues ?? []),
      ...(input.transitChecklistIssues ?? []),
      ...(input.complianceFlowIssues ?? []),
    ])];
    return { ok: true, status: isSanitary ? "ready" : "skip", ...(warnings.length ? { warnings } : {}) };
  }

  if (isSanitary && (input.protocolEligibilityIssues?.length ?? 0) > 0) {
    return {
      ok: false,
      reason: "protocol_ineligible",
      message: firstIssue(
        input.protocolEligibilityIssues,
        "O item de protocolo escolhido nao atende todos os animais selecionados.",
      ),
      severity: "block",
    };
  }

  if ((input.sanitaryMovementBlockIssues?.length ?? 0) > 0) {
    return {
      ok: false,
      reason: "movement_blocked",
      message: firstIssue(
        input.sanitaryMovementBlockIssues,
        "Bloqueio sanitario em aberto.",
      ),
      severity: "block",
    };
  }

  if ((input.transitChecklistIssues?.length ?? 0) > 0) {
    return {
      ok: false,
      reason: "transit_checklist",
      message: firstIssue(
        input.transitChecklistIssues,
        "Checklist de transito incompleto.",
      ),
      severity: "block",
    };
  }

  if ((input.complianceFlowIssues?.length ?? 0) > 0) {
    return {
      ok: false,
      reason: "compliance_block",
      message: firstIssue(
        input.complianceFlowIssues,
        "Bloqueio regulatorio em aberto.",
      ),
      severity: "block",
    };
  }

  return { ok: true, status: isSanitary ? "ready" : "skip" };
}
