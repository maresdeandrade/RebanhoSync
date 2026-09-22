/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../useAuth";
import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { supabase } from "@/lib/supabase";

function AuthProbe() {
  const { loading, localOwnership, session } = useAuth();
  return (
    <div>
      <span>{loading ? "loading" : "ready"}</span>
      <span>{localOwnership?.status ?? "no-decision"}</span>
      <span>{session?.user.id ?? "no-operational-session"}</span>
    </div>
  );
}

beforeEach(async () => {
  await db.local_ownership.clear();
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: null,
    updated_at: "2026-09-21T12:00:00.000Z",
  });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.local_ownership.clear();
});

describe("AuthProvider UNKNOWN recovery state", () => {
  it("exposes UNKNOWN to the global boundary without authorizing an operational session", async () => {
    const authenticatedSession = {
      user: { id: "user-current" },
    };
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: authenticatedSession },
      error: null,
    } as never);
    vi.spyOn(supabase.auth, "onAuthStateChange").mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as never);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getByText("no-operational-session")).toBeInTheDocument();
  });
});
