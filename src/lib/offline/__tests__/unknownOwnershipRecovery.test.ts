/** @vitest-environment jsdom */
import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getActiveFarmId, setActiveFarmId } from "@/lib/storage";

import { db, LOCAL_OWNERSHIP_KEY } from "../db";
import { establishLocalOwnership, evaluateLocalOwnership } from "../ownership";
import { stopSyncWorker } from "../syncWorker";
import {
  resetUnknownLocalDatabase,
  UNKNOWN_LOCAL_RESET_CONFIRMATION,
  UnknownLocalResetError,
} from "../unknownOwnershipRecovery";

vi.mock("../syncWorker", () => ({
  stopSyncWorker: vi.fn(),
}));

const session = (userId: string) =>
  ({ user: { id: userId } }) as Parameters<
    typeof establishLocalOwnership
  >[0];

async function seedUnknownDatabase() {
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: null,
    updated_at: "2026-09-21T12:00:00.000Z",
  });
  await db.table("state_animais").put({
    id: "animal-legacy-unknown",
    fazenda_id: "farm-legacy-unknown",
  });
  await db.queue_gestures.put({
    client_tx_id: "tx-legacy-unknown",
    fazenda_id: "farm-legacy-unknown",
    client_id: "browser:legacy-unknown",
    status: "PENDING",
    created_at: "2026-09-21T12:00:00.000Z",
  });
  await db.queue_ops.put({
    client_op_id: "op-legacy-unknown",
    client_tx_id: "tx-legacy-unknown",
    table: "animais",
    action: "UPDATE",
    record: {
      id: "animal-legacy-unknown",
      fazenda_id: "farm-legacy-unknown",
    },
    created_at: "2026-09-21T12:00:00.000Z",
  });
}

beforeEach(async () => {
  db.close();
  await Dexie.delete(db.name);
  await db.open();
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
  localStorage.clear();
});

describe("explicit UNKNOWN local database recovery", () => {
  it("T1 — keeps UNKNOWN data intact without destructive confirmation", async () => {
    await seedUnknownDatabase();
    setActiveFarmId("farm-legacy-unknown");
    const reload = vi.fn();

    await expect(resetUnknownLocalDatabase({ reload })).resolves.toBe(
      "CANCELLED",
    );

    await expect(db.table("state_animais").count()).resolves.toBe(1);
    await expect(db.queue_gestures.count()).resolves.toBe(1);
    await expect(db.queue_ops.count()).resolves.toBe(1);
    await expect(evaluateLocalOwnership("user-a")).resolves.toMatchObject({
      status: "UNKNOWN",
    });
    expect(getActiveFarmId()).toBe("farm-legacy-unknown");
    expect(stopSyncWorker).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("T2 — deletes the whole legacy database and is repeat-safe", async () => {
    await seedUnknownDatabase();
    setActiveFarmId("farm-legacy-unknown");
    const reload = vi.fn();

    await expect(
      resetUnknownLocalDatabase({
        confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
        reload,
      }),
    ).resolves.toBe("DATABASE_DELETED");

    await expect(Dexie.exists(db.name)).resolves.toBe(false);
    expect(getActiveFarmId()).toBeNull();
    expect(stopSyncWorker).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);

    await db.open();
    await expect(db.table("state_animais").count()).resolves.toBe(0);
    await expect(db.queue_gestures.count()).resolves.toBe(0);
    await expect(db.queue_ops.count()).resolves.toBe(0);

    await expect(
      resetUnknownLocalDatabase({
        confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
        reload,
      }),
    ).resolves.toBe("DATABASE_DELETED");
    await expect(Dexie.exists(db.name)).resolves.toBe(false);
  });

  it("T3 — lets the canonical bootstrap own only the fresh database", async () => {
    await seedUnknownDatabase();

    await resetUnknownLocalDatabase({
      confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
      reload: vi.fn(),
    });
    await db.open();

    await expect(db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).resolves.toBeUndefined();
    await expect(establishLocalOwnership(session("user-current"))).resolves.toEqual({
      status: "OWNED",
      ownerUserId: "user-current",
      currentUserId: "user-current",
    });
  });

  it("T4 — refuses the UNKNOWN reset for MISMATCH", async () => {
    await establishLocalOwnership(session("user-a"));
    await db.table("state_animais").put({
      id: "animal-owned-by-a",
      fazenda_id: "farm-a",
    });

    await expect(
      resetUnknownLocalDatabase({
        confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
        reload: vi.fn(),
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<UnknownLocalResetError>>({
      name: "UnknownLocalResetError",
      ownershipStatus: "MISMATCH",
    }));

    await expect(db.table("state_animais").count()).resolves.toBe(1);
    await expect(Dexie.exists(db.name)).resolves.toBe(true);
    expect(stopSyncWorker).not.toHaveBeenCalled();
  });

  it("T5 — does not assign an owner when bootstrap has no session", async () => {
    await seedUnknownDatabase();

    await resetUnknownLocalDatabase({
      confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
      reload: vi.fn(),
    });
    await db.open();

    await expect(evaluateLocalOwnership(null)).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: null,
    });
    await expect(db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).resolves.toBeUndefined();
  });
});
