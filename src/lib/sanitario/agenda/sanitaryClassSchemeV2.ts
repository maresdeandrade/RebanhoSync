import type { SanitaryProtocolItemV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";
import { hasStrongSourceCoveringFieldV2, type SanitarySourceRefV2 } from "../rules/sanitarySourceV2";

// Opt-in on a new, reviewed item version. Legacy rules retain their existing policy.
export function isSanitaryClassSchemeV2(item: Pick<SanitaryProtocolItemV2ReadModel, "snapshotTemplate">) {
  const metadata = item.snapshotTemplate.metadata as Record<string, unknown> | undefined;
  return metadata?.planning_scope === "class_scheme";
}

export const SANITARY_CLASS_SCHEME_FIELDS_V2 = [
  "eligibility_rule", "operational_window", "product_requirement", "species_authorization",
] as const;

export function sanitaryClassFieldSourcesV2(refs: unknown, field: string): SanitarySourceRefV2[] {
  if (!Array.isArray(refs)) return [];
  return refs.filter((ref): ref is SanitarySourceRefV2 =>
    !!ref && typeof ref === "object" && ref.scope === "global" &&
    ref.kind !== "registro_produto" &&
    Array.isArray(ref.fieldKeys) && hasStrongSourceCoveringFieldV2([ref], field),
  );
}

export function sanitaryClassSchemeBlockersV2(item: SanitaryProtocolItemV2ReadModel): string[] {
  const blockers: string[] = [];
  if (item.productRequirementKind !== "product_class" || !item.productClass?.trim() ||
    item.productId || item.actionType !== "vacinacao" ||
    item.snapshotTemplate.executionProductPolicy !== "required_at_execution" ||
    (item.snapshotTemplate.sourcePolicy as Record<string, unknown> | undefined)?.operational_window !== "compatible_product_required_at_execution" ||
    Object.keys(item.doseRule).length || Object.keys(item.routeRule).length) {
    blockers.push("Esquema por classe exige classe vacinal, produto somente na execução e nenhuma dose/via antecipada.");
  }
  if (!SANITARY_CLASS_SCHEME_FIELDS_V2.every((field) => {
    const refs = item.sourceRefsByField[field];
    return Array.isArray(refs) && refs.length > 0 &&
      sanitaryClassFieldSourcesV2(refs, field).length === refs.length;
  })) {
    blockers.push("Esquema por classe exige fontes por campo para a variante; referência de marca não valida toda a classe.");
  }
  const recurrence = item.boosterRule.recurrenceRule as { kind?: string } | undefined;
  if (recurrence?.kind === "annual" && !item.boosterRule.previous_logical_item_key) {
    blockers.push("Reforço anual por classe exige a etapa factual que completa a série inicial.");
  }
  return blockers;
}

// Match factual evidence of compatibility, never the planned product or current catalog.
export function sanitaryClassHistoryMatchesV2(item: SanitaryProtocolItemV2ReadModel, event: {
  productId?: string | null; productClass?: string | null;
  classSchemeCoverageId?: string | null; itemKey?: string;
}) {
  if (!isSanitaryClassSchemeV2(item)) return true;
  if (!event.productId || event.productClass !== item.productClass || !event.classSchemeCoverageId) return false;
  const recurrence = item.boosterRule.recurrenceRule as { kind?: string } | undefined;
  if (recurrence?.kind === "annual" && event.itemKey !== item.logicalItemKey &&
    event.itemKey !== item.boosterRule.previous_logical_item_key) return false;
  return sanitaryClassFieldSourcesV2(item.sourceRefsByField.operational_window, "operational_window")
    .some((ref) => Array.isArray(ref.metadata?.coverage_ids) &&
      ref.metadata.coverage_ids.includes(event.classSchemeCoverageId));
}
