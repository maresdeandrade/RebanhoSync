export type SourceRefKind =
  | "norma_oficial"
  | "bula"
  | "bibliografia"
  | "mv_responsavel"
  | "guideline_apoio";

export type SourceRef = {
  kind: SourceRefKind;
  title: string;
  issuer?: string;
  version?: string;
  url?: string;
  accessedAt?: string;
  fieldKeys: string[];
  limitation?: string;
};

export type WithdrawalApplicability =
  | "zero"
  | "period"
  | "unknown"
  | "not_applicable"
  | "not_permitted";

export type WithdrawalRule = {
  species?: string;
  aptitude?: "corte" | "leite" | "mista";
  meatDays?: number | null;
  // Kept for day-based labels and legacy contracts; milkWithdrawalHours is preferred.
  milkDays?: number | null;
  milkWithdrawalHours?: number | null;
  applicability?: WithdrawalApplicability;
  sourceRefs: SourceRef[];
  limitations?: string[];
};

export type SanitaryProduct = {
  id?: string;
  name: string;
  classKey?: string;
  activeIngredient?: string;
  presentation?: string;
  dose?: {
    quantity: number;
    unit: string;
    per?: "animal" | "kg_peso_vivo" | "dose";
  };
  route?: string;
  withdrawalRules: WithdrawalRule[];
  sourceRefs: SourceRef[];
};

export type SanitaryProtocolRule = {
  id: string;
  name: string;
  eligibilityWindow?: {
    start: {
      anchor: "nascimento" | "evento" | "entrada_lote" | "manual";
      offsetDays: number;
    };
    end?: {
      anchor: "nascimento" | "evento" | "entrada_lote" | "manual";
      offsetDays: number;
    };
    permissibility?: "recommended" | "allowed" | "limit";
    sourceRefs: SourceRef[];
  };
  doseIntervals?: Array<{
    fromDose: number;
    toDose: number;
    minDays?: number;
    recommendedDays?: number;
    maxDays?: number;
    sourceRefs: SourceRef[];
  }>;
  boosters?: Array<{
    afterDays?: number;
    recurringEveryDays?: number;
    sourceRefs: SourceRef[];
  }>;
  completionCriteria: {
    requiresExecutedEvent: true;
    compatibleProductId?: string;
    compatibleProductClass?: string;
    requiredDoseCount?: number;
    sourceRefs: SourceRef[];
  };
  productRequirement?: {
    kind: "specific_product" | "product_class";
    productId?: string;
    classKey?: string;
    sourceRefs: SourceRef[];
  };
  limitations?: string[];
};

export type WithdrawalSnapshotOnEvent = {
  productId?: string;
  productNameSnapshot: string;
  protocolRuleId?: string;
  meatWithdrawalDays?: number | null;
  milkWithdrawalDays?: number | null;
  milkWithdrawalHours?: number | null;
  meatWithdrawalUntil?: string | null;
  milkWithdrawalUntil?: string | null;
  calculatedAt: string;
  sourceRefs: SourceRef[];
  limitations?: string[];
};

export type SanitaryRuleValidationIssueCode =
  | "critical_field_missing_source"
  | "critical_field_guideline_only"
  | "critical_field_missing_field_key"
  | "withdrawal_missing_source"
  | "withdrawal_ambiguous"
  | "withdrawal_period_missing_value"
  | "withdrawal_negative_value"
  | "withdrawal_missing_species_or_aptitude"
  | "product_withdrawal_missing_source"
  | "product_withdrawal_missing_species_or_aptitude"
  | "product_dose_invalid_quantity"
  | "product_field_missing_source"
  | "product_field_guideline_only"
  | "product_field_missing_field_key"
  | "window_negative_offset"
  | "window_end_before_start"
  | "dose_interval_invalid_order"
  | "dose_interval_negative_days"
  | "dose_interval_inconsistent_days"
  | "booster_missing_schedule"
  | "booster_negative_days"
  | "completion_requires_executed_event"
  | "product_requirement_missing"
  | "product_requirement_incomplete"
  | "product_requirement_mismatch"
  | "product_requirement_kind_mismatch"
  | "snapshot_missing_source"
  | "snapshot_empty_product_name"
  | "snapshot_invalid_calculated_at"
  | "snapshot_withdrawal_missing_until";

export type SanitaryRuleValidationIssue = {
  code: SanitaryRuleValidationIssueCode;
  severity: "limitation" | "block";
  field: string;
  message: string;
};

