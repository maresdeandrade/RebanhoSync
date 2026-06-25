import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";

const STATUS_LABELS_PT_BR: Record<SanitaryEligibilityStatus, string> = {
  not_applicable: "Não aplicável",
  insufficient_data: "Dados insuficientes",
  not_yet_eligible: "Ainda não elegível",
  eligible_soon: "Elegível em breve",
  in_action_window: "Em janela",
  near_deadline: "Próximo do limite",
  overdue: "Atrasado",
  completed: "Concluído",
};

export function formatSanitaryPrecheckStatusV2(
  status: SanitaryEligibilityStatus,
) {
  return STATUS_LABELS_PT_BR[status];
}
