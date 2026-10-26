import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestFarmDefinition, TEST_FARM_SPEC, validateTestFarmDefinition } from "../definition";
import { db } from "@/lib/offline/db";
import * as localReadBoundary from "@/lib/offline/localReadBoundary";
import * as storage from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { buildTestFarmAnimalRegistration, dryRunTestFarm, provisionTestFarm, verifyTestFarm } from "../service";

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

  it.each([
    "https://example.supabase.co/functions/v1", "invalid-url",
    "http://127.0.0.1:54322/functions/v1", "http://127.0.0.1:54321/other",
  ])("refuses mismatched Functions endpoint %s before contacting auth", async (functionsUrl) => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", functionsUrl);
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const auth = vi.spyOn(supabase.auth, "getUser");
    await expect(provisionTestFarm()).rejects.toThrow("TEST_FARM_LOCAL_BACKEND_REQUIRED");
    expect(auth).not.toHaveBeenCalled();
  });

  it("accepts any authenticated local owner account without a hardcoded personal email", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "http://127.0.0.1:54321/functions/v1");
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    vi.stubGlobal("navigator", {});
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({ data: { user: { id: "local-owner", email: "owner@example.test" } }, error: null } as never);
    await expect(provisionTestFarm()).rejects.toThrow("TEST_FARM_CREATION_LOCK_UNAVAILABLE");
  });
});


describe("test farm persisted verification", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  function authenticatedLocalOwner(role: string = "owner", membershipError: object | null = null) {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "http://127.0.0.1:54321/functions/v1");
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({ data: { user: { id: "owner" } }, error: null } as never);
    vi.spyOn(storage, "getActiveFarmId").mockReturnValue("farm");
    vi.spyOn(localReadBoundary, "requireTenantSensitiveAccess").mockResolvedValue();
    const query = {
      select: vi.fn().mockReturnThis(), match: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: { role }, error: membershipError })
        .mockResolvedValueOnce({ data: { id: "farm", nome: TEST_FARM_SPEC.name, codigo: TEST_FARM_SPEC.logicalId, tipo_producao: "corte" }, error: null }),
    };
    vi.spyOn(supabase, "from").mockReturnValue(query as never);
    return query;
  }

  it.each([
    ["manager", null, "TEST_FARM_OWNER_MEMBERSHIP_REQUIRED"],
    ["owner", { message: "unavailable" }, "TEST_FARM_MEMBERSHIP_LOOKUP_FAILED"],
  ])("refuses verification for role %s or membership errors", async (role, error, expectedError) => {
    const query = authenticatedLocalOwner(role, error);
    await expect(verifyTestFarm("farm")).rejects.toThrow(expectedError);
    expect(query.match).toHaveBeenCalledWith({ user_id: "owner", fazenda_id: "farm" });
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(localReadBoundary.requireTenantSensitiveAccess).not.toHaveBeenCalled();
  });

  it("reports missing, cross-farm and factually changed animals without accepting partial data", async () => {
    authenticatedLocalOwner();
    const definition = createTestFarmDefinition();
    const persisted = definition.animals.slice(0, 2).map((animal, index) => ({
      id: animal.id, fazenda_id: index === 0 ? "other-farm" : "farm",
      identificacao: animal.identification, sexo: animal.draft.sexo,
      data_nascimento: animal.draft.dataNascimento, mae_id: animal.draft.maeId,
      pai_id: animal.draft.paiId, raca: "changed-breed",
    }));
    vi.spyOn(db.state_animais, "bulkGet").mockResolvedValue(persisted as never);
    vi.spyOn(db.state_lotes, "bulkGet").mockResolvedValue([]);
    vi.spyOn(db.event_eventos, "bulkGet").mockResolvedValue([]);
    vi.spyOn(db.event_eventos_reproducao, "bulkGet").mockResolvedValue([]);
    const result = await verifyTestFarm("farm");
    expect(result.valid).toBe(false);
    expect(result.verifiedAnimals).toBe(1);
    expect(result.integrityIssues).toContain(`missing or cross-farm animal ${definition.animals[0].identification}`);
    expect(result.integrityIssues).toContain(`persisted animal differs from seed definition ${definition.animals[1].identification}`);
    expect(result.integrityIssues).toContain("reproduction event/detail count mismatch");
    expect(result.integrityIssues).toContain("weight event count mismatch");
    expect(result.integrityIssues).toContain("movement event count mismatch");
    expect(result.integrityIssues).toContain("calf journey agenda count mismatch");
  });
});
