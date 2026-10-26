import { isLocalTestFarmBackend, isLocalTestFarmHost } from "./environment";
import { testFarmConsoleApi } from "./service";


export function installTestFarmDevConsole() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  if (!isLocalTestFarmHost(window.location.hostname) || !isLocalTestFarmBackend(
    import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_FUNCTIONS_URL,
  )) return false;
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
