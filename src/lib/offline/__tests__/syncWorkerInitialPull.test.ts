/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFarmId: "farm-runtime",
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullReproductionDiagnosisState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/storage", () => ({
  getActiveFarmId: vi.fn(() => mocks.activeFarmId),
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: mocks.pullDataForFarm,
  pullInitialData: mocks.pullInitialData,
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

vi.mock("@/lib/reproduction/remoteSync", () => ({
  pullReproductionDiagnosisState: mocks.pullReproductionDiagnosisState,
}));

import { supabase } from "@/lib/supabase";
import { db } from "../db";
import { establishLocalOwnership } from "../ownership";
import { upsertReconciliationObligations } from "../reconciliationObligations";
import {
  drainReconciliationObligations,
  processGesture,
  runInitialOfflinePullForActiveFarmOnce,
} from "../syncWorker";

const ownershipSession = (userId: string) =>
  ({ user: { id: userId } }) as Parameters<
    typeof establishLocalOwnership
  >[0];

const userId = "user-runtime";

describe("sync worker initial offline pull", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.activeFarmId = `farm-runtime-${crypto.randomUUID()}`;
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: userId }, access_token: "token" } },
      error: null,
    } as never);
    await Promise.all([
      db.local_ownership.clear(),
      db.queue_gestures.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
    await establishLocalOwnership(ownershipSession(userId));
  });

  it("executa pullInitialData para a fazenda ativa do runtime", async () => {
    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).toHaveBeenCalledTimes(1);
    expect(mocks.pullInitialData).toHaveBeenCalledWith(mocks.activeFarmId);
    expect(mocks.pullReproductionDiagnosisState).toHaveBeenCalledWith(
      mocks.activeFarmId,
    );
  });

  it("nao executa pull sem fazenda ativa", async () => {
    mocks.activeFarmId = "";

    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).not.toHaveBeenCalled();
    expect(mocks.pullReproductionDiagnosisState).not.toHaveBeenCalled();
  });

  it("mantem o pull inicial idempotente por fazenda no processo", async () => {
    await runInitialOfflinePullForActiveFarmOnce();
    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).toHaveBeenCalledTimes(1);
  });

  it("bloqueia pull quando ownership permanece desconhecida", async () => {
    await db.local_ownership.clear();

    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).not.toHaveBeenCalled();
    expect(mocks.pullReproductionDiagnosisState).not.toHaveBeenCalled();
  });

  it("bloqueia replay sem alterar o status da gesture quando ownership e desconhecida", async () => {
    await db.local_ownership.clear();
    await db.queue_gestures.put({
      client_tx_id: "tx-unknown-owner",
      client_id: "client-runtime",
      fazenda_id: mocks.activeFarmId,
      status: "PENDING",
      retry_count: 0,
      created_at: "2026-09-19T12:00:00.000Z",
    });

    const gesture = await db.queue_gestures.get("tx-unknown-owner");
    expect(gesture).toBeDefined();
    await processGesture(gesture!);

    await expect(db.queue_gestures.get("tx-unknown-owner")).resolves.toMatchObject({
      status: "PENDING",
      retry_count: 0,
    });
  });

  it("bloqueia replay quando a sessao pertence a outro usuario", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "user-b" }, access_token: "token-b" } },
      error: null,
    } as never);
    await db.queue_gestures.put({
      client_tx_id: "tx-mismatched-owner",
      client_id: "client-runtime",
      fazenda_id: mocks.activeFarmId,
      status: "PENDING",
      retry_count: 0,
      created_at: "2026-09-19T12:00:00.000Z",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const gesture = await db.queue_gestures.get("tx-mismatched-owner");
    expect(gesture).toBeDefined();
    await processGesture(gesture!);

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(db.queue_gestures.get("tx-mismatched-owner")).resolves.toMatchObject({
      status: "PENDING",
      retry_count: 0,
    });
  });

  it("bloqueia reconciliation quando ownership e desconhecida", async () => {
    await db.local_ownership.clear();
    await upsertReconciliationObligations([
      { fazendaId: mocks.activeFarmId, scope: "factual", tables: ["eventos"] },
    ]);

    await drainReconciliationObligations(mocks.activeFarmId);

    expect(mocks.pullDataForFarm).not.toHaveBeenCalled();
    await expect(db.sync_reconcile_obligations.count()).resolves.toBe(1);
  });
});
