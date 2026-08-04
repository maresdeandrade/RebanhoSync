import {
  buildValidationResultV2,
  type FieldSourceStatus,
  type SourceCoverageStatusV2,
  type SanitarySourceRefV2,
  type SanitaryValidationIssueV2,
  type SanitaryValidationResultV2,
  validateSourceCoverageForCriticalField,
} from "./sanitarySourceV2";
import type {
  SanitaryActionTypeV2,
  SanitaryProtocolItemStatusV2,
  SanitaryProtocolLegalStatusV2,
} from "./sanitaryProtocolV2";
import type {
  SanitaryAptitudeV2,
  SanitaryDoseBasisV2,
  SanitarySpeciesCodeV2,
  WithdrawalApplicabilityV2,
} from "./sanitaryProductV2";

export type SanitaryProductSnapshotV2 = {
  productId: string;
  nomeComercial: string;
  fabricante?: string | null;
  registroOrgao?: string | null;
  registroNumero?: string | null;
  catalogUpdatedAt?: string | null;
  classe: string;
  principioAtivo?: string | null;
  tipoProduto: string;
  apresentacao?: string | null;
  speciesCode?: SanitarySpeciesCodeV2 | null;
  authorizationStatus?: string | null;
  sourceRefs: SanitarySourceRefV2[];
};

export type WithdrawalSnapshotV2 = {
  productId: string;
  speciesCode: SanitarySpeciesCodeV2;
  aptitude: Exclude<SanitaryAptitudeV2, "all">;
  route?: string | null;
  doseBasis?: SanitaryDoseBasisV2 | null;
  meatDays?: number | null;
  milkDays?: number | null;
  milkHours?: number | null;
  applicability: WithdrawalApplicabilityV2;
  sourceRefs: SanitarySourceRefV2[];
  limitations?: string[];
};

export type ExecutedProductFieldEvidenceV2 = {
  fieldKey: string;
  coverageStatus: SourceCoverageStatusV2;
  factualValue: Record<string, unknown>;
  technicalValue: Record<string, unknown> | null;
  sourceRef: SanitarySourceRefV2 | null;
  sourceCoverageId: string | null;
  productSource: {
    productId: string;
    sourceId: string;
    fieldKey: string;
  } | null;
  qualifiers: {
    speciesCode?: SanitarySpeciesCodeV2 | null;
    aptitude?: SanitaryAptitudeV2 | null;
    route?: string | null;
    doseBasis?: SanitaryDoseBasisV2 | null;
    animalIds?: string[];
  };
  reason: string;
};

export type ExecutedProductTechnicalSnapshotV2 = {
  schemaVersion: "sanitario-executed-product-technical-snapshot-v2";
  eventId: string;
  executedProductId: string;
  executedProductName: string;
  executedProductSnapshot: SanitaryProductSnapshotV2 | null;
  executedDose: {
    quantity: number;
    unit: string;
    basis: SanitaryDoseBasisV2;
  };
  executedRoute: string;
  fieldEvidence: ExecutedProductFieldEvidenceV2[];
  sourceRefs: SanitarySourceRefV2[];
  limitations: string[];
};

export type AgendaTechnicalSnapshot = {
  schemaVersion: "sanitario-agenda-technical-snapshot-v2";
  protocolId?: string | null;
  protocolVersion?: number | null;
  protocolItemVersionId?: string | null;
  logicalItemKey?: string | null;
  itemVersion?: number | null;
  actionType: SanitaryActionTypeV2;
  itemStatus: SanitaryProtocolItemStatusV2;
  legalStatus: SanitaryProtocolLegalStatusV2;
  speciesScope: SanitarySpeciesCodeV2[];
  bubalinoAuthorizationStatus?: string | null;
  productRequirement: {
    kind: "specific_product" | "product_class" | "none";
    productId?: string | null;
    productClass?: string | null;
  };
  plannedProductId?: string | null;
  plannedProductSnapshot?: SanitaryProductSnapshotV2 | null;
  eligibilityRuleSnapshot: Record<string, unknown>;
  operationalWindowSnapshot: Record<string, unknown>;
  sourceRefs: SanitarySourceRefV2[];
  fieldSourceStatus: FieldSourceStatus[];
  limitations: string[];
};

