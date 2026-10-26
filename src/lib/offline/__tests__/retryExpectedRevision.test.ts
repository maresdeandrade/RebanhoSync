import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { retryRejectedOperation } from "../ops";
import type { Animal, Operation, Rejection } from "../types";

async function clearFixture() {
  await Promise.all([
    db.state_animais.clear(), db.queue_ops.clear(),
    db.queue_gestures.clear(), db.queue_rejections.clear(),
  ]);
}
beforeEach(clearFixture);
afterEach(clearFixture);

async function rejectedUpdate(captured: number | undefined, revision: number | undefined, farm = "farm-a") {
  await db.state_animais.put({
    id: "mother", fazenda_id: farm, revision, observacoes: "remote", payload: {},
  } as Animal);
  await db.queue_gestures.put({
    client_tx_id: "tx", fazenda_id: "farm-a", client_id: "client",
    created_at: "2026-10-23T12:00:00Z", status: "REJECTED",
  });
  await db.queue_ops.put({
    client_op_id: "op", client_tx_id: "tx", fazenda_id: "farm-a",
    table: "animais", action: "UPDATE", record: { id: "mother", observacoes: "retry" },
    before_snapshot: { id: "mother", fazenda_id: "farm-a", observacoes: "before" },
    sync_state: "REJECTED", expected_revision: captured,
    created_at: "2026-10-23T12:00:00Z",
  } as Operation);
  const rejection = {
    client_op_id: "op", client_tx_id: "tx", fazenda_id: "farm-a",
    table: "animais", action: "UPDATE", reason_code: "STATE_EXPECTED_REVISION_REQUIRED",
    reason_message: "revision missing", created_at: "2026-10-23T12:00:00Z",
  } as Rejection;
  await db.queue_rejections.add(rejection);
  return rejection;
}

describe("explicit retry revision capture", () => {
  it.each([
    [undefined, 3, 3], [1, 3, 1], [undefined, undefined, undefined],
  ])("captures only a previously missing observed revision (%s, %s)", async (captured, revision, expected) => {
    const rejection = await rejectedUpdate(captured, revision);
    const before = (await db.queue_ops.get("op"))?.before_snapshot;
    await retryRejectedOperation(rejection);
    expect(await db.queue_ops.get("op")).toMatchObject({
      client_op_id: "op", client_tx_id: "tx", expected_revision: expected,
      before_snapshot: before, sync_state: "PENDING",
    });
    expect(await db.queue_rejections.count()).toBe(1);
    await expect(retryRejectedOperation(rejection)).rejects.toThrow("ALREADY_QUEUED");
  });

  it("rejects another farm's current row without rebasing or mutating it", async () => {
    const rejection = await rejectedUpdate(undefined, 3, "farm-b");
    await expect(retryRejectedOperation(rejection)).rejects.toThrow("IDENTITY_MISMATCH");
    expect(await db.state_animais.get("mother")).toMatchObject({ fazenda_id: "farm-b", observacoes: "remote" });
    expect(await db.queue_ops.get("op")).toMatchObject({ sync_state: "REJECTED" });
    expect((await db.queue_ops.get("op"))?.expected_revision).toBeUndefined();
  });
});
