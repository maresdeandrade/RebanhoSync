import { describe, expect, it } from "vitest";

import {
  buildFarmSyncSummary,
  getGestureSyncStage,
} from "@/lib/offline/syncPresentation";
import type { Gesture } from "@/lib/offline/types";

function makeGesture(
  overrides: Partial<Gesture> = {},
): Gesture {
  return {
    client_tx_id: overrides.client_tx_id ?? crypto.randomUUID(),
    fazenda_id: overrides.fazenda_id ?? "farm-1",
    client_id: overrides.client_id ?? "client-1",
    status: overrides.status ?? "PENDING",
    sync_result: overrides.sync_result,
    completed_at: overrides.completed_at,
    last_error: overrides.last_error,
    retry_count: overrides.retry_count,
    created_at: overrides.created_at ?? "2026-04-06T12:00:00.000Z",
  };
}

describe("syncPresentation", () => {
  it("maps local and server states to explicit sync stages", () => {
    expect(getGestureSyncStage(makeGesture({ status: "PENDING" }))).toBe(
      "local_pending",
    );
    expect(getGestureSyncStage(makeGesture({ status: "SYNCING" }))).toBe(
      "syncing",
    );
    expect(
      getGestureSyncStage(
        makeGesture({
          status: "DONE",
          sync_result: "APPLIED_ALTERED",
        }),
      ),
    ).toBe("synced_altered");
    expect(
      getGestureSyncStage(
        makeGesture({
          status: "REJECTED",
          sync_result: "REJECTED",
        }),
      ),
    ).toBe("rejected");
  });

  it("builds a farm summary that separates local queue from confirmed server state", () => {
    const summary = buildFarmSyncSummary(
      [
        makeGesture({ status: "PENDING" }),
        makeGesture({ status: "SYNCING" }),
        makeGesture({
          status: "DONE",
          sync_result: "APPLIED_ALTERED",
          completed_at: "2026-04-06T13:00:00.000Z",
        }),
        makeGesture({
          status: "ERROR",
          sync_result: "ERROR",
          completed_at: "2026-04-06T11:00:00.000Z",
        }),
      ],
      2,
    );

    expect(summary.savedLocalCount).toBe(1);
    expect(summary.syncingCount).toBe(1);
    expect(summary.pendingCount).toBe(2);
    expect(summary.rejectionCount).toBe(2);
    expect(summary.errorCount).toBe(1);
    expect(summary.syncedAlteredCount).toBe(1);
    expect(summary.lastCompletedAt).toBe("2026-04-06T13:00:00.000Z");
    expect(summary.lastCompletedStage).toBe("synced_altered");
  });
});
