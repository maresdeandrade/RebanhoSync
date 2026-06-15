import { describe, expect, it } from "vitest";
import {
  requiresNewProtocolItemVersionV2,
  validateSanitaryProtocolItemVersionV2,
  validateSanitaryProtocolV2,
  type SanitaryProtocolItemVersionV2,
  type SanitaryProtocolV2,
} from "../sanitaryProtocolV2";
import type { SpeciesAuthorizationV2 } from "../sanitaryProductV2";
import type { SanitarySourceRefV2 } from "../sanitarySourceV2";

const officialSource: SanitarySourceRefV2 = {
  kind: "norma_oficial",
  title: "Norma oficial",
  issuer: "MAPA",
  strength: "forte",
  evidenceStatus: "SIM_NORMA",
  fieldKeys: [
    "legal_status",
    "eligibility_rule",
    "operational_window",
    "product_requirement",
    "species_authorization",
  ],
};

function validAuthorization(overrides: Partial<SpeciesAuthorizationV2> = {}): SpeciesAuthorizationV2 {
  return {
    speciesCode: "bovino",
    aptitude: "all",
    authorizationStatus: "SIM_NORMA",
    sourceRefs: [officialSource],
    ...overrides,
  };
}

function validItem(overrides: Partial<SanitaryProtocolItemVersionV2> = {}): SanitaryProtocolItemVersionV2 {
  return {
    protocolId: "protocol-1",
    logicalItemKey: "febre-aftosa-campanha",
    version: 1,
    itemStatus: "obrigatorio",
    actionType: "vacinacao",
    productRequirementKind: "product_class",
    productClass: "vacina_febre_aftosa",
    eligibilityRule: { species: ["bovino", "bubalino"] },
    operationalWindowRule: { uf: ["CE"] },
    speciesAuthorization: [validAuthorization()],
    sourceRefsByField: {
      eligibility_rule: [officialSource],
      operational_window: [officialSource],
      product_requirement: [officialSource],
    },
    limitations: [],
    allowsAgendaAuto: true,
    status: "active",
    ...overrides,
  };
}

