/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({
  rows: new Map<string, Array<Record<string, unknown>>>(),
  farmFilters: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-delete-test",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(async (column: string, value: string) => {
          remote.farmFilters(table, column, value);
          return {
            data: (remote.rows.get(table) ?? []).filter(
              (row) => row.fazenda_id === value,
            ),
            error: null,
          };
        }),
      })),
    })),
  },
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { createGesture } from "../ops";
import { pullDataForFarm } from "../pull";
import { processGesture } from "../syncWorker";
import type { Animal, Gesture, Operation } from "../types";

const farmId = "30000000-0000-4000-8000-000000000001";
const otherFarmId = "30000000-0000-4000-8000-000000000002";
const animalId = "40000000-0000-4000-8000-000000000001";

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  const timestamp = "2026-08-23T12:00:00.000Z";
  return {
    id: animalId,
    fazenda_id: farmId,
    identificacao: "DEL-FLOW-001",
    sexo: "F",
    status: "ativo",
    especie: "bovino",
    lote_id: null,
    data_nascimento: "2024-01-01",
    data_entrada: "2024-01-01",
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: "Snapshot original",
    rfid: "RFID-DELETE-001",
    origem: "nascimento",
    raca: "nelore",
    papel_macho: null,
    habilitado_monta: false,
    observacoes: "preservar no rollback",
    payload: { origem_teste: "animal-delete-flow" },
    client_id: "client-seed",
    client_op_id: "op-seed",
    client_tx_id: "tx-seed",
    client_recorded_at: timestamp,
    server_received_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    ...overrides,
  };
}

async function createConfirmedDelete(animal = makeAnimal()) {
  await db.state_animais.put(animal);
  const clientTxId = await createGesture(animal.fazenda_id, [
    { table: "animais", action: "DELETE", record: { id: animal.id } },
  ]);
  await db.state_animais.delete(animal.id);
  const operation = await getDeleteOperation(clientTxId);
  return { clientTxId, operation, animal };
}

async function getGesture(clientTxId: string): Promise<Gesture> {
  const gesture = await db.queue_gestures.get(clientTxId);
  if (!gesture) throw new Error(`Gesture ${clientTxId} not found`);
  return gesture;
}

async function getDeleteOperation(clientTxId: string): Promise<Operation> {
  const operations = await db.queue_ops
    .where("client_tx_id")
    .equals(clientTxId)
    .toArray();
  const operation = operations.find(
    (candidate) => candidate.table === "animais" && candidate.action === "DELETE",
  );
  if (!operation) throw new Error(`DELETE operation for ${clientTxId} not found`);
  return operation;
}

function syncResponse(results: Array<Record<string, unknown>>) {
  return new Response(JSON.stringify({ results }), { status: 200 });
}

async function operationalAnimals(targetFarmId = farmId) {
  return db.state_animais
    .where("fazenda_id")
    .equals(targetFarmId)
    .filter((animal) => !animal.deleted_at)
    .toArray();
}

