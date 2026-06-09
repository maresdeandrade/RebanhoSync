import {
  buildValidationResultV2,
  hasStrongSourceCoveringFieldV2,
  mergeValidationResultsV2,
  type FieldSourceStatus,
  type SanitarySourceRefV2,
  type SanitaryValidationIssueV2,
} from "./sanitarySourceV2";
import {
  validateProductDoseRuleV2,
  validateSanitaryProductV2,
  validateSpeciesAuthorizationV2,
  validateWithdrawalRuleV2,
  type ProductDoseRuleV2,
  type SanitaryAptitudeV2,
  type SanitaryProductV2,
  type SanitarySpeciesCodeV2,
  type SpeciesAuthorizationV2,
  type WithdrawalRuleV2,
} from "./sanitaryProductV2";
import {
  validateSanitaryProtocolItemVersionV2,
  validateSanitaryProtocolV2,
  type SanitaryProtocolItemVersionV2,
  type SanitaryProtocolV2,
} from "./sanitaryProtocolV2";
import {
  validateAgendaTechnicalSnapshotV2,
  validateEventTechnicalSnapshotV2,
  type AgendaTechnicalSnapshot,
  type EventTechnicalSnapshot,
  type SanitaryProductSnapshotV2,
  type WithdrawalSnapshotV2,
} from "./sanitarySnapshotsV2";

export type SnapshotBuildIssue = SanitaryValidationIssueV2;

export interface BuildSnapshotResult<T> {
  ok: boolean;
  snapshot?: T;
  issues: SnapshotBuildIssue[];
}

export interface MVResponsibleRef {
  id: string;
  name?: string;
  registration?: string;
  jurisdiction?: string;
}

export interface SnapshotReferenceContext {
  speciesCode: SanitarySpeciesCodeV2;
  aptitude: SanitaryAptitudeV2;
  fazendaId?: string;
  jurisdiction?: {
    country?: string;
    uf?: string;
    zone?: string;
  };
  targetDate?: string;
}

export interface AgendaSnapshotBuildInputV2 {
  protocol: SanitaryProtocolV2;
  protocolItem: SanitaryProtocolItemVersionV2;
  plannedProduct?: SanitaryProductV2 | null;
  plannedProductSpeciesAuthorization?: SpeciesAuthorizationV2 | null;
  plannedDoseRule?: ProductDoseRuleV2 | null;
  technicalSources: SanitarySourceRefV2[];
  fieldSourceStatus?: FieldSourceStatus[];
  referenceContext: SnapshotReferenceContext;
}

export interface EventSnapshotBuildInputV2 {
  eventId: string;
  executedProduct: SanitaryProductV2;
  executedDose: {
    quantity?: number | null;
    unit?: string | null;
    basis?: string | null;
  };
  executedRoute?: string | null;
  executedProductSpeciesAuthorization?: SpeciesAuthorizationV2 | null;
  withdrawalRule: WithdrawalRuleV2;
  withdrawalSources: SanitarySourceRefV2[];
  protocol?: SanitaryProtocolV2 | null;
  protocolItem?: SanitaryProtocolItemVersionV2 | null;
  mvResponsavel?: MVResponsibleRef | null;
  referenceContext: SnapshotReferenceContext;
}

const AGENDA_CRITICAL_FIELDS = [
  "legal_status",
  "eligibility_rule",
  "operational_window",
  "product_requirement",
  "species_authorization",
];

const PRODUCT_CRITICAL_FIELDS = [
  "species_authorization",
  "dose",
  "route",
  "presentation",
];

export function normalizeSourcesForFieldV2(
  sources: SanitarySourceRefV2[],
  fieldKey: string,
): SanitarySourceRefV2[] {
  return dedupeSources(sources.filter((source) => source.fieldKeys.includes(fieldKey)));
}

export function buildFieldSourceStatusV2(
  fieldKey: string,
  sources: SanitarySourceRefV2[],
  explicit?: FieldSourceStatus[],
): FieldSourceStatus {
  const explicitStatus = explicit?.find((status) => status.fieldKey === fieldKey);
  if (explicitStatus) {
    return explicitStatus;
  }

  const fieldSources = normalizeSourcesForFieldV2(sources, fieldKey);
  const hasStrongCoverage = hasStrongSourceCoveringFieldV2(fieldSources, fieldKey);
  const hasAnyCoverage = fieldSources.length > 0;

  return {
    fieldKey,
    coverageStatus: hasStrongCoverage ? "covers" : hasAnyCoverage ? "partially_covers" : "does_not_cover",
    sourceRefs: fieldSources,
  };
}

