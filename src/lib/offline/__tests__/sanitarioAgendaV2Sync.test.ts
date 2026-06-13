/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-agenda-v2",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-agenda-v2-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
    },
  },
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { createGesture } from "../ops";
import { db } from "../db";
import { pullDataForFarm, pullSanitarioAgendaV2 } from "../pull";
import { processGesture } from "../syncWorker";

const fazendaId = "farm-agenda-sync";
const now = "2026-06-13T10:00:00.000Z";

function closureRecord(id: string, agendaId: string) {
  return {
    id,
    fazenda_id: fazendaId,
    agenda_id: agendaId,
    closure_type: "closed_without_execution",
    dedup_key: `closure:${agendaId}`,
    closed_at: now,
    closed_by: null,
    execution_evento_id: null,
    reason: "Fechamento administrativo sem execucao sanitaria",
    partial_payload: {},
    metadata: {
      createsEvent: false,
      createsInventoryMovement: false,
      calculatesWithdrawal: false,
      releasesOperationalEligibility: false,
    },
    deleted_at: null,
  };
}

async function getGesture(txId: string) {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error(`Gesture ${txId} not found`);
  return gesture;
}

describe("Agenda Sanitaria v2 controlled offline push", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await Promise.all([
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.ops_sanitario_agenda_closures_v2.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.ops_sanitario_agenda_closures_v2.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  it("bloqueia push de catalog_* e das tabelas agenda/animais v2 pull-only", async () => {
    await expect(
      createGesture(fazendaId, [
        {
          table: "catalog_sanitario_produtos_v2",
          action: "INSERT",
          record: { id: "catalog-product-1" },
        },
      ]),
    ).rejects.toThrow("CATALOG_PUSH_BLOCKED");

    await expect(
      createGesture(fazendaId, [
        {
          table: "sanitario_agenda_v2",
          action: "INSERT",
          record: { id: "agenda-blocked-1" },
        },
      ]),
    ).rejects.toThrow("SANITARIO_AGENDA_V2_PULL_ONLY");

    await expect(
      createGesture(fazendaId, [
        {
          table: "sanitario_agenda_animais_v2",
          action: "INSERT",
          record: { agenda_id: "agenda-1", animal_id: "animal-1" },
        },
      ]),
    ).rejects.toThrow("SANITARIO_AGENDA_V2_PULL_ONLY");

    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(0);
  });

  it("bloqueia push de closure que confirme execucao sanitaria na 12E4", async () => {
    await expect(
      createGesture(fazendaId, [
        {
          table: "sanitario_agenda_closures_v2",
          action: "INSERT",
          record: {
            ...closureRecord("closure-executed", "agenda-executed"),
            closure_type: "executed_with_event",
          },
        },
      ]),
    ).rejects.toThrow("SANITARIO_AGENDA_CLOSURE_EXECUTION_BLOCKED_IN_12E4");

    await expect(
      createGesture(fazendaId, [
        {
          table: "sanitario_agenda_closures_v2",
          action: "INSERT",
          record: {
            ...closureRecord("closure-partial", "agenda-partial"),
            closure_type: "partially_executed_with_event",
          },
        },
      ]),
    ).rejects.toThrow("SANITARIO_AGENDA_CLOSURE_EXECUTION_BLOCKED_IN_12E4");

    await expect(
      createGesture(fazendaId, [
        {
          table: "sanitario_agenda_closures_v2",
          action: "INSERT",
          record: {
            ...closureRecord("closure-event", "agenda-event"),
            execution_evento_id: "event-forbidden",
          },
        },
      ]),
    ).rejects.toThrow("SANITARIO_AGENDA_CLOSURE_EXECUTION_BLOCKED_IN_12E4");

    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_closures_v2.count()).toBe(0);
  });

  it("permite push local apenas de closures administrativas sem execution_evento_id", async () => {
    const txId = await createGesture(fazendaId, [
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: closureRecord("closure-closed", "agenda-closed"),
      },
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: {
          ...closureRecord("closure-cancelled", "agenda-cancelled"),
          closure_type: "cancelled",
        },
      },
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: {
          ...closureRecord("closure-dismissed", "agenda-dismissed"),
          closure_type: "dismissed",
        },
      },
    ]);

    const ops = await db.queue_ops.where("client_tx_id").equals(txId).sortBy("op_order");
    expect(ops).toHaveLength(3);
    expect(ops.map((op) => op.record.closure_type)).toEqual([
      "closed_without_execution",
      "cancelled",
      "dismissed",
    ]);
    expect(ops.every((op) => op.record.execution_evento_id === null)).toBe(true);
    expect(await db.ops_sanitario_agenda_closures_v2.count()).toBe(3);
  });

  it("sincroniza closure com client_op_id sem criar evento, estoque ou carencia", async () => {
    const txId = await createGesture(fazendaId, [
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: closureRecord("closure-ok", "agenda-ok"),
      },
    ]);
    const [op] = await db.queue_ops.where("client_tx_id").equals(txId).toArray();

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ op_id: op.client_op_id, status: "APPLIED" }],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(request.ops).toEqual([
      expect.objectContaining({
        client_op_id: op.client_op_id,
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: expect.objectContaining({
          id: "closure-ok",
          fazenda_id: fazendaId,
          agenda_id: "agenda-ok",
          client_op_id: op.client_op_id,
          execution_evento_id: null,
          metadata: expect.objectContaining({
            createsEvent: false,
            createsInventoryMovement: false,
            calculatesWithdrawal: false,
            releasesOperationalEligibility: false,
          }),
        }),
      }),
    ]);
    expect(JSON.stringify(request.ops)).not.toContain("catalog_");
    expect(JSON.stringify(request.ops)).not.toContain("state_");

    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(pullSanitarioAgendaV2).toHaveBeenCalledWith(fazendaId);
    expect(pullDataForFarm).not.toHaveBeenCalled();
  });

  it("trata conflito de closure duplicada como rejeicao controlada sem perda silenciosa", async () => {
    const txId = await createGesture(fazendaId, [
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: closureRecord("closure-conflict", "agenda-conflict"),
      },
    ]);
    const [op] = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
    expect(await db.ops_sanitario_agenda_closures_v2.get("closure-conflict")).toBeDefined();

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "sanitario_agenda_closure_already_exists",
              reason_message: "Closure active already exists for agenda",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    const gesture = await getGesture(txId);
    expect(gesture.status).toBe("REJECTED");
    expect(await db.ops_sanitario_agenda_closures_v2.get("closure-conflict")).toBeUndefined();
    expect(await db.queue_ops.count()).toBe(1);
    expect(await db.queue_rejections.count()).toBe(1);
    expect((await db.queue_rejections.toArray())[0]).toMatchObject({
      reason_code: "sanitario_agenda_closure_already_exists",
      table: "sanitario_agenda_closures_v2",
    });
    expect(pullSanitarioAgendaV2).toHaveBeenCalledWith(fazendaId);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it("mantem sucesso parcial de closures: aceitas sincronizadas e rejeitadas rastreaveis", async () => {
    const txId = await createGesture(fazendaId, [
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: closureRecord("closure-accepted", "agenda-accepted"),
      },
      {
        table: "sanitario_agenda_closures_v2",
        action: "INSERT",
        record: closureRecord("closure-rejected", "agenda-rejected"),
      },
    ]);
    const ops = await db.queue_ops.where("client_tx_id").equals(txId).sortBy("op_order");
    const [acceptedOp, rejectedOp] = ops;

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: acceptedOp.client_op_id, status: "APPLIED" },
            {
              op_id: rejectedOp.client_op_id,
              status: "REJECTED",
              reason_code: "sanitario_agenda_closure_already_exists",
              reason_message: "Closure active already exists for agenda",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    expect((await getGesture(txId)).status).toBe("REJECTED");
    expect(await db.ops_sanitario_agenda_closures_v2.get("closure-accepted")).toBeDefined();
    expect(await db.ops_sanitario_agenda_closures_v2.get("closure-rejected")).toBeUndefined();

    const remainingOps = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
    expect(remainingOps).toEqual([
      expect.objectContaining({ client_op_id: rejectedOp.client_op_id }),
    ]);
    const rejection = (await db.queue_rejections.toArray())[0];
    expect(rejection).toMatchObject({
      client_op_id: rejectedOp.client_op_id,
      reason_code: "sanitario_agenda_closure_already_exists",
      reason_message: "Closure active already exists for agenda",
    });
    expect(rejection.reason_code).toBeTruthy();
    expect(pullSanitarioAgendaV2).toHaveBeenCalledWith(fazendaId);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
});
