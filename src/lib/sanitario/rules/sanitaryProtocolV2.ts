import {
  buildValidationResultV2,
  type SanitaryEvidenceStatusV2,
  type SanitarySourceRefV2,
  type SanitaryValidationIssueV2,
  type SanitaryValidationResultV2,
  validateSourceCoverageForCriticalField,
} from "./sanitarySourceV2";
import {
  validateSpeciesAuthorizationV2,
  type SpeciesAuthorizationV2,
} from "./sanitaryProductV2";

export type SanitaryProtocolScopeV2 = "global" | "pack" | "fazenda";
export type SanitaryProtocolLegalStatusV2 =
  | "obrigatorio_norma"
  | "recomendado_tecnico"
  | "condicional"
  | "estrategico"
  | "experimental_alerta"
  | "bloqueado";
export type SanitaryProtocolLifecycleStatusV2 = "draft" | "active" | "retired";
export type SanitaryProtocolApprovalStatusV2 = "draft" | "pending_review" | "approved" | "rejected";
export type SanitaryProtocolItemStatusV2 =
  | "obrigatorio"
  | "recomendado"
  | "condicional"
  | "estrategico"
  | "somente_alerta"
  | "bloqueado";
export type SanitaryActionTypeV2 =
  | "vacinacao"
  | "vermifugacao"
  | "tratamento"
  | "exame"
  | "manejo_sanitario"
  | "alerta";
export type ProductRequirementKindV2 = "specific_product" | "product_class" | "none";

export type SanitaryProtocolV2 = {
  id?: string;
  familyCode: string;
  name: string;
  scope: SanitaryProtocolScopeV2;
  fazendaId?: string | null;
  speciesScope: string[];
  jurisdictionScope: Record<string, unknown>;
  legalStatus: SanitaryProtocolLegalStatusV2;
  version: number;
  status: SanitaryProtocolLifecycleStatusV2;
  sourceRefsSnapshot: SanitarySourceRefV2[];
  approvalStatus: SanitaryProtocolApprovalStatusV2;
  metadata?: Record<string, unknown>;
};

export type SanitaryProtocolItemVersionV2 = {
  id?: string;
  protocolId: string;
  logicalItemKey: string;
  version: number;
  itemStatus: SanitaryProtocolItemStatusV2;
  actionType: SanitaryActionTypeV2;
  productRequirementKind: ProductRequirementKindV2;
  productId?: string | null;
  productClass?: string | null;
  eligibilityRule: Record<string, unknown>;
  operationalWindowRule: Record<string, unknown>;
  doseRule?: Record<string, unknown> | null;
  routeRule?: Record<string, unknown> | null;
  boosterRule?: Record<string, unknown> | null;
  speciesAuthorization: SpeciesAuthorizationV2[];
  sourceRefsByField: Record<string, SanitarySourceRefV2[]>;
  limitations: string[];
  snapshotTemplate?: Record<string, unknown>;
  allowsAgendaAuto: boolean;
  requiresMvResponsavel?: boolean;
  status: SanitaryProtocolLifecycleStatusV2;
};

const ITEM_CRITICAL_FIELDS = [
  "eligibility_rule",
  "operational_window",
  "product_requirement",
] as const;

function sourceRefsForField(
  sourceRefsByField: Record<string, SanitarySourceRefV2[]> | null | undefined,
  fieldKey: string,
): SanitarySourceRefV2[] {
  return sourceRefsByField?.[fieldKey] ?? [];
}

export function validateSanitaryProtocolV2(
  protocol: SanitaryProtocolV2,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (!protocol.familyCode?.trim() || !protocol.name?.trim()) {
    issues.push({
      code: "protocol_missing_identity",
      severity: "block",
      field: "familyCode",
      message: "Protocolo v2 exige familyCode e name.",
    });
  }

  if (protocol.version <= 0) {
    issues.push({
      code: "protocol_invalid_version",
      severity: "block",
      field: "version",
      message: "Versao de protocolo deve ser positiva.",
    });
  }

  if (protocol.scope === "fazenda" && !protocol.fazendaId) {
    issues.push({
      code: "farm_protocol_requires_fazenda",
      severity: "block",
      field: "fazendaId",
      message: "Protocolo de fazenda exige fazenda_id.",
    });
  }

  if (protocol.scope !== "fazenda" && protocol.fazendaId) {
    issues.push({
      code: "global_protocol_must_not_have_fazenda",
      severity: "block",
      field: "fazendaId",
      message: "Protocolo global ou pack nao deve ter fazenda_id.",
    });
  }

  if (protocol.legalStatus === "obrigatorio_norma" || protocol.legalStatus === "bloqueado") {
    issues.push(
      ...validateSourceCoverageForCriticalField(
        protocol.sourceRefsSnapshot,
        "legal_status",
      ).issues,
    );
  }

  return buildValidationResultV2(issues);
}

