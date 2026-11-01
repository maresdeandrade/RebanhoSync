/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: {
  user: { id: "synthetic-cas-owner" }, access_token: "synthetic-not-a-credential", expires_at: 9999999999,
} } }) } } }));
vi.mock("../pull", () => ({ DEFAULT_REMOTE_TABLES: [], pullDataForFarm: vi.fn(), pullInitialData: vi.fn(),
  pullSanitarioAgendaV2: vi.fn(), pullSanitarioV2CutoverState: vi.fn() }));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({ trackPilotMetric: vi.fn(), flushPilotMetrics: vi.fn() }));
import { db } from "../db";
import { createGesture } from "../ops";
import { establishLocalOwnership } from "../ownership";
import { processGesture } from "../syncWorker";
import { pullDataForFarm } from "../pull";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { listAnimalSanitaryRestrictions } from "@/lib/sanitario/compliance/animalRestrictions";

const farm = "synthetic-cas-farm", animalId = "synthetic-cas-animal";
async function enqueue(blocked: boolean) {
  const built = buildEventGesture({ dominio: "alerta_sanitario", fazendaId: farm, animalId,
    alertKind: "suspeita_aberta", occurredAt: "2026-10-30T12:00:00Z",
    animalPayload: { sanidade_alerta: { status: "suspeita_aberta", movement_blocked: blocked } },
    sanitarioCaso: { action: "open", tipo: "notificavel", status: "aberto", movementBlocked: blocked },
  });
  const tx = await createGesture(farm, built.ops);
  return { tx, ops: await db.queue_ops.where("client_tx_id").equals(tx).sortBy("op_order") };
}
beforeEach(async () => {
  vi.clearAllMocks(); localStorage.clear(); localStorage.setItem("gestao_agro_active_fazenda_id", farm);
  await db.open(); await Promise.all(db.tables.map(t => t.clear()));
  await establishLocalOwnership({ user: { id: "synthetic-cas-owner" } } as never);
  await db.state_animais.put({ id: animalId, fazenda_id: farm, identificacao: "SYNTHETIC", revision: 1, payload: {} } as never);
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(pullDataForFarm).mockImplementation(async () => {
    await db.state_animais.update(animalId, { revision: 2, payload: { sanidade_alerta: { status: "suspeita_aberta", movement_blocked: false } } } as never);
  });
});
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(db.tables.map(t => t.clear())); });
describe("case-derived alerts after partial sanitary CAS", () => {
  it("preserves both facts/cases and the original rejection across pull, retry and reopen", async () => {
    const first = await enqueue(false), second = await enqueue(true);
    expect(first.ops[2].expected_revision).toBe(1); expect(second.ops[2].expected_revision).toBe(1);
    const before = second.ops[2].before_snapshot;
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ results: first.ops.map(o => ({ op_id: o.client_op_id, status: "APPLIED" })) }), { status: 200 }));
    await processGesture((await db.queue_gestures.get(first.tx))!);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ results: second.ops.map((o, i) => i < 2
      ? { op_id: o.client_op_id, status: "APPLIED" }
      : { op_id: o.client_op_id, status: "CONFLICT", retryable: false, current_revision: 2, reason_code: "STATE_REVISION_CONFLICT" }) }), { status: 200 }));
    await processGesture((await db.queue_gestures.get(second.tx))!);
    expect(await db.queue_gestures.get(second.tx)).toMatchObject({ status: "REJECTED", sync_result: "REJECTED" });
    expect(await db.queue_ops.get(second.ops[2].client_op_id)).toMatchObject({ expected_revision: 1,
      sync_state: "REJECTED", client_tx_id: second.tx, before_snapshot: before });
    expect(await db.event_eventos.count()).toBe(2); expect(await db.state_sanitario_casos.count()).toBe(2);
    db.close(); await db.open();
    const animals = await db.state_animais.toArray(), cases = await db.state_sanitario_casos.toArray();
    const alerts = listAnimalSanitaryRestrictions(farm, animals, cases);
    expect(alerts).toHaveLength(1); expect(alerts[0].caseIds).toEqual([second.ops[0].record.id]);
    const snapshot = JSON.stringify({ animals, cases, ops: await db.queue_ops.toArray() });
    expect(listAnimalSanitaryRestrictions(farm, animals, cases)).toEqual(alerts);
    await processGesture((await db.queue_gestures.get(second.tx))!);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify({ animals: await db.state_animais.toArray(), cases: await db.state_sanitario_casos.toArray(), ops: await db.queue_ops.toArray() })).toBe(snapshot);
    expect(await db.event_eventos.count()).toBe(2);
  });
});
