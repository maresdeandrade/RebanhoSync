import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import type { Animal, Operation } from "@/lib/offline/types";
import * as pull from "@/lib/offline/pull";
import { resumeTestFarmMissingRevision } from "../progress";

const farmId = "farm";
const txId = "tx";
const animalId = "11111111-1111-4111-8111-111111111111";
const validateContext = vi.fn(async () => {});

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  validateContext.mockReset().mockResolvedValue(undefined);
  await db.state_animais.put({ id: animalId, fazenda_id: farmId, observacoes: "before", payload: {} } as Animal);
  await db.queue_gestures.put({ client_tx_id: txId, fazenda_id: farmId, client_id: "client", status: "REJECTED",
    last_error: "STATE_EXPECTED_REVISION_REQUIRED:missing", created_at: "2026-11-06T12:00:00Z" });
  await db.queue_ops.put({ client_tx_id: txId, client_op_id: "op", table: "animais", action: "UPDATE",
    record: { id: animalId, observacoes: "seed" }, sync_state: "REJECTED", created_at: "2026-11-06T12:00:00Z" } as Operation);
  await db.queue_rejections.add({ client_tx_id: txId, client_op_id: "op", fazenda_id: farmId, table: "animais", action: "UPDATE",
    reason_code: "STATE_EXPECTED_REVISION_REQUIRED", reason_message: "missing", created_at: "2026-11-06T12:00:00Z" });
  vi.spyOn(pull, "pullDataForFarm").mockImplementation(async () => {
    await db.state_animais.update(animalId, { revision: 3 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("test farm missing-revision recovery", () => {
  it("pulls before retry, captures the revision and preserves identities and rejection evidence", async () => {
    await resumeTestFarmMissingRevision(farmId, txId, validateContext);
    expect(pull.pullDataForFarm).toHaveBeenCalledWith(farmId, ["animais"], {
      mode: "merge", observations: { animais: { key: "id", ids: [animalId] } }, requiredAnimalIds: [animalId],
    });
    expect(await db.queue_ops.get("op")).toMatchObject({ client_op_id: "op", client_tx_id: txId, expected_revision: 3, sync_state: "PENDING" });
    expect(await db.state_animais.get(animalId)).toMatchObject({ revision: 3, observacoes: "seed" });
    expect(await db.queue_rejections.count()).toBe(1);
    await resumeTestFarmMissingRevision(farmId, txId, validateContext);
    expect(pull.pullDataForFarm).toHaveBeenCalledTimes(1);
    expect(await db.queue_ops.count()).toBe(1);
  });

  it.each(["conflict", "captured", "mixed", "evidence", "foreign_evidence", "foreign_record"])("does not rearm %s", async reason => {
    if (reason === "conflict") await db.queue_gestures.update(txId, { last_error: "STATE_REVISION_CONFLICT:stale" });
    if (reason === "captured") await db.queue_ops.update("op", { expected_revision: 1 });
    if (reason === "mixed") await db.queue_ops.put({ ...(await db.queue_ops.get("op"))!, client_op_id: "other", table: "eventos", action: "INSERT" });
    if (reason === "evidence") await db.queue_rejections.clear();
    if (reason === "foreign_evidence") await db.queue_rejections.toCollection().modify({ fazenda_id: "other" });
    if (reason === "foreign_record") await db.queue_ops.update("op", { record: { id: animalId, fazenda_id: "other" } });
    await resumeTestFarmMissingRevision(farmId, txId, validateContext);
    expect(pull.pullDataForFarm).not.toHaveBeenCalled();
    expect((await db.queue_ops.get("op"))?.sync_state).toBe("REJECTED");
  });

  it("rejects another farm's gesture before any pull or mutation", async () => {
    await expect(resumeTestFarmMissingRevision("other", txId, validateContext)).rejects.toThrow("FARM_MISMATCH");
    expect(pull.pullDataForFarm).not.toHaveBeenCalled();
    expect((await db.queue_ops.get("op"))?.sync_state).toBe("REJECTED");
  });

  it("does not enqueue duplicate operations under concurrent recovery", async () => {
    const outcomes = await Promise.allSettled([
      resumeTestFarmMissingRevision(farmId, txId, validateContext),
      resumeTestFarmMissingRevision(farmId, txId, validateContext),
    ]);
    expect(outcomes.some(result => result.status === "fulfilled")).toBe(true);
    expect(await db.queue_ops.count()).toBe(1);
    expect(await db.queue_ops.get("op")).toMatchObject({ expected_revision: 3, sync_state: "PENDING", retry_count: 1 });
    expect(await db.queue_rejections.count()).toBe(1);
  });

  it.each([
    { reason: "offline", prepare: () => vi.mocked(pull.pullDataForFarm).mockRejectedValueOnce(new Error("OFFLINE")) },
    { reason: "auth", prepare: () => validateContext.mockRejectedValueOnce(new Error("TEST_FARM_AUTH_REQUIRED")) },
    { reason: "switch", prepare: () => validateContext.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("TEST_FARM_ACTIVE_FARM_CHANGED")) },
    { reason: "missing_revision", prepare: () => vi.mocked(pull.pullDataForFarm).mockResolvedValueOnce(undefined) },
    { reason: "foreign_snapshot", prepare: () => vi.mocked(pull.pullDataForFarm).mockImplementationOnce(async () => {
      await db.state_animais.update(animalId, { revision: 3, fazenda_id: "other" });
    }) },
    { reason: "deleted", prepare: () => vi.mocked(pull.pullDataForFarm).mockImplementationOnce(async () => {
      await db.state_animais.update(animalId, { revision: 3, deleted_at: "2026-11-06" });
    }) },
  ])("preserves the rejection after $reason and can resume after reconnect", async ({ prepare }) => {
    prepare();
    await expect(resumeTestFarmMissingRevision(farmId, txId, validateContext)).rejects.toThrow();
    expect((await db.queue_gestures.get(txId))?.status).toBe("REJECTED");
    expect((await db.queue_ops.get("op"))?.expected_revision).toBeUndefined();
    expect(await db.queue_rejections.count()).toBe(1);
    await db.state_animais.update(animalId, { fazenda_id: farmId, deleted_at: null });
    await resumeTestFarmMissingRevision(farmId, txId, validateContext);
    expect((await db.queue_ops.get("op"))?.expected_revision).toBe(3);
  });
});
