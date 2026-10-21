import type { SanitarioAgendaLocalV2, SanitarioProdutoFonteLocalV2, SanitarioFonteTecnicaLocalV2, SanitarioFonteCoberturaCampoLocalV2 } from "@/lib/offline/types";
import type { ExecutedProductTechnicalSnapshotV2, ExecutedProductFieldEvidenceV2 } from "../rules/sanitarySnapshotsV2";
import { sanitaryClassFieldSourcesV2 } from "../agenda/sanitaryClassSchemeV2";
import { hasStrongSourceCoveringFieldV2 } from "../rules/sanitarySourceV2";

// Adds provenance to the existing factual snapshot. It does not compute a schedule or withdrawal.
export function classSchemeExecutionEvidenceV2(input: {
  agenda: SanitarioAgendaLocalV2;
  snapshot: ExecutedProductTechnicalSnapshotV2;
  productSources: SanitarioProdutoFonteLocalV2[];
  sources: SanitarioFonteTecnicaLocalV2[];
  coverages: SanitarioFonteCoberturaCampoLocalV2[];
}): ExecutedProductFieldEvidenceV2 | null {
  const evidence = input.agenda.protocol_item_snapshot.planningEvidence as Record<string, unknown> | undefined;
  if (evidence?.planningScope !== "class_scheme") return null;
  const refsByField = evidence.sourceRefsByField as Record<string, unknown> | undefined;
  const refs = sanitaryClassFieldSourcesV2(refsByField?.operational_window, "operational_window");
  const snapshot = input.snapshot;
  const technicalFieldsCovered = ["dose", "route", "species_authorization"].every((field) => {
    const fields = snapshot.fieldEvidence.filter((entry) => entry.fieldKey === field);
    return fields.length > 0 && fields.every((entry) => entry.coverageStatus === "covers" && entry.sourceRef &&
      hasStrongSourceCoveringFieldV2([entry.sourceRef], field));
  });
  if (!technicalFieldsCovered || snapshot.executedProductSnapshot?.classe !== input.agenda.produto_classe) return null;
  for (const ref of refs) {
    const registered = input.sources.find((s) => s.id === ref.id && s.scope === "global" && !s.deleted_at &&
      s.kind === ref.kind && s.strength === "forte" && ["SIM_BULA", "SIM_NORMA"].includes(s.evidence_status));
    const coverage = input.coverages.find((c) => !c.deleted_at && c.source_id === ref.id &&
      c.field_key === "operational_window" && c.coverage_status === "covers" &&
      Array.isArray(ref.metadata?.coverage_ids) && ref.metadata.coverage_ids.includes(c.id));
    const link = input.productSources.find((s) => s.product_id === snapshot.executedProductId &&
      s.source_id === ref.id && s.field_key === "operational_window");
    if (registered && coverage && link) return {
      fieldKey: "operational_window", coverageStatus: "covers",
      factualValue: { productId: snapshot.executedProductId, productClass: input.agenda.produto_classe },
      technicalValue: { operationalWindowRule: evidence.operationalWindowRule, boosterRule: evidence.boosterRule },
      sourceRef: ref, sourceCoverageId: coverage.id,
      productSource: { productId: link.product_id, sourceId: link.source_id, fieldKey: link.field_key },
      qualifiers: {}, reason: "class_scheme_product_compatibility_verified",
    };
  }
  return null;
}
