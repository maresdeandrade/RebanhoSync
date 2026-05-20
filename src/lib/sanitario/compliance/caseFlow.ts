import type { AnimalSanitaryAlertState } from "@/lib/sanitario/compliance/alerts";

export type SanitaryCaseFlowStatus =
  | "case_open"
  | "case_closed"
  | "clinical_followup";

export interface SanitaryCaseFlowSummary {
  status: SanitaryCaseFlowStatus;
  statusLabel: string;
  scopeLabel: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  blocked: boolean;
  openedAt: string | null;
  closedAt: string | null;
}

export function buildSanitaryCaseFlowSummary(input: {
  alert: AnimalSanitaryAlertState | null;
  clinicalFollowupCount?: number;
}): SanitaryCaseFlowSummary | null {
  if (input.alert) {
    const isOpen = input.alert.status === "suspeita_aberta";

    return {
      status: isOpen ? "case_open" : "case_closed",
      statusLabel: isOpen ? "Caso aberto" : "Caso encerrado",
      scopeLabel: input.alert.notificationType
        ? `Notificacao ${input.alert.notificationType}`
        : "Caso sanitario",
      primaryLabel: input.alert.diseaseName ?? "Suspeita sanitaria",
      secondaryLabel: input.alert.routeLabel ?? null,
      blocked: isOpen && input.alert.movementBlocked,
      openedAt: input.alert.openedAt,
      closedAt: input.alert.closedAt,
    };
  }

  const clinicalFollowupCount = input.clinicalFollowupCount ?? 0;
  if (clinicalFollowupCount > 0) {
    return {
      status: "clinical_followup",
      statusLabel: "Acompanhamento clinico",
      scopeLabel: "Caso sanitario futuro",
      primaryLabel: `${clinicalFollowupCount} manejo${
        clinicalFollowupCount === 1 ? "" : "s"
      } clinico${clinicalFollowupCount === 1 ? "" : "s"}`,
      secondaryLabel: "Eventos clinicos sem caso estruturado",
      blocked: false,
      openedAt: null,
      closedAt: null,
    };
  }

  return null;
}
