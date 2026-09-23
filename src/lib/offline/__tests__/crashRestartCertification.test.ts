/**
 * @vitest-environment jsdom
 *
 * F24.3C — crash/restart + heterogeneous queue certification.
 *
 * A reabertura de Dexie neste arquivo certifica persistencia local no mesmo
 * processo. Kill real do processo do browser pertence ao harness Playwright.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFarmId: "farm-f24-3c",
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
  pullReproductionDiagnosisState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/storage", () => ({
  getActiveFarmId: vi.fn(() => mocks.activeFarmId),
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: mocks.pullDataForFarm,
  pullInitialData: mocks.pullInitialData,
  pullSanitarioAgendaV2: mocks.pullSanitarioAgendaV2,
  pullSanitarioV2CutoverState: mocks.pullSanitarioV2CutoverState,
}));

vi.mock("@/lib/reproduction/remoteSync", () => ({
  pullReproductionDiagnosisState: mocks.pullReproductionDiagnosisState,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-f24-3c",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "user-f24-3c" },
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { createGesture } from "../ops";
import {
  listReconciliationObligations,
  upsertReconciliationObligations,
} from "../reconciliationObligations";
import {
  drainReconciliationObligations,
  processGesture,
  recoverErroredGesturesOnce,
  recoverStaleSyncingGesturesOnce,
} from "../syncWorker";
import { seedLocalOwner } from "./ownershipTestFixture";

const farmId = "farm-f24-3c";

async function reopenLocalDatabase() {
  db.close();
  await db.open();
}

function appliedResponseForRequest(init?: RequestInit) {
  const body = JSON.parse(String(init?.body)) as {
    ops: Array<{ client_op_id: string }>;
  };
  return new Response(
    JSON.stringify({
      results: body.ops.map((operation) => ({
        op_id: operation.client_op_id,
        client_op_id: operation.client_op_id,
        status: "APPLIED",
      })),
    }),
    { status: 200 },
  );
}

describe("F24.3C — crash/restart certification", () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
      db.state_lotes.clear(),
      db.event_eventos.clear(),
      db.event_eventos_financeiro.clear(),
      db.event_eventos_reproducao.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
    await seedLocalOwner("user-f24-3c");
    mocks.activeFarmId = farmId;
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(async () => {
    if (!db.isOpen()) await db.open();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.local_ownership.clear(),
      db.state_lotes.clear(),
      db.event_eventos.clear(),
      db.event_eventos_financeiro.clear(),
      db.event_eventos_reproducao.clear(),
      db.sync_reconcile_obligations.clear(),
    ]);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("C1 — PENDING e operacao persistem na reabertura sem regenerar identidade ou fabricar DONE", async () => {
    const clientTxId = "tx-f24-3c-pending";
    const clientOpId = "op-f24-3c-pending";

    await createGesture(
      farmId,
      [
        {
          table: "lotes",
          action: "INSERT",
          record: { id: "lote-f24-3c-pending", nome: "Lote persistido" },
        },
      ],
      { clientTxId, clientOpIds: [clientOpId] },
    );

    const gestureBefore = await db.queue_gestures.get(clientTxId);
    const operationBefore = await db.queue_ops.get(clientOpId);

    await reopenLocalDatabase();

    const gestureAfter = await db.queue_gestures.get(clientTxId);
    const operationAfter = await db.queue_ops.get(clientOpId);

    expect(gestureBefore).toMatchObject({
      client_tx_id: clientTxId,
      fazenda_id: farmId,
      status: "PENDING",
    });
    expect(gestureAfter).toEqual(gestureBefore);
    expect(gestureAfter?.status).not.toBe("DONE");
    expect(operationAfter).toEqual(operationBefore);
    expect(operationAfter).toMatchObject({
      client_tx_id: clientTxId,
      client_op_id: clientOpId,
    });
    expect(operationAfter?.sync_state).toBeUndefined();
    expect(await db.state_lotes.get("lote-f24-3c-pending")).toMatchObject({
      id: "lote-f24-3c-pending",
      fazenda_id: farmId,
      client_tx_id: clientTxId,
      client_op_id: clientOpId,
    });
  });

  it("C2 — SYNCING interrompido volta a PENDING com a mesma operacao e sem false DONE", async () => {
    const clientTxId = "tx-f24-3c-syncing";
    const clientOpId = "op-f24-3c-syncing";
    await createGesture(
      farmId,
      [{ table: "lotes", action: "INSERT", record: { id: "lote-syncing" } }],
      { clientTxId, clientOpIds: [clientOpId] },
    );
    await db.queue_gestures.update(clientTxId, { status: "SYNCING" });
    const operationBefore = await db.queue_ops.get(clientOpId);

    await reopenLocalDatabase();
    await expect(recoverStaleSyncingGesturesOnce()).resolves.toBe(1);

    expect(await db.queue_gestures.get(clientTxId)).toMatchObject({
      client_tx_id: clientTxId,
      status: "PENDING",
      last_error:
        "Recovered interrupted sync; retrying with persisted identity",
    });
    expect(await db.queue_ops.get(clientOpId)).toEqual(operationBefore);
  });

  it.each([500, 502, 503, 504])(
    "C3 — HTTP %i recuperavel permanece elegivel apos restart",
    async (status) => {
      const clientTxId = `tx-f24-3c-http-${status}`;
      const clientOpId = `op-f24-3c-http-${status}`;
      await createGesture(
        farmId,
        [
          {
            table: "lotes",
            action: "INSERT",
            record: { id: `lote-${status}` },
          },
        ],
        { clientTxId, clientOpIds: [clientOpId] },
      );
      await db.queue_gestures.update(clientTxId, {
        status: "ERROR",
        sync_result: "ERROR",
        completed_at: "2026-09-23T10:00:00.000Z",
        retry_count: 2,
        last_error: `HTTP ${status} - transient upstream failure`,
      });

      await reopenLocalDatabase();
      await recoverErroredGesturesOnce();

      expect(await db.queue_gestures.get(clientTxId)).toMatchObject({
        client_tx_id: clientTxId,
        status: "PENDING",
      });
      expect(await db.queue_ops.get(clientOpId)).toMatchObject({
        client_tx_id: clientTxId,
        client_op_id: clientOpId,
      });
    },
  );

  it("C4 — next_attempt_at e retry_count sobrevivem ao restart e impedem fetch antecipado", async () => {
    const now = Date.parse("2026-09-23T12:00:00.000Z");
    const nextAttemptAt = new Date(now + 60_000).toISOString();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const clientTxId = await createGesture(farmId, [
      { table: "lotes", action: "INSERT", record: { id: "lote-retry" } },
    ]);
    const operationBefore = await db.queue_ops
      .where("client_tx_id")
      .equals(clientTxId)
      .first();
    await db.queue_gestures.update(clientTxId, {
      retry_count: 3,
      next_attempt_at: nextAttemptAt,
      last_error: "HTTP 503 - retry scheduled",
    });

    await reopenLocalDatabase();
    await processGesture((await db.queue_gestures.get(clientTxId))!);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await db.queue_gestures.get(clientTxId)).toMatchObject({
      client_tx_id: clientTxId,
      status: "PENDING",
      retry_count: 3,
      next_attempt_at: nextAttemptAt,
    });
    expect(await db.queue_ops.get(operationBefore!.client_op_id)).toEqual(
      operationBefore,
    );
  });

  it("C5 — Retry-After persiste e restart/online nao antecipam a tentativa", async () => {
    const now = Date.parse("2026-09-23T12:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: { "Retry-After": "120" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const clientTxId = await createGesture(farmId, [
      { table: "lotes", action: "INSERT", record: { id: "lote-429-restart" } },
    ]);
    const operationBefore = await db.queue_ops
      .where("client_tx_id")
      .equals(clientTxId)
      .first();

    await processGesture((await db.queue_gestures.get(clientTxId))!);
    const scheduled = await db.queue_gestures.get(clientTxId);
    await reopenLocalDatabase();
    await processGesture((await db.queue_gestures.get(clientTxId))!);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.queue_gestures.get(clientTxId)).toEqual(scheduled);
    expect(Date.parse(scheduled!.next_attempt_at!)).toBeGreaterThanOrEqual(
      now + 120_000,
    );
    expect(await db.queue_ops.get(operationBefore!.client_op_id)).toEqual(
      operationBefore,
    );
  });

  it("C6 — obligation e generation_id sobrevivem ao restart e sao drenados uma vez", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);
    const obligationBefore = (await listReconciliationObligations(farmId))[0];

    await reopenLocalDatabase();
    const obligationAfter = (await listReconciliationObligations(farmId))[0];
    await drainReconciliationObligations(farmId);

    expect(obligationAfter).toEqual(obligationBefore);
    expect(obligationAfter.generation_id).toBe(obligationBefore.generation_id);
    expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(1);
    expect(await listReconciliationObligations(farmId)).toHaveLength(0);
    await drainReconciliationObligations(farmId);
    expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(1);
  });

  it("fila heterogenea/multi-farm — falha de um tipo nao corrompe progresso, identidade ou outra fazenda", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const farmA = "farm-f24-3c-a";
    const farmB = "farm-f24-3c-b";
    mocks.activeFarmId = farmB;
    const ids = {
      factual: ["tx-factual-a", "op-factual-a"],
      finance: ["tx-finance-a", "op-finance-a"],
      reproduction: ["tx-reproduction-b", "op-reproduction-b"],
    } as const;
    await createGesture(
      farmA,
      [{ table: "eventos", action: "INSERT", record: { id: "evento-a" } }],
      { clientTxId: ids.factual[0], clientOpIds: [ids.factual[1]] },
    );
    await createGesture(
      farmA,
      [
        {
          table: "eventos_financeiro",
          action: "INSERT",
          record: { evento_id: "evento-finance-a", valor: 10 },
        },
      ],
      { clientTxId: ids.finance[0], clientOpIds: [ids.finance[1]] },
    );
    await createGesture(
      farmB,
      [
        {
          table: "eventos_reproducao",
          action: "INSERT",
          record: { evento_id: "evento-reproduction-b", tipo: "diagnostico" },
        },
      ],
      {
        clientTxId: ids.reproduction[0],
        clientOpIds: [ids.reproduction[1]],
      },
    );
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_input, init) =>
        appliedResponseForRequest(init),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementationOnce(async (_input, init) =>
        appliedResponseForRequest(init),
      );
    vi.stubGlobal("fetch", fetchMock);

    await reopenLocalDatabase();
    for (const clientTxId of [
      ids.factual[0],
      ids.finance[0],
      ids.reproduction[0],
    ]) {
      await processGesture((await db.queue_gestures.get(clientTxId))!);
    }

    expect(await db.queue_gestures.get(ids.factual[0])).toMatchObject({
      client_tx_id: ids.factual[0],
      fazenda_id: farmA,
      status: "DONE",
    });
    expect(await db.queue_gestures.get(ids.finance[0])).toMatchObject({
      client_tx_id: ids.finance[0],
      fazenda_id: farmA,
      status: "PENDING",
      retry_count: 1,
    });
    expect(await db.queue_ops.get(ids.finance[1])).toMatchObject({
      client_tx_id: ids.finance[0],
      client_op_id: ids.finance[1],
    });
    expect(await db.queue_gestures.get(ids.reproduction[0])).toMatchObject({
      client_tx_id: ids.reproduction[0],
      fazenda_id: farmB,
      status: "DONE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ownership mismatch apos restart bloqueia replay, pull e reconciliation", async () => {
    const clientTxId = await createGesture(farmId, [
      { table: "lotes", action: "INSERT", record: { id: "lote-mismatch" } },
    ]);
    await db.local_ownership.clear();
    await seedLocalOwner("another-user");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await reopenLocalDatabase();
    await processGesture((await db.queue_gestures.get(clientTxId))!);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.pullDataForFarm).not.toHaveBeenCalled();
    expect(await db.queue_gestures.get(clientTxId)).toMatchObject({
      client_tx_id: clientTxId,
      status: "PENDING",
    });
  });
});
