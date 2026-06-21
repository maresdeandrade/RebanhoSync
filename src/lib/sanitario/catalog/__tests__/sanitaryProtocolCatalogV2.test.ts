import { describe, expect, it } from "vitest";

import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
  adaptSanitaryProductClassGroupV2Row,
  buildSanitaryProtocolCatalogSummaryV2,
  getSanitaryProtocolV2WithItems,
  listSanitaryProductClassGroupsV2,
  listSanitaryProtocolItemsV2,
  listSanitaryProtocolsV2,
  validateSanitaryProtocolCatalogReadOnlyInvariantsV2,
  type JsonRecord,
  type SanitaryProtocolCatalogQueryClient,
  type SanitaryProtocolCatalogQueryResult,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

type QueryCall = {
  table: string;
  method: "select" | "is" | "eq" | "order";
  column?: string;
  value?: unknown;
};

type TableRows = Record<string, JsonRecord[]>;

class MockQueryBuilder implements PromiseLike<SanitaryProtocolCatalogQueryResult<JsonRecord>> {
  private readonly filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly table: string,
    private readonly rows: JsonRecord[],
    private readonly calls: QueryCall[],
  ) {}

  select(): MockQueryBuilder {
    this.calls.push({ table: this.table, method: "select" });
    return this;
  }

  is(column: string, value: null): MockQueryBuilder {
    this.calls.push({ table: this.table, method: "is", column, value });
    this.filters.push({ column, value });
    return this;
  }

  eq(column: string, value: string): MockQueryBuilder {
    this.calls.push({ table: this.table, method: "eq", column, value });
    this.filters.push({ column, value });
    return this;
  }

  order(column: string): MockQueryBuilder {
    this.calls.push({ table: this.table, method: "order", column });
    return this;
  }

  then<TResult1 = SanitaryProtocolCatalogQueryResult<JsonRecord>, TResult2 = never>(
    onfulfilled?:
      | ((
          value: SanitaryProtocolCatalogQueryResult<JsonRecord>,
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.rows.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value),
    );

    return Promise.resolve({ data: result, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function createMockClient(rows: TableRows): SanitaryProtocolCatalogQueryClient & {
  calls: QueryCall[];
} {
  const calls: QueryCall[] = [];

  return {
    calls,
    from(table: string) {
      return new MockQueryBuilder(table, rows[table] ?? [], calls);
    },
  };
}

const protocol = (familyCode: string, overrides: JsonRecord = {}): JsonRecord => ({
  id: `protocol-${familyCode}`,
  family_code: familyCode,
  name: familyCode,
  scope: "global",
  fazenda_id: null,
  species_scope: { especies: ["bovino"] },
  jurisdiction_scope: { pais: "BR", escopo: "nacional" },
  legal_status: "manual_only",
  version: 1,
  status: "draft",
  source_refs_snapshot: [{ source_id: "fonte", locator: familyCode }],
  approval_status: "draft",
  metadata: {
    agenda_allowed: false,
    approved_for_catalog: false,
  },
  deleted_at: null,
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
  limitations: {},
  snapshot_template: {},
  allows_agenda_auto: false,
  requires_mv_responsavel: false,
  status: "draft",
  deleted_at: null,
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
    active_ingredients_text_only: true,
  },
  deleted_at: null,
});

const protocols = [
  protocol("brucelose_b19", {
    species_scope: ["bovino", "bubalino"],
    jurisdiction_scope: { country: "BR", legal_scope: "nacional" },
    legal_status: "obrigatorio_norma",
    metadata: {
      agenda_allowed: false,
      approved_for_catalog: false,
      curationStatus: "needs_review",
      automationStatus: "manual_only",
    },
  }),
  protocol("febre_aftosa", {
    legal_status: "bloqueado",
    status: "retired",
    metadata: {
      agenda_allowed: false,
      approved_for_catalog: false,
      automation_status: "blocked",
    },
  }),
  protocol("controle_parasitario_recria_5_7_9"),
  protocol("vermifugacao_pre_desmama"),
  protocol("vermifugacao_pre_confinamento_pasto_vedado"),
  protocol("matrizes_pre_parto"),
  protocol("raiva_herbivoros"),
  protocol("clostridioses"),
  protocol("leptospirose"),
  protocol("ibr_bvd"),
];

const protocolId = (familyCode: string) => `protocol-${familyCode}`;

const antiparasiticOverrides = (groupKey: string): JsonRecord => ({
  product_requirement_kind: "product_class_group",
  product_class_group_id: `group-${groupKey}`,
});

const items = [
  item(protocolId("brucelose_b19"), "b19_femeas_3_8_meses", {
    eligibility_rule: {
      sex: "femea",
      age_min_months: 3,
      age_max_months: 8,
    },
  }),
  item(protocolId("febre_aftosa"), "fmd_historico_contingencia"),
  item(protocolId("febre_aftosa"), "fmd_bloqueio_vacinacao_rotina"),
  item(
    protocolId("controle_parasitario_recria_5_7_9"),
    "recria_maio",
    antiparasiticOverrides("antiparasitario_endectocida"),
  ),
  item(
    protocolId("controle_parasitario_recria_5_7_9"),
    "recria_julho",
    antiparasiticOverrides("antiparasitario_endectocida"),
  ),
  item(
    protocolId("controle_parasitario_recria_5_7_9"),
    "recria_setembro",
    antiparasiticOverrides("antiparasitario_endectocida"),
  ),
  item(
    protocolId("vermifugacao_pre_desmama"),
    "pre_desmama_situacional",
    antiparasiticOverrides("antiparasitario_pre_desmama"),
  ),
  item(
    protocolId("vermifugacao_pre_confinamento_pasto_vedado"),
    "pre_confinamento_dose_unica",
    antiparasiticOverrides("antiparasitario_pre_confinamento"),
  ),
  item(
    protocolId("matrizes_pre_parto"),
    "matrizes_pre_parto_antiparasitario",
    antiparasiticOverrides("antiparasitario_matrizes"),
  ),
  item(protocolId("raiva_herbivoros"), "raiva_primovac_dose1", {
    item_status: "condicional",
    action_type: "vacinacao",
    product_requirement_kind: "product_class",
    product_class: "vacina_raiva_herbivoros",
    snapshot_template: { metadata: { automationStatus: "manual_only" } },
  }),
  item(protocolId("raiva_herbivoros"), "raiva_primovac_reforco_30d", {
    item_status: "condicional",
    action_type: "vacinacao",
    product_requirement_kind: "product_class",
    product_class: "vacina_raiva_herbivoros",
    operational_window_rule: {
      anchor: "previous_dose",
      min_offset_days: 30,
      max_offset_days: 30,
    },
    snapshot_template: { metadata: { automationStatus: "manual_only" } },
  }),
  item(protocolId("raiva_herbivoros"), "raiva_reforco_anual_area_risco", {
    item_status: "condicional",
    action_type: "vacinacao",
    product_requirement_kind: "product_class",
    product_class: "vacina_raiva_herbivoros",
    booster_rule: { recurrenceRule: { kind: "annual_if_risk_area" } },
    snapshot_template: { metadata: { automationStatus: "manual_only" } },
  }),
  item(protocolId("clostridioses"), "clostridial_primovac_dose1"),
  item(protocolId("clostridioses"), "clostridial_primovac_dose2"),
  item(protocolId("clostridioses"), "clostridial_reforco_anual"),
  item(protocolId("leptospirose"), "lepto_primovac_dose1"),
  item(protocolId("leptospirose"), "lepto_primovac_dose2"),
  item(protocolId("leptospirose"), "lepto_reforco_anual_semestral"),
  item(protocolId("ibr_bvd"), "ibr_bvd_primovac_dose1"),
  item(protocolId("ibr_bvd"), "ibr_bvd_primovac_dose2"),
  item(
    protocolId("matrizes_pre_parto"),
    "matrizes_pre_parto_lepto_reforco_situacional",
  ),
];

const groups = [
  group("antiparasitario_endectocida"),
  group("antiparasitario_pre_desmama"),
  group("antiparasitario_pre_confinamento"),
  group("antiparasitario_matrizes"),
];

const createCatalogClient = () =>
  createMockClient({
    sanitario_protocolos_v2: protocols,
    sanitario_protocolo_itens_versions_v2: items,
    sanitario_product_class_groups_v2: groups,
  });

describe("sanitaryProtocolCatalogV2", () => {
  it("lista protocolos, itens e ProductClassGroups v2 via leitura read-only", async () => {
    const client = createCatalogClient();

    await expect(listSanitaryProtocolsV2(client)).resolves.toHaveLength(10);
    await expect(listSanitaryProtocolItemsV2(client)).resolves.toHaveLength(21);
    await expect(listSanitaryProductClassGroupsV2(client)).resolves.toHaveLength(4);

    expect(client.calls.map((call) => call.method)).not.toContain("insert");
    expect(client.calls.map((call) => call.method)).not.toContain("update");
  });

  it("monta protocolo com itens por family_code sem consultar JSON canonico", async () => {
    const client = createCatalogClient();

    const b19 = await getSanitaryProtocolV2WithItems(client, {
      familyCode: "brucelose_b19",
    });

    expect(b19?.protocol.familyCode).toBe("brucelose_b19");
    expect(b19?.items.map((entry) => entry.logicalItemKey)).toEqual([
      "b19_femeas_3_8_meses",
    ]);
    expect(client.calls.some((call) => call.table.endsWith(".json"))).toBe(false);
  });

  it("confirma B19 nacional, aftosa bloqueada e 6 antiparasitarios com ProductClassGroup", () => {
    const summary = buildSanitaryProtocolCatalogSummaryV2({
      protocols: protocols.map(adaptSanitaryProtocolV2Row),
      items: items.map(adaptSanitaryProtocolItemV2Row),
      productClassGroups: groups.map(adaptSanitaryProductClassGroupV2Row),
    });

    expect(summary).toMatchObject({
      protocolCount: 10,
      itemCount: 21,
      productClassGroupCount: 4,
      memberImportBlockedCount: 16,
      hasB19NationalRule: true,
      hasAftosaBlockedRule: true,
      antiparasiticItemsUseProductClassGroup: true,
      hasAgendaAutoEnabled: false,
      hasApprovedCatalogProtocol: false,
    });
  });

  it("normaliza aliases reais do payload importado para B19", () => {
    const b19Protocol = adaptSanitaryProtocolV2Row({
      ...protocol("brucelose_b19"),
      species_scope: ["bovino", "bubalino"],
      jurisdiction_scope: { country: "BR", legal_scope: "nacional" },
      legal_status: "obrigatorio_norma",
    });
    const b19Item = adaptSanitaryProtocolItemV2Row({
      ...item(protocolId("brucelose_b19"), "b19_femeas_3_8_meses"),
      eligibility_rule: {
        sex: "femea",
        age_min_months: 3,
        age_max_months: 8,
      },
    });
    const summary = buildSanitaryProtocolCatalogSummaryV2({
      protocols: [b19Protocol],
      items: [b19Item],
      productClassGroups: [],
    });

    expect(b19Protocol.speciesScope.especies).toEqual(["bovino", "bubalino"]);
    expect(summary.hasB19NationalRule).toBe(true);
  });

  it("confirma raiva com primovacinacao, reforco 30d e reforco anual manual_only", () => {
    const readModel = {
      protocols: protocols.map(adaptSanitaryProtocolV2Row),
      items: items.map(adaptSanitaryProtocolItemV2Row),
      productClassGroups: groups.map(adaptSanitaryProductClassGroupV2Row),
    };
    const raiva = readModel.protocols.find(
      (entry) => entry.familyCode === "raiva_herbivoros",
    );
    const raivaItems = readModel.items.filter(
      (entry) => entry.protocolId === raiva?.id,
    );

    expect(raivaItems.map((entry) => entry.logicalItemKey).sort()).toEqual([
      "raiva_primovac_dose1",
      "raiva_primovac_reforco_30d",
      "raiva_reforco_anual_area_risco",
    ]);
    expect(
      raivaItems.every(
        (entry) =>
          entry.productRequirementKind === "product_class" &&
          entry.productClass === "vacina_raiva_herbivoros" &&
          entry.productClassGroupId === null &&
          entry.allowsAgendaAuto === false &&
          entry.status === "draft" &&
          entry.snapshotTemplate.metadata?.automationStatus === "manual_only",
      ),
    ).toBe(true);
    expect(
      raivaItems.find(
        (entry) => entry.logicalItemKey === "raiva_primovac_reforco_30d",
      )?.operationalWindowRule,
    ).toMatchObject({
      anchor: "previous_dose",
      min_offset_days: 30,
      max_offset_days: 30,
    });
  });

  it("preserva invariantes: protocolo e grupo nao autorizam operacao", async () => {
    const client = createCatalogClient();
    const readModel = {
      protocols: await listSanitaryProtocolsV2(client),
      items: await listSanitaryProtocolItemsV2(client),
      productClassGroups: await listSanitaryProductClassGroupsV2(client),
    };
    const issues = validateSanitaryProtocolCatalogReadOnlyInvariantsV2(readModel);
    const summary = buildSanitaryProtocolCatalogSummaryV2(readModel);

    expect(issues).toEqual([]);
    expect(summary.createsAgenda).toBe(false);
    expect(summary.createsEvent).toBe(false);
    expect(summary.createsStockMovement).toBe(false);
    expect(summary.createsActiveWithdrawal).toBe(false);
    expect(summary.allowsOperationalRelease).toBe(false);
    expect(summary.productClassGroupAuthorizesExecution).toBe(false);
    expect(summary.productClassGroupAuthorizesDose).toBe(false);
    expect(summary.productClassGroupAuthorizesWithdrawal).toBe(false);
    expect(summary.requiresRealProductForExecution).toBe(true);
  });
});
