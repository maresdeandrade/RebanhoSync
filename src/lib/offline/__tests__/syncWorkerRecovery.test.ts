/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: { user: { id: "user-sync-worker-recovery" } },
        },
        error: null,
      })),
    },
  },
}));

import { db } from "../db";
import { seedLocalOwner } from "./ownershipTestFixture";
import {
  recoverErroredGesturesOnce,
  recoverStaleSyncingGesturesOnce,
} from "../syncWorker";
import type { Gesture, Operation } from "../types";

function makeGesture(overrides: Partial<Gesture> = {}): Gesture {
  return {
    client_tx_id: overrides.client_tx_id ?? crypto.randomUUID(),
    fazenda_id: overrides.fazenda_id ?? "farm-1",
    client_id: overrides.client_id ?? "client-1",
    status: overrides.status ?? "ERROR",
    sync_result: overrides.sync_result ?? "ERROR",
    completed_at: overrides.completed_at ?? "2026-05-01T10:00:00.000Z",
    last_error: overrides.last_error,
    retry_count: overrides.retry_count ?? 1,
    created_at: overrides.created_at ?? "2026-05-01T09:59:00.000Z",
  };
}

describe("syncWorker recovery", () => {
  beforeEach(async () => {
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
    ]);
    await seedLocalOwner("user-sync-worker-recovery");
  });

  afterEach(async () => {
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
    ]);
  });

  it("requeues transient HTTP 503 gestures after local Edge Functions recover", async () => {
    const txId = "tx-http-503";
    await db.queue_gestures.add(
      makeGesture({
        client_tx_id: txId,
        last_error: "HTTP 503 - name resolution failed",
      }),
    );
    await db.queue_ops.add({
      client_tx_id: txId,
      client_op_id: "op-http-503",
      table: "lotes",
      action: "INSERT",
      record: { id: "lote-http-503", fazenda_id: "farm-1" },
      sync_state: "PENDING",
      created_at: "2026-05-01T09:59:00.000Z",
    });

    await recoverErroredGesturesOnce();

    const recovered = await db.queue_gestures.get(txId);
    expect(recovered).toMatchObject({
      status: "PENDING",
      retry_count: 0,
      last_error: "Recovered transient sync error; retrying after worker startup",
    });
    expect(recovered?.sync_result).toBeUndefined();
    expect(recovered?.completed_at).toBeUndefined();
  });

  it("does not requeue validation errors that need reconciliation", async () => {
    const txId = "tx-validation";
    await db.queue_gestures.add(
      makeGesture({
        client_tx_id: txId,
        last_error: "VALIDATION_ERROR: especie invalida",
      }),
    );

    await recoverErroredGesturesOnce();

    const unchanged = await db.queue_gestures.get(txId);
    expect(unchanged).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
      completed_at: "2026-05-01T10:00:00.000Z",
      retry_count: 1,
      last_error: "VALIDATION_ERROR: especie invalida",
    });
  });

  it("does not requeue forbidden farm access errors", async () => {
    const txId = "tx-forbidden";
    await db.queue_gestures.add(
      makeGesture({
        client_tx_id: txId,
        last_error: 'HTTP 403 - {"error":"Forbidden - no access to this farm"}',
      }),
    );

    await recoverErroredGesturesOnce();

    const unchanged = await db.queue_gestures.get(txId);
    expect(unchanged).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
      retry_count: 1,
      last_error: 'HTTP 403 - {"error":"Forbidden - no access to this farm"}',
    });
  });

  it("requeues stale SYNCING only when persisted work is non-terminal", async () => {
    const txId = "tx-stale-syncing";
    const operation: Operation = {
      client_tx_id: txId,
      client_op_id: "op-stale-syncing",
      table: "eventos",
      action: "INSERT",
      record: { id: "event-stale-syncing", fazenda_id: "farm-1" },
      sync_state: "PENDING",
      created_at: "2026-05-01T09:59:00.000Z",
    };
    await db.queue_gestures.add(
      makeGesture({ client_tx_id: txId, status: "SYNCING" }),
    );
    await db.queue_ops.add(operation);

    await expect(recoverStaleSyncingGesturesOnce()).resolves.toBe(1);

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      client_tx_id: txId,
      status: "PENDING",
      last_error:
        "Recovered interrupted sync; retrying with persisted identity",
    });
    expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
  });

  it("classifies stale SYNCING without operations as manual reconciliation error", async () => {
    const txId = "tx-stale-without-ops";
    await db.queue_gestures.add(
      makeGesture({ client_tx_id: txId, status: "SYNCING" }),
    );

    await expect(recoverStaleSyncingGesturesOnce()).resolves.toBe(1);

    const recovered = await db.queue_gestures.get(txId);
    expect(recovered).toMatchObject({
      client_tx_id: txId,
      status: "ERROR",
      sync_result: "ERROR",
      last_error:
        "Gesture sem operações enfileiradas; reconciliação manual necessária",
    });
    expect(recovered?.status).not.toBe("DONE");
  });

  it("requeues stale SYNCING with only terminal operations for terminal settle", async () => {
    const txId = "tx-stale-terminal";
    await db.queue_gestures.add(
      makeGesture({ client_tx_id: txId, status: "SYNCING" }),
    );
    await db.queue_ops.add({
      client_tx_id: txId,
      client_op_id: "op-stale-terminal",
      table: "eventos",
      action: "INSERT",
      record: { id: "event-stale-terminal", fazenda_id: "farm-1" },
      sync_state: "REJECTED",
      created_at: "2026-05-01T09:59:00.000Z",
    });

    await expect(recoverStaleSyncingGesturesOnce()).resolves.toBe(1);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      client_tx_id: txId,
    });
    expect(await db.queue_ops.get("op-stale-terminal")).toMatchObject({
      sync_state: "REJECTED",
    });
  });
});