export function buildSanitaryProductSnapshotV2(
  product: SanitaryProductV2,
  speciesAuthorization?: SpeciesAuthorizationV2 | null,
): SanitaryProductSnapshotV2 {
  return {
    productId: product.id ?? "",
    nomeComercial: product.nomeComercial,
    classe: product.classe,
    principioAtivo: product.principioAtivo,
    tipoProduto: product.tipoProduto,
    apresentacao: product.apresentacao,
    speciesCode: speciesAuthorization?.speciesCode ?? null,
    authorizationStatus: speciesAuthorization?.authorizationStatus ?? "PRECISA_VALIDAR",
    sourceRefs: dedupeSources([...product.sourceRefs, ...(speciesAuthorization?.sourceRefs ?? [])]),
  };
}

export function buildWithdrawalSnapshotV2(
  withdrawalRule: WithdrawalRuleV2,
  sources: SanitarySourceRefV2[],
): WithdrawalSnapshotV2 {
  return {
    productId: withdrawalRule.productId ?? "",
    speciesCode: withdrawalRule.speciesCode,
    aptitude: withdrawalRule.aptitude,
    route: withdrawalRule.route,
    doseBasis: withdrawalRule.doseBasis,
    applicability: withdrawalRule.applicability,
    meatDays: withdrawalRule.meatDays,
    milkDays: withdrawalRule.milkDays,
    milkHours: withdrawalRule.milkHours,
    sourceRefs: dedupeSources([...withdrawalRule.sourceRefs, ...sources]),
    limitations: withdrawalRule.limitations,
  };
}

export function buildAgendaTechnicalSnapshotV2(
  input: AgendaSnapshotBuildInputV2,
): BuildSnapshotResult<AgendaTechnicalSnapshot> {
  const sources = collectAgendaSources(input);
  const fieldSourceStatus = buildAgendaFieldSourceStatus(input, sources);
  const issues: SnapshotBuildIssue[] = [
    ...mergeValidationResultsV2(
      validateSanitaryProtocolV2(input.protocol),
      validateSanitaryProtocolItemVersionV2(input.protocolItem),
      input.plannedProduct
        ? validateSanitaryProductV2(input.plannedProduct)
        : buildValidationResultV2([]),
      input.plannedProductSpeciesAuthorization
        ? validateSpeciesAuthorizationV2(input.plannedProductSpeciesAuthorization)
        : buildValidationResultV2([]),
      input.plannedDoseRule
        ? validateProductDoseRuleV2(input.plannedDoseRule)
        : buildValidationResultV2([]),
    ).issues,
    ...validateAgendaBuildContext(input, sources, fieldSourceStatus),
  ];

  const plannedProductSnapshot = input.plannedProduct
    ? buildSanitaryProductSnapshotV2(input.plannedProduct, input.plannedProductSpeciesAuthorization)
    : undefined;

  const snapshot: AgendaTechnicalSnapshot = {
    schemaVersion: "sanitario-agenda-technical-snapshot-v2",
    protocolId: input.protocol.id ?? null,
    protocolVersion: input.protocol.version,
    protocolItemVersionId: input.protocolItem.id ?? null,
    logicalItemKey: input.protocolItem.logicalItemKey,
    itemVersion: input.protocolItem.version,
    actionType: input.protocolItem.actionType,
    itemStatus: input.protocolItem.itemStatus,
    legalStatus: input.protocol.legalStatus,
    speciesScope: input.protocol.speciesScope as AgendaTechnicalSnapshot["speciesScope"],
    bubalinoAuthorizationStatus: resolveBubalinoAuthorizationStatus(input),
    productRequirement: {
      kind: input.protocolItem.productRequirementKind,
      productId: input.protocolItem.productId ?? null,
      productClass: input.protocolItem.productClass ?? null,
    },
    plannedProductId: input.plannedProduct?.id ?? null,
    plannedProductSnapshot,
    eligibilityRuleSnapshot: input.protocolItem.eligibilityRule,
    operationalWindowSnapshot: input.protocolItem.operationalWindowRule,
    sourceRefs: sources,
    fieldSourceStatus,
    limitations: collectLimitations(
      input.protocolItem.limitations,
      [],
      input.plannedProductSpeciesAuthorization?.limitations,
      input.plannedDoseRule?.limitations,
    ),
  };

  const snapshotIssues = validateAgendaTechnicalSnapshotV2(snapshot).issues;
  const allIssues = dedupeIssues([...issues, ...snapshotIssues]);

  return {
    ok: allIssues.length === 0,
    snapshot,
    issues: allIssues,
  };
}

