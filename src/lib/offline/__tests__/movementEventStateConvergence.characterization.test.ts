/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  pull: vi.fn(async () => undefined),
  rows: [] as Record<string, unknown>[],
  decisions: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "test",
            expires_at: 9999999999,
            user: { id: "movement-unit-owner" },
          },
        },
      })),
    },
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          in: async () => ({
            data:
              table === "animal_lot_movement_effect_decisions"
                ? mocks.decisions
                : mocks.rows,
            error: null,
          }),
        }),
      }),
    })),
  },
}));
vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: mocks.pull,
  pullInitialData: vi.fn(),
  pullSanitarioAgendaV2: vi.fn(),
  pullSanitarioV2CutoverState: vi.fn(),
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(),
  flushPilotMetrics: vi.fn(),
}));
import { db } from "../db";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { createGesture } from "../ops";
import { establishLocalOwnership } from "../ownership";
import {
  mapOperationForSync,
  processGesture,
  drainReconciliationObligations,
} from "../syncWorker";
import {
  recordMovementResults,
  reconcileMovementForFarm,
} from "../movementReconciliation";
import type { Operation, SyncOperationResult } from "../types";
const farm = "aaaaaaaa-0000-4000-8000-000000000001",
  animal = "aaaaaaaa-0000-4000-8000-000000000002";
const origin = "aaaaaaaa-0000-4000-8000-000000000003",
  target = "aaaaaaaa-0000-4000-8000-000000000004";
