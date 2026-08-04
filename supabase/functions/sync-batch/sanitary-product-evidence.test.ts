import { describe, expect, it } from "vitest";
import {
  validateSanitaryProductEvidenceCatalog,
  validateSanitaryProductEvidenceShape,
} from "./sanitary-product-evidence";

const ids = {
  event: "99999999-9999-4999-8999-999999999999",
  product: "11111111-1111-4111-8111-111111111111",
  animal: "22222222-2222-4222-8222-222222222222",
  farm: "33333333-3333-4333-8333-333333333333",
  source: "44444444-4444-4444-8444-444444444444",
  coverage: "55555555-5555-4555-8555-555555555555",
  rule: "66666666-6666-4666-8666-666666666666",
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "sanitario-executed-product-technical-snapshot-v2",
    eventId: ids.event,
    executedProductId: ids.product,
    executedProductName: "Vacina",
    executedProductSnapshot: {
      productId: ids.product,
      nomeComercial: "Vacina",
      classe: "vacina",
      apresentacao: "frasco",
      catalogUpdatedAt: "2026-08-04T00:00:00Z",
    },
    executedDose: { quantity: 2, unit: "mL", basis: "animal" },
    executedRoute: "subcutanea",
    fieldEvidence: [{
      fieldKey: "dose",
      coverageStatus: "covers",
      factualValue: { quantity: 2, unit: "mL" },
      technicalValue: {
        doseRuleId: ids.rule,
        quantity: 2,
        unit: "mL",
        basis: "animal",
      },
      sourceRef: { id: ids.source, version: "v1" },
      sourceCoverageId: ids.coverage,
      productSource: {
        productId: ids.product,
        sourceId: ids.source,
        fieldKey: "dose",
      },
      qualifiers: {
        speciesCode: "bovino",
        aptitude: "all",
        animalIds: [ids.animal],
      },
      reason: "covered",
    }],
    sourceRefs: [{ id: ids.source, version: "v1" }],
    limitations: [],
    ...overrides,
  };
}

const shapeInput = (produtoSnapshot: Record<string, unknown>) => ({
  event: { id: ids.event, natureza: "primary_execution" },
  detail: {
    produto_sanitario_v2_id: ids.product,
    produto_nome_snapshot: "Vacina",
    dose_quantidade: 2,
    dose_unidade: "mL",
    via_aplicacao: "subcutanea",
    produto_snapshot: produtoSnapshot,
  },
  eventAnimals: [{ animal_id: ids.animal }],
});

const catalog = () => ({
  product: {
    id: ids.product,
    nome_comercial: "Vacina",
    classe: "vacina",
    updated_at: "2026-08-04T00:00:00Z",
    status_curatorial: "ativo",
    deleted_at: null,
  },
  sources: [{
    id: ids.source,
    version: "v1",
    scope: "global",
    fazenda_id: null,
    deleted_at: null,
  }],
  coverages: [{
    id: ids.coverage,
    source_id: ids.source,
    field_key: "dose",
    coverage_status: "covers",
    deleted_at: null,
  }],
  productSources: [{
    product_id: ids.product,
    source_id: ids.source,
    field_key: "dose",
  }],
  doseRules: [{
    id: ids.rule,
    product_id: ids.product,
    species_code: "bovino",
    aptitude: "all",
    dose_quantity: 2,
    dose_unit: "mL",
    dose_basis: "animal",
    route: "subcutanea",
    status_curatorial: "ativo",
    deleted_at: null,
  }],
  speciesAuthorizations: [],
  animals: [{ id: ids.animal, fazenda_id: ids.farm, especie: "bovino" }],
});

describe("sanitary product evidence", () => {
  it("aceita snapshot factual coerente e cobertura comprovada pelo catálogo", () => {
    const value = snapshot();
    expect(validateSanitaryProductEvidenceShape(shapeInput(value))).toBeNull();
    expect(validateSanitaryProductEvidenceCatalog(value, ids.farm, catalog()))
      .toBeNull();
  });

  it("rejeita identidade factual divergente e withdrawalSnapshot no núcleo", () => {
    expect(
      validateSanitaryProductEvidenceShape(
        shapeInput(snapshot({ eventId: "outro" })),
      ),
    )
      .toBe("SANITARIO_PRODUCT_SNAPSHOT_FACTUAL_MISMATCH");
    expect(
      validateSanitaryProductEvidenceShape(
        shapeInput(snapshot({ withdrawalSnapshot: {} })),
      ),
    )
      .toBe("SANITARIO_PRODUCT_SNAPSHOT_FACTUAL_MISMATCH");
  });

  it("rejeita booleano de cobertura sem fonte e vínculo reais", () => {
    const value = snapshot({
      fieldEvidence: [{
        fieldKey: "dose",
        coverageStatus: "covers",
        qualifiers: {},
        sourceRef: null,
      }],
    });
    expect(validateSanitaryProductEvidenceShape(shapeInput(value)))
      .toBe("SANITARIO_PRODUCT_COVERED_FIELD_SOURCE_REQUIRED");
  });

  it("rejeita versão, tenant e regra técnica divergentes", () => {
    expect(validateSanitaryProductEvidenceCatalog(snapshot(), ids.farm, {
      ...catalog(),
      sources: [{ ...catalog().sources[0], version: "v2" }],
    })).toBe("SANITARIO_PRODUCT_FIELD_COVERAGE_MISMATCH");
    expect(
      validateSanitaryProductEvidenceCatalog(
        snapshot(),
        "outra-fazenda",
        catalog(),
      ),
    )
      .toBe("SANITARIO_PRODUCT_FIELD_APPLICABILITY_MISMATCH");
    expect(validateSanitaryProductEvidenceCatalog(snapshot(), ids.farm, {
      ...catalog(),
      doseRules: [{ ...catalog().doseRules[0], dose_quantity: 3 }],
    })).toBe("SANITARIO_PRODUCT_FIELD_RULE_MISMATCH");
  });
});
