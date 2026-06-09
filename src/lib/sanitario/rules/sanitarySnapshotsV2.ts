import {
  buildValidationResultV2,
  type FieldSourceStatus,
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

export type EventTechnicalSnapshot = {
  schemaVersion: "sanitario-event-technical-snapshot-v2";
  eventId: string;
  executedProductId: string;
  executedProductSnapshot: SanitaryProductSnapshotV2;
  executedDose: {
    quantity: number;
    unit: string;
    basis: SanitaryDoseBasisV2;
  };
  executedRoute: string;
  protocolId?: string | null;
  protocolItemVersionId?: string | null;
  protocolItemSnapshot?: Record<string, unknown> | null;
  withdrawalSnapshot: WithdrawalSnapshotV2;
  sourceRefs: SanitarySourceRefV2[];
  mvResponsavel?: {
    id?: string | null;
    nome?: string | null;
    registro?: string | null;
  } | null;
  limitations: string[];
};

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
