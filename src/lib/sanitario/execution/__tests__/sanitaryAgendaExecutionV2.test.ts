import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import type {
  InsumoLote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SanitarioProdutoCarenciaRuleLocalV2,
} from "@/lib/offline/types";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { executeSanitaryAgendaV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import { buildSanitaryExecutedHistoryV2 } from "@/lib/sanitario/history/sanitaryExecutedHistoryV2";

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
    db.state_insumo_lotes.clear(),
    db.state_insumo_movimentacoes.clear(),
    db.catalog_sanitario_produto_carencia_rules_v2.clear(),
    db.queue_ops.clear(),
  ]);
}

async function seedAgenda(record = agenda()) {
  await db.ops_sanitario_agenda_v2.put(record);
  await db.ops_sanitario_agenda_animais_v2.put(agendaAnimal({ agenda_id: record.id }));
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

describe("executeSanitaryAgendaV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearScope();
  });

  afterEach(clearScope);

  it("executa agenda futura criando evento, detalhe e marcando a agenda como executada", async () => {
    await seedAgenda();

    const result = await executeSanitaryAgendaV2(baseInput, db);

    expect(result).toMatchObject({
      agendaId: "agenda-1",
      clientOpId: "exec-op-1",
      agendaStatus: "executed",
      createsEvent: true,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    });
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_sanitario.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.get("agenda-1")).toMatchObject({
      status: "executada",
      execution_evento_id: result.eventId,
    });
    expect(await db.ops_sanitario_agenda_animais_v2.get(["agenda-1", "animal-1"])).toMatchObject({
      planned_status: "executado",
      execution_evento_id: result.eventId,
    });
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

    const result = await executeSanitaryAgendaV2(baseInput, db);

    expect(
      buildSanitaryExecutedHistoryV2({
        events: await db.event_eventos.toArray(),
        sanitaryDetails: await db.event_eventos_sanitario.toArray(),
        catalog,
        fazendaId: "farm-1",
      }),
    ).toEqual([
      {
        animalId: "animal-1",
        events: [
          expect.objectContaining({
            eventId: result.eventId,
            protocolId: "protocol-1",
            itemKey: "item-1",
            source: "event",
          }),
        ],
      },
    ]);
  });

  it("rejeita agenda cancelada e exige confirmação, data, produto, dose e via quando aplicável", async () => {
    await seedAgenda(agenda({ status: "cancelada" }));

    await expect(executeSanitaryAgendaV2(baseInput, db)).rejects.toThrow("agenda_not_executable");

    await db.ops_sanitario_agenda_v2.put(agenda());
    await expect(
      executeSanitaryAgendaV2({ ...baseInput, confirmation: { userConfirmedExecution: false as true } }, db),
    ).rejects.toThrow("missing_confirmation");
    await expect(executeSanitaryAgendaV2({ ...baseInput, executedAt: "" }, db)).rejects.toThrow(
      "missing_executed_at",
    );
    await expect(executeSanitaryAgendaV2({ ...baseInput, product: undefined }, db)).rejects.toThrow(
      "missing_product",
    );
    await expect(
      executeSanitaryAgendaV2({ ...baseInput, application: { dose: null, doseUnit: "ml", route: "subcutanea" } }, db),
    ).rejects.toThrow("missing_dose");
    await expect(
      executeSanitaryAgendaV2({ ...baseInput, application: { dose: 1, doseUnit: "ml", route: "" } }, db),
    ).rejects.toThrow("missing_route");
  });

  it("é idempotente por clientOpId e também retorna o evento existente quando a agenda já foi executada", async () => {
    await seedAgenda();

    const first = await executeSanitaryAgendaV2(baseInput, db);
    const repeated = await executeSanitaryAgendaV2(baseInput, db);
    const alreadyExecuted = await executeSanitaryAgendaV2(
      { ...baseInput, clientOpId: "exec-op-2" },
      db,
    );

    expect(repeated.eventId).toBe(first.eventId);
    expect(alreadyExecuted.eventId).toBe(first.eventId);
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_sanitario.count()).toBe(1);
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

    const result = await executeSanitaryAgendaV2(
      {
        ...baseInput,
        product: { productName: "Vermífugo informado" },
      },
      db,
    );

    const detail = await db.event_eventos_sanitario.get(result.eventId);
    expect(result.createsActiveWithdrawal).toBe(false);
    expect(detail).toMatchObject({
      carencia_carne_dias: null,
      carencia_carne_ate: null,
      carencia_leite_dias: null,
      carencia_leite_ate: null,
    });
  });

  it("cria carência ativa somente com regra explícita por produto executado", async () => {
    await seedAgenda();
    await db.catalog_sanitario_produto_carencia_rules_v2.put(withdrawalRule());

    const result = await executeSanitaryAgendaV2(baseInput, db);

    const detail = await db.event_eventos_sanitario.get(result.eventId);
    expect(result.createsActiveWithdrawal).toBe(true);
    expect(detail).toMatchObject({
      produto_veterinario_id: "product-1",
      carencia_carne_dias: 30,
      carencia_carne_ate: "2026-08-01",
      carencia_leite_dias: null,
      carencia_leite_ate: null,
    });
  });

  it("baixa estoque somente após evento e não deixa falha de estoque marcar agenda como executada", async () => {
    await seedAgenda();
    await db.state_insumo_lotes.put(inventoryLot());

    const result = await executeSanitaryAgendaV2(
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
      db,
    );

    expect(result.createsStockMovement).toBe(true);
    expect(await db.state_insumo_movimentacoes.get(result.eventId)).toMatchObject({
      source_evento_id: result.eventId,
      source_evento_dominio: "sanitario",
      quantidade_base: 2,
      custo_total_snapshot: 10,
    });

    await clearScope();
    await seedAgenda();
    await expect(
      executeSanitaryAgendaV2(
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
        db,
      ),
    ).rejects.toThrow("inventory_lot_not_found");
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.get("agenda-1")).toMatchObject({
      status: "programada",
      execution_evento_id: null,
    });
  });
});
