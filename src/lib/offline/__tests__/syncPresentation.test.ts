import { describe, expect, it } from "vitest";

import {
  buildFarmSyncSummary,
  getGestureSyncStage,
  getFarmSyncHealth,
  selectFarmSyncSummary,
} from "@/lib/offline/syncPresentation";
import { EMPTY_FARM_SYNC_SUMMARY } from "../syncQueries";
import type { Gesture } from "@/lib/offline/types";

function makeGesture(overrides: Partial<Gesture> = {}): Gesture {
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
  it.each([
    [{}, "healthy", "Em dia"],
    [{ errorCount: 1 }, "error", "Erro de sincronização"],
    [{ reconcileCount: 1 }, "reconcile", "Reconciliação pendente"],
    [{ syncingCount: 1 }, "syncing", "Sincronizando"],
    [{ savedLocalCount: 1 }, "pending", "Salvo localmente"],
    [
      { errorCount: 1, reconcileCount: 1, syncingCount: 1 },
      "error",
      "Erro de sincronização",
    ],
    [
      { reconcileCount: 1, syncingCount: 1, savedLocalCount: 1 },
      "reconcile",
      "Reconciliação pendente",
    ],
    [{ syncingCount: 1, savedLocalCount: 1 }, "syncing", "Sincronizando"],
    [{ rejectionCount: 1, errorCount: 1 }, "rejected", "Revisão necessária"],
    [
      { lastCompletedStage: "synced_altered" as const },
      "altered",
      "Confirmado com ajuste",
    ],
  ])("projects priority for %j", (counts, stage, label) => {
    expect(
      getFarmSyncHealth({ ...EMPTY_FARM_SYNC_SUMMARY, ...counts }),
    ).toMatchObject({ stage, label });
  });

  it("does not show another farm's stale snapshot or an unloaded summary as healthy", () => {
    const summary = { ...EMPTY_FARM_SYNC_SUMMARY, fazendaId: "farm-a" };
    expect(selectFarmSyncSummary(summary, "farm-a")).toBe(summary);
    expect(
      getFarmSyncHealth(selectFarmSyncSummary(summary, "farm-b")).stage,
    ).toBe("checking");
    expect(getFarmSyncHealth(selectFarmSyncSummary(summary, null)).stage).toBe(
      "checking",
    );
    expect(getFarmSyncHealth(undefined).stage).toBe("checking");
  });
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