function validateProductRequirement(
  item: SanitaryProtocolItemVersionV2,
): SanitaryValidationIssueV2[] {
  if (item.productRequirementKind === "specific_product" && !item.productId) {
    return [
      {
        code: "specific_product_requires_product_id",
        severity: "block",
        field: "productId",
        message: "Item com produto especifico exige product_id.",
      },
    ];
  }

  if (item.productRequirementKind === "product_class" && !item.productClass?.trim()) {
    return [
      {
        code: "product_class_requires_class",
        severity: "block",
        field: "productClass",
        message: "Item por classe exige product_class.",
      },
    ];
  }

  if (item.productRequirementKind === "none" && (item.productId || item.productClass)) {
    return [
      {
        code: "none_product_requirement_must_not_reference_product",
        severity: "block",
        field: "productRequirementKind",
        message: "Item sem produto nao pode referenciar produto ou classe.",
      },
    ];
  }

  return [];
}

function collectAuthorizationStatuses(
  authorizations: SpeciesAuthorizationV2[],
): SanitaryEvidenceStatusV2[] {
  return authorizations.map((authorization) => authorization.authorizationStatus);
}

export function validateSanitaryProtocolItemVersionV2(
  item: SanitaryProtocolItemVersionV2,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (!item.protocolId || !item.logicalItemKey?.trim()) {
    issues.push({
      code: "protocol_item_missing_identity",
      severity: "block",
      field: "logicalItemKey",
      message: "Item versionado exige protocol_id e logical_item_key.",
    });
  }

  if (item.version <= 0) {
    issues.push({
      code: "protocol_item_invalid_version",
      severity: "block",
      field: "version",
      message: "Versao do item deve ser positiva.",
    });
  }

  issues.push(...validateProductRequirement(item));

  for (const fieldKey of ITEM_CRITICAL_FIELDS) {
    issues.push(
      ...validateSourceCoverageForCriticalField(
        sourceRefsForField(item.sourceRefsByField, fieldKey),
        fieldKey,
      ).issues,
    );
  }

  if ((item.itemStatus === "somente_alerta" || item.itemStatus === "bloqueado") && item.allowsAgendaAuto) {
    issues.push({
      code: "alert_or_blocked_item_cannot_auto_schedule",
      severity: "block",
      field: "allowsAgendaAuto",
      message: "Item somente_alerta ou bloqueado nao pode permitir agenda automatica futura.",
    });
  }

  const authorizationStatuses = collectAuthorizationStatuses(item.speciesAuthorization);

  if (authorizationStatuses.includes("NAO_AUTORIZADO") && item.allowsAgendaAuto) {
    issues.push({
      code: "not_authorized_blocks_auto_schedule",
      severity: "block",
      field: "speciesAuthorization",
      message: "NAO_AUTORIZADO bloqueia agenda automatica futura.",
    });
  }

  if (authorizationStatuses.includes("PRECISA_VALIDAR") && item.limitations.length === 0) {
    issues.push({
      code: "needs_validation_requires_limitation",
      severity: "limitation",
      field: "limitations",
      message: "PRECISA_VALIDAR deve preservar limitacao explicita.",
    });
  }

  if (authorizationStatuses.includes("EXTRAPOLADO") && !item.requiresMvResponsavel) {
    issues.push({
      code: "extrapolated_item_requires_mv",
      severity: "block",
      field: "requiresMvResponsavel",
      message: "EXTRAPOLADO exige indicacao de MV responsavel para futura execucao.",
    });
  }

  for (const authorization of item.speciesAuthorization) {
    issues.push(...validateSpeciesAuthorizationV2(authorization).issues);
  }

  return buildValidationResultV2(issues);
}

export function requiresNewProtocolItemVersionV2(
  previous: SanitaryProtocolItemVersionV2,
  next: SanitaryProtocolItemVersionV2,
): boolean {
  const semanticPrevious = {
    itemStatus: previous.itemStatus,
    actionType: previous.actionType,
    productRequirementKind: previous.productRequirementKind,
    productId: previous.productId ?? null,
    productClass: previous.productClass ?? null,
    eligibilityRule: previous.eligibilityRule,
    operationalWindowRule: previous.operationalWindowRule,
    doseRule: previous.doseRule ?? null,
    routeRule: previous.routeRule ?? null,
    boosterRule: previous.boosterRule ?? null,
    speciesAuthorization: previous.speciesAuthorization,
    sourceRefsByField: previous.sourceRefsByField,
  };
  const semanticNext = {
    itemStatus: next.itemStatus,
    actionType: next.actionType,
    productRequirementKind: next.productRequirementKind,
    productId: next.productId ?? null,
    productClass: next.productClass ?? null,
    eligibilityRule: next.eligibilityRule,
    operationalWindowRule: next.operationalWindowRule,
    doseRule: next.doseRule ?? null,
    routeRule: next.routeRule ?? null,
    boosterRule: next.boosterRule ?? null,
    speciesAuthorization: next.speciesAuthorization,
    sourceRefsByField: next.sourceRefsByField,
  };

  return JSON.stringify(semanticPrevious) !== JSON.stringify(semanticNext);
}
