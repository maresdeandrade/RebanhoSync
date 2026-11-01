import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/offline/db";
import {
  setSanitarioV2PushEnabled,
} from "@/lib/offline/sanitarioV2Cutover";
import type {
  Animal,
  InsumoLote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SanitarioProdutoCarenciaRuleLocalV2,
} from "@/lib/offline/types";
import { adaptSanitaryProtocolItemV2Row, adaptSanitaryProtocolV2Row, type SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import {
  executeSanitaryAgendaBatchV2,
  executeSanitaryAgendaV2,
  type ExecuteSanitaryAgendaInputV2,
  type ExecuteSanitaryAgendaResultV2,
} from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import { buildSanitaryExecutedHistoryV2 } from "@/lib/sanitario/history/sanitaryExecutedHistoryV2";
import type { ExecutedProductTechnicalSnapshotV2 } from "@/lib/sanitario/rules/sanitarySnapshotsV2";

const agenda = (overrides: Partial<SanitarioAgendaLocalV2> = {}): SanitarioAgendaLocalV2 => ({
  id: "agenda-1",
  fazenda_id: "farm-1",
  status: "programada",
  dedup_key: "dedup-1",
  client_id: "client-1",
  client_op_id: "agenda-op-1",
  client_tx_id: null,
  client_recorded_at: "2026-06-01T10:00:00.000Z",
  server_received_at: "2026-06-01T10:00:00.000Z",
  source_demand_key: "demand-1",
  preview_group_id: "preview-1",
  protocolo_id: "protocol-1",
  protocol_item_version_id: "item-version-1",
  protocol_item_snapshot: {
    protocolName: "Raiva",
    itemLabel: "Reforço anual",
    itemKey: "item-1",
    logicalItemKey: "item-1",
    version: 2,
    actionType: "vacinacao",
    productRequirementKind: "product_class",
    productClass: "vacina_raiva",
  },
  janela_inicio: "2026-07-01",
  janela_fim: null,
  data_programada: "2026-07-01",
  lote_id: "lot-1",
  produto_veterinario_id: null,
  produto_snapshot: {},
  produto_classe: "vacina_raiva",
  acao_sanitaria: "vacinacao",
  execution_evento_id: null,
  metadata: {
    protocolName: "Raiva",
    itemLabel: "Reforço anual",
    itemKey: "item-1",
    productRequirementKind: "product_class",
    productClass: "vacina_raiva",
    target: { scope: "lote", id: "lot-1" },
    targetAnimalIds: ["animal-1"],
  },
  created_at: "2026-06-01T10:00:00.000Z",
  updated_at: "2026-06-01T10:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("executeSanitaryAgendaBatchV2", () => {
  const inputs = ["agenda-a", "agenda-b", "agenda-c"].map(
    (agendaId, index): ExecuteSanitaryAgendaInputV2 => ({
      fazendaId: "farm-batch",
      agendaId,
      clientOpId: `batch-op-${index + 1}`,
      executedAt: "2026-08-23",
      confirmation: { userConfirmedExecution: true },
    }),
  );
  const success = (
    input: ExecuteSanitaryAgendaInputV2,
  ): ExecuteSanitaryAgendaResultV2 => ({
    eventId: `event-${input.agendaId}`,
    agendaId: input.agendaId,
    clientOpId: input.clientOpId,
    agendaStatus: "executed",
    createsEvent: true,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
  });

  it("representa sucesso total por item", async () => {
    const executeItem = vi.fn(async (input: ExecuteSanitaryAgendaInputV2) =>
      success(input),
    );

    const result = await executeSanitaryAgendaBatchV2(inputs, executeItem);

    expect(result.items.map((item) => item.status)).toEqual([
      "EXECUTADO",
      "EXECUTADO",
      "EXECUTADO",
    ]);
    expect(result).toMatchObject({
      executedCount: 3,
      failedCount: 0,
      notExecutedCount: 0,
      retryAvailableCount: 0,
    });
  });

  it("distingue falha no primeiro item dos itens ainda não executados", async () => {
    const executeItem = vi.fn(async () => {
      throw new Error("first-item-failed");
    });

    const result = await executeSanitaryAgendaBatchV2(inputs, executeItem);

    expect(executeItem).toHaveBeenCalledTimes(1);
    expect(result.items.map((item) => item.status)).toEqual([
      "FALHOU",
      "NAO_EXECUTADO",
      "NAO_EXECUTADO",
    ]);
    expect(result.retryAvailableCount).toBe(3);
  });

  it("preserva sucesso parcial e retry executa somente falhos ou pendentes", async () => {
    const firstAttempt = vi.fn(
      async (input: ExecuteSanitaryAgendaInputV2) => {
        if (input.agendaId === "agenda-b") throw new Error("second-item-failed");
        return success(input);
      },
    );
    const firstResult = await executeSanitaryAgendaBatchV2(
      inputs,
      firstAttempt,
    );

    expect(firstResult.items.map((item) => item.status)).toEqual([
      "EXECUTADO",
      "FALHOU",
      "NAO_EXECUTADO",
    ]);
    const retryIds = new Set(
      firstResult.items
        .filter((item) => item.retryAvailable)
        .map((item) => item.clientOpId),
    );
    const retryInputs = inputs.filter((input) => retryIds.has(input.clientOpId));
    const retryAttempt = vi.fn(async (input: ExecuteSanitaryAgendaInputV2) =>
      success(input),
    );

    const retryResult = await executeSanitaryAgendaBatchV2(
      retryInputs,
      retryAttempt,
    );

    expect(retryAttempt.mock.calls.map(([input]) => input.agendaId)).toEqual([
      "agenda-b",
      "agenda-c",
    ]);
    expect(retryAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ agendaId: "agenda-a" }),
    );
    expect(retryResult.retryAvailableCount).toBe(0);
    expect(firstAttempt).toHaveBeenCalledTimes(2);
  });
});

