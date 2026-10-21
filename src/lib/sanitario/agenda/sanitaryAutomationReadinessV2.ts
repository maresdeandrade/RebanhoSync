import type { SanitaryProtocolItemV2ReadModel, SanitaryProtocolV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";
import { sanitaryPlanningBlockersV2 } from "../preview/sanitaryWindowPlanningPreviewV2";
import { sanitaryHasNoAgendaAutoV2, sanitaryPlanningHasFieldSourceV2, sanitaryPlanningKindV2, sanitaryPlanningRequiredFieldsV2 } from "./sanitaryPlanningPolicyV2";
import { sanitaryRequiresScheduledContextV2 } from "./sanitaryContextualPlanningV2";

const fieldLabels = {
  eligibility_rule: "elegibilidade", operational_window: "janela", product_requirement: "requisito de produto",
  dose: "dose", route: "via", species_authorization: "autorização da espécie",
};

export function assessSanitaryAutomationReadinessV2(protocol: SanitaryProtocolV2ReadModel, item: SanitaryProtocolItemV2ReadModel) {
  const kind = sanitaryPlanningKindV2(item);
  const requiredFields = sanitaryPlanningRequiredFieldsV2(item);
  const missingFields = requiredFields.filter((field) => !sanitaryPlanningHasFieldSourceV2(item, field));
  const blockers = sanitaryPlanningBlockersV2(protocol, item, "automatic");
  return {
    kind,
    authorized: blockers.length === 0,
    classification: readinessClassification(protocol, item, blockers),
    conditions: itemConditions(item),
    missingFields,
    sourceGaps: missingFields.map((field) => `Vincular fonte e cobertura aprovada de ${fieldLabels[field]}.`),
    blockers,
  };
}

function readinessClassification(protocol: SanitaryProtocolV2ReadModel, item: SanitaryProtocolItemV2ReadModel, blockers: string[]) {
  if (protocol.familyCode === "febre_aftosa" || item.operationalWindowRule.type === "blocked" || item.itemStatus === "bloqueado")
    return "BLOQUEIO_TECNICO_ESPECIFICO";
  if (sanitaryHasNoAgendaAutoV2(item)) return "SUGESTAO_CONDICIONAL";
  return blockers.length ? "AGUARDANDO_APROVACAO_VERSIONADA" : "AUTOMACAO_AUTORIZADA";
}

function itemConditions(item: SanitaryProtocolItemV2ReadModel) {
  const conditions: string[] = ["Espécie, categoria, sexo e idade conforme a versão selecionada."];
  if (item.boosterRule.recurrenceRule || item.operationalWindowRule.anchor === "previous_dose")
    conditions.push("Etapas e reforços seguem o esquema da versão; histórico exigido deve ser factual e compatível com o requisito de produto/classe.");
  if (Array.isArray(item.operationalWindowRule.calendar_months))
    conditions.push("Exige adoção regional explícita para a UF e mês da janela; nenhuma seleção automática de princípio ativo.");
  if (sanitaryRequiresScheduledContextV2(item))
    conditions.push("Exige data, referência e animais do manejo/avaliação programada.");
  if (item.eligibilityRule.requires_mv_or_management_context)
    conditions.push("Exige manejo pré-desmama explícito; avaliação não impõe tratamento farmacológico.");
  return conditions;
}
