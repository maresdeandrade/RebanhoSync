import { describe, expect, it } from "vitest";
import {
  validateSanitaryProductV2,
  validateSpeciesAuthorizationV2,
  validateWithdrawalRuleV2,
  type SanitaryProductV2,
  type SpeciesAuthorizationV2,
  type WithdrawalRuleV2,
} from "../sanitaryProductV2";
import type { SanitarySourceRefV2 } from "../sanitarySourceV2";

const labelSource: SanitarySourceRefV2 = {
  kind: "bula",
  title: "Bula registrada",
  issuer: "Fabricante",
  strength: "forte",
  evidenceStatus: "SIM_BULA",
  fieldKeys: ["withdrawal", "species_authorization", "dose", "route", "presentation"],
};

const guidelineSource: SanitarySourceRefV2 = {
  kind: "guideline_apoio",
  title: "Guideline curatorial",
  strength: "apoio",
  evidenceStatus: "PRECISA_VALIDAR",
  fieldKeys: ["withdrawal", "species_authorization", "dose", "route", "presentation"],
};

function validWithdrawal(overrides: Partial<WithdrawalRuleV2> = {}): WithdrawalRuleV2 {
  return {
    productId: "prod-1",
    speciesCode: "bovino",
    aptitude: "leite",
    meatDays: 0,
    milkDays: 0,
    applicability: "zero",
    zeroRequiresExplicitSource: true,
    statusCuratorial: "ativo",
    sourceRefs: [labelSource],
    ...overrides,
  };
}

function validAuthorization(
  overrides: Partial<SpeciesAuthorizationV2> = {},
): SpeciesAuthorizationV2 {
  return {
    productId: "prod-1",
    speciesCode: "bovino",
    aptitude: "all",
    authorizationStatus: "SIM_BULA",
    sourceRefs: [labelSource],
    ...overrides,
  };
}

describe("sanitaryProductV2", () => {
  it("carencia zero exige fonte explicita", () => {
    const result = validateWithdrawalRuleV2(validWithdrawal({ sourceRefs: [] }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "critical_field_missing_source" }),
      ]),
    );
  });

  it("carencia unknown bloqueia leitura de livre de carencia", () => {
    const result = validateWithdrawalRuleV2(
      validWithdrawal({ applicability: "unknown", meatDays: null, milkDays: null }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "withdrawal_unknown_blocks_clearance" }),
      ]),
    );
  });

  it("not_permitted bloqueia uso declarado", () => {
    const result = validateWithdrawalRuleV2(
      validWithdrawal({ applicability: "not_permitted", meatDays: null, milkDays: null }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "withdrawal_not_permitted_blocks_context" }),
      ]),
    );
  });

  it("bubalino sem autorizacao explicita gera bloqueio/limitacao", () => {
    const result = validateSpeciesAuthorizationV2(
      validAuthorization({
        speciesCode: "bubalino",
        authorizationStatus: "PRECISA_VALIDAR",
        sourceRefs: [guidelineSource],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "bubalino_requires_explicit_authorization" }),
      ]),
    );
  });

  it("bovino nao autoriza bubalino por heranca automatica", () => {
    const bovinoAuth = validAuthorization({ speciesCode: "bovino" });
    const bubalinoAuth = validAuthorization({
      speciesCode: "bubalino",
      sourceRefs: [{ ...labelSource, fieldKeys: ["withdrawal"] }],
    });

    expect(validateSpeciesAuthorizationV2(bovinoAuth).ok).toBe(true);
    expect(validateSpeciesAuthorizationV2(bubalinoAuth).ok).toBe(false);
  });

  it("EXTRAPOLADO exige indicacao de MV responsavel para execucao futura", () => {
    const result = validateSpeciesAuthorizationV2(
      validAuthorization({
        speciesCode: "bubalino",
        authorizationStatus: "EXTRAPOLADO",
        requiresMvResponsavel: false,
        sourceRefs: [labelSource],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "extrapolated_species_requires_mv" }),
      ]),
    );
  });

  it("produto agrega validacoes de apresentacao, dose, especie e carencia", () => {
    const product: SanitaryProductV2 = {
      nomeComercial: "Produto teste",
      classe: "antiparasitario",
      tipoProduto: "medicamento",
      apresentacao: "Frasco",
      statusCuratorial: "ativo",
      sourceRefs: [labelSource],
      speciesAuthorizations: [validAuthorization()],
      doseRules: [
        {
          productId: "prod-1",
          route: "subcutanea",
          doseQuantity: 1,
          doseUnit: "mL",
          doseBasis: "animal",
          statusCuratorial: "ativo",
          sourceRefs: [labelSource],
        },
      ],
      withdrawalRules: [validWithdrawal()],
    };

    expect(validateSanitaryProductV2(product).ok).toBe(true);
  });
});
