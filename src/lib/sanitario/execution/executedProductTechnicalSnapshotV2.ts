import type {
  SanitarioFonteCoberturaCampoLocalV2,
  SanitarioFonteTecnicaLocalV2,
  SanitarioProdutoDoseRuleLocalV2,
  SanitarioProdutoEspecieAutorizacaoLocalV2,
  SanitarioProdutoFonteLocalV2,
  SanitarioProdutoLocalV2,
  SanitarioTechnicalSpeciesCodeV2,
} from "@/lib/offline/types";
import type { SanitarySourceRefV2 } from "@/lib/sanitario/rules/sanitarySourceV2";
import type {
  ExecutedProductFieldEvidenceV2,
  ExecutedProductTechnicalSnapshotV2,
} from "@/lib/sanitario/rules/sanitarySnapshotsV2";
import { validateExecutedProductTechnicalSnapshotV2 } from "@/lib/sanitario/rules/sanitarySnapshotsV2";

export type ExecutedProductAnimalContextV2 = {
  animalId: string;
  speciesCode: SanitarioTechnicalSpeciesCodeV2 | null;
};

export type BuildExecutedProductTechnicalSnapshotInputV2 = {
  eventId: string;
  fazendaId: string;
  executedProductId: string;
  executedProductName: string;
  executedProductClass?: string | null;
  executedDose: { quantity: number; unit: string; basis?: "animal" | "kg_peso_vivo" | "dose" };
  executedRoute: string;
  animals: ExecutedProductAnimalContextV2[];
  product: SanitarioProdutoLocalV2 | null;
  productSources: SanitarioProdutoFonteLocalV2[];
  sources: SanitarioFonteTecnicaLocalV2[];
  coverages: SanitarioFonteCoberturaCampoLocalV2[];
  doseRules: SanitarioProdutoDoseRuleLocalV2[];
  speciesAuthorizations: SanitarioProdutoEspecieAutorizacaoLocalV2[];
};

const TECHNICAL_FIELDS = ["species_authorization", "dose", "route", "presentation"] as const;

function strings(values: Array<Record<string, unknown> | string>): string[] {
  return values.map((value) => typeof value === "string" ? value : JSON.stringify(value)).sort();
}

function sourceRef(
  source: SanitarioFonteTecnicaLocalV2,
  coverages: SanitarioFonteCoberturaCampoLocalV2[],
): SanitarySourceRefV2 {
  return {
    id: source.id,
    kind: source.kind,
    scope: source.scope,
    fazendaId: source.fazenda_id,
    title: source.title,
    issuer: source.issuer,
    version: source.version,
    publishedAt: source.published_at,
    accessedAt: source.accessed_at,
    url: source.url,
    jurisdictionCountry: source.jurisdiction_country,
    jurisdictionUf: source.jurisdiction_uf,
    jurisdictionZone: source.jurisdiction_zone,
    strength: source.strength,
    evidenceStatus: source.evidence_status,
    fieldKeys: coverages
      .filter((entry) => entry.source_id === source.id && !entry.deleted_at && entry.coverage_status === "covers")
      .map((entry) => entry.field_key)
      .sort(),
    limitations: strings(source.limitations),
    metadata: source.metadata,
    createdBy: source.created_by,
  };
}

function factualValue(input: BuildExecutedProductTechnicalSnapshotInputV2, fieldKey: string) {
  if (fieldKey === "dose") return { quantity: input.executedDose.quantity, unit: input.executedDose.unit };
  if (fieldKey === "route") return { route: input.executedRoute };
  if (fieldKey === "presentation") return { presentation: input.product?.apresentacao ?? null };
  return { speciesCodes: Array.from(new Set(input.animals.map((animal) => animal.speciesCode))).sort() };
}

