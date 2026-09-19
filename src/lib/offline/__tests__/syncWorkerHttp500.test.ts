/**
 * F24.2D1B — HTTP 500 como erro transitório: retry na sessão e recovery no
 * startup, com 502/503/504 preservados e 403 permanecendo terminal.
 */
/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-500",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
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
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { createGesture } from "../ops";
import { db } from "../db";
import {
  processGesture,
  recoverErroredGesturesOnce,
} from "../syncWorker";

function http500Response() {
  return new Response(JSON.stringify({ error: "internal error" }), {
    status: 500,
  });
}

describe("F24.2D1B — HTTP 500 transient recovery", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn(async () => http500Response()));
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  it("T1 — HTTP 500 abaixo do limite: PENDING com retry_count incrementado", async () => {
    const txId = await createGesture("farm-500", [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-500", fazenda_id: "farm-500" },
      },
    ]);

    const gesture = await db.queue_gestures.get(txId);
    await processGesture(gesture!);

    const after = await db.queue_gestures.get(txId);
    expect(after?.status).toBe("PENDING");
    expect(after?.last_error?.toLowerCase()).toContain("http 500");
    expect(after?.retry_count).toBe(1);

    const opsLeft = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .count();
    expect(opsLeft).toBe(1);
  });

  it("T2 — HTTP 500 no limite: ERROR com Max retries", async () => {
    const txId = await createGesture("farm-500", [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-500-limit", fazenda_id: "farm-500" },
      },
    ]);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const gesture = await db.queue_gestures.get(txId);
      await processGesture(gesture!);
    }

    const terminal = await db.queue_gestures.get(txId);
    expect(terminal?.status).toBe("ERROR");
    expect(terminal?.sync_result).toBe("ERROR");
    expect(terminal?.last_error?.toLowerCase()).toContain(
      "max retries: http 500",
    );
  });

  it("T3/T6 — restart após HTTP 500 terminal: recovery para PENDING preservando identidade", async () => {
    const txId = await createGesture("farm-500", [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-500-recovery", fazenda_id: "farm-500" },
      },
    ]);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const gesture = await db.queue_gestures.get(txId);
      await processGesture(gesture!);
    }

    expect((await db.queue_gestures.get(txId))?.status).toBe("ERROR");

    const opsBefore = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    expect(opsBefore).toHaveLength(1);

    await recoverErroredGesturesOnce();

    const recovered = await db.queue_gestures.get(txId);
    expect(recovered?.client_tx_id).toBe(txId);
    expect(recovered?.status).toBe("PENDING");
    expect(recovered?.retry_count).toBe(0);
    expect(recovered?.last_error).toBe(
      "Recovered transient sync error; retrying after worker startup",
    );
    expect(recovered?.sync_result).toBeUndefined();
    expect(recovered?.completed_at).toBeUndefined();

    const opsAfter = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    expect(opsAfter.map((op) => op.client_op_id)).toEqual(
      opsBefore.map((op) => op.client_op_id),
    );
  });

  it("T4 — 502/503/504 continuam recuperáveis no startup", async () => {
    for (const status of [502, 503, 504]) {
      const txId = `tx-transient-${status}`;
      await db.queue_gestures.add({
        client_tx_id: txId,
        fazenda_id: "farm-500",
        client_id: "client-500",
        status: "ERROR",
        sync_result: "ERROR",
        completed_at: "2026-09-19T10:00:00.000Z",
        last_error: `Max retries: HTTP ${status} - transient`,
        retry_count: 3,
        created_at: "2026-09-19T09:59:00.000Z",
      });

      await recoverErroredGesturesOnce();

      expect(await db.queue_gestures.get(txId)).toMatchObject({
        status: "PENDING",
        retry_count: 0,
      });
    }
  });

  it("T5 — HTTP 403 permanece terminal e não recuperável", async () => {
    const txId = "tx-500-vs-403";
    await db.queue_gestures.add({
      client_tx_id: txId,
      fazenda_id: "farm-500",
      client_id: "client-500",
      status: "ERROR",
      sync_result: "ERROR",
      completed_at: "2026-09-19T10:00:00.000Z",
      last_error: "HTTP 403 - Forbidden - no access to this farm",
      retry_count: 0,
      created_at: "2026-09-19T09:59:00.000Z",
    });

    await recoverErroredGesturesOnce();

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
      retry_count: 0,
    });
  });
});
