/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "owner" } } } })), refreshSession: vi.fn() } } }));
vi.mock("@/lib/offline/pull", () => ({ DEFAULT_REMOTE_TABLES: [], pullDataForFarm: vi.fn(), pullInitialData: vi.fn(), pullSanitarioAgendaV2: vi.fn(), pullSanitarioV2CutoverState: vi.fn(async () => undefined) }));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({ trackPilotMetric: vi.fn(), flushPilotMetrics: vi.fn() }));
import { db } from "@/lib/offline/db";
import { seedLocalOwner } from "@/lib/offline/__tests__/ownershipTestFixture";
import { setActiveFarmId } from "@/lib/storage";
import { setSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
import { enqueueSanitaryAssessmentV1 } from "../sanitaryAssessmentV1";
import { processGesture } from "@/lib/offline/syncWorker";
import { pullSanitarioV2CutoverState } from "@/lib/offline/pull";
import { supabase } from "@/lib/supabase";

const farm = "10000000-0000-4000-8000-000000000001";
const animal = "20000000-0000-4000-8000-000000000001";
const input = { fazendaId: farm, animalIds: [animal], protocolId: "30000000-0000-4000-8000-000000000001", itemId: "40000000-0000-4000-8000-000000000001", itemVersion: 1, occurredOn: "2026-05-10", responsibleName: "Ana", result: "no_treatment_indicated" as const };

describe("sanitaryAssessmentV1", () => {
  beforeEach(async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    await db.open();
    await Promise.all([db.queue_ops.clear(), db.queue_gestures.clear(), db.state_animais.clear(), db.sync_sanitario_v2_cutovers.clear()]);
    await seedLocalOwner("owner"); setActiveFarmId(farm); setSanitarioV2PushEnabled(true, "local");
    await db.sync_sanitario_v2_cutovers.put({ key: `${farm}:3`, fazenda_id: farm, contract_version: 3, status: "APPLIED", prepared_at: "2026-01-01", applying_at: null, applied_at: "2026-01-01", failed_at: null, last_error: null, updated_at: "2026-01-01" });
    await db.state_animais.put({ id: animal, fazenda_id: farm, deleted_at: null } as never);
  });
  afterEach(async () => {
    setSanitarioV2PushEnabled(false, "local"); vi.unstubAllEnvs(); vi.unstubAllGlobals();
    await Promise.all([db.queue_ops.clear(), db.queue_gestures.clear(), db.state_animais.clear(), db.sync_sanitario_v2_cutovers.clear()]);
  });

  it("enfileira fato sem instalar Evento nem gerar efeitos farmacológicos", async () => {
    const eventId = await enqueueSanitaryAssessmentV1(input);
    const [op] = await db.queue_ops.toArray();
    expect(op.record.payload.event).toMatchObject({ id: eventId, natureza: "standalone_fact", payload: { schema: "sanitary_assessment_v1", assessment: { result: input.result, cycle_key: "2026" } } });
    expect(op.record.payload.detail).toMatchObject({ tipo: "avaliacao" });
    expect(op.record.payload.event_animals).toEqual([expect.objectContaining({ animal_id: animal })]);
    expect(await db.event_eventos.get(eventId)).toBeUndefined();
    expect(await db.event_eventos_sanitario.get(eventId)).toBeUndefined();
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it("recusa participantes de outra fazenda ou troca da fazenda ativa", async () => {
    await db.state_animais.update(animal, { fazenda_id: "other" });
    await expect(enqueueSanitaryAssessmentV1(input)).rejects.toThrow("ANIMAL_SCOPE_INVALID");
    setActiveFarmId("other");
    await expect(enqueueSanitaryAssessmentV1(input)).rejects.toThrow("FARM_CHANGED");
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("mantém a operação indisponível quando o cutover está desligado", async () => {
    setSanitarioV2PushEnabled(false, "local");
    await expect(enqueueSanitaryAssessmentV1(input)).rejects.toThrow("SANITARIO_V2_PUSH_DISABLED");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("recusa uma avaliação em data futura sem enfileirar fato", async () => {
    await expect(enqueueSanitaryAssessmentV1({ ...input, occurredOn: "2999-01-01" })).rejects.toThrow("SANITARY_ASSESSMENT_INVALID");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("enfileira correção append-only com os participantes e ciclo originais", async () => {
    const originalId = "50000000-0000-4000-8000-000000000001";
    const relationId = "60000000-0000-4000-8000-000000000001";
    await db.event_eventos.put({ id: originalId, fazenda_id: farm, occurred_at: "2025-12-01T12:00:00Z", deleted_at: null, payload: { schema: "sanitary_assessment_v1", assessment: { protocol_id: input.protocolId, item_id: input.itemId, item_version: 1, cycle_key: "2025" } } } as never);
    await db.event_eventos_animais.put({ id: relationId, fazenda_id: farm, evento_id: originalId, animal_id: animal } as never);
    try {
      await enqueueSanitaryAssessmentV1({ ...input, correctsEventId: originalId, observation: "Corrigir resultado" });
      const [op] = await db.queue_ops.toArray();
      expect(op.record.payload.event).toMatchObject({ natureza: "correction", corrige_evento_id: originalId, payload: { assessment: { cycle_key: "2025" } } });
      expect(await db.event_eventos.get(originalId)).toBeDefined();
    } finally {
      await db.event_eventos_animais.delete(relationId);
      await db.event_eventos.delete(originalId);
    }
  });
  it("recupera ACK perdido e reinício com identidade original e pull ordenado", async () => {
    const eventId = await enqueueSanitaryAssessmentV1(input);
    const [op] = await db.queue_ops.toArray();
    const gesture = (await db.queue_gestures.get(op.client_tx_id))!;
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network unavailable")).mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ op_id: op.client_op_id, client_op_id: op.client_op_id, domain_op_id: op.domain_op_id, status: "APPLIED", canonical_entity_id: eventId, canonical_result: { evento_id: eventId, confirmed: true } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await processGesture(gesture);
    expect(await db.queue_ops.get(op.client_op_id)).toBeDefined();
    await db.queue_ops.update(op.client_op_id, { next_attempt_at: undefined });
    await db.queue_gestures.update(op.client_tx_id, { next_attempt_at: undefined });
    db.close(); await db.open();
    await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
    const calls = fetchMock.mock.calls.map(call => JSON.parse(String(call[1]?.body)));
    expect(calls[1].ops).toEqual(calls[0].ops);
    expect(pullSanitarioV2CutoverState).toHaveBeenCalledWith(farm);
    expect(await db.queue_ops.get(op.client_op_id)).toBeUndefined();
    expect(await db.event_eventos.get(eventId)).toBeUndefined();
  });
  it("preserva intenção quando a sessão expira antes do envio", async () => {
    await enqueueSanitaryAssessmentV1(input);
    const [op] = await db.queue_ops.toArray();
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null }, error: null } as never);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
    expect(await db.queue_ops.get(op.client_op_id)).toMatchObject({ client_op_id: op.client_op_id, domain_op_id: op.domain_op_id });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
