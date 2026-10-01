/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import { createGesture } from "../ops";
import { mapOperationForSync } from "../syncWorker";

describe("F24.4C/F24.4E1 — snapshot remoto de revision", () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.transaction("rw", [db.state_animais, db.queue_gestures, db.queue_ops], async () => {
      await db.state_animais.clear();
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
    });
  });

  afterEach(async () => {
    await db.transaction("rw", [db.state_animais, db.queue_gestures, db.queue_ops], async () => {
      await db.state_animais.clear();
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
    });
  });

  it("captura expected_revision na criação sem fabricar uma revisão local nova", async () => {
    await db.state_animais.put({
      id: "animal-revision-1",
      fazenda_id: "farm-revision-1",
      identificacao: "REV-1",
      lote_id: "lote-a",
      revision: 7,
    } as never);

    const txId = await createGesture("farm-revision-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-revision-1", lote_id: "lote-b" },
      },
    ]);

    const [operation] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    expect(operation.expected_revision).toBe(7);
    expect((await db.state_animais.get("animal-revision-1") as { revision?: number })?.revision).toBe(7);

    const firstEnvelope = mapOperationForSync(operation, "farm-revision-1");
    expect(firstEnvelope).toMatchObject({
      client_op_id: operation.client_op_id,
      table: "animais",
      action: "UPDATE",
      expected_revision: 7,
    });
    await db.state_animais.update("animal-revision-1", { revision: 8 } as never);
    const replayEnvelope = mapOperationForSync(operation, "farm-revision-1");
    expect(replayEnvelope).toEqual(firstEnvelope);
    expect(replayEnvelope.expected_revision).toBe(7);
  });

  it("captura e preserva expected_revision no DELETE sem recalcular no replay", async () => {
    await db.state_animais.put({
      id: "animal-delete-revision-1",
      fazenda_id: "farm-revision-1",
      identificacao: "REV-DELETE-1",
      revision: 9,
      deleted_at: null,
    } as never);

    const txId = await createGesture("farm-revision-1", [
      {
        table: "animais",
        action: "DELETE",
        record: { id: "animal-delete-revision-1" },
      },
    ]);

    const [operation] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    expect(operation.expected_revision).toBe(9);
    expect(operation.before_snapshot).toMatchObject({
      id: "animal-delete-revision-1",
      revision: 9,
      deleted_at: null,
    });

    const firstEnvelope = mapOperationForSync(operation, "farm-revision-1");
    expect(firstEnvelope).toMatchObject({
      client_op_id: operation.client_op_id,
      table: "animais",
      action: "DELETE",
      expected_revision: 9,
    });

    await db.state_animais.update("animal-delete-revision-1", {
      revision: 10,
    } as never);
    const replayEnvelope = mapOperationForSync(operation, "farm-revision-1");
    expect(replayEnvelope).toEqual(firstEnvelope);
    expect(replayEnvelope.expected_revision).toBe(9);
  });

  it("não fabrica revisão para snapshot legado e deixa o servidor falhar fechado", async () => {
    await db.state_animais.put({
      id: "animal-legacy-1",
      fazenda_id: "farm-revision-1",
      identificacao: "LEGACY-1",
      lote_id: "lote-a",
    } as never);

    const txId = await createGesture("farm-revision-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: "animal-legacy-1", lote_id: "lote-b" },
      },
    ]);

    const [operation] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    expect(operation.expected_revision).toBeUndefined();
    expect(operation.before_snapshot).toMatchObject({ lote_id: "lote-a" });
    expect(mapOperationForSync(operation, "farm-revision-1")).not.toHaveProperty(
      "expected_revision",
    );
  });
});
