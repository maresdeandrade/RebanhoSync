/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authListeners = vi.hoisted(
  () =>
    new Set<
      (event: string, session: { user: { id: string } } | null) => void
    >(),
);

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: { user: { id: "user-sync-worker-recovery" } },
        },
        error: null,
      })),
      onAuthStateChange: vi.fn((callback) => {
        authListeners.add(callback);
        return {
          data: {
            subscription: { unsubscribe: () => authListeners.delete(callback) },
          },
        };
      }),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import {
  getActiveFarmId,
  removeActiveFarmId,
  setActiveFarmId,
} from "@/lib/storage";
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

function sessionResult(userId: string | null = "user-sync-worker-recovery") {
  return {
    data: { session: userId ? { user: { id: userId } } : null },
    error: null,
  };
}

async function seedRecoveryCandidate() {
  const gesture = makeGesture({
    client_tx_id: "tx-review-recovery",
    last_error: "HTTP 503 - unavailable",
  });
  const operation: Operation = {
    client_tx_id: gesture.client_tx_id,
    client_op_id: "op-review-recovery",
    table: "lotes",
    action: "INSERT",
    record: { id: "lote-review", fazenda_id: gesture.fazenda_id },
    sync_state: "PENDING",
    created_at: gesture.created_at,
  };
  await db.queue_gestures.bulkAdd([
    gesture,
    makeGesture({
      client_tx_id: "tx-review-auth-check",
      last_error: "HTTP 401 - Invalid JWT",
    }),
  ]);
  await db.queue_ops.add(operation);
  return { gesture, operation };
}

function duringRecoveryAuth(change: () => Promise<void>) {
  vi.mocked(supabase.auth.getSession)
    .mockResolvedValueOnce(sessionResult() as never)
    .mockImplementationOnce(async () => {
      await change();
      return sessionResult() as never;
    });
}

