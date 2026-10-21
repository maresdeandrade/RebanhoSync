import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/offline/db";
import type { Animal, Lote, SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import type {
  SanitaryProtocolCatalogReadModelV2,
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import {
  buildSanitaryProtocolWindowV2,
  createGroupedManualSanitaryAgendasV2,
  type SanitaryProtocolWindowSourceV2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

vi.mock("@/lib/offline/localReadBoundary", () => ({
  requireTenantSensitiveRead: vi.fn().mockResolvedValue(undefined),
}));

const protocol = (
  id: string,
  familyCode: string,
  overrides: Partial<SanitaryProtocolV2ReadModel> = {},
): SanitaryProtocolV2ReadModel => ({
  id,
  familyCode,
  name:
    familyCode === "brucelose_b19"
      ? "Brucelose B19"
      : familyCode === "clostridioses"
        ? "Clostridioses"
        : familyCode === "raiva_herbivoros"
          ? "Raiva dos herbívoros"
          : "Febre aftosa",
  scope: "global",
  fazendaId: null,
  speciesScope: {},
  jurisdictionScope: {},
  legalStatus: "manual_only",
  version: 1,
  status: "active",
  approvalStatus: "approved",
  sourceRefsSnapshot: [],
  metadata: {},
  ...overrides,
});

const item = (
  id: string,
  protocolId: string,
  logicalItemKey: string,
  overrides: Partial<SanitaryProtocolItemV2ReadModel> = {},
): SanitaryProtocolItemV2ReadModel => ({
  id,
  protocolId,
  logicalItemKey,
  version: 1,
  itemStatus: "recomendado",
  actionType: "vacinacao",
  productRequirementKind: "product_class",
  productId: null,
  productClass: "vacina_teste",
  productClassGroupId: null,
  eligibilityRule: { species: ["bovino", "bubalino"] },
  operationalWindowRule: {},
  doseRule: {},
  routeRule: {},
  boosterRule: {},
  speciesAuthorization: {},
  sourceRefsByField: {},
  limitations: [],
  snapshotTemplate: {},
  allowsAgendaAuto: false,
  requiresMvResponsavel: false,
  status: "active",
  ...overrides,
});

const catalog: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [
    protocol("protocol-b19", "brucelose_b19"),
    protocol("protocol-clost", "clostridioses"),
    protocol("protocol-raiva", "raiva_herbivoros"),
    protocol("protocol-lepto", "leptospirose"),
    protocol("protocol-prepartum", "matrizes_pre_parto"),
    protocol("protocol-feedlot", "vermifugacao_pre_confinamento_pasto_vedado"),
    protocol("protocol-aftosa", "febre_aftosa", {
      status: "retired",
      legalStatus: "bloqueado",
    }),
  ],
  items: [
    item("item-b19", "protocol-b19", "b19_femeas_3_8_meses", {
      eligibilityRule: {
        species: ["bovino", "bubalino"],
        sex: "femea",
        age_min_months: 3,
        age_max_months: 8,
      },
      productClass: "vacina_brucelose_b19",
    }),
    item("item-clost-1", "protocol-clost", "clostridial_primovac_dose1", {
      boosterRule: { recurrenceRule: { kind: "primovaccination_dose_1" } },
    }),
    item("item-clost-2", "protocol-clost", "clostridial_primovac_dose2", {
      operationalWindowRule: {
        anchor: "previous_dose",
        min_offset_days: 30,
        max_offset_days: 40,
      },
      boosterRule: { recurrenceRule: { kind: "primovaccination_dose_2" } },
    }),
    item("item-raiva", "protocol-raiva", "raiva_primovac_dose1", {
      eligibilityRule: {
        species: ["bovino", "bubalino"],
        requires_risk_area_overlay: true,
      },
      productClass: "vacina_raiva_herbivoros",
    }),
    item("item-lepto", "protocol-lepto", "lepto_reforco_anual_semestral", {
      eligibilityRule: { species: ["bovino"] },
      operationalWindowRule: { anchor: "last_execution" },
      boosterRule: { recurrenceRule: { kind: "annual_or_semester_by_risk" } },
      productClass: "vacina_leptospirose",
    }),
    item(
      "item-prepartum",
      "protocol-prepartum",
      "matrizes_pre_parto_antiparasitario",
      {
        eligibilityRule: {
          species: ["bovino"],
          sex: "femea",
          requires_pregnancy_or_peripartum_context: true,
        },
        productRequirementKind: "product_class_group",
        productClass: null,
        productClassGroupId: "group-prepartum",
      },
    ),
    item("item-feedlot", "protocol-feedlot", "pre_confinamento_dose_unica", {
      eligibilityRule: { species: ["bovino"] },
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "group-feedlot",
    }),
    item("item-aftosa", "protocol-aftosa", "fmd_bloqueio_vacinacao_rotina", {
      itemStatus: "bloqueado",
      productRequirementKind: "none",
    }),
  ],
  productClassGroups: [],
};

const animal = (id: string, sexo: "M" | "F", birth: string): Animal => ({
  id,
  fazenda_id: "farm-1",
  identificacao:
    id === "female"
      ? "Fêmea 101"
      : id === "male"
        ? "Macho 202"
        : "Fêmea atrasada",
  nome: null,
  sexo,
  status: "ativo",
  lote_id: "lot-1",
  data_nascimento: birth,
  data_entrada: null,
  data_saida: null,
  pai_id: null,
  mae_id: null,
  rfid: null,
  especie: "bovino",
  origem: null,
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: {},
  client_id: "client",
  client_op_id: `op-${id}`,
  client_tx_id: null,
  client_recorded_at: "2026-01-01T00:00:00.000Z",
  server_received_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
});

const lot = {
  id: "lot-1",
  fazenda_id: "farm-1",
  nome: "Bezerros",
  deleted_at: null,
} as Lote;

function source(
  overrides: Partial<SanitaryProtocolWindowSourceV2> = {},
): SanitaryProtocolWindowSourceV2 {
  return {
    farmUf: "MG",
    catalog,
    animals: [
      animal("female", "F", "2026-03-01"),
      animal("male", "M", "2026-03-01"),
      animal("overdue", "F", "2025-09-01"),
    ],
    lots: [lot],
    executedHistory: [],
    agendas: [],
    agendaAnimals: [],
    ...overrides,
  };
}

function windowFor(input: {
  protocolId: string;
  itemId: string;
  source?: SanitaryProtocolWindowSourceV2;
  operationalContext?: Parameters<
    typeof buildSanitaryProtocolWindowV2
  >[0]["operationalContext"];
}) {
  return buildSanitaryProtocolWindowV2({
    source: input.source ?? source(),
    protocolId: input.protocolId,
    itemId: input.itemId,
    evaluatedAt: "2026-07-04",
    operationalContext: input.operationalContext,
    filters: { animalStatus: "ativo" },
  })!;
}

function activeAgenda(): SanitarioAgendaLocalV2 {
  return {
    id: "agenda-active",
    fazenda_id: "farm-1",
    status: "programada",
    dedup_key: "dedup",
    client_id: "client",
    client_op_id: "agenda-op",
    client_tx_id: null,
    client_recorded_at: "2026-07-01T00:00:00.000Z",
    server_received_at: "2026-07-01T00:00:00.000Z",
    source_demand_key: null,
    preview_group_id: null,
    protocolo_id: "protocol-clost",
    protocol_item_version_id: null,
    protocol_item_snapshot: { itemKey: "clostridial_primovac_dose2" },
    janela_inicio: "2026-07-10",
    janela_fim: null,
    data_programada: "2026-07-10",
    lote_id: null,
    produto_veterinario_id: null,
    produto_snapshot: {},
    produto_classe: null,
    acao_sanitaria: "agenda_manual_sanitaria",
    execution_evento_id: null,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
  };
}

async function clearOperationalTables() {
  await Promise.all([
    db.catalog_sanitario_produtos_v2.clear(),
    db.catalog_sanitario_produto_especie_autorizacao_v2.clear(),
    db.ops_sanitario_agenda_v2.clear(),
    db.ops_sanitario_agenda_animais_v2.clear(),
    db.state_animais.clear(),
    db.state_lotes.clear(),
    db.catalog_sanitario_protocolos_v2.clear(),
    db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
    db.catalog_sanitario_product_class_groups_v2.clear(),
    db.state_fazenda_sanidade_config.clear(),
    db.event_eventos_animais.clear(),
    db.queue_ops.clear(),
    db.event_eventos.clear(),
    db.event_eventos_sanitario.clear(),
    db.state_insumo_movimentacoes.clear(),
  ]);
}

async function seedPlanningSource() {
  await db.state_fazenda_sanidade_config.put({
    fazenda_id: "farm-1",
    uf: "MG",
  } as never);
  await db.state_animais.bulkPut(source().animals);
  await db.state_lotes.bulkPut(source().lots);
  const snake = (value: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        entry,
      ]),
    );
  await db.catalog_sanitario_protocolos_v2.bulkPut(
    catalog.protocols.map((row) => snake(row)) as never[],
  );
  await db.catalog_sanitario_protocolo_itens_versions_v2.bulkPut(
    catalog.items.map((row) => snake(row)) as never[],
  );
}

