/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "sanitario-worker-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "user-san-v2-worker" },
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: { session: null },
        error: new Error("refresh should not run"),
      })),
    },
  },
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { retryRejectedOperation } from "../ops";
import { upsertReconciliationObligations } from "../reconciliationObligations";
import { establishLocalOwnership } from "../ownership";
import { pullDataForFarm, pullSanitarioV2CutoverState } from "../pull";
import {
  mapOperationForSync,
  processGesture,
  recoverBlockedSanitarioV2Operations,
} from "../syncWorker";
import type {
  Gesture,
  Operation,
  SanitarioSyncV2Command,
  SyncOperationResult,
} from "../types";

const ownershipSession = (userId: string) =>
  ({ user: { id: userId } }) as Parameters<
    typeof establishLocalOwnership
  >[0];

const FAZENDA_ID = "farm-san-v2-worker";
const CLIENT_ID = "client-san-v2-worker";
const USER_ID = "user-san-v2-worker";

async function seedGesture(
  commands: SanitarioSyncV2Command[],
  suffix = "default",
) {
  const createdAt = "2026-07-30T12:00:00.000Z";
  const gesture: Gesture = {
    client_tx_id: `tx-san-v2-${suffix}`,
    fazenda_id: FAZENDA_ID,
    client_id: CLIENT_ID,
    status: "PENDING",
    created_at: createdAt,
  };
  const ops: Operation[] = commands.map((command, index) => ({
    client_op_id: `op-${suffix}-${index}`,
    client_tx_id: gesture.client_tx_id,
    op_order: index,
    table: "sanitario_v2_probe",
    action: "UPDATE",
    record: {
      domain: "sanitario_v2",
      command,
      client_op_id: `op-${suffix}-${index}`,
      client_tx_id: gesture.client_tx_id,
      domain_op_id: `domain-${suffix}-${index}`,
      contract_version: 2,
      payload: {},
    },
    domain_op_id: `domain-${suffix}-${index}`,
    created_at: createdAt,
  }));

  await db.queue_gestures.add(gesture);
  await db.queue_ops.bulkAdd(ops);
  return { gesture, ops };
}

function respondWith(results: SyncOperationResult[]) {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ results }), { status: 200 }),
  );
}

async function loadGesture(clientTxId: string) {
  const gesture = await db.queue_gestures.get(clientTxId);
  if (!gesture) throw new Error(`Gesture ${clientTxId} not found`);
  return gesture;
}

