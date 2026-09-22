/**
 * @vitest-environment jsdom
 *
 * F24.3B3 — reconnect sem restart depois de falha de transporte.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({
    data: {
      session: {
        access_token: "token-long-offline",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "user-long-offline" },
      },
    },
    error: null,
  })),
  pullInitialData: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: mocks.pullInitialData,
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/reproduction/remoteSync", () => ({
  pullReproductionDiagnosisState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { createGesture } from "../ops";
import { seedLocalOwner } from "./ownershipTestFixture";
import { processGesture, startSyncWorker, stopSyncWorker } from "../syncWorker";

async function flushWorkerStartup() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe("F24.3B3 — long offline reconnect", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "farm-long-offline",
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.local_ownership.clear(),
    ]);
    await seedLocalOwner("user-long-offline");
  });

  afterEach(async () => {
    stopSyncWorker();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.local_ownership.clear(),
    ]);
  });

  it("T6 — online recupera ERROR legado de transporte após startup recovery", async () => {
    startSyncWorker();
    await flushWorkerStartup();

    const txId = await createGesture("farm-long-offline", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-long-offline", fazenda_id: "farm-long-offline" },
      },
    ]);
    const opBefore = (await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .first())!;

    await db.queue_gestures.update(txId, {
      status: "ERROR",
      sync_result: "ERROR",
      completed_at: new Date().toISOString(),
      retry_count: 3,
      last_error: "Max retries: Failed to fetch",
    });
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "ERROR",
      retry_count: 3,
      last_error: expect.stringContaining("Max retries: Failed to fetch"),
    });

    vi.stubGlobal("fetch", vi.fn(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        ops: Array<{ client_op_id: string }>;
      };
      return new Response(
        JSON.stringify({
          results: body.ops.map((op) => ({
            op_id: op.client_op_id,
            client_op_id: op.client_op_id,
            status: "APPLIED",
          })),
        }),
        { status: 200 },
      );
    }));
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(async () => {
      expect((await db.queue_gestures.get(txId))?.status).toBe("DONE");
    });

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
      client_tx_id: txId,
    });
    expect(opBefore.client_tx_id).toBe(txId);
  });

  it("T7 — online não antecipa Retry-After futuro de HTTP 429", async () => {
    startSyncWorker();
    await flushWorkerStartup();
    const txId = await createGesture("farm-long-offline", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-rate-limit", fazenda_id: "farm-long-offline" },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          headers: { "Retry-After": "120" },
        }),
      ),
    );

    await processGesture((await db.queue_gestures.get(txId))!);
    const scheduledAt = (await db.queue_gestures.get(txId))?.next_attempt_at;
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      next_attempt_at: scheduledAt,
      last_error: expect.stringContaining("HTTP 429"),
    });
  });
});
