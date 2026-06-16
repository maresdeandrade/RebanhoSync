import { describe, expect, it } from "vitest";

import {
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
    species_scope: { especies: ["bovino", "bubalino"] },
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
  protocol("controle_parasitario_recria"),
  protocol("controle_parasitario_pre_desmama"),
  protocol("controle_parasitario_pre_confinamento"),
  protocol("controle_parasitario_matrizes"),
  protocol("raiva_herbivoros"),
  protocol("clostridioses"),
  protocol("leptospirose_ibr_bvd"),
  protocol("rastreabilidade_medicamentos"),
];

const protocolId = (familyCode: string) => `protocol-${familyCode}`;

const antiparasiticOverrides = (groupKey: string): JsonRecord => ({
  product_requirement_kind: "product_class_group",
  product_class_group_id: `group-${groupKey}`,
});

const items = [
  item(protocolId("brucelose_b19"), "b19_femeas_3_8_meses", {
    eligibility_rule: {
      sexo: "femea",
      idade_min_meses: 3,
      idade_max_meses: 8,
    },
  }),
  item(protocolId("febre_aftosa"), "aftosa_vacinacao_bloqueada"),
  item(protocolId("febre_aftosa"), "aftosa_sem_agenda"),
  item(
    protocolId("controle_parasitario_recria"),
    "recria_maio",
    antiparasiticOverrides("antiparasitario_endectocida"),
  ),
  item(
    protocolId("controle_parasitario_recria"),
    "recria_julho",
    antiparasiticOverrides("antiparasitario_endectocida"),
  ),
  item(
    protocolId("controle_parasitario_recria"),
    "recria_setembro",
    antiparasiticOverrides("antiparasitario_endectocida"),
  ),
  item(
    protocolId("controle_parasitario_pre_desmama"),
    "pre_desmama_situacional",
    antiparasiticOverrides("antiparasitario_pre_desmama"),
  ),
  item(
    protocolId("controle_parasitario_pre_confinamento"),
    "pre_confinamento_dose_unica",
    antiparasiticOverrides("antiparasitario_pre_confinamento"),
  ),
  item(
    protocolId("controle_parasitario_matrizes"),
    "matrizes_pre_parto_antiparasitario",
    antiparasiticOverrides("antiparasitario_matrizes"),
  ),
  item(protocolId("raiva_herbivoros"), "raiva_d1"),
  item(protocolId("raiva_herbivoros"), "raiva_reforco"),
  item(protocolId("clostridioses"), "clostridioses_primovacinacao"),
  item(protocolId("clostridioses"), "clostridioses_reforco"),
  item(protocolId("leptospirose_ibr_bvd"), "reprodutivas_pre_estacao"),
  item(protocolId("leptospirose_ibr_bvd"), "reprodutivas_reforco"),
  item(protocolId("rastreabilidade_medicamentos"), "medicamento_antibiotico"),
  item(protocolId("rastreabilidade_medicamentos"), "medicamento_antiinflamatorio"),
  item(protocolId("rastreabilidade_medicamentos"), "medicamento_suporte"),
  item(protocolId("rastreabilidade_medicamentos"), "medicamento_outros"),
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
    await expect(listSanitaryProtocolItemsV2(client)).resolves.toHaveLength(19);
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
      protocols: protocols.map((row) => ({
        id: String(row.id),
        familyCode: String(row.family_code),
        name: String(row.name),
        scope: String(row.scope),
        fazendaId: null,
        speciesScope: row.species_scope as JsonRecord,
        jurisdictionScope: row.jurisdiction_scope as JsonRecord,
        legalStatus: String(row.legal_status),
        version: Number(row.version),
        status: String(row.status),
        approvalStatus: String(row.approval_status),
        sourceRefsSnapshot: row.source_refs_snapshot as unknown[],
        metadata: row.metadata as JsonRecord,
      })),
      items: items.map((row) => ({
        id: String(row.id),
        protocolId: String(row.protocol_id),
        logicalItemKey: String(row.logical_item_key),
        version: Number(row.version),
        itemStatus: String(row.item_status),
        actionType: String(row.action_type),
        productRequirementKind: String(row.product_requirement_kind),
        productId: null,
        productClass: null,
        productClassGroupId:
          typeof row.product_class_group_id === "string"
            ? row.product_class_group_id
            : null,
        eligibilityRule: row.eligibility_rule as JsonRecord,
        operationalWindowRule: row.operational_window_rule as JsonRecord,
        doseRule: row.dose_rule as JsonRecord,
        routeRule: row.route_rule as JsonRecord,
        boosterRule: row.booster_rule as JsonRecord,
        speciesAuthorization: row.species_authorization as JsonRecord,
        sourceRefsByField: row.source_refs_by_field as JsonRecord,
        limitations: row.limitations as JsonRecord,
        snapshotTemplate: row.snapshot_template as JsonRecord,
        allowsAgendaAuto: row.allows_agenda_auto === true,
        requiresMvResponsavel: row.requires_mv_responsavel === true,
        status: String(row.status),
      })),
      productClassGroups: groups.map((row) => ({
        id: String(row.id),
        fazendaId: null,
        scope: String(row.scope),
        groupKey: String(row.group_key),
        name: String(row.name),
        requiresMvForOtherClass: row.requires_mv_for_other_class === true,
        curationStatus: String(row.curation_status),
        automationStatus: String(row.automation_status),
        limitations: row.limitations as string[],
        metadata: row.metadata as JsonRecord,
      })),
    });

    expect(summary).toMatchObject({
      protocolCount: 10,
      itemCount: 19,
      productClassGroupCount: 4,
      memberImportBlockedCount: 16,
      hasB19NationalRule: true,
      hasAftosaBlockedRule: true,
      antiparasiticItemsUseProductClassGroup: true,
      hasAgendaAutoEnabled: false,
      hasApprovedCatalogProtocol: false,
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