describe("sanitario_v2 canonical worker/reconcile", () => {
  it.each([
    { parentStatus: "REJECTED", related: true, terminal: true },
    { parentStatus: "CONFLICT", related: true, terminal: true },
    { parentStatus: "RETRYABLE", related: true, terminal: false },
    { parentStatus: "REJECTED", related: false, terminal: false },
  ] as const)("dependência de planejamento: $parentStatus related=$related", async ({ parentStatus, related, terminal }) => {
    const { gesture, ops } = await seedGesture(["create_agenda", "reschedule_agenda"], `dependency-${parentStatus}-${related}`);
    await db.queue_ops.update(ops[0].client_op_id, { record: { ...ops[0].record, fazenda_id: FAZENDA_ID, payload: { agenda: { id: "parent-agenda" } } } });
    await db.queue_ops.update(ops[1].client_op_id, { record: { ...ops[1].record, fazenda_id: FAZENDA_ID, expected_revision: 0, payload: { agenda_id: related ? "parent-agenda" : "unrelated-agenda" } } });
    respondWith([
      { op_id: ops[0].client_op_id, client_op_id: ops[0].client_op_id, domain_op_id: ops[0].domain_op_id, status: parentStatus, retryable: parentStatus === "RETRYABLE", reason_code: "PARENT_RESULT" },
      { op_id: ops[1].client_op_id, client_op_id: ops[1].client_op_id, domain_op_id: ops[1].domain_op_id, status: "BLOCKED_DEPENDENCY", retryable: false, reason_code: "SANITARIO_AGENDA_NOT_FOUND" },
    ]);
    await processGesture(gesture);
    if (terminal) {
      expect(await db.queue_ops.get(ops[1].client_op_id)).toBeUndefined();
      expect((await loadGesture(gesture.client_tx_id)).status).toBe("REJECTED");
      expect((await db.queue_rejections.toArray()).find(row => row.client_op_id === ops[1].client_op_id)).toMatchObject({ result_status: "REJECTED" });
      await recoverBlockedSanitarioV2Operations("reconciliation_drain");
      expect(await db.queue_ops.get(ops[1].client_op_id)).toBeUndefined();
    } else expect(await db.queue_ops.get(ops[1].client_op_id)).toMatchObject({ sync_state: "BLOCKED_DEPENDENCY" });
  });
  it("preserva UUID da operacao na origem da obrigacao sanitaria", async () => {
    await db.sync_reconcile_obligations.clear();
    try {
      const { gesture } = await seedGesture(["create_agenda"], "c05-origin");
      respondWith([{
        op_id: "op-c05-origin-0",
        client_op_id: "op-c05-origin-0",
        domain_op_id: "domain-c05-origin-0",
        status: "APPLIED",
        retryable: false,
        canonical_entity_id: "agenda-c05-origin",
        canonical_result: { agenda_id: "agenda-c05-origin", revision: 1 },
      }]);
      await processGesture(gesture);
      const obligation = await db.sync_reconcile_obligations.get(`${FAZENDA_ID}:sanitario-v2`);
      expect(obligation?.diagnostics?.origins).toContainEqual({
        client_tx_id: "tx-san-v2-c05-origin",
        client_op_ids: ["op-c05-origin-0"],
      });
    } finally {
      await db.sync_reconcile_obligations.clear();
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(pullDataForFarm).mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.state_insumo_lotes.clear(),
      db.local_ownership.clear(),
    ]);
    await establishLocalOwnership(ownershipSession(USER_ID));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.state_insumo_lotes.clear(),
      db.local_ownership.clear(),
    ]);
  });

  it("processa sucesso parcial por opera��o e preserva cada estado can�nico", async () => {
    const { gesture, ops } = await seedGesture(
      [
        "create_agenda",
        "apply_factual_core",
        "close_agenda",
        "replace_agenda_animals",
        "create_agenda",
      ],
      "mixed",
    );
    respondWith([
      {
        op_id: ops[0].client_op_id,
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        status: "APPLIED",
        retryable: false,
        canonical_entity_id: "agenda-server",
        canonical_result: { agenda_id: "agenda-server", revision: 1 },
      },
      {
        op_id: ops[1].client_op_id,
        client_op_id: ops[1].client_op_id,
        domain_op_id: ops[1].domain_op_id,
        status: "RETRYABLE",
        retryable: true,
        reason_code: "SANITARIO_RPC_TIMEOUT",
      },
      {
        op_id: ops[2].client_op_id,
        client_op_id: ops[2].client_op_id,
        domain_op_id: ops[2].domain_op_id,
        status: "REJECTED",
        retryable: false,
        reason_code: "SANITARIO_CLOSURE_INVALID",
        reason_message: "closure rejected",
      },
      {
        op_id: ops[3].client_op_id,
        client_op_id: ops[3].client_op_id,
        domain_op_id: ops[3].domain_op_id,
        status: "CONFLICT",
        retryable: false,
        reason_code: "SANITARIO_DATABASE_CONFLICT",
        canonical_entity_id: "agenda-conflict",
        current_revision: 7,
        canonical_status: "scheduled",
      },
      {
        op_id: ops[4].client_op_id,
        client_op_id: ops[4].client_op_id,
        domain_op_id: ops[4].domain_op_id,
        status: "BLOCKED_DEPENDENCY",
        retryable: false,
        reason_code: "SANITARIO_SYNC_V2_DEPENDENCY_UNAVAILABLE",
      },
    ]);

    await processGesture(gesture);

    const remaining = await db.queue_ops
      .where("client_tx_id")
      .equals(gesture.client_tx_id)
      .sortBy("op_order");
    expect(remaining.map((op) => op.client_op_id)).toEqual([
      ops[1].client_op_id,
      ops[4].client_op_id,
    ]);
    expect(remaining[0]).toMatchObject({
      client_op_id: ops[1].client_op_id,
      domain_op_id: ops[1].domain_op_id,
      sync_state: "RETRYABLE",
      retry_count: 1,
      blocked_reason: "SANITARIO_RPC_TIMEOUT",
    });
    expect(Date.parse(remaining[0].next_attempt_at ?? "")).toBeGreaterThan(
      Date.now(),
    );
    expect(remaining[1]).toMatchObject({
      client_op_id: ops[4].client_op_id,
      domain_op_id: ops[4].domain_op_id,
      sync_state: "BLOCKED_DEPENDENCY",
      blocked_reason: "SANITARIO_SYNC_V2_DEPENDENCY_UNAVAILABLE",
    });

    const rejections = await db.queue_rejections.toArray();
    expect(rejections).toHaveLength(2);
    expect(rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          client_op_id: ops[2].client_op_id,
          domain_op_id: ops[2].domain_op_id,
          result_status: "REJECTED",
          reason_code: "SANITARIO_CLOSURE_INVALID",
        }),
        expect.objectContaining({
          client_op_id: ops[3].client_op_id,
          domain_op_id: ops[3].domain_op_id,
          result_status: "CONFLICT",
          current_revision: 7,
          canonical_status: "scheduled",
          payload: expect.objectContaining({
            current_revision: 7,
            canonical_status: "scheduled",
          }),
        }),
      ]),
    );

    const storedGesture = await loadGesture(gesture.client_tx_id);
    expect(storedGesture.status).toBe("PENDING");
    expect(storedGesture.operation_results).toHaveLength(5);
    expect(
      storedGesture.operation_results?.find(
        (result) => result.op_id === ops[0].client_op_id,
      ),
    ).toMatchObject({
      matched: true,
      status: "APPLIED",
      domain_op_id: ops[0].domain_op_id,
      canonical_entity_id: "agenda-server",
    });
    expect(pullSanitarioV2CutoverState).toHaveBeenCalledWith(FAZENDA_ID);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(
      db.tables.some((table) => table.name.toLowerCase().includes("conform")),
    ).toBe(false);
  });

  it("honra backoff sem trocar identidade e reconcilia factual no retry aplicado", async () => {
    const { gesture, ops } = await seedGesture(["apply_factual_core"], "retry");
    respondWith([
      {
        op_id: ops[0].client_op_id,
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        status: "RETRYABLE",
        retryable: true,
        reason_code: "SANITARIO_RPC_TIMEOUT",
      },
    ]);

    await processGesture(gesture);
    const deferred = await db.queue_ops.get(ops[0].client_op_id);
    expect(deferred).toMatchObject({
      client_op_id: ops[0].client_op_id,
      domain_op_id: ops[0].domain_op_id,
      retry_count: 1,
      sync_state: "RETRYABLE",
    });

    await processGesture(await loadGesture(gesture.client_tx_id));
    expect(fetch).toHaveBeenCalledTimes(1);

    await db.queue_ops.update(ops[0].client_op_id, {
      next_attempt_at: "2020-01-01T00:00:00.000Z",
    });
    respondWith([
      {
        op_id: ops[0].client_op_id,
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        status: "APPLIED",
        retryable: false,
        canonical_entity_id: "event-server",
        canonical_result: {
          evento_id: "event-server",
          source_sanitario_agenda_v2_id: "agenda-linked",
        },
      },
    ]);
    await processGesture(await loadGesture(gesture.client_tx_id));

    expect(fetch).toHaveBeenCalledTimes(2);
    const replayRequest = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1][1]?.body),
    );
    expect(replayRequest.ops[0].client_op_id).toBe(ops[0].client_op_id);
    expect(await db.queue_ops.get(ops[0].client_op_id)).toBeUndefined();
    expect((await loadGesture(gesture.client_tx_id)).status).toBe("DONE");
    expect(pullSanitarioV2CutoverState).toHaveBeenCalledWith(FAZENDA_ID);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it.each(["REJECTED", "CONFLICT"] as const)("preserva o fato e terminaliza companion %s sem retry órfão", async (status) => {
    const {gesture,ops} = await seedGesture(["apply_factual_core"], `terminal-${status}`);
    const eventId = `retained-${status}`;
    await db.event_eventos.put({ id:eventId,fazenda_id:FAZENDA_ID,dominio:"sanitario",payload:{ dose:2 } } as never);
    await db.event_eventos_sanitario.put({ evento_id:eventId,fazenda_id:FAZENDA_ID,tipo:"vacinacao",dose_quantidade:2 } as never);
    const companion:Operation = {client_op_id:`companion-${status}`,client_tx_id:gesture.client_tx_id,op_order:1,
      table:"state_insumo_movimentacoes",action:"INSERT",record:{id:"movement",source_evento_id:eventId,tipo:"consumo_sanitario"},created_at:gesture.created_at};
    await db.queue_ops.add(companion);
    respondWith([
      {op_id:ops[0].client_op_id,status:"REJECTED",reason_code:"SANITARIO_PRODUCT_CATALOG_VERSION_MISMATCH"},
      {op_id:companion.client_op_id,status,reason_code:"SANITARIO_INVENTORY_FACTUAL_OPERATION_REJECTED"},
    ]);
    await processGesture(gesture);
    expect(await loadGesture(gesture.client_tx_id)).toMatchObject({status:"REJECTED",sync_result:"REJECTED"});
    expect(await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).count()).toBe(2);
    expect(await db.queue_rejections.where("client_tx_id").equals(gesture.client_tx_id).count()).toBe(2);
    expect(await db.event_eventos.get(eventId)).toMatchObject({payload:{dose:2}});
    expect(await db.event_eventos_sanitario.get(eventId)).toMatchObject({dose_quantidade:2});
    const rejection = await db.queue_rejections.filter(row => row.client_op_id === ops[0].client_op_id).first();
    await retryRejectedOperation(rejection!);
    expect(await loadGesture(gesture.client_tx_id)).toMatchObject({status:"PENDING"});
    const retained = await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).sortBy("op_order");
    expect(retained.map(op => op.sync_state)).toEqual(["PENDING", "PENDING"]);
    expect(retained.map(op => op.record)).toEqual([ops[0].record, companion.record]);
    await expect(retryRejectedOperation(rejection!)).rejects.toThrow("REJECTED_OPERATION_ALREADY_QUEUED");
    respondWith(retained.map(op => ({op_id:op.client_op_id,status:"APPLIED"})));
    await processGesture(await loadGesture(gesture.client_tx_id));
    expect(await loadGesture(gesture.client_tx_id)).toMatchObject({status:"DONE",sync_result:"APPLIED"});
    expect(await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).count()).toBe(0);
    expect(await db.event_eventos.get(eventId)).toMatchObject({payload:{dose:2}});
  });

  it("retém movimento terminal sem projeção falsa após fato confirmado e permite retry explícito só do movimento", async () => {
    const { gesture, ops } = await seedGesture(["apply_factual_core"], "inventory-terminal-applied");
    const eventId = "accepted-fact";
    ops[0].record.payload = { event: { id: eventId } };
    await db.queue_ops.put(ops[0]);
    await db.event_eventos.put({ id: eventId, fazenda_id: FAZENDA_ID, dominio: "sanitario" } as never);
    const movement: Operation = { client_op_id: "terminal-stock-op", client_tx_id: gesture.client_tx_id, op_order: 1,
      table: "state_insumo_movimentacoes", action: "INSERT", record: { id: "terminal-stock", fazenda_id: FAZENDA_ID,
        source_evento_id: eventId, tipo: "consumo_sanitario", insumo_lote_id: "stock-lot", quantidade_base: 2 }, created_at: gesture.created_at };
    await db.queue_ops.add(movement);
    await db.state_insumo_lotes.put({ id: "stock-lot", fazenda_id: FAZENDA_ID, saldo_atual_base: 100 } as never);
    await db.state_insumo_movimentacoes.put(movement.record as never);
    vi.mocked(pullDataForFarm).mockImplementation(async (_farm, tables, options) => {
      if (!tables?.includes("insumo_lotes") || !options?.reconciliation) return;
      const rows = { insumo_movimentacoes: [], insumo_lotes: [{ id: "stock-lot", fazenda_id: FAZENDA_ID, saldo_atual_base: 100 }] };
      await options.reconciliation.select(rows);
      await db.state_insumo_lotes.bulkPut(rows.insumo_lotes as never);
    });
    respondWith([{ op_id: ops[0].client_op_id, status: "APPLIED" },
      { op_id: movement.client_op_id, status: "REJECTED", reason_code: "DB_57014" }]);
    await processGesture(gesture);
    expect(await db.queue_ops.get(ops[0].client_op_id)).toBeUndefined();
    expect(await db.queue_ops.get(movement.client_op_id)).toMatchObject({ sync_state: "REJECTED", record: movement.record });
    expect(await db.state_insumo_movimentacoes.get("terminal-stock")).toBeUndefined();
    expect(await db.event_eventos.get(eventId)).toBeDefined();
    expect(pullDataForFarm).toHaveBeenCalledWith(FAZENDA_ID, ["insumo_movimentacoes", "insumo_lotes"], expect.any(Object));
    const rejection = await db.queue_rejections.filter(row => row.client_op_id === movement.client_op_id).first();
    await retryRejectedOperation(rejection!);
    expect(await db.state_insumo_movimentacoes.get("terminal-stock")).toBeDefined();
    expect((await db.state_insumo_lotes.get("stock-lot"))?.saldo_atual_base).toBe(98);
    respondWith([{ op_id: movement.client_op_id, status: "REJECTED", reason_code: "DB_57014" }]);
    await processGesture(await loadGesture(gesture.client_tx_id));
    expect(await db.queue_ops.get(movement.client_op_id)).toMatchObject({ sync_state: "REJECTED" });
    expect(await db.state_insumo_movimentacoes.get("terminal-stock")).toBeUndefined();
    expect(pullDataForFarm).toHaveBeenLastCalledWith(FAZENDA_ID, ["insumo_movimentacoes", "insumo_lotes"], expect.any(Object));
    expect((await db.state_insumo_lotes.get("stock-lot"))?.saldo_atual_base).toBe(100);
    await retryRejectedOperation(rejection!);
    expect((await db.state_insumo_lotes.get("stock-lot"))?.saldo_atual_base).toBe(98);
    respondWith([{ op_id: movement.client_op_id, status: "APPLIED" }]);
    await processGesture(await loadGesture(gesture.client_tx_id));
    const retryRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[2][1]?.body));
    expect(retryRequest.ops).toHaveLength(1);
    expect(retryRequest.ops[0].client_op_id).toBe(movement.client_op_id);
    expect((await loadGesture(gesture.client_tx_id)).status).toBe("DONE");
    expect(await db.event_eventos.get(eventId)).toBeDefined();
  });

  it.each([{ committed: false, coalesced: false, lateAck: false }, { committed: true, coalesced: false, lateAck: false },
    { committed: false, coalesced: true, lateAck: false }, { committed: false, coalesced: false, lateAck: true }])(
    "reconciliação de rejeição preserva reserva: %j", async ({ committed, coalesced, lateAck }) => {
    const { gesture, ops } = await seedGesture(["apply_factual_core"], `stock-reservation-${committed}`);
    ops[0].record.payload = { event: { id: "accepted" } };
    await db.queue_ops.put(ops[0]);
    const rejected: Operation = { client_op_id: "failed-stock", client_tx_id: gesture.client_tx_id, op_order: 1,
      table: "state_insumo_movimentacoes", action: "INSERT", record: { id: "failed-stock-row", fazenda_id: FAZENDA_ID,
        source_evento_id: "accepted", tipo: "consumo_sanitario", insumo_lote_id: "shared-lot" }, created_at: gesture.created_at };
    const pending: Operation = { ...rejected, client_op_id: "other-pending-stock", client_tx_id: "another-gesture",
      record: { ...rejected.record, id: "pending-row", source_evento_id: "another-fact", quantidade_base: 2, client_op_id: "other-pending-stock" } };
    await db.queue_ops.bulkAdd([rejected, pending]);
    await db.state_insumo_movimentacoes.bulkPut([rejected.record, pending.record] as never);
    if (coalesced) await upsertReconciliationObligations([{ fazendaId: FAZENDA_ID, scope: "factual", tables: ["animais"] }]);
    respondWith([{ op_id: ops[0].client_op_id, status: "APPLIED" }, { op_id: rejected.client_op_id, status: "REJECTED" }]);
    await processGesture(gesture);
    const pull = vi.mocked(pullDataForFarm).mock.calls.find(([, tables]) => tables?.includes("insumo_lotes"));
    const results = { insumo_lotes: [{ id: "shared-lot", fazenda_id: FAZENDA_ID, saldo_atual_base: committed ? 98 : 100 }],
      insumo_movimentacoes: committed ? [pending.record] : [] };
    if (lateAck) await db.queue_ops.delete(pending.client_op_id);
    expect(pull?.[2]?.reconciliation).toBeDefined();
    await pull![2]!.reconciliation!.select(results);
    expect(results.insumo_lotes[0].saldo_atual_base).toBe(98);
    if (lateAck) expect(await db.queue_ops.get(pending.client_op_id)).toBeUndefined();
    else expect(await db.queue_ops.get(pending.client_op_id)).toMatchObject({ record: pending.record });
    expect(await db.state_insumo_movimentacoes.get("pending-row")).toBeDefined();
  });

  it("reenvia somente movimento retryable após fato confirmado", async () => {
    const { gesture, ops } = await seedGesture(
      ["apply_factual_core"],
      "inventory-retry",
    );
    const movement: Operation = {
      client_op_id: "op-inventory-retry-1",
      client_tx_id: gesture.client_tx_id,
      op_order: 1,
      table: "state_insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: "movement-1",
        source_evento_id: "event-1",
        tipo: "consumo_sanitario",
      },
      domain_op_id: "domain-inventory-retry-1",
      created_at: gesture.created_at,
    };
    await db.queue_ops.add(movement);
    respondWith([
      {
        op_id: ops[0].client_op_id,
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        status: "APPLIED",
      },
      {
        op_id: movement.client_op_id,
        client_op_id: movement.client_op_id,
        domain_op_id: movement.domain_op_id,
        status: "RETRYABLE",
        retryable: true,
        reason_code: "SANITARIO_INVENTORY_SOURCE_LOOKUP_FAILED",
      },
    ]);

    await processGesture(gesture);
    expect(await db.queue_ops.get(ops[0].client_op_id)).toBeUndefined();
    expect(await db.queue_ops.get(movement.client_op_id)).toMatchObject({
      sync_state: "RETRYABLE",
      retry_count: 1,
    });

    await db.queue_ops.update(movement.client_op_id, {
      next_attempt_at: "2020-01-01T00:00:00.000Z",
    });
    respondWith([
      {
        op_id: movement.client_op_id,
        client_op_id: movement.client_op_id,
        domain_op_id: movement.domain_op_id,
        status: "APPLIED",
      },
    ]);
    await processGesture(await loadGesture(gesture.client_tx_id));

    const retryRequest = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1][1]?.body),
    );
    expect(retryRequest.ops).toHaveLength(1);
    expect(retryRequest.ops[0]).toMatchObject({
      client_op_id: movement.client_op_id,
      table: "insumo_movimentacoes",
    });
    expect(await db.queue_ops.get(movement.client_op_id)).toBeUndefined();
    expect((await loadGesture(gesture.client_tx_id)).status).toBe("DONE");
  });

  it("mant�m depend�ncia bloqueada fora do loop autom�tico", async () => {
    const { gesture, ops } = await seedGesture(["create_agenda"], "blocked");
    respondWith([
      {
        op_id: ops[0].client_op_id,
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        status: "BLOCKED_DEPENDENCY",
        retryable: false,
        reason_code: "SANITARIO_SYNC_V2_DEPENDENCY_UNAVAILABLE",
      },
    ]);

    await processGesture(gesture);
    expect((await loadGesture(gesture.client_tx_id)).status).toBe("ERROR");
    expect(await db.queue_ops.get(ops[0].client_op_id)).toMatchObject({
      sync_state: "BLOCKED_DEPENDENCY",
      domain_op_id: ops[0].domain_op_id,
    });

    await processGesture(await loadGesture(gesture.client_tx_id));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.queue_ops.get(ops[0].client_op_id)).toBeDefined();
  });

  it("registra conflito sem entidade e executa reconcile conservador", async () => {
    const { gesture, ops } = await seedGesture(
      ["replace_agenda_animals"],
      "conflict",
    );
    respondWith([
      {
        op_id: ops[0].client_op_id,
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        status: "CONFLICT",
        retryable: false,
        reason_code: "SANITARIO_DATABASE_CONFLICT",
        current_revision: 12,
        canonical_status: "closed",
      },
    ]);

    await processGesture(gesture);

    expect(await db.queue_ops.get(ops[0].client_op_id)).toBeUndefined();
    expect(await db.queue_rejections.toArray()).toEqual([
      expect.objectContaining({
        client_op_id: ops[0].client_op_id,
        domain_op_id: ops[0].domain_op_id,
        result_status: "CONFLICT",
        current_revision: 12,
        canonical_status: "closed",
      }),
    ]);
    expect(pullSanitarioV2CutoverState).toHaveBeenCalledWith(FAZENDA_ID);
    expect(await db.event_eventos.count()).toBe(0);
  });

  it("ignora resultado sem opera��o correspondente ou com ids divergentes", async () => {
    const { gesture, ops } = await seedGesture(["create_agenda"], "mismatch");
    respondWith([
      {
        op_id: "op-unknown",
        client_op_id: "op-unknown",
        domain_op_id: "domain-unknown",
        status: "APPLIED",
        retryable: false,
        canonical_entity_id: "agenda-unknown",
      },
      {
        op_id: ops[0].client_op_id,
        client_op_id: "op-divergent",
        domain_op_id: ops[0].domain_op_id,
        status: "APPLIED",
        retryable: false,
        canonical_entity_id: "agenda-divergent",
      },
    ]);

    await processGesture(gesture);

    expect(await db.queue_ops.get(ops[0].client_op_id)).toMatchObject({
      client_op_id: ops[0].client_op_id,
      domain_op_id: ops[0].domain_op_id,
      sync_state: "RETRYABLE",
      retry_count: 1,
      blocked_reason: "SYNC_RESULT_MISSING",
    });
    const audit = (await loadGesture(gesture.client_tx_id)).operation_results;
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op_id: "op-unknown",
          matched: false,
          local_reason_code: "SYNC_RESULT_OP_NOT_FOUND",
        }),
        expect.objectContaining({
          op_id: ops[0].client_op_id,
          matched: false,
          local_reason_code: "SYNC_RESULT_ID_MISMATCH",
        }),
      ]),
    );
    expect(pullSanitarioV2CutoverState).not.toHaveBeenCalled();
    expect(await db.queue_rejections.count()).toBe(0);
  });

  it("deduplica auditoria e n�o cria fatos no replay de APPLIED", async () => {
    const { gesture, ops } = await seedGesture(["create_agenda"], "replay");
    const applied: SyncOperationResult = {
      op_id: ops[0].client_op_id,
      client_op_id: ops[0].client_op_id,
      domain_op_id: ops[0].domain_op_id,
      status: "APPLIED",
      retryable: false,
      canonical_entity_id: "agenda-replay",
      canonical_result: { agenda_id: "agenda-replay", revision: 1 },
    };
    respondWith([applied]);

    await processGesture(gesture);
    const firstGesture = await loadGesture(gesture.client_tx_id);
    expect(firstGesture.operation_results).toHaveLength(1);

    await db.queue_ops.add(ops[0]);
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "PENDING",
      sync_result: undefined,
      completed_at: undefined,
    });
    respondWith([applied]);
    await processGesture(await loadGesture(gesture.client_tx_id));

    const replayedGesture = await loadGesture(gesture.client_tx_id);
    expect(replayedGesture.operation_results).toHaveLength(1);
    expect(replayedGesture.operation_results?.[0]).toMatchObject({
      op_id: ops[0].client_op_id,
      domain_op_id: ops[0].domain_op_id,
      status: "APPLIED",
      matched: true,
    });
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.queue_rejections.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
  it("serializa sanitario_v2 no envelope superior e preserva identidades", async () => {
    const { ops } = await seedGesture(["create_agenda"], "wire");
    const mapped = mapOperationForSync(ops[0], FAZENDA_ID);
    expect(mapped).toMatchObject({
      domain: "sanitario_v2",
      command: "create_agenda",
      client_op_id: ops[0].client_op_id,
      client_tx_id: ops[0].client_tx_id,
      domain_op_id: ops[0].domain_op_id,
      contract_version: 2,
    });
    expect(mapped).not.toHaveProperty("table");
    expect(mapped).not.toHaveProperty("record");
  });

  it("reabre dependencia bloqueada somente por trigger explicito", async () => {
    const { gesture, ops } = await seedGesture(["create_agenda"], "recover");
    await db.queue_ops.update(ops[0].client_op_id, {
      sync_state: "BLOCKED_DEPENDENCY",
      blocked_reason: "remote_dependency",
    });
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "ERROR",
      sync_result: "ERROR",
    });

    await expect(
      recoverBlockedSanitarioV2Operations("remote_dependency_recovered"),
    ).resolves.toBe(1);
    expect(await db.queue_ops.get(ops[0].client_op_id)).toMatchObject({
      client_op_id: ops[0].client_op_id,
      domain_op_id: ops[0].domain_op_id,
      sync_state: "PENDING",
    });
    const recoveredGesture = await loadGesture(gesture.client_tx_id);
    expect(recoveredGesture.status).toBe("PENDING");
    expect(recoveredGesture.sync_result).toBeUndefined();
  });
});