export type SanitaryRuleValidationResult = {
  ok: boolean;
  issues: SanitaryRuleValidationIssue[];
};

const hasSourceRefs = (sourceRefs: readonly SourceRef[] | undefined): boolean =>
  Array.isArray(sourceRefs) && sourceRefs.length > 0;

const hasStrongSourceRef = (sourceRefs: readonly SourceRef[] | undefined): boolean =>
  hasSourceRefs(sourceRefs) &&
  sourceRefs.some((source) => source.kind !== "guideline_apoio");

const FIELD_KEY_ALIASES: Record<string, readonly string[]> = {
  withdrawalRules: [
    "withdrawalRules",
    "meatDays",
    "milkDays",
    "milkWithdrawalHours",
    "withdrawal",
    "withdrawalRules.meatDays",
    "withdrawalRules.milkWithdrawalHours",
  ],
};

const fieldKeysFor = (fieldKey: string): readonly string[] =>
  FIELD_KEY_ALIASES[fieldKey] ?? [fieldKey];

const sourceCoversField = (source: SourceRef, fieldKey: string): boolean => {
  const acceptedKeys = fieldKeysFor(fieldKey);
  return acceptedKeys.some((key) => source.fieldKeys.includes(key));
};

const hasStrongSourceRefForField = (
  sourceRefs: readonly SourceRef[] | undefined,
  fieldKey: string,
): boolean =>
  hasSourceRefs(sourceRefs) &&
  sourceRefs.some(
    (source) => source.kind !== "guideline_apoio" && sourceCoversField(source, fieldKey),
  );

const isWithdrawalDeclared = (rule: WithdrawalRule): boolean =>
  typeof rule.meatDays === "number" ||
  typeof rule.milkDays === "number" ||
  typeof rule.milkWithdrawalHours === "number" ||
  Boolean(rule.applicability);

const hasAmbiguousNullWithdrawal = (rule: WithdrawalRule): boolean =>
  rule.meatDays === null &&
  rule.milkDays === null &&
  (rule.milkWithdrawalHours === null || rule.milkWithdrawalHours === undefined) &&
  !rule.applicability;

const hasSpeciesOrAptitude = (rule: WithdrawalRule): boolean =>
  Boolean(rule.species?.trim()) || Boolean(rule.aptitude);

const hasNegativeWithdrawalValue = (rule: WithdrawalRule): boolean =>
  [rule.meatDays, rule.milkDays, rule.milkWithdrawalHours].some(
    (value) => typeof value === "number" && value < 0,
  );

const isValidIsoDate = (value: string): boolean => {
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
};

const issue = (
  code: SanitaryRuleValidationIssueCode,
  severity: SanitaryRuleValidationIssue["severity"],
  field: string,
  message: string,
): SanitaryRuleValidationIssue => ({ code, severity, field, message });

function validateCriticalSources(
  issues: SanitaryRuleValidationIssue[],
  field: string,
  sourceRefs: readonly SourceRef[] | undefined,
  fieldKey: string,
) {
  if (!hasSourceRefs(sourceRefs)) {
    issues.push(
      issue(
        "critical_field_missing_source",
        "block",
        field,
        "Campo critico exige fonte tecnica explicita.",
      ),
    );
    return;
  }

  if (!hasStrongSourceRef(sourceRefs)) {
    issues.push(
      issue(
        "critical_field_guideline_only",
        "block",
        field,
        "Guideline de apoio isolado nao valida campo critico de alto risco.",
      ),
    );
    return;
  }

  if (!hasStrongSourceRefForField(sourceRefs, fieldKey)) {
    issues.push(
      issue(
        "critical_field_missing_field_key",
        "block",
        field,
        `Fonte tecnica forte deve cobrir o campo critico "${fieldKey}" em fieldKeys.`,
      ),
    );
  }
}

function validateProductFieldSources(
  issues: SanitaryRuleValidationIssue[],
  field: string,
  sourceRefs: readonly SourceRef[] | undefined,
  fieldKey: string,
) {
  if (!hasSourceRefs(sourceRefs)) {
    issues.push(
      issue(
        "product_field_missing_source",
        "block",
        field,
        `Campo de produto "${fieldKey}" exige fonte tecnica explicita.`,
      ),
    );
    return;
  }

  if (!hasStrongSourceRef(sourceRefs)) {
    issues.push(
      issue(
        "product_field_guideline_only",
        "block",
        field,
        `Guideline de apoio isolado nao valida campo de produto "${fieldKey}".`,
      ),
    );
    return;
  }

  if (!hasStrongSourceRefForField(sourceRefs, fieldKey)) {
    issues.push(
      issue(
        "product_field_missing_field_key",
        "block",
        field,
        `Fonte tecnica forte deve cobrir o campo de produto "${fieldKey}" em fieldKeys.`,
      ),
    );
  }
}

