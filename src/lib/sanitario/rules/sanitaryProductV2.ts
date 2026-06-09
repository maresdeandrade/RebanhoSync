import {
  buildValidationResultV2,
  hasStrongSourceCoveringFieldV2,
  mergeValidationResultsV2,
  type SanitaryEvidenceStatusV2,
  type SanitarySourceRefV2,
  type SanitaryValidationIssueV2,
  type SanitaryValidationResultV2,
  validateSourceCoverageForCriticalField,
} from "./sanitarySourceV2";

export type SanitarySpeciesCodeV2 = "bovino" | "bubalino" | "outro";
export type SanitaryAptitudeV2 = "corte" | "leite" | "mista" | "all";
export type SanitaryCuratorialStatusV2 = "ativo" | "precisa_validar" | "bloqueado" | "arquivado";
export type SanitaryDoseBasisV2 = "animal" | "kg_peso_vivo" | "dose";
export type WithdrawalApplicabilityV2 =
  | "period"
  | "zero"
  | "not_applicable"
  | "unknown"
  | "not_permitted";

export type SpeciesAuthorizationV2 = {
  productId?: string;
  speciesCode: SanitarySpeciesCodeV2;
  authorizationStatus: SanitaryEvidenceStatusV2;
  aptitude: SanitaryAptitudeV2;
  sexo?: string | null;
  idadeMinDias?: number | null;
  idadeMaxDias?: number | null;
  lactacaoPermitida?: boolean | null;
  gestacaoPermitida?: boolean | null;
  requiresMvResponsavel?: boolean;
  sourceRefs: SanitarySourceRefV2[];
  limitations?: string[];
};

export type ProductDoseRuleV2 = {
  productId?: string;
  speciesCode?: SanitarySpeciesCodeV2 | null;
  aptitude?: SanitaryAptitudeV2 | null;
  route: string;
  doseQuantity: number;
  doseUnit: string;
  doseBasis: SanitaryDoseBasisV2;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  sourceRefs: SanitarySourceRefV2[];
  statusCuratorial: SanitaryCuratorialStatusV2;
  limitations?: string[];
};

export type WithdrawalRuleV2 = {
  id?: string;
  productId?: string;
  speciesCode: SanitarySpeciesCodeV2;
  aptitude: Exclude<SanitaryAptitudeV2, "all">;
  route?: string | null;
  doseBasis?: SanitaryDoseBasisV2 | null;
  meatDays?: number | null;
  milkDays?: number | null;
  milkHours?: number | null;
  applicability: WithdrawalApplicabilityV2;
  zeroRequiresExplicitSource?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  statusCuratorial: SanitaryCuratorialStatusV2;
  sourceRefs: SanitarySourceRefV2[];
  limitations?: string[];
};

export type SanitaryProductV2 = {
  id?: string;
  nomeComercial: string;
  fabricante?: string | null;
  registroOrgao?: string | null;
  registroNumero?: string | null;
  classe: string;
  principioAtivo?: string | null;
  tipoProduto: string;
  apresentacao?: string | null;
  statusCuratorial: SanitaryCuratorialStatusV2;
  sourceRefs: SanitarySourceRefV2[];
  speciesAuthorizations?: SpeciesAuthorizationV2[];
  doseRules?: ProductDoseRuleV2[];
  withdrawalRules?: WithdrawalRuleV2[];
  metadata?: Record<string, unknown>;
};

function pushNumericRangeIssue(
  issues: SanitaryValidationIssueV2[],
  field: string,
  min?: number | null,
  max?: number | null,
) {
  if ((min != null && min < 0) || (max != null && max < 0) || (min != null && max != null && min > max)) {
    issues.push({
      code: "invalid_numeric_range",
      severity: "block",
      field,
      message: "Intervalo numerico invalido.",
    });
  }
}

