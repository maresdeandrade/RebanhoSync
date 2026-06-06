import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateSanitaryProduct,
  validateSanitaryProtocolRule,
  validateWithdrawalSnapshotOnEvent,
  type SanitaryProduct,
  type SanitaryProtocolRule,
  type SourceRef,
  type WithdrawalSnapshotOnEvent,
} from "../sanitaryProtocolRule";

const officialSource: SourceRef = {
  kind: "norma_oficial",
  title: "Norma sanitaria oficial",
  issuer: "MAPA",
  fieldKeys: [
    "eligibilityWindow",
    "completionCriteria",
    "productRequirement",
    "doseIntervals",
    "boosters",
  ],
};

const labelSource: SourceRef = {
  kind: "bula",
  title: "Bula do produto sanitario",
  issuer: "Fabricante",
  fieldKeys: ["dose", "route", "presentation", "withdrawalRules"],
};

const guidelineOnlySource: SourceRef = {
  kind: "guideline_apoio",
  title: "Guideline tecnico de apoio",
  fieldKeys: ["eligibilityWindow"],
};

function validRule(overrides: Partial<SanitaryProtocolRule> = {}): SanitaryProtocolRule {
  return {
    id: "brucelose-femeas-3-8m",
    name: "Brucelose femeas 3 a 8 meses",
    eligibilityWindow: {
      start: { anchor: "nascimento", offsetDays: 90 },
      end: { anchor: "nascimento", offsetDays: 240 },
      permissibility: "allowed",
      sourceRefs: [officialSource],
    },
    completionCriteria: {
      requiresExecutedEvent: true,
      compatibleProductClass: "vacina_brucelose",
      requiredDoseCount: 1,
      sourceRefs: [officialSource],
    },
    productRequirement: {
      kind: "product_class",
      classKey: "vacina_brucelose",
      sourceRefs: [officialSource],
    },
    ...overrides,
  };
}

function validProduct(overrides: Partial<SanitaryProduct> = {}): SanitaryProduct {
  return {
    id: "prod-1",
    name: "Vacina B19",
    classKey: "vacina_brucelose",
    activeIngredient: "Brucella abortus B19",
    presentation: "Frasco multidose",
    dose: { quantity: 2, unit: "ml", per: "animal" },
    route: "subcutanea",
    withdrawalRules: [
      {
        species: "bovina",
        aptitude: "corte",
        meatDays: 0,
        milkDays: null,
        applicability: "zero",
        sourceRefs: [labelSource],
      },
    ],
    sourceRefs: [labelSource],
    ...overrides,
  };
}