const approvedFields = [
  "eligibility_rule",
  "operational_window",
  "product_requirement",
  "dose",
  "route",
  "species_authorization",
  "composition",
];
function approvedSources() {
  return Object.fromEntries(
    approvedFields.map((field) => [
      field,
      [
        {
          kind: "norma_oficial",
          title: "Fixture aprovada explicitamente — somente testes",
          strength: "forte",
          evidenceStatus: "SIM_NORMA",
          fieldKeys: [field],
        },
      ],
    ]),
  );
}
async function allowAutomaticB19Fixture() {
  await seedPlanningSource();
  await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-b19", {
    allows_agenda_auto: true,
    source_refs_by_field: approvedSources(),
  });
}
function specificCatalog() {
  return {
    ...catalog,
    items: catalog.items.map((entry) =>
      entry.protocolId === "protocol-clost"
        ? {
            ...entry,
            productId: "product-multi",
            doseRule: { quantity: 5, unit: "mL" }, routeRule: { route: "SC" },
            sourceRefsByField: approvedSources(),
          }
        : entry,
    ),
  };
}
const technicalSpecies = { id: "authorization-fixture", product_id: "product-multi", species_code: "bovino", authorization_status: "SIM_BULA", aptitude: "all", sexo: null, deleted_at: null } as import("@/lib/offline/types").SanitarioProdutoEspecieAutorizacaoLocalV2;

