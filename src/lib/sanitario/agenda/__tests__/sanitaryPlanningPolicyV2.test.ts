import { describe, expect, it } from "vitest";
import {
  sanitaryAutomaticPlanningBlockersV2,
  sanitaryHasNoAgendaAutoV2,
  sanitaryPlanningKindV2,
} from "../sanitaryPlanningPolicyV2";
import { identifySanitaryMultiProtocolGroupsV2 } from "../../preview/sanitaryMultiProtocolPlanningV2";
import type {
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "../../catalog/sanitaryProtocolCatalogV2";
import type { SanitarioProdutoLocalV2 } from "@/lib/offline/types";
import { sanitaryProtocolExecutionRejectionsV2 } from "../../execution/sanitaryProtocolExecutionAuthorizationV2";

const approvedProtocol = {
  status: "active",
  approvalStatus: "approved",
  metadata: {},
} as SanitaryProtocolV2ReadModel;
const fieldSource = (field: string) => [
  {
    kind: "bula",
    title: "Fixture aprovada explicitamente",
    strength: "forte",
    evidenceStatus: "SIM_BULA",
    fieldKeys: [field],
  },
];
function fixtureItem(protocolId: string): SanitaryProtocolItemV2ReadModel {
  return {
    id: protocolId + "-v1",
    protocolId,
    version: 1,
    logicalItemKey: protocolId + "-dose1",
    productId: "fertiguard-fixture",
    productRequirementKind: "specific_product",
    eligibilityRule: { species: ["bovino"] },
    operationalWindowRule: { min_offset_days: 21, max_offset_days: 30 },
    doseRule: { quantity: 5, unit: "mL" },
    routeRule: { route: "SC" },
    boosterRule: {},
    sourceRefsByField: Object.fromEntries(
      [
        "composition",
        "eligibility_rule",
        "operational_window",
        "product_requirement",
      ].map((field) => [field, fieldSource(field)]),
    ),
    limitations: [],
    snapshotTemplate: {},
    allowsAgendaAuto: true,
  } as SanitaryProtocolItemV2ReadModel;
}
const product = {
  id: "fertiguard-fixture",
  nome_comercial: "Fertiguard Selenium Max — fixture",
  registro_numero: "registro-sintético",
  principio_ativo: "IBR, BVD, Leptospira — fixture",
  status_curatorial: "ativo",
  deleted_at: null,
} as SanitarioProdutoLocalV2;

describe("política A–E", () => {
  it("Agenda genérica não autoriza administração prospectiva nem bloqueia registro factual explícito", () => {
    const agenda = { protocol_item_snapshot: { planningKind: "avaliacao_manejo_generica" }, metadata: {} } as import("@/lib/offline/types").SanitarioAgendaLocalV2;
    expect(sanitaryProtocolExecutionRejectionsV2(agenda, undefined, undefined)).toContain("generic_agenda_requires_explicit_scheme_revalidation");
    expect(sanitaryProtocolExecutionRejectionsV2(agenda, undefined, undefined, "MG", "executed_fact")).not.toContain("generic_agenda_requires_explicit_scheme_revalidation");
  });
  it.each([
    "raiva_primovac_dose1",
    "raiva_primovac_reforco_30d",
    "raiva_reforco_anual_area_risco",
  ])(
    "%s mantém no_agenda_auto mesmo com allowsAgendaAuto verdadeiro",
    (logicalItemKey) => {
      const item = {
        ...fixtureItem("raiva"),
        logicalItemKey,
        limitations: ["no_agenda_auto"],
      };
      expect(sanitaryHasNoAgendaAutoV2(item)).toBe(true);
      expect(
        sanitaryAutomaticPlanningBlockersV2(approvedProtocol, item).join(" "),
      ).toMatch(/no_agenda_auto/);
    },
  );
  it("restrição no snapshot tem precedência e não é substituída por contexto", () => {
    const item = {
      ...fixtureItem("raiva"),
      snapshotTemplate: { restrictions: ["no_agenda_auto"] },
    };
    expect(
      sanitaryAutomaticPlanningBlockersV2(approvedProtocol, item),
    ).not.toEqual([]);
  });
  it("classifica avaliação genérica sem inferir um produto/esquema", () => {
    const item = {
      ...fixtureItem("clostridioses"),
      productId: null,
      productRequirementKind: "product_class",
    };
    expect(sanitaryPlanningKindV2(item)).toBe("avaliacao_manejo_generica");
    expect(
      sanitaryPlanningKindV2({
        ...item,
        operationalWindowRule: { anchor: "previous_dose" },
      }),
    ).toBe("aplicacao_esquema_definido");
  });
  it("agrupa informativamente Fertiguard com fontes, identidade e esquemas compatíveis preservando versões", () => {
    const groups = identifySanitaryMultiProtocolGroupsV2({
      items: [fixtureItem("ibr-bvd"), fixtureItem("lepto")],
      products: [product],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      coverageProven: true,
      compatibleScheme: true,
      materializationAllowed: false,
    });
    expect(groups[0].itemVersions).toHaveLength(2);
  });
  it("não reconhece cobertura sem composição comprovada nem agrupa produtos distintos", () => {
    const item = { ...fixtureItem("lepto"), sourceRefsByField: {} };
    const groups = identifySanitaryMultiProtocolGroupsV2({
      items: [fixtureItem("ibr-bvd"), item],
      products: [product],
    });
    expect(groups[0].compatibleScheme).toBe(false);
    expect(
      identifySanitaryMultiProtocolGroupsV2({
        items: [fixtureItem("ibr-bvd"), { ...item, productId: "other" }],
        products: [product],
      }),
    ).toEqual([]);
  });
  it("duas doses clinicamente distintas não são classificadas como mesma aplicação", () => {
    const second = {
      ...fixtureItem("lepto"),
      boosterRule: { recurrenceRule: { kind: "primovaccination_dose_2" } },
    };
    const groups = identifySanitaryMultiProtocolGroupsV2({
      items: [fixtureItem("ibr-bvd"), second],
      products: [product],
    });
    expect(groups[0].compatibleScheme).toBe(false);
  });
  it("janelas incompatíveis preservam necessidades distintas para revisão", () => {
    const second = {
      ...fixtureItem("lepto"),
      operationalWindowRule: { min_offset_days: 60, max_offset_days: 70 },
    };
    expect(
      identifySanitaryMultiProtocolGroupsV2({
        items: [fixtureItem("ibr-bvd"), second],
        products: [product],
      })[0].compatibleScheme,
    ).toBe(false);
  });
});
