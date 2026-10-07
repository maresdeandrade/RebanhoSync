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
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";

describe("F24.3B3 — generic network retry", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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
    expect(persisted?.diagnostics?.last_failure).toMatchObject({
      code: "NETWORK_FAILURE", cause_code: "NETWORK_FAILURE", retry_count: 1,
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

  it.each([
    ["network", () => Promise.reject(new TypeError("Failed to fetch")), 0, "PENDING", "NETWORK_FAILURE", "NETWORK_FAILURE"],
    ["abort", () => Promise.reject(new DOMException("Aborted", "AbortError")), 0, "PENDING", "REQUEST_ABORTED", "REQUEST_ABORTED"],
    ["503", () => Promise.resolve(new Response("private response", { status: 503 })), 0, "PENDING", "HTTP_503", "HTTP_503"],
    ["403", () => Promise.resolve(new Response("private response", { status: 403 })), 0, "ERROR", "HTTP_403", "HTTP_403"],
    ["429 past max", () => Promise.resolve(new Response("private response", { status: 429 })), 10, "PENDING", "HTTP_429", "HTTP_429"],
    ["exhaustion", () => Promise.reject(new TypeError("Failed to fetch private response")), 10, "ERROR", "RETRY_EXHAUSTED", "NETWORK_FAILURE"],
  ])("observes %s without changing retry decisions or persisting response text", async (_name, fail, retryCount, status, code, cause) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(fail));
    const tx = await createGesture("farm-generic-retry", [{
      table: "lotes", action: "INSERT",
      record: { id: "failure-lot", fazenda_id: "farm-generic-retry" },
    }]);
    await db.queue_gestures.update(tx, { retry_count: retryCount });
    const op = (await db.queue_ops.where("client_tx_id").equals(tx).first())!;
    await processGesture((await db.queue_gestures.get(tx))!);
    const persisted = await db.queue_gestures.get(tx);
    expect(persisted?.status).toBe(status);
    expect(persisted?.diagnostics?.last_failure).toMatchObject({ code, cause_code: cause });
    expect(persisted?.diagnostics?.client_op_ids).toContain(op.client_op_id);
    const metric = vi.mocked(trackPilotMetric).mock.calls.find(([input]) => input.eventName === "sync_error")?.[0];
    expect(metric).toMatchObject({ fazendaId: "farm-generic-retry", reasonCode: code,
      payload: { client_tx_id: tx, client_op_ids: [op.client_op_id], cause_code: cause } });
    expect(JSON.stringify(metric)).not.toContain("private response");
    expect(JSON.stringify(persisted?.diagnostics)).not.toContain("private response");
    expect(await db.queue_ops.get(op.client_op_id)).toBeDefined();
  });
});
