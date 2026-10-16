import type {
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "../catalog/sanitaryProtocolCatalogV2";
import {
  hasStrongSourceCoveringFieldV2,
  type SanitarySourceRefV2,
} from "../rules/sanitarySourceV2";

export type SanitaryPlanningKindV2 =
  | "avaliacao_manejo_generica"
  | "aplicacao_esquema_definido";
export type SanitaryGenerationModeV2 = "manual" | "automatic";

export function sanitaryPlanningKindV2(
  item: SanitaryProtocolItemV2ReadModel,
): SanitaryPlanningKindV2 {
  const anchors = ["previous_dose", "last_execution"];
  const recurrence = item.boosterRule.recurrenceRule as
    | { kind?: string }
    | undefined;
  const dependent = [
    "primovaccination_dose_2",
    "annual",
    "annual_if_risk_area",
    "annual_or_semester_by_risk",
  ];
  return item.productId ||
    item.productRequirementKind === "specific_product" ||
    item.eligibilityRule.requires_previous_dose ||
    item.boosterRule.previous_logical_item_key ||
    anchors.includes(String(item.operationalWindowRule.anchor)) ||
    dependent.includes(recurrence?.kind ?? "")
    ? "aplicacao_esquema_definido"
    : "avaliacao_manejo_generica";
}

function hasRestriction(value: unknown, code: string): boolean {
  if (value === code) return true;
  if (Array.isArray(value))
    return value.some((entry) => hasRestriction(entry, code));
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        (key === code && entry === true) || hasRestriction(entry, code),
    );
  }
  return false;
}

export function sanitaryHasNoAgendaAutoV2(
  item: Pick<
    SanitaryProtocolItemV2ReadModel,
    "limitations" | "snapshotTemplate"
  >,
): boolean {
  return (
    hasRestriction(item.limitations, "no_agenda_auto") ||
    hasRestriction(item.snapshotTemplate, "no_agenda_auto")
  );
}

export function sanitaryPlanningHasFieldSourceV2(
  item: SanitaryProtocolItemV2ReadModel,
  field: string,
): boolean {
  const refs = item.sourceRefsByField[field];
  if (!Array.isArray(refs)) return false;
  return hasStrongSourceCoveringFieldV2(
    refs.filter(
      (ref): ref is SanitarySourceRefV2 =>
        !!ref && Array.isArray(ref.fieldKeys),
    ),
    field,
  );
}

export function sanitaryAutomaticPlanningBlockersV2(
  protocol: SanitaryProtocolV2ReadModel,
  item: SanitaryProtocolItemV2ReadModel,
): string[] {
  const blockers: string[] = [];
  if (!item.allowsAgendaAuto || sanitaryHasNoAgendaAutoV2(item)) {
    blockers.push(
      "Item sem autorização versionada para Agenda automática (allows_agenda_auto/no_agenda_auto).",
    );
  }
  if (
    protocol.metadata.agenda_allowed === false ||
    protocol.metadata.approved_for_catalog === false
  ) {
    blockers.push("Aprovação prospectiva do protocolo não liberada.");
  }
  if (
    !["eligibility_rule", "operational_window", "product_requirement"].every(
      (field) => sanitaryPlanningHasFieldSourceV2(item, field),
    )
  ) {
    blockers.push(
      "Automação exige fontes técnicas por campo na versão aprovada.",
    );
  }
  return blockers;
}

export function sanitaryDefinedSchemeBlockersV2(
  item: SanitaryProtocolItemV2ReadModel,
): string[] {
  if (sanitaryPlanningKindV2(item) !== "aplicacao_esquema_definido") return [];
  const blockers: string[] = [];
  if ([item.doseRule, item.routeRule].some((rule) => Object.keys(rule).length === 0)) {
    blockers.push("Esquema definido exige regras explícitas de dose e via do produto selecionado.");
  }
  if (!item.productId)
    blockers.push(
      "Esquema definido exige produto comercial identificado na versão do item.",
    );
  if (
    ![
      "product_requirement",
      "operational_window",
      "dose",
      "route",
      "species_authorization",
    ].every((field) => sanitaryPlanningHasFieldSourceV2(item, field))
  ) {
    blockers.push(
      "Esquema definido exige fontes aplicáveis de produto, janela, dose, via e espécie.",
    );
  }
  return blockers;
}
