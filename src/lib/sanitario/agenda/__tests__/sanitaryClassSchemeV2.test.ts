import { describe, expect, it } from "vitest";
import { adaptSanitaryProtocolItemV2Row, adaptSanitaryProtocolV2Row } from "../../catalog/sanitaryProtocolCatalogV2";
import { sanitaryDefinedSchemeBlockersV2, sanitaryPlanningKindV2 } from "../sanitaryPlanningPolicyV2";
import { SANITARY_CLASS_SCHEME_FIELDS_V2 } from "../sanitaryClassSchemeV2";
import { precheckSanitaryProtocolsForAnimalV2, readSanitaryPlanningHistoryV2, type SanitaryExecutedHistoryEventV2 } from "../../checks/sanitaryProtocolPrecheckV2";
import { sanitaryPlanningBlockersV2 } from "../../preview/sanitaryWindowPlanningPreviewV2";
import { classSchemeExecutionEvidenceV2 } from "../../execution/sanitaryClassSchemeExecutionV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "../../catalog/sanitaryProtocolCatalogV2";
import type { SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import type { ExecutedProductTechnicalSnapshotV2 } from "../../rules/sanitarySnapshotsV2";

// Synthetic class-applicable norm; never a commercial label or curatorial candidate.
const ref = (field: string) => ({ id: "norm", source_ref: "SYNTHETIC_CLASS_NORM", kind: "norma_oficial", scope: "global",
  title: "Norma sintética exclusiva do teste", strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field],
  metadata: { coverage_ids: ["coverage-" + field] } });
const protocol = adaptSanitaryProtocolV2Row({ id: "protocol", family_code: "clostridioses", name: "Classe sintética",
  scope: "global", fazenda_id: null, status: "active", approval_status: "approved", legal_status: "vigente", version: 1, metadata: {} });
function item(key = "dose2") {
  return adaptSanitaryProtocolItemV2Row({ id: key, protocol_id: "protocol", logical_item_key: key, version: 2,
    action_type: "vacinacao", status: "active", item_status: "recomendado", product_requirement_kind: "product_class",
    product_class: "vacina_sintetica", product_id: null, eligibility_rule: { species: ["bovino"] },
    operational_window_rule: key === "dose1" ? { type: "hybrid", anchor: "manual_context" } : { type: "relative", anchor: "previous_dose", min_offset_days: 28, max_offset_days: 42 },
    booster_rule: { recurrenceRule: { kind: key === "dose1" ? "primovaccination_dose_1" : "primovaccination_dose_2" } },
    dose_rule: null, route_rule: null, limitations: [], species_authorization: [], allows_agenda_auto: true,
    source_refs_by_field: Object.fromEntries(SANITARY_CLASS_SCHEME_FIELDS_V2.map(field => [field, [ref(field)]])),
    snapshot_template: { metadata: { planning_scope: "class_scheme" }, executionProductPolicy: "required_at_execution", sourcePolicy: { operational_window: "compatible_product_required_at_execution" } } });
}
const catalog = (): SanitaryProtocolCatalogReadModelV2 => ({ protocols: [protocol], items: [item("dose1"), item()], productClassGroups: [] });
const previous = (overrides: Partial<SanitaryExecutedHistoryEventV2> = {}): SanitaryExecutedHistoryEventV2 => ({
  eventId: "fact", protocolId: "protocol", familyCode: "clostridioses", itemKey: "dose1", source: "event",
  executedAt: "2026-09-20", productId: "actual-product", productClass: "vacina_sintetica",
  classSchemeCoverageId: "coverage-operational_window", ...overrides,
});
function precheck(event?: SanitaryExecutedHistoryEventV2, species = "bovino") {
  return precheckSanitaryProtocolsForAnimalV2({ scope: "animal", catalog: catalog(), today: "2026-10-20",
    animal: { id: "animal", fazendaId: "farm", especie: species },
    executedHistory: event ? [{ animalId: "animal", events: [event] }] : [],
  }).results.find(result => result.itemKey === "dose2")!;
}
function execution(productId = "actual-product") {
  const i = item();
  return { agenda: { produto_classe: i.productClass, protocol_item_snapshot: { planningEvidence: {
    planningScope: "class_scheme", sourceRefsByField: i.sourceRefsByField,
    operationalWindowRule: i.operationalWindowRule, boosterRule: i.boosterRule,
  } } } as unknown as SanitarioAgendaLocalV2,
  snapshot: { executedProductId: productId, executedProductSnapshot: { classe: i.productClass },
    fieldEvidence: ["dose", "route", "species_authorization"].map(field => ({ fieldKey: field, coverageStatus: "covers", sourceRef: ref(field) })),
  } as unknown as ExecutedProductTechnicalSnapshotV2,
  productSources: [{ product_id: productId, source_id: "norm", field_key: "operational_window" }],
  sources: [{ id: "norm", kind: "norma_oficial", scope: "global", strength: "forte", evidence_status: "SIM_NORMA", deleted_at: null }],
  coverages: [{ id: "coverage-operational_window", source_id: "norm", field_key: "operational_window", coverage_status: "covers", deleted_at: null }],
  } as Parameters<typeof classSchemeExecutionEvidenceV2>[0];
}

