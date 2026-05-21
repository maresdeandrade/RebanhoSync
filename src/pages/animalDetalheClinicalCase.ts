import type { SanitarioCaso } from "@/lib/offline/types";

export type ClinicalCaseClosureReason =
  | "resolvido"
  | "evoluiu_para_notificavel"
  | "sem_resposta"
  | "outro";

export type ClinicalCaseClosureOption = {
  value: ClinicalCaseClosureReason;
  label: string;
  requiresNotes: boolean;
  helper: string;
};

export const CLINICAL_CASE_CLOSURE_REASONS: ClinicalCaseClosureOption[] = [
  {
    value: "resolvido",
    label: "Resolvido clinicamente",
    requiresNotes: false,
    helper: "Use quando o animal respondeu ao manejo e nao exige seguimento.",
  },
  {
    value: "evoluiu_para_notificavel",
    label: "Evoluiu para suspeita notificavel",
    requiresNotes: true,
    helper: "Informe sinais, orientacao e rota de notificacao antes de encerrar.",
  },
  {
    value: "sem_resposta",
    label: "Sem resposta ao manejo",
    requiresNotes: true,
    helper: "Informe a resposta observada e a orientacao operacional adotada.",
  },
  {
    value: "outro",
    label: "Outro desfecho",
    requiresNotes: true,
    helper: "Descreva o desfecho para manter rastreabilidade do caso.",
  },
];

export function isOpenSanitaryCase(value: Pick<SanitarioCaso, "status">) {
  return value.status === "aberto" || value.status === "em_acompanhamento";
}

export function getClinicalCaseClosureReason(value: ClinicalCaseClosureReason) {
  return (
    CLINICAL_CASE_CLOSURE_REASONS.find((option) => option.value === value) ??
    CLINICAL_CASE_CLOSURE_REASONS[0]
  );
}

export function validateClinicalCaseClosureInput({
  caseRecord,
  reason,
  notes,
}: {
  caseRecord: SanitarioCaso | null | undefined;
  reason: ClinicalCaseClosureReason;
  notes: string;
}) {
  if (!caseRecord) {
    return "Caso clinico nao encontrado para encerramento.";
  }

  if (caseRecord.tipo !== "clinico") {
    return "Apenas casos clinicos podem ser encerrados por este fluxo.";
  }

  if (!isOpenSanitaryCase(caseRecord)) {
    return "Este caso clinico ja esta encerrado ou indisponivel.";
  }

  const selectedReason = getClinicalCaseClosureReason(reason);
  const trimmedNotes = notes.trim();

  if (selectedReason.requiresNotes && trimmedNotes.length < 10) {
    return "Informe observacoes de encerramento com pelo menos 10 caracteres.";
  }

  if (trimmedNotes.length > 1000) {
    return "As observacoes de encerramento devem ter no maximo 1000 caracteres.";
  }

  return null;
}