describe("animal deletion offline flow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    remote.rows.clear();
    localStorage.clear();
    await Promise.all([
      db.state_animais.clear(),
      db.state_agenda_itens.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (!db.isOpen()) await db.open();
    await Promise.all([
      db.state_animais.clear(),
      db.state_agenda_itens.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  it("persiste gesture, DELETE e before_snapshot enquanto remove a projecao local", async () => {
    const { clientTxId, operation, animal } = await createConfirmedDelete();

    expect(await getGesture(clientTxId)).toMatchObject({
      client_tx_id: clientTxId,
      fazenda_id: farmId,
      status: "PENDING",
    });
    expect(operation).toMatchObject({
      client_tx_id: clientTxId,
      table: "animais",
      action: "DELETE",
      record: { id: animalId, fazenda_id: farmId },
    });
    expect(operation.before_snapshot).toMatchObject({
      id: animalId,
      identificacao: animal.identificacao,
      observacoes: animal.observacoes,
      deleted_at: null,
    });
    expect(await db.state_animais.get(animalId)).toBeUndefined();
    expect(await operationalAnimals()).toEqual([]);
  });

  it("mantem exclusao e fila pendente depois de fechar e reabrir Dexie", async () => {
    const { clientTxId, operation } = await createConfirmedDelete();

    db.close();
    await db.open();

    const reloadedOperation = await db.queue_ops.get(operation.client_op_id);
    expect(await db.state_animais.get(animalId)).toBeUndefined();
    expect(await getGesture(clientTxId)).toMatchObject({ status: "PENDING" });
    expect(reloadedOperation).toMatchObject({
      client_op_id: operation.client_op_id,
      client_tx_id: clientTxId,
      action: "DELETE",
    });
    expect(reloadedOperation?.sync_state ?? "PENDING").toBe("PENDING");
    expect(reloadedOperation?.before_snapshot).toMatchObject({
      id: animalId,
      observacoes: "preservar no rollback",
    });
  });

  it("restaura o snapshot rejeitado sem reverter uma operacao aplicada", async () => {
    const survivor = makeAnimal({
      id: "40000000-0000-4000-8000-000000000002",
      identificacao: "SURVIVOR-001",
      observacoes: "antes",
    });
    const deleted = makeAnimal();
    await db.state_animais.bulkPut([deleted, survivor]);
    const clientTxId = await createGesture(farmId, [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: survivor.id, observacoes: "aplicada" },
      },
      { table: "animais", action: "DELETE", record: { id: deleted.id } },
    ]);
    await db.state_animais.delete(deleted.id);
    const operations = await db.queue_ops
      .where("client_tx_id")
      .equals(clientTxId)
      .sortBy("op_order");
    const [appliedOperation, rejectedOperation] = operations;
    remote.rows.set("animais", [
      deleted,
      { ...survivor, observacoes: "aplicada" },
      makeAnimal({ id: "other-farm-animal", fazenda_id: otherFarmId }),
    ]);
    vi.mocked(fetch).mockResolvedValueOnce(
      syncResponse([
        { op_id: appliedOperation.client_op_id, status: "APPLIED" },
        {
          op_id: rejectedOperation.client_op_id,
          status: "REJECTED",
          reason_code: "DELETE_DENIED",
          reason_message: "Animal possui vinculo protegido",
        },
      ]),
    );

    await processGesture(await getGesture(clientTxId));

    expect(await db.state_animais.get(animalId)).toMatchObject({
      identificacao: deleted.identificacao,
      rfid: deleted.rfid,
      observacoes: deleted.observacoes,
      payload: deleted.payload,
      deleted_at: null,
    });
    expect(await db.state_animais.get(survivor.id)).toMatchObject({
      observacoes: "aplicada",
    });
    expect(await db.queue_ops.get(appliedOperation.client_op_id)).toBeUndefined();
    expect(await db.queue_ops.get(rejectedOperation.client_op_id)).toMatchObject({
      sync_state: "REJECTED",
    });
    expect(await db.queue_rejections.toArray()).toEqual([
      expect.objectContaining({
        client_tx_id: clientTxId,
        client_op_id: rejectedOperation.client_op_id,
        reason_code: "DELETE_DENIED",
      }),
    ]);
    expect(await getGesture(clientTxId)).toMatchObject({
      status: "REJECTED",
      sync_result: "REJECTED",
    });
    expect(await db.state_animais.get("other-farm-animal")).toBeUndefined();
  });

  it("aceita tombstone remoto apos APPLIED sem ressuscitar o animal", async () => {
    const { clientTxId, operation, animal } = await createConfirmedDelete();
    const deletedAt = "2026-08-23T13:00:00.000Z";
    remote.rows.set("animais", [
      { ...animal, deleted_at: deletedAt, updated_at: deletedAt },
      makeAnimal({ id: "other-farm-tombstone", fazenda_id: otherFarmId }),
    ]);
    vi.mocked(fetch).mockResolvedValueOnce(
      syncResponse([{ op_id: operation.client_op_id, status: "APPLIED" }]),
    );

    await processGesture(await getGesture(clientTxId));
    await pullDataForFarm(farmId, ["animais"]);

    expect(await db.queue_ops.get(operation.client_op_id)).toBeUndefined();
    expect(await getGesture(clientTxId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
    expect(await db.state_animais.get(animalId)).toMatchObject({
      deleted_at: deletedAt,
    });
    expect(await operationalAnimals()).toEqual([]);
    expect(await db.state_animais.get("other-farm-tombstone")).toBeUndefined();
    expect(remote.farmFilters).toHaveBeenCalledWith(
      "animais",
      "fazenda_id",
      farmId,
    );
  });

  it("reutiliza identidades apos timeout e converge sem duplicar ou ressuscitar", async () => {
    const { clientTxId, operation, animal } = await createConfirmedDelete();
    const deletedAt = "2026-08-23T14:00:00.000Z";
    remote.rows.set("animais", [
      { ...animal, deleted_at: deletedAt, updated_at: deletedAt },
    ]);
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network timeout after remote commit"))
      .mockResolvedValueOnce(
        syncResponse([{ op_id: operation.client_op_id, status: "APPLIED" }]),
      );

    await processGesture(await getGesture(clientTxId));
    expect(await getGesture(clientTxId)).toMatchObject({ status: "PENDING" });
    expect(await db.queue_ops.get(operation.client_op_id)).toMatchObject({
      client_op_id: operation.client_op_id,
      client_tx_id: clientTxId,
    });

    await processGesture(await getGesture(clientTxId));
    await pullDataForFarm(farmId, ["animais"]);

    const requests = vi.mocked(fetch).mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    ) as Array<{
      client_tx_id: string;
      ops: Array<{ client_op_id: string }>;
    }>;
    expect(requests.map((request) => request.client_tx_id)).toEqual([
      clientTxId,
      clientTxId,
    ]);
    expect(requests.map((request) => request.ops[0]?.client_op_id)).toEqual([
      operation.client_op_id,
      operation.client_op_id,
    ]);
    expect(await db.queue_ops.where("client_tx_id").equals(clientTxId).count()).toBe(0);
    expect(await getGesture(clientTxId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
    expect(await db.state_animais.get(animalId)).toMatchObject({
      deleted_at: deletedAt,
    });
    expect(await operationalAnimals()).toEqual([]);
  });
});
