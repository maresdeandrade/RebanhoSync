import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  precheckSanitaryProtocolsForAnimalV2,
  precheckSanitaryProtocolsForLotV2,
  precheckSanitaryProtocolsV2,
  type SanitaryPrecheckAnimalResumoV2,
} from "../sanitaryProtocolPrecheckV2";
import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
  adaptSanitaryProductClassGroupV2Row,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

const protocol = (familyCode: string, overrides: JsonRecord = {}): JsonRecord => ({
  id: `protocol-${familyCode}`,
  family_code: familyCode,
  name: familyCode,
  scope: "global",
  fazenda_id: null,
  species_scope: { species: ["bovino", "bubalino"] },
  jurisdiction_scope: { country: "BR", legal_scope: "nacional" },
  legal_status: "manual_only",
  version: 1,
  status: "draft",
  approval_status: "draft",
  source_refs_snapshot: [],
  metadata: {
    agenda_allowed: false,
    approved_for_catalog: false,
  },
  ...overrides,
});

const item = (
  protocolId: string,
  logicalItemKey: string,
  overrides: JsonRecord = {},
): JsonRecord => ({
  id: `item-${logicalItemKey}`,
  protocol_id: protocolId,
  logical_item_key: logicalItemKey,
  version: 1,
  item_status: "draft",
  action_type: "orientacao",
  product_requirement_kind: "none",
  product_id: null,
  product_class: null,
  product_class_group_id: null,
  eligibility_rule: {},
  operational_window_rule: {},
  dose_rule: {},
  route_rule: {},
  booster_rule: {},
  species_authorization: {},
  source_refs_by_field: {},
  limitations: [],
  snapshot_template: {
    metadata: {
      automationStatus: "manual_only",
      agenda_allowed: false,
      approved_for_catalog: false,
    },
  },
  allows_agenda_auto: false,
  requires_mv_responsavel: false,
  status: "draft",
  ...overrides,
});

const group = (groupKey: string): JsonRecord => ({
  id: `group-${groupKey}`,
  fazenda_id: null,
  scope: "global",
  group_key: groupKey,
  name: groupKey,
  requires_mv_for_other_class: true,
  curation_status: "needs_review",
  automation_status: "blocked",
  limitations: ["members_sem_class_id_bloqueados"],
  metadata: {
    agenda_allowed: false,
    approved_for_catalog: false,
  },
});

const protocolId = (familyCode: string) => `protocol-${familyCode}`;

function buildCatalog(): SanitaryProtocolCatalogReadModelV2 {
  const protocols = [
    protocol("brucelose_b19", {
      legal_status: "obrigatorio_norma",
    }),
    protocol("febre_aftosa", {
      legal_status: "bloqueado",
      status: "retired",
    }),
    protocol("controle_parasitario_recria_5_7_9"),
    protocol("raiva_herbivoros"),
    protocol("leptospirose"),
    protocol("ibr_bvd"),
    protocol("clostridioses"),
    protocol("matrizes_pre_parto"),
  ].map(adaptSanitaryProtocolV2Row);

  const items = [
    item(protocolId("brucelose_b19"), "b19_femeas_3_8_meses", {
      item_status: "obrigatorio",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_brucelose_b19",
      eligibility_rule: {
        species: ["bovino", "bubalino"],
        sex: "femea",
        age_min_months: 3,
        age_max_months: 8,
      },
    }),
    item(protocolId("febre_aftosa"), "fmd_bloqueio_vacinacao_rotina", {
      item_status: "bloqueado",
    }),
    item(protocolId("raiva_herbivoros"), "raiva_primovac_dose1", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_raiva_herbivoros",
      eligibility_rule: {
        species: ["bovino", "bubalino"],
        requires_risk_area_overlay: true,
      },
    }),
    item(protocolId("raiva_herbivoros"), "raiva_primovac_reforco_30d", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_raiva_herbivoros",
      eligibility_rule: {
        species: ["bovino", "bubalino"],
        requires_risk_area_overlay: true,
        requires_previous_dose: "raiva_primovac_dose1",
      },
    }),
    item(protocolId("raiva_herbivoros"), "raiva_reforco_anual_area_risco", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_raiva_herbivoros",
      eligibility_rule: {
        species: ["bovino", "bubalino"],
        requires_risk_area_overlay: true,
      },
      booster_rule: { recurrenceRule: { kind: "annual_if_risk_area" } },
    }),
    item(protocolId("controle_parasitario_recria_5_7_9"), "recria_maio", {
      item_status: "estrategico",
      action_type: "vermifugacao",
      product_requirement_kind: "product_class_group",
      product_class_group_id: "group-pcg_antiparasitarios_recria_estrategicos",
      eligibility_rule: {
        species: ["bovino"],
        category: "recria",
      },
      operational_window_rule: {
        type: "calendar",
        calendar_months: [5],
      },
    }),
    item(protocolId("matrizes_pre_parto"), "matrizes_pre_parto_antiparasitario", {
      item_status: "condicional",
      action_type: "vermifugacao",
      product_requirement_kind: "product_class_group",
      product_class_group_id: "group-pcg_antiparasitarios_matrizes_pre_parto",
      eligibility_rule: {
        species: ["bovino"],
        sex: "femea",
        requires_pregnancy_or_peripartum_context: true,
      },
    }),
    item(protocolId("leptospirose"), "lepto_primovac_dose1", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_leptospirose",
      eligibility_rule: {
        species: ["bovino"],
      },
    }),
    item(protocolId("ibr_bvd"), "ibr_bvd_primovac_dose1", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_ibr_bvd",
      eligibility_rule: {
        species: ["bovino"],
      },
    }),
    item(protocolId("clostridioses"), "clostridial_primovac_dose1", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_clostridial",
      eligibility_rule: {
        species: ["bovino"],
      },
    }),
  ].map(adaptSanitaryProtocolItemV2Row);

  return {
    protocols,
    items,
    productClassGroups: [
      group("pcg_antiparasitarios_recria_estrategicos"),
      group("pcg_antiparasitarios_matrizes_pre_parto"),
    ].map(adaptSanitaryProductClassGroupV2Row),
  };
}