describe("sanitaryProtocolV2", () => {
  it("protocolo obrigatorio por norma exige fonte forte de legal_status", () => {
    const protocol: SanitaryProtocolV2 = {
      familyCode: "febre-aftosa",
      name: "Febre aftosa",
      scope: "global",
      speciesScope: ["bovino", "bubalino"],
      jurisdictionScope: { country: "BR" },
      legalStatus: "obrigatorio_norma",
      version: 1,
      status: "active",
      sourceRefsSnapshot: [officialSource],
      approvalStatus: "approved",
    };

    expect(validateSanitaryProtocolV2(protocol).ok).toBe(true);
  });

  it("item experimental/somente_alerta nao permite agenda automatica", () => {
    const result = validateSanitaryProtocolItemVersionV2(
      validItem({ itemStatus: "somente_alerta", allowsAgendaAuto: true }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "alert_or_blocked_item_cannot_auto_schedule" }),
      ]),
    );
  });

  it("item NAO_AUTORIZADO bloqueia agenda automatica", () => {
    const result = validateSanitaryProtocolItemVersionV2(
      validItem({
        speciesAuthorization: [
          validAuthorization({
            authorizationStatus: "NAO_AUTORIZADO",
          }),
        ],
        allowsAgendaAuto: true,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "not_authorized_blocks_auto_schedule" }),
      ]),
    );
  });

  it("PRECISA_VALIDAR preserva limitacao", () => {
    const result = validateSanitaryProtocolItemVersionV2(
      validItem({
        speciesAuthorization: [
          validAuthorization({
            authorizationStatus: "PRECISA_VALIDAR",
          }),
        ],
        limitations: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "needs_validation_requires_limitation" }),
      ]),
    );
  });

  it("EXTRAPOLADO exige indicacao de MV responsavel para execucao futura", () => {
    const result = validateSanitaryProtocolItemVersionV2(
      validItem({
        speciesAuthorization: [
          validAuthorization({
            authorizationStatus: "EXTRAPOLADO",
            requiresMvResponsavel: true,
          }),
        ],
        requiresMvResponsavel: false,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "extrapolated_item_requires_mv" }),
      ]),
    );
  });

  it("alteracao de protocolo exige nova versao de item", () => {
    const previous = validItem();
    const next = validItem({
      version: 1,
      eligibilityRule: { species: ["bovino"] },
    });

    expect(requiresNewProtocolItemVersionV2(previous, next)).toBe(true);
  });

  it("source_refs_by_field nao pode estar vazio em campo critico do item", () => {
    const result = validateSanitaryProtocolItemVersionV2(
      validItem({ sourceRefsByField: { eligibility_rule: [] } }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "critical_field_missing_source" }),
      ]),
    );
  });

  it("validateSanitaryProtocolItemVersionV2 bloqueia productRequirementRule invalido (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class",
      productClass: "",
      productRequirementRule: {
        kind: "product_class",
        productClass: "", // invalido
        executionProductPolicy: "required_at_execution",
      },
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_product_requirement_rule" }),
      ]),
    );
  });

  it("validateSanitaryProtocolItemVersionV2 bloqueia mismatch entre productRequirementKind e productRequirementRule.kind (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class",
      productClass: "vacina_febre_aftosa",
      productRequirementRule: {
        kind: "specific_product", // mismatch
        productId: "prod-123",
        executionProductPolicy: "required_at_execution",
      },
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "mismatch_product_requirement_rule" }),
      ]),
    );
  });

  it("productRequirementKind = product_class_group sem productRequirementRule bloqueia (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "group-id-1",
      productRequirementRule: null,
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "product_class_group_requires_rule" }),
      ]),
    );
  });

  it("productRequirementKind = product_class_group exige productClassGroupId persistido (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: null,
      productRequirementRule: {
        kind: "product_class_group",
        productClassGroupKey: "pcg_antiparasitarios_recria_estrategicos",
        allowedProductClasses: ["lactonas_macrociclicas"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "required_at_execution",
      },
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "product_class_group_requires_group_id" }),
      ]),
    );
  });

  it("productRequirementKind = product_class_group rejeita productId ou productClass legado (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class_group",
      productId: "prod-1",
      productClass: "classe-indevida",
      productClassGroupId: "group-id-1",
      productRequirementRule: {
        kind: "product_class_group",
        productClassGroupKey: "pcg_antiparasitarios_recria_estrategicos",
        allowedProductClasses: ["lactonas_macrociclicas"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "required_at_execution",
      },
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "product_class_group_must_not_reference_product_or_class" }),
      ]),
    );
  });

  it("productRequirementKind = specific_product rejeita productClassGroupId (P0)", () => {
    const item = validItem({
      productRequirementKind: "specific_product",
      productId: "prod-1",
      productClass: null,
      productClassGroupId: "group-id-1",
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "specific_product_must_not_reference_group" }),
      ]),
    );
  });

  it("productRequirementKind = product_class rejeita productClassGroupId (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class",
      productClass: "vacina_febre_aftosa",
      productClassGroupId: "group-id-1",
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "product_class_must_not_reference_group" }),
      ]),
    );
  });

  it("productRequirementKind = none rejeita productClassGroupId (P0)", () => {
    const item = validItem({
      productRequirementKind: "none",
      productId: null,
      productClass: null,
      productClassGroupId: "group-id-1",
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "none_product_requirement_must_not_reference_product" }),
      ]),
    );
  });

  it("productRequirementKind = product_class_group valido nao permite agenda automatica por implicacao", () => {
    const item = validItem({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "group-id-1",
      productRequirementRule: {
        kind: "product_class_group",
        productClassGroupKey: "pcg_antiparasitarios_recria_estrategicos",
        allowedProductClasses: ["lactonas_macrociclicas"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "required_at_execution",
      },
      allowsAgendaAuto: false,
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(true);
  });

  it("requiresNewProtocolItemVersionV2 retorna true quando muda productRequirementRule (P0)", () => {
    const previous = validItem({
      productRequirementKind: "product_class",
      productRequirementRule: {
        kind: "product_class",
        productClass: "class-1",
        executionProductPolicy: "required_at_execution",
      },
    });

    const next = validItem({
      productRequirementKind: "product_class",
      productRequirementRule: {
        kind: "product_class",
        productClass: "class-2", // alterado
        executionProductPolicy: "required_at_execution",
      },
    });

    expect(requiresNewProtocolItemVersionV2(previous, next)).toBe(true);
  });

  it("requiresNewProtocolItemVersionV2 retorna true quando muda productClassGroupId (P0)", () => {
    const previous = validItem({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "group-id-1",
      productRequirementRule: {
        kind: "product_class_group",
        productClassGroupKey: "pcg_antiparasitarios_recria_estrategicos",
        allowedProductClasses: ["lactonas_macrociclicas"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "required_at_execution",
      },
    });

    const next = validItem({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "group-id-2",
      productRequirementRule: {
        kind: "product_class_group",
        productClassGroupKey: "pcg_antiparasitarios_recria_estrategicos",
        allowedProductClasses: ["lactonas_macrociclicas"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "required_at_execution",
      },
    });

    expect(requiresNewProtocolItemVersionV2(previous, next)).toBe(true);
  });

  it("validateSanitaryProtocolItemVersionV2 bloqueia mismatch de coherence entre productClass legado e regra (P0)", () => {
    const item = validItem({
      productRequirementKind: "product_class",
      productClass: "vacina_febre_aftosa", // legado
      productRequirementRule: {
        kind: "product_class",
        productClass: "vacina_clostridial_multivalente", // diferente na regra
        executionProductPolicy: "required_at_execution",
      },
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "coherence_mismatch_product_class" }),
      ]),
    );
  });

  it("validateSanitaryProtocolItemVersionV2 bloqueia mismatch de coherence entre productId legado e regra (P0)", () => {
    const item = validItem({
      productRequirementKind: "specific_product",
      productId: "prod-legado",
      productRequirementRule: {
        kind: "specific_product",
        productId: "prod-regra", // diferente na regra
        executionProductPolicy: "required_at_execution",
      },
    });

    const result = validateSanitaryProtocolItemVersionV2(item);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "coherence_mismatch_product_id" }),
      ]),
    );
  });
});
