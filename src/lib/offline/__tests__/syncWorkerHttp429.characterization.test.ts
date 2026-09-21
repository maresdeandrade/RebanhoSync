/**
 * @vitest-environment jsdom
 *
 * F24.3A — caracterizacao da politica HTTP 429 no worker generico.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-429",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "user-429" },
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

import { db } from "../db";
import { createGesture } from "../ops";
import { seedLocalOwner } from "./ownershipTestFixture";
import { processGesture, recoverErroredGesturesOnce } from "../syncWorker";

function rateLimitedResponse() {
  return new Response(JSON.stringify({ error: "rate limited" }), {
    status: 429,
    headers: { "Retry-After": "120" },
  });
}

describe("F24.3A — HTTP 429 generic retry characterization", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => rateLimitedResponse()),
    );
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.local_ownership.clear(),
    ]);
    await seedLocalOwner("user-429");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.local_ownership.clear(),
    ]);
  });

  it("ignora Retry-After, permite retry imediato e termina em ERROR apos o limite", async () => {
    const txId = await createGesture("farm-429", [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-429", fazenda_id: "farm-429" },
      },
    ]);
    const opBefore = (await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .first())!;

    await processGesture((await db.queue_gestures.get(txId))!);
    await processGesture((await db.queue_gestures.get(txId))!);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
      retry_count: 2,
    });
    expect(
      (await db.queue_ops.get(opBefore.client_op_id))?.next_attempt_at,
    ).toBeUndefined();

    await processGesture((await db.queue_gestures.get(txId))!);
    await processGesture((await db.queue_gestures.get(txId))!);

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
      retry_count: 3,
      last_error: expect.stringContaining("Max retries: HTTP 429"),
    });

    await recoverErroredGesturesOnce();

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "ERROR",
      retry_count: 3,
    });
    expect(await db.queue_ops.get(opBefore.client_op_id)).toMatchObject({
      client_op_id: opBefore.client_op_id,
      client_tx_id: txId,
    });
  });
});
