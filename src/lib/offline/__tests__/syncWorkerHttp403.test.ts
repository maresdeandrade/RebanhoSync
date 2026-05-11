/**
 * Documenta o comportamento atual: HTTP 403 no fetch do sync-batch é tratado como
 * erro não retryável — gesto vai a ERROR sem incrementar tentativas de retry e sem
 * rollback do apply otimista local (lacuna de auditoria §7.2).
 */
/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-1",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-2",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
    },
  },
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { createGesture } from "../ops";
import { db } from "../db";
import { processGesture } from "../syncWorker";

function dateDaysAgo(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

async function seedAnimal(id: string) {
  const now = new Date().toISOString();
  await db.state_animais.put({
    id,
    fazenda_id: "farm-403",
    identificacao: "403-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: dateDaysAgo(400),
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: "before-gesture",
    payload: {},
    client_id: "client-1",
    client_op_id: `op-seed-${id}`,
    client_tx_id: `tx-seed-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

describe("processGesture: HTTP 403 não retryável", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await Promise.all([
      db.state_animais.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      db.state_animais.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  it("marca ERROR, não incrementa retry_count, mantém apply otimista e queue_ops", async () => {
    const animalId = "animal-403";
    await seedAnimal(animalId);

    const txId = await createGesture("farm-403", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          observacoes: "optimistic-after-gesture",
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    expect((await db.state_animais.get(animalId))?.observacoes).toBe(
      "optimistic-after-gesture",
    );

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden - no access to this farm" }), {
        status: 403,
      }),
    );

    const gestureBefore = await db.queue_gestures.get(txId);
    expect(gestureBefore?.retry_count ?? 0).toBe(0);

    await processGesture(gestureBefore!);

    const gestureAfter = await db.queue_gestures.get(txId);
    expect(gestureAfter?.status).toBe("ERROR");
    expect(gestureAfter?.sync_result).toBe("ERROR");
    expect(gestureAfter?.last_error?.toLowerCase()).toContain("http 403");
    expect(gestureAfter?.retry_count ?? 0).toBe(0);

    expect(await db.queue_rejections.count()).toBe(0);

    const opsLeft = await db.queue_ops.where("client_tx_id").equals(txId).count();
    expect(opsLeft).toBe(1);

    expect((await db.state_animais.get(animalId))?.observacoes).toBe(
      "optimistic-after-gesture",
    );
  });
});