export function validateSpeciesAuthorizationV2(
  authorization: SpeciesAuthorizationV2,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  pushNumericRangeIssue(
    issues,
    "idade",
    authorization.idadeMinDias ?? null,
    authorization.idadeMaxDias ?? null,
  );

  if (authorization.authorizationStatus === "NAO_AUTORIZADO") {
    issues.push({
      code: "species_not_authorized",
      severity: "block",
      field: "authorizationStatus",
      message: "Autorizacao por especie marcada como NAO_AUTORIZADO bloqueia uso declarado.",
    });
  }

  if (authorization.authorizationStatus === "PRECISA_VALIDAR") {
    issues.push({
      code: "species_authorization_needs_validation",
      severity: "limitation",
      field: "authorizationStatus",
      message: "Autorizacao por especie exige validacao antes de automacao.",
    });
  }

  if (authorization.authorizationStatus === "EXTRAPOLADO" && !authorization.requiresMvResponsavel) {
    issues.push({
      code: "extrapolated_species_requires_mv",
      severity: "block",
      field: "requiresMvResponsavel",
      message: "Uso extrapolado exige decisao veterinaria responsavel auditavel.",
    });
  }

  if (
    authorization.authorizationStatus === "SIM_BULA" ||
    authorization.authorizationStatus === "SIM_NORMA"
  ) {
    issues.push(
      ...validateSourceCoverageForCriticalField(
        authorization.sourceRefs,
        "species_authorization",
      ).issues,
    );
  }

  if (
    authorization.speciesCode === "bubalino" &&
    !hasStrongSourceCoveringFieldV2(authorization.sourceRefs, "species_authorization")
  ) {
    issues.push({
      code: "bubalino_requires_explicit_authorization",
      severity: "block",
      field: "speciesCode",
      message: "Bubalino nao herda autorizacao de bovino; exige fonte explicita.",
    });
  }

  return buildValidationResultV2(issues);
}

export function validateProductDoseRuleV2(rule: ProductDoseRuleV2): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (!rule.route?.trim()) {
    issues.push({
      code: "dose_route_missing",
      severity: "block",
      field: "route",
      message: "Regra de dose exige via estruturada.",
    });
  }

  if (!(rule.doseQuantity > 0)) {
    issues.push({
      code: "dose_quantity_invalid",
      severity: "block",
      field: "doseQuantity",
      message: "Regra de dose exige quantidade positiva.",
    });
  }

  if (!rule.doseUnit?.trim()) {
    issues.push({
      code: "dose_unit_missing",
      severity: "block",
      field: "doseUnit",
      message: "Regra de dose exige unidade.",
    });
  }

  pushNumericRangeIssue(issues, "weight", rule.minWeightKg ?? null, rule.maxWeightKg ?? null);
  issues.push(...validateSourceCoverageForCriticalField(rule.sourceRefs, "dose").issues);
  issues.push(...validateSourceCoverageForCriticalField(rule.sourceRefs, "route").issues);

  return buildValidationResultV2(issues);
}

export function validateWithdrawalRuleV2(rule: WithdrawalRuleV2): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];
  const values = [rule.meatDays, rule.milkDays, rule.milkHours];

  if (values.some((value) => value != null && value < 0)) {
    issues.push({
      code: "withdrawal_negative_value",
      severity: "block",
      field: "withdrawal",
      message: "Carencia nao pode ter dias ou horas negativos.",
    });
  }

  if (rule.applicability === "period" && values.every((value) => value == null)) {
    issues.push({
      code: "withdrawal_period_missing_value",
      severity: "block",
      field: "withdrawal",
      message: "Carencia period exige carne, leite em dias ou leite em horas.",
    });
  }

  if (rule.applicability === "zero" && rule.zeroRequiresExplicitSource !== false) {
    issues.push(...validateSourceCoverageForCriticalField(rule.sourceRefs, "withdrawal").issues);
  }

  if (rule.applicability === "period") {
    issues.push(...validateSourceCoverageForCriticalField(rule.sourceRefs, "withdrawal").issues);
  }

  if (rule.applicability === "unknown") {
    issues.push({
      code: "withdrawal_unknown_blocks_clearance",
      severity: "block",
      field: "applicability",
      message: "Carencia desconhecida bloqueia leitura de livre de carencia.",
    });
  }

  if (rule.applicability === "not_permitted") {
    issues.push({
      code: "withdrawal_not_permitted_blocks_context",
      severity: "block",
      field: "applicability",
      message: "Contexto declarado nao permite uso do produto.",
    });
  }

  return buildValidationResultV2(issues);
}

export function validateSanitaryProductV2(product: SanitaryProductV2): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (!product.nomeComercial?.trim()) {
    issues.push({
      code: "product_missing_name",
      severity: "block",
      field: "nomeComercial",
      message: "Produto sanitario v2 exige nome comercial.",
    });
  }

  if (!product.classe?.trim() || !product.tipoProduto?.trim()) {
    issues.push({
      code: "product_missing_classification",
      severity: "block",
      field: "classe",
      message: "Produto sanitario v2 exige classe e tipo.",
    });
  }

  if (product.apresentacao) {
    issues.push(
      ...validateSourceCoverageForCriticalField(product.sourceRefs, "presentation").issues,
    );
  }

  const nestedResults = [
    ...(product.speciesAuthorizations ?? []).map(validateSpeciesAuthorizationV2),
    ...(product.doseRules ?? []).map(validateProductDoseRuleV2),
    ...(product.withdrawalRules ?? []).map(validateWithdrawalRuleV2),
  ];

  return mergeValidationResultsV2(buildValidationResultV2(issues), ...nestedResults);
}
