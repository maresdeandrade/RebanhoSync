/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import type { Collection } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFarmId: null as string | null,
  sessionUserId: "user-reconnect-race" as string | null,
  authListeners: new Set<
    (event: string, session: { user: { id: string } } | null) => void
  >(),
}));

vi.mock("@/lib/storage", () => ({ getActiveFarmId: () => mocks.activeFarmId }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: mocks.sessionUserId
            ? {
                user: { id: mocks.sessionUserId },
                access_token: "test-session",
              }
            : null,
        },
        error: null,
      })),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn((callback) => {
        mocks.authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => mocks.authListeners.delete(callback),
            },
          },
        };
      }),
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
vi.mock("@/lib/reproduction/remoteSync", () => ({
  pullReproductionDiagnosisState: vi.fn(async () => undefined),
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { seedLocalOwner } from "./ownershipTestFixture";
import { startSyncWorker, stopSyncWorker } from "../syncWorker";
import type { Gesture, Operation } from "../types";

async function seedNetworkRetry() {
  const txId = crypto.randomUUID();
  const gesture: Gesture = {
    client_tx_id: txId,
    fazenda_id: "farm-reconnect-race",
    client_id: "client-reconnect-race",
    status: "PENDING",
    retry_count: 1,
    last_error: "Failed to fetch",
    next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
    created_at: new Date().toISOString(),
  };
  const operation: Operation = {
    client_tx_id: txId,
    client_op_id: crypto.randomUUID(),
    table: "lotes",
    action: "INSERT",
    record: { id: crypto.randomUUID(), fazenda_id: gesture.fazenda_id },
    sync_state: "PENDING",
    created_at: gesture.created_at,
  };
  await db.queue_gestures.put(gesture);
  await db.queue_ops.put(operation);
  return { gesture, operation };
}

// Keep the real IndexedDB queries and inject only a deterministic interleaving
// after the first pending snapshot. No worker/claim/retry logic is mocked.
function afterPendingSnapshot(txId: string, change: () => Promise<void>) {
  const prototype = Object.getPrototypeOf(db.queue_gestures.toCollection());
  const toArray = prototype.toArray;
  const sortBy = prototype.sortBy;
  let intercepted = false;
  let wakeReads = 0;
  vi.spyOn(prototype, "toArray").mockImplementation(async function (
    this: Collection<Gesture>,
  ) {
    const rows: Gesture[] = await toArray.call(this);
    if (
      !intercepted &&
      rows.some((row) => row.client_tx_id === txId && row.status === "PENDING")
    ) {
      intercepted = true;
      await change();
    }
    return rows;
  });
  vi.spyOn(prototype, "sortBy").mockImplementation(async function (
    this: Collection<Gesture>,
    key: string,
  ) {
    const rows: Gesture[] = await sortBy.call(this, key);
    if (key === "created_at") wakeReads += 1;
    return rows;
  });
  return { reads: () => wakeReads };
}

describe("B02 — reconnect retry race", () => {
  beforeEach(async () => {
    mocks.activeFarmId = null;
    mocks.sessionUserId = "user-reconnect-race";
    mocks.authListeners.clear();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("retry later", {
            status: 429,
            headers: { "Retry-After": "120" },
          }),
      ),
    );
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
      db.queue_rejections.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
    await seedLocalOwner("user-reconnect-race");
    // A persisted orphan provides a deterministic barrier for startup recovery.
    const startupId = crypto.randomUUID();
    await db.queue_gestures.put({
      client_tx_id: startupId,
      client_id: "startup",
      fazenda_id: "startup",
      status: "SYNCING",
      created_at: new Date().toISOString(),
    });
    startSyncWorker();
    await vi.waitFor(async () => {
      expect((await db.queue_gestures.get(startupId))?.status).toBe("ERROR");
    });
    await db.queue_gestures.delete(startupId);
  });

  afterEach(async () => {
    stopSyncWorker();
    expect(mocks.authListeners.size).toBe(0);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
      db.queue_rejections.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
  });

  it.each([429, 503])(
    "preserves a newer HTTP %i backoff from another reconnect",
    async (status) => {
      const { gesture, operation } = await seedNetworkRetry();
      vi.mocked(fetch).mockImplementation(
        async () =>
          new Response("retry later", {
            status,
            headers: { "Retry-After": "120" },
          }),
      );
      let newer: Gesture | undefined;
      const wake = afterPendingSnapshot(gesture.client_tx_id, async () => {
        // Reconnect A is paused. Reconnect B accelerates the old network retry,
        // then the actual worker receives a new rate-limit/server backoff.
        window.dispatchEvent(new Event("online"));
        await vi.waitFor(async () => {
          newer = await db.queue_gestures.get(gesture.client_tx_id);
          expect(newer).toMatchObject({ status: "PENDING", retry_count: 2 });
          expect(newer?.last_error).toContain(`HTTP ${status}`);
          // The worker records diagnostics after committing the retry. Wait for
          // that final write before capturing the full row that A must preserve.
          expect(newer?.diagnostics?.last_failure).toMatchObject({
            code: `HTTP_${status}`,
            retry_count: 2,
          });
        });
      });

      window.dispatchEvent(new Event("online"));
      await vi.waitFor(() => expect(wake.reads()).toBe(2));

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(newer);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    },
  );

  it.each<Partial<Gesture>>([
    { retry_count: 2 },
    { next_attempt_at: "2099-01-01T00:00:00.000Z" },
    { last_error: "HTTP 429 - retry later" },
  ])("preserves a concurrently replaced retry field: %j", async (changes) => {
    const { gesture, operation } = await seedNetworkRetry();
    const wake = afterPendingSnapshot(gesture.client_tx_id, async () => {
      await db.queue_gestures.update(gesture.client_tx_id, changes);
    });

    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(wake.reads()).toBe(1));

    expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual({
      ...gesture,
      ...changes,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
  });

  it.each(["SYNCING", "DONE", "REJECTED", "ERROR"] as const)(
    "does not process a gesture advanced concurrently to %s",
    async (status) => {
      const { gesture, operation } = await seedNetworkRetry();
      let current: Gesture | undefined;
      const wake = afterPendingSnapshot(gesture.client_tx_id, async () => {
        await db.queue_gestures.update(gesture.client_tx_id, {
          status,
          next_attempt_at: undefined,
        });
        current = await db.queue_gestures.get(gesture.client_tx_id);
      });

      window.dispatchEvent(new Event("online"));
      await vi.waitFor(() => expect(wake.reads()).toBe(1));

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
        current,
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    },
  );

  it.each([
    "signed out",
    "other session",
    "other owner",
    "missing owner",
    "other owner and session",
  ])("does not accelerate after a context change: %s", async (change) => {
    const { gesture, operation } = await seedNetworkRetry();
    const wake = afterPendingSnapshot(gesture.client_tx_id, async () => {
      if (change === "signed out") mocks.sessionUserId = null;
      if (change.includes("session")) mocks.sessionUserId = "user-other";
      if (change.includes("owner")) {
        if (change === "missing owner") await db.local_ownership.clear();
        else await seedLocalOwner("user-other");
      }
      if (change === "signed out" || change.includes("session")) {
        for (const listener of mocks.authListeners)
          listener(
            "SIGNED_IN",
            mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null,
          );
      }
    });

    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(wake.reads()).toBe(1));

    expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(gesture);
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
  });

  it.each([429, 503])(
    "does not accelerate an unchanged HTTP %i deadline",
    async (status) => {
      const { gesture, operation } = await seedNetworkRetry();
      const scheduled = {
        ...gesture,
        last_error: `HTTP ${status} - retry later`,
      };
      await db.queue_gestures.put(scheduled);
      const wake = afterPendingSnapshot(
        gesture.client_tx_id,
        async () => undefined,
      );

      window.dispatchEvent(new Event("online"));
      await vi.waitFor(() => expect(wake.reads()).toBe(1));

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
        scheduled,
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    },
  );

  it("accelerates the unchanged network retry and keeps its persisted farm/identities", async () => {
    const { gesture, operation } = await seedNetworkRetry();
    vi.mocked(fetch).mockResolvedValue(
      new Response("retry later", {
        status: 429,
        headers: { "Retry-After": "120" },
      }),
    );
    const wake = afterPendingSnapshot(gesture.client_tx_id, async () => {
      mocks.activeFarmId = "farm-other";
    });

    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(wake.reads()).toBe(1));
    await vi.waitFor(async () => {
      expect(await db.queue_gestures.get(gesture.client_tx_id)).toMatchObject({
        status: "PENDING",
        retry_count: 2,
        fazenda_id: gesture.fazenda_id,
      });
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      client_tx_id: gesture.client_tx_id,
      fazenda_id: gesture.fazenda_id,
    });
    expect(body.ops[0]).toMatchObject({
      client_op_id: operation.client_op_id,
      record: { fazenda_id: gesture.fazenda_id },
    });
    expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
  });

  it.each(["owner", "session"])(
    "rechecks %s after the last ownership/session query",
    async (change) => {
      const { gesture, operation } = await seedNetworkRetry();
      const getOwner = db.local_ownership.get.bind(db.local_ownership);
      let reads = 0;
      const wake = afterPendingSnapshot(gesture.client_tx_id, async () => {
        vi.spyOn(db.local_ownership, "get").mockImplementation(async (key) => {
          const owner = await getOwner(key);
          // Read 1 belongs to the per-gesture session check; read 2 is inside
          // the queue transaction, where session changes must also be observed.
          const atRead = change === "owner" ? 1 : 2;
          if (++reads === atRead) {
            if (change === "owner") await seedLocalOwner("user-other");
            else {
              mocks.sessionUserId = null;
              for (const listener of mocks.authListeners)
                listener("SIGNED_OUT", null);
            }
          }
          return owner;
        });
      });

      window.dispatchEvent(new Event("online"));
      await vi.waitFor(() => expect(wake.reads()).toBe(1));

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
        gesture,
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    },
  );

  it.each(["SIGNED_OUT", "TOKEN_REFRESHED"])(
    "handles %s while the acceleration write is pending",
    async (event) => {
      const { gesture, operation } = await seedNetworkRetry();
      const duringWrite = (changes: Partial<Gesture>, key: string) => {
        if (key !== gesture.client_tx_id || !("next_attempt_at" in changes))
          return;
        if (event === "SIGNED_OUT") mocks.sessionUserId = null;
        for (const listener of mocks.authListeners)
          listener(
            event,
            mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null,
          );
      };
      db.queue_gestures.hook("updating", duringWrite);
      try {
        const wake = afterPendingSnapshot(
          gesture.client_tx_id,
          async () => undefined,
        );
        window.dispatchEvent(new Event("online"));
        await vi.waitFor(() => expect(wake.reads()).toBe(1));

        if (event === "SIGNED_OUT") {
          expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
            gesture,
          );
          expect(fetch).not.toHaveBeenCalled();
        } else {
          await vi.waitFor(async () => {
            expect(
              await db.queue_gestures.get(gesture.client_tx_id),
            ).toMatchObject({ status: "PENDING", retry_count: 2 });
          });
          expect(fetch).toHaveBeenCalledTimes(1);
        }
        expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
          operation,
        );
      } finally {
        db.queue_gestures.hook("updating").unsubscribe(duringWrite);
      }
    },
  );
});
