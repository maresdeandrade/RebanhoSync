import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { supabase } from "@/lib/supabase";
import * as storage from "@/lib/storage";
import * as boundary from "@/lib/offline/localReadBoundary";
import * as pull from "@/lib/offline/pull";
import { createTestFarmDefinition, TEST_FARM_SPEC, testFarmStableId } from "../definition";
import { buildTestFarmAnimalRegistration, seedTestFarm } from "../service";
import type { Animal, Lote, Operation } from "@/lib/offline/types";

vi.mock("@/lib/offline/syncWorker", () => ({
  processGesture: vi.fn(async (gesture: { client_tx_id: string }) => {
    await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).delete();
    await db.queue_gestures.update(gesture.client_tx_id, { status: "DONE", sync_result: "APPLIED", diagnostics: { ack_installed_at: "2026-11-06T12:00:00Z" } });
  }),
  drainReconciliationObligations: vi.fn(async () => {}),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  for (const table of db.tables) await table.clear();
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "http://127.0.0.1:54321/functions/v1");
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, action: () => Promise<unknown>) => action() } });
  vi.spyOn(storage, "getActiveFarmId").mockReturnValue("farm");
  vi.spyOn(boundary, "requireTenantSensitiveAccess").mockResolvedValue();
  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({ data: { user: { id: "owner" } }, error: null } as never);
  const query = { select: vi.fn().mockReturnThis(), match: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(), limit: vi.fn(async () => ({ data: [{ id: "farm", nome: TEST_FARM_SPEC.name, tipo_producao: "corte", created_by: "owner" }], error: null })),
    maybeSingle: vi.fn(async () => ({ data: { role: "owner" }, error: null })) };
  vi.spyOn(supabase, "from").mockReturnValue(query as never);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(["resume", "expired_auth", "farm_switch"])("resumes the persisted seed safely through the real service (%s), without processing twice", async scenario => {
  const definition = createTestFarmDefinition();
  const births = new Set(definition.reproductionEpisodes.flatMap(episode => episode.outcome?.type === "parto" ? [episode.outcome.calfId] : []));
  const root = definition.animals.filter(animal => !births.has(animal.id)).sort((a, b) => (a.draft.dataNascimento ?? "").localeCompare(b.draft.dataNascimento ?? ""))[0];
  const putGesture = (txId: string) => db.queue_gestures.put({ client_tx_id: txId, fazenda_id: "farm", client_id: "client", created_at: "2026-11-06T12:00:00Z",
    status: "DONE", sync_result: "APPLIED", diagnostics: { ack_installed_at: "2026-11-06T12:00:00Z" } });
  for (const [key, nome] of Object.entries({ matrizes: "DEMO Matrizes", novilhas: "DEMO Novilhas", crias: "DEMO Crias", recria: "DEMO Recria", touros: "DEMO Touros" })) {
    await db.state_lotes.put({ id: testFarmStableId(`${TEST_FARM_SPEC.logicalId}:lot:${key}`), fazenda_id: "farm", nome, client_tx_id: key } as Lote);
    await putGesture(key);
  }
  await db.state_animais.put({ ...buildTestFarmAnimalRegistration(root, "farm", definition), client_tx_id: "tx" } as Animal);
  await putGesture("tx");
  await db.queue_gestures.update("tx", { status: "REJECTED", last_error: "STATE_EXPECTED_REVISION_REQUIRED:missing" });
  await db.queue_ops.put({ client_op_id: "op", client_tx_id: "tx", table: "animais", action: "UPDATE", record: { id: root.id, observacoes: "seed" }, sync_state: "REJECTED", created_at: "2026-11-06T12:00:00Z" } as Operation);
  await db.queue_rejections.add({ client_tx_id: "tx", client_op_id: "op", fazenda_id: "farm", table: "animais", action: "UPDATE", reason_code: "STATE_EXPECTED_REVISION_REQUIRED", reason_message: "missing", created_at: "2026-11-06T12:00:00Z" });
  vi.spyOn(pull, "pullDataForFarm").mockImplementation(async () => { await db.state_animais.update(root.id, { revision: 3 }); });
  const worker = await import("@/lib/offline/syncWorker");
  if (scenario === "expired_auth") {
    vi.mocked(supabase.auth.getUser)
      .mockResolvedValueOnce({ data: { user: { id: "owner" } }, error: null } as never)
      .mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } } as never);
  }
  if (scenario === "farm_switch") {
    vi.mocked(pull.pullDataForFarm).mockImplementationOnce(async () => {
      await db.state_animais.update(root.id, { revision: 3 });
      vi.mocked(storage.getActiveFarmId).mockReturnValue("other");
    });
  }
  if (scenario !== "resume") {
    await expect(seedTestFarm("farm", { stopAfter: "canary" })).rejects.toThrow(
      scenario === "expired_auth" ? "TEST_FARM_AUTH_REQUIRED" : "TEST_FARM_ACTIVE_FARM_CHANGED",
    );
    expect(worker.processGesture).not.toHaveBeenCalled();
    expect((await db.queue_ops.get("op"))?.sync_state).toBe("REJECTED");
    expect((await db.queue_ops.get("op"))?.expected_revision).toBeUndefined();
    vi.mocked(storage.getActiveFarmId).mockReturnValue("farm");
    vi.mocked(pull.pullDataForFarm).mockClear();
  }
  expect(await seedTestFarm("farm", { stopAfter: "canary" })).toMatchObject({ stage: "canary", animalId: root.id, rootAnimalsCreated: 0, lotsCreated: 0 });
  expect(worker.processGesture).toHaveBeenCalledTimes(1);
  expect(await db.queue_ops.count()).toBe(0);
  expect(await db.queue_rejections.count()).toBe(1);
  await seedTestFarm("farm", { stopAfter: "canary" });
  expect(worker.processGesture).toHaveBeenCalledTimes(1);
  expect(pull.pullDataForFarm).toHaveBeenCalledTimes(1);
});
