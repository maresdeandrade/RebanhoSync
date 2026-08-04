/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/offline/db";
import {
  SANITARIO_V2_STAGING_PROJECT_REF,
  setSanitarioV2PushEnabled,
} from "@/lib/offline/sanitarioV2Cutover";
import type { Evento, EventoSanitario } from "@/lib/offline/types";
import {
  createSanitaryCorrectionV2,
  resolveSanitaryCorrectionChainV2,
} from "@/lib/sanitario/reconciliation/sanitaryCorrectionV2";

const FARM = "10000000-0000-4000-8000-000000000001";
const OTHER_FARM = "10000000-0000-4000-8000-000000000002";
const ORIGINAL = "20000000-0000-4000-8000-000000000001";
const ANIMAL = "30000000-0000-4000-8000-000000000001";
const CORRECTION_1 = "40000000-0000-4000-8000-000000000001";
const CORRECTION_2 = "40000000-0000-4000-8000-000000000002";
const NOW = "2026-08-01T12:00:00.000Z";

function event(overrides: Partial<Evento> = {}): Evento {
  return {
    id: ORIGINAL,
    fazenda_id: FARM,
    dominio: "sanitario",
    occurred_at: "2026-07-01T12:00:00.000Z",
    occurred_on: "2026-07-01",
    animal_id: ANIMAL,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: ORIGINAL,
    corrige_evento_id: null,
    observacoes: "Aplicação original",
    payload: { schema: "sanitary_agenda_execution_v2" },
    source_sanitario_agenda_v2_id: null,
    sanitario_sync_v2_nature: "primary_execution",
    sanitario_contract_version: 2,
    domain_op_id: null,
    client_id: "client-1",
    client_op_id: ORIGINAL,
    client_tx_id: null,
    client_recorded_at: "2026-07-01T12:00:00.000Z",
    server_received_at: "2026-07-01T12:00:00.000Z",
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function detail(overrides: Partial<EventoSanitario> = {}): EventoSanitario {
  return {
    evento_id: ORIGINAL,
    fazenda_id: FARM,
    tipo: "vacinacao",
    produto: "Vacina A",
    produto_veterinario_id: null,
    produto_sanitario_v2_id: "product-1",
    produto_nome_snapshot: "Vacina A",
    produto_snapshot: null,
    insumo_id: "supply-1",
    estoque_lote_id: "stock-1",
    estoque_lote_codigo_snapshot: "L1",
    dose_quantidade: 2,
    dose_unidade: "ml",
    via_aplicacao: "subcutanea",
    custo_unitario_snapshot: 5,
    custo_total_snapshot: 10,
    carencia_carne_dias: null,
    carencia_leite_dias: null,
    carencia_carne_ate: null,
    carencia_leite_ate: null,
    payload: { schema: "sanitary_agenda_execution_v2" },
    client_id: "client-1",
    client_op_id: ORIGINAL,
    client_tx_id: null,
    client_recorded_at: "2026-07-01T12:00:00.000Z",
    server_received_at: "2026-07-01T12:00:00.000Z",
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

async function clear() {
  await Promise.all([
    db.event_eventos.clear(),
    db.event_eventos_sanitario.clear(),
    db.event_eventos_animais.clear(),
    db.state_animais.clear(),
    db.state_insumo_movimentacoes.clear(),
    db.catalog_sanitario_produtos_v2.clear(),
    db.catalog_sanitario_fontes_tecnicas_v2.clear(),
    db.catalog_sanitario_fonte_cobertura_campos_v2.clear(),
    db.catalog_sanitario_produto_fontes_v2.clear(),
    db.catalog_sanitario_produto_dose_rules_v2.clear(),
    db.catalog_sanitario_produto_especie_autorizacao_v2.clear(),
    db.queue_gestures.clear(),
    db.queue_ops.clear(),
    db.sync_sanitario_v2_cutovers.clear(),
  ]);
}

async function seed(
  overrides: {
    event?: Partial<Evento>;
    detail?: Partial<EventoSanitario>;
  } = {},
) {
  await db.event_eventos.put(event(overrides.event));
  await db.event_eventos_sanitario.put(detail(overrides.detail));
  await db.event_eventos_animais.put({
    id: "50000000-0000-4000-8000-000000000001",
    fazenda_id: overrides.event?.fazenda_id ?? FARM,
    evento_id: ORIGINAL,
    animal_id: ANIMAL,
    created_at: "2026-07-01T12:00:00.000Z",
  });
}

function correction(overrides: Record<string, unknown> = {}) {
  return {
    fazendaId: FARM,
    correctedEventId: ORIGINAL,
    correctionEventId: CORRECTION_1,
    correctionType: "correcao_custo" as const,
    reason: "Nota fiscal conferida.",
    occurredAt: NOW,
    createdBy: "user-1",
    changes: { custo_unitario_snapshot: 6, custo_total_snapshot: 12 },
    ...overrides,
  };
}

async function seedTechnicalCatalog() {
  await db.state_animais.put({
    id: ANIMAL,
    fazenda_id: FARM,
    especie: "bovino",
    deleted_at: null,
  } as never);
  await db.catalog_sanitario_produtos_v2.put({
    id: "product-1",
    nome_comercial: "Vacina A",
    fabricante: "Lab",
    registro_orgao: "MAPA",
    registro_numero: "1",
    classe: "vacina",
    principio_ativo: "x",
    tipo_produto: "vacina",
    apresentacao: null,
    status_curatorial: "ativo",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
  } as never);
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
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  } as never);
  for (const field of ["dose", "route"]) {
    await db.catalog_sanitario_fonte_cobertura_campos_v2.put({
      id: `coverage-${field}`,
      source_id: "source-1",
      field_key: field,
      coverage_status: "covers",
      notes: null,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
    } as never);
    await db.catalog_sanitario_produto_fontes_v2.put({
      product_id: "product-1",
      source_id: "source-1",
      field_key: field,
      created_at: NOW,
    } as never);
  }
  await db.catalog_sanitario_produto_dose_rules_v2.put({
    id: "dose-rule-1",
    product_id: "product-1",
    species_code: "bovino",
    aptitude: "all",
    route: "intramuscular",
    dose_quantity: 3,
    dose_unit: "ml",
    dose_basis: "animal",
    min_weight_kg: null,
    max_weight_kg: null,
    limitations: [],
    status_curatorial: "ativo",
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  } as never);
}

describe("sanitary correction v2", () => {
  beforeEach(async () => {
    await db.open();
    await clear();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    setSanitarioV2PushEnabled(false, SANITARIO_V2_STAGING_PROJECT_REF);
    await clear();
  });

  it("cria novo Evento factual e preserva integralmente o original", async () => {
    await seed();
    const before = await db.event_eventos.get(ORIGINAL);
    const result = await createSanitaryCorrectionV2(correction(), db);
    expect(result).toMatchObject({
      eventId: CORRECTION_1,
      replayed: false,
      chainRootEventId: ORIGINAL,
    });
    expect(await db.event_eventos.get(ORIGINAL)).toEqual(before);
    expect(await db.event_eventos.get(CORRECTION_1)).toMatchObject({
      corrige_evento_id: ORIGINAL,
      sanitario_sync_v2_nature: "correction",
      observacoes: "Nota fiscal conferida.",
    });
    expect(await db.event_eventos_sanitario.get(CORRECTION_1)).toMatchObject({
      produto_sanitario_v2_id: "product-1",
      dose_quantidade: 2,
      custo_unitario_snapshot: 6,
      custo_total_snapshot: 12,
    });
  });

  it("rejeita motivo ausente, referência inexistente, tenant divergente e ciclo", async () => {
    await seed();
    await expect(
      createSanitaryCorrectionV2(correction({ reason: " " }), db),
    ).rejects.toThrow("REASON_REQUIRED");
    await expect(
      createSanitaryCorrectionV2(
        correction({ correctedEventId: CORRECTION_2 }),
        db,
      ),
    ).rejects.toThrow("SOURCE_NOT_FOUND");
    await expect(
      createSanitaryCorrectionV2(correction({ fazendaId: OTHER_FARM }), db),
    ).rejects.toThrow("TENANT_MISMATCH");
    await expect(
      createSanitaryCorrectionV2(
        correction({ correctionEventId: ORIGINAL }),
        db,
      ),
    ).rejects.toThrow("IDENTITY_CONFLICT");
    expect(await db.event_eventos.count()).toBe(1);
  });

  it("resolve correções sucessivas deterministicamente e preserva campos não corrigidos", async () => {
    await seed();
    await createSanitaryCorrectionV2(correction(), db);
    await createSanitaryCorrectionV2(
      correction({
        correctedEventId: CORRECTION_1,
        correctionEventId: CORRECTION_2,
        reason: "Complemento do responsável.",
        correctionType: "complemento_rastreabilidade",
        changes: {
          responsavel_nome: "MV Ana",
          responsavel_tipo: "veterinario",
        },
      }),
      db,
    );
    const projection = resolveSanitaryCorrectionChainV2({
      fazendaId: FARM,
      rootEventId: ORIGINAL,
      events: await db.event_eventos.toArray(),
      details: await db.event_eventos_sanitario.toArray(),
    });
    expect(projection).toMatchObject({
      status: "resolved",
      chainEventIds: [ORIGINAL, CORRECTION_1, CORRECTION_2],
      currentDetail: {
        custo_total_snapshot: 12,
        dose_quantidade: 2,
        responsavel_nome: "MV Ana",
      },
    });
  });

  it("expõe conflito em cadeia ramificada sem aplicar última escrita vence", () => {
    const first = event({
      id: CORRECTION_1,
      corrige_evento_id: ORIGINAL,
      sanitario_sync_v2_nature: "correction",
      payload: { sanitary_correction: { evento_origem_id: ORIGINAL } },
    });
    const second = event({
      id: CORRECTION_2,
      corrige_evento_id: ORIGINAL,
      sanitario_sync_v2_nature: "correction",
      payload: { sanitary_correction: { evento_origem_id: ORIGINAL } },
    });
    expect(
      resolveSanitaryCorrectionChainV2({
        fazendaId: FARM,
        rootEventId: ORIGINAL,
        events: [event(), first, second],
        details: [
          detail(),
          detail({ evento_id: CORRECTION_1 }),
          detail({ evento_id: CORRECTION_2 }),
        ],
      }),
    ).toMatchObject({
      status: "conflict",
      conflictingEventIds: [CORRECTION_1, CORRECTION_2],
    });
  });

  it("correção técnica congela snapshot próprio e atualização posterior do catálogo não o altera", async () => {
    await seed();
    await seedTechnicalCatalog();
    await createSanitaryCorrectionV2(
      correction({
        correctionType: "complemento_rastreabilidade",
        changes: {
          dose_quantidade: 3,
          dose_unidade: "ml",
          via_aplicacao: "intramuscular",
        },
      }),
      db,
    );
    const saved = await db.event_eventos_sanitario.get(CORRECTION_1);
    expect(saved?.produto_snapshot).toMatchObject({
      eventId: CORRECTION_1,
      executedDose: { quantity: 3, unit: "ml" },
      executedRoute: "intramuscular",
    });
    expect(saved?.produto_snapshot).not.toHaveProperty("withdrawalSnapshot");
    await db.catalog_sanitario_produtos_v2.update("product-1", {
      nome_comercial: "Vacina Renomeada",
    });
    expect(
      (await db.event_eventos_sanitario.get(CORRECTION_1))?.produto_snapshot,
    ).toEqual(saved?.produto_snapshot);
  });

  it("falha conservadoramente para correção técnica incompleta ou campo fora da taxonomia", async () => {
    await seed();
    await expect(
      createSanitaryCorrectionV2(
        correction({
          correctionType: "complemento_rastreabilidade",
          changes: { produto_sanitario_v2_id: null },
        }),
        db,
      ),
    ).rejects.toThrow("TECHNICAL_FACT_INCOMPLETE");
    await expect(
      createSanitaryCorrectionV2(
        correction({
          changes: { custo_total_snapshot: 12, via_aplicacao: "oral" },
        }),
        db,
      ),
    ).rejects.toThrow("FIELDS_UNSUPPORTED");
    expect(await db.event_eventos.count()).toBe(1);
  });

  it("replay idêntico é no-op e mesma identidade divergente gera conflito", async () => {
    await seed();
    await createSanitaryCorrectionV2(correction(), db);
    await expect(
      createSanitaryCorrectionV2(correction(), db),
    ).resolves.toMatchObject({ replayed: true });
    await expect(
      createSanitaryCorrectionV2(
        correction({ changes: { custo_total_snapshot: 99 } }),
        db,
      ),
    ).rejects.toThrow("IDENTITY_CONFLICT");
    expect(await db.event_eventos.count()).toBe(2);
  });

  it("rollback atômico não deixa Evento ou detalhe parcial", async () => {
    await seed();
    vi.spyOn(db.event_eventos_sanitario, "add").mockRejectedValueOnce(
      new Error("forced-detail-failure"),
    );
    await expect(createSanitaryCorrectionV2(correction(), db)).rejects.toThrow(
      "forced-detail-failure",
    );
    expect(await db.event_eventos.get(CORRECTION_1)).toBeUndefined();
    expect(await db.event_eventos_sanitario.get(CORRECTION_1)).toBeUndefined();
    expect(
      await db.event_eventos_animais
        .where("evento_id")
        .equals(CORRECTION_1)
        .count(),
    ).toBe(0);
  });

  it("não cria estoque, carência, agenda ou fila com gates desligados", async () => {
    await seed();
    await createSanitaryCorrectionV2(correction(), db);
    const correctedDetail = await db.event_eventos_sanitario.get(CORRECTION_1);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
    expect(correctedDetail).toMatchObject({
      carencia_carne_dias: null,
      carencia_leite_dias: null,
      carencia_carne_ate: null,
      carencia_leite_ate: null,
    });
  });

  it("encaminha estorno e resolução aos gestures especializados já ativos", async () => {
    await seed();
    for (const correctionType of [
      "estorno_baixa_estoque",
      "resolucao_ocorrencia_biosseguranca",
    ] as const) {
      await expect(
        createSanitaryCorrectionV2(
          correction({ correctionType, changes: {} }),
          db,
        ),
      ).rejects.toThrow("SPECIALIZED_GESTURE_REQUIRED");
    }
    expect(await db.event_eventos.count()).toBe(1);
  });

  it("enfileira o núcleo corretivo com identidades estáveis e retry não duplica", async () => {
    await seed();
    setSanitarioV2PushEnabled(true, SANITARIO_V2_STAGING_PROJECT_REF);
    await db.sync_sanitario_v2_cutovers.put({
      key: `${FARM}:2`,
      fazenda_id: FARM,
      contract_version: 2,
      status: "APPLIED",
      prepared_at: NOW,
      applying_at: NOW,
      applied_at: NOW,
      failed_at: null,
      last_error: null,
      updated_at: NOW,
    });
    const sync = {
      clientId: "correction-client",
      projectRef: SANITARIO_V2_STAGING_PROJECT_REF,
      clientTxId: "60000000-0000-4000-8000-000000000001",
      domainOpId: "70000000-0000-4000-8000-000000000001",
    };
    await createSanitaryCorrectionV2(correction({ sync }), db);
    await expect(
      createSanitaryCorrectionV2(correction({ sync }), db),
    ).resolves.toMatchObject({ replayed: true });
    expect(await db.queue_ops.count()).toBe(1);
    expect(await db.queue_ops.get(CORRECTION_1)).toMatchObject({
      client_tx_id: sync.clientTxId,
      domain_op_id: sync.domainOpId,
      record: {
        command: "apply_factual_core",
        payload: {
          event: {
            id: CORRECTION_1,
            corrige_evento_id: ORIGINAL,
            natureza: "correction",
          },
        },
      },
    });
  });
});
