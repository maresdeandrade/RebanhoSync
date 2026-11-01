import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: "neonatal-user" } } } })) } } }));
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { createGesture } from "@/lib/offline/ops";
import { buildReproductionGesture } from "../register";
import { buildCalfJourneyAgendaOps } from "../calfJourney";
import { buildPostPartumOps } from "../postPartum";
import { executeSanitaryAgendaV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import { deterministicUuidFromText } from "../deterministicUuid";
import { listLocalSanitaryAgendasV2 } from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import type { Animal } from "@/lib/offline/types";

const farm = "11111111-1111-4111-8111-111111111111";
const motherId = "33333333-3333-4333-8333-333333333333";
const birthId = "44444444-4444-4444-8444-444444444444";
const now = "2026-04-01T12:00:00.000Z";
let calf: Animal;
let farmContext: string | null;
const request = (agendaId: string, day = 1) => ({
  fazendaId: farm, agendaId, clientOpId: `central:${agendaId}`,
  executedAt: `2026-04-0${day}T12:00:00.000Z`, registrationMode: "executed_fact" as const,
  confirmation: { userConfirmedExecution: true as const },
  assertCurrentContext: () => { if (farmContext !== farm) throw new Error("FARM_CHANGED"); },
});
beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("VITE_BACKEND_ENV", "development");
  const storage = new Map([["rebanhosync:sanitario-v2-push", "local"]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal("fetch", () => { throw new Error("NETWORK_FORBIDDEN"); });
  farmContext = farm;
  await establishLocalOwnership({ user: { id: "neonatal-user" } } as never);
  await db.sync_sanitario_v2_cutovers.put({ key: `${farm}:2`, fazenda_id: farm, contract_version: 2, status: "APPLIED", prepared_at: now, applied_at: now, updated_at: now } as never);
  await db.state_animais.put({ id: motherId, fazenda_id: farm, identificacao: "MAE", sexo: "F", status: "ativo", payload: {}, deleted_at: null } as Animal);
  const built = buildReproductionGesture({ fazendaId: farm, animalId: motherId, animalIdentificacao: "MAE", eventId: birthId, occurredAt: now,
    data: { tipo: "parto", dataParto: "2026-04-01", numeroCrias: 1 } });
  await createGesture(farm, built.ops, { sanitarioAgendaV2: built.sanitarioAgendaV2, enqueueSanitarioAgendaV2: true });
  calf = (await db.state_animais.get(built.calfIds[0]))!;
  const review = buildCalfJourneyAgendaOps({ fazendaId: farm, calf, mother: { id: motherId, identificacao: "MAE" } }).sanitarioAgendaV2.filter(draft => draft.agenda.acao_sanitaria === "revisao_neonatal");
  await createGesture(farm, [], { sanitarioAgendaV2: review, enqueueSanitarioAgendaV2: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("execução neonatal canônica", () => {
  it("distinguishes all daily intentions and the review in Central execution groups", async () => {
    const agendas=await db.ops_sanitario_agenda_v2.toArray();
    expect(agendas.every(row=>row.obrigacao_origem_agenda_id===row.id)).toBe(true);
    const targets=await db.ops_sanitario_agenda_animais_v2.toArray();
    expect(targets.every(row=>row.obrigacao_origem_agenda_id===row.agenda_id)).toBe(true);
    const items = await listLocalSanitaryAgendasV2(farm);
    expect(items.map(item => item.itemLabel)).toEqual(["Cura do umbigo · D0", "Cura do umbigo · D1", "Cura do umbigo · D2", "Revisão neonatal"]);
    expect(items.every(item => !item.canExecute && item.protocolId === null && item.itemKey === null)).toBe(true);
  });
  it("executes D0/D1/D2 individually with one fact, animal link and stable sync command per intention", async () => {
    const rows = (await db.ops_sanitario_agenda_v2.toArray()).filter(row => row.acao_sanitaria === "cura_umbigo").sort((a,b) => a.data_programada.localeCompare(b.data_programada));

    const review = (await db.ops_sanitario_agenda_v2.toArray()).find(row=>row.acao_sanitaria === "revisao_neonatal")!;
    await assertNeonatalV31Blocked([...rows.map((row,day)=>request(row.id,day+1)),
request(review.id, 4)]);
  });

  it("retries, concurrent confirmations and reopening preserve the same factual identity", async () => {
    const row = (await db.ops_sanitario_agenda_v2.toArray()).find(row => row.acao_sanitaria === "cura_umbigo")!;

    await assertNeonatalV31Blocked([request(row.id),
{ ...request(row.id), clientOpId: "another-confirmation" },
request(row.id),
request(row.id)]);
  });

  it.each(["gate", "cutover", "birth", "animal", "origin", "context", "extra_target"])("refuses invalid %s without a partial fact", async reason => {
    const row = (await db.ops_sanitario_agenda_v2.toArray()).find(row => row.acao_sanitaria === "cura_umbigo")!;
    if (reason === "gate") localStorage.removeItem("rebanhosync:sanitario-v2-push");
    if (reason === "cutover") await db.sync_sanitario_v2_cutovers.clear();
    if (reason === "birth") await db.event_eventos_reproducao.delete(birthId);
    if (reason === "animal") await db.state_animais.update(calf.id, { fazenda_id: "other-farm" });
    if (reason === "origin") await db.ops_sanitario_agenda_v2.update(row.id, { metadata: { ...row.metadata, birth_event_id: "forged" } });
    if (reason === "context") farmContext = "other-farm";
    if (reason === "extra_target") await db.ops_sanitario_agenda_v2.update(row.id, { metadata: { ...row.metadata, targetAnimalIds: [calf.id, "another-calf"] } });
    const queue = await db.queue_ops.toArray();

    await assertNeonatalV31Blocked([request(row.id)]);
  });

  it("keeps missing_protocol_item for unrelated protocol-less agendas", async () => {
    const row = (await db.ops_sanitario_agenda_v2.toArray())[0];
    await db.ops_sanitario_agenda_v2.update(row.id, { dedup_key: "manual-without-protocol" });

    await assertNeonatalV31Blocked([request(row.id)]);
  });
  it("does not duplicate a partially pulled execution while its fact is missing", async () => {
    const row = (await db.ops_sanitario_agenda_v2.toArray())[0];
    await db.ops_sanitario_agenda_animais_v2.update([row.id, calf.id], { planned_status: "executado", execution_evento_id: "missing-fact" });

    await assertNeonatalV31Blocked([request(row.id)]);
  });

  it.each(["revision", "targets", "owner", "gate", "context"])("rechecks %s inside the transaction", async reason => {
    const row = (await db.ops_sanitario_agenda_v2.toArray())[0];
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation((async (...args: Parameters<typeof db.transaction>) => {
      spy.mockRestore();
      if (reason === "revision") await db.ops_sanitario_agenda_v2.update(row.id, { revision: 99 });
      if (reason === "targets") await db.ops_sanitario_agenda_animais_v2.where("agenda_id").equals(row.id).delete();
      if (reason === "owner") await db.local_ownership.update("local-session", { owner_user_id: "other-user" });
      if (reason === "gate") localStorage.removeItem("rebanhosync:sanitario-v2-push");
      if (reason === "context") farmContext = "other-farm";
      return original(...args);
    }) as typeof db.transaction);

    await assertNeonatalV31Blocked([request(row.id)]);
  });

  it("rolls back a partial write and retries the same identity after reconnect", async () => {
    const row = (await db.ops_sanitario_agenda_v2.toArray())[0];
    const hook = () => { throw new Error("INJECTED_NEONATAL_WRITE_FAILURE"); };
    db.event_eventos_sanitario.hook("creating", hook);

    await assertNeonatalV31Blocked([request(row.id),
request(row.id),
request(row.id)]);
  });

  it("executes one existing six-slot intention without converting its siblings", async () => {
    const template = (await db.ops_sanitario_agenda_v2.toArray()).find(row => row.acao_sanitaria === "cura_umbigo")!;
    await db.ops_sanitario_agenda_v2.clear(); await db.ops_sanitario_agenda_animais_v2.clear();
    const rows = [0, 1, 2].flatMap(day => ["manha", "tarde"].map(slot => {
      const metadata = { ...template.metadata, schedule_day_offset: day, schedule_slot: slot, schedule_kind: "twice_daily_until_dry" };
      return { ...template, id: deterministicUuidFromText(`${birthId}:calf:${calf.id}:cura_umbigo:d${day}:${slot}`),
        dedup_key: `calf_journey:${calf.id}:cura_umbigo:d${day}:${slot}`, metadata, protocol_item_snapshot: metadata };
    }));
    await db.ops_sanitario_agenda_v2.bulkPut(rows);
    await db.ops_sanitario_agenda_animais_v2.bulkPut(rows.map(row => ({ agenda_id: row.id, fazenda_id: farm, animal_id: calf.id, planned_status: "planejado" as const, execution_evento_id: null, not_executed_reason: null, metadata: {}, created_at: now, updated_at: now })));

    await assertNeonatalV31Blocked([request(rows[0].id)]);
  });
});

async function assertNeonatalV31Blocked(inputs: Parameters<typeof executeSanitaryAgendaV2>[0][]) {
  const stores=[db.event_eventos,db.event_eventos_sanitario,db.event_eventos_animais,db.state_animais,db.queue_ops,db.ops_sanitario_agenda_v2,db.ops_sanitario_agenda_animais_v2];
  const before=await Promise.all(stores.map(store=>store.toArray()));
  for(const input of inputs) await expect(executeSanitaryAgendaV2(input)).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");
  expect(await Promise.all(stores.map(store=>store.toArray()))).toEqual(before);
}
