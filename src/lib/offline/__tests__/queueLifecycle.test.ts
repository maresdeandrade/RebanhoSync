/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "../db";
import {
  inspectQueueLifecycleHealth,
  inspectOrphanedQueueOperations,
  removeVerifiedOrphanedQueueOperations,
} from "../queueLifecycle";
import type { Gesture, Operation } from "../types";

function operation(
  clientTxId: string,
  clientOpId: string,
  table = "lotes",
): Operation {
  return {
    client_tx_id: clientTxId,
    client_op_id: clientOpId,
    table,
    action: "INSERT",
    record: { id: `record-${clientOpId}`, fazenda_id: "farm-1" },
    created_at: "2026-08-22T10:00:00.000Z",
  };
}

function gesture(clientTxId: string, status: Gesture["status"]): Gesture {
  return {
    client_tx_id: clientTxId,
    fazenda_id: "farm-1",
    client_id: "client-1",
    status,
    created_at: "2026-08-22T10:00:00.000Z",
  };
}

describe("queue lifecycle", () => {
  beforeEach(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
    });
  });

  it("identifica fixture legada órfã sem classificar ops de gesto ativo como órfãs", async () => {
    await db.queue_gestures.add(gesture("tx-active", "PENDING"));
    await db.queue_ops.bulkAdd([
      operation("tx-active", "op-active"),
      operation("tx-orphan", "op-orphan-1"),
      operation("tx-orphan", "op-orphan-2", "pastos"),
    ]);

    await expect(inspectOrphanedQueueOperations()).resolves.toEqual([
      {
        clientTxId: "tx-orphan",
        operationCount: 2,
        tables: ["lotes", "pastos"],
        createdAt: ["2026-08-22T10:00:00.000Z"],
      },
    ]);
  });

  it("separa trabalho ativo, recovery/reconciliação e inconsistências reais", async () => {
    await db.queue_gestures.bulkAdd([
      gesture("tx-pending", "PENDING"),
      gesture("tx-error", "ERROR"),
      gesture("tx-rejected", "REJECTED"),
      gesture("tx-done", "DONE"),
    ]);
    await db.queue_ops.bulkAdd([
      operation("tx-pending", "op-pending"),
      operation("tx-error", "op-error"),
      operation("tx-rejected", "op-rejected"),
      operation("tx-done", "op-done-residual"),
      operation("tx-orphan", "op-orphan"),
    ]);

    await expect(inspectQueueLifecycleHealth()).resolves.toEqual({
      activeGestures: 1,
      retryOrReconciliationGestures: 2,
      doneGestures: 1,
      operationsForActiveGestures: 1,
      operationsForRetryOrReconciliation: 2,
      historicalOperations: 0,
      orphanOperations: 1,
      residualOperationsForDoneGestures: 1,
      syncBlockers: 4,
    });
  });

  it.each(["PENDING", "SYNCING", "ERROR", "REJECTED", "DONE"] as const)(
    "retém operações quando o gesto %s ainda existe",
    async (status) => {
      await db.queue_gestures.add(gesture("tx-retained", status));
      await db.queue_ops.add(operation("tx-retained", "op-retained"));

      const result = await removeVerifiedOrphanedQueueOperations([
        "tx-retained",
      ]);

      expect(result).toEqual({});
      expect(await db.queue_ops.get("op-retained")).toBeDefined();
    },
  );

  it("remove somente tx órfã verificada e preserva gesto/ops dependentes", async () => {
    await db.queue_gestures.add(gesture("tx-dependent", "ERROR"));
    await db.queue_ops.bulkAdd([
      operation("tx-verified", "op-verified-1"),
      operation("tx-verified", "op-verified-2"),
      operation("tx-dependent", "op-dependent"),
      operation("tx-unverified", "op-unverified"),
    ]);

    await expect(
      removeVerifiedOrphanedQueueOperations(["tx-verified", "tx-dependent"]),
    ).resolves.toEqual({ "tx-verified": 2 });
    expect(await db.queue_ops.toArray()).toEqual([
      operation("tx-dependent", "op-dependent"),
      operation("tx-unverified", "op-unverified"),
    ]);
  });

  it("é idempotente para tx já saneada", async () => {
    await db.queue_ops.add(operation("tx-legacy", "op-legacy"));

    await expect(
      removeVerifiedOrphanedQueueOperations(["tx-legacy", "tx-legacy"]),
    ).resolves.toEqual({ "tx-legacy": 1 });
    await expect(
      removeVerifiedOrphanedQueueOperations(["tx-legacy"]),
    ).resolves.toEqual({});
    expect(await db.queue_ops.count()).toBe(0);
  });
});