async function enqueue(historical = false, extra = false) {
  const built = buildEventGesture({
    dominio: "movimentacao",
    fazendaId: farm,
    animalId: animal,
    fromLoteId: origin,
    toLoteId: target,
    occurredAt: "2026-10-01T12:00:00.000Z",
    applyAnimalStateUpdate: !historical,
  });
  const tx = await createGesture(farm, [
    ...built.ops,
    ...(extra
      ? [
          {
            table: "animais",
            action: "UPDATE" as const,
            record: { id: animal, observacoes: "generic retained" },
          },
        ]
      : []),
  ]);
  return (await db.queue_ops.where("client_tx_id").equals(tx).toArray()).find(
    (op) => op.table === "movement_v1",
  )!;
}
function receipt(op: Operation, status: string) {
  return {
    event_id: op.record.event_id,
    fazenda_id: farm,
    client_op_id: op.client_op_id,
    client_tx_id: op.client_tx_id,
    command_digest: op.command_digest,
    status,
  };
}
function result(
  op: Operation,
  status: SyncOperationResult["status"],
  canonical: string,
): SyncOperationResult {
  return {
    op_id: op.client_op_id,
    status,
    canonical_result: receipt(op, canonical),
    retryable: false,
  };
}
async function record(op: Operation, value: SyncOperationResult) {
  await recordMovementResults(
    (await db.queue_gestures.get(op.client_tx_id))!,
    [op],
    [value],
  );
}
// These are client regression tests. Real concurrency/ACK/pull evidence is in the native BrowserContext suite.
describe("F24.4E2 finalization — durable movement result and reconciliation", () => {
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
    await db.open();
    await Promise.all(db.tables.map((table) => table.clear()));
    await establishLocalOwnership({
      user: { id: "movement-unit-owner" },
    } as never);
    await db.state_animais.put({
      id: animal,
      fazenda_id: farm,
      lote_id: origin,
      movement_version: "0",
      movement_head_event_id: null,
      revision: 5,
    } as never);
    mocks.rows = [];
    mocks.decisions = [];
    mocks.pull.mockReset();
    mocks.pull.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ["APPLIED", "STATE_APPLIED"],
    ["APPLIED", "HISTORY_ONLY"],
    ["CONFLICT", "PROJECTION_CONFLICT"],
    ["CONFLICT", "HISTORY_CONFLICT"],
    ["REJECTED", "REJECTED"],
  ] as const)(
    "maps %s / %s to explicit terminal reconciliation",
    async (external, canonical) => {
      const op = await enqueue(canonical === "HISTORY_ONLY");
      await record(op, result(op, external, canonical));
      expect((await db.queue_ops.get(op.client_op_id))?.sync_state).toBe(
        "RECONCILE",
      );
      await reconcileMovementForFarm(farm);
      expect(await db.queue_ops.get(op.client_op_id)).toBeUndefined();
      const gesture = await db.queue_gestures.get(op.client_tx_id);
      expect(gesture?.status).toBe(
        external === "APPLIED" ? "DONE" : "REJECTED",
      );
      expect(gesture?.operation_results?.[0].canonical_result?.status).toBe(
        canonical,
      );
    },
  );
  it("pending promotion retains original receipt and does not resend child", async () => {
    const op = await enqueue();
    const original = result(
      op,
      "BLOCKED_DEPENDENCY",
      "PENDING_CAUSAL_DEPENDENCY",
    );
    await record(op, original);
    await expect(reconcileMovementForFarm(farm)).rejects.toThrow(
      "MOVEMENT_RECONCILIATION_PENDING",
    );
    expect((await db.queue_ops.get(op.client_op_id))?.sync_state).toBe(
      "BLOCKED_DEPENDENCY",
    );
    mocks.rows = [
      {
        event_id: op.record.event_id,
        command_digest: op.command_digest,
        animal_id: animal,
        effective_result: "STATE_APPLIED",
      },
    ];
    mocks.decisions = [
      {
        event_id: op.record.event_id,
        fazenda_id: farm,
        result: "STATE_APPLIED",
      },
    ];
    await drainReconciliationObligations(farm);
    const audit = (await db.queue_gestures.get(op.client_tx_id))
      ?.operation_results?.[0];
    expect(audit?.canonical_result).toEqual(original.canonical_result);
    expect(audit?.movement_effective_result).toBe("STATE_APPLIED");
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.queue_ops.get(op.client_op_id)).toBeUndefined();
  });
  it("pending terminal conflict is durable and never presented as state applied", async () => {
    const op = await enqueue();
    await record(
      op,
      result(op, "BLOCKED_DEPENDENCY", "PENDING_CAUSAL_DEPENDENCY"),
    );
    mocks.rows = [
      {
        event_id: op.record.event_id,
        command_digest: op.command_digest,
        animal_id: animal,
        effective_result: "PROJECTION_CONFLICT",
      },
    ];
    mocks.decisions = [
      {
        event_id: op.record.event_id,
        fazenda_id: farm,
        result: "PROJECTION_CONFLICT",
        reason_code: "PREDECESSOR_NOT_STATE_APPLIED",
      },
    ];
    await reconcileMovementForFarm(farm);
    expect((await db.queue_gestures.get(op.client_tx_id))?.status).toBe(
      "REJECTED",
    );
    expect(await db.queue_rejections.count()).toBe(1);
  });
  it("infra result preserves command/selector/digest for retry", async () => {
    const op = await enqueue();
    await record(op, {
      op_id: op.client_op_id,
      status: "RETRYABLE",
      retryable: true,
    });
    const current = (await db.queue_ops.get(op.client_op_id))!;
    expect(current.record).toEqual(op.record);
    expect(current.command_digest).toBe(op.command_digest);
    expect(current.sync_state).toBe("RETRYABLE");
    expect(mapOperationForSync(current, farm)).toEqual(op.record);
  });
  it("missing result remains retryable with the same identity", async () => {
    const op = await enqueue();
    await recordMovementResults(
      (await db.queue_gestures.get(op.client_tx_id))!,
      [op],
      [],
    );
    expect((await db.queue_ops.get(op.client_op_id))?.sync_state).toBe(
      "RETRYABLE",
    );
  });
  it("receipt identity mismatch aborts ACK transaction", async () => {
    const op = await enqueue();
    const value = result(op, "APPLIED", "STATE_APPLIED");
    value.canonical_result!.command_digest = "wrong";
    await expect(record(op, value)).rejects.toThrow(
      "MOVEMENT_RECEIPT_IDENTITY_MISMATCH",
    );
    expect((await db.queue_ops.get(op.client_op_id))?.sync_state).toBe(
      "PENDING",
    );
  });
  it("pull failure preserves terminal receipt and obligation until successful drain", async () => {
    const op = await enqueue();
    await record(op, result(op, "APPLIED", "STATE_APPLIED"));
    mocks.pull.mockRejectedValueOnce(new Error("offline"));
    await drainReconciliationObligations(farm);
    expect(await db.queue_ops.get(op.client_op_id)).toBeDefined();
    expect(await db.sync_reconcile_obligations.count()).toBe(1);
    await drainReconciliationObligations(farm);
    expect(await db.queue_ops.get(op.client_op_id)).toBeUndefined();
    expect(await db.sync_reconcile_obligations.count()).toBe(0);
  });
  it("farm B drain cannot consume A obligation", async () => {
    const op = await enqueue();
    await record(op, result(op, "APPLIED", "STATE_APPLIED"));
    await drainReconciliationObligations("farm-b");
    expect(await db.queue_ops.get(op.client_op_id)).toBeDefined();
    expect(mocks.pull).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "mixed gesture preserves movement rejection=%s after generic ACK",
    async (conflict) => {
      const op = await enqueue(false, true);
      const all = await db.queue_ops
        .where("client_tx_id")
        .equals(op.client_tx_id)
        .toArray();
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            results: all.map((item) =>
              item.table === "movement_v1"
                ? result(
                    op,
                    conflict ? "CONFLICT" : "APPLIED",
                    conflict ? "PROJECTION_CONFLICT" : "STATE_APPLIED",
                  )
                : { op_id: item.client_op_id, status: "APPLIED" },
            ),
          }),
          { status: 200 },
        ),
      );
      await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
      expect(
        await db.queue_ops
          .where("client_tx_id")
          .equals(op.client_tx_id)
          .count(),
      ).toBe(0);
      expect((await db.queue_gestures.get(op.client_tx_id))?.status).toBe(
        conflict ? "REJECTED" : "DONE",
      );
    },
  );
  it("a later applied movement cannot erase an earlier conflict in the same gesture", async () => {
    const first = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farm,
      animalId: animal,
      fromLoteId: origin,
      toLoteId: target,
    });
    const second = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farm,
      animalId: animal,
      fromLoteId: target,
      toLoteId: origin,
    });
    const tx = await createGesture(farm, [...first.ops, ...second.ops]);
    const ops = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
    await recordMovementResults(
      (await db.queue_gestures.get(tx))!,
      ops,
      ops.map((op, index) =>
        result(
          op,
          index === 0 ? "CONFLICT" : "APPLIED",
          index === 0 ? "PROJECTION_CONFLICT" : "STATE_APPLIED",
        ),
      ),
    );
    await reconcileMovementForFarm(farm);
    expect((await db.queue_gestures.get(tx))?.status).toBe("REJECTED");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("correction is blocked before generating a movement command", () => {
    expect(() =>
      buildEventGesture({
        dominio: "movimentacao",
        fazendaId: farm,
        animalId: animal,
        fromLoteId: origin,
        toLoteId: target,
        corrigeEventoId: "prior",
      }),
    ).toThrow("MOVEMENT_CORRECTION_NOT_SUPPORTED");
  });
  it("lote→pasto retains its independent generic contract", () => {
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farm,
      loteId: origin,
      fromLoteId: origin,
      toLoteId: origin,
      movementKind: "lote_pasto",
      fromPastoId: "pasto-a",
      toPastoId: "pasto-b",
      applyAnimalStateUpdate: false,
      applyLoteStateUpdate: true,
    });
    expect(built.ops.map((op) => op.table)).toEqual([
      "eventos",
      "eventos_movimentacao",
      "lotes",
    ]);
  });
});
