/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import { recoverErroredGesturesOnce } from "../syncWorker";
import type { Gesture } from "../types";

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
    await db.queue_gestures.clear();
  });

  afterEach(async () => {
    await db.queue_gestures.clear();
  });

  it("requeues transient HTTP 503 gestures after local Edge Functions recover", async () => {
    const txId = "tx-http-503";
    await db.queue_gestures.add(
      makeGesture({
        client_tx_id: txId,
        last_error: "HTTP 503 - name resolution failed",
      }),
    );

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
});
