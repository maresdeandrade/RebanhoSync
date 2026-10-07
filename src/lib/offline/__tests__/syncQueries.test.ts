/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import {
  EMPTY_FARM_OPERATIONAL_GESTURE_STATS,
  EMPTY_FARM_SYNC_SUMMARY,
  loadFarmOperationalGestureStats,
  loadFarmSyncSummary,
} from "../syncQueries";
import type { Gesture, Rejection } from "../types";
import { getFarmSyncHealth } from "../syncPresentation";

const FARM_A = "farm-sync-a";
const FARM_B = "farm-sync-b";

function makeGesture(
  fazendaId: string,
  overrides: Partial<Gesture> = {},
): Gesture {
  return {
    client_tx_id: overrides.client_tx_id ?? crypto.randomUUID(),
    fazenda_id: fazendaId,
    client_id: overrides.client_id ?? "client-1",
    status: overrides.status ?? "PENDING",
    sync_result: overrides.sync_result,
    completed_at: overrides.completed_at,
    last_error: overrides.last_error,
    retry_count: overrides.retry_count,
    created_at: overrides.created_at ?? "2026-04-07T08:00:00.000Z",
  };
}

function makeRejection(
  fazendaId: string,
  overrides: Partial<Rejection> = {},
): Omit<Rejection, "id"> {
  return {
    client_tx_id: overrides.client_tx_id ?? crypto.randomUUID(),
    client_op_id: overrides.client_op_id ?? crypto.randomUUID(),
    fazenda_id: fazendaId,
    table: overrides.table ?? "animais",
    action: overrides.action ?? "UPDATE",
    reason_code: overrides.reason_code ?? "ANTI_TELEPORTE",
    reason_message: overrides.reason_message ?? "Destino invalido",
    created_at: overrides.created_at ?? "2026-04-07T08:30:00.000Z",
  };
}

describe("syncQueries", () => {
  beforeEach(async () => {
    await db.queue_gestures.clear();
    await db.queue_rejections.clear();
    await db.sync_reconcile_obligations.clear();
  });

  afterEach(async () => {
    await db.queue_gestures.clear();
    await db.queue_rejections.clear();
    await db.sync_reconcile_obligations.clear();
  });

  it("builds per-farm sync summary from indexed gesture counts", async () => {
    await db.queue_gestures.bulkAdd([
      makeGesture(FARM_A, { status: "PENDING" }),
      makeGesture(FARM_A, { status: "SYNCING" }),
      makeGesture(FARM_A, {
        status: "DONE",
        sync_result: "APPLIED_ALTERED",
        completed_at: "2026-04-07T10:00:00.000Z",
        created_at: "2026-04-07T09:55:00.000Z",
      }),
      makeGesture(FARM_A, {
        status: "ERROR",
        sync_result: "ERROR",
        completed_at: "2026-04-07T09:00:00.000Z",
        created_at: "2026-04-07T08:50:00.000Z",
      }),
      makeGesture(FARM_B, {
        status: "PENDING",
      }),
    ]);

    await db.queue_rejections.bulkAdd([
      makeRejection(FARM_A),
      makeRejection(FARM_B),
    ]);

    const summary = await loadFarmSyncSummary(FARM_A);

    expect(summary.savedLocalCount).toBe(1);
    expect(summary.syncingCount).toBe(1);
    expect(summary.pendingCount).toBe(2);
    expect(summary.rejectionCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.syncedAlteredCount).toBe(1);
    expect(summary.lastCompletedAt).toBe("2026-04-07T10:00:00.000Z");
    expect(summary.lastCompletedStage).toBe("synced_altered");
  });

  it("computes operational gesture stats without mixing farms", async () => {
    await db.queue_gestures.bulkAdd([
      makeGesture(FARM_A, { status: "DONE", sync_result: "APPLIED" }),
      makeGesture(FARM_A, { status: "SYNCED" }),
      makeGesture(FARM_A, { status: "REJECTED", sync_result: "REJECTED" }),
      makeGesture(FARM_A, { status: "ERROR", sync_result: "ERROR" }),
      makeGesture(FARM_A, { status: "PENDING" }),
      makeGesture(FARM_A, { status: "SYNCING" }),
      makeGesture(FARM_B, { status: "DONE", sync_result: "APPLIED" }),
    ]);

    const stats = await loadFarmOperationalGestureStats(FARM_A);

    expect(stats.successful).toBe(2);
    expect(stats.failed).toBe(2);
    expect(stats.backlog).toBe(2);
    expect(stats.processed).toBe(4);
    expect(stats.successRate).toBe(50);
    expect(stats.rejectionRate).toBe(50);
  });

  it("returns empty defaults when no farm is active", async () => {
    await expect(loadFarmSyncSummary(null)).resolves.toEqual(
      EMPTY_FARM_SYNC_SUMMARY,
    );
    await expect(loadFarmOperationalGestureStats(undefined)).resolves.toEqual(
      EMPTY_FARM_OPERATIONAL_GESTURE_STATS,
    );
  });

  it("does not inherit errors or reconciliation across farms or A → B → A", async () => {
    await db.queue_gestures.add(makeGesture(FARM_A, { status: "ERROR" }));
    await db.sync_reconcile_obligations.put({
      key: `${FARM_A}:factual`,
      fazenda_id: FARM_A,
      scope: "factual",
      generation_id: "generation-a",
      created_at: "2026-10-07T10:00:00Z",
      updated_at: "2026-10-07T10:00:00Z",
    });
    for (const farm of [FARM_A, FARM_B, FARM_A]) {
      const summary = await loadFarmSyncSummary(farm);
      expect(summary.fazendaId).toBe(farm);
      expect(summary.errorCount).toBe(farm === FARM_A ? 1 : 0);
      expect(summary.reconcileCount).toBe(farm === FARM_A ? 1 : 0);
      expect(getFarmSyncHealth(summary).stage).toBe(
        farm === FARM_A ? "error" : "healthy",
      );
    }
  });

  it("keeps DONE with an empty functional queue unhealthy until its obligation is removed", async () => {
    await db.queue_gestures.add(
      makeGesture(FARM_A, { status: "DONE", sync_result: "APPLIED" }),
    );
    const key = `${FARM_A}:movement-v1`;
    await db.sync_reconcile_obligations.put({
      key,
      fazenda_id: FARM_A,
      scope: "movement-v1",
      generation_id: "generation-a",
      created_at: "2026-10-07T10:00:00Z",
      updated_at: "2026-10-07T10:00:00Z",
    });
    const summary = await loadFarmSyncSummary(FARM_A);
    expect(summary.pendingCount).toBe(0);
    expect(getFarmSyncHealth(summary).stage).toBe("reconcile");
    await db.sync_reconcile_obligations.delete(key);
    expect(getFarmSyncHealth(await loadFarmSyncSummary(FARM_A)).stage).toBe(
      "healthy",
    );
  });
});
