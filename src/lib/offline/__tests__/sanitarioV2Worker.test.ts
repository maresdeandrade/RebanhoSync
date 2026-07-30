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
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { pullDataForFarm, pullSanitarioAgendaV2 } from "../pull";
import { processGesture } from "../syncWorker";
import type {
  Gesture,
  Operation,
  SanitarioSyncV2Command,
  SyncOperationResult,
} from "../types";

const FAZENDA_ID = "farm-san-v2-worker";
const CLIENT_ID = "client-san-v2-worker";

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
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
    ]);
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
    expect(pullSanitarioAgendaV2).toHaveBeenCalledWith(FAZENDA_ID);
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
    expect(pullDataForFarm).toHaveBeenCalledWith(
      FAZENDA_ID,
      ["eventos", "eventos_sanitario", "eventos_animais"],
      { mode: "merge" },
    );
    expect(pullSanitarioAgendaV2).toHaveBeenCalledWith(FAZENDA_ID);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
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
    expect(pullDataForFarm).toHaveBeenCalledWith(
      FAZENDA_ID,
      ["eventos", "eventos_sanitario", "eventos_animais"],
      { mode: "merge" },
    );
    expect(pullSanitarioAgendaV2).toHaveBeenCalledWith(FAZENDA_ID);
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
    expect(pullSanitarioAgendaV2).not.toHaveBeenCalled();
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
});