describe("sanitaryProtocolRule contract", () => {
  it("regra com janela e fonte valida passa", () => {
    const result = validateSanitaryProtocolRule(validRule());

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("regra critica sem fonte retorna bloqueio", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        eligibilityWindow: {
          start: { anchor: "nascimento", offsetDays: 90 },
          end: { anchor: "nascimento", offsetDays: 240 },
          sourceRefs: [],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "critical_field_missing_source",
          severity: "block",
          field: "eligibilityWindow.sourceRefs",
        }),
      ]),
    );
  });

  it("fonte forte sem fieldKeys do campo nao valida o campo", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        eligibilityWindow: {
          start: { anchor: "nascimento", offsetDays: 90 },
          end: { anchor: "nascimento", offsetDays: 240 },
          sourceRefs: [
            {
              kind: "norma_oficial",
              title: "Norma sem chave de janela",
              fieldKeys: ["completionCriteria"],
            },
          ],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "critical_field_missing_field_key",
          field: "eligibilityWindow.sourceRefs",
          severity: "block",
        }),
      ]),
    );
  });

  it("dose sem fonte especifica retorna bloqueio", () => {
    const result = validateSanitaryProduct(
      validProduct({
        sourceRefs: [{ ...labelSource, fieldKeys: ["route", "presentation", "withdrawalRules"] }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_field_missing_field_key",
          field: "dose",
          severity: "block",
        }),
      ]),
    );
  });

  it("route sem fonte especifica retorna bloqueio", () => {
    const result = validateSanitaryProduct(
      validProduct({
        sourceRefs: [{ ...labelSource, fieldKeys: ["dose", "presentation", "withdrawalRules"] }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_field_missing_field_key",
          field: "route",
          severity: "block",
        }),
      ]),
    );
  });

  it("produto com carencia sem fonte retorna bloqueio", () => {
    const result = validateSanitaryProduct(
      validProduct({
        withdrawalRules: [
          {
            species: "bovina",
            aptitude: "corte",
            meatDays: 30,
            milkDays: null,
            applicability: "period",
            sourceRefs: [],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_withdrawal_missing_source",
          severity: "block",
        }),
      ]),
    );
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_field_missing_source",
          field: "withdrawalRules[0].sourceRefs",
        }),
      ]),
    );
  });

  it("carencia negativa retorna bloqueio", () => {
    const result = validateSanitaryProduct(
      validProduct({
        withdrawalRules: [
          {
            species: "bovina",
            aptitude: "leite",
            meatDays: -1,
            milkDays: null,
            milkWithdrawalHours: -12,
            applicability: "period",
            sourceRefs: [labelSource],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "withdrawal_negative_value",
          severity: "block",
        }),
      ]),
    );
  });

  it("dose com quantidade zero ou negativa retorna bloqueio", () => {
    const result = validateSanitaryProduct(
      validProduct({
        dose: { quantity: 0, unit: "ml", per: "animal" },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_dose_invalid_quantity",
          field: "dose.quantity",
          severity: "block",
        }),
      ]),
    );
  });

  it("carencia null/null retorna bloqueio por ambiguidade", () => {
    const result = validateSanitaryProduct(
      validProduct({
        withdrawalRules: [
          {
            species: "bovina",
            aptitude: "mista",
            meatDays: null,
            milkDays: null,
            sourceRefs: [labelSource],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "withdrawal_ambiguous",
          severity: "block",
        }),
      ]),
    );
  });

  it("carencia de leite aceita horas", () => {
    const result = validateSanitaryProduct(
      validProduct({
        withdrawalRules: [
          {
            species: "bovina",
            aptitude: "leite",
            meatDays: null,
            milkWithdrawalHours: 72,
            applicability: "period",
            sourceRefs: [labelSource],
          },
        ],
      }),
    );

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("produto com carencia sem especie ou finalidade minima retorna limitacao", () => {
    const result = validateSanitaryProduct(
      validProduct({
        withdrawalRules: [
          {
            meatDays: 30,
            milkDays: null,
            applicability: "period",
            sourceRefs: [labelSource],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_withdrawal_missing_species_or_aptitude",
          severity: "limitation",
        }),
      ]),
    );
  });

  it("janela com end antes de start bloqueia", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        eligibilityWindow: {
          start: { anchor: "nascimento", offsetDays: 240 },
          end: { anchor: "nascimento", offsetDays: 90 },
          sourceRefs: [officialSource],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "window_end_before_start",
          severity: "block",
        }),
      ]),
    );
  });

  it("doseIntervals incoerente bloqueia", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        doseIntervals: [
          {
            fromDose: 2,
            toDose: 2,
            minDays: 30,
            recommendedDays: 20,
            maxDays: 10,
            sourceRefs: [officialSource],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "dose_interval_invalid_order",
          severity: "block",
        }),
        expect.objectContaining({
          code: "dose_interval_inconsistent_days",
          severity: "block",
        }),
      ]),
    );
  });

  it("booster vazio bloqueia", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        boosters: [{ sourceRefs: [officialSource] }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "booster_missing_schedule",
          severity: "block",
        }),
      ]),
    );
  });

  it("completionCriteria incompativel com productRequirement bloqueia", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        completionCriteria: {
          requiresExecutedEvent: true,
          compatibleProductClass: "vacina_brucelose",
          sourceRefs: [officialSource],
        },
        productRequirement: {
          kind: "product_class",
          classKey: "vacina_raiva",
          sourceRefs: [officialSource],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_requirement_mismatch",
          severity: "block",
        }),
      ]),
    );
  });

  it("compatibleProductClass com productRequirement de produto especifico bloqueia", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        completionCriteria: {
          requiresExecutedEvent: true,
          compatibleProductClass: "vacina_brucelose",
          sourceRefs: [officialSource],
        },
        productRequirement: {
          kind: "specific_product",
          productId: "prod-b19",
          sourceRefs: [officialSource],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "product_requirement_kind_mismatch",
          severity: "block",
        }),
      ]),
    );
  });

  it("completionCriteria.requiresExecutedEvent deve ser sempre true", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        completionCriteria: {
          requiresExecutedEvent: false,
          sourceRefs: [officialSource],
        } as unknown as SanitaryProtocolRule["completionCriteria"],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "completion_requires_executed_event",
          severity: "block",
        }),
      ]),
    );
  });

  it("guideline isolado nao valida campo critico como fonte forte", () => {
    const result = validateSanitaryProtocolRule(
      validRule({
        eligibilityWindow: {
          start: { anchor: "nascimento", offsetDays: 90 },
          end: { anchor: "nascimento", offsetDays: 240 },
          sourceRefs: [guidelineOnlySource],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "critical_field_guideline_only",
          severity: "block",
        }),
      ]),
    );
  });

  it("carencia pertence ao produto, nao a agenda", () => {
    const product = validProduct();
    const protocol = validRule();

    expect(validateSanitaryProduct(product).ok).toBe(true);
    expect(protocol).not.toHaveProperty("withdrawalRules");
    expect(product.withdrawalRules).toHaveLength(1);
  });

  it("WithdrawalSnapshotOnEvent e contrato futuro, nao calculo runtime", () => {
    const snapshot: WithdrawalSnapshotOnEvent = {
      productId: "prod-1",
      productNameSnapshot: "Vacina B19",
      protocolRuleId: "brucelose-femeas-3-8m",
      meatWithdrawalDays: 0,
      milkWithdrawalDays: null,
      milkWithdrawalHours: null,
      meatWithdrawalUntil: null,
      milkWithdrawalUntil: null,
      calculatedAt: "2026-06-05T12:00:00.000Z",
      sourceRefs: [labelSource],
    };

    expect(validateWithdrawalSnapshotOnEvent(snapshot)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("snapshot com guideline isolado bloqueia", () => {
    const snapshot: WithdrawalSnapshotOnEvent = {
      productNameSnapshot: "Vacina B19",
      meatWithdrawalDays: 0,
      meatWithdrawalUntil: null,
      milkWithdrawalUntil: null,
      calculatedAt: "2026-06-05T12:00:00.000Z",
      sourceRefs: [{ ...guidelineOnlySource, fieldKeys: ["withdrawalRules"] }],
      limitations: ["sem_carencia_declarada_na_fonte_forte"],
    };

    const result = validateWithdrawalSnapshotOnEvent(snapshot);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "critical_field_guideline_only",
          severity: "block",
        }),
      ]),
    );
  });

  it("snapshot com calculatedAt invalido bloqueia", () => {
    const snapshot: WithdrawalSnapshotOnEvent = {
      productNameSnapshot: "Vacina B19",
      calculatedAt: "2026-06-05",
      sourceRefs: [labelSource],
    };

    const result = validateWithdrawalSnapshotOnEvent(snapshot);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "snapshot_invalid_calculated_at",
          severity: "block",
        }),
      ]),
    );
  });

  it("snapshot com produto vazio bloqueia", () => {
    const snapshot: WithdrawalSnapshotOnEvent = {
      productNameSnapshot: " ",
      calculatedAt: "2026-06-05T12:00:00.000Z",
      sourceRefs: [labelSource],
    };

    const result = validateWithdrawalSnapshotOnEvent(snapshot);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "snapshot_empty_product_name",
          severity: "block",
        }),
      ]),
    );
  });

  it("contratos nao importam Supabase, Dexie, React, UI ou agenda", () => {
    const moduleSource = readFileSync(
      resolve(__dirname, "../sanitaryProtocolRule.ts"),
      "utf8",
    );

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/from ["']@\/lib\/agenda/);
    expect(moduleSource).not.toMatch(/agenda_itens|state_agenda_itens/);
  });
});
