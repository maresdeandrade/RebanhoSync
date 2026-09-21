/**
 * @vitest-environment jsdom
 *
 * F24.3A — reconnect sem restart depois de esgotar retries de transporte.
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
  await vi.waitFor(() => expect(mocks.pullInitialData).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("F24.3A — long offline reconnect characterization", () => {
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

  it("o evento online nao recupera ERROR de transporte quando startup recovery ja executou", async () => {
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

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await processGesture((await db.queue_gestures.get(txId))!);
    }
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "ERROR",
      retry_count: 3,
      last_error: expect.stringContaining("Max retries: Failed to fetch"),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ results: [] }), { status: 200 }),
      ),
    );
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "ERROR",
      retry_count: 3,
    });
    expect(await db.queue_ops.get(opBefore.client_op_id)).toMatchObject({
      client_tx_id: txId,
      client_op_id: opBefore.client_op_id,
    });
  });
});
