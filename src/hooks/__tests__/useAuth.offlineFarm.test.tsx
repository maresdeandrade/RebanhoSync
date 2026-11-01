// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const remote = vi.hoisted(() => ({
  online: true, user: "owner", role: "manager" as string | null,
  session: true, onAuth: null as null | ((event: string, session: unknown) => void),
  waitRole: null as null | ((farm: string) => Promise<void>),
}));
vi.mock("@/lib/theme", () => ({ applyTheme: vi.fn() }));
vi.mock("@/lib/admin/adminApi", () => ({ checkIsSuperAdmin: async () => false }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: remote.session ? { user: { id: remote.user } } : null } }),
    getUser: async () => remote.online ? { data: { user: { id: remote.user } }, error: null }
      : { data: { user: null }, error: { message: "Failed to fetch", status: 0 } },
    signOut: async () => { remote.session = false; remote.onAuth?.("SIGNED_OUT", null); return { error: null }; },
    onAuthStateChange: (cb: typeof remote.onAuth) => { remote.onAuth = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: (table: string) => {
    let farm = "";
    const query = {
      select: () => query, eq: (key: string, value: string) => { if (key === "id" || key === "fazenda_id") farm = value; return query; }, is: () => query,
      limit: async () => ({ data: [], error: null }), upsert: async () => ({ error: null }),
      maybeSingle: async () => { if (table === "user_fazendas" && remote.waitRole) await remote.waitRole(farm); return !remote.online ? { data: null, error: { message: "Failed to fetch", status: 0 } }
        : { error: null, data: table === "user_fazendas" ? (remote.role ? { role: remote.role } : null)
          : table === "user_settings" ? { active_fazenda_id: "farm-A" }
          : { metadata: { app_experience: { mode: farm === "farm-B" ? "essencial" : "completo" } } } }; },
    }; return query;
  },
} }));
import { AuthProvider, useAuth } from "../useAuth";
import { db } from "@/lib/offline/db";
import { setActiveFarmId } from "@/lib/storage";
import { createGesture } from "@/lib/offline/ops";
import { deferred } from "@/pages/Insumos/__tests__/fixtures/inventorySnapshotHarness";
beforeEach(async () => {
  await db.open(); remote.online = true; remote.user = "owner"; remote.role = "manager"; remote.session = true;
  remote.waitRole = null;
  setActiveFarmId("farm-A");
});
afterEach(async () => { cleanup(); await db.delete(); localStorage.clear(); });
const mount = () => renderHook(() => useAuth(), { wrapper: AuthProvider });
async function authorize() {
  const hook = mount(); await waitFor(() => expect(hook.result.current.farmExperienceMode).toBe("completo"));
  hook.unmount(); db.close(); await db.open(); remote.online = false;
}
it("reopens the previously authorized farm after Dexie restart without the API", async () => {
  await authorize(); const { result } = mount();
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.activeFarmId).toBe("farm-A"); expect(result.current.role).toBe("manager");
  expect(result.current.farmExperienceMode).toBe("completo");
});
it("does not trust a local farm ID without a previously validated membership", async () => {
  remote.online = false; const { result } = mount();
  await waitFor(() => expect(result.current.loading).toBe(false)); expect(result.current.role).toBeNull();
});
it("does not expose the previous identity context to a different user", async () => {
  await authorize(); remote.user = "other"; const { result } = mount();
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.session).toBeNull(); expect(result.current.role).toBeNull();
  expect(result.current.localOwnership?.status).toBe("MISMATCH");
});
it("invalidates the offline membership after a remote revocation and preserves ownership", async () => {
  await authorize(); remote.online = true; remote.role = null;
  const online = mount(); await waitFor(() => expect(online.result.current.loading).toBe(false));
  expect(online.result.current.role).toBeNull(); online.unmount();
  remote.online = false; setActiveFarmId("farm-A"); const offline = mount();
  await waitFor(() => expect(offline.result.current.loading).toBe(false));
  expect(offline.result.current.role).toBeNull();
  expect(offline.result.current.localOwnership?.ownerUserId).toBe("owner");
});
it("logout prevents offline recovery even when an old session is supplied again", async () => {
  const hook = mount(); await waitFor(() => expect(hook.result.current.role).toBe("manager"));
  await act(async () => { await hook.result.current.signOut(); }); hook.unmount();
  remote.online = false; remote.session = true; setActiveFarmId("farm-A"); const offline = mount();
  await waitFor(() => expect(offline.result.current.loading).toBe(false)); expect(offline.result.current.role).toBeNull();
});
it("restores only the selected farm's role across restart without changing either farm's queue", async () => {
  const online = mount(); await waitFor(() => expect(online.result.current.role).toBe("manager"));
  const first = await createGesture("farm-A", [{ table: "lotes", action: "INSERT", record: { id: "lot-A", fazenda_id: "farm-A" } }]);
  remote.role = "cowboy";
  await act(async () => { await online.result.current.setActiveFarm("farm-B"); });
  expect(online.result.current.role).toBe("cowboy");
  const second = await createGesture("farm-B", [{ table: "lotes", action: "INSERT", record: { id: "lot-B", fazenda_id: "farm-B" } }]);
  const before = await db.queue_ops.toArray(); online.unmount(); remote.online = false;
  db.close(); await db.open(); const offline = mount();
  await waitFor(() => expect(offline.result.current.loading).toBe(false));
  expect(offline.result.current.activeFarmId).toBe("farm-B"); expect(offline.result.current.role).toBe("cowboy");
  expect((await db.queue_gestures.get(first))?.fazenda_id).toBe("farm-A");
  expect((await db.queue_gestures.get(second))?.fazenda_id).toBe("farm-B");
  expect(await db.queue_ops.toArray()).toEqual(before);
});
it("a late farm B membership cannot replace farm A configuration after switching back", async () => {
  const { result } = mount(); await waitFor(() => expect(result.current.farmExperienceMode).toBe("completo"));
  const delayed = deferred<void>(); remote.waitRole = async farm => { if (farm === "farm-B") await delayed.promise; };
  let selecting!: Promise<void>; act(() => { selecting = result.current.setActiveFarm("farm-B"); });
  await waitFor(() => expect(result.current.activeFarmId).toBe("farm-B"));
  await act(async () => { await result.current.setActiveFarm("farm-A"); });
  await act(async () => { delayed.resolve(); await selecting; });
  expect(result.current.activeFarmId).toBe("farm-A"); expect(result.current.farmExperienceMode).toBe("completo");
});