export function buildEventTechnicalSnapshotV2(
  input: EventSnapshotBuildInputV2,
): BuildSnapshotResult<EventTechnicalSnapshot> {
  if (!input.executedProduct) {
    return {
      ok: false,
      issues: [{
        code: "event_snapshot_requires_executed_product",
        severity: "block",
        field: "executedProduct",
        message: "Evento executado exige produto executado real.",
      }],
    };
  }

  const sources = dedupeSources([
    ...input.withdrawalSources,
    ...input.executedProduct.sourceRefs,
    ...(input.executedProductSpeciesAuthorization?.sourceRefs ?? []),
    ...(input.protocol?.sourceRefsSnapshot ?? []),
    ...Object.values(input.protocolItem?.sourceRefsByField ?? {}).flat(),
  ]);

  const issues: SnapshotBuildIssue[] = [
    ...mergeValidationResultsV2(
      validateSanitaryProductV2(input.executedProduct),
      input.executedProductSpeciesAuthorization
        ? validateSpeciesAuthorizationV2(input.executedProductSpeciesAuthorization)
        : buildValidationResultV2([{
          code: "species_authorization_missing",
          severity: "block",
          field: "speciesAuthorization",
          message: "Evento sanitário executado exige autorização explícita para espécie/contexto.",
        }]),
      validateWithdrawalRuleV2(input.withdrawalRule),
      input.protocol ? validateSanitaryProtocolV2(input.protocol) : buildValidationResultV2([]),
      input.protocolItem
        ? validateSanitaryProtocolItemVersionV2(input.protocolItem)
        : buildValidationResultV2([]),
    ).issues,
    ...validateEventBuildContext(input),
  ];

  const snapshot: EventTechnicalSnapshot = {
    schemaVersion: "sanitario-event-technical-snapshot-v2",
    eventId: input.eventId,
    executedProductId: input.executedProduct.id,
    executedProductSnapshot: buildSanitaryProductSnapshotV2(
      input.executedProduct,
      input.executedProductSpeciesAuthorization,
    ),
    executedDose: {
      quantity: input.executedDose.quantity ?? 0,
      unit: input.executedDose.unit ?? "",
      basis: (input.executedDose.basis ?? "dose") as EventTechnicalSnapshot["executedDose"]["basis"],
    },
    executedRoute: input.executedRoute ?? "",
    protocolId: input.protocol?.id,
    protocolItemVersionId: input.protocolItem?.id,
    protocolItemSnapshot: input.protocolItem
      ? {
        protocolId: input.protocolItem.protocolId,
        logicalItemKey: input.protocolItem.logicalItemKey,
        version: input.protocolItem.version,
        itemStatus: input.protocolItem.itemStatus,
        actionType: input.protocolItem.actionType,
        productRequirementKind: input.protocolItem.productRequirementKind,
      }
      : undefined,
    withdrawalSnapshot: buildWithdrawalSnapshotV2(input.withdrawalRule, input.withdrawalSources),
    sourceRefs: sources,
    mvResponsavel: input.mvResponsavel
      ? {
        id: input.mvResponsavel.id,
        nome: input.mvResponsavel.name ?? null,
        registro: input.mvResponsavel.registration ?? null,
      }
      : null,
    limitations: collectLimitations(
      [],
      input.executedProductSpeciesAuthorization?.limitations,
      input.withdrawalRule.limitations,
      input.protocolItem?.limitations,
    ),
  };

  const snapshotIssues = validateEventTechnicalSnapshotV2(snapshot).issues;
  const allIssues = dedupeIssues([...issues, ...snapshotIssues]);

  return {
    ok: allIssues.length === 0,
    snapshot,
    issues: allIssues,
  };
}

function collectAgendaSources(input: AgendaSnapshotBuildInputV2): SanitarySourceRefV2[] {
  return dedupeSources([
    ...input.technicalSources,
    ...input.protocol.sourceRefsSnapshot,
    ...Object.values(input.protocolItem.sourceRefsByField).flat(),
    ...(input.plannedProduct?.sourceRefs ?? []),
    ...(input.plannedProductSpeciesAuthorization?.sourceRefs ?? []),
    ...(input.plannedDoseRule?.sourceRefs ?? []),
  ]);
}

function buildAgendaFieldSourceStatus(
  input: AgendaSnapshotBuildInputV2,
  sources: SanitarySourceRefV2[],
): FieldSourceStatus[] {
  const fields = [
    ...AGENDA_CRITICAL_FIELDS,
    ...(input.plannedProduct ? PRODUCT_CRITICAL_FIELDS : []),
  ];

  return fields.map((fieldKey) => buildFieldSourceStatusV2(
    fieldKey,
    sources,
    input.fieldSourceStatus,
  ));
}