export type EventTechnicalSnapshot = Omit<
  ExecutedProductTechnicalSnapshotV2,
  "schemaVersion" | "executedProductSnapshot"
> & {
  schemaVersion: "sanitario-event-technical-snapshot-v2";
  executedProductSnapshot: SanitaryProductSnapshotV2;
  protocolId?: string | null;
  protocolItemVersionId?: string | null;
  protocolItemSnapshot?: Record<string, unknown> | null;
  withdrawalSnapshot: WithdrawalSnapshotV2;
  mvResponsavel?: {
    id?: string | null;
    nome?: string | null;
    registro?: string | null;
  } | null;
};

export function validateExecutedProductTechnicalSnapshotV2(
  snapshot: ExecutedProductTechnicalSnapshotV2 & Record<string, unknown>,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];
  if (snapshot.schemaVersion !== "sanitario-executed-product-technical-snapshot-v2") {
    issues.push({
      code: "executed_product_snapshot_invalid_schema_version",
      severity: "block",
      field: "schemaVersion",
      message: "Snapshot técnico do produto executado exige schema version v2.",
    });
  }
  if (!snapshot.eventId || !snapshot.executedProductId || !snapshot.executedProductName) {
    issues.push({
      code: "executed_product_snapshot_requires_factual_identity",
      severity: "block",
      field: "executedProductId",
      message: "Snapshot técnico exige identidade factual do Evento e do produto executado.",
    });
  }
  if (!snapshot.executedRoute?.trim()) {
    issues.push({
      code: "executed_product_snapshot_requires_route",
      severity: "block",
      field: "executedRoute",
      message: "Snapshot técnico exige a via factual executada.",
    });
  }
  if (!(snapshot.executedDose?.quantity > 0) || !snapshot.executedDose?.unit?.trim()) {
    issues.push({
      code: "executed_product_snapshot_requires_dose",
      severity: "block",
      field: "executedDose",
      message: "Snapshot técnico exige a dose factual executada.",
    });
  }
  if (
    snapshot.executedProductSnapshot &&
    snapshot.executedProductSnapshot.productId !== snapshot.executedProductId
  ) {
    issues.push({
      code: "executed_product_snapshot_product_mismatch",
      severity: "block",
      field: "executedProductSnapshot.productId",
      message: "Snapshot do catálogo deve corresponder ao produto factual executado.",
    });
  }
  if (!Array.isArray(snapshot.fieldEvidence) || !Array.isArray(snapshot.sourceRefs)) {
    issues.push({
      code: "executed_product_snapshot_evidence_invalid",
      severity: "block",
      field: "fieldEvidence",
      message: "Evidências técnicas por campo devem ser preservadas como coleção explícita.",
    });
  } else {
    for (const evidence of snapshot.fieldEvidence) {
      if (!evidence.fieldKey?.trim()) {
        issues.push({
          code: "executed_product_snapshot_field_key_required",
          severity: "block",
          field: "fieldEvidence.fieldKey",
          message: "Cada evidência deve identificar o campo técnico coberto.",
        });
      }
      if (
        evidence.coverageStatus === "covers" &&
        (!evidence.sourceRef?.id || !evidence.sourceCoverageId || !evidence.productSource || !evidence.technicalValue)
      ) {
        issues.push({
          code: "executed_product_snapshot_covered_field_incomplete",
          severity: "block",
          field: evidence.fieldKey,
          message: "Campo coberto exige fonte, cobertura, vínculo produto-fonte e valor técnico.",
        });
      }
      if (
        evidence.coverageStatus !== "covers" &&
        (evidence.sourceRef || evidence.sourceCoverageId || evidence.productSource || evidence.technicalValue)
      ) {
        issues.push({
          code: "executed_product_snapshot_uncovered_field_qualified",
          severity: "block",
          field: evidence.fieldKey,
          message: "Campo não coberto não pode conservar qualificação técnica parcial.",
        });
      }
    }
  }
  if ("withdrawalSnapshot" in snapshot || "withdrawal_snapshot" in snapshot) {
    issues.push({
      code: "executed_product_snapshot_must_not_carry_withdrawal",
      severity: "block",
      field: "withdrawalSnapshot",
      message: "O núcleo técnico do item 4 não materializa carência.",
    });
  }
  return buildValidationResultV2(issues);
}

