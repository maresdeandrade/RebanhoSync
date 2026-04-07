import type { Gesture, Rejection } from "./types";

export type SyncStage =
  | "local_pending"
  | "syncing"
  | "synced"
  | "synced_altered"
  | "rejected"
  | "error";

export type SyncTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface FarmSyncSummary {
  savedLocalCount: number;
  syncingCount: number;
  pendingCount: number;
  rejectionCount: number;
  errorCount: number;
  syncedAlteredCount: number;
  lastCompletedAt?: string;
  lastCompletedStage: SyncStage | null;
}

export function getGestureSyncStage(
  gesture?: Pick<Gesture, "status" | "sync_result"> | null,
): SyncStage {
  if (!gesture) return "synced";

  if (gesture.status === "REJECTED" || gesture.sync_result === "REJECTED") {
    return "rejected";
  }

  if (gesture.status === "ERROR" || gesture.sync_result === "ERROR") {
    return "error";
  }

  if (gesture.status === "SYNCING") {
    return "syncing";
  }

  if (gesture.status === "PENDING") {
    return "local_pending";
  }

  if (gesture.sync_result === "APPLIED_ALTERED") {
    return "synced_altered";
  }

  return "synced";
}

export function getSyncStageLabel(stage: SyncStage): string {
  switch (stage) {
    case "local_pending":
      return "Salvo localmente";
    case "syncing":
      return "Sincronizando";
    case "synced":
      return "Sincronizado";
    case "synced_altered":
      return "Confirmado com ajuste";
    case "rejected":
      return "Rejeitado";
    case "error":
      return "Erro de sync";
  }
}

export function getSyncStageTone(stage: SyncStage): SyncTone {
  switch (stage) {
    case "synced":
      return "success";
    case "syncing":
      return "info";
    case "local_pending":
    case "synced_altered":
      return "warning";
    case "rejected":
    case "error":
      return "danger";
  }
}

export function buildFarmSyncSummary(
  gestures: Gesture[],
  rejections: number | Rejection[],
): FarmSyncSummary {
  const rejectionCount = Array.isArray(rejections) ? rejections.length : rejections;
  const summary: FarmSyncSummary = {
    savedLocalCount: 0,
    syncingCount: 0,
    pendingCount: 0,
    rejectionCount,
    errorCount: 0,
    syncedAlteredCount: 0,
    lastCompletedStage: null,
  };

  let latestCompletedGesture: Gesture | null = null;

  for (const gesture of gestures) {
    const stage = getGestureSyncStage(gesture);

    if (stage === "local_pending") {
      summary.savedLocalCount += 1;
    }

    if (stage === "syncing") {
      summary.syncingCount += 1;
    }

    if (stage === "error") {
      summary.errorCount += 1;
    }

    if (stage === "synced_altered") {
      summary.syncedAlteredCount += 1;
    }

    if (
      gesture.completed_at &&
      (!latestCompletedGesture ||
        gesture.completed_at > (latestCompletedGesture.completed_at ?? ""))
    ) {
      latestCompletedGesture = gesture;
    }
  }

  summary.pendingCount = summary.savedLocalCount + summary.syncingCount;
  summary.lastCompletedAt = latestCompletedGesture?.completed_at;
  summary.lastCompletedStage = latestCompletedGesture
    ? getGestureSyncStage(latestCompletedGesture)
    : null;

  return summary;
}
