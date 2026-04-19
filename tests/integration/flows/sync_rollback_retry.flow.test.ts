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

vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { createGesture } from "@/lib/offline/ops";
import { db } from "@/lib/offline/db";
import { processGesture } from "@/lib/offline/syncWorker";

async function seedAnimal(animalId: string) {
  const now = new Date().toISOString();
  await db.state_animais.put({
    id: animalId,
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2024-01-01",
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
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: `seed-op-${animalId}`,
    client_tx_id: `seed-tx-${animalId}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

async function getGesture(clientTxId: string) {
  const gesture = await db.queue_gestures.get(clientTxId);
  if (!gesture) {
    throw new Error(`gesture ${clientTxId} nao encontrada`);
  }
  return gesture;
}

describe("flow: sync rollback + retry", () => {
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

  it("reaplica gesture apos falha de rede (retry) e conclui no segundo ciclo", async () => {
    await seedAnimal("retry-1");
    const clientTxId = await createGesture("farm-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: "retry-1",
          observacoes: "atualizado",
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ status: "APPLIED", op_id: "any" }] }), {
          status: 200,
        }),
      );

    await processGesture(await getGesture(clientTxId));

    const pendingGesture = await getGesture(clientTxId);
    expect(pendingGesture.status).toBe("PENDING");
    expect(pendingGesture.retry_count).toBe(1);

    await processGesture(await getGesture(clientTxId));

    const doneGesture = await getGesture(clientTxId);
    expect(doneGesture.status).toBe("DONE");
    expect(doneGesture.sync_result).toBe("APPLIED");
  });

  it("faz rollback local quando servidor rejeita operacao", async () => {
    await seedAnimal("rollback-1");
    const clientTxId = await createGesture("farm-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: "rollback-1",
          observacoes: "valor invalido",
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    const localUpdated = await db.state_animais.get("rollback-1");
    expect(localUpdated?.observacoes).toBe("valor invalido");

    const op = await db.queue_ops.where("client_tx_id").equals(clientTxId).first();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: op?.client_op_id,
              status: "REJECTED",
              reason_code: "INVALID_PAYLOAD",
              reason_message: "payload invalido",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(clientTxId));

    const rejectedGesture = await getGesture(clientTxId);
    expect(rejectedGesture.status).toBe("REJECTED");
    expect(rejectedGesture.sync_result).toBe("REJECTED");

    const rolledBack = await db.state_animais.get("rollback-1");
    expect(rolledBack?.observacoes).toBeNull();
    expect(await db.queue_rejections.count()).toBe(1);
  });
});
