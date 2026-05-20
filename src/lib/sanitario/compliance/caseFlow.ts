import type { AnimalSanitaryAlertState } from "@/lib/sanitario/compliance/alerts";
import type { SanitarioCaso } from "@/lib/offline/types";

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
  caseRecord?: SanitarioCaso | null;
  alert: AnimalSanitaryAlertState | null;
  clinicalFollowupCount?: number;
}): SanitaryCaseFlowSummary | null {
  if (input.caseRecord) {
    const isOpen =
      input.caseRecord.status === "aberto" ||
      input.caseRecord.status === "em_acompanhamento";

    return {
      status: isOpen ? "case_open" : "case_closed",
      statusLabel: isOpen ? "Caso aberto" : "Caso encerrado",
      scopeLabel:
        input.caseRecord.tipo === "notificavel"
          ? (input.caseRecord.notification_type
              ? `Notificacao ${input.caseRecord.notification_type}`
              : "Caso notificavel")
          : "Caso clinico",
      primaryLabel:
        input.caseRecord.disease_name ??
        (input.caseRecord.tipo === "notificavel"
          ? "Suspeita sanitaria"
          : "Manejo clinico"),
      secondaryLabel: input.caseRecord.closure_reason ?? null,
      blocked: isOpen && input.caseRecord.movement_blocked,
      openedAt: input.caseRecord.opened_at,
      closedAt: input.caseRecord.closed_at,
    };
  }

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
