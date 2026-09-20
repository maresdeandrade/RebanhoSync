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
  await db.local_ownership.clear();
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