const baseAnimal: SanitaryPrecheckAnimalResumoV2 = {
  id: "animal-1",
  especie: "bovino",
  sexo: "femea",
  nascimento: "2026-01-01",
  categoria: "recria",
  fazendaId: "fazenda-1",
};

function resultByItem(
  catalog: SanitaryProtocolCatalogReadModelV2,
  animal: SanitaryPrecheckAnimalResumoV2,
  itemKey: string,
  today = "2026-05-01",
) {
  const precheck = precheckSanitaryProtocolsForAnimalV2({
    scope: "animal",
    animal,
    catalog,
    today,
  });
  const result = precheck.results.find((entry) => entry.itemKey === itemKey);
  expect(result).toBeDefined();
  return result!;
}

describe("precheckSanitaryProtocolsV2", () => {
  it("B19 femea bovina 3-8 meses entra em janela sem criar operacao", () => {
    const result = resultByItem(
      buildCatalog(),
      baseAnimal,
      "b19_femeas_3_8_meses",
    );

    expect(result.status).toBe("in_action_window");
    expect(result.warnings).toContain(
      "Exige MV habilitado, registro oficial e produto real na execução.",
    );
    expect(result.createsAgenda).toBe(false);
    expect(result.createsEvent).toBe(false);
    expect(result.createsStockMovement).toBe(false);
    expect(result.createsActiveWithdrawal).toBe(false);
  });

  it("B19 macho e not_applicable", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, sexo: "macho" },
      "b19_femeas_3_8_meses",
    );

    expect(result.status).toBe("not_applicable");
  });

  it("B19 sem nascimento e insufficient_data", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, nascimento: null },
      "b19_femeas_3_8_meses",
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.reasons).toContain("Nascimento ausente para calcular janela B19.");
  });

  it("B19 abaixo e acima da janela nao vira permissivo", () => {
    const catalog = buildCatalog();

    expect(
      resultByItem(
        catalog,
        { ...baseAnimal, nascimento: "2026-03-01" },
        "b19_femeas_3_8_meses",
      ).status,
    ).toBe("not_yet_eligible");
    expect(
      resultByItem(
        catalog,
        { ...baseAnimal, nascimento: "2025-06-01" },
        "b19_femeas_3_8_meses",
      ).status,
    ).toBe("overdue");
  });

  it("aftosa permanece bloqueada/not_applicable", () => {
    const result = resultByItem(
      buildCatalog(),
      baseAnimal,
      "fmd_bloqueio_vacinacao_rotina",
    );

    expect(result.status).toBe("not_applicable");
    expect(result.blockers).toContain(
      "Protocolo bloqueado ou retirado no catálogo sanitário v2.",
    );
  });

  it("raiva sem dado de risco nao e inferida", () => {
    const result = resultByItem(
      buildCatalog(),
      baseAnimal,
      "raiva_primovac_dose1",
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.warnings).toContain("A pré-checagem não infere área de risco.");
  });

  it("raiva em area de risco ainda nao agenda e reforco 30d exige historico", () => {
    const catalog = buildCatalog();
    const dose1 = resultByItem(
      catalog,
      { ...baseAnimal, riskArea: true },
      "raiva_primovac_dose1",
    );
    const booster = resultByItem(
      catalog,
      { ...baseAnimal, riskArea: true },
      "raiva_primovac_reforco_30d",
    );

    expect(dose1.status).toBe("in_action_window");
    expect(dose1.createsAgenda).toBe(false);
    expect(booster.status).toBe("insufficient_data");
    expect(booster.reasons).toContain(
      "Reforço depende de histórico explícito da dose anterior.",
    );
  });

  it("antiparasitario com ProductClassGroup nao autoriza execucao", () => {
    const result = resultByItem(buildCatalog(), baseAnimal, "recria_maio");

    expect(result.status).toBe("in_action_window");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Grupo técnico de produtos não valida execução, dose nem carência.",
        "Produto real obrigatório na execução.",
      ]),
    );
    expect(result.createsEvent).toBe(false);
    expect(result.createsStockMovement).toBe(false);
    expect(result.createsActiveWithdrawal).toBe(false);
  });

  it("falta de categoria retorna insufficient_data para antiparasitario", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, categoria: null },
      "recria_maio",
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.reasons).toContain(
      "Categoria ausente para avaliar antiparasitário.",
    );
  });

  it("ProductClass exige produto real na execucao", () => {
    const result = resultByItem(
      buildCatalog(),
      baseAnimal,
      "ibr_bvd_primovac_dose1",
    );

    expect(result.status).toBe("in_action_window");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Produto real obrigatório na execução.",
        "Carência depende do produto executado.",
      ]),
    );
  });

  it("matrizes pre-parto exige contexto gestacional explicito", () => {
    const missingContext = resultByItem(
      buildCatalog(),
      baseAnimal,
      "matrizes_pre_parto_antiparasitario",
    );
    const withContext = resultByItem(
      buildCatalog(),
      { ...baseAnimal, pregnancyOrPeripartumContext: true },
      "matrizes_pre_parto_antiparasitario",
    );

    expect(missingContext.status).toBe("insufficient_data");
    expect(withContext.status).toBe("in_action_window");
  });

  it("leptospirose continua como protocolo proprio avaliavel tecnicamente", () => {
    const result = resultByItem(buildCatalog(), baseAnimal, "lepto_primovac_dose1");

    expect(result.familyCode).toBe("leptospirose");
    expect(result.status).toBe("in_action_window");
    expect(result.createsAgenda).toBe(false);
  });

  it("nenhum resultado cria agenda, evento, estoque ou carencia ativa", () => {
    const precheck = precheckSanitaryProtocolsV2({
      scope: "animal",
      animal: { ...baseAnimal, riskArea: true, pregnancyOrPeripartumContext: true },
      catalog: buildCatalog(),
      today: "2026-05-01",
    });

    expect(precheck.results).not.toHaveLength(0);
    for (const result of precheck.results) {
      expect(result.createsAgenda).toBe(false);
      expect(result.createsEvent).toBe(false);
      expect(result.createsStockMovement).toBe(false);
      expect(result.createsActiveWithdrawal).toBe(false);
    }
  });

  it("catalogo vazio retorna analise segura sem resultados", () => {
    const precheck = precheckSanitaryProtocolsForAnimalV2({
      scope: "animal",
      animal: baseAnimal,
      catalog: {
        protocols: [],
        items: [],
        productClassGroups: [],
      },
      today: "2026-05-01",
    });

    expect(precheck).toEqual({
      animalOrLotId: "animal-1",
      scope: "animal",
      evaluatedAt: "2026-05-01",
      results: [],
    });
  });

  it("lote sem animais retorna insufficient_data por item", () => {
    const precheck = precheckSanitaryProtocolsForLotV2({
      scope: "lote",
      lote: {
        id: "lote-1",
        fazendaId: "fazenda-1",
        categoria: "recria",
      },
      catalog: buildCatalog(),
      today: "2026-05-01",
    });

    expect(precheck.scope).toBe("lote");
    expect(precheck.results).not.toHaveLength(0);
    expect(precheck.results.every((entry) => entry.status === "insufficient_data"))
      .toBe(true);
  });

  it("modulo nao importa Dexie, Supabase, React, agenda, eventos ou queue_ops", () => {
    const moduleSource = readFileSync(
      resolve(__dirname, "../sanitaryProtocolPrecheckV2.ts"),
      "utf8",
    );

    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/queue_ops|createGesture|sync-batch|rpc\(/i);
    expect(moduleSource).not.toMatch(/event_eventos|state_agenda_itens/);
  });
});
