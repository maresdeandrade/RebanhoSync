import { isLocalTestFarmBackend } from "../environment";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installTestFarmDevConsole } from "../devConsole";

vi.mock("../service", () => ({ testFarmConsoleApi: { dryRun: () => ({ animalCount: 120 }) } }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("test farm console exposure", () => {
  it.each([
    [false, "localhost", "http://127.0.0.1:54321"],
    [true, "example.test", "http://127.0.0.1:54321"],
    [true, "localhost", "https://example.supabase.co"],
    [true, "localhost", "http://localhost.evil.test"],
    [true, "localhost", "invalid-url"],
  ])("keeps the seed API unavailable for DEV=%s browser=%s backend=%s", (development, host, backend) => {
    vi.stubEnv("DEV", development);
    vi.stubEnv("VITE_SUPABASE_URL", backend);
    const browser = { location: { hostname: host } };
    vi.stubGlobal("window", browser);
    expect(installTestFarmDevConsole()).toBe(false);
    expect(browser).not.toHaveProperty("__REBANHOSYNC_TEST_FARM__");
  });

  it.each(["https://example.supabase.co/functions/v1", "invalid-url", "http://127.0.0.1:54322/functions/v1"])("does not expose writers with mismatched Functions endpoint %s", (functionsUrl) => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", functionsUrl);
    const browser = { location: { hostname: "localhost" } };
    vi.stubGlobal("window", browser);
    expect(installTestFarmDevConsole()).toBe(false);
    expect(browser).not.toHaveProperty("__REBANHOSYNC_TEST_FARM__");
  });

  it("exposes a frozen hidden API locally and safely tolerates repeated installation", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://[::1]:54321");
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "http://[::1]:54321/functions/v1");
    const browser = { location: { hostname: "[::1]" } };
    vi.stubGlobal("window", browser);
    expect(installTestFarmDevConsole()).toBe(true);
    const descriptor = Object.getOwnPropertyDescriptor(browser, "__REBANHOSYNC_TEST_FARM__")!;
    expect(descriptor).toMatchObject({ enumerable: false, configurable: false, writable: false });
    expect(Object.isFrozen(descriptor.value)).toBe(true);
    expect(descriptor.value.dryRun()).toEqual({ animalCount: 120 });
    expect(installTestFarmDevConsole()).toBe(true);
  });
});


it("accepts only coherent local data and sync origins", () => {
  expect(isLocalTestFarmBackend("http://127.0.0.1:54321", "http://127.0.0.1:54321/functions/v1")).toBe(true);
  expect(isLocalTestFarmBackend("file://127.0.0.1", "file://127.0.0.1/functions/v1")).toBe(false);
});