const technicalProduct = {
  id: "product-multi",
  nome_comercial: "Fertiguard Selenium Max — fixture",
  fabricante: "MSD — fixture",
  registro_numero: "registro-sintetico",
  principio_ativo: "IBR, BVD e Leptospira — fixture",
  status_curatorial: "ativo",
  deleted_at: null,
} as import("@/lib/offline/types").SanitarioProdutoLocalV2;

describe("sanitaryProtocolWindowsV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearOperationalTables();
  });
  afterEach(clearOperationalTables);

  it("R04B materializa vacinação por classe sem marca, preserva esquema e retry sem criar fatos", async () => {
    await seedPlanningSource();
    const refs = Object.fromEntries(["eligibility_rule", "operational_window", "product_requirement", "species_authorization"].map(field =>
      [field, [{ id: "class-norm", kind: "norma_oficial", scope: "global", title: "Norma sintética para esta variante",
        strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field], metadata: { coverage_ids: ["class-" + field] } }]]));
    const template = { metadata: { planning_scope: "class_scheme" }, executionProductPolicy: "required_at_execution",
      sourcePolicy: { operational_window: "compatible_product_required_at_execution" } };
    const next = { ...catalog.items.find(i => i.id === "item-clost-1")!,
      eligibilityRule: { species: ["bovino"] }, sourceRefsByField: refs, snapshotTemplate: template, allowsAgendaAuto: true };
    await db.catalog_sanitario_protocolo_itens_versions_v2.update(next.id, {
      eligibility_rule: next.eligibilityRule, source_refs_by_field: refs, snapshot_template: template, allows_agenda_auto: true,
    });
    const localCatalog = { ...catalog, items: catalog.items.map(i => i.id === next.id ? next : i) };
    const rows = windowFor({ protocolId: next.protocolId, itemId: next.id, source: source({ catalog: localCatalog }) }).rows;
    expect(rows.every(row => row.canSelect)).toBe(true);
    const input = { rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true };
    const result = await createGroupedManualSanitaryAgendasV2(input);
    expect((await createGroupedManualSanitaryAgendasV2(input))[0].agendaId).toBe(result[0].agendaId);
    const stored = (await db.ops_sanitario_agenda_v2.toArray())[0];
    expect(stored.produto_veterinario_id).toBeNull();
    expect(stored.acao_sanitaria).toBe("vacinacao");
    expect(stored.protocol_item_snapshot).toMatchObject({ planningKind: "aplicacao_esquema_definido", planningEvidence: {
      planningScope: "class_scheme", executionProductPolicy: "required_at_execution", boosterRule: next.boosterRule,
    } });
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it("classifica B19 por sexo e idade sem tornar macho planejável", () => {
    const result = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    });
    expect(result.rows.find((row) => row.animalId === "female")).toMatchObject({
      status: "in_action_window",
      canSelect: true,
    });
    expect(result.rows.find((row) => row.animalId === "male")).toMatchObject({
      status: "not_applicable",
      canSelect: false,
    });
    expect(result.rows.find((row) => row.animalId === "overdue")).toMatchObject(
      {
        status: "insufficient_data",
        documentaryPending: true,
        canSelect: false,
      },
    );
  });

  it("filtra janelas por lote sem criar agenda, evento, estoque, carencia ou fila", async () => {
    const otherLot = {
      id: "lot-2",
      fazenda_id: "farm-1",
      nome: "Descarte",
      deleted_at: null,
    } as Lote;
    const outsideLotAnimal = {
      ...animal("outside", "F", "2026-03-01"),
      lote_id: "lot-2",
      identificacao: "Fêmea fora",
    };

    const result = buildSanitaryProtocolWindowV2({
      source: source({
        animals: [
          animal("female", "F", "2026-03-01"),
          animal("male", "M", "2026-03-01"),
          outsideLotAnimal,
        ],
        lots: [lot, otherLot],
      }),
      protocolId: "protocol-b19",
      itemId: "item-b19",
      evaluatedAt: "2026-07-04",
      filters: { animalStatus: "ativo", lotId: "lot-1" },
    })!;

    expect(result.rows.map((row) => row.identification)).toEqual([
      "Fêmea 101",
      "Macho 202",
    ]);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("B19 adulta documentada conclui e declarada permanece pendente", () => {
    const documented = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
      source: source({
        animals: [animal("overdue", "F", "2025-09-01")],
        executedHistory: [
          {
            animalId: "overdue",
            events: [
              {
                eventId: "event-b19-doc",
                protocolId: "protocol-b19",
                familyCode: "brucelose_b19",
                itemKey: "b19_femeas_3_8_meses",
                executedAt: "2026-01-01",
                source: "external_documented",
                evidenceClass: "documented",
                evidenceReference: "certificado-b19-2026",
                evidenceCoveredFields: ["protocol_item_completion"],
              },
            ],
          },
        ],
      }),
    });
    expect(documented.rows[0]).toMatchObject({
      status: "completed",
      documentaryPending: false,
      canSelect: false,
    });

    const declared = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
      source: source({
        animals: [animal("overdue", "F", "2025-09-01")],
        executedHistory: [
          {
            animalId: "overdue",
            events: [
              {
                eventId: "event-b19-declared",
                protocolId: "protocol-b19",
                familyCode: "brucelose_b19",
                itemKey: "b19_femeas_3_8_meses",
                executedAt: "2026-01-01",
                source: "external_declared",
                evidenceClass: "declared",
              },
            ],
          },
        ],
      }),
    });
    expect(declared.rows[0]).toMatchObject({
      status: "insufficient_data",
      documentaryPending: true,
      canSelect: false,
    });
  });

  it("exige dose 1 executada para planejar dose 2 de clostridioses", () => {
    const withoutHistory = windowFor({
      protocolId: "protocol-clost",
      itemId: "item-clost-2",
    });
    expect(withoutHistory.rows[0]).toMatchObject({
      status: "insufficient_data",
      canSelect: false,
    });

    const withHistory = windowFor({
      protocolId: "protocol-clost",
      itemId: "item-clost-2",
      source: source({
        executedHistory: [
          {
            animalId: "female",
            events: [
              {
                eventId: "event-dose-1",
                protocolId: "protocol-clost",
                familyCode: "clostridioses",
                itemKey: "clostridial_primovac_dose1",
                executedAt: "2026-06-01",
                source: "event",
              },
            ],
          },
        ],
        animals: [animal("female", "F", "2026-03-01")],
      }),
    });
    expect(withHistory.rows[0]).toMatchObject({
      status: "near_deadline",
      canSelect: false,
    });
    expect(withHistory.rows[0].blockers.join(" ")).toMatch(
      /Esquema definido exige produto/,
    );
  });

  it("mantém raiva sem área de risco como dados insuficientes", () => {
    expect(
      windowFor({ protocolId: "protocol-raiva", itemId: "item-raiva" }).rows[0],
    ).toMatchObject({ status: "insufficient_data", canSelect: false });
    expect(
      windowFor({
        protocolId: "protocol-raiva",
        itemId: "item-raiva",
        operationalContext: {
          rabiesRiskArea: true,
          sanitaryCadence: null,
          reproductiveContext: null,
          management: null,
        },
      }).rows[0],
    ).toMatchObject({ status: "in_action_window", canSelect: true });
  });

  it("usa cadência estruturada na leptospirose sem substituir histórico", () => {
    const leptoSource = source({
      animals: [animal("female", "F", "2024-01-01")],
      executedHistory: [
        {
          animalId: "female",
          events: [
            {
              eventId: "event-lepto",
              protocolId: "protocol-lepto",
              familyCode: "leptospirose",
              itemKey: "lepto_reforco_anual_semestral",
              executedAt: "2025-07-04",
              source: "event",
            },
          ],
        },
      ],
    });
    expect(
      windowFor({
        protocolId: "protocol-lepto",
        itemId: "item-lepto",
        source: leptoSource,
      }).rows[0],
    ).toMatchObject({ status: "insufficient_data", canSelect: false });
    expect(
      windowFor({
        protocolId: "protocol-lepto",
        itemId: "item-lepto",
        source: leptoSource,
        operationalContext: {
          rabiesRiskArea: null,
          sanitaryCadence: "annual",
          reproductiveContext: null,
          management: null,
        },
      }).rows[0],
    ).toMatchObject({ status: "in_action_window", canSelect: false });

    const semiannualSource = source({
      animals: [animal("female", "F", "2024-01-01")],
      executedHistory: [
        {
          animalId: "female",
          events: [
            {
              eventId: "event-lepto-semi",
              protocolId: "protocol-lepto",
              familyCode: "leptospirose",
              itemKey: "lepto_reforco_anual_semestral",
              executedAt: "2026-01-03",
              source: "event",
            },
          ],
        },
      ],
    });
    expect(
      windowFor({
        protocolId: "protocol-lepto",
        itemId: "item-lepto",
        source: semiannualSource,
        operationalContext: {
          rabiesRiskArea: null,
          sanitaryCadence: "semiannual",
          reproductiveContext: null,
          management: null,
        },
      }).rows[0],
    ).toMatchObject({ status: "in_action_window", canSelect: false });
  });

  it("exige contexto reprodutivo e manejo explícitos nos itens dependentes", () => {
    const singleFemale = source({
      animals: [animal("female", "F", "2024-01-01")],
    });
    expect(
      windowFor({
        protocolId: "protocol-prepartum",
        itemId: "item-prepartum",
        source: singleFemale,
      }).rows[0],
    ).toMatchObject({ status: "insufficient_data", canSelect: false });
    expect(
      windowFor({
        protocolId: "protocol-prepartum",
        itemId: "item-prepartum",
        source: singleFemale,
        operationalContext: {
          rabiesRiskArea: null,
          sanitaryCadence: null,
          reproductiveContext: "prepartum",
          management: null,
          scheduledContext: { date: "2026-07-04", animalIds: ["female"], reference: "Avaliação pré-parto programada" },
        },
      }).rows[0],
    ).toMatchObject({ status: "in_action_window", canSelect: true });

    expect(
      windowFor({
        protocolId: "protocol-feedlot",
        itemId: "item-feedlot",
        source: singleFemale,
      }).rows[0],
    ).toMatchObject({ status: "insufficient_data", canSelect: false });
    expect(
      windowFor({
        protocolId: "protocol-feedlot",
        itemId: "item-feedlot",
        source: singleFemale,
        operationalContext: {
          rabiesRiskArea: null,
          sanitaryCadence: null,
          reproductiveContext: null,
          management: "pre_feedlot",
        },
      }).rows[0],
    ).toMatchObject({ status: "in_action_window", canSelect: true });
  });

  it("bloqueia item retirado e agenda ativa equivalente", () => {
    expect(
      windowFor({
        protocolId: "protocol-aftosa",
        itemId: "item-aftosa",
      }).rows.every((row) => !row.canSelect && row.blockers.length > 0),
    ).toBe(true);

    const planned = windowFor({
      protocolId: "protocol-clost",
      itemId: "item-clost-2",
      source: source({
        animals: [animal("female", "F", "2026-03-01")],
        agendas: [activeAgenda()],
        agendaAnimals: [
          {
            agenda_id: "agenda-active",
            fazenda_id: "farm-1",
            animal_id: "female",
            planned_status: "planejado",
            execution_evento_id: null,
            not_executed_reason: null,
            metadata: {},
            created_at: "2026-07-01",
            updated_at: "2026-07-01",
          },
        ],
      }),
    });
    expect(planned.rows[0]).toMatchObject({
      alreadyPlanned: true,
      status: "insufficient_data",
      canSelect: false,
    });
  });

  it("cria uma agenda agrupada por lote sem evento, estoque, carência ou fila", async () => {
    const result = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    });
    const selected = result.rows.filter((row) => row.canSelect);

    const operationalContext = {
      rabiesRiskArea: true,
      sanitaryCadence: "annual" as const,
      reproductiveContext: "prepartum" as const,
      management: "pre_feedlot" as const,
    };
    await seedPlanningSource();
    const created = await createGroupedManualSanitaryAgendasV2({
      confirmed: true,
      rows: selected,
      fazendaId: "farm-1",
      plannedFor: "2026-07-10",
      operationalContext,
    });

    expect(created).toHaveLength(1);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    const stored = await db.ops_sanitario_agenda_v2.toCollection().first();
    expect(stored?.metadata).toMatchObject({
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    });
    expect(stored?.protocol_item_snapshot).toMatchObject({
      operationalContext,
    });
    expect(stored?.metadata.operationalContext).toBeUndefined();
    expect(stored?.produto_snapshot.operationalContext).toBeUndefined();
  });
  it("mantém pré-checagem informativa mas bloqueia planejamento sem aprovação", () => {
    const unapproved = {
      ...catalog,
      protocols: catalog.protocols.map((p) => ({
        ...p,
        approvalStatus: "draft",
      })),
    };
    const result = buildSanitaryProtocolWindowV2({
      source: source({ catalog: unapproved }),
      protocolId: "protocol-b19",
      itemId: "item-b19",
      evaluatedAt: "2026-07-04",
    })!;
    expect(result.rows[0].status).toBe("in_action_window");
    expect(result.rows[0].canSelect).toBe(false);
    expect(result.rows[0].blockers.join(" ")).toMatch(/aprovação prospectiva/);
  });

  it("serializa cliques concorrentes e retry offline sem duplicar agenda ou fatos", async () => {
    await seedPlanningSource();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    const input = {
      rows,
      fazendaId: "farm-1",
      plannedFor: "2026-07-10",
      confirmed: true,
    };
    const [first, second] = await Promise.all([
      createGroupedManualSanitaryAgendasV2(input),
      createGroupedManualSanitaryAgendasV2(input),
    ]);
    expect(first[0].agendaId).toBe(second[0].agendaId);
    expect([...first, ...second].filter((row) => row.created)).toHaveLength(1);
    await createGroupedManualSanitaryAgendasV2({
      ...input,
      plannedFor: "2026-07-11",
    });
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it("rejeita falta de confirmação, farm-switch e data fora da janela sem escrita parcial", async () => {
    await seedPlanningSource();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    const input = {
      rows,
      fazendaId: "farm-1",
      plannedFor: "2026-07-10",
      confirmed: true,
    };
    await expect(
      createGroupedManualSanitaryAgendasV2({ ...input, confirmed: false }),
    ).rejects.toThrow(/confirme/);
    await expect(
      createGroupedManualSanitaryAgendasV2({ ...input, fazendaId: "farm-2" }),
    ).rejects.toThrow(/fora da fazenda/);
    await expect(
      createGroupedManualSanitaryAgendasV2({
        ...input,
        plannedFor: "2026-12-10",
      }),
    ).rejects.toThrow(/elegibilidade/);
    await expect(
      createGroupedManualSanitaryAgendasV2({
        ...input,
        rows: [...rows, { ...rows[0], animalId: "foreign" }],
      }),
    ).rejects.toThrow();
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("revalida catálogo e pertencimento após preview", async () => {
    await seedPlanningSource();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    await db.catalog_sanitario_protocolos_v2.update("protocol-b19", {
      approval_status: "draft",
    });
    await expect(
      createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm-1",
        plannedFor: "2026-07-10",
        confirmed: true,
      }),
    ).rejects.toThrow(/aprovação/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("não duplica animais em seleções concorrentes parcialmente sobrepostas", async () => {
    await seedPlanningSource();
    const secondAnimal = animal("female-2", "F", "2026-03-01");
    await db.state_animais.put(secondAnimal);
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
      source: source({ animals: [...source().animals, secondAnimal] }),
    }).rows.filter((row) => row.canSelect);
    await Promise.all([
      createGroupedManualSanitaryAgendasV2({
        rows: rows.slice(0, 1),
        fazendaId: "farm-1",
        plannedFor: "2026-07-10",
        confirmed: true,
      }),
      createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm-1",
        plannedFor: "2026-07-10",
        confirmed: true,
      }),
    ]);
    const links = await db.ops_sanitario_agenda_animais_v2.toArray();
    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.animal_id)).size).toBe(2);
  });

  it("rollback preserva atomicidade e permite retry após falha de persistência", async () => {
    await seedPlanningSource();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    const input = {
      rows,
      fazendaId: "farm-1",
      plannedFor: "2026-07-10",
      confirmed: true,
    };
    const write = vi
      .spyOn(db.ops_sanitario_agenda_animais_v2, "bulkPut")
      .mockRejectedValueOnce(new Error("falha simulada"));
    await expect(createGroupedManualSanitaryAgendasV2(input)).rejects.toThrow(
      "falha simulada",
    );
    write.mockRestore();
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(0);
    await createGroupedManualSanitaryAgendasV2(input);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
  });

  it.each(["SC", undefined])(
    "bloqueia B19 com UF %s mesmo sem metadata regional",
    (farmUf) => {
      const result = windowFor({
        protocolId: "protocol-b19",
        itemId: "item-b19",
        source: source({ farmUf }),
      });
      expect(result.rows.every((row) => !row.canSelect)).toBe(true);
    },
  );

  it("B19 já factual dentro da idade não gera nova intenção", () => {
    const result = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
      source: source({
        executedHistory: [
          {
            animalId: "female",
            events: [
              {
                eventId: "b19-real",
                familyCode: "brucelose_b19",
                itemKey: "b19_femeas_3_8_meses",
                executedAt: "2026-06-01",
                source: "event",
              },
            ],
          },
        ],
      }),
    });
    expect(result.rows.find((row) => row.animalId === "female")).toMatchObject({
      status: "completed",
      canSelect: false,
    });
  });

  it("gera B19 condicional offline, serializa concorrência e preserva retry após reabertura", async () => {
    await allowAutomaticB19Fixture();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    const request = {
      rows,
      fazendaId: "farm-1",
      plannedFor: "2026-07-10",
      confirmed: true,
      generationMode: "automatic" as const,
    };
    const results = await Promise.all([
      createGroupedManualSanitaryAgendasV2(request),
      createGroupedManualSanitaryAgendasV2(request),
    ]);
    expect(results.flat().filter((result) => result.created)).toHaveLength(1);
    db.close();
    await db.open();
    expect(
      (await createGroupedManualSanitaryAgendasV2(request))[0].created,
    ).toBe(false);
    const stored = await db.ops_sanitario_agenda_v2.toCollection().first();
    expect(stored?.protocol_item_snapshot).toMatchObject({
      planningKind: "avaliacao_manejo_generica",
      generationMode: "automatic",
    });
    expect(stored?.produto_veterinario_id).toBeNull();
    expect(stored?.protocol_item_snapshot.dose).toBeUndefined();
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("não promove allows_agenda_auto falso nem confia em rows forjadas", async () => {
    await seedPlanningSource();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    await expect(
      createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm-1",
        plannedFor: "2026-07-10",
        confirmed: true,
        generationMode: "automatic",
      }),
    ).rejects.toThrow(/elegibilidade/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("revalida revogação da autorização automática e UF antes da persistência", async () => {
    await allowAutomaticB19Fixture();
    const rows = windowFor({
      protocolId: "protocol-b19",
      itemId: "item-b19",
    }).rows.filter((row) => row.canSelect);
    await db.state_fazenda_sanidade_config.update("farm-1", { uf: "SC" });
    await expect(
      createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm-1",
        plannedFor: "2026-07-10",
        confirmed: true,
        generationMode: "automatic",
      }),
    ).rejects.toThrow();
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("agenda genérica persiste sem produto e não é promovida ao atualizar catálogo", async () => {
    await seedPlanningSource();
    const rows = windowFor({
      protocolId: "protocol-clost",
      itemId: "item-clost-1",
    }).rows.filter((row) => row.canSelect);
    await createGroupedManualSanitaryAgendasV2({
      rows,
      fazendaId: "farm-1",
      plannedFor: "2026-07-10",
      confirmed: true,
    });
    const before = await db.ops_sanitario_agenda_v2.toArray();
    await db.catalog_sanitario_protocolo_itens_versions_v2.update(
      "item-clost-1",
      { product_id: "product-multi" },
    );
    await expect(
      createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm-1",
        plannedFor: "2026-07-10",
        confirmed: true,
      }),
    ).rejects.toThrow(/Tipo de Agenda/);
    expect(await db.ops_sanitario_agenda_v2.toArray()).toEqual(before);
    expect(before[0].metadata.itemLabel).toBe("Avaliar Clostridioses");
  });

  it("esquema específico exige histórico do mesmo produto e não aceita Agenda como dose 1", () => {
    const initial = source({
      catalog: specificCatalog(),
      products: [technicalProduct],
      productSpeciesAuthorizations: [technicalSpecies],
      animals: [animal("female", "F", "2026-03-01")],
    });
    expect(
      windowFor({
        protocolId: "protocol-clost",
        itemId: "item-clost-2",
        source: initial,
      }).rows[0].canSelect,
    ).toBe(false);
    const previous = {
      eventId: "real-dose1",
      protocolId: "protocol-clost",
      familyCode: "clostridioses",
      itemKey: "clostridial_primovac_dose1",
      executedAt: "2026-06-01",
      source: "event" as const,
      productId: "product-multi",
    };
    const valid = {
      ...initial,
      executedHistory: [{ animalId: "female", events: [previous] }],
    };
    expect(
      windowFor({
        protocolId: "protocol-clost",
        itemId: "item-clost-2",
        source: valid,
      }).rows[0].canSelect,
    ).toBe(true);
    const wrongProduct = {
      ...initial,
      executedHistory: [
        {
          animalId: "female",
          events: [{ ...previous, productId: "another-product" }],
        },
      ],
    };
    expect(
      windowFor({
        protocolId: "protocol-clost",
        itemId: "item-clost-2",
        source: wrongProduct,
      }).rows[0].canSelect,
    ).toBe(false);
  });
  it("bloqueia duas Agendas para a mesma aplicação multiprotocolo sem contrato factual múltiplo", async () => {
    await seedPlanningSource();
    const toRow = (value: object) => Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), entry]));
    const first = { ...specificCatalog().items.find((entry) => entry.id === "item-clost-1")!, protocolId: "protocol-ibr", id: "item-ibr", logicalItemKey: "ibr_bvd_primovac_dose1" };
    const second = { ...first, protocolId: "protocol-lepto", id: "item-lepto-multi", logicalItemKey: "lepto_primovac_dose1" };
    const protocols = [protocol("protocol-ibr", "ibr_bvd"), protocol("protocol-lepto", "leptospirose")];
    await db.catalog_sanitario_protocolos_v2.bulkPut(protocols.map(toRow) as never[]);
    await db.catalog_sanitario_protocolo_itens_versions_v2.bulkPut([first, second].map(toRow) as never[]);
    await db.catalog_sanitario_produtos_v2.put(technicalProduct);
    await db.catalog_sanitario_produto_especie_autorizacao_v2.put(technicalSpecies);
    const localSource = source({ catalog: { ...catalog, protocols: [...catalog.protocols, ...protocols], items: [...catalog.items, first, second] }, products: [technicalProduct], productSpeciesAuthorizations: [technicalSpecies] });
    const rows = windowFor({ protocolId: first.protocolId, itemId: first.id, source: localSource }).rows.filter((row) => row.canSelect);
    expect(rows.length).toBeGreaterThan(0);
    await expect(createGroupedManualSanitaryAgendasV2({ rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true })).rejects.toThrow(/multiprotocolo/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
  });

  it.each(["raiva_primovac_dose1", "raiva_primovac_reforco_30d", "raiva_reforco_anual_area_risco"])("writer bloqueia %s com no_agenda_auto mesmo com contexto e aprovação", async (logicalItemKey) => {
    await seedPlanningSource();
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-raiva", {
      logical_item_key: logicalItemKey, limitations: ["no_agenda_auto"], allows_agenda_auto: true, source_refs_by_field: approvedSources(),
    });
    const context = { rabiesRiskArea: true, sanitaryCadence: "annual" as const, reproductiveContext: null, management: null };
    const localCatalog = { ...catalog, items: catalog.items.map((entry) => entry.id === "item-raiva" ? { ...entry, logicalItemKey } : entry) };
    const rows = windowFor({ protocolId: "protocol-raiva", itemId: "item-raiva", source: source({ catalog: localCatalog }), operationalContext: context }).rows.filter((row) => row.canSelect);
    await expect(createGroupedManualSanitaryAgendasV2({ rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true, generationMode: "automatic", operationalContext: context })).rejects.toThrow(/elegibilidade/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("bubalinos não herdam autorização comercial bovina para esquema definido", () => {
    const local = source({ catalog: specificCatalog(), products: [technicalProduct], productSpeciesAuthorizations: [technicalSpecies], animals: [{ ...animal("female", "F", "2026-03-01"), especie: "bubalino" }] });
    expect(windowFor({ protocolId: "protocol-clost", itemId: "item-clost-1", source: local }).rows[0].canSelect).toBe(false);
  });

  it("versão superada não é utilizada para novo planejamento e não apaga agendas anteriores", () => {
    const next = { ...catalog.items[0], id: "item-b19-v2", version: 2 };
    const result = windowFor({ protocolId: "protocol-b19", itemId: "item-b19", source: source({ catalog: { ...catalog, items: [...catalog.items, next] } }) });
    expect(result.rows.every((row) => !row.canSelect)).toBe(true);
    expect(result.rows[0].blockers.join(" ")).toMatch(/Versão substituída/);
  });

  it("pré-checagem usa a versão selecionada quando a versão antiga tem a mesma chave lógica", () => {
    const next = { ...catalog.items.find((entry) => entry.id === "item-clost-1")!, id: "item-clost-1-v2", version: 2, eligibilityRule: { species: ["bovino"], age_min_months: 8 } };
    const result = windowFor({ protocolId: "protocol-clost", itemId: next.id, source: source({ catalog: { ...catalog, items: [...catalog.items, next] } }) });
    expect(result.rows.find((row) => row.animalId === "female")).toMatchObject({ status: "not_yet_eligible", canSelect: false });
  });

});