describe("syncWorker recovery", () => {
  beforeEach(async () => {
    authListeners.clear();
    vi.mocked(supabase.auth.getSession).mockReset();
    vi.mocked(supabase.auth.getSession).mockResolvedValue(
      sessionResult() as never,
    );
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
    ]);
    await seedLocalOwner("user-sync-worker-recovery");
  });

  afterEach(async () => {
    expect(authListeners.size).toBe(0);
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
    ]);
    removeActiveFarmId();
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

  describe.each(["HTTP 503 - unavailable", "HTTP 401 - Invalid JWT"])(
    "stale recovery snapshot (%s)",
    (lastError) => {
      it.each<Partial<Gesture>>([
        { status: "SYNCING", last_error: undefined },
        {
          status: "PENDING",
          retry_count: 2,
          next_attempt_at: "2099-01-01T00:00:00.000Z",
          last_error: "HTTP 503 - retry scheduled by another worker",
        },
        { status: "REJECTED", last_error: "VALIDATION_ERROR" },
        { status: "ERROR", last_error: "HTTP 403 - Forbidden" },
      ])(
        "preserves concurrent state $status / $last_error",
        async (changes) => {
          const txId = "tx-concurrent-recovery";
          const operation: Operation = {
            client_tx_id: txId,
            client_op_id: "op-concurrent-recovery",
            table: "lotes",
            action: "INSERT",
            record: { id: "lote-concurrent", fazenda_id: "farm-1" },
            sync_state: "PENDING",
            created_at: "2026-05-01T09:59:00.000Z",
          };
          await db.queue_gestures.bulkAdd([
            makeGesture({ client_tx_id: txId, last_error: lastError }),
            // Forces an async session check after reading the ERROR snapshot,
            // including when the candidate itself is a transport failure.
            makeGesture({
              client_tx_id: "tx-auth-session-check",
              last_error: "HTTP 401 - Invalid JWT",
            }),
          ]);
          await db.queue_ops.add(operation);

          const sessionResult = {
            data: { session: { user: { id: "user-sync-worker-recovery" } } },
            error: null,
          };
          let concurrentState: Gesture | undefined;
          vi.mocked(supabase.auth.getSession)
            .mockResolvedValueOnce(sessionResult as never)
            .mockImplementationOnce(async () => {
              // Another tab advances the gesture while recovery awaits auth.
              // Queue reads/writes still use real Dexie + fake IndexedDB.
              await db.queue_gestures.update(txId, changes);
              concurrentState = await db.queue_gestures.get(txId);
              return sessionResult as never;
            });

          await recoverErroredGesturesOnce();

          expect(concurrentState).toBeDefined();
          expect(await db.queue_gestures.get(txId)).toEqual(concurrentState);
          expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
            operation,
          );
        },
      );
    },
  );

  describe("B01 review", () => {
    it.each<Partial<Gesture>>([
      { retry_count: 3 },
      { next_attempt_at: "2099-01-01T00:00:00.000Z" },
      { completed_at: "2026-05-01T10:01:00.000Z" },
    ])(
      "preserves a newer ERROR attempt with unchanged error: %j",
      async (changes) => {
        const { gesture, operation } = await seedRecoveryCandidate();
        duringRecoveryAuth(async () => {
          await db.queue_gestures.update(gesture.client_tx_id, changes);
        });

        await recoverErroredGesturesOnce();

        expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual({
          ...gesture,
          ...changes,
        });
        expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
          operation,
        );
      },
    );

    it.each([
      "missing owner",
      "other owner",
      "other session",
      "signed out",
      "other owner and session",
    ])("does not requeue after context changes: %s", async (change) => {
      const { gesture, operation } = await seedRecoveryCandidate();
      duringRecoveryAuth(async () => {
        if (change === "missing owner") await db.local_ownership.clear();
        if (change.includes("other owner")) await seedLocalOwner("user-other");
        if (change.includes("session") || change === "signed out") {
          vi.mocked(supabase.auth.getSession).mockResolvedValue(
            sessionResult(
              change === "signed out" ? null : "user-other",
            ) as never,
          );
        }
      });

      await recoverErroredGesturesOnce();

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
        gesture,
      );
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    });

    it("preserves an ACK committed while recovery awaits authentication", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      const acknowledged = {
        status: "DONE",
        sync_result: "APPLIED",
        last_error: undefined,
      } as const;
      duringRecoveryAuth(async () => {
        await db.transaction(
          "rw",
          [db.queue_gestures, db.queue_ops],
          async () => {
            await db.queue_gestures.update(gesture.client_tx_id, acknowledged);
            await db.queue_ops.delete(operation.client_op_id);
          },
        );
      });

      await recoverErroredGesturesOnce();

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual({
        ...gesture,
        ...acknowledged,
      });
      expect(await db.queue_ops.get(operation.client_op_id)).toBeUndefined();
    });

    it("does not fabricate a completed gesture when no operation remains", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      await db.queue_ops.delete(operation.client_op_id);

      await recoverErroredGesturesOnce();

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
        gesture,
      );
    });

    it("does not requeue a forbidden gesture even with persisted operations", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      const forbidden = { ...gesture, last_error: "HTTP 403 - Forbidden" };
      await db.queue_gestures.put(forbidden);

      await recoverErroredGesturesOnce();

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
        forbidden,
      );
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    });

    it("rechecks persisted ownership after the last session/ownership read", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      const readOwnership = db.local_ownership.get.bind(db.local_ownership);
      let ownershipReads = 0;
      const ownershipSpy = vi
        .spyOn(db.local_ownership, "get")
        .mockImplementation(async (key) => {
          const owner = await readOwnership(key);
          // The initial guard and the per-gesture guard see user A. Another
          // context switches the persisted owner before recovery enters its tx.
          if (++ownershipReads === 2) await seedLocalOwner("user-other");
          return owner;
        });

      try {
        await recoverErroredGesturesOnce();

        expect(ownershipReads).toBeGreaterThanOrEqual(3);
        expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
          gesture,
        );
        expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
          operation,
        );
      } finally {
        ownershipSpy.mockRestore();
      }
    });

    it.each(["SIGNED_OUT", "SIGNED_IN"])(
      "does not requeue if %s changes the user during the queue transaction",
      async (event) => {
        const { gesture, operation } = await seedRecoveryCandidate();
        const readOwnership = db.local_ownership.get.bind(db.local_ownership);
        let ownershipReads = 0;
        const ownershipSpy = vi
          .spyOn(db.local_ownership, "get")
          .mockImplementation(async (key) => {
            const owner = await readOwnership(key);
            if (++ownershipReads === 3) {
              const changedSession = sessionResult(
                event === "SIGNED_OUT" ? null : "user-other",
              );
              vi.mocked(supabase.auth.getSession).mockResolvedValue(
                changedSession as never,
              );
              for (const listener of authListeners)
                listener(event, changedSession.data.session);
            }
            return owner;
          });

        try {
          await recoverErroredGesturesOnce();

          expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
            gesture,
          );
          expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
            operation,
          );
        } finally {
          ownershipSpy.mockRestore();
        }
      },
    );

    it("preserves the queue and propagates a failed recovery write", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      const failRecovery = (changes: Partial<Gesture>, key: string) => {
        if (key === gesture.client_tx_id && changes.status === "PENDING") {
          throw new Error("RECOVERY_STORAGE_FAILURE");
        }
      };
      db.queue_gestures.hook("updating", failRecovery);
      try {
        await expect(recoverErroredGesturesOnce()).rejects.toThrow(
          "RECOVERY_STORAGE_FAILURE",
        );
        expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
          gesture,
        );
        expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
          operation,
        );
      } finally {
        db.queue_gestures.hook("updating").unsubscribe(failRecovery);
      }
    });

    it("rolls back the requeue if sign-out occurs while the write is pending", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      const signOutDuringWrite = (changes: Partial<Gesture>, key: string) => {
        if (key === gesture.client_tx_id && changes.status === "PENDING") {
          vi.mocked(supabase.auth.getSession).mockResolvedValue(
            sessionResult(null) as never,
          );
          for (const listener of authListeners) listener("SIGNED_OUT", null);
        }
      };
      db.queue_gestures.hook("updating", signOutDuringWrite);
      try {
        await recoverErroredGesturesOnce();

        expect(await db.queue_gestures.get(gesture.client_tx_id)).toEqual(
          gesture,
        );
        expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
          operation,
        );
      } finally {
        db.queue_gestures.hook("updating").unsubscribe(signOutDuringWrite);
      }
    });

    it("allows token refresh for the same user during recovery", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      const refreshDuringWrite = () => {
        for (const listener of authListeners)
          listener("TOKEN_REFRESHED", sessionResult().data.session);
      };
      db.queue_gestures.hook("updating", refreshDuringWrite);
      try {
        await recoverErroredGesturesOnce();

        expect(await db.queue_gestures.get(gesture.client_tx_id)).toMatchObject(
          { status: "PENDING" },
        );
        expect(await db.queue_ops.get(operation.client_op_id)).toEqual(
          operation,
        );
      } finally {
        db.queue_gestures.hook("updating").unsubscribe(refreshDuringWrite);
      }
    });

    it("keeps the persisted farm when the active farm switches during auth", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();
      setActiveFarmId(gesture.fazenda_id);
      duringRecoveryAuth(async () => {
        setActiveFarmId("farm-other");
      });

      await recoverErroredGesturesOnce();

      expect(getActiveFarmId()).toBe("farm-other");
      expect(await db.queue_gestures.get(gesture.client_tx_id)).toMatchObject({
        status: "PENDING",
        fazenda_id: gesture.fazenda_id,
        client_tx_id: gesture.client_tx_id,
      });
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
    });

    it("preserves work when concurrent recovery calls reenter", async () => {
      const { gesture, operation } = await seedRecoveryCandidate();

      await Promise.all([
        recoverErroredGesturesOnce(),
        recoverErroredGesturesOnce(),
      ]);

      expect(await db.queue_gestures.get(gesture.client_tx_id)).toMatchObject({
        status: "PENDING",
        retry_count: 0,
        client_tx_id: gesture.client_tx_id,
      });
      expect(await db.queue_ops.get(operation.client_op_id)).toEqual(operation);
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