export function validateAgendaTechnicalSnapshotV2(
  snapshot: AgendaTechnicalSnapshot & Record<string, unknown>,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (snapshot.schemaVersion !== "sanitario-agenda-technical-snapshot-v2") {
    issues.push({
      code: "agenda_snapshot_invalid_schema_version",
      severity: "block",
      field: "schemaVersion",
      message: "Snapshot tecnico de agenda exige schema version v2.",
    });
  }

  if ("withdrawalSnapshot" in snapshot || "withdrawal_snapshot" in snapshot) {
    issues.push({
      code: "agenda_snapshot_must_not_carry_withdrawal",
      severity: "block",
      field: "withdrawalSnapshot",
      message: "Agenda documenta intencao planejada e nao carrega carencia ativa.",
    });
  }

  if ("carenciaAtiva" in snapshot || "carencia_ativa" in snapshot) {
    issues.push({
      code: "agenda_snapshot_must_not_carry_active_withdrawal",
      severity: "block",
      field: "carenciaAtiva",
      message: "Agenda nao declara carencia ativa nem livre de carencia.",
    });
  }

  if (snapshot.plannedProductId && !snapshot.plannedProductSnapshot) {
    issues.push({
      code: "planned_product_requires_snapshot",
      severity: "block",
      field: "plannedProductSnapshot",
      message: "Produto planejado exige snapshot tecnico planejado.",
    });
  }

  return buildValidationResultV2(issues);
}

export function validateEventTechnicalSnapshotV2(
  snapshot: EventTechnicalSnapshot & Record<string, unknown>,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  issues.push(
    ...validateExecutedProductTechnicalSnapshotV2({
      schemaVersion: "sanitario-executed-product-technical-snapshot-v2",
      eventId: snapshot.eventId,
      executedProductId: snapshot.executedProductId,
      executedProductName: snapshot.executedProductName,
      executedProductSnapshot: snapshot.executedProductSnapshot,
      executedDose: snapshot.executedDose,
      executedRoute: snapshot.executedRoute,
      fieldEvidence: snapshot.fieldEvidence,
      sourceRefs: snapshot.sourceRefs,
      limitations: snapshot.limitations,
    }).issues,
  );

  if (snapshot.schemaVersion !== "sanitario-event-technical-snapshot-v2") {
    issues.push({
      code: "event_snapshot_invalid_schema_version",
      severity: "block",
      field: "schemaVersion",
      message: "Snapshot tecnico de evento exige schema version v2.",
    });
  }

  if (!snapshot.eventId || !snapshot.executedProductId || !snapshot.executedProductSnapshot) {
    issues.push({
      code: "event_snapshot_requires_executed_product",
      severity: "block",
      field: "executedProductId",
      message: "Evento executado exige produto executado real e snapshot do produto.",
    });
  }

  if ("plannedProductId" in snapshot && !snapshot.executedProductId) {
    issues.push({
      code: "planned_product_is_not_executed_product",
      severity: "block",
      field: "executedProductId",
      message: "Produto planejado nao vira produto executado automaticamente.",
    });
  }

  if (!snapshot.executedRoute?.trim()) {
    issues.push({
      code: "event_snapshot_requires_route",
      severity: "block",
      field: "executedRoute",
      message: "Evento executado exige via executada.",
    });
  }

  if (!(snapshot.executedDose?.quantity > 0) || !snapshot.executedDose?.unit?.trim()) {
    issues.push({
      code: "event_snapshot_requires_dose",
      severity: "block",
      field: "executedDose",
      message: "Evento executado exige dose executada.",
    });
  }

  if (!snapshot.withdrawalSnapshot) {
    issues.push({
      code: "event_snapshot_requires_withdrawal_snapshot",
      severity: "block",
      field: "withdrawalSnapshot",
      message: "Evento sanitario executado deve carregar snapshot de carencia do produto executado.",
    });
  } else {
    issues.push(
      ...validateSourceCoverageForCriticalField(
        snapshot.withdrawalSnapshot.sourceRefs,
        "withdrawal",
      ).issues,
    );
  }

  return buildValidationResultV2(issues);
}
