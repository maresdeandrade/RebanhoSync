import type { SanitaryProtocolItemDomain } from "./domain";

export function validateSanitaryItemDomain(
  item: SanitaryProtocolItemDomain,
): string[] {
  const errors: string[] = [];
  const { schedule } = item;

  if (schedule.mode === "campanha") {
    if (!schedule.generatesAgenda) {
      errors.push("Campanha deve gerar agenda.");
    }
    if (!schedule.campaignMonths || schedule.campaignMonths.length === 0) {
      errors.push("Campanha exige ao menos um mês.");
    }
  }

  if (schedule.mode === "janela_etaria") {
    if (!["nascimento", "entrada_fazenda"].includes(schedule.anchor)) {
      errors.push("Janela etária exige âncora de nascimento ou entrada_fazenda.");
    }
    if (schedule.ageStartDays == null) {
      errors.push("Janela etária exige idade mínima.");
    }
    if (
      schedule.ageStartDays != null &&
      schedule.ageEndDays != null &&
      schedule.ageEndDays < schedule.ageStartDays
    ) {
      errors.push("Idade máxima não pode ser menor que idade mínima.");
    }
  }

  if (schedule.mode === "rotina_recorrente") {
    if (schedule.intervalDays == null || schedule.intervalDays <= 0) {
      errors.push("Rotina recorrente exige intervalo maior que zero.");
    }
    if (
      ![
        "conclusao_etapa_dependente",
        "ultima_conclusao_mesma_familia",
        "entrada_fazenda",
      ].includes(schedule.anchor)
    ) {
      errors.push("Rotina recorrente exige âncora compatível.");
    }
  }

  if (schedule.mode === "procedimento_imediato") {
    if (schedule.generatesAgenda) {
      errors.push("Procedimento imediato não deve gerar agenda recorrente.");
    }
  }

  if (
    schedule.mode !== "procedimento_imediato" &&
    schedule.mode !== "nao_estruturado" &&
    schedule.anchor === "sem_ancora"
  ) {
    errors.push("Sem âncora só é permitido para legado ou procedimento imediato.");
  }

  return errors;
}