function evidenceFor(
  input: BuildExecutedProductTechnicalSnapshotInputV2,
  fieldKey: string,
  technicalValue: Record<string, unknown> | null,
  qualifiers: ExecutedProductFieldEvidenceV2["qualifiers"],
  reasonWhenMissing: string,
): ExecutedProductFieldEvidenceV2 {
  const links = input.productSources.filter(
    (link) => link.product_id === input.executedProductId && link.field_key === fieldKey,
  );
  const candidates = links.flatMap((link) => {
    const source = input.sources.find((entry) =>
      entry.id === link.source_id &&
      !entry.deleted_at &&
      (entry.scope === "global" || entry.fazenda_id === input.fazendaId)
    );
    const coverage = input.coverages.find((entry) =>
      entry.source_id === link.source_id && entry.field_key === fieldKey && !entry.deleted_at
    );
    return source && coverage?.coverage_status === "covers"
      ? [{ link, source, coverage }]
      : [];
  });
  if (technicalValue && candidates.length === 1) {
    const candidate = candidates[0];
    return {
      fieldKey,
      coverageStatus: "covers",
      factualValue: factualValue(input, fieldKey),
      technicalValue,
      sourceRef: sourceRef(candidate.source, input.coverages),
      sourceCoverageId: candidate.coverage.id,
      productSource: {
        productId: candidate.link.product_id,
        sourceId: candidate.link.source_id,
        fieldKey: candidate.link.field_key,
      },
      qualifiers,
      reason: "covered",
    };
  }
  return {
    fieldKey,
    coverageStatus: candidates.length > 1 ? "partially_covers" : "does_not_cover",
    factualValue: factualValue(input, fieldKey),
    technicalValue: null,
    sourceRef: null,
    sourceCoverageId: null,
    productSource: null,
    qualifiers,
    reason: candidates.length > 1 ? "ambiguous_coverage" : reasonWhenMissing,
  };
}

