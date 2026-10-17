/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({
  rows: new Map<string, Array<Record<string, unknown>>>(),
  farmFilters: vi.fn(),
  fail: false,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-delete-test",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "test-owner" },
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: string) => {
          remote.farmFilters(table, column, value);
          const result = Promise.resolve({
            data: (remote.rows.get(table) ?? []).filter(
              (row) => row.fazenda_id === value,
            ),
            error: remote.fail ? { message: "offline during pull" } : null,
          });
          return Object.assign(result, { in: vi.fn(() => result) });
        }),
      })),
    })),
  },
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { seedLocalOwner } from "./ownershipTestFixture";
import { createGesture, retryRejectedOperation } from "../ops";
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
    revision: 1,
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

async function createEditThenDelete(removeProjection = true) {
  const animal = makeAnimal();
  await db.state_animais.put(animal);
  const editTx = await createGesture(farmId, [
    {
      table: "animais",
      action: "UPDATE",
      record: { id: animalId, observacoes: "edicao offline" },
    },
  ]);
  const [editOp] = await db.queue_ops
    .where("client_tx_id")
    .equals(editTx)
    .toArray();
  const deleteTx = await createGesture(farmId, [
    { table: "animais", action: "DELETE", record: { id: animalId } },
  ]);
  const deleteOp = await getDeleteOperation(deleteTx);
  if (removeProjection) await db.state_animais.delete(animalId);
  remote.rows.set("animais", [{ ...animal }]);
  vi.mocked(fetch).mockResolvedValueOnce(
    syncResponse([
      {
        op_id: editOp.client_op_id,
        status: "REJECTED",
        reason_code: "UPDATE_DENIED",
      },
    ]),
  );
  return { animal, editTx, editOp, deleteTx, deleteOp };
}

