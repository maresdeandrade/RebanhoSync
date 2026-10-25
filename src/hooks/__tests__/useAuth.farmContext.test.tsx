// @vitest-environment jsdom
import "fake-indexeddb/auto";
import {
  act,
  cleanup,
  renderHook,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferred } from "@/pages/Insumos/__tests__/fixtures/inventorySnapshotHarness";
const remote = vi.hoisted(() => ({
  role: null as null | ((farm: string) => Promise<object>),
  onAuth: null as
    | null
    | ((event: string, session: { user: { id: string } } | null) => void),
  getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
}));
vi.mock("@/lib/admin/adminApi", () => ({
  checkIsSuperAdmin: async () => false,
}));
vi.mock("@/lib/theme", () => ({ applyTheme: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
      getUser: remote.getUser,
      onAuthStateChange: (callback: NonNullable<typeof remote.onAuth>) => {
        remote.onAuth = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: (table: string) => {
      let farm = "";
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === "fazenda_id") farm = value;
          return query;
        },
        is: () => query,
        upsert: async () => ({ error: null }),
        maybeSingle: async () => {
          if (table === "user_settings")
            return { data: { active_fazenda_id: "A" }, error: null };
          if (table === "user_fazendas")
            return remote.role
              ? remote.role(farm)
              : { data: { role: "owner" }, error: null };
          return { data: { metadata: {} }, error: null };
        },
      };
      return query;
    },
  },
}));
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireFarm } from "@/components/auth/RequireFarm";
import { AuthProvider, useAuth } from "../useAuth";
import { db } from "@/lib/offline/db";
beforeEach(async () => {
  await db.open();
});
afterEach(async () => {
  cleanup();
  await db.delete();
  localStorage.clear();
  remote.role = null;
  vi.clearAllMocks();
});
it("clears A role while B is loading and ignores late B after switching back to A (#242)", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.role).toBe("owner"));
  const delayed = deferred<object>();
  remote.role = (farm) =>
    farm === "B"
      ? delayed.promise
      : Promise.resolve({ data: { role: "manager" }, error: null });
  let changeB!: Promise<void>;
  act(() => {
    changeB = result.current.setActiveFarm("B");
  });
  await waitFor(() => expect(result.current.activeFarmId).toBe("B"));
  expect(result.current.role).toBeNull();
  await act(async () => {
    await result.current.setActiveFarm("A");
  });
  expect(result.current.role).toBe("manager");
  await act(async () => {
    delayed.resolve({ data: { role: "cowboy" }, error: null });
    await changeB;
  });
  expect(result.current.activeFarmId).toBe("A");
  expect(result.current.role).toBe("manager");
});

it("does not let RequireFarm recovery revert an explicit B selection while its role is pending", async () => {
  let latest!: ReturnType<typeof useAuth>;
  function Probe() {
    latest = useAuth();
    return null;
  }
  render(
    <AuthProvider>
      <Probe />
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <RequireFarm>
                <span>inventory</span>
              </RequireFarm>
            }
          />
          <Route path="/select-fazenda" element={<span>selection</span>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
  await waitFor(() => expect(latest.role).toBe("owner"));
  const delayed = deferred<object>();
  remote.role = vi.fn((farm) =>
    farm === "B"
      ? delayed.promise
      : Promise.resolve({ data: { role: "owner" }, error: null }),
  );
  let change!: Promise<void>;
  await act(async () => {
    change = latest.setActiveFarm("B");
    // Drain the real provider/recovery promise chain while B remains unresolved.
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
  const during = { farm: latest.activeFarmId, role: latest.role };
  await act(async () => {
    delayed.resolve({ data: { role: "cowboy" }, error: null });
    await change;
  });
  expect(during).toEqual({ farm: "B", role: null });
  expect(latest.activeFarmId).toBe("B");
  expect(latest.role).toBe("cowboy");
});

it("keeps selection loading through token refresh and ignores settings recovery until B settles", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.role).toBe("owner"));
  const delayed = deferred<object>();
  remote.role = (farm) =>
    farm === "B"
      ? delayed.promise
      : Promise.resolve({ data: { role: "owner" }, error: null });
  let change!: Promise<void>;
  act(() => {
    change = result.current.setActiveFarm("B");
  });
  await waitFor(() => expect(result.current.activeFarmId).toBe("B"));
  const requests = remote.getUser.mock.calls.length;
  const renewedSession = { user: { id: "user-1" } };
  await act(async () => {
    remote.onAuth!("TOKEN_REFRESHED", renewedSession);
    await result.current.refreshSettings();
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
  await waitFor(() => expect(result.current.session).toBe(renewedSession));
  expect(result.current.loading).toBe(true);
  expect(result.current.activeFarmId).toBe("B");
  expect(remote.getUser.mock.calls.length).toBe(requests);
  await act(async () => {
    delayed.resolve({ data: { role: "cowboy" }, error: null });
    await change;
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.role).toBe("cowboy");
});
it("releases the transition on role-query failure and permits retry after reconnect", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.role).toBe("owner"));
  remote.role = async () => ({ data: null, error: { message: "offline" } });
  await act(async () => {
    await result.current.setActiveFarm("B");
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.role).toBeNull();
  remote.role = async () => ({ data: { role: "manager" }, error: null });
  await act(async () => {
    window.dispatchEvent(new Event("online"));
    await result.current.setActiveFarm("B");
  });
  expect(result.current.activeFarmId).toBe("B");
  expect(result.current.role).toBe("manager");
  expect(result.current.loading).toBe(false);
});
it("clears the pending transition on session expiration and rejects its late role response", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.role).toBe("owner"));
  const delayed = deferred<object>();
  remote.role = () => delayed.promise;
  let change!: Promise<void>;
  act(() => {
    change = result.current.setActiveFarm("B");
  });
  await waitFor(() => expect(result.current.activeFarmId).toBe("B"));
  act(() => {
    remote.onAuth!("SIGNED_OUT", null);
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.session).toBeNull();
  await act(async () => {
    delayed.resolve({ data: { role: "owner" }, error: null });
    await change;
  });
  expect(result.current.activeFarmId).toBeNull();
  expect(result.current.role).toBeNull();
});

it("ends a pending transition when another session is rejected by local ownership", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.role).toBe("owner"));
  const delayed = deferred<object>();
  remote.role = () => delayed.promise;
  let change!: Promise<void>;
  act(() => {
    change = result.current.setActiveFarm("B");
  });
  await waitFor(() => expect(result.current.activeFarmId).toBe("B"));
  act(() => {
    remote.onAuth!("SIGNED_IN", { user: { id: "user-2" } });
  });
  await waitFor(() =>
    expect(result.current.localOwnership?.status).toBe("MISMATCH"),
  );
  expect(result.current.session).toBeNull();
  expect(result.current.loading).toBe(false);
  await act(async () => {
    delayed.resolve({ data: { role: "owner" }, error: null });
    await change;
  });
  expect(result.current.role).toBeNull();
});
