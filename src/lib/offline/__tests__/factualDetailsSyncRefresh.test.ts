/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-factual-detail",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { createGesture } from "../ops";
import { db } from "../db";
import { pullDataForFarm } from "../pull";
import { processGesture } from "../syncWorker";
import { getLocalStoreName } from "../tableMap";
import type { OperationInput } from "../types";

const farm = "10000000-0000-4000-8000-000000000001";

const cases: Array<{
  table: "eventos_ecc" | "eventos_pesagem" | "eventos_financeiro";
  status: "APPLIED" | "APPLIED_ALTERED";
  key: "event_id" | "evento_id";
  valueKey: "ecc" | "peso_kg" | "valor_total";
  localValue: number;
  remoteValue: number;
  record: Record<string, unknown>;
}> = [
  {
    table: "eventos_ecc",
    status: "APPLIED",
    key: "event_id",
    valueKey: "ecc",
    localValue: 3,
    remoteValue: 3.25,
    record: { animal_id: "animal-1", escala_min: 1, escala_max: 5, escala_passo: 0.25 },
  },
  {
    table: "eventos_ecc",
    status: "APPLIED_ALTERED",
    key: "event_id",
    valueKey: "ecc",
    localValue: 3,
    remoteValue: 3.5,
    record: { animal_id: "animal-1", escala_min: 1, escala_max: 5, escala_passo: 0.25 },
  },
  {
    table: "eventos_pesagem",
    status: "APPLIED",
    key: "evento_id",
    valueKey: "peso_kg",
    localValue: 400,
    remoteValue: 405,
    record: { payload: {} },
  },
  {
    table: "eventos_pesagem",
    status: "APPLIED_ALTERED",
    key: "evento_id",
    valueKey: "peso_kg",
    localValue: 400,
    remoteValue: 410,
    record: { payload: {} },
  },
  {
    table: "eventos_financeiro",
    status: "APPLIED",
    key: "evento_id",
    valueKey: "valor_total",
    localValue: 7000,
    remoteValue: 7100,
    record: { tipo: "venda", contraparte_id: null, payload: {} },
  },
  {
    table: "eventos_financeiro",
    status: "APPLIED_ALTERED",
    key: "evento_id",
    valueKey: "valor_total",
    localValue: 7000,
    remoteValue: 7200,
    record: { tipo: "venda", contraparte_id: null, payload: {} },
  },
];

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.queue_gestures,
      db.queue_ops,
      db.queue_rejections,
      db.event_eventos_ecc,
      db.event_eventos_pesagem,
      db.event_eventos_financeiro,
    ],
    async () => {
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
      await db.queue_rejections.clear();
      await db.event_eventos_ecc.clear();
      await db.event_eventos_pesagem.clear();
      await db.event_eventos_financeiro.clear();
    },
  );
}

describe("standard factual detail post-sync refresh", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await clearStores();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearStores();
  });

  it.each(cases)(
    "converges $table after $status",
    async ({ table, status, key, valueKey, localValue, remoteValue, record }) => {
      const eventId = `${table}-${status.toLowerCase()}`;
      const operation: OperationInput = {
        table,
        action: "INSERT",
        record: {
          [key]: eventId,
          [valueKey]: localValue,
          ...record,
        },
      };
      const txId = await createGesture(farm, [operation]);
      const [queuedOperation] = await db.queue_ops
        .where("client_tx_id")
        .equals(txId)
        .toArray();
      const localStore = getLocalStoreName(table);

      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                op_id: queuedOperation.client_op_id,
                status,
                ...(status === "APPLIED_ALTERED"
                  ? { altered: { source: "server-canonical" } }
                  : {}),
              },
            ],
          }),
          { status: 200 },
        ),
      );
      vi.mocked(pullDataForFarm).mockImplementation(
        async (_farmId, remoteTables) => {
          if (!remoteTables.includes(table)) return;
          await db.table(localStore).put({
            ...queuedOperation.record,
            [valueKey]: remoteValue,
          });
        },
      );

      const gesture = await db.queue_gestures.get(txId);
      if (!gesture) throw new Error("gesture not found");
      await processGesture(gesture);

      expect(pullDataForFarm).toHaveBeenCalledWith(
        farm,
        expect.arrayContaining([table]),
      );
      expect(await db.table(localStore).get(eventId)).toMatchObject({
        [valueKey]: remoteValue,
      });
      expect(await db.queue_ops.get(queuedOperation.client_op_id)).toBeUndefined();
      expect(await db.queue_gestures.get(txId)).toMatchObject({
        status: "DONE",
        sync_result: status,
      });
    },
  );
});