describe("animal deletion offline flow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    remote.rows.clear();
    remote.fail = false;
    localStorage.clear();
    await Promise.all([
      db.state_animais.clear(),
      db.state_agenda_itens.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
    await seedLocalOwner("test-owner");
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
      expected_revision: 1,
      record: { id: animalId, fazenda_id: farmId },
    });
    expect(operation.before_snapshot).toMatchObject({
      revision: 1,
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
      expected_revision: 1,
    });
    expect(reloadedOperation?.sync_state ?? "PENDING").toBe("PENDING");
    expect(reloadedOperation?.before_snapshot).toMatchObject({
      id: animalId,
      observacoes: "preservar no rollback",
    });
  });

  it.each([
    { removeProjection: true, syncState: undefined },
    { removeProjection: false, syncState: "PENDING" as const },
    { removeProjection: true, syncState: "RETRYABLE" as const },
  ])(
    "preserva DELETE $syncState apos rejeicao de edicao (remove=$removeProjection)",
    async ({ removeProjection, syncState }) => {
      const { animal, editTx, deleteTx, deleteOp } =
        await createEditThenDelete(removeProjection);
      await db.queue_ops.update(deleteOp.client_op_id, {
        sync_state: syncState,
      });
      const otherAnimal = makeAnimal({
        id: "unrelated-animal",
        fazenda_id: otherFarmId,
      });
      await db.state_animais.put(otherAnimal);
      const otherTx = await createGesture(otherFarmId, [
        { table: "animais", action: "DELETE", record: { id: otherAnimal.id } },
      ]);
      const otherOp = await getDeleteOperation(otherTx);
      const otherState = await db.state_animais.get(otherAnimal.id);

      await processGesture(await getGesture(editTx));

      expect(await getGesture(editTx)).toMatchObject({ status: "REJECTED" });
      expect(await getGesture(deleteTx)).toMatchObject({ status: "PENDING" });
      expect(await operationalAnimals()).toEqual([]);
      expect(await db.queue_ops.get(deleteOp.client_op_id)).toEqual({
        ...deleteOp,
        sync_state: syncState,
        before_snapshot: deleteOp.before_snapshot,
      });
      expect(await db.queue_ops.get(otherOp.client_op_id)).toEqual(otherOp);
      expect(await db.state_animais.get(otherAnimal.id)).toEqual(otherState);

      db.close();
      await db.open();
      await pullDataForFarm(farmId, ["animais"]);
      expect(await operationalAnimals()).toEqual([]);
      expect(await db.queue_ops.get(deleteOp.client_op_id)).toBeDefined();

      const deletedAt = "2026-08-23T14:00:00.000Z";
      remote.rows.set("animais", [{ ...animal, deleted_at: deletedAt }]);
      vi.mocked(fetch).mockResolvedValueOnce(
        syncResponse([{ op_id: deleteOp.client_op_id, status: "APPLIED" }]),
      );
      await processGesture(await getGesture(deleteTx));
      await pullDataForFarm(farmId, ["animais"]);
      expect(await operationalAnimals()).toEqual([]);
      expect(await db.queue_ops.get(deleteOp.client_op_id)).toBeUndefined();
      expect(await getGesture(deleteTx)).toMatchObject({ status: "DONE" });
      expect(await db.queue_ops.get(otherOp.client_op_id)).toEqual(otherOp);
      expect(await db.event_eventos.count()).toBe(0);
    },
  );

  it("restaura snapshot sem a edicao rejeitada se DELETE tambem falha e pull fica offline", async () => {
    const { animal, editTx, deleteTx, deleteOp } = await createEditThenDelete();
    remote.fail = true;

    await processGesture(await getGesture(editTx));
    expect(await operationalAnimals()).toEqual([]);
    db.close();
    await db.open();
    vi.mocked(fetch).mockResolvedValueOnce(
      syncResponse([
        {
          op_id: deleteOp.client_op_id,
          status: "REJECTED",
          reason_code: "DELETE_DENIED",
        },
      ]),
    );

    await processGesture(await getGesture(deleteTx));

    expect(await db.state_animais.get(animalId)).toEqual(animal);
    expect(await getGesture(deleteTx)).toMatchObject({ status: "REJECTED" });
    expect(await db.queue_ops.get(deleteOp.client_op_id)).toMatchObject({
      expected_revision: deleteOp.expected_revision,
      sync_state: "REJECTED",
      before_snapshot: deleteOp.before_snapshot,
    });
    expect(await db.queue_rejections.count()).toBe(2);
  });

  it("aborta tombstone junto do ACK sem alterar snapshot, permitindo replay apos reopen", async () => {
    const { editTx, editOp, deleteOp } = await createEditThenDelete();
    const updateOperation = db.queue_ops.update.bind(db.queue_ops);
    const updateSpy = vi
      .spyOn(db.queue_ops, "update")
      .mockImplementation((...args) => {
        if (
          args[0] === editOp.client_op_id &&
          typeof args[1] !== "function" &&
          args[1].sync_state === "REJECTED"
        ) {
          return Dexie.Promise.reject(
            new Error("injected ACK persistence failure"),
          );
        }
        return updateOperation(...args);
      });
    try {
      await processGesture(await getGesture(editTx));
    } finally {
      updateSpy.mockRestore();
    }

    expect(await db.state_animais.get(animalId)).toBeUndefined();
    expect(await db.queue_ops.get(deleteOp.client_op_id)).toEqual(deleteOp);
    expect(await db.queue_rejections.count()).toBe(0);

    db.close();
    await db.open();
    vi.mocked(fetch).mockResolvedValueOnce(
      syncResponse([
        {
          op_id: editOp.client_op_id,
          status: "REJECTED",
          reason_code: "UPDATE_DENIED",
        },
      ]),
    );
    await processGesture(await getGesture(editTx));
    expect(await operationalAnimals()).toEqual([]);
    expect(await getGesture(editTx)).toMatchObject({ status: "REJECTED" });
    expect(await db.queue_rejections.count()).toBe(1);
    expect(await db.queue_ops.get(deleteOp.client_op_id)).toMatchObject({
      before_snapshot: deleteOp.before_snapshot,
    });
  });

  it("nao restaura edicao rejeitada atraves do snapshot de outra edicao pendente", async () => {
    const animal = makeAnimal();
    await db.state_animais.put(animal);
    const editTxs: string[] = [];
    for (const observacoes of ["primeira edicao", "segunda edicao"]) {
      editTxs.push(
        await createGesture(farmId, [
          {
            table: "animais",
            action: "UPDATE",
            record: { id: animalId, observacoes },
          },
        ]),
      );
    }
    const deleteTx = await createGesture(farmId, [
      { table: "animais", action: "DELETE", record: { id: animalId } },
    ]);
    await db.state_animais.delete(animalId);
    remote.fail = true;
    for (const tx of [...editTxs, deleteTx]) {
      const [op] = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
      vi.mocked(fetch).mockResolvedValueOnce(
        syncResponse([
          {
            op_id: op.client_op_id,
            status: "REJECTED",
            reason_code: "WRITE_DENIED",
          },
        ]),
      );
      await processGesture(await getGesture(tx));
      if (tx !== deleteTx) expect(await operationalAnimals()).toEqual([]);
    }
    expect(await db.state_animais.get(animalId)).toEqual(animal);
  });

  it.each(["APPLIED", "REJECTED"] as const)("preserva resultado %s do retry manual de UPDATE apos rejeicao de DELETE offline", async (retryResult) => {
    const { editTx, editOp, deleteTx, deleteOp } = await createEditThenDelete();
    remote.fail = true;
    await processGesture(await getGesture(editTx));
    const rejection = await db.queue_rejections
      .filter((row) => row.client_op_id === editOp.client_op_id).first();
    if (!rejection) throw new Error("Missing edit rejection");

    expect(await retryRejectedOperation(rejection)).toEqual({
      clientTxId: editTx, clientOpId: editOp.client_op_id,
    });
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: editOp.client_op_id, status: retryResult, reason_code: "UPDATE_DENIED" },
    ]));
    await processGesture(await getGesture(editTx));
    const acceptedGesture = await getGesture(editTx);
    expect(acceptedGesture.status).toBe(retryResult === "APPLIED" ? "DONE" : "REJECTED");
    if (retryResult === "APPLIED") expect(await db.queue_ops.get(editOp.client_op_id)).toBeUndefined();
    expect(await operationalAnimals()).toEqual([]);
    db.close();
    await db.open();

    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: deleteOp.client_op_id, status: "REJECTED", reason_code: "STATE_REVISION_CONFLICT" },
    ]));
    await processGesture(await getGesture(deleteTx));

    expect(await db.state_animais.get(animalId)).toMatchObject({
      observacoes: retryResult === "APPLIED" ? "edicao offline" : makeAnimal().observacoes,
      client_op_id: retryResult === "APPLIED" ? editOp.client_op_id : makeAnimal().client_op_id,
    });
    expect(await getGesture(editTx)).toEqual(acceptedGesture);
    const requests = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(requests[0].ops[0]).toEqual(requests[1].ops[0]);
    expect(await db.queue_ops.get(deleteOp.client_op_id)).toMatchObject({
      record: deleteOp.record, expected_revision: deleteOp.expected_revision,
      before_snapshot: deleteOp.before_snapshot,
    });
  });

  it("mantem UPDATE aplicado anterior ao UPDATE rejeitado sem alterar snapshots ou receipt aplicado", async () => {
    const animal = makeAnimal();
    await db.state_animais.put(animal);
    const acceptedTx = await createGesture(farmId, [{
      table: "animais", action: "UPDATE", record: { id: animalId, nome: "nome aceito" },
    }]);
    const [acceptedOp] = await db.queue_ops.where("client_tx_id").equals(acceptedTx).toArray();
    const rejectedTx = await createGesture(farmId, [{
      table: "animais", action: "UPDATE", record: { id: animalId, observacoes: "edicao rejeitada" },
    }]);
    const [rejectedOp] = await db.queue_ops.where("client_tx_id").equals(rejectedTx).toArray();
    const deleteTx = await createGesture(farmId, [{
      table: "animais", action: "DELETE", record: { id: animalId },
    }]);
    const deleteOp = await getDeleteOperation(deleteTx);
    await db.state_animais.delete(animalId);
    remote.fail = true;
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: acceptedOp.client_op_id, status: "APPLIED" },
    ]));
    await processGesture(await getGesture(acceptedTx));
    const acceptedGesture = await getGesture(acceptedTx);
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: rejectedOp.client_op_id, status: "REJECTED", reason_code: "WRITE_DENIED" },
    ]));
    await processGesture(await getGesture(rejectedTx));
    expect(await operationalAnimals()).toEqual([]);
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: deleteOp.client_op_id, status: "REJECTED", reason_code: "DELETE_DENIED" },
    ]));
    await processGesture(await getGesture(deleteTx));
    expect(await db.state_animais.get(animalId)).toMatchObject({
      nome: "nome aceito", observacoes: animal.observacoes,
    });
    expect(await getGesture(acceptedTx)).toEqual(acceptedGesture);
    expect(await db.queue_ops.get(acceptedOp.client_op_id)).toBeUndefined();
    expect((await db.queue_ops.get(rejectedOp.client_op_id))?.before_snapshot).toEqual(rejectedOp.before_snapshot);
    expect((await db.queue_ops.get(deleteOp.client_op_id))?.before_snapshot).toEqual(deleteOp.before_snapshot);
  });

  it("retry manual de DELETE preserva envelope apos timeout e reload sem restaurar UPDATE rejeitado", async () => {
    const { animal, editTx, deleteTx, deleteOp } = await createEditThenDelete();
    remote.fail = true;
    await processGesture(await getGesture(editTx));
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: deleteOp.client_op_id, status: "REJECTED", reason_code: "DELETE_DENIED" },
    ]));
    await processGesture(await getGesture(deleteTx));
    expect(await db.state_animais.get(animalId)).toEqual(animal);
    const rejection = await db.queue_rejections.filter((row) => row.client_op_id === deleteOp.client_op_id).first();
    if (!rejection) throw new Error("Missing delete rejection");
    await retryRejectedOperation(rejection);
    expect(await operationalAnimals()).toEqual([]);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("lost ACK after delete retry"));
    await processGesture(await getGesture(deleteTx));
    db.close();
    await db.open();
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: deleteOp.client_op_id, status: "APPLIED" },
    ]));
    await processGesture(await getGesture(deleteTx));
    expect(await operationalAnimals()).toEqual([]);
    expect(await getGesture(deleteTx)).toMatchObject({ status: "DONE" });
    const requests = vi.mocked(fetch).mock.calls.slice(1).map(([, init]) => JSON.parse(String(init?.body)));
    expect(requests).toHaveLength(3);
    expect(requests[0].ops[0]).toEqual(requests[1].ops[0]);
    expect(requests[1].ops[0]).toEqual(requests[2].ops[0]);
    expect(await db.queue_ops.get(deleteOp.client_op_id)).toBeUndefined();
  });

  it("reconstroi edicao descendente pendente sem herdar campos de UPDATE rejeitado", async () => {
    const animal = makeAnimal();
    await db.state_animais.put(animal);
    const rejectedTx = await createGesture(farmId, [{
      table: "animais", action: "UPDATE", record: { id: animalId, observacoes: "rejeitada" },
    }]);
    const pendingTx = await createGesture(farmId, [{
      table: "animais", action: "UPDATE", record: { id: animalId, nome: "nome pendente" },
    }]);
    const deleteTx = await createGesture(farmId, [{
      table: "animais", action: "DELETE", record: { id: animalId },
    }]);
    await db.state_animais.delete(animalId);
    remote.fail = true;
    for (const tx of [rejectedTx, deleteTx]) {
      const [op] = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
      vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
        { op_id: op.client_op_id, status: "REJECTED", reason_code: "WRITE_DENIED" },
      ]));
      await processGesture(await getGesture(tx));
    }
    expect(await db.state_animais.get(animalId)).toMatchObject({
      nome: "nome pendente", observacoes: animal.observacoes,
    });
    const [pendingOp] = await db.queue_ops.where("client_tx_id").equals(pendingTx).toArray();
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: pendingOp.client_op_id, status: "REJECTED", reason_code: "WRITE_DENIED" },
    ]));
    await processGesture(await getGesture(pendingTx));
    expect(await db.state_animais.get(animalId)).toEqual(animal);
  });

  it("resultado parcial no mesmo animal preserva UPDATE aplicado apos rollback da edicao rejeitada", async () => {
    const animal = makeAnimal();
    await db.state_animais.put(animal);
    const tx = await createGesture(farmId, [
      { table: "animais", action: "UPDATE", record: { id: animalId, nome: "aceito" } },
      { table: "animais", action: "UPDATE", record: { id: animalId, observacoes: "rejeitada" } },
    ]);
    const [applied, rejected] = await db.queue_ops.where("client_tx_id").equals(tx).sortBy("op_order");
    const deleteTx = await createGesture(farmId, [{
      table: "animais", action: "DELETE", record: { id: animalId },
    }]);
    const deletion = await getDeleteOperation(deleteTx);
    await db.state_animais.delete(animalId);
    remote.fail = true;
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: applied.client_op_id, status: "APPLIED" },
      { op_id: rejected.client_op_id, status: "REJECTED", reason_code: "WRITE_DENIED" },
    ]));
    await processGesture(await getGesture(tx));
    const receipt = await getGesture(tx);
    expect(await operationalAnimals()).toEqual([]);
    vi.mocked(fetch).mockResolvedValueOnce(syncResponse([
      { op_id: deletion.client_op_id, status: "REJECTED", reason_code: "DELETE_DENIED" },
    ]));
    await processGesture(await getGesture(deleteTx));
    expect(await db.state_animais.get(animalId)).toMatchObject({
      nome: "aceito", observacoes: animal.observacoes,
    });
    expect(await getGesture(tx)).toEqual(receipt);
    expect(await db.queue_ops.get(applied.client_op_id)).toBeUndefined();
    expect((await db.queue_ops.get(deletion.client_op_id))?.before_snapshot).toEqual(deletion.before_snapshot);
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

  it("rejeita DELETE stale, restaura e reconcilia para o snapshot remoto mais novo", async () => {
    const { clientTxId, operation, animal } = await createConfirmedDelete();
    const remoteUpdatedAt = "2026-08-23T12:30:00.000Z";
    remote.rows.set("animais", [
      {
        ...animal,
        observacoes: "remote-newer",
        revision: 2,
        updated_at: remoteUpdatedAt,
        deleted_at: null,
      },
    ]);
    vi.mocked(fetch).mockResolvedValueOnce(
      syncResponse([
        {
          op_id: operation.client_op_id,
          status: "CONFLICT",
          retryable: false,
          reason_code: "STATE_REVISION_CONFLICT",
          reason_message: "State changed after the local snapshot was read",
          current_revision: 2,
        },
      ]),
    );

    await processGesture(await getGesture(clientTxId));

    const syncRequest = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as {
      ops: Array<{
        client_op_id: string;
        action: string;
        expected_revision?: number;
      }>;
    };
    expect(syncRequest.ops[0]).toMatchObject({
      client_op_id: operation.client_op_id,
      action: "DELETE",
      expected_revision: 1,
    });

    expect(await db.queue_ops.get(operation.client_op_id)).toMatchObject({
      sync_state: "REJECTED",
      expected_revision: 1,
      blocked_reason: "STATE_REVISION_CONFLICT",
    });
    expect(await getGesture(clientTxId)).toMatchObject({
      status: "REJECTED",
      sync_result: "REJECTED",
    });
    expect(await db.queue_rejections.toArray()).toEqual([
      expect.objectContaining({
        client_op_id: operation.client_op_id,
        reason_code: "STATE_REVISION_CONFLICT",
      }),
    ]);
    expect(await db.state_animais.get(animalId)).toMatchObject({
      observacoes: "remote-newer",
      revision: 2,
      deleted_at: null,
    });
    expect(await operationalAnimals()).toHaveLength(1);
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
      ops: Array<{ client_op_id: string; expected_revision?: number }>;
    }>;
    expect(requests.map((request) => request.client_tx_id)).toEqual([
      clientTxId,
      clientTxId,
    ]);
    expect(requests.map((request) => request.ops[0]?.client_op_id)).toEqual([
      operation.client_op_id,
      operation.client_op_id,
    ]);
    expect(requests.map((request) => request.ops[0]?.expected_revision)).toEqual([
      1,
      1,
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