function groupAnimals(input: BuildExecutedProductTechnicalSnapshotInputV2) {
  const groups = new Map<SanitarioTechnicalSpeciesCodeV2 | null, string[]>();
  for (const animal of input.animals) {
    const ids = groups.get(animal.speciesCode) ?? [];
    ids.push(animal.animalId);
    groups.set(animal.speciesCode, ids);
  }
  return [...groups.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
}

export function buildExecutedProductTechnicalSnapshotV2(
  input: BuildExecutedProductTechnicalSnapshotInputV2,
): ExecutedProductTechnicalSnapshotV2 {
  const limitations: string[] = [];
  const fieldEvidence: ExecutedProductFieldEvidenceV2[] = [];
  const productUsable = input.product && !input.product.deleted_at && input.product.status_curatorial === "ativo";
  if (!productUsable) limitations.push("technical_product_unavailable");
  if (productUsable && input.product!.nome_comercial.trim() !== input.executedProductName.trim()) {
    limitations.push("executed_product_name_divergent");
  }
  if (productUsable && input.executedProductClass && input.product!.classe !== input.executedProductClass) {
    limitations.push("executed_product_class_divergent");
  }

  for (const [speciesCode, animalIds] of groupAnimals(input)) {
    const authorizations = speciesCode
      ? input.speciesAuthorizations.filter((entry) =>
          !entry.deleted_at &&
          entry.product_id === input.executedProductId && entry.species_code === speciesCode && entry.aptitude === "all"
        )
      : [];
    const authorization = authorizations.length === 1 ? authorizations[0] : null;
    fieldEvidence.push(evidenceFor(
      input,
      "species_authorization",
      authorization ? {
        authorizationId: authorization.id,
        authorizationStatus: authorization.authorization_status,
      } : null,
      { speciesCode, aptitude: authorization?.aptitude ?? null, animalIds: [...animalIds].sort() },
      authorizations.length > 1 ? "ambiguous_applicability" : "species_authorization_not_applicable",
    ));

    const applicableRules = input.doseRules.filter((entry) =>
      !entry.deleted_at && entry.status_curatorial === "ativo" &&
      entry.product_id === input.executedProductId &&
      (entry.species_code === null || entry.species_code === speciesCode) &&
      (entry.aptitude === null || entry.aptitude === "all")
    );
    const doseRules = applicableRules.filter((entry) =>
      entry.route === input.executedRoute &&
      entry.dose_quantity === input.executedDose.quantity &&
      entry.dose_unit === input.executedDose.unit
    );
    const doseRule = doseRules.length === 1 ? doseRules[0] : null;
    fieldEvidence.push(evidenceFor(
      input,
      "dose",
      doseRule ? {
        doseRuleId: doseRule.id,
        quantity: doseRule.dose_quantity,
        unit: doseRule.dose_unit,
        basis: doseRule.dose_basis,
      } : null,
      { speciesCode, aptitude: doseRule?.aptitude ?? null, route: doseRule?.route ?? null, doseBasis: doseRule?.dose_basis ?? null, animalIds: [...animalIds].sort() },
      doseRules.length > 1 ? "ambiguous_applicability" : "factual_value_divergent",
    ));
    const routeRules = applicableRules.filter((entry) => entry.route === input.executedRoute);
    const routeRule = routeRules.length === 1 ? routeRules[0] : null;
    fieldEvidence.push(evidenceFor(
      input,
      "route",
      routeRule ? { doseRuleId: routeRule.id, route: routeRule.route } : null,
      { speciesCode, aptitude: routeRule?.aptitude ?? null, route: routeRule?.route ?? null, doseBasis: routeRule?.dose_basis ?? null, animalIds: [...animalIds].sort() },
      routeRules.length > 1 ? "ambiguous_applicability" : "factual_value_divergent",
    ));
  }
  if (productUsable && input.product!.apresentacao) {
    fieldEvidence.push(evidenceFor(
      input,
      "presentation",
      { presentation: input.product!.apresentacao },
      {},
      "technical_source_unavailable",
    ));
  }

  const sourceRefs = Array.from(
    new Map(fieldEvidence.flatMap((entry) => entry.sourceRef ? [[entry.sourceRef.id!, entry.sourceRef] as const] : [])).values(),
  ).sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""));
  const snapshot: ExecutedProductTechnicalSnapshotV2 = {
    schemaVersion: "sanitario-executed-product-technical-snapshot-v2",
    eventId: input.eventId,
    executedProductId: input.executedProductId,
    executedProductName: input.executedProductName.trim(),
    executedProductSnapshot: productUsable ? {
      productId: input.product!.id,
      nomeComercial: input.product!.nome_comercial,
      fabricante: input.product!.fabricante,
      registroOrgao: input.product!.registro_orgao,
      registroNumero: input.product!.registro_numero,
      catalogUpdatedAt: input.product!.updated_at,
      classe: input.product!.classe,
      principioAtivo: input.product!.principio_ativo,
      tipoProduto: input.product!.tipo_produto,
      apresentacao: input.product!.apresentacao,
      speciesCode: null,
      authorizationStatus: null,
      sourceRefs,
    } : null,
    executedDose: {
      quantity: input.executedDose.quantity,
      unit: input.executedDose.unit,
      basis: input.executedDose.basis ?? "dose",
    },
    executedRoute: input.executedRoute,
    fieldEvidence: fieldEvidence.sort((left, right) =>
      `${left.fieldKey}:${left.qualifiers.speciesCode ?? ""}`.localeCompare(`${right.fieldKey}:${right.qualifiers.speciesCode ?? ""}`)
    ),
    sourceRefs,
    limitations: Array.from(new Set(limitations)).sort(),
  };
  const validation = validateExecutedProductTechnicalSnapshotV2(snapshot);
  if (!validation.ok) throw new Error(`SANITARY_EXECUTED_PRODUCT_SNAPSHOT_INVALID:${validation.issues.map((issue) => issue.code).join(",")}`);
  return snapshot;
}

export { TECHNICAL_FIELDS };
