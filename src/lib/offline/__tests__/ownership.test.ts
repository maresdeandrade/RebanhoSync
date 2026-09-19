import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { db } from "../db";
import {
  clearLocalOwnership,
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

afterEach(async () => {
  await db.local_ownership.clear();
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

  it("does not adopt unknown ownership after logout", async () => {
    await establishLocalOwnership(session("user-a"));
    await clearLocalOwnership();

    await expect(evaluateLocalOwnership("user-b")).resolves.toEqual({
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: "user-b",
    });
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