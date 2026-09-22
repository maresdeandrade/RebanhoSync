/**
 * @vitest-environment jsdom
 *
 * F24.3B3 — política HTTP 429 no worker genérico.
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
import { processGesture } from "../syncWorker";

function rateLimitedResponse(retryAfter: string) {
  return new Response(JSON.stringify({ error: "rate limited" }), {
    status: 429,
    headers: { "Retry-After": retryAfter },
  });
}

async function createRateLimitedGesture() {
  const txId = await createGesture("farm-429", [
    {
      table: "lotes",
      action: "INSERT",
      record: { id: "lote-429", fazenda_id: "farm-429" },
    },
  ]);
  const op = (await db.queue_ops
    .where("client_tx_id")
    .equals(txId)
    .first())!;
  return { txId, op };
}

describe("F24.3B3 — HTTP 429 generic retry", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(Math, "random").mockReturnValue(0.5);
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

  it("T1 — respeita Retry-After delta-seconds e não tenta antes do prazo", async () => {
    const now = Date.parse("2026-09-22T12:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(fetch).mockResolvedValue(rateLimitedResponse("120"));
    const { txId, op } = await createRateLimitedGesture();

    await processGesture((await db.queue_gestures.get(txId))!);
    const scheduled = await db.queue_gestures.get(txId);
    expect(scheduled).toMatchObject({
      status: "PENDING",
      retry_count: 1,
      client_tx_id: txId,
    });
    expect(Date.parse(scheduled?.next_attempt_at ?? "")).toBeGreaterThanOrEqual(
      now + 120_000,
    );

    await processGesture((await db.queue_gestures.get(txId))!);
    expect(fetch).toHaveBeenCalledTimes(1);
    const opAfter = await db.queue_ops.get(op.client_op_id);
    expect(opAfter).toMatchObject({
      client_op_id: op.client_op_id,
      client_tx_id: txId,
    });
    expect(opAfter?.domain_op_id).toBe(op.domain_op_id);
  });

  it("T2 — respeita Retry-After em HTTP-date", async () => {
    const now = Date.parse("2026-09-22T12:00:00.000Z");
    const retryAt = now + 90_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(fetch).mockResolvedValue(
      rateLimitedResponse(new Date(retryAt).toUTCString()),
    );
    const { txId } = await createRateLimitedGesture();

    await processGesture((await db.queue_gestures.get(txId))!);

    expect(
      Date.parse((await db.queue_gestures.get(txId))?.next_attempt_at ?? ""),
    ).toBeGreaterThanOrEqual(retryAt);
  });

  it("T3 — Retry-After inválido cai no backoff genérico com jitter determinístico", async () => {
    const now = Date.parse("2026-09-22T12:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(fetch).mockResolvedValue(rateLimitedResponse("not-a-date"));
    const { txId } = await createRateLimitedGesture();

    await processGesture((await db.queue_gestures.get(txId))!);

    expect((await db.queue_gestures.get(txId))?.next_attempt_at).toBe(
      new Date(now + 5_000).toISOString(),
    );
  });
});
