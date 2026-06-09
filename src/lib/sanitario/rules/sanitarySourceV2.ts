export type SanitarySourceKindV2 =
  | "norma_oficial"
  | "bula"
  | "registro_produto"
  | "bibliografia"
  | "guideline_apoio"
  | "mv_responsavel";

export type SanitarySourceScopeV2 = "global" | "fazenda";
export type SanitarySourceStrengthV2 = "forte" | "apoio" | "fraca";

export type SanitaryEvidenceStatusV2 =
  | "SIM_BULA"
  | "SIM_NORMA"
  | "PRECISA_VALIDAR"
  | "NAO_AUTORIZADO"
  | "EXTRAPOLADO";

export type SourceCoverageStatusV2 = "covers" | "partially_covers" | "does_not_cover";

export type SanitaryValidationSeverityV2 = "block" | "limitation";

export type SanitaryValidationIssueV2 = {
  code: string;
  severity: SanitaryValidationSeverityV2;
  field: string;
  message: string;
};

export type SanitaryValidationResultV2 = {
  ok: boolean;
  issues: SanitaryValidationIssueV2[];
};

export type SanitarySourceRefV2 = {
  id?: string;
  kind: SanitarySourceKindV2;
  scope?: SanitarySourceScopeV2;
  fazendaId?: string | null;
  title: string;
  issuer?: string | null;
  version?: string | null;
  publishedAt?: string | null;
  accessedAt?: string | null;
  url?: string | null;
  jurisdictionCountry?: string | null;
  jurisdictionUf?: string | null;
  jurisdictionZone?: string | null;
  strength: SanitarySourceStrengthV2;
  evidenceStatus: SanitaryEvidenceStatusV2;
  fieldKeys: string[];
  limitations?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type FieldSourceStatus = {
  fieldKey: string;
  coverageStatus: SourceCoverageStatusV2;
  sourceRefs: SanitarySourceRefV2[];
  limitations?: string[];
};

export const SANITARY_CRITICAL_FIELD_KEYS_V2 = [
  "species_authorization",
  "dose",
  "route",
  "presentation",
  "withdrawal",
  "legal_status",
  "eligibility_rule",
  "operational_window",
  "product_requirement",
] as const;

export type SanitaryCriticalFieldKeyV2 = (typeof SANITARY_CRITICAL_FIELD_KEYS_V2)[number];

export function buildValidationResultV2(
  issues: SanitaryValidationIssueV2[],
): SanitaryValidationResultV2 {
  return { ok: issues.length === 0, issues };
}

export function hasStrongSourceCoveringFieldV2(
  sources: SanitarySourceRefV2[] | null | undefined,
  fieldKey: string,
): boolean {
  return (sources ?? []).some(
    (source) =>
      source.strength === "forte" &&
      source.kind !== "guideline_apoio" &&
      source.fieldKeys.includes(fieldKey) &&
      (source.evidenceStatus === "SIM_BULA" || source.evidenceStatus === "SIM_NORMA"),
  );
}

export function validateTechnicalSourceV2(
  source: SanitarySourceRefV2,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (!source.title?.trim()) {
    issues.push({
      code: "source_missing_title",
      severity: "block",
      field: "title",
      message: "Fonte tecnica v2 exige titulo.",
    });
  }

  if (!Array.isArray(source.fieldKeys) || source.fieldKeys.length === 0) {
    issues.push({
      code: "source_missing_field_keys",
      severity: "block",
      field: "fieldKeys",
      message: "Fonte tecnica v2 deve declarar os field_keys cobertos.",
    });
  }

  if (source.kind === "guideline_apoio" && source.strength === "forte") {
    issues.push({
      code: "guideline_cannot_be_strong_source",
      severity: "block",
      field: "strength",
      message: "Guideline de apoio nao pode ser fonte forte isolada.",
    });
  }

  if (source.kind === "mv_responsavel" && source.scope !== "fazenda") {
    issues.push({
      code: "mv_source_requires_farm_scope",
      severity: "block",
      field: "scope",
      message: "Fonte MV responsavel deve ter escopo da fazenda.",
    });
  }

  if (source.scope === "fazenda" && !source.fazendaId) {
    issues.push({
      code: "farm_source_requires_fazenda",
      severity: "block",
      field: "fazendaId",
      message: "Fonte tecnica da fazenda exige fazendaId.",
    });
  }

  if ((source.scope ?? "global") === "global" && source.fazendaId) {
    issues.push({
      code: "global_source_must_not_have_fazenda",
      severity: "block",
      field: "fazendaId",
      message: "Fonte tecnica global nao deve carregar fazendaId.",
    });
  }

  if (
    source.strength === "forte" &&
    source.evidenceStatus !== "SIM_BULA" &&
    source.evidenceStatus !== "SIM_NORMA"
  ) {
    issues.push({
      code: "strong_source_requires_authoritative_status",
      severity: "block",
      field: "evidenceStatus",
      message: "Fonte forte precisa indicar SIM_BULA ou SIM_NORMA.",
    });
  }

  return buildValidationResultV2(issues);
}

export function validateSourceCoverageForCriticalField(
  sources: SanitarySourceRefV2[] | null | undefined,
  fieldKey: string,
): SanitaryValidationResultV2 {
  const issues: SanitaryValidationIssueV2[] = [];

  if (!sources || sources.length === 0) {
    issues.push({
      code: "critical_field_missing_source",
      severity: "block",
      field: fieldKey,
      message: "Campo critico exige fonte tecnica.",
    });
    return buildValidationResultV2(issues);
  }

  for (const [index, source] of sources.entries()) {
    const sourceResult = validateTechnicalSourceV2(source);
    issues.push(
      ...sourceResult.issues.map((issue) => ({
        ...issue,
        field: `${fieldKey}.sourceRefs[${index}].${issue.field}`,
      })),
    );
  }

  if (!hasStrongSourceCoveringFieldV2(sources, fieldKey)) {
    issues.push({
      code: "critical_field_missing_strong_coverage",
      severity: "block",
      field: fieldKey,
      message: "Campo critico exige fonte forte cobrindo o field_key especifico.",
    });
  }

  return buildValidationResultV2(issues);
}

export function mergeValidationResultsV2(
  ...results: SanitaryValidationResultV2[]
): SanitaryValidationResultV2 {
  return buildValidationResultV2(results.flatMap((result) => result.issues));
}
