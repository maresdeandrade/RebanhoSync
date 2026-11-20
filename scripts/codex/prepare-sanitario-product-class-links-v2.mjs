// Local preparation only. Never connects to a database or approves products.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const sourcePath =
  "docs/review/evidence/SANITARIO_V2_C02_F6_CLOSURE_ADMIN_BEFORE_20261029.json";
const bytes = readFileSync(sourcePath);
const snapshot = JSON.parse(bytes);
const rows = snapshot.rows;
const products = rows.sanitario_produtos_v2.filter(
  (row) => row.status_curatorial === "ativo" && !row.deleted_at,
);
assert.equal(products.length, 39);
// Explicit pharmacological review of persisted composition, not candidate metadata.
// No species, dose, withdrawal or protocol eligibility is inferred from this map.
const reviewed = {
  P01: ["vacina_brucelose_b19"],
  P03: ["vacina_raiva_herbivoros"],
  P05: ["vacina_clostridial"],
  P06: ["vacina_clostridial"],
  P07: ["vacina_ibr_bvd", "vacina_leptospirose"],
  P08: ["vacina_ibr_bvd", "vacina_leptospirose"],
  P09: ["vacina_ibr_bvd", "vacina_leptospirose"],
  P11: ["lactonas_macrociclicas"],
  P12: ["lactonas_macrociclicas"],
  P13: ["benzimidazois"],
  P16: ["vacina_brucelose_b19"],
  P17: ["vacina_raiva_herbivoros"],
  P18: ["vacina_raiva_herbivoros"],
  P19: ["vacina_clostridial"],
  P20: ["vacina_clostridial"],
  P21: ["vacina_clostridial"],
  P22: ["vacina_clostridial"],
  P23: ["vacina_clostridial"],
  P24: ["vacina_ibr_bvd"],
  P25: ["vacina_ibr_bvd"],
  P26: ["vacina_ibr_bvd"],
  P27: ["vacina_ibr_bvd", "vacina_leptospirose"],
  P28: ["vacina_clostridial"],
  P29: ["lactonas_macrociclicas"],
  P30: ["lactonas_macrociclicas"],
  P31: ["lactonas_macrociclicas"],
  P32: ["lactonas_macrociclicas"],
  P33: ["imidazotiazoleis"],
  P34: ["imidazotiazoleis"],
  P36: ["lactonas_macrociclicas"],
  P37: ["lactonas_macrociclicas"],
  P38: ["lactonas_macrociclicas"],
};
const matrix = products
  .sort((a, b) =>
    a.metadata.research_lot_code.localeCompare(b.metadata.research_lot_code),
  )
  .map((product) => {
    const code = product.metadata.research_lot_code;
    const sources = rows.sanitario_produto_fontes_v2
      .filter(
        (link) =>
          link.product_id === product.id && link.field_key === "composition",
      )
      .flatMap((link) => {
        const source = rows.sanitario_fontes_tecnicas_v2.find(
          (row) => row.id === link.source_id && !row.deleted_at,
        );
        const coverage = rows.sanitario_fonte_cobertura_campos_v2.find(
          (row) =>
            row.source_id === link.source_id &&
            row.field_key === "composition" &&
            row.coverage_status === "covers" &&
            !row.deleted_at,
        );
        return source && coverage
          ? [
              {
                sourceId: source.id,
                coverageId: coverage.id,
                url: source.url,
                strength: source.strength,
                evidenceStatus: source.evidence_status,
              },
            ]
          : [];
      });
    const classKeys = reviewed[code] ?? [];
    if (classKeys.length)
      assert(product.principio_ativo?.trim(), `Missing composition: ${code}`);
    return {
      code,
      productId: product.id,
      name: product.nome_comercial,
      cadastralStatus: "ativo",
      cadastralApprovalPreserved: true,
      composition: product.principio_ativo,
      pharmacologicalAssessment: classKeys.length
        ? "demonstrated_from_persisted_composition"
        : code === "P15"
          ? "composition_missing"
          : "outside_existing_technical_classes",
      reviewedClassKeys: classKeys,
      compositionEvidence: sources,
      preparedLinks: classKeys.map((classKey) => ({
        product_id: product.id,
        class_key: classKey,
        class_id: null,
        status_curatorial: "precisa_validar",
        source_refs: sources
          .filter(
            (source) =>
              source.strength === "forte" &&
              ["SIM_BULA", "SIM_NORMA"].includes(source.evidenceStatus),
          )
          .map((source) => ({
            id: source.sourceId,
            field: "product_class",
            basedOnField: "composition",
            coverageId: source.coverageId,
          })),
        pending: [
          "resolve_actual_approved_class_id",
          "verify_class_definition_against_composition",
          ...(sources.length ? [] : ["verify_primary_composition_source"]),
        ],
      })),
      operationalAuthorization: false,
      existingOperationalRulesPreserved: true,
    executionContextChecks: [
        "species_context",
        "applicable_dose_and_route",
        "withdrawal_by_purpose",
        "current_registration_validity",
      ],
      limitation:
        "Classificação farmacológica não comprova cobertura integral de antígenos, esquema, espécie, dose, carência ou cumprimento de protocolo.",
    };
  });
const artifact = {
  artifact: "sanitario_product_class_links_v2_preparation",
  review_only: true,
  execute_import: false,
  sourcePath,
  sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  capturedAt: snapshot.captured_at,
  note: "Reaproveita os 39 cadastros ativos históricos; não reconfirma estado remoto atual nem promove candidate_class_keys_unverified.",
  counts: {
    products: matrix.length,
    pharmacologicallyClassified: matrix.filter(
      (row) => row.reviewedClassKeys.length,
    ).length,
    preparedLinks: matrix.reduce((n, row) => n + row.preparedLinks.length, 0),
    activeLinks: 0,
  },
  products: matrix,
};
writeFileSync(
  "docs/review/evidence/SANITARIO_PRODUCT_CLASS_LINKS_V2_PREPARATION_20261120.json",
  JSON.stringify(artifact, null, 2) + "\n",
);
console.log(JSON.stringify(artifact.counts));
