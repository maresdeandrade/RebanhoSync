import { useSyncExternalStore } from "react";

type Auth = {
  activeFarmId: string | null;
  session: { user: { id: string } } | null;
  role: string | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
};
let state: Auth = {
  activeFarmId: localStorage.getItem("ux17-farm") || "farm-a",
  session: { user: { id: "ux17-browser-user" } },
  role: "manager",
  loading: false,
  refreshSettings: async () => {},
};
const listeners = new Set<() => void>();
export function useAuth() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}
export function setFixtureAuth(patch: Partial<Auth>) {
  state = { ...state, ...patch };
  localStorage.setItem("ux17-farm", state.activeFarmId || "");
  listeners.forEach((listener) => listener());
}
