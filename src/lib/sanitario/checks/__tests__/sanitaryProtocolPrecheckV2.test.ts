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
      operational_window_rule: {
        anchor: "previous_dose",
        min_offset_days: 30,
        max_offset_days: 30,
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
      booster_rule: { recurrenceRule: { kind: "primovaccination_dose_1" } },
    }),
    item(protocolId("leptospirose"), "lepto_primovac_dose2", {
      product_requirement_kind: "product_class",
      product_class: "vacina_leptospirose",
      eligibility_rule: { species: ["bovino"] },
      operational_window_rule: {
        anchor: "previous_dose",
        min_offset_days: 21,
        max_offset_days: 42,
      },
      booster_rule: { recurrenceRule: { kind: "primovaccination_dose_2" } },
    }),
    item(protocolId("leptospirose"), "lepto_reforco_anual_semestral", {
      product_requirement_kind: "product_class",
      product_class: "vacina_leptospirose",
      eligibility_rule: { species: ["bovino"] },
      operational_window_rule: { anchor: "last_execution" },
      booster_rule: {
        recurrenceRule: { kind: "annual_or_semester_by_risk" },
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
      booster_rule: { recurrenceRule: { kind: "primovaccination_dose_1" } },
    }),
    item(protocolId("ibr_bvd"), "ibr_bvd_primovac_dose2", {
      product_requirement_kind: "product_class",
      product_class: "vacina_ibr_bvd",
      eligibility_rule: { species: ["bovino"] },
      operational_window_rule: {
        anchor: "previous_dose",
        min_offset_days: 21,
        max_offset_days: 42,
      },
      booster_rule: { recurrenceRule: { kind: "primovaccination_dose_2" } },
    }),
    item(protocolId("clostridioses"), "clostridial_primovac_dose1", {
      item_status: "condicional",
      action_type: "vacinacao",
      product_requirement_kind: "product_class",
      product_class: "vacina_clostridial",
      eligibility_rule: {
        species: ["bovino"],
      },
      booster_rule: { recurrenceRule: { kind: "primovaccination_dose_1" } },
    }),
    item(protocolId("clostridioses"), "clostridial_primovac_dose2", {
      product_requirement_kind: "product_class",
      product_class: "vacina_clostridial",
      eligibility_rule: { species: ["bovino"] },
      operational_window_rule: {
        anchor: "previous_dose",
        min_offset_days: 21,
        max_offset_days: 42,
      },
      booster_rule: { recurrenceRule: { kind: "primovaccination_dose_2" } },
    }),
    item(protocolId("clostridioses"), "clostridial_reforco_anual", {
      product_requirement_kind: "product_class",
      product_class: "vacina_clostridial",
      eligibility_rule: { species: ["bovino"] },
      operational_window_rule: { anchor: "last_execution" },
      booster_rule: {
        recurrenceRule: { kind: "annual" },
        tolerance: { days: 30 },
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
  executedHistory?: Parameters<
    typeof precheckSanitaryProtocolsForAnimalV2
  >[0]["executedHistory"],
) {
  const precheck = precheckSanitaryProtocolsForAnimalV2({
    scope: "animal",
    animal,
    catalog,
    executedHistory,
    today,
  });
  const result = precheck.results.find((entry) => entry.itemKey === itemKey);
  expect(result).toBeDefined();
  return result!;
}

function eventHistory(
  familyCode: string | undefined,
  itemKey: string | undefined,
  executedAt: string,
  overrides: Record<string, unknown> = {},
) {
  return [
    {
      animalId: baseAnimal.id,
      events: [
        {
          eventId: "event-history-1",
          protocolId: familyCode ? protocolId(familyCode) : undefined,
          familyCode,
          itemKey,
          productClass: "vacina_teste",
          productId: "product-1",
          executedAt,
          source: "event" as const,
          ...overrides,
        },
      ],
    },
  ];
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
    ).toBe("insufficient_data");
  });

  it("B19 adulta sem documento vira pendencia documental sem planejar agenda", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, nascimento: "2024-01-01" },
      "b19_femeas_3_8_meses",
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.documentaryPending).toBe(true);
    expect(result.documentaryPendingReasons).toContain(
      "Fêmea adulta exige comprovação documental de B19.",
    );
    expect(result.createsAgenda).toBe(false);
  });

  it("B19 adulta com historico externo documentado fica comprovada", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, nascimento: "2024-01-01" },
      "b19_femeas_3_8_meses",
      "2026-05-01",
      eventHistory(
        "brucelose_b19",
        "b19_femeas_3_8_meses",
        "2024-06-01",
        {
          source: "external_documented",
          evidenceClass: "documented",
          evidenceReference: "certificado-b19-2024",
        },
      ),
    );

    expect(result.status).toBe("completed");
    expect(result.documentaryPending).toBe(false);
    expect(result.warnings).toContain(
      "Histórico anterior não registra execução da fazenda nem movimenta estoque.",
    );
  });

  it("B19 adulta external_documented sem referência continua pendente", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, nascimento: "2024-01-01" },
      "b19_femeas_3_8_meses",
      "2026-05-01",
      eventHistory(
        "brucelose_b19",
        "b19_femeas_3_8_meses",
        "2024-06-01",
        { source: "external_documented", evidenceClass: "documented" },
      ),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.documentaryPending).toBe(true);
  });

  it("B19 adulta apenas declarada continua com pendencia documental", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, nascimento: "2024-01-01" },
      "b19_femeas_3_8_meses",
      "2026-05-01",
      eventHistory(
        "brucelose_b19",
        "b19_femeas_3_8_meses",
        "2024-06-01",
        { source: "external_declared", evidenceClass: "declared" },
      ),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.documentaryPending).toBe(true);
    expect(result.reasons).toContain(
      "B19 informada apenas por declaração sem documento suficiente.",
    );
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
    expect(booster.reasons).toContain("Dose anterior não informada.");
    expect(booster.missingExecutedHistory).toBe(true);
  });

  it.each([
    ["dose 2 de clostridioses", "clostridial_primovac_dose2", "previous_dose"],
    ["reforco anual de clostridioses", "clostridial_reforco_anual", "previous_execution"],
    ["dose 2 de IBR/BVD", "ibr_bvd_primovac_dose2", "previous_dose"],
    ["dose 2 de leptospirose", "lepto_primovac_dose2", "previous_dose"],
    ["reforco de leptospirose", "lepto_reforco_anual_semestral", "previous_execution"],
  ] as const)("%s sem historico retorna insufficient_data", (_label, itemKey, kind) => {
    const result = resultByItem(buildCatalog(), baseAnimal, itemKey);

    expect(result.status).toBe("insufficient_data");
    expect(result.historyRequirementKind).toBe(kind);
    expect(result.missingExecutedHistory).toBe(true);
    expect(result.warnings).toContain(
      "Dados insuficientes para planejar esta etapa.",
    );
  });

  it("dose 2 usa somente historico executado explicito da dose anterior", () => {
    const precheck = precheckSanitaryProtocolsForAnimalV2({
      scope: "animal",
      animal: baseAnimal,
      catalog: buildCatalog(),
      executedHistory: eventHistory(
        "clostridioses",
        "clostridial_primovac_dose1",
        "2026-04-01",
      ),
      today: "2026-05-01",
    });
    const result = precheck.results.find(
      (entry) => entry.itemKey === "clostridial_primovac_dose2",
    );

    expect(result?.status).toBe("in_action_window");
    expect(result?.missingExecutedHistory).toBe(false);
  });

  it.each([
    ["clostridioses", "clostridial_primovac_dose1", "clostridial_primovac_dose2"],
    ["ibr_bvd", "ibr_bvd_primovac_dose1", "ibr_bvd_primovac_dose2"],
    ["leptospirose", "lepto_primovac_dose1", "lepto_primovac_dose2"],
  ] as const)(
    "%s dose 2 fica avaliavel com dose 1 executada",
    (familyCode, previousItemKey, itemKey) => {
      const result = resultByItem(
        buildCatalog(),
        baseAnimal,
        itemKey,
        "2026-05-01",
        eventHistory(familyCode, previousItemKey, "2026-04-01"),
      );

      expect(result.status).toBe("in_action_window");
      expect(result.missingExecutedHistory).toBe(false);
    },
  );

  it("reforco anual usa evento anterior compativel e respeita a janela", () => {
    const result = resultByItem(
      buildCatalog(),
      baseAnimal,
      "clostridial_reforco_anual",
      "2026-05-01",
      eventHistory(
        "clostridioses",
        "clostridial_primovac_dose2",
        "2025-05-01",
      ),
    );

    expect(result.status).toBe("in_action_window");
    expect(result.reasons).toContain(
      "Etapa dentro da janela calculada pelo histórico executado.",
    );
  });

  it("reforco de raiva 30d usa dose anterior executada e datada", () => {
    const result = resultByItem(
      buildCatalog(),
      { ...baseAnimal, riskArea: true },
      "raiva_primovac_reforco_30d",
      "2026-05-01",
      eventHistory(
        "raiva_herbivoros",
        "raiva_primovac_dose1",
        "2026-04-01",
      ),
    );

    expect(result.status).toBe("in_action_window");
    expect(result.missingExecutedHistory).toBe(false);
  });

  it("historico parcial ou ambiguo nao libera etapa dependente", () => {
    const partial = resultByItem(
      buildCatalog(),
      baseAnimal,
      "clostridial_primovac_dose2",
      "2026-05-01",
      eventHistory(undefined, undefined, "2026-04-01"),
    );
    const incompatibleProtocol = resultByItem(
      buildCatalog(),
      baseAnimal,
      "clostridial_primovac_dose2",
      "2026-05-01",
      eventHistory(
        "clostridioses",
        "clostridial_primovac_dose1",
        "2026-04-01",
        { protocolId: "protocol-incompativel" },
      ),
    );

    expect(partial.status).toBe("insufficient_data");
    expect(incompatibleProtocol.status).toBe("insufficient_data");
  });

  it("agenda futura nao conta como historico executado", () => {
    const agendaHistory = eventHistory(
      "clostridioses",
      "clostridial_primovac_dose1",
      "2026-04-01",
      { source: "agenda" },
    ) as unknown as Parameters<
      typeof precheckSanitaryProtocolsForAnimalV2
    >[0]["executedHistory"];
    const result = resultByItem(
      buildCatalog(),
      baseAnimal,
      "clostridial_primovac_dose2",
      "2026-05-01",
      agendaHistory,
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.missingExecutedHistory).toBe(true);
  });

  it("historico parcial do lote mantem dose dependente como insufficient_data", () => {
    const secondAnimal = { ...baseAnimal, id: "animal-2" };
    const precheck = precheckSanitaryProtocolsForLotV2({
      scope: "lote",
      lote: {
        id: "lote-1",
        fazendaId: baseAnimal.fazendaId,
        animalIds: [baseAnimal.id, secondAnimal.id],
      },
      animals: [baseAnimal, secondAnimal],
      catalog: buildCatalog(),
      executedHistory: eventHistory(
        "clostridioses",
        "clostridial_primovac_dose1",
        "2026-04-01",
      ),
      today: "2026-05-01",
    });
    const result = precheck.results.find(
      (entry) => entry.itemKey === "clostridial_primovac_dose2",
    );

    expect(result?.status).toBe("insufficient_data");
    expect(result?.missingExecutedHistory).toBe(true);
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