export function validateSanitaryProduct(
  product: SanitaryProduct,
): SanitaryRuleValidationResult {
  const issues: SanitaryRuleValidationIssue[] = [];

  if (product.dose) {
    validateProductFieldSources(issues, "dose", product.sourceRefs, "dose");

    if (product.dose.quantity <= 0) {
      issues.push(
        issue(
          "product_dose_invalid_quantity",
          "block",
          "dose.quantity",
          "Dose do produto exige quantidade positiva.",
        ),
      );
    }
  }

  if (product.route) {
    validateProductFieldSources(issues, "route", product.sourceRefs, "route");
  }

  if (product.presentation) {
    validateProductFieldSources(issues, "presentation", product.sourceRefs, "presentation");
  }

  product.withdrawalRules.forEach((withdrawalRule, index) => {
    const field = `withdrawalRules[${index}]`;

    if (hasAmbiguousNullWithdrawal(withdrawalRule)) {
      issues.push(
        issue(
          "withdrawal_ambiguous",
          "block",
          field,
          "Carencia null/null precisa declarar zero, periodo, desconhecida, nao aplicavel ou uso nao permitido.",
        ),
      );
    }

    if (
      withdrawalRule.applicability === "period" &&
      typeof withdrawalRule.meatDays !== "number" &&
      typeof withdrawalRule.milkDays !== "number" &&
      typeof withdrawalRule.milkWithdrawalHours !== "number"
    ) {
      issues.push(
        issue(
          "withdrawal_period_missing_value",
          "block",
          field,
          "Carencia com periodo exige dias de carne, dias de leite ou horas de leite.",
        ),
      );
    }

    if (hasNegativeWithdrawalValue(withdrawalRule)) {
      issues.push(
        issue(
          "withdrawal_negative_value",
          "block",
          field,
          "Carencia nao pode ter dias ou horas negativos.",
        ),
      );
    }

    if (!isWithdrawalDeclared(withdrawalRule) && !hasAmbiguousNullWithdrawal(withdrawalRule)) {
      return;
    }

    if (!hasSourceRefs(withdrawalRule.sourceRefs)) {
      issues.push(
        issue(
          "product_withdrawal_missing_source",
          "block",
          `${field}.sourceRefs`,
          "Carencia do produto exige fonte explicita.",
        ),
      );
    } else if (!hasStrongSourceRef(withdrawalRule.sourceRefs)) {
      issues.push(
        issue(
          "critical_field_guideline_only",
          "block",
          `${field}.sourceRefs`,
          "Guideline de apoio isolado nao valida carencia do produto.",
        ),
      );
    } else if (!hasStrongSourceRefForField(withdrawalRule.sourceRefs, "withdrawalRules")) {
      issues.push(
        issue(
          "product_field_missing_field_key",
          "block",
          `${field}.sourceRefs`,
          'Fonte tecnica forte deve cobrir o campo de produto "withdrawalRules" em fieldKeys.',
        ),
      );
    }

    if (!hasSpeciesOrAptitude(withdrawalRule)) {
      issues.push(
        issue(
          "product_withdrawal_missing_species_or_aptitude",
          "limitation",
          field,
          "Carencia do produto precisa informar especie ou finalidade minima.",
        ),
      );
    }
  });

  return { ok: issues.length === 0, issues };
}

