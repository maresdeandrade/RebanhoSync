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

vi.mock("@/lib/offline/localReadBoundary", () => ({ requireTenantSensitiveRead: vi.fn().mockResolvedValue(undefined) }));

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
    db.ops_sanitario_agenda_v2.clear(),
    db.ops_sanitario_agenda_animais_v2.clear(),
    db.state_animais.clear(), db.state_lotes.clear(),
    db.catalog_sanitario_protocolos_v2.clear(), db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
    db.catalog_sanitario_product_class_groups_v2.clear(), db.state_fazenda_sanidade_config.clear(),
    db.event_eventos_animais.clear(),
    db.queue_ops.clear(),
    db.event_eventos.clear(),
    db.event_eventos_sanitario.clear(),
    db.state_insumo_movimentacoes.clear(),
  ]);
}

async function seedPlanningSource() {
  await db.state_animais.bulkPut(source().animals);
  await db.state_lotes.bulkPut(source().lots);
  const snake = (value: Record<string, unknown>) => Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), entry]),
  );
  await db.catalog_sanitario_protocolos_v2.bulkPut(catalog.protocols.map((row) => snake(row)) as never[]);
  await db.catalog_sanitario_protocolo_itens_versions_v2.bulkPut(catalog.items.map((row) => snake(row)) as never[]);
}

describe("sanitaryProtocolWindowsV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearOperationalTables();
  });
  afterEach(clearOperationalTables);

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
      canSelect: true,
    });
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
    ).toMatchObject({ status: "in_action_window", canSelect: true });

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
    ).toMatchObject({ status: "in_action_window", canSelect: true });
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
    const unapproved = { ...catalog, protocols: catalog.protocols.map((p) => ({ ...p, approvalStatus: "draft" })) };
    const result = buildSanitaryProtocolWindowV2({ source: source({ catalog: unapproved }), protocolId: "protocol-b19", itemId: "item-b19", evaluatedAt: "2026-07-04" })!;
    expect(result.rows[0].status).toBe("in_action_window");
    expect(result.rows[0].canSelect).toBe(false);
    expect(result.rows[0].blockers.join(" ")).toMatch(/aprovação prospectiva/);
  });

  it("serializa cliques concorrentes e retry offline sem duplicar agenda ou fatos", async () => {
    await seedPlanningSource();
    const rows = windowFor({ protocolId: "protocol-b19", itemId: "item-b19" }).rows.filter((row) => row.canSelect);
    const input = { rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true };
    const [first, second] = await Promise.all([createGroupedManualSanitaryAgendasV2(input), createGroupedManualSanitaryAgendasV2(input)]);
    expect(first[0].agendaId).toBe(second[0].agendaId);
    expect([...first, ...second].filter((row) => row.created)).toHaveLength(1);
    await createGroupedManualSanitaryAgendasV2({ ...input, plannedFor: "2026-07-11" });
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it("rejeita falta de confirmação, farm-switch e data fora da janela sem escrita parcial", async () => {
    await seedPlanningSource();
    const rows = windowFor({ protocolId: "protocol-b19", itemId: "item-b19" }).rows.filter((row) => row.canSelect);
    const input = { rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true };
    await expect(createGroupedManualSanitaryAgendasV2({ ...input, confirmed: false })).rejects.toThrow(/confirme/);
    await expect(createGroupedManualSanitaryAgendasV2({ ...input, fazendaId: "farm-2" })).rejects.toThrow(/fora da fazenda/);
    await expect(createGroupedManualSanitaryAgendasV2({ ...input, plannedFor: "2026-12-10" })).rejects.toThrow(/elegibilidade/);
    await expect(createGroupedManualSanitaryAgendasV2({ ...input, rows: [...rows, { ...rows[0], animalId: "foreign" }] })).rejects.toThrow();
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("revalida catálogo e pertencimento após preview", async () => {
    await seedPlanningSource();
    const rows = windowFor({ protocolId: "protocol-b19", itemId: "item-b19" }).rows.filter((row) => row.canSelect);
    await db.catalog_sanitario_protocolos_v2.update("protocol-b19", { approval_status: "draft" });
    await expect(createGroupedManualSanitaryAgendasV2({ rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true })).rejects.toThrow(/aprovação/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("não duplica animais em seleções concorrentes parcialmente sobrepostas", async () => {
    await seedPlanningSource();
    const secondAnimal = animal("female-2", "F", "2026-03-01");
    await db.state_animais.put(secondAnimal);
    const rows = windowFor({ protocolId: "protocol-b19", itemId: "item-b19", source: source({ animals: [...source().animals, secondAnimal] }) }).rows.filter((row) => row.canSelect);
    await Promise.all([
      createGroupedManualSanitaryAgendasV2({ rows: rows.slice(0, 1), fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true }),
      createGroupedManualSanitaryAgendasV2({ rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true }),
    ]);
    const links = await db.ops_sanitario_agenda_animais_v2.toArray();
    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.animal_id)).size).toBe(2);
  });

  it("rollback preserva atomicidade e permite retry após falha de persistência", async () => {
    await seedPlanningSource();
    const rows = windowFor({ protocolId: "protocol-b19", itemId: "item-b19" }).rows.filter((row) => row.canSelect);
    const input = { rows, fazendaId: "farm-1", plannedFor: "2026-07-10", confirmed: true };
    const write = vi.spyOn(db.ops_sanitario_agenda_animais_v2, "bulkPut").mockRejectedValueOnce(new Error("falha simulada"));
    await expect(createGroupedManualSanitaryAgendasV2(input)).rejects.toThrow("falha simulada");
    write.mockRestore();
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(0);
    await createGroupedManualSanitaryAgendasV2(input);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
  });

});
