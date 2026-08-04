type Row = Record<string, unknown>;

export interface SanitaryProductEvidenceCatalog {
  product: Row | null;
  sources: Row[];
  coverages: Row[];
  productSources: Row[];
  doseRules: Row[];
  withdrawalRules: Row[];
  withdrawalRuleSources: Row[];
  speciesAuthorizations: Row[];
  animals: Row[];
}

function record(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Row
    : null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function active(row: Row | undefined | null): row is Row {
  return Boolean(row && row.deleted_at == null);
}

export function validateSanitaryProductEvidenceShape(input: {
  event: Row;
  detail: Row;
  eventAnimals: unknown[];
}): string | null {
  const eventPayload = record(input.event.payload);
  const correction = record(eventPayload?.sanitary_correction);
  const validatesTechnicalCorrection = input.event.natureza === "correction" &&
    correction?.technical_correction === true;
  if (
    input.event.natureza !== "primary_execution" &&
    !validatesTechnicalCorrection
  ) return null;
  const productId = input.detail.produto_sanitario_v2_id;
  if (typeof productId !== "string") return null;
  const snapshot = record(input.detail.produto_snapshot);
  if (!snapshot) return "SANITARIO_PRODUCT_SNAPSHOT_REQUIRED";
  if (
    snapshot.schemaVersion !==
      "sanitario-executed-product-technical-snapshot-v2" ||
    snapshot.eventId !== input.event.id ||
    snapshot.executedProductId !== productId ||
    snapshot.executedProductName !== input.detail.produto_nome_snapshot ||
    snapshot.executedRoute !== input.detail.via_aplicacao ||
    !sameJson(snapshot.executedDose, {
      quantity: input.detail.dose_quantidade,
      unit: input.detail.dose_unidade,
      basis: record(snapshot.executedDose)?.basis,
    }) ||
    !Array.isArray(snapshot.fieldEvidence) ||
    !Array.isArray(snapshot.sourceRefs) ||
    "withdrawal_snapshot" in snapshot
  ) return "SANITARIO_PRODUCT_SNAPSHOT_FACTUAL_MISMATCH";

  const targetIds = new Set(
    input.eventAnimals.map((entry) => record(entry)?.animal_id),
  );
  for (const rawEvidence of snapshot.fieldEvidence) {
    const evidence = record(rawEvidence);
    const qualifiers = record(evidence?.qualifiers);
    if (!evidence || typeof evidence.fieldKey !== "string" || !qualifiers) {
      return "SANITARIO_PRODUCT_FIELD_EVIDENCE_INVALID";
    }
    if (
      Array.isArray(qualifiers.animalIds) &&
      qualifiers.animalIds.some((id) => !targetIds.has(id))
    ) {
      return "SANITARIO_PRODUCT_FIELD_ANIMAL_MISMATCH";
    }
    if (evidence.coverageStatus !== "covers") {
      if (
        evidence.sourceRef != null || evidence.sourceCoverageId != null ||
        evidence.productSource != null || evidence.technicalValue != null
      ) {
        return "SANITARIO_PRODUCT_UNCOVERED_FIELD_HAS_SOURCE";
      }
      continue;
    }
    if (
      !record(evidence.sourceRef) || !record(evidence.productSource) ||
      typeof evidence.sourceCoverageId !== "string"
    ) {
      return "SANITARIO_PRODUCT_COVERED_FIELD_SOURCE_REQUIRED";
    }
  }
  const withdrawal = record(snapshot.withdrawalSnapshot);
  if (withdrawal) {
    const effectiveAt = typeof correction?.effective_occurred_at === "string"
      ? correction.effective_occurred_at
      : record(input.event.payload)?.effective_occurred_at ??
        input.event.occurred_at;
    if (
      withdrawal.schemaVersion !==
        "sanitario-operational-withdrawal-snapshot-v2" ||
      withdrawal.eventId !== input.event.id ||
      withdrawal.productId !== productId ||
      (effectiveAt != null && withdrawal.factualReferenceAt !== effectiveAt) ||
      withdrawal.timezone !== "America/Sao_Paulo" ||
      !Array.isArray(withdrawal.results)
    ) return "SANITARIO_WITHDRAWAL_SNAPSHOT_FACTUAL_MISMATCH";
    const seen = new Set<string>();
    for (const rawResult of withdrawal.results) {
      const result = record(rawResult);
      const qualifiers = record(result?.qualifiers);
      const key = `${qualifiers?.animalId}:${result?.purpose}`;
      if (
        !result || !qualifiers || !targetIds.has(qualifiers.animalId) ||
        !["meat", "milk"].includes(String(result.purpose)) || seen.has(key)
      ) return "SANITARIO_WITHDRAWAL_RESULT_INVALID";
      seen.add(key);
      const proven = ["calculated", "explicit_absence", "not_permitted"]
        .includes(String(result.state));
      if (
        proven && (
          typeof result.ruleId !== "string" || !record(result.sourceRef) ||
          typeof result.sourceCoverageId !== "string" ||
          !record(result.productSource)
        )
      ) return "SANITARIO_WITHDRAWAL_EVIDENCE_REQUIRED";
      if (
        !proven && (
          result.ruleId != null || result.sourceRef != null ||
          result.sourceCoverageId != null ||
          result.productSource != null || result.endsAt != null
        )
      ) return "SANITARIO_WITHDRAWAL_UNPROVEN_RESULT_QUALIFIED";
      if (
        result.state === "calculated" &&
        (!record(result.period) || typeof result.endsAt !== "string")
      ) {
        return "SANITARIO_WITHDRAWAL_CALCULATION_INVALID";
      }
    }
  }
  return null;
}

export function validateSanitaryProductEvidenceCatalog(
  snapshotValue: unknown,
  fazendaId: string,
  catalog: SanitaryProductEvidenceCatalog,
): string | null {
  const snapshot = record(snapshotValue);
  if (!snapshot) return "SANITARIO_PRODUCT_SNAPSHOT_REQUIRED";
  const productSnapshot = record(snapshot.executedProductSnapshot);
  if (productSnapshot) {
    const product = catalog.product;
    if (
      !active(product) || product.status_curatorial !== "ativo" ||
      product.id !== snapshot.executedProductId ||
      productSnapshot.productId !== product.id ||
      productSnapshot.catalogUpdatedAt !== product.updated_at ||
      productSnapshot.nomeComercial !== product.nome_comercial ||
      productSnapshot.classe !== product.classe
    ) return "SANITARIO_PRODUCT_CATALOG_VERSION_MISMATCH";
  }

  for (const rawEvidence of snapshot.fieldEvidence as unknown[]) {
    const evidence = record(rawEvidence)!;
    if (evidence.coverageStatus !== "covers") continue;
    const sourceRef = record(evidence.sourceRef)!;
    const productSource = record(evidence.productSource)!;
    const qualifiers = record(evidence.qualifiers)!;
    const technicalValue = record(evidence.technicalValue);
    const source = catalog.sources.find((row) => row.id === sourceRef.id);
    const coverage = catalog.coverages.find((row) =>
      row.id === evidence.sourceCoverageId
    );
    const link = catalog.productSources.find((row) =>
      row.product_id === snapshot.executedProductId &&
      row.source_id === sourceRef.id &&
      row.field_key === evidence.fieldKey
    );
    if (
      !active(source) ||
      (source.scope === "fazenda" && source.fazenda_id !== fazendaId) ||
      source.version !== sourceRef.version || !active(coverage) ||
      coverage.source_id !== source.id ||
      coverage.field_key !== evidence.fieldKey ||
      coverage.coverage_status !== "covers" || !link ||
      productSource.productId !== link.product_id ||
      productSource.sourceId !== link.source_id ||
      productSource.fieldKey !== link.field_key
    ) return "SANITARIO_PRODUCT_FIELD_COVERAGE_MISMATCH";

    if (evidence.fieldKey === "dose" || evidence.fieldKey === "route") {
      const rule = catalog.doseRules.find((row) =>
        row.id === technicalValue?.doseRuleId
      );
      if (
        !active(rule) || rule.status_curatorial !== "ativo" ||
        rule.product_id !== snapshot.executedProductId ||
        rule.species_code !== (qualifiers.speciesCode ?? null) ||
        ![null, "all"].includes(rule.aptitude as null | string) ||
        (evidence.fieldKey === "dose" && (
          rule.dose_quantity !== technicalValue?.quantity ||
          rule.dose_unit !== technicalValue?.unit ||
          rule.dose_basis !== technicalValue?.basis
        )) ||
        (evidence.fieldKey === "route" && rule.route !== technicalValue?.route)
      ) return "SANITARIO_PRODUCT_FIELD_RULE_MISMATCH";
    }
    if (evidence.fieldKey === "species_authorization") {
      const authorization = catalog.speciesAuthorizations.find((row) =>
        row.id === technicalValue?.authorizationId
      );
      if (
        !active(authorization) ||
        authorization.product_id !== snapshot.executedProductId ||
        authorization.species_code !== qualifiers.speciesCode ||
        authorization.aptitude !== "all" ||
        authorization.authorization_status !==
          technicalValue?.authorizationStatus
      ) return "SANITARIO_PRODUCT_FIELD_APPLICABILITY_MISMATCH";
    }
    if (
      evidence.fieldKey === "presentation" &&
      (!productSnapshot ||
        productSnapshot.apresentacao !== technicalValue?.presentation)
    ) return "SANITARIO_PRODUCT_FIELD_RULE_MISMATCH";
  }

  const withdrawal = record(snapshot.withdrawalSnapshot);
  for (
    const rawResult of (withdrawal?.results as unknown[] | undefined) ?? []
  ) {
    const result = record(rawResult)!;
    if (
      !["calculated", "explicit_absence", "not_permitted"].includes(
        String(result.state),
      )
    ) continue;
    const sourceRef = record(result.sourceRef)!;
    const productSource = record(result.productSource)!;
    const qualifiers = record(result.qualifiers)!;
    const source = catalog.sources.find((row) => row.id === sourceRef.id);
    const coverage = catalog.coverages.find((row) =>
      row.id === result.sourceCoverageId
    );
    const link = catalog.productSources.find((row) =>
      row.product_id === snapshot.executedProductId &&
      row.source_id === sourceRef.id &&
      row.field_key === "withdrawal"
    );
    const rule = catalog.withdrawalRules.find((row) =>
      row.id === result.ruleId
    );
    const ruleSource = catalog.withdrawalRuleSources.find((row) =>
      row.withdrawal_rule_id === result.ruleId &&
      row.source_id === sourceRef.id &&
      row.field_key === "withdrawal"
    );
    if (
      !active(source) || source.strength !== "forte" ||
      !["SIM_BULA", "SIM_NORMA"].includes(String(source.evidence_status)) ||
      (source.scope === "fazenda" && source.fazenda_id !== fazendaId) ||
      source.version !== sourceRef.version || !active(coverage) ||
      coverage.source_id !== source.id || coverage.field_key !== "withdrawal" ||
      coverage.coverage_status !== "covers" || !link || !ruleSource ||
      productSource.productId !== link.product_id ||
      productSource.sourceId !== link.source_id ||
      !active(rule) || rule.status_curatorial !== "ativo" ||
      rule.product_id !== snapshot.executedProductId ||
      rule.species_code !== qualifiers.speciesCode ||
      !["all", qualifiers.aptitude].includes(rule.aptitude as string) ||
      (rule.route != null && rule.route !== qualifiers.route) ||
      (rule.dose_basis != null && rule.dose_basis !== qualifiers.doseBasis) ||
      rule.applicability !== result.applicability
    ) return "SANITARIO_WITHDRAWAL_CATALOG_MISMATCH";
    const period = record(result.period);
    if (
      result.state === "calculated" && (
        (result.purpose === "meat" &&
          (period?.unit !== "days" || period.value !== rule.meat_days)) ||
        (result.purpose === "milk" && !(
          (period?.unit === "hours" && period.value === rule.milk_hours) ||
          (period?.unit === "days" && period.value === rule.milk_days &&
            rule.milk_hours == null)
        ))
      )
    ) return "SANITARIO_WITHDRAWAL_RULE_MISMATCH";
  }

  const animalById = new Map(catalog.animals.map((row) => [row.id, row]));
  for (const rawEvidence of snapshot.fieldEvidence as unknown[]) {
    const evidence = record(rawEvidence)!;
    const qualifiers = record(evidence.qualifiers)!;
    if (!Array.isArray(qualifiers.animalIds)) continue;
    for (const animalId of qualifiers.animalIds) {
      const animal = animalById.get(animalId);
      if (
        !animal || animal.fazenda_id !== fazendaId ||
        animal.especie !== qualifiers.speciesCode
      ) {
        return "SANITARIO_PRODUCT_FIELD_APPLICABILITY_MISMATCH";
      }
    }
  }
  return null;
}
