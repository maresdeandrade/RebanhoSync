/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  applySanitarioV2Cutover,
  buildApplyFactualCoreOperation,
  buildCloseAgendaOperation,
  buildCreateAgendaOperation,
  buildReplaceAgendaAnimalsOperation,
  createSanitarioV2Identity,
  enqueueSanitarioV2Operations,
  isSanitarioV2PushEnabled,
  prepareSanitarioV2Cutover,
  SANITARIO_V2_STAGING_PROJECT_REF,
  setSanitarioV2PushEnabled,
} from "../sanitarioV2Cutover";
import type {
  Evento,
  EventoAnimalLocalV2,
  EventoSanitario,
  SanitarioAgendaClosureLocalV2,
  SanitarioAgendaLocalV2,
} from "../types";

const FARM_ID = "10000000-0000-4000-8000-000000000001";
const AGENDA_ID = "20000000-0000-4000-8000-000000000001";
const EVENT_ID = "30000000-0000-4000-8000-000000000001";
const ANIMAL_ID = "40000000-0000-4000-8000-000000000001";
const RELATION_ID = "50000000-0000-4000-8000-000000000001";
const CLOSURE_ID = "60000000-0000-4000-8000-000000000001";
const NOW = "2026-07-30T12:00:00.000Z";

function agenda(): SanitarioAgendaLocalV2 {
  return {
    id: AGENDA_ID,
    fazenda_id: FARM_ID,
    status: "programada",
    dedup_key: "cutover:agenda:1",
    client_id: "staging-client",
    client_op_id: crypto.randomUUID(),
    client_tx_id: crypto.randomUUID(),
    client_recorded_at: NOW,
    server_received_at: NOW,
    source_demand_key: null,
    preview_group_id: null,
    protocolo_id: null,
    protocol_item_version_id: null,
    protocol_item_snapshot: {},
    janela_inicio: "2026-07-30",
    janela_fim: null,
    data_programada: "2026-07-30",
    lote_id: null,
    produto_veterinario_id: null,
    produto_snapshot: {},
    produto_classe: "vacina",
    acao_sanitaria: "vacinacao",
    execution_evento_id: null,
    metadata: { source: "cutover-test" },
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    revision: 0,
    contract_version: 2,
  };
}
function event(): Evento {
  return {
    id: EVENT_ID,
    fazenda_id: FARM_ID,
    dominio: "sanitario",
    occurred_at: NOW,
    animal_id: null,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    source_sanitario_agenda_v2_id: AGENDA_ID,
    sanitario_sync_v2_nature: "primary_execution",
    client_id: "staging-client",
    client_op_id: crypto.randomUUID(),
    client_tx_id: crypto.randomUUID(),
    client_recorded_at: NOW,
    server_received_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  };
}
function detail(): EventoSanitario {
  return {
    evento_id: EVENT_ID,
    fazenda_id: FARM_ID,
    tipo: "vacinacao",
    produto: "Produto de teste",
    produto_veterinario_id: null,
    insumo_id: null,
    produto_snapshot: {},
    payload: {},
    client_id: "staging-client",
    client_op_id: crypto.randomUUID(),
    client_tx_id: crypto.randomUUID(),
    client_recorded_at: NOW,
    server_received_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  };
}
function relation(): EventoAnimalLocalV2 {
  return {
    id: RELATION_ID,
    fazenda_id: FARM_ID,
    evento_id: EVENT_ID,
    animal_id: ANIMAL_ID,
    created_at: NOW,
  };
}
function closure(): SanitarioAgendaClosureLocalV2 {
  return {
    id: CLOSURE_ID,
    fazenda_id: FARM_ID,
    agenda_id: AGENDA_ID,
    closure_type: "cancelled",
    dedup_key: "cutover:closure:1",
    client_id: "staging-client",
    client_op_id: crypto.randomUUID(),
    client_tx_id: crypto.randomUUID(),
    client_recorded_at: NOW,
    server_received_at: NOW,
    closed_at: NOW,
    closed_by: null,
    execution_evento_id: null,
    reason: "teste",
    partial_payload: {},
    metadata: {},
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  };
}