describe("planejamento por classe com esquema versionado", () => {
  it("planeja vacinação sem marca/dose/via antecipadas, sem apresentá-la como avaliação", () => {
    expect(sanitaryPlanningKindV2(item("dose1"))).toBe("aplicacao_esquema_definido");
    expect(sanitaryDefinedSchemeBlockersV2(item())).toEqual([]);
    expect(sanitaryPlanningBlockersV2(protocol, item(), "automatic")).toEqual([]);
  });
  it("não promove número de registro a fonte de esquema nem dispensa compatibilidade posterior", () => {
    const i = item(); i.sourceRefsByField.operational_window = [{ ...ref("operational_window"), kind: "registro_produto" }] as never;
    expect(sanitaryDefinedSchemeBlockersV2(i).join()).toMatch(/referência de marca/);
    expect(sanitaryDefinedSchemeBlockersV2({ ...item(), snapshotTemplate: { metadata: { planning_scope: "class_scheme" } } }).length).toBeGreaterThan(0);
  });
  it("preserva o guard comercial de versões antigas e impede dose/via em classe", () => {
    expect(sanitaryDefinedSchemeBlockersV2({ ...item(), snapshotTemplate: {} }).join()).toMatch(/produto comercial/);
    expect(sanitaryDefinedSchemeBlockersV2({ ...item(), doseRule: { quantity: 5 } }).join()).toMatch(/nenhuma dose/);
  });
  it.each([undefined, previous({ productClass: "outra" }), previous({ classSchemeCoverageId: null }), previous({ source: "external_declared" }), previous({ productId: null })])(
    "recusa dose anterior sem fato/produto/esquema compatível: %j", event => {
      expect(precheck(event).missingExecutedHistory).toBe(true);
    },
  );
  it("aceita Evento compatível na janela, mantendo espécie e data do fato", () => {
    expect(precheck(previous()).status).toBe("in_action_window");
    expect(precheck(previous(), "bubalino").status).toBe("not_applicable");
    expect(precheck(previous({ executedAt: "2026-10-15" })).status).toBe("not_yet_eligible");
    const c = catalog();
    expect(readSanitaryPlanningHistoryV2({ catalog: c, protocol, item: c.items[1], animalId: "animal", today: "2026-10-20",
      history: [{ animalId: "another-animal", events: [previous()] }],
    }).anchor).toBeNull();
  });
  it("aceita produto escolhido depois, inclusive troca compatível; não depende da carência da Agenda", () => {
    for (const id of ["actual-product", "another-compatible-product"]) {
      const input = execution(id);
      expect(classSchemeExecutionEvidenceV2(input)).toMatchObject({ fieldKey: "operational_window", productSource: { productId: id } });
      expect(input.snapshot.withdrawalSnapshot).toBeUndefined();
    }
  });
  it("recusa produto sem vínculo técnico ao esquema ou com evidência de dose divergente", () => {
    const input = execution(); input.productSources = [];
    expect(classSchemeExecutionEvidenceV2(input)).toBeNull();
    const other = execution(); other.snapshot.fieldEvidence[0].coverageStatus = "does_not_cover";
    expect(classSchemeExecutionEvidenceV2(other)).toBeNull();
  });
  it("continua recusando aftosa e no_agenda_auto da raiva", () => {
    expect(sanitaryPlanningBlockersV2({ ...protocol, familyCode: "febre_aftosa" }, item(), "automatic").length).toBeGreaterThan(0);
    expect(sanitaryPlanningBlockersV2(protocol, { ...item(), limitations: ["no_agenda_auto"] }, "automatic").length).toBeGreaterThan(0);
  });
  it("reforço anual exige série inicial completa e depois acompanha o próprio reforço factual", () => {
    const annual = { ...item(), id: "annual", logicalItemKey: "annual",
      operationalWindowRule: { type: "relative", anchor: "last_execution" },
      boosterRule: { recurrenceRule: { kind: "annual" }, previous_logical_item_key: "dose2", tolerance: { days: 0 } } };
    const c = catalog(); c.items.push(annual);
    const read = (key: string) => readSanitaryPlanningHistoryV2({ catalog: c, protocol, item: annual,
      animalId: "animal", today: "2026-10-20", history: [{ animalId: "animal", events: [previous({ itemKey: key })] }] });
    expect(read("dose1").anchor).toBeNull();
    expect(read("dose2").anchor?.eventId).toBe("fact");
    expect(read("annual").anchor?.eventId).toBe("fact");
    expect(sanitaryDefinedSchemeBlockersV2({ ...annual, boosterRule: { recurrenceRule: { kind: "annual" } } }).join()).toMatch(/série inicial/);
  });
});