function validateAgendaBuildContext(
  input: AgendaSnapshotBuildInputV2,
  sources: SanitarySourceRefV2[],
  fieldSourceStatus: FieldSourceStatus[],
): SnapshotBuildIssue[] {
  const issues: SnapshotBuildIssue[] = [];

  if (input.protocolItem.itemStatus === "somente_alerta" || input.protocolItem.itemStatus === "bloqueado") {
    issues.push({
      code: "protocol_item_not_schedulable",
      message: "Item somente_alerta ou bloqueado não pode montar snapshot para agenda automática.",
      severity: "block",
      field: "itemStatus",
    });
  }

  if (input.protocolItem.allowsAgendaAuto === false) {
    issues.push({
      code: "protocol_item_disallows_auto_agenda",
      severity: "block",
      field: "allowsAgendaAuto",
      message: "Item versionado não permite agenda automática.",
    });
  }

  if (
    input.protocolItem.productRequirementKind === "specific_product" &&
    !input.plannedProduct
  ) {
    issues.push({
      code: "specific_product_requires_planned_product_snapshot",
      severity: "block",
      field: "plannedProduct",
      message: "Item com produto específico exige produto planejado e snapshot técnico.",
    });
  }

  if (
    input.protocolItem.productRequirementKind === "specific_product" &&
    input.plannedProduct?.id &&
    input.protocolItem.productId &&
    input.plannedProduct.id !== input.protocolItem.productId
  ) {
    issues.push({
      code: "planned_product_mismatch",
      severity: "block",
      field: "plannedProduct",
      message: "Produto planejado não corresponde ao produto exigido pelo item versionado.",
    });
  }

  const matchingProtocolAuthorization = input.protocolItem.speciesAuthorization.find(
    (authorization) => authorization.speciesCode === input.referenceContext.speciesCode,
  );

  if (matchingProtocolAuthorization?.authorizationStatus === "NAO_AUTORIZADO") {
    issues.push({
      code: "species_authorization_blocks_agenda",
      message: "NAO_AUTORIZADO bloqueia agenda automática.",
      severity: "block",
      field: "speciesAuthorization",
    });
  }

  if (input.plannedProductSpeciesAuthorization?.authorizationStatus === "NAO_AUTORIZADO") {
    issues.push({
      code: "planned_product_authorization_blocks_agenda",
      message: "Produto planejado NAO_AUTORIZADO para espécie/contexto bloqueia agenda automática.",
      severity: "block",
      field: "plannedProductSpeciesAuthorization",
    });
  }

  if (input.referenceContext.speciesCode === "bubalino") {
    const hasBubalinoAuthorization = input.plannedProductSpeciesAuthorization?.speciesCode === "bubalino"
      || input.protocolItem.speciesAuthorization.some(
        (authorization) => authorization.speciesCode === "bubalino",
      );
    if (!hasBubalinoAuthorization) {
      issues.push({
        code: "bubalino_requires_explicit_authorization",
        message: "Bubalino não herda autorização de bovino.",
        severity: "block",
        field: "speciesCode",
      });
    }
  }

  for (const fieldKey of AGENDA_CRITICAL_FIELDS) {
    if (!hasStrongSourceCoveringFieldV2(sources, fieldKey)) {
      issues.push({
        code: "critical_field_requires_strong_source",
        message: `Campo crítico ${fieldKey} exige fonte forte cobrindo o field_key.`,
        severity: "block",
        field: fieldKey,
      });
    }
  }

  for (const status of fieldSourceStatus) {
    if (status.coverageStatus !== "covers" && AGENDA_CRITICAL_FIELDS.includes(status.fieldKey)) {
      issues.push({
        code: "field_source_status_not_covered",
        message: `Campo crítico ${status.fieldKey} não está coberto por fonte forte.`,
        severity: "block",
        field: status.fieldKey,
      });
    }
  }

  return issues;
}

