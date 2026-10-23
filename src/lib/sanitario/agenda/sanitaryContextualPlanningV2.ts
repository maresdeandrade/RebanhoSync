import type { SanitaryProtocolItemV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";

export type SanitaryRuleContextDetailsV2 = {
  regionalCalendar?: { uf: string; months: number[] };
  scheduledContext?: { date: string; animalIds: string[]; reference: string };
  preWeaningBasis?: { kind: "intensive_dairy" | "veterinarian"; reference: string };
  maternalVaccinationsByAnimalId?: Record<string, { status: "vaccinated" | "unvaccinated"; evidenceReference: string }>;
  rabiesTechnicalAssessment?: { confirmed: boolean; responsibleReference: string };
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
  fazendaId?: string;
  animalBirthDate?: string | null;
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
  return [...rabiesTechnicalBlockers(input), ...calendarBlockers(item, context, input.farmUf, input.evaluatedAt),
    ...scheduledBlockers(item, context, input.animalId, input.evaluatedAt)];
}

function rabiesTechnicalBlockers(input: Parameters<typeof sanitaryContextualPlanningBlockersV2>[0]) {
  const metadata = input.item.snapshotTemplate.metadata as Record<string, unknown> | undefined;
  if (metadata?.catalog_review_scope !== "manual_planning") return [];
  const birth = input.animalBirthDate;
  if (!birth || !validRabiesBirth(birth, input.evaluatedAt))
    return ["Nascimento válido necessário para identificar avaliação específica em menores de três meses."];
  if (requiresRabiesAssessment(input.item, birth, input.evaluatedAt) && !confirmedRabiesAssessment(input.context))
    return ["Esta indicação exige confirmação técnica e identificação do responsável; menores de três meses exigem avaliação específica."];
  return [];
}

function validRabiesBirth(birth: string, evaluatedAt: string) {
  return sanitaryScheduledDateValidV2(birth) && sanitaryScheduledDateValidV2(evaluatedAt) && birth <= evaluatedAt;
}

function confirmedRabiesAssessment(context: SanitaryRuleContextDetailsV2) {
  const assessment = context.rabiesTechnicalAssessment;
  return assessment?.confirmed && Boolean(assessment.responsibleReference.trim());
}

function requiresRabiesAssessment(item: SanitaryProtocolItemV2ReadModel, birth: string, evaluatedAt: string) {
  const at = new Date(`${evaluatedAt}T00:00:00Z`);
  const birthDate = new Date(`${birth}T00:00:00Z`);
  const ageMonths = (at.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + at.getUTCMonth() - birthDate.getUTCMonth()
    - (at.getUTCDate() < birthDate.getUTCDate() ? 1 : 0);
  return ageMonths < 3 || item.eligibilityRule.requires_contextual_veterinary_decision === true;
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
