import Dexie from "dexie";

import { db } from "./db";
import {
  getGestureSyncStage,
  type FarmSyncSummary,
} from "./syncPresentation";
import type { Gesture, GestureStatus } from "./types";

type GestureSnapshot = Pick<
  Gesture,
  "fazenda_id" | "status" | "sync_result" | "completed_at"
>;

export interface FarmOperationalGestureStats {
  successful: number;
  failed: number;
  backlog: number;
  processed: number;
  successRate: number;
  rejectionRate: number;
}

export const EMPTY_FARM_SYNC_SUMMARY: FarmSyncSummary = {
  savedLocalCount: 0,
  syncingCount: 0,
  pendingCount: 0,
  rejectionCount: 0,
  errorCount: 0,
  syncedAlteredCount: 0,
  lastCompletedStage: null,
};

export const EMPTY_FARM_OPERATIONAL_GESTURE_STATS: FarmOperationalGestureStats = {
  successful: 0,
  failed: 0,
  backlog: 0,
  processed: 0,
  successRate: 100,
  rejectionRate: 0,
};

const COMPLETED_GESTURE_STATUSES: GestureStatus[] = [
  "DONE",
  "SYNCED",
  "REJECTED",
  "ERROR",
];

async function countFarmGesturesByStatus(
  fazendaId: string,
  status: GestureStatus,
  predicate?: (gesture: Gesture) => boolean,
): Promise<number> {
  return db.queue_gestures
    .where("status")
    .equals(status)
    .and(
      (gesture) =>
        gesture.fazenda_id === fazendaId && (predicate ? predicate(gesture) : true),
    )
    .count();
}

async function getLatestCompletedGestureByStatus(
  fazendaId: string,
  status: GestureStatus,
): Promise<GestureSnapshot | null> {
  const gesture = await db.queue_gestures
    .where("[status+created_at]")
    .between([status, Dexie.minKey], [status, Dexie.maxKey], true, true)
    .reverse()
    .filter(
      (entry) => entry.fazenda_id === fazendaId && Boolean(entry.completed_at),
    )
    .first();

  if (!gesture) {
    return null;
  }

  return {
    fazenda_id: gesture.fazenda_id,
    status: gesture.status,
    sync_result: gesture.sync_result,
    completed_at: gesture.completed_at,
  };
}

export async function loadFarmSyncSummary(
  fazendaId: string | null | undefined,
): Promise<FarmSyncSummary> {
  if (!fazendaId) {
    return EMPTY_FARM_SYNC_SUMMARY;
  }

  const [
    savedLocalCount,
    syncingCount,
    errorCount,
    syncedAlteredCount,
    rejectionCount,
    ...latestCompletedCandidates
  ] = await Promise.all([
    countFarmGesturesByStatus(fazendaId, "PENDING"),
    countFarmGesturesByStatus(fazendaId, "SYNCING"),
    countFarmGesturesByStatus(fazendaId, "ERROR"),
    countFarmGesturesByStatus(
      fazendaId,
      "DONE",
      (gesture) => gesture.sync_result === "APPLIED_ALTERED",
    ),
    db.queue_rejections.where("fazenda_id").equals(fazendaId).count(),
    ...COMPLETED_GESTURE_STATUSES.map((status) =>
      getLatestCompletedGestureByStatus(fazendaId, status),
    ),
  ]);

  const latestCompletedGesture =
    latestCompletedCandidates
      .filter((gesture): gesture is GestureSnapshot => Boolean(gesture?.completed_at))
      .sort((left, right) =>
        (right.completed_at ?? "").localeCompare(left.completed_at ?? ""),
      )[0] ?? null;

  return {
    savedLocalCount,
    syncingCount,
    pendingCount: savedLocalCount + syncingCount,
    rejectionCount,
    errorCount,
    syncedAlteredCount,
    lastCompletedAt: latestCompletedGesture?.completed_at,
    lastCompletedStage: latestCompletedGesture
      ? getGestureSyncStage(latestCompletedGesture)
      : null,
  };
}

export async function loadFarmOperationalGestureStats(
  fazendaId: string | null | undefined,
): Promise<FarmOperationalGestureStats> {
  if (!fazendaId) {
    return EMPTY_FARM_OPERATIONAL_GESTURE_STATS;
  }

  const [doneCount, syncedCount, rejectedCount, errorCount, pendingCount, syncingCount] =
    await Promise.all([
      countFarmGesturesByStatus(fazendaId, "DONE"),
      countFarmGesturesByStatus(fazendaId, "SYNCED"),
      countFarmGesturesByStatus(fazendaId, "REJECTED"),
      countFarmGesturesByStatus(fazendaId, "ERROR"),
      countFarmGesturesByStatus(fazendaId, "PENDING"),
      countFarmGesturesByStatus(fazendaId, "SYNCING"),
    ]);

  const successful = doneCount + syncedCount;
  const failed = rejectedCount + errorCount;
  const backlog = pendingCount + syncingCount;
  const processed = successful + failed;

  return {
    successful,
    failed,
    backlog,
    processed,
    successRate: processed > 0 ? (successful / processed) * 100 : 100,
    rejectionRate: processed > 0 ? (failed / processed) * 100 : 0,
  };
}
