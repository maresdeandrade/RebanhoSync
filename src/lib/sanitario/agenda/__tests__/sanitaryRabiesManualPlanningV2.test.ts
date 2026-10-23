import { describe, expect, it } from "vitest";
import type { FazendaSanidadeConfig } from "@/lib/offline/types";
import { adaptSanitaryProtocolItemV2Row, adaptSanitaryProtocolV2Row } from "../../catalog/sanitaryProtocolCatalogV2";
import { sanitaryContextualPlanningBlockersV2, type SanitaryRuleContextDetailsV2 } from "../sanitaryContextualPlanningV2";
import { resolveSanitaryRabiesRegionalContextV2 } from "../sanitaryRabiesRegionalContextV2";
const item = adaptSanitaryProtocolItemV2Row({ id: "synthetic-manual", logical_item_key: "raiva_primovac_dose1", version: 2,
  snapshot_template: { metadata: { catalog_review_scope: "manual_planning" } } });
const blockers = (context: SanitaryRuleContextDetailsV2, birth = "2026-01-01") => sanitaryContextualPlanningBlockersV2({
  item, context, fazendaId: "farm-a", animalId: "animal-a", animalBirthDate: birth, evaluatedAt: "2026-10-22" });
describe("consulta e planejamento manual nacional de raiva", () => {
  it("não exige UF, legislação do produtor ou cobertura regional para planejamento manual", () => {
    expect(blockers({})).toEqual([]);
  });
  it("menores de três meses e indicação contextual exigem avaliação e responsável", () => {
    expect(blockers({}, "2026-09-01")).toHaveLength(1);
    expect(blockers({ rabiesTechnicalAssessment: { confirmed: true, responsibleReference: "Responsável documentado" } }, "2026-09-01")).toEqual([]);
    expect(blockers({ rabiesTechnicalAssessment: { confirmed: true, responsibleReference: "" } }, "2026-09-01")).toHaveLength(1);
  });
  it("UF/município são confrontados com regras versionadas e vigência sem inferir obrigação ou automação", () => {
    const protocol = adaptSanitaryProtocolV2Row({ metadata: { official_overlays_materialized: { XY: {
      valid_from: "2026-01-01", review_due: "2026-12-31", source_ref: "SRC_FIXTURE", municipalities: ["Cidade cadastrada"],
      status: "mandatory_focus_perifocus", activation: "official_alert_and_georeferenced_delimitation" } } } });
    const config = { fazenda_id: "farm-a", uf: "XY", payload: { activated_template_slugs: ["raiva-herbivoros"] } } as unknown as FazendaSanidadeConfig;
    const resolve = (fazendaId = "farm-a", municipality = "Cidade cadastrada", evaluatedAt = "2026-10-22") =>
      resolveSanitaryRabiesRegionalContextV2({ protocol, config, fazendaId, municipality, evaluatedAt });
    expect(resolve()).toMatchObject({ adopted: true, coverage: "contextual_rule_available", mandatory: null, allowsAgendaAuto: false });
    expect(resolve("farm-b")).toMatchObject({ adopted: false, coverage: "unresolved", allowsAgendaAuto: false });
    expect(resolve("farm-a", "Outro município").coverage).toBe("unresolved");
    expect(resolve("farm-a", "Cidade cadastrada", "2027-01-01").coverage).toBe("unresolved");
  });
});
