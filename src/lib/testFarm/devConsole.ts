import { testFarmConsoleApi } from "./service";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function installTestFarmDevConsole() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  if (!LOCAL_HOSTS.has(window.location.hostname)) return false;
  try {
    if (!LOCAL_HOSTS.has(new URL(import.meta.env.VITE_SUPABASE_URL).hostname)) return false;
  } catch { return false; }
  if (window.__REBANHOSYNC_TEST_FARM__) return true;

  Object.defineProperty(window, "__REBANHOSYNC_TEST_FARM__", {
    configurable: false,
    enumerable: false,
    value: Object.freeze(testFarmConsoleApi),
    writable: false,
  });
  return true;
}

declare global {
  interface Window {
    __REBANHOSYNC_TEST_FARM__?: typeof testFarmConsoleApi;
  }
}
