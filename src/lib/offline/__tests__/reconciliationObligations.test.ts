/**
 * @vitest-environment jsdom
 *
 * F24.2C3B — durable reconciliation obligations.
 * Uses fake-indexeddb for real Dexie operations (no fragile mocks).
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFarmId: "farm-c3b-active",
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
  pullDataForFarm: mocks.pullDataForFarm,
  pullInitialData: mocks.pullInitialData,
  pullSanitarioAgendaV2: mocks.pullSanitarioAgendaV2,
  pullSanitarioV2CutoverState: mocks.pullSanitarioV2CutoverState,
  DEFAULT_REMOTE_TABLES: ["eventos", "agenda_itens"],
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
            user: { id: "user-c3b" },
            access_token: "token-c3b",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "../db";
import { createGesture } from "../ops";
import { establishLocalOwnership } from "../ownership";
import {
  deleteReconciliationObligationIfGenerationMatches,
  listReconciliationObligations,
  reconciliationObligationKey,
  upsertReconciliationObligations,
} from "../reconciliationObligations";
import {
  drainReconciliationObligations,
  processGesture,
  startSyncWorker,
  stopSyncWorker,
} from "../syncWorker";
import type { ReconciliationObligation } from "../reconciliationTypes";

const farmId = "10000000-0000-4000-8000-000000000001";
const otherFarmId = "10000000-0000-4000-8000-000000000002";
const eventId = "40000000-0000-4000-8000-000000000001";
const txId = "50000000-0000-4000-8000-000000000001";
const opIds = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
];

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.event_eventos,
      db.event_eventos_pesagem,
      db.queue_gestures,
      db.queue_ops,
      db.sync_reconcile_obligations,
      db.local_ownership,
    ],
    async () => {
      await db.event_eventos.clear();
      await db.event_eventos_pesagem.clear();
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
      await db.sync_reconcile_obligations.clear();
      await db.local_ownership.clear();
    },
  );
}

async function seedWeightGesture() {
  const built = buildEventGesture({
    dominio: "pesagem",
    fazendaId: farmId,
    eventId,
    animalId: "20000000-0000-4000-8000-000000000001",
    occurredAt: "2026-09-18T12:00:00.000Z",
    sourceTaskId: null,
    pesoKg: 250.5,
    observacoes: "F24.2C3B reconciliation obligation",
    payload: { source: "f24_2c3b" },
  });
  await createGesture(farmId, built.ops, {
    clientTxId: txId,
    clientOpIds: opIds,
  });
}

function appliedResponse() {
  return new Response(
    JSON.stringify({
      results: opIds.map((opId) => ({ op_id: opId, status: "APPLIED" })),
    }),
    { status: 200 },
  );
}

async function loadGesture() {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error("gesture not found");
  return gesture;
}

async function getObligation(
  farm: string,
  scope: "factual" | "sanitario-v2" | "agenda-v2" | "reproduction",
): Promise<ReconciliationObligation | undefined> {
  return db.sync_reconcile_obligations.get(
    reconciliationObligationKey(farm, scope),
  );
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("reconciliation obligations store", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearStores();
  });

  afterEach(async () => {
    await clearStores();
  });

  it("upsert deduplica por fazenda+scope e faz merge das tabelas (T9)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);
    await upsertReconciliationObligations([
      {
        fazendaId: farmId,
        scope: "factual",
        tables: ["eventos", "agenda_itens"],
      },
    ]);

    const all = await listReconciliationObligations(farmId);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      fazenda_id: farmId,
      scope: "factual",
      tables: ["agenda_itens", "eventos"],
    });
  });

  it("cada upsert gera um novo generation_id (T13)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);
    const first = await getObligation(farmId, "factual");
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["agenda_itens"] },
    ]);
    const second = await getObligation(farmId, "factual");

    expect(first?.generation_id).toBeTruthy();
    expect(second?.generation_id).toBeTruthy();
    expect(second?.generation_id).not.toBe(first?.generation_id);
    expect(second?.created_at).toBe(first?.created_at);
  });

  it("conditional delete remove somente o generation observado", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "agenda-v2" },
    ]);
    const loaded = await getObligation(farmId, "agenda-v2");
    expect(loaded).toBeDefined();

    const deleted = await deleteReconciliationObligationIfGenerationMatches(
      loaded!.key,
      loaded!.generation_id,
    );
    expect(deleted).toBe(true);
    expect(await getObligation(farmId, "agenda-v2")).toBeUndefined();
  });

  it("conditional delete com generation antigo preserva a obrigacao nova (T13)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "agenda-v2" },
    ]);
    const stale = await getObligation(farmId, "agenda-v2");
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "agenda-v2" },
    ]);
    const fresh = await getObligation(farmId, "agenda-v2");

    const deleted = await deleteReconciliationObligationIfGenerationMatches(
      stale!.key,
      stale!.generation_id,
    );
    expect(deleted).toBe(false);
    expect(
      (await getObligation(farmId, "agenda-v2"))?.generation_id,
    ).toBe(fresh?.generation_id);
  });

  it("list isola obrigacoes por fazenda (secao 15)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual" },
      { fazendaId: otherFarmId, scope: "factual" },
    ]);

    const farmA = await listReconciliationObligations(farmId);
    const farmB = await listReconciliationObligations(otherFarmId);
    expect(farmA.map((o) => o.fazenda_id)).toEqual([farmId]);
    expect(farmB.map((o) => o.fazenda_id)).toEqual([otherFarmId]);
  });
});

describe("sync worker reconciliation drain", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await clearStores();
    await establishLocalOwnership({ user: { id: "user-c3b" } });
  });

  afterEach(async () => {
    stopSyncWorker();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await clearStores();
  });

  it("ACK allApplied persiste obligation factual na mesma fronteira e deriva as mesmas tabelas do pull (T1)", async () => {
    await seedWeightGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());

    await processGesture(await loadGesture());

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
    });
    const obligation = await getObligation(farmId, "factual");
    expect(obligation).toBeDefined();

    const [, pulledTables] = vi.mocked(mocks.pullDataForFarm).mock.calls[0];
    expect(new Set(pulledTables as string[])).toEqual(
      new Set(obligation?.tables),
    );
    expect(new Set(obligation?.tables)).toEqual(
      new Set(["eventos", "eventos_sanitario", "agenda_itens", "eventos_pesagem"]),
    );
  });

  it("falha na escrita da obligation aborta o ACK terminal (secao 17)", async () => {
    await seedWeightGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());
    vi.spyOn(db.sync_reconcile_obligations, "put").mockRejectedValueOnce(
      new Error("OBLIGATION_WRITE_INJECTED_FAILURE"),
    );

    await processGesture(await loadGesture());

    const gesture = await db.queue_gestures.get(txId);
    expect(gesture?.status).not.toBe("DONE");
    expect(
      await db.queue_ops.where("client_tx_id").equals(txId).count(),
    ).toBe(2);
    expect(await listReconciliationObligations(farmId)).toHaveLength(0);
  });

  it("pull pos-ACK falhou: gesture permanece DONE e obligation permanece (T3/T12)", async () => {
    await seedWeightGesture();
    vi.mocked(fetch).mockResolvedValue(appliedResponse());
    mocks.pullDataForFarm.mockRejectedValueOnce(new Error("Failed to fetch"));

    await processGesture(await loadGesture());

    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
    });
    expect(await getObligation(farmId, "factual")).toBeDefined();
    expect(
      await db.queue_ops.where("client_tx_id").equals(txId).count(),
    ).toBe(0);
  });

  it("obligation persistida sobrevive a crash e e drenada no restart (T2/T4/T8)", async () => {
    await upsertReconciliationObligations([
      {
        fazendaId: farmId,
        scope: "factual",
        tables: ["eventos", "eventos_pesagem"],
      },
    ]);
    const seeded = await getObligation(farmId, "factual");

    await drainReconciliationObligations(farmId);

    expect(mocks.pullDataForFarm).toHaveBeenCalledWith(farmId, [
      "eventos",
      "eventos_pesagem",
    ]);
    expect(
      await deleteReconciliationObligationIfGenerationMatches(
        seeded!.key,
        seeded!.generation_id,
      ),
    ).toBe(false);
    expect(await listReconciliationObligations(farmId)).toHaveLength(0);
  });

  it("falha de rede no drain preserva a obligation (T3/T5)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);
    mocks.pullDataForFarm.mockRejectedValueOnce(new Error("NetworkError"));

    await drainReconciliationObligations(farmId);

    expect(await getObligation(farmId, "factual")).toBeDefined();
  });

  it("drain sanitario-v2 executa cutover e agenda-v2 executa pullSanitarioAgendaV2", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "sanitario-v2" },
      { fazendaId: farmId, scope: "agenda-v2" },
    ]);

    await drainReconciliationObligations(farmId);

    expect(mocks.pullSanitarioV2CutoverState).toHaveBeenCalledWith(farmId);
    expect(mocks.pullSanitarioAgendaV2).toHaveBeenCalledWith(farmId);
    expect(await listReconciliationObligations(farmId)).toHaveLength(0);
  });

  it("drain reproduction executa pullReproductionDiagnosisState", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "reproduction" },
    ]);

    await drainReconciliationObligations(farmId);

    expect(mocks.pullReproductionDiagnosisState).toHaveBeenCalledWith(farmId);
    expect(await listReconciliationObligations(farmId)).toHaveLength(0);
  });

  it("novo ACK durante o drain nao e apagado pelo drain antigo (T13)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);
    const stale = await getObligation(farmId, "factual");

    let releasePull!: () => void;
    const gate = new Promise<void>((resolve) => {
      releasePull = resolve;
    });
    mocks.pullDataForFarm.mockImplementationOnce(() => gate);

    const drainPromise = drainReconciliationObligations(farmId);
    await flushMicrotasks();

    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["agenda_itens"] },
    ]);
    const fresh = await getObligation(farmId, "factual");
    releasePull();
    await drainPromise;

    expect(
      (await getObligation(farmId, "factual"))?.generation_id,
    ).toBe(fresh?.generation_id);
    expect(fresh?.generation_id).not.toBe(stale?.generation_id);
  });

  it("drains concorrentes sem Web Locks nao corrompem estado (T14)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);

    await Promise.all([
      drainReconciliationObligations(farmId),
      drainReconciliationObligations(farmId),
    ]);

    expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(1);
    expect(await listReconciliationObligations(farmId)).toHaveLength(0);
  });

  it("farm switch: obligation da fazenda A permanece enquanto B e ativa (T7/T16)", async () => {
    await upsertReconciliationObligations([
      { fazendaId: farmId, scope: "factual", tables: ["eventos"] },
    ]);

    await drainReconciliationObligations(otherFarmId);

    expect(mocks.pullDataForFarm).not.toHaveBeenCalled();
    expect(await getObligation(farmId, "factual")).toBeDefined();
  });

  it("listener online: start/stop/start nao acumula wake-up e drena obrigacao (T6/T15)", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const activeFarm = mocks.activeFarmId;

    await upsertReconciliationObligations([
      { fazendaId: activeFarm, scope: "factual", tables: ["eventos"] },
    ]);
    startSyncWorker();
    await vi.waitFor(() => {
      expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(1);
    });
    // Startup drain drena a primeira obrigacao.
    expect(await listReconciliationObligations(activeFarm)).toHaveLength(0);

    await upsertReconciliationObligations([
      { fazendaId: activeFarm, scope: "factual", tables: ["eventos"] },
    ]);
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => {
      expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(2);
    });
    // Reconnect retoma a obrigacao persistida.
    expect(await listReconciliationObligations(activeFarm)).toHaveLength(0);

    stopSyncWorker();
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));

    await upsertReconciliationObligations([
      { fazendaId: activeFarm, scope: "factual", tables: ["eventos"] },
    ]);
    startSyncWorker();
    await vi.waitFor(() => {
      expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(3);
    });
    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    // Startup drain do segundo start drena a obrigacao recriada.

    window.dispatchEvent(new Event("online"));
    await flushMicrotasks();
    // Sem obrigacao pendente, o wake-up nao executa pull novo.
    expect(mocks.pullDataForFarm).toHaveBeenCalledTimes(3);
  });
});