describe("sanitario v2 local cutover", () => {
  beforeEach(async () => {
    await Promise.all([
      db.sync_sanitario_v2_cutovers.clear(),
      db.event_eventos_animais.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
    ]);
    setSanitarioV2PushEnabled(false, SANITARIO_V2_STAGING_PROJECT_REF);
  });
  afterEach(async () => {
    setSanitarioV2PushEnabled(false, SANITARIO_V2_STAGING_PROJECT_REF);
    await Promise.all([
      db.sync_sanitario_v2_cutovers.clear(),
      db.event_eventos_animais.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
    ]);
  });

  it("registra os stores locais do cutover", () => {
    expect(db.verno).toBeGreaterThanOrEqual(28);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "event_eventos_animais",
        "sync_sanitario_v2_cutovers",
      ]),
    );
  });

  it("mantem a flag false e restringe ativacao ao staging", () => {
    expect(isSanitarioV2PushEnabled(SANITARIO_V2_STAGING_PROJECT_REF)).toBe(
      false,
    );
    expect(() => setSanitarioV2PushEnabled(true, "production-ref")).toThrow(
      "SANITARIO_V2_STAGING_ONLY",
    );
    setSanitarioV2PushEnabled(true, SANITARIO_V2_STAGING_PROJECT_REF);
    expect(isSanitarioV2PushEnabled(SANITARIO_V2_STAGING_PROJECT_REF)).toBe(
      true,
    );
    expect(isSanitarioV2PushEnabled("production-ref")).toBe(false);
  });

  it("persiste falha e retoma o manifesto ate APPLIED", async () => {
    const prepared = await prepareSanitarioV2Cutover(FARM_ID);
    expect(prepared.status).toBe("PREPARED");
    await expect(
      applySanitarioV2Cutover(FARM_ID, async () => {
        throw new Error("pull unavailable");
      }),
    ).rejects.toThrow("pull unavailable");
    expect(await db.sync_sanitario_v2_cutovers.get(prepared.key)).toMatchObject(
      {
        status: "FAILED",
        last_error: "pull unavailable",
      },
    );
    const applied = await applySanitarioV2Cutover(
      FARM_ID,
      async () => undefined,
    );
    expect(applied).toMatchObject({ status: "APPLIED", failed_at: null });
  });

  it("serializa os quatro comandos, revisoes e relacao evento-animal", () => {
    const tx = crypto.randomUUID();
    const create = buildCreateAgendaOperation(
      createSanitarioV2Identity(tx),
      agenda(),
      [ANIMAL_ID],
    );
    const replace = buildReplaceAgendaAnimalsOperation(
      createSanitarioV2Identity(tx),
      AGENDA_ID,
      0,
      [ANIMAL_ID],
    );
    const factual = buildApplyFactualCoreOperation(
      createSanitarioV2Identity(tx),
      event(),
      detail(),
      [relation()],
      1,
    );
    const close = buildCloseAgendaOperation(
      createSanitarioV2Identity(tx),
      closure(),
      2,
    );
    expect([create.command, replace.command, factual.command, close.command])
      .toEqual([
        "create_agenda",
        "replace_agenda_animals",
        "apply_factual_core",
        "close_agenda",
      ]);
    expect([
      replace.expected_revision,
      factual.expected_revision,
      close.expected_revision,
    ])
      .toEqual([0, 1, 2]);
    expect(factual.payload).toMatchObject({
      event: { id: EVENT_ID, source_sanitario_agenda_v2_id: AGENDA_ID },
      event_animals: [{ id: RELATION_ID, animal_id: ANIMAL_ID }],
    });
    expect(factual.payload).not.toHaveProperty("stock_movements");
    expect(factual.payload).not.toHaveProperty("withdrawals");
    expect(() =>
      buildReplaceAgendaAnimalsOperation(
        createSanitarioV2Identity(tx),
        AGENDA_ID,
        undefined,
        [ANIMAL_ID],
      )
    ).toThrow("SANITARIO_V2_EXPECTED_REVISION_REQUIRED");
  });

  it("enfileira apos APPLIED + flag e deduplica replay local", async () => {
    const operation = buildCreateAgendaOperation(
      createSanitarioV2Identity(),
      agenda(),
      [ANIMAL_ID],
    );
    const input = {
      fazendaId: FARM_ID,
      clientId: "staging-client",
      projectRef: SANITARIO_V2_STAGING_PROJECT_REF,
      operations: [operation],
    };
    await expect(enqueueSanitarioV2Operations(input)).rejects.toThrow(
      "SANITARIO_V2_PUSH_DISABLED",
    );
    await applySanitarioV2Cutover(FARM_ID, async () => undefined);
    setSanitarioV2PushEnabled(true, SANITARIO_V2_STAGING_PROJECT_REF);
    await enqueueSanitarioV2Operations(input);
    await enqueueSanitarioV2Operations(input);
    expect(await db.queue_gestures.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(1);
    await expect(
      enqueueSanitarioV2Operations({
        ...input,
        operations: [{
          ...operation,
          payload: { ...operation.payload, animal_ids: [] },
        }],
      }),
    ).rejects.toThrow("SANITARIO_V2_IDENTITY_REUSE_DIVERGENT_PAYLOAD");
  });
});
