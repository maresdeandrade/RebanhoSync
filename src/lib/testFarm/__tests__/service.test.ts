import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestFarmDefinition, TEST_FARM_SPEC, validateTestFarmDefinition } from "../definition";
import { supabase } from "@/lib/supabase";
import { buildTestFarmAnimalRegistration, dryRunTestFarm, provisionTestFarm } from "../service";

describe("test farm local service", () => {
  it("does not claim a commercial purchase for root stock with unknown provenance", () => {
    const definition = createTestFarmDefinition();
    const root = definition.animals.find(animal => animal.category === "touro")!;
    const record = buildTestFarmAnimalRegistration(root, "farm", definition);
    expect(record.origem).toBeNull();
    expect(record.id).toBe(root.id);
    expect(record.fazenda_id).toBe("farm");
  });
  it("reports a validated deterministic 120-animal plan without executing sanitary facts", () => {
    const definition = createTestFarmDefinition();
    const dryRun = dryRunTestFarm();

    expect(validateTestFarmDefinition(definition)).toEqual([]);
    expect(dryRun).toMatchObject({
      environment: "local-development-only",
      logicalId: TEST_FARM_SPEC.logicalId,
      animalCount: 120,
      genealogy: {
        birthEvents: 84,
        pregnancies: 10,
        negativeDiagnoses: 6,
        gestationalLosses: 2,
      },
      rootAnimalCount: 36,
      plannedAgendaItems: 252,
      plannedWeightEvents: 240,
      plannedMovementEvents: 28,
      sanitaryExecutionCount: 0,
      integrityIssues: [],
    });
    expect(dryRunTestFarm()).toEqual(dryRun);
  });

  it("refuses provisioning outside a local browser development session", async () => {
    await expect(provisionTestFarm()).rejects.toThrow("TEST_FARM_LOCAL_DEVELOPMENT_ONLY");
  });
});


describe("test farm environment and authentication boundary", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it.each(["https://example.com", "http://localhost.evil.example", "invalid-url"])("refuses backend %s before contacting auth", async (url) => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", url);
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const auth = vi.spyOn(supabase.auth, "getUser");
    await expect(provisionTestFarm()).rejects.toThrow("TEST_FARM_LOCAL_BACKEND_REQUIRED");
    expect(auth).not.toHaveBeenCalled();
  });

  it("accepts any authenticated local owner account without a hardcoded personal email", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    vi.stubGlobal("navigator", {});
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({ data: { user: { id: "local-owner", email: "owner@example.test" } }, error: null } as never);
    await expect(provisionTestFarm()).rejects.toThrow("TEST_FARM_CREATION_LOCK_UNAVAILABLE");
  });
});