function validateEventBuildContext(input: EventSnapshotBuildInputV2): SnapshotBuildIssue[] {
  const issues: SnapshotBuildIssue[] = [];

  if (!input.eventId) {
    issues.push({
      code: "event_id_required",
      message: "EventTechnicalSnapshot exige eventId.",
      severity: "block",
      field: "eventId",
    });
  }

  if (!input.executedDose.quantity || !input.executedDose.unit || !input.executedDose.basis) {
    issues.push({
      code: "executed_dose_required",
      message: "Evento sanitário executado exige dose executada completa.",
      severity: "block",
      field: "executedDose",
    });
  }

  if (!input.executedRoute) {
    issues.push({
      code: "executed_route_required",
      message: "Evento sanitário executado exige via executada.",
      severity: "block",
      field: "executedRoute",
    });
  }

  if (
    input.withdrawalRule.productId &&
    input.executedProduct.id &&
    input.withdrawalRule.productId !== input.executedProduct.id
  ) {
    issues.push({
      code: "withdrawal_rule_product_mismatch",
      severity: "block",
      field: "withdrawalRule.productId",
      message: "Regra de carência deve pertencer ao produto executado.",
    });
  }

  if (input.withdrawalRule.speciesCode !== input.referenceContext.speciesCode) {
    issues.push({
      code: "withdrawal_rule_species_mismatch",
      severity: "block",
      field: "withdrawalRule.speciesCode",
      message: "Regra de carência deve corresponder à espécie executada.",
    });
  }

  if (
    input.withdrawalRule.route &&
    input.executedRoute &&
    input.withdrawalRule.route !== input.executedRoute
  ) {
    issues.push({
      code: "withdrawal_rule_route_mismatch",
      severity: "block",
      field: "withdrawalRule.route",
      message: "Regra de carência deve corresponder à via executada.",
    });
  }

  if (
    input.executedProductSpeciesAuthorization?.productId &&
    input.executedProduct.id &&
    input.executedProductSpeciesAuthorization.productId !== input.executedProduct.id
  ) {
    issues.push({
      code: "executed_authorization_product_mismatch",
      severity: "block",
      field: "executedProductSpeciesAuthorization.productId",
      message: "Autorização por espécie deve pertencer ao produto executado.",
    });
  }

  if (
    input.executedProductSpeciesAuthorization &&
    input.executedProductSpeciesAuthorization.speciesCode !== input.referenceContext.speciesCode
  ) {
    issues.push({
      code: "executed_authorization_species_mismatch",
      severity: "block",
      field: "executedProductSpeciesAuthorization.speciesCode",
      message: "Autorização por espécie deve corresponder à espécie executada.",
    });
  }

  if (input.executedProductSpeciesAuthorization?.authorizationStatus === "EXTRAPOLADO" && !input.mvResponsavel) {
    issues.push({
      code: "extrapolated_execution_requires_mv",
      message: "Execução EXTRAPOLADA exige MV responsável auditável.",
      severity: "block",
      field: "mvResponsavel",
    });
  }

  if (input.withdrawalRule.applicability === "unknown") {
    issues.push({
      code: "unknown_withdrawal_blocks_clearance",
      message: "Carência unknown bloqueia leitura de livre de carência.",
      severity: "block",
      field: "withdrawalSnapshot",
    });
  }

  if (input.withdrawalRule.applicability === "not_permitted") {
    issues.push({
      code: "not_permitted_blocks_declared_use",
      message: "not_permitted bloqueia uso declarado.",
      severity: "block",
      field: "withdrawalSnapshot",
    });
  }

  return issues;
}

function resolveBubalinoAuthorizationStatus(
  input: AgendaSnapshotBuildInputV2,
): AgendaTechnicalSnapshot["bubalinoAuthorizationStatus"] {
  if (input.referenceContext.speciesCode !== "bubalino") {
    return undefined;
  }

  if (input.plannedProductSpeciesAuthorization?.speciesCode === "bubalino") {
    return input.plannedProductSpeciesAuthorization.authorizationStatus;
  }

  const protocolAuthorization = input.protocolItem.speciesAuthorization.find(
    (authorization) => authorization.speciesCode === "bubalino",
  );

  if (protocolAuthorization) {
    return protocolAuthorization.authorizationStatus;
  }

  return "PRECISA_VALIDAR";
}

function collectLimitations(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group ?? []))).sort();
}

function dedupeSources(sources: SanitarySourceRefV2[]): SanitarySourceRefV2[] {
  return Array
    .from(new Map(sources.map((source, index) => [source.id ?? `${source.title}:${index}`, source])).values())
    .sort((left, right) => (left.id ?? left.title).localeCompare(right.id ?? right.title));
}

function dedupeIssues(issues: SnapshotBuildIssue[]): SnapshotBuildIssue[] {
  const map = new Map<string, SnapshotBuildIssue>();
  for (const issue of issues) {
    const key = `${issue.code}:${issue.field}:${issue.message}`;
    if (!map.has(key)) {
      map.set(key, issue);
    }
  }
  return Array.from(map.values());
}