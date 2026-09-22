import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, LOCAL_OWNERSHIP_KEY, OfflineDB } from "../db";
import {
  establishLocalOwnership,
  evaluateLocalOwnership,
} from "../ownership";
import {
  canReadLocalData,
  canReadLocalTable,
  isGlobalReadTable,
  isTenantSensitiveReadTable,
} from "../localReadBoundary";
import { supabase } from "@/lib/supabase";

const session = (userId: string) =>
  ({ user: { id: userId } }) as Parameters<
    typeof establishLocalOwnership
  >[0];

beforeEach(async () => {
  await Promise.all([
    db.local_ownership.clear(),
    db.queue_gestures.clear(),
    db.queue_ops.clear(),
    db.queue_rejections.clear(),
    db.event_eventos.clear(),
    db.ops_sanitario_agenda_closures_v2.clear(),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local ownership", () => {
  it("establishes ownership from the canonical auth user id", async () => {
    await expect(establishLocalOwnership(session("user-a"))).resolves.toEqual({
      status: "OWNED",
      ownerUserId: "user-a",
      currentUserId: "user-a",
    });
  });

  it("fails closed for a different user", async () => {
    await establishLocalOwnership(session("user-a"));

    await expect(evaluateLocalOwnership("user-b")).resolves.toEqual({
      status: "MISMATCH",
      ownerUserId: "user-a",
      currentUserId: "user-b",
    });
  });

  it("preserves owner provenance across logout and allows only same-user resume", async () => {
    await establishLocalOwnership(session("user-a"));

    await expect(evaluateLocalOwnership(null)).resolves.toEqual({
      status: "MISMATCH",
      ownerUserId: "user-a",
      currentUserId: null,
    });
    await expect(evaluateLocalOwnership("user-a")).resolves.toEqual({
      status: "OWNED",
      ownerUserId: "user-a",
      currentUserId: "user-a",
    });
    await expect(evaluateLocalOwnership("user-b")).resolves.toEqual({
      status: "MISMATCH",
      ownerUserId: "user-a",
      currentUserId: "user-b",
    });
  });

  it("keeps unknown ownership fail-closed even with an authenticated session", async () => {
    await db.local_ownership.put({
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: null,
      updated_at: "2026-09-19T12:00:00.000Z",
    });

    await expect(establishLocalOwnership(session("user-a"))).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: "user-a",
    });
    await expect(evaluateLocalOwnership("user-a")).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: "user-a",
    });
    await expect(establishLocalOwnership(session("user-b"))).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: "user-b",
    });
    await expect(db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).resolves.toMatchObject({
      owner_user_id: null,
    });
  });

  it("does not treat queue, client, or same-farm membership fields as owner proof", async () => {
    const userA = "00000000-0000-4000-8000-00000000000a";
    const userB = "00000000-0000-4000-8000-00000000000b";
    const farmId = "00000000-0000-4000-8000-00000000000f";

    await db.local_ownership.put({
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: null,
      updated_at: "2026-09-19T12:00:00.000Z",
    });
    await db.queue_gestures.put({
      client_tx_id: "tx-legacy-membership",
      fazenda_id: farmId,
      client_id: "browser:device-shared-by-a-and-b",
      status: "PENDING",
      created_at: "2026-09-18T10:00:00.000Z",
    });
    await db.queue_ops.put({
      client_op_id: "op-legacy-membership",
      client_tx_id: "tx-legacy-membership",
      table: "user_fazendas",
      action: "INSERT",
      record: {
        user_id: userB,
        invited_by: userA,
        fazenda_id: farmId,
      },
      created_at: "2026-09-18T10:00:00.000Z",
    });
    await db.queue_rejections.add({
      client_tx_id: "tx-legacy-membership",
      client_op_id: "op-legacy-membership",
      fazenda_id: farmId,
      table: "user_fazendas",
      action: "INSERT",
      reason_code: "LEGACY_REJECTION",
      reason_message: "legacy membership payload",
      created_at: "2026-09-18T10:01:00.000Z",
      payload: { user_id: userB, invited_by: userA },
    });

    await expect(establishLocalOwnership(session(userB))).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: userB,
    });
    await expect(db.queue_gestures.get("tx-legacy-membership")).resolves.toMatchObject({
      client_id: "browser:device-shared-by-a-and-b",
      fazenda_id: farmId,
      status: "PENDING",
    });
    await expect(db.queue_ops.get("op-legacy-membership")).resolves.toMatchObject({
      client_op_id: "op-legacy-membership",
      client_tx_id: "tx-legacy-membership",
    });
    await expect(db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).resolves.toMatchObject({
      owner_user_id: null,
    });
  });

  it("does not treat domain actor fields as owner proof", async () => {
    const actorUserId = "00000000-0000-4000-8000-00000000000b";
    const farmId = "00000000-0000-4000-8000-00000000000f";

    await db.local_ownership.put({
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: null,
      updated_at: "2026-09-19T12:00:00.000Z",
    });
    await db.table("event_eventos").put({
      id: "event-created-by-b",
      fazenda_id: farmId,
      payload: { created_by: actorUserId },
    });
    await db.table("ops_sanitario_agenda_closures_v2").put({
      id: "closure-by-b",
      fazenda_id: farmId,
      closed_by: actorUserId,
    });

    await expect(establishLocalOwnership(session(actorUserId))).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: actorUserId,
    });
    await expect(db.local_ownership.get(LOCAL_OWNERSHIP_KEY)).resolves.toMatchObject({
      owner_user_id: null,
    });
  });

  it("does not accept an access token without session.user.id", async () => {
    await db.local_ownership.put({
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: null,
      updated_at: "2026-09-19T12:00:00.000Z",
    });
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { access_token: "token-without-user" } } as never,
      error: null,
    });

    await expect(canReadLocalData()).resolves.toBe(false);
  });

  it("marks a legacy v30 database as unknown during the v31 upgrade", async () => {
    const databaseName = `RebanhoSync-legacy-${crypto.randomUUID()}`;
    const legacyDb = new Dexie(databaseName);
    legacyDb.version(30).stores({ state_animais: "id, fazenda_id" });
    await legacyDb.table("state_animais").put({
      id: "animal-legacy",
      fazenda_id: "farm-legacy",
    });
    legacyDb.close();

    const upgradedDb = new OfflineDB(databaseName);
    try {
      await upgradedDb.open();
      await expect(
        upgradedDb.local_ownership.get(LOCAL_OWNERSHIP_KEY),
      ).resolves.toMatchObject({ owner_user_id: null });
      await expect(upgradedDb.state_animais.get("animal-legacy")).resolves.toBeDefined();
    } finally {
      upgradedDb.close();
      await Dexie.delete(databaseName);
    }
  });

  it("allows tenant reads only for the compatible owner", async () => {
    await establishLocalOwnership(session("user-a"));
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { user: { id: "user-a" } } } as never,
      error: null,
    });

    await expect(canReadLocalData()).resolves.toBe(true);
    await expect(canReadLocalTable("state_animais")).resolves.toBe(true);
    await expect(canReadLocalTable("event_eventos")).resolves.toBe(true);
    await expect(canReadLocalTable("state_agenda_itens")).resolves.toBe(true);
  });

  it("blocks tenant reads for another user on the same farm", async () => {
    await establishLocalOwnership(session("user-a"));
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { user: { id: "user-b" } } } as never,
      error: null,
    });

    await expect(canReadLocalData()).resolves.toBe(false);
    await expect(canReadLocalTable("state_animais")).resolves.toBe(false);
    await expect(canReadLocalTable("event_eventos")).resolves.toBe(false);
    await expect(canReadLocalTable("state_agenda_itens")).resolves.toBe(false);
    await expect(canReadLocalTable("sync_pull_cursors")).resolves.toBe(false);
    await expect(canReadLocalTable("sync_reconcile_obligations")).resolves.toBe(
      false,
    );
  });

  it("keeps global catalogs outside the tenant ownership gate", async () => {
    await establishLocalOwnership(session("user-a"));
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { user: { id: "user-b" } } } as never,
      error: null,
    });

    expect(isTenantSensitiveReadTable("state_animais")).toBe(true);
    expect(isTenantSensitiveReadTable("event_eventos")).toBe(true);
    expect(isGlobalReadTable("catalog_protocolos_oficiais")).toBe(true);
    await expect(canReadLocalTable("catalog_protocolos_oficiais")).resolves.toBe(
      true,
    );
  });
});
