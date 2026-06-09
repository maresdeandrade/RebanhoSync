import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ProductDoseRuleV2,
  SanitaryProductV2,
  SpeciesAuthorizationV2,
  WithdrawalRuleV2,
} from "../sanitaryProductV2";
import type { SanitaryProtocolItemVersionV2, SanitaryProtocolV2 } from "../sanitaryProtocolV2";
import type { SanitarySourceRefV2 } from "../sanitarySourceV2";
import {
  buildAgendaTechnicalSnapshotV2,
  buildEventTechnicalSnapshotV2,
  type AgendaSnapshotBuildInputV2,
  type EventSnapshotBuildInputV2,
} from "../sanitarySnapshotBuildersV2";

const officialSource: SanitarySourceRefV2 = {
  id: "src-official",
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

const labelSource: SanitarySourceRefV2 = {
  id: "src-label",
  kind: "bula",
  title: "Bula registrada",
  issuer: "Fabricante",
  strength: "forte",
  evidenceStatus: "SIM_BULA",
  fieldKeys: ["withdrawal", "species_authorization", "dose", "route", "presentation"],
};

const guidelineSource: SanitarySourceRefV2 = {
  id: "src-guideline",
  kind: "guideline_apoio",
  title: "Guideline curatorial",
  strength: "apoio",
  evidenceStatus: "PRECISA_VALIDAR",
  fieldKeys: [
    "legal_status",
    "eligibility_rule",
    "operational_window",
    "product_requirement",
    "species_authorization",
    "withdrawal",
    "dose",
    "route",
    "presentation",
  ],
};

function protocol(overrides: Partial<SanitaryProtocolV2> = {}): SanitaryProtocolV2 {
  return {
    id: "protocol-1",
    familyCode: "VAC_CORE",
    name: "Vacinas core",
    scope: "global",
    speciesScope: ["bovino"],
    jurisdictionScope: { country: "BR" },
    legalStatus: "obrigatorio_norma",
    version: 1,
    status: "active",
    sourceRefsSnapshot: [officialSource],
    approvalStatus: "approved",
    ...overrides,
  };
}

function authorization(overrides: Partial<SpeciesAuthorizationV2> = {}): SpeciesAuthorizationV2 {
  return {
    productId: "prod-1",
    speciesCode: "bovino",
    aptitude: "all",
    authorizationStatus: "SIM_BULA",
    sourceRefs: [labelSource],
    ...overrides,
  };
}

function doseRule(overrides: Partial<ProductDoseRuleV2> = {}): ProductDoseRuleV2 {
  return {
    productId: "prod-1",
    speciesCode: "bovino",
    aptitude: "all",
    route: "subcutanea",
    doseQuantity: 2,
    doseUnit: "mL",
    doseBasis: "animal",
    statusCuratorial: "ativo",
    sourceRefs: [labelSource],
    ...overrides,
  };
}

function withdrawalRule(overrides: Partial<WithdrawalRuleV2> = {}): WithdrawalRuleV2 {
  return {
    id: "withdrawal-1",
    productId: "prod-1",
    speciesCode: "bovino",
    aptitude: "corte",
    route: "subcutanea",
    doseBasis: "animal",
    meatDays: 0,
    milkDays: null,
    milkHours: null,
    applicability: "zero",
    zeroRequiresExplicitSource: true,
    statusCuratorial: "ativo",
    sourceRefs: [labelSource],
    ...overrides,
  };
}

function product(overrides: Partial<SanitaryProductV2> = {}): SanitaryProductV2 {
  const productAuthorization = authorization();
  return {
    id: "prod-1",
    nomeComercial: "Produto teste",
    classe: "vacina",
    principioAtivo: "antigeno",
    tipoProduto: "biologico",
    apresentacao: "Frasco",
    statusCuratorial: "ativo",
    sourceRefs: [labelSource],
    speciesAuthorizations: [productAuthorization],
    doseRules: [doseRule()],
    withdrawalRules: [withdrawalRule()],
    ...overrides,
  };
}

function protocolItem(
  overrides: Partial<SanitaryProtocolItemVersionV2> = {},
): SanitaryProtocolItemVersionV2 {
  return {
    id: "item-version-1",
    protocolId: "protocol-1",
    logicalItemKey: "vacina-core",
    version: 1,
    itemStatus: "recomendado",
    actionType: "vacinacao",
    productRequirementKind: "specific_product",
    productId: "prod-1",
    eligibilityRule: { minAgeDays: 90 },
    operationalWindowRule: { startDay: 90, endDay: 120 },
    speciesAuthorization: [authorization()],
    sourceRefsByField: {
      eligibility_rule: [officialSource],
      operational_window: [officialSource],
      product_requirement: [officialSource],
      species_authorization: [labelSource],
    },
    limitations: [],
    allowsAgendaAuto: true,
    status: "active",
    ...overrides,
  };
}

function agendaInput(overrides: Partial<AgendaSnapshotBuildInputV2> = {}): AgendaSnapshotBuildInputV2 {
  const plannedProduct = product();
  const plannedAuthorization = plannedProduct.speciesAuthorizations?.[0] ?? null;

  return {
    protocol: protocol(),
    protocolItem: protocolItem(),
    plannedProduct,
    plannedProductSpeciesAuthorization: plannedAuthorization,
    plannedDoseRule: plannedProduct.doseRules?.[0] ?? null,
    technicalSources: [officialSource, labelSource],
    referenceContext: {
      speciesCode: "bovino",
      aptitude: "corte",
      jurisdiction: { country: "BR" },
    },
    ...overrides,
  };
}

function eventInput(overrides: Partial<EventSnapshotBuildInputV2> = {}): EventSnapshotBuildInputV2 {
  const executedProduct = product();

  return {
    eventId: "event-1",
    executedProduct,
    executedDose: { quantity: 2, unit: "mL", basis: "animal" },
    executedRoute: "subcutanea",
    executedProductSpeciesAuthorization: executedProduct.speciesAuthorizations?.[0] ?? null,
    withdrawalRule: withdrawalRule(),
    withdrawalSources: [labelSource],
    protocol: protocol(),
    protocolItem: protocolItem(),
    referenceContext: {
      speciesCode: "bovino",
      aptitude: "corte",
    },
    ...overrides,
  };
}

function expectIssue(result: { issues: Array<{ code: string }> }, code: string) {
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code }),
    ]),
  );
}