const agendaAnimal = (
  overrides: Partial<SanitarioAgendaAnimalLocalV2> = {},
): SanitarioAgendaAnimalLocalV2 => ({
  agenda_id: "agenda-1",
  fazenda_id: "farm-1",
  animal_id: "animal-1",
  planned_status: "planejado",
  execution_evento_id: null,
  not_executed_reason: null,
  metadata: {},
  created_at: "2026-06-01T10:00:00.000Z",
  updated_at: "2026-06-01T10:00:00.000Z",
  ...overrides,
});

const withdrawalRule = (
  overrides: Partial<SanitarioProdutoCarenciaRuleLocalV2> = {},
): SanitarioProdutoCarenciaRuleLocalV2 => ({
  id: "withdrawal-1",
  product_id: "product-1",
  species_code: "bovino",
  aptitude: "corte",
  route: "subcutanea",
  dose_basis: "dose",
  meat_days: 30,
  milk_days: null,
  milk_hours: null,
  applicability: "period",
  zero_requires_explicit_source: false,
  valid_from: null,
  valid_until: null,
  status_curatorial: "ativo",
  limitations: [],
  metadata: { sourceRefs: [{ id: "source-1", fieldKeys: ["withdrawal"] }] },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const inventoryLot = (overrides: Partial<InsumoLote> = {}): InsumoLote => ({
  id: "stock-lot-1",
  fazenda_id: "farm-1",
  insumo_id: "insumo-1",
  apresentacao_id: null,
  identificacao_lote: "L-1",
  validade: "2027-01-01",
  fabricante: "Lab",
  local_armazenamento: null,
  quantidade_inicial_base: 100,
  saldo_atual_base: 100,
  unidade_base: "ml",
  status: "ativo",
  custo_total: 500,
  custo_unitario: 5,
  payload: {},
  client_id: "client-1",
  client_op_id: "stock-op-1",
  client_tx_id: null,
  client_recorded_at: "2026-01-01T00:00:00.000Z",
  server_received_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const catalog: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [
    {
      id: "protocol-1",
      familyCode: "raiva_herbivoros",
      name: "Raiva",
      scope: "global",
      fazendaId: null,
      speciesScope: {},
      jurisdictionScope: {},
      legalStatus: "vigente",
      version: 1,
      status: "active",
      approvalStatus: "approved",
      sourceRefsSnapshot: [],
      metadata: {},
    },
  ],
  items: [
    {
      id: "item-version-1",
      protocolId: "protocol-1",
      logicalItemKey: "item-1",
      version: 2,
      itemStatus: "ativo",
      actionType: "vacinacao",
      productRequirementKind: "product_class",
      productId: null,
      productClass: "vacina_raiva",
      productClassGroupId: null,
      eligibilityRule: {},
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
    },
  ],
  productClassGroups: [],
};

async function clearScope() {
  await Promise.all([
    db.ops_sanitario_agenda_v2.clear(),
    db.ops_sanitario_agenda_animais_v2.clear(),
    db.event_eventos.clear(),
    db.event_eventos_sanitario.clear(),
    db.event_eventos_animais.clear(),
    db.state_insumo_lotes.clear(),
    db.state_insumo_movimentacoes.clear(),
    db.catalog_sanitario_produto_carencia_rules_v2.clear(),
    db.catalog_sanitario_produto_carencia_fontes_v2.clear(),
    db.catalog_sanitario_produtos_v2.clear(),
    db.catalog_sanitario_protocolos_v2.clear(),
    db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
    db.catalog_sanitario_fontes_tecnicas_v2.clear(),
    db.catalog_sanitario_fonte_cobertura_campos_v2.clear(),
    db.catalog_sanitario_produto_fontes_v2.clear(),
    db.catalog_sanitario_produto_dose_rules_v2.clear(),
    db.catalog_sanitario_produto_especie_autorizacao_v2.clear(),
    db.state_animais.clear(),
    db.state_fazenda_sanidade_config.clear(),
    db.queue_ops.clear(),
    db.queue_gestures.clear(),
    db.sync_sanitario_v2_cutovers.clear(),
  ]);
}

async function seedAgenda(record = agenda()) {
  await seedWithdrawalContext();
  await db.ops_sanitario_agenda_v2.put(record);
  await db.ops_sanitario_agenda_animais_v2.put(agendaAnimal({ agenda_id: record.id }));
  await db.catalog_sanitario_protocolos_v2.put({
    id: record.protocolo_id!, family_code: "raiva_herbivoros", name: "Raiva",
    scope: "global", fazenda_id: null, species_scope: ["bovino"],
    jurisdiction_scope: {}, legal_status: "condicional", version: 1,
    status: "active", approval_status: "approved", source_refs_snapshot: [],
    metadata: {}, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null,
  });
  await db.catalog_sanitario_protocolo_itens_versions_v2.put({
    id: record.protocol_item_version_id!, protocol_id: record.protocolo_id!,
    logical_item_key: "item-1", version: 2, item_status: "recomendado",
    action_type: "vacinacao", product_requirement_kind: String(record.metadata.productRequirementKind ?? record.protocol_item_snapshot.productRequirementKind ?? "product_class"),
    product_id: null, product_class: record.produto_classe,
    product_class_group_id: (record.metadata.productClassGroupId as string) ?? null,
    eligibility_rule: {}, operational_window_rule: {}, dose_rule: null,
    route_rule: null, booster_rule: null, species_authorization: [],
    source_refs_by_field: {}, limitations: [], snapshot_template: {},
    allows_agenda_auto: false, requires_mv_responsavel: false, status: "active",
    created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null,
  });
}

async function seedWithdrawalContext() {
  const now = "2026-01-01T00:00:00.000Z";
  await db.catalog_sanitario_produto_carencia_fontes_v2.put({
    withdrawal_rule_id: withdrawalRule().id, source_id: "withdrawal-source", field_key: "withdrawal", created_at: now,
  });
  await db.catalog_sanitario_produtos_v2.put({
    id: "product-1", nome_comercial: "Vacina Raiva", fabricante: "Lab",
    registro_orgao: "MAPA", registro_numero: "1", classe: "vacina_raiva",
    principio_ativo: "antigeno", tipo_produto: "imunobiologico", apresentacao: null,
    status_curatorial: "ativo", metadata: {}, created_at: now, updated_at: now,
    deleted_at: null,
  });
  await db.state_animais.put({
    id: "animal-1", fazenda_id: "farm-1", identificacao: "A-1", sexo: "F",
    status: "ativo", lote_id: "lot-1", data_nascimento: null, data_entrada: null,
    data_saida: null, pai_id: null, mae_id: null, nome: null, rfid: null,
    especie: "bovino", origem: null, raca: null, papel_macho: null,
    habilitado_monta: false, observacoes: null, payload: {}, client_id: "client-1",
    client_op_id: "animal-op-1", client_tx_id: null, client_recorded_at: now,
    server_received_at: now, created_at: now, updated_at: now, deleted_at: null,
  });
  await db.state_fazenda_sanidade_config.put({
    fazenda_id: "farm-1", uf: null, aptidao: "corte", sistema: "extensivo",
    zona_raiva_risco: "baixo", pressao_carrapato: "baixo",
    pressao_helmintos: "baixo", modo_calendario: "tecnico_recomendado", payload: {},
    client_id: "client-1", client_op_id: "config-op-1", client_tx_id: null,
    client_recorded_at: now, server_received_at: now, created_at: now,
    updated_at: now, deleted_at: null,
  });
  await db.catalog_sanitario_fontes_tecnicas_v2.put({
    id: "withdrawal-source", kind: "bula", scope: "global", fazenda_id: null,
    title: "Bula", issuer: "Lab", version: "v1", published_at: null,
    accessed_at: now, url: null, jurisdiction_country: "BR", jurisdiction_uf: null,
    jurisdiction_zone: null, strength: "forte", evidence_status: "SIM_BULA",
    limitations: [], metadata: {}, created_by: null, created_at: now, updated_at: now,
    deleted_at: null,
  });
  await db.catalog_sanitario_fonte_cobertura_campos_v2.put({
    id: "withdrawal-coverage", source_id: "withdrawal-source", field_key: "withdrawal",
    coverage_status: "covers", notes: null, created_at: now, updated_at: now,
    deleted_at: null,
  });
  await db.catalog_sanitario_produto_fontes_v2.put({
    product_id: "product-1", source_id: "withdrawal-source", field_key: "withdrawal",
    created_at: now,
  });
}

const baseInput = {
  fazendaId: "farm-1",
  agendaId: "agenda-1",
  clientOpId: "exec-op-1",
  executedAt: "2026-07-02",
  product: {
    productId: "product-1",
    productName: "Vacina Raiva",
    productClass: "vacina_raiva",
  },
  application: {
    dose: 2,
    doseUnit: "ml",
    route: "subcutanea",
  },
  confirmation: {
    userConfirmedExecution: true as const,
  },
};

async function seedClassSchemeAgenda() {
  const record = agenda();
  const sourceId = "class-source", now = "2026-01-01";
  const fields = ["dose", "route", "species_authorization", "operational_window"];
  const refs = Object.fromEntries(fields.map(field => [field, [{ id: sourceId, kind: "bula", scope: "global",
    title: "Bula sintética — variante compatível, não toda a classe", strength: "forte", evidenceStatus: "SIM_BULA",
    fieldKeys: [field], metadata: { coverage_ids: ["class-" + field] } }]]));
  record.protocol_item_snapshot.planningKind = "aplicacao_esquema_definido";
  record.protocol_item_snapshot.planningEvidence = { planningScope: "class_scheme", itemVersion: 2, executionProductPolicy: "required_at_execution",
    sourceRefsByField: refs, operationalWindowRule: { anchor: "manual_context" }, boosterRule: { recurrenceRule: { kind: "primovaccination_dose_1" } } };
  await seedAgenda(record);
  await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-version-1", {
    source_refs_by_field: refs, operational_window_rule: { anchor: "manual_context" },
    booster_rule: { recurrenceRule: { kind: "primovaccination_dose_1" } },
    snapshot_template: { metadata: { planning_scope: "class_scheme" }, executionProductPolicy: "required_at_execution",
      sourcePolicy: { operational_window: "compatible_product_required_at_execution" } },
  });
  await db.catalog_sanitario_produtos_v2.update("product-1", { metadata: { registration_current_validity: "verified" } });
  const template = await db.catalog_sanitario_fontes_tecnicas_v2.get("withdrawal-source");
  await db.catalog_sanitario_fontes_tecnicas_v2.put({ ...template!, id: sourceId });
  await db.catalog_sanitario_fonte_cobertura_campos_v2.bulkPut(fields.map(field => ({ id: "class-" + field,
    source_id: sourceId, field_key: field, coverage_status: "covers", notes: null, created_at: now, updated_at: now, deleted_at: null })));
  await db.catalog_sanitario_produto_fontes_v2.bulkPut(fields.map(field => ({ product_id: "product-1", source_id: sourceId, field_key: field, created_at: now })));
  await db.catalog_sanitario_produto_dose_rules_v2.put({ id: "class-dose", product_id: "product-1", species_code: "bovino", aptitude: "all",
    route: "subcutanea", dose_quantity: 2, dose_unit: "ml", dose_basis: "animal", min_weight_kg: null, max_weight_kg: null,
    limitations: [], status_curatorial: "ativo", created_at: now, updated_at: now, deleted_at: null });
  await db.catalog_sanitario_produto_especie_autorizacao_v2.put({ id: "class-species", product_id: "product-1", species_code: "bovino", aptitude: "all",
    authorization_status: "SIM_BULA", sexo: null, idade_min_dias: null, idade_max_dias: null, lactacao_permitida: null, gestacao_permitida: null,
    requires_mv_responsavel: false, limitations: [], metadata: {}, created_at: now, updated_at: now, deleted_at: null });
}

describe("executeSanitaryAgendaV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearScope();
  });

  afterEach(clearScope);

  it("R04B registra produto escolhido na execução, prova o esquema e mantém carência desconhecida e replay único", async () => {
    await seedClassSchemeAgenda();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
baseInput]);
  });

  it("R04B bloqueia aplicação incompatível, mas registra fato explícito com alerta sem certificar esquema", async () => {
    await seedClassSchemeAgenda();
    await db.catalog_sanitario_produto_fontes_v2.delete(["product-1", "class-source", "operational_window"]);

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("R04B revalida fonte do esquema na transação, sem fato parcial", async () => {
    await seedClassSchemeAgenda();
    const originalTransaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation((async (...args: Parameters<typeof db.transaction>) => {
      spy.mockRestore();
      await db.catalog_sanitario_fontes_tecnicas_v2.update("class-source", { deleted_at: "2026-07-02" });
      return originalTransaction(...args);
    }) as typeof db.transaction);

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("R04B exige vigência comercial comprovada na aplicação prospectiva, preservando fato auditável", async () => {
    await seedClassSchemeAgenda();
    await db.catalog_sanitario_produtos_v2.update("product-1", { metadata: {} });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("R04B não aceita trocar janela/fontes congeladas mantendo apenas ID e versão", async () => {
    await seedClassSchemeAgenda();
    const current = (await db.ops_sanitario_agenda_v2.get("agenda-1"))!;
    const evidence = current.protocol_item_snapshot.planningEvidence as Record<string, unknown>;
    evidence.operationalWindowRule = { anchor: "another_scheme" };
    await db.ops_sanitario_agenda_v2.put(current);

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  afterEach(() => {
    if (typeof localStorage !== "undefined") {
      setSanitarioV2PushEnabled(false, "local");
    }
    vi.unstubAllEnvs();
  });

  it("executa agenda futura criando evento, detalhe e marcando a agenda como executada", async () => {
    await seedAgenda();


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("rejeita nova execução quando o protocolo vigente está em draft", async () => {
    await seedAgenda();
    await db.catalog_sanitario_protocolos_v2.put({
      id: "protocol-1", family_code: "raiva_herbivoros", name: "Raiva",
      scope: "global", fazenda_id: null, species_scope: ["bovino"],
      jurisdiction_scope: {}, legal_status: "condicional", version: 1,
      status: "draft", approval_status: "draft", source_refs_snapshot: [],
      metadata: {}, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null,
    });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it.each([
    ["retired", { status: "retired" }],
    ["rejected", { approval_status: "rejected" }],
    ["blocked", { legal_status: "bloqueado" }],
    ["deleted", { deleted_at: "2026-07-01" }],
    ["other farm", { scope: "fazenda", fazenda_id: "farm-2" }],
  ])("rejeita protocolo %s sem criar fato ou fila", async (_label, changes) => {
    await seedAgenda();
    await db.catalog_sanitario_protocolos_v2.update("protocol-1", changes);

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it.each(["draft", "retired"])("rejeita versão física do item %s", async (status) => {
    await seedAgenda();
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-version-1", { status });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("falha fechado sem catálogo e não usa o snapshot planejado como autorização", async () => {
    await seedAgenda();
    await db.catalog_sanitario_protocolos_v2.clear();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it.each([null, "SC"])("bloqueia B19 sem contexto ou em UF excluída: %s", async (uf) => {
    await seedAgenda();
    await seedWithdrawalContext();
    await db.catalog_sanitario_protocolos_v2.update("protocol-1", {
      family_code: "brucelose_b19", metadata: { requires_uf_context: true, excluded_ufs: ["SC"] },
    });
    await db.state_fazenda_sanidade_config.update("farm-1", { uf });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("preserva replay factual após aposentadoria do protocolo", async () => {
    await seedAgenda();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
baseInput]);
  });

  it("não retorna vínculo de execução de uma agenda de outra fazenda", async () => {
    await seedAgenda(agenda({ fazenda_id: "farm-2", execution_evento_id: "foreign-event" }));

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it.each(["precisa_validar", "bloqueado", "arquivado"])("aprovar protocolo não aprova produto %s", async (status_curatorial) => {
    await seedAgenda();
    await db.catalog_sanitario_produtos_v2.update("product-1", { status_curatorial: status_curatorial as "precisa_validar" | "bloqueado" | "arquivado" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("não confunde productId informado com produto real aprovado", async () => {
    await seedAgenda();
    await db.catalog_sanitario_produtos_v2.clear();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("snapshot de agenda não pode dispensar produto exigido pela versão canônica", async () => {
    await seedAgenda();
    await db.ops_sanitario_agenda_v2.update("agenda-1", { metadata: { itemKey: "item-1", productRequirementKind: "none" } });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, product: undefined, application: undefined }]);
  });

  it.each(["missing", "different"])("rejeita vínculo de produto específico %s no snapshot", async (binding) => {
    await seedAgenda(agenda({
      produto_classe: null,
      produto_veterinario_id: binding === "different" ? "product-1" : null,
      metadata: { itemKey: "item-1", productRequirementKind: "specific_product" },
      protocol_item_snapshot: { itemKey: "item-1", productRequirementKind: "specific_product" },
    }));
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-version-1", {
      product_id: binding === "different" ? "product-2" : "product-1",
    });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it.each(["missing", "different"])("rejeita vínculo de grupo %s no snapshot", async (binding) => {
    await seedAgenda(agenda({
      produto_classe: null,
      metadata: { itemKey: "item-1", productRequirementKind: "product_class_group", ...(binding === "different" ? { productClassGroupId: "group-1" } : {}) },
      protocol_item_snapshot: { itemKey: "item-1", productRequirementKind: "product_class_group" },
    }));
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-version-1", {
      product_class_group_id: "group-2",
    });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("permite vínculo específico coerente com o catálogo atual aprovado", async () => {
    await seedAgenda(agenda({
      produto_classe: null, produto_veterinario_id: "product-1",
      metadata: { itemKey: "item-1", productRequirementKind: "specific_product" },
      protocol_item_snapshot: { itemKey: "item-1", productRequirementKind: "specific_product" },
    }));
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-version-1", { product_id: "product-1" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it.each(["draft", "retired"])("registra fato realizado com protocolo %s sem conceder autorização", async (status) => {
    await seedAgenda();
    await db.catalog_sanitario_protocolos_v2.update("protocol-1", { status, approval_status: "draft" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" },
{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it.each(["precisa_validar", "bloqueado", "arquivado"])("preserva produto aplicado com curadoria %s sem inventar carência", async (status_curatorial) => {
    await seedAgenda();
    await db.catalog_sanitario_produtos_v2.update("product-1", { status_curatorial: status_curatorial as "precisa_validar" | "bloqueado" | "arquivado" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("registro factual mantém UF excluída como alerta, sem apagar aplicação realizada", async () => {
    await seedAgenda();
    await db.catalog_sanitario_protocolos_v2.update("protocol-1", { metadata: { requires_uf_context: true, excluded_ufs: ["SC"] } });
    await db.state_fazenda_sanidade_config.update("farm-1", { uf: "SC" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("item somente alerta não pode ser convertido em vacinação pela conclusão de agenda", async () => {
    await seedAgenda();
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("item-version-1", { action_type: "alerta", item_status: "somente_alerta" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("registro factual não dispensa isolamento por fazenda", async () => {
    await seedAgenda();
    await db.catalog_sanitario_protocolos_v2.update("protocol-1", { scope: "fazenda", fazenda_id: "farm-2" });

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("registro factual rejeita data futura e falta de confirmação", async () => {
    await seedAgenda();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact", executedAt: "2099-01-01" },
{ ...baseInput, registrationMode: "executed_fact", confirmation: { userConfirmedExecution: false } as never }]);
  });

  it("revalida autorização na transação se o catálogo mudar durante o preflight", async () => {
    await seedAgenda();
    const originalTransaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation((async (...args: Parameters<typeof db.transaction>) => {
      spy.mockRestore();
      await db.catalog_sanitario_protocolos_v2.update("protocol-1", { status: "retired" });
      return originalTransaction(...args);
    }) as typeof db.transaction);

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("audita a curadoria relida na transação do registro factual", async () => {
    await seedAgenda();
    const originalTransaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation((async (...args: Parameters<typeof db.transaction>) => {
      spy.mockRestore();
      await db.catalog_sanitario_protocolos_v2.update("protocol-1", { status: "retired" });
      await db.catalog_sanitario_produtos_v2.update("product-1", { status_curatorial: "precisa_validar" });
      return originalTransaction(...args);
    }) as typeof db.transaction);

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("preserva somente-alerta do snapshot quando o item não está em cache", async () => {
    await seedAgenda(agenda({
      acao_sanitaria: "alerta",
      protocol_item_snapshot: { itemKey: "item-1", actionType: "alerta", productRequirementKind: "product_class" },
    }));
    await db.catalog_sanitario_protocolo_itens_versions_v2.clear();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" }]);
  });

  it("retorna o único fato persistido ao concluir a mesma agenda concorrentemente", async () => {
    await seedAgenda();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{ ...baseInput, registrationMode: "executed_fact" },
{ ...baseInput, registrationMode: "executed_fact", clientOpId: "exec-concurrent" }]);
  });

  it("persiste o snapshot técnico do produto executado na mesma execução factual", async () => {
    await seedAgenda();
    await db.state_animais.put({
      id: "animal-1",
      fazenda_id: "farm-1",
      identificacao: "A-1",
      nome: null,
      sexo: "F",
      status: "ativo",
      lote_id: "lot-1",
      data_nascimento: null,
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
      client_id: "client-1",
      client_op_id: "animal-op-1",
      client_tx_id: null,
      client_recorded_at: "2026-01-01T00:00:00.000Z",
      server_received_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    } satisfies Animal);
    await db.catalog_sanitario_produtos_v2.put({
      id: "product-1",
      nome_comercial: "Vacina Raiva",
      fabricante: "Lab",
      registro_orgao: "MAPA",
      registro_numero: "123",
      classe: "vacina_raiva",
      principio_ativo: "antigeno",
      tipo_produto: "imunobiologico",
      apresentacao: "frasco",
      status_curatorial: "ativo",
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      deleted_at: null,
    });
    await db.catalog_sanitario_fontes_tecnicas_v2.put({
      id: "source-1",
      kind: "bula",
      scope: "global",
      fazenda_id: null,
      title: "Bula",
      issuer: "Lab",
      version: "v1",
      published_at: null,
      accessed_at: null,
      url: null,
      jurisdiction_country: "BR",
      jurisdiction_uf: null,
      jurisdiction_zone: null,
      strength: "forte",
      evidence_status: "SIM_BULA",
      limitations: [],
      metadata: {},
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    await db.catalog_sanitario_fonte_cobertura_campos_v2.bulkPut(["dose", "route"].map((fieldKey) => ({
      id: `coverage-${fieldKey}`,
      source_id: "source-1",
      field_key: fieldKey,
      coverage_status: "covers" as const,
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    })));
    await db.catalog_sanitario_produto_fontes_v2.bulkPut(["dose", "route"].map((fieldKey) => ({
      product_id: "product-1",
      source_id: "source-1",
      field_key: fieldKey,
      created_at: "2026-01-01T00:00:00.000Z",
    })));
    await db.catalog_sanitario_produto_dose_rules_v2.put({
      id: "dose-rule-1",
      product_id: "product-1",
      species_code: "bovino",
      aptitude: "all",
      route: "subcutanea",
      dose_quantity: 2,
      dose_unit: "ml",
      dose_basis: "animal",
      min_weight_kg: null,
      max_weight_kg: null,
      limitations: [],
      status_curatorial: "ativo",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("não usa agenda futura como histórico antes da execução e passa a expor o evento factual depois", async () => {
    await seedAgenda();

    expect(
      buildSanitaryExecutedHistoryV2({
        events: await db.event_eventos.toArray(),
        sanitaryDetails: await db.event_eventos_sanitario.toArray(),
        catalog,
        fazendaId: "farm-1",
      }),
    ).toEqual([]);


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput]);
  });

  it("rejeita agenda cancelada e exige confirmação, data, produto, dose e via quando aplicável", async () => {
    await seedAgenda(agenda({ status: "cancelada" }));


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
{ ...baseInput, confirmation: { userConfirmedExecution: false as true } },
{ ...baseInput, executedAt: "" },
{ ...baseInput, product: undefined },
{ ...baseInput, application: { dose: null, doseUnit: "ml", route: "subcutanea" } },
{ ...baseInput, application: { dose: 1, doseUnit: "ml", route: "" } }]);
  });

  it("é idempotente por clientOpId e também retorna o evento existente quando a agenda já foi executada", async () => {
    await seedAgenda();


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
baseInput,
{ ...baseInput, clientOpId: "exec-op-2" }]);
  });

  it("não calcula carência ativa por ProductClassGroup sem produto estruturado", async () => {
    await seedAgenda(
      agenda({
        produto_classe: null,
        metadata: {
          productRequirementKind: "product_class_group",
          productClassGroupId: "group-1",
          productClassGroupName: "Antiparasitários",
          target: { scope: "lote", id: "lot-1" },
          targetAnimalIds: ["animal-1"],
          itemKey: "item-1",
        },
        protocol_item_snapshot: {
          itemKey: "item-1",
          logicalItemKey: "item-1",
          productRequirementKind: "product_class_group",
          productClassGroupId: "group-1",
        },
      }),
    );

    const product = await db.catalog_sanitario_produtos_v2.get("product-1");
    await db.catalog_sanitario_produtos_v2.put({
      ...product!, id: "product-antiparasitario-1", nome_comercial: "Vermífugo cadastrado",
      classe: "antiparasitario", metadata: {},
    });


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{
        ...baseInput,
        product: {
          productId: "product-antiparasitario-1",
          productName: "Vermífugo cadastrado",
        },
      }]);
  });

  it("cria carência ativa somente com regra explícita por produto executado", async () => {
    await seedAgenda();
    await seedWithdrawalContext();
    await db.catalog_sanitario_produto_carencia_rules_v2.put(withdrawalRule());


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
baseInput]);
  });

  it.each([true, false])("P38 sintético na execução: leite zero exige vínculo da regra (%s)", async linked => {
    await seedAgenda();
    await seedWithdrawalContext();
    await db.state_fazenda_sanidade_config.update("farm-1", { aptidao: "leite" });
    await db.catalog_sanitario_produto_carencia_rules_v2.put(withdrawalRule({
      aptitude: "leite", applicability: "zero", meat_days: null, milk_days: 0,
    }));
    if (!linked) await db.catalog_sanitario_produto_carencia_fontes_v2.clear();

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([baseInput,
baseInput]);
  });

  it("baixa estoque somente após evento e não deixa falha de estoque marcar agenda como executada", async () => {
    await seedAgenda();
    await db.state_insumo_lotes.put(inventoryLot());

    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.state_insumo_lotes.get("stock-lot-1")).toMatchObject({
      saldo_atual_base: 100,
    });


    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{
        ...baseInput,
        product: {
          ...baseInput.product,
          inventoryLotId: "stock-lot-1",
          quantityConsumed: 2,
          unit: "ml",
        },
        confirmation: {
          userConfirmedExecution: true,
          userConfirmedStockMovement: true,
        },
      },
{
        ...baseInput,
        product: {
          ...baseInput.product,
          inventoryLotId: "stock-lot-1",
          quantityConsumed: 2,
          unit: "ml",
        },
        confirmation: {
          userConfirmedExecution: true,
          userConfirmedStockMovement: true,
        },
      },
{
          ...baseInput,
          product: {
            ...baseInput.product,
            inventoryLotId: "missing-lot",
            quantityConsumed: 2,
            unit: "ml",
          },
          confirmation: {
            userConfirmedExecution: true,
            userConfirmedStockMovement: true,
          },
        },
{
          ...baseInput,
          product: {
            ...baseInput.product,
            inventoryLotId: "stock-lot-1",
            quantityConsumed: 2,
          },
          confirmation: {
            userConfirmedExecution: true,
            userConfirmedStockMovement: true,
          },
        }]);
  });

  it.each([undefined, "executed_fact"] as const)("persiste execução, movimento e fila sanitária de forma atômica: %s", async (registrationMode) => {
    // Offline queue fixture: use the supported local backend, without enabling remote rollout.
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    const ids = {
      farm: "10000000-0000-4000-8000-000000000001",
      agenda: "20000000-0000-4000-8000-000000000001",
      animal: "30000000-0000-4000-8000-000000000001",
      protocol: "40000000-0000-4000-8000-000000000001",
      item: "50000000-0000-4000-8000-000000000001",
      lot: "60000000-0000-4000-8000-000000000001",
      supply: "70000000-0000-4000-8000-000000000001",
      operation: "80000000-0000-4000-8000-000000000001",
    };
    vi.stubGlobal(
      "localStorage",
      (() => {
        const values = new Map<string, string>();
        return {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
        };
      })(),
    );
    setSanitarioV2PushEnabled(true, "local");
    await db.sync_sanitario_v2_cutovers.put({
      key: `${ids.farm}:2`,
      fazenda_id: ids.farm,
      contract_version: 2,
      status: "APPLIED",
      prepared_at: "2026-07-01T00:00:00.000Z",
      applying_at: "2026-07-01T00:00:00.000Z",
      applied_at: "2026-07-01T00:00:00.000Z",
      failed_at: null,
      last_error: null,
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    await seedAgenda(
      agenda({
        id: ids.agenda,
        fazenda_id: ids.farm,
        protocolo_id: ids.protocol,
        protocol_item_version_id: ids.item,
        revision: 0,
        lote_id: null,
        metadata: {
          itemKey: "item-1",
          target: { scope: "animal", id: ids.animal },
          targetAnimalIds: [ids.animal],
        },
      }),
    );
    await db.ops_sanitario_agenda_animais_v2.clear();
    await db.ops_sanitario_agenda_animais_v2.put(
      agendaAnimal({
        agenda_id: ids.agenda,
        fazenda_id: ids.farm,
        animal_id: ids.animal,
      }),
    );
    await db.state_insumo_lotes.put(
      inventoryLot({
        id: ids.lot,
        fazenda_id: ids.farm,
        insumo_id: ids.supply,
      }),
    );

    if (registrationMode === "executed_fact") {
      const originalTransaction = db.transaction.bind(db);
      const spy = vi.spyOn(db, "transaction").mockImplementation((async (...args: Parameters<typeof db.transaction>) => {
        spy.mockRestore();
        await db.catalog_sanitario_protocolos_v2.update(ids.protocol, { status: "draft", approval_status: "draft" });
        await db.catalog_sanitario_produtos_v2.update("product-1", { status_curatorial: "precisa_validar" });
        return originalTransaction(...args);
      }) as typeof db.transaction);
    }

    // V3.1 deliberately blocks every previous execution variant before effects.
    await assertV31Blocked([{
      ...baseInput,
      registrationMode,
      fazendaId: ids.farm,
      agendaId: ids.agenda,
      clientOpId: ids.operation,
      product: {
        ...baseInput.product,
        inventoryLotId: ids.lot,
        quantityConsumed: 2,
        unit: "ml",
      },
      confirmation: {
        userConfirmedExecution: true,
        userConfirmedStockMovement: true,
      },
      sync: {
        clientId: "staging-client",
        projectRef: "local",
      },
    }]);
  });
});


async function assertV31Blocked(inputs: ExecuteSanitaryAgendaInputV2[]) {
  const stores = [db.event_eventos,db.event_eventos_sanitario,db.event_eventos_animais,db.state_insumo_movimentacoes,db.queue_ops,db.ops_sanitario_agenda_v2,db.ops_sanitario_agenda_animais_v2];
  const before = await Promise.all(stores.map(store=>store.toArray()));
  for (const input of inputs) await expect(executeSanitaryAgendaV2(input,db)).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");
  expect(await Promise.all(stores.map(store=>store.toArray()))).toEqual(before);
}
