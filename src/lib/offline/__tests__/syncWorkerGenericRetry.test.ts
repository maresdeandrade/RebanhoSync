/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-generic-retry",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "user-generic-retry" },
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
import { processGesture } from "../syncWorker";
import { seedLocalOwner } from "./ownershipTestFixture";

describe("F24.3B3 — generic network retry", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.local_ownership.clear(),
    ]);
    await seedLocalOwner("user-generic-retry");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.local_ownership.clear(),
    ]);
  });

  it("T4/T5 — persiste backoff, não tenta cedo e reutiliza a mesma identidade", async () => {
    let now = Date.parse("2026-09-22T12:00:00.000Z");
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementationOnce(async (_input, init) => {
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
      });
    vi.stubGlobal("fetch", fetchMock);

    const txId = await createGesture("farm-generic-retry", [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-generic-retry", fazenda_id: "farm-generic-retry" },
      },
    ]);
    const opBefore = (await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .first())!;

    await processGesture((await db.queue_gestures.get(txId))!);
    const persisted = await db.queue_gestures.get(txId);
    expect(persisted).toMatchObject({
      status: "PENDING",
      retry_count: 1,
      next_attempt_at: new Date(now + 5_000).toISOString(),
    });

    await processGesture(persisted!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now = Date.parse(persisted!.next_attempt_at!);
    await processGesture((await db.queue_gestures.get(txId))!);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      client_tx_id: txId,
      status: "DONE",
    });
    expect(opBefore).toMatchObject({
      client_tx_id: txId,
      client_op_id: opBefore.client_op_id,
    });
  });
});