describe("sanitarySnapshotBuildersV2", () => {
  it("buildAgendaTechnicalSnapshotV2 cria snapshot valido com protocolo, item e produto planejado", () => {
    const result = buildAgendaTechnicalSnapshotV2(agendaInput());

    expect(result.ok).toBe(true);
    expect(result.snapshot).toMatchObject({
      schemaVersion: "sanitario-agenda-technical-snapshot-v2",
      protocolId: "protocol-1",
      plannedProductId: "prod-1",
    });
  });

  it("snapshot de agenda nao contem carencia ativa nem produto executado", () => {
    const result = buildAgendaTechnicalSnapshotV2(agendaInput());

    expect(result.snapshot).toBeDefined();
    expect(result.snapshot).not.toHaveProperty("withdrawalSnapshot");
    expect(result.snapshot).not.toHaveProperty("carenciaAtiva");
    expect(result.snapshot).not.toHaveProperty("executedProductId");
  });

  it("produto planejado nao e tratado como executado", () => {
    const agendaResult = buildAgendaTechnicalSnapshotV2(agendaInput());
    const eventResult = buildEventTechnicalSnapshotV2({
      ...eventInput(),
      executedProduct: null as unknown as SanitaryProductV2,
    });

    expect(agendaResult.snapshot?.plannedProductId).toBe("prod-1");
    expect(eventResult.ok).toBe(false);
    expectIssue(eventResult, "event_snapshot_requires_executed_product");
  });

  it("specific_product sem plannedProduct bloqueia snapshot de agenda", () => {
    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        plannedProduct: null,
        plannedProductSpeciesAuthorization: null,
        plannedDoseRule: null,
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "specific_product_requires_planned_product_snapshot");
  });

  it("plannedProduct diferente de protocolItem.productId bloqueia snapshot de agenda", () => {
    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        plannedProduct: product({ id: "prod-2" }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "planned_product_mismatch");
  });

  it("allowsAgendaAuto=false bloqueia snapshot de agenda", () => {
    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocolItem: protocolItem({ allowsAgendaAuto: false }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "protocol_item_disallows_auto_agenda");
  });

  it("item somente_alerta bloqueia agenda automatica", () => {
    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocolItem: protocolItem({
          itemStatus: "somente_alerta",
          allowsAgendaAuto: false,
        }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "protocol_item_not_schedulable");
  });

  it("item bloqueado bloqueia agenda automatica", () => {
    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocolItem: protocolItem({
          itemStatus: "bloqueado",
          allowsAgendaAuto: false,
        }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "protocol_item_not_schedulable");
  });

  it("NAO_AUTORIZADO bloqueia agenda automatica", () => {
    const notAuthorized = authorization({ authorizationStatus: "NAO_AUTORIZADO" });

    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocolItem: protocolItem({ speciesAuthorization: [notAuthorized] }),
        plannedProductSpeciesAuthorization: notAuthorized,
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "species_authorization_blocks_agenda");
    expectIssue(result, "planned_product_authorization_blocks_agenda");
  });

  it("PRECISA_VALIDAR preserva limitacao explicita", () => {
    const needsValidation = authorization({
      authorizationStatus: "PRECISA_VALIDAR",
      limitations: ["Necessita validação oficial antes de automação."],
    });

    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocolItem: protocolItem({
          speciesAuthorization: [needsValidation],
          limitations: ["Necessita validação oficial antes de automação."],
        }),
        plannedProductSpeciesAuthorization: needsValidation,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.snapshot?.limitations).toContain("Necessita validação oficial antes de automação.");
    expectIssue(result, "species_authorization_needs_validation");
  });

  it("EXTRAPOLADO exige MV responsavel para execucao futura", () => {
    const extrapolated = authorization({
      authorizationStatus: "EXTRAPOLADO",
      requiresMvResponsavel: false,
      limitations: ["Uso extrapolado exige MV responsável."],
    });

    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocolItem: protocolItem({
          speciesAuthorization: [extrapolated],
          requiresMvResponsavel: false,
          limitations: ["Uso extrapolado exige MV responsável."],
        }),
        plannedProductSpeciesAuthorization: extrapolated,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.snapshot?.limitations).toContain("Uso extrapolado exige MV responsável.");
    expectIssue(result, "extrapolated_item_requires_mv");
  });

  it("bubalino nao herda autorizacao bovina", () => {
    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        referenceContext: {
          speciesCode: "bubalino",
          aptitude: "leite",
        },
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "bubalino_requires_explicit_authorization");
  });

  it("guideline isolado nao valida campo critico em snapshot de agenda", () => {
    const guidelineAuthorization = authorization({
      authorizationStatus: "PRECISA_VALIDAR",
      sourceRefs: [guidelineSource],
    });

    const result = buildAgendaTechnicalSnapshotV2(
      agendaInput({
        protocol: protocol({ sourceRefsSnapshot: [guidelineSource] }),
        protocolItem: protocolItem({
          speciesAuthorization: [guidelineAuthorization],
          sourceRefsByField: {
            eligibility_rule: [guidelineSource],
            operational_window: [guidelineSource],
            product_requirement: [guidelineSource],
            species_authorization: [guidelineSource],
          },
          limitations: ["Guideline é apoio, não fonte crítica."],
        }),
        plannedProduct: product({
          sourceRefs: [guidelineSource],
          speciesAuthorizations: [guidelineAuthorization],
          doseRules: [doseRule({ sourceRefs: [guidelineSource] })],
        }),
        plannedProductSpeciesAuthorization: guidelineAuthorization,
        plannedDoseRule: doseRule({ sourceRefs: [guidelineSource] }),
        technicalSources: [guidelineSource],
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "critical_field_requires_strong_source");
  });

it("fonte forte precisa cobrir field_key especifico", () => {
  const weakLabel = {
    ...labelSource,
    fieldKeys: ["species_authorization"],
  };

  const result = buildAgendaTechnicalSnapshotV2(
    agendaInput({
      plannedProduct: product({ sourceRefs: [weakLabel] }),
      plannedDoseRule: doseRule({ sourceRefs: [weakLabel] }),
      technicalSources: [officialSource, weakLabel],
    }),
  );

  expect(result.ok).toBe(false);
  expectIssue(result, "critical_field_missing_strong_coverage");
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ field: "presentation" }),
      expect.objectContaining({ field: "dose" }),
      expect.objectContaining({ field: "route" }),
    ]),
  );
});

  it("buildEventTechnicalSnapshotV2 cria snapshot valido de evento com produto executado", () => {
    const result = buildEventTechnicalSnapshotV2(eventInput());

    expect(result.ok).toBe(true);
    expect(result.snapshot).toMatchObject({
      schemaVersion: "sanitario-event-technical-snapshot-v2",
      eventId: "event-1",
      executedProductId: "prod-1",
      withdrawalSnapshot: { productId: "prod-1" },
    });
  });

  it("snapshot de evento exige dose e via executadas", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        executedDose: { quantity: null, unit: null, basis: null },
        executedRoute: null,
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "executed_dose_required");
    expectIssue(result, "executed_route_required");
  });

  it("carencia zero exige fonte forte explicita", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({
          applicability: "zero",
          sourceRefs: [guidelineSource],
        }),
        withdrawalSources: [guidelineSource],
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "critical_field_missing_strong_coverage");
  });

  it("carencia unknown bloqueia leitura de livre de carencia", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({
          applicability: "unknown",
          meatDays: null,
          milkDays: null,
          milkHours: null,
        }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "unknown_withdrawal_blocks_clearance");
  });

  it("not_permitted bloqueia uso declarado", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({
          applicability: "not_permitted",
          meatDays: null,
          milkDays: null,
          milkHours: null,
        }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "not_permitted_blocks_declared_use");
  });

  it("guideline isolado nao valida carencia", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({
          sourceRefs: [guidelineSource],
        }),
        withdrawalSources: [guidelineSource],
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "critical_field_missing_strong_coverage");
  });

  it("withdrawalRule de outro produto bloqueia snapshot de evento", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({ productId: "prod-2" }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "withdrawal_rule_product_mismatch");
  });

  it("withdrawalRule de outra especie bloqueia snapshot de evento", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({ speciesCode: "bubalino" }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "withdrawal_rule_species_mismatch");
  });

  it("withdrawalRule de outra via bloqueia snapshot de evento", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        withdrawalRule: withdrawalRule({ route: "intramuscular" }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "withdrawal_rule_route_mismatch");
  });

  it("autorizacao de outro produto bloqueia snapshot de evento", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        executedProductSpeciesAuthorization: authorization({ productId: "prod-2" }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "executed_authorization_product_mismatch");
  });

  it("autorizacao de outra especie bloqueia snapshot de evento", () => {
    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        executedProductSpeciesAuthorization: authorization({
          speciesCode: "bubalino",
          sourceRefs: [{
            ...labelSource,
            fieldKeys: ["species_authorization"],
          }],
        }),
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "executed_authorization_species_mismatch");
  });

  it("EXTRAPOLADO na execucao exige MV responsavel", () => {
    const extrapolated = authorization({
      authorizationStatus: "EXTRAPOLADO",
      requiresMvResponsavel: true,
      limitations: ["Uso extrapolado exige MV responsável."],
    });

    const result = buildEventTechnicalSnapshotV2(
      eventInput({
        executedProductSpeciesAuthorization: extrapolated,
        mvResponsavel: null,
      }),
    );

    expect(result.ok).toBe(false);
    expectIssue(result, "extrapolated_execution_requires_mv");
  });

  it("EventTechnicalSnapshot inclui carencia apenas no evento, nao na agenda", () => {
    const agendaResult = buildAgendaTechnicalSnapshotV2(agendaInput());
    const eventResult = buildEventTechnicalSnapshotV2(eventInput());

    expect(agendaResult.snapshot).not.toHaveProperty("withdrawalSnapshot");
    expect(eventResult.snapshot).toHaveProperty("withdrawalSnapshot");
  });

  it("builders nao importam Supabase, Dexie, React, UI, storage ou Date.now", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/sanitario/rules/sanitarySnapshotBuildersV2.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@supabase|Dexie|dexie|React|react|storage|Date\.now|fetch\(|indexedDB/);
  });
});