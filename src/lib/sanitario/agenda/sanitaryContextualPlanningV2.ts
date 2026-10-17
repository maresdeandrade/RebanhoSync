import type { SanitaryProtocolItemV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";

export type SanitaryRuleContextDetailsV2 = {
  regionalCalendar?: { uf: string; months: number[] };
  scheduledContext?: { date: string; animalIds: string[]; reference: string };
  preWeaningBasis?: { kind: "intensive_dairy" | "veterinarian"; reference: string };
};

export function sanitaryRequiresScheduledContextV2(item: SanitaryProtocolItemV2ReadModel) {
  return Boolean(item.eligibilityRule.requires_destination_context || item.eligibilityRule.requires_pregnancy_or_peripartum_context || item.operationalWindowRule.anchor === "parturition");
}

export function sanitaryScheduledDateValidV2(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Adoption is a farm decision; it cannot extend the version's approved calendar.
export function sanitaryContextualPlanningBlockersV2(input: {
  item: SanitaryProtocolItemV2ReadModel;
  context: SanitaryRuleContextDetailsV2;
  farmUf?: string | null;
  animalId: string;
  evaluatedAt: string;
}): string[] {
  const { item, context } = input;
  const metadata = item.snapshotTemplate.metadata as Record<string, unknown> | undefined;
  const ufs = metadata?.assessment_region_ufs;
  if (Array.isArray(ufs) && !ufs.includes(input.farmUf?.toUpperCase()))
    return ["UF fora do escopo regional aprovado para esta avaliação. Selecione uma variante com fonte aplicável."];
  if (item.eligibilityRule.requires_mv_or_management_context && !validPreWeaningBasis(context))
    return ["Pré-desmama exige indicação de sistema intensivo/leiteiro ou orientação veterinária referenciada; não é rotina universal."];
  return [...calendarBlockers(item, context, input.farmUf, input.evaluatedAt),
    ...scheduledBlockers(item, context, input.animalId, input.evaluatedAt)];
}

function validPreWeaningBasis(context: SanitaryRuleContextDetailsV2) {
  return ["intensive_dairy", "veterinarian"].includes(context.preWeaningBasis?.kind) && Boolean(context.preWeaningBasis?.reference?.trim());
}

function calendarBlockers(item: SanitaryProtocolItemV2ReadModel, context: SanitaryRuleContextDetailsV2, farmUf: string | null | undefined, evaluatedAt: string) {
  const months = item.operationalWindowRule.calendar_months;
  if (Array.isArray(months) && months.length) {
    const calendar = context.regionalCalendar;
    if (!calendar || calendar.uf !== farmUf?.toUpperCase())
      return ["Adote explicitamente um calendário regional para a UF da fazenda."];
    if (!calendar.months.includes(Number(evaluatedAt.slice(5, 7))))
      return ["Mês fora do calendário regional adotado pela fazenda."];
    if (calendar.months.some((month) => !months.includes(month)))
      return ["Calendário solicitado excede a janela da versão técnica. Selecione uma variante aprovada."];
  }
  return [];
}

function scheduledBlockers(item: SanitaryProtocolItemV2ReadModel, context: SanitaryRuleContextDetailsV2, animalId: string, evaluatedAt: string) {
  if (sanitaryRequiresScheduledContextV2(item)) {
    const scheduled = context.scheduledContext;
    if (!scheduled || !sanitaryScheduledDateValidV2(scheduled.date) || !scheduled.reference?.trim())
      return ["Informe a data e a referência do manejo/avaliação programada; não é execução."];
    if (!scheduled.animalIds.includes(animalId))
      return ["Animal fora dos alvos explicitamente configurados para este contexto."];
    if (evaluatedAt < scheduled.date)
      return ["A data do manejo/avaliação programada ainda não chegou."];
  }
  return [];
}