export function validateSanitaryProtocolRule(
  rule: SanitaryProtocolRule,
): SanitaryRuleValidationResult {
  const issues: SanitaryRuleValidationIssue[] = [];

  if (rule.eligibilityWindow) {
    validateCriticalSources(
      issues,
      "eligibilityWindow.sourceRefs",
      rule.eligibilityWindow.sourceRefs,
      "eligibilityWindow",
    );

    if (rule.eligibilityWindow.start.offsetDays < 0) {
      issues.push(
        issue(
          "window_negative_offset",
          "block",
          "eligibilityWindow.start.offsetDays",
          "Offset inicial da janela sanitaria nao pode ser negativo.",
        ),
      );
    }

    if (rule.eligibilityWindow.end?.offsetDays !== undefined) {
      if (rule.eligibilityWindow.end.offsetDays < 0) {
        issues.push(
          issue(
            "window_negative_offset",
            "block",
            "eligibilityWindow.end.offsetDays",
            "Offset final da janela sanitaria nao pode ser negativo.",
          ),
        );
      }

      if (
        rule.eligibilityWindow.start.anchor === rule.eligibilityWindow.end.anchor &&
        rule.eligibilityWindow.end.offsetDays < rule.eligibilityWindow.start.offsetDays
      ) {
        issues.push(
          issue(
            "window_end_before_start",
            "block",
            "eligibilityWindow.end.offsetDays",
            "Fim da janela sanitaria nao pode ser anterior ao inicio quando usa a mesma ancora.",
          ),
        );
      }
    }
  }

  rule.doseIntervals?.forEach((interval, index) => {
    validateCriticalSources(
      issues,
      `doseIntervals[${index}].sourceRefs`,
      interval.sourceRefs,
      "doseIntervals",
    );

    if (interval.toDose <= interval.fromDose) {
      issues.push(
        issue(
          "dose_interval_invalid_order",
          "block",
          `doseIntervals[${index}].toDose`,
          "Intervalo de doses exige toDose maior que fromDose.",
        ),
      );
    }

    const dayValues = [interval.minDays, interval.recommendedDays, interval.maxDays].filter(
      (value): value is number => value !== undefined,
    );
    if (dayValues.some((value) => value < 0)) {
      issues.push(
        issue(
          "dose_interval_negative_days",
          "block",
          `doseIntervals[${index}]`,
          "Intervalos entre doses nao podem ter dias negativos.",
        ),
      );
    }

    if (
      (interval.minDays !== undefined &&
        interval.recommendedDays !== undefined &&
        interval.minDays > interval.recommendedDays) ||
      (interval.recommendedDays !== undefined &&
        interval.maxDays !== undefined &&
        interval.recommendedDays > interval.maxDays) ||
      (interval.minDays !== undefined &&
        interval.maxDays !== undefined &&
        interval.minDays > interval.maxDays)
    ) {
      issues.push(
        issue(
          "dose_interval_inconsistent_days",
          "block",
          `doseIntervals[${index}]`,
          "Intervalo entre doses deve respeitar minDays <= recommendedDays <= maxDays quando informado.",
        ),
      );
    }
  });

  rule.boosters?.forEach((booster, index) => {
    validateCriticalSources(
      issues,
      `boosters[${index}].sourceRefs`,
      booster.sourceRefs,
      "boosters",
    );

    if (booster.afterDays === undefined && booster.recurringEveryDays === undefined) {
      issues.push(
        issue(
          "booster_missing_schedule",
          "block",
          `boosters[${index}]`,
          "Reforco deve informar afterDays ou recurringEveryDays.",
        ),
      );
    }

    if (
      (booster.afterDays !== undefined && booster.afterDays < 0) ||
      (booster.recurringEveryDays !== undefined && booster.recurringEveryDays < 0)
    ) {
      issues.push(
        issue(
          "booster_negative_days",
          "block",
          `boosters[${index}]`,
          "Reforco nao pode usar dias negativos.",
        ),
      );
    }
  });

  if (rule.completionCriteria.requiresExecutedEvent !== true) {
    issues.push(
      issue(
        "completion_requires_executed_event",
        "block",
        "completionCriteria.requiresExecutedEvent",
        "Conclusao sanitaria depende de evento executado.",
      ),
    );
  }

  validateCriticalSources(
    issues,
    "completionCriteria.sourceRefs",
    rule.completionCriteria.sourceRefs,
    "completionCriteria",
  );

  const requiresProduct =
    Boolean(rule.completionCriteria.compatibleProductId) ||
    Boolean(rule.completionCriteria.compatibleProductClass);

  if (requiresProduct && !rule.productRequirement) {
    issues.push(
      issue(
        "product_requirement_missing",
        "block",
        "productRequirement",
        "Protocolo que exige produto deve declarar productRequirement.",
      ),
    );
  }

  if (rule.productRequirement) {
    validateCriticalSources(
      issues,
      "productRequirement.sourceRefs",
      rule.productRequirement.sourceRefs,
      "productRequirement",
    );

    if (
      (rule.productRequirement.kind === "specific_product" &&
        !rule.productRequirement.productId) ||
      (rule.productRequirement.kind === "product_class" && !rule.productRequirement.classKey)
    ) {
      issues.push(
        issue(
          "product_requirement_incomplete",
          "block",
          "productRequirement",
          "Exigencia de produto precisa informar productId ou classKey conforme o tipo.",
        ),
      );
    }

    if (
      rule.completionCriteria.compatibleProductId &&
      rule.productRequirement.kind !== "specific_product"
    ) {
      issues.push(
        issue(
          "product_requirement_kind_mismatch",
          "block",
          "productRequirement.kind",
          "compatibleProductId exige productRequirement specific_product.",
        ),
      );
    }

    if (
      rule.completionCriteria.compatibleProductClass &&
      rule.productRequirement.kind !== "product_class"
    ) {
      issues.push(
        issue(
          "product_requirement_kind_mismatch",
          "block",
          "productRequirement.kind",
          "compatibleProductClass exige productRequirement product_class.",
        ),
      );
    }

    if (
      rule.completionCriteria.compatibleProductId &&
      rule.productRequirement.productId &&
      rule.completionCriteria.compatibleProductId !== rule.productRequirement.productId
    ) {
      issues.push(
        issue(
          "product_requirement_mismatch",
          "block",
          "productRequirement.productId",
          "compatibleProductId deve bater com productRequirement.productId.",
        ),
      );
    }

    if (
      rule.completionCriteria.compatibleProductClass &&
      rule.productRequirement.classKey &&
      rule.completionCriteria.compatibleProductClass !== rule.productRequirement.classKey
    ) {
      issues.push(
        issue(
          "product_requirement_mismatch",
          "block",
          "productRequirement.classKey",
          "compatibleProductClass deve bater com productRequirement.classKey.",
        ),
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateWithdrawalSnapshotOnEvent(
  snapshot: WithdrawalSnapshotOnEvent,
): SanitaryRuleValidationResult {
  const issues: SanitaryRuleValidationIssue[] = [];

  if (!snapshot.productNameSnapshot.trim()) {
    issues.push(
      issue(
        "snapshot_empty_product_name",
        "block",
        "productNameSnapshot",
        "Snapshot futuro de carencia deve preservar nome do produto executado.",
      ),
    );
  }

  if (!isValidIsoDate(snapshot.calculatedAt)) {
    issues.push(
      issue(
        "snapshot_invalid_calculated_at",
        "block",
        "calculatedAt",
        "Snapshot futuro de carencia exige calculatedAt em ISO estrito.",
      ),
    );
  }

  if (!hasSourceRefs(snapshot.sourceRefs)) {
    issues.push(
      issue(
        "snapshot_missing_source",
        "block",
        "sourceRefs",
        "Snapshot futuro de carencia no evento deve preservar fonte tecnica.",
      ),
    );
  } else if (!hasStrongSourceRef(snapshot.sourceRefs)) {
    issues.push(
      issue(
        "critical_field_guideline_only",
        "block",
        "sourceRefs",
        "Guideline de apoio isolado nao valida snapshot futuro de carencia.",
      ),
    );
  } else if (!hasStrongSourceRefForField(snapshot.sourceRefs, "withdrawalRules")) {
    issues.push(
      issue(
        "critical_field_missing_field_key",
        "block",
        "sourceRefs",
        "Fonte tecnica forte deve cobrir carencia em fieldKeys para validar snapshot futuro.",
      ),
    );
  }

  const hasMeatWithdrawalPeriod =
    typeof snapshot.meatWithdrawalDays === "number" && snapshot.meatWithdrawalDays > 0;
  const hasMilkWithdrawalPeriod =
    (typeof snapshot.milkWithdrawalDays === "number" && snapshot.milkWithdrawalDays > 0) ||
    (typeof snapshot.milkWithdrawalHours === "number" && snapshot.milkWithdrawalHours > 0);
  const hasExplicitLimitation = Boolean(snapshot.limitations?.some((value) => value.trim()));

  if (
    hasMeatWithdrawalPeriod &&
    !snapshot.meatWithdrawalUntil &&
    !hasExplicitLimitation
  ) {
    issues.push(
      issue(
        "snapshot_withdrawal_missing_until",
        "block",
        "meatWithdrawalUntil",
        "Snapshot com carencia de carne exige data final ou limitacao explicita.",
      ),
    );
  }

  if (hasMilkWithdrawalPeriod && !snapshot.milkWithdrawalUntil && !hasExplicitLimitation) {
    issues.push(
      issue(
        "snapshot_withdrawal_missing_until",
        "block",
        "milkWithdrawalUntil",
        "Snapshot com carencia de leite exige data final ou limitacao explicita.",
      ),
    );
  }

  return { ok: issues.length === 0, issues };
}
