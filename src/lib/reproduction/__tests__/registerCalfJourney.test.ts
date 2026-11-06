/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ userId: "journey-user" as string | null }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => {
  if (Dexie.currentTransaction) throw new Error("AUTH_INSIDE_TRANSACTION");
  return { data: { session: auth.userId ? { user: { id: auth.userId }, access_token: "synthetic-test-token", expires_at: Math.floor(Date.now() / 1000) + 3600 } : null }, error: null };
}) } } }));
vi.mock("@/lib/offline/pull", () => ({
  DEFAULT_REMOTE_TABLES: [], pullDataForFarm: vi.fn(async () => {}), pullInitialData: vi.fn(async () => {}),
  pullSanitarioAgendaV2: vi.fn(async () => {}), pullSanitarioV2CutoverState: vi.fn(async () => {}),
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({ trackPilotMetric: vi.fn(async () => {}), flushPilotMetrics: vi.fn(async () => {}) }));
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { createGesture, rollbackOpLocal } from "@/lib/offline/ops";
import type { Animal, Lote, Operation, SyncOperationResult } from "@/lib/offline/types";
import { buildCalfJourneyCompletionOps } from "../calfJourney";
import { registerCalfJourneyGesture } from "../registerCalfJourney";
import type { PostPartumContext } from "../registerPostPartum";
import { mapOperationForSync, processGesture } from "@/lib/offline/syncWorker";

const farm = "11111111-1111-4111-8111-111111111111";
const calfId = "22222222-2222-4222-8222-222222222222";
const agendaId = "33333333-3333-4333-8333-333333333333";
const lotId = "44444444-4444-4444-8444-444444444444";
const otherLot = "55555555-5555-4555-8555-555555555555";
const recordedAt = "2026-04-01T12:00:00.000Z";
const systemFields = { client_id: "test", client_op_id: "fixture", client_tx_id: null,
  client_recorded_at: recordedAt, server_received_at: recordedAt, created_at: recordedAt, updated_at: recordedAt, deleted_at: null };
let context: PostPartumContext;
const readContext = () => context;
const input = () => ({ fazendaId: farm, calfId, agendaId, pesoKg: 52, destinationLoteId: otherLot });
const cleanups: (() => void)[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  await db.open();
  for (const table of db.tables) await table.clear();
  auth.userId = "journey-user";
  context = { fazendaId: farm, userId: auth.userId, role: "cowboy" };
  await establishLocalOwnership({ user: { id: auth.userId } } as never);
  await db.state_animais.put({ ...systemFields, id: calfId, fazenda_id: farm, identificacao: "CRIA", status: "ativo", lote_id: lotId,
    sexo: "F", data_nascimento: "2026-04-01", data_entrada: null, data_saida: null, pai_id: null, nome: null, rfid: null,
    especie: null, origem: "nascimento", raca: null, papel_macho: null, habilitado_monta: false, observacoes: null,
    mae_id: null, revision: 3, movement_version: "0", movement_head_event_id: null, payload: { birth_event_id: "birth", generated_from: "evento_parto" } });
  await db.state_lotes.put({ id: otherLot, fazenda_id: farm, status: "ativo" } as Lote);
  await db.state_agenda_itens.put({ ...systemFields, id: agendaId, fazenda_id: farm, animal_id: calfId, status: "agendado",
    data_prevista: "2026-04-08", lote_id: lotId, dedup_key: null, source_kind: "automatico", source_ref: null,
    source_client_op_id: null, source_tx_id: null, source_evento_id: null, protocol_item_version_id: null, interval_days_applied: null,
    tipo: "pesagem_d7", dominio: "pesagem", payload: { journey: "cria", milestone_key: "pesagem_d7" } });
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function milestone(tipo: string) {
  await db.state_agenda_itens.update(agendaId, { tipo, dominio: tipo === "desmame" ? "nutricao" : "pesagem", payload: { milestone_key: tipo, journey: "cria" } });
}
const queued = (txId: string) => db.queue_ops.where("client_tx_id").equals(txId).sortBy("op_order");

function appliedResult(op: Operation): SyncOperationResult {
  if (op.table !== "movement_v1") return { op_id: op.client_op_id, status: "APPLIED" };
  return { op_id: op.client_op_id, status: "APPLIED",
    operation_identity: { fazenda_id: farm, client_tx_id: op.client_tx_id, client_op_id: op.client_op_id, event_id: op.record.event_id },
    canonical_result: { status: "STATE_APPLIED", command_digest: op.command_digest },
  };
}

describe("durable calf journey command", () => {
  it("records the effective weaning destination when keeping the current lot and never rebuilds it on replay", async () => {
    await milestone("desmame");
    await db.state_animais.update(calfId, { lote_id: otherLot });
    const request = { ...input(), destinationLoteId: null };
    const first = await registerCalfJourneyGesture(request, readContext);
    expect((await db.event_eventos.get(first.eventId))?.payload.destination_lote_id).toBe(otherLot);
    expect((await db.state_animais.get(calfId))?.payload.weaning).toMatchObject({ destination_lote_id: otherLot });
    expect(await db.event_eventos_movimentacao.count()).toBe(0);
    const operations = await queued(first.txId);
    expect(operations.some(op => op.table === "movement_v1")).toBe(false);
    await db.state_animais.update(calfId, { lote_id: lotId });
    expect(await registerCalfJourneyGesture(request, readContext)).toMatchObject({ eventId: first.eventId, replayed: true });
    expect(await queued(first.txId)).toEqual(operations);
    expect((await db.event_eventos.get(first.eventId))?.payload.destination_lote_id).toBe(otherLot);
    expect(await db.event_eventos.count()).toBe(1);
  });

  it("keeps the selected weaning destination and its single movement unchanged on replay", async () => {
    await milestone("desmame");
    const first = await registerCalfJourneyGesture(input(), readContext);
    expect((await db.event_eventos.get(first.eventId))?.payload.destination_lote_id).toBe(otherLot);
    const operations = await queued(first.txId);
    expect(operations.filter(op => op.table === "movement_v1")).toEqual([
      expect.objectContaining({ record: expect.objectContaining({ from_lote_id: lotId, to_lote_id: otherLot }) }),
    ]);
    expect(await registerCalfJourneyGesture({ ...input(), destinationLoteId: null }, readContext)).toMatchObject({ eventId: first.eventId, replayed: true });
    expect(await queued(first.txId)).toEqual(operations);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);
  });

  it.each(["pesagem_d7", "pesagem_d30", "desmame"])("persists %s once, including restart and a changed screen draft", async tipo => {
    await milestone(tipo);
    const first = await registerCalfJourneyGesture(input(), readContext);
    const ops = await queued(first.txId);
    const event = await db.event_eventos.get(first.eventId);
    expect(event).toMatchObject({ source_task_id: agendaId, animal_id: calfId, fazenda_id: farm });
    expect((await db.queue_gestures.get(first.txId))?.calf_journey_command).toMatchObject({ agenda_id: agendaId, event_id: first.eventId, occurred_at: event!.occurred_at });
    expect(ops.find(op => op.table === "eventos")?.record.id).toBe(first.eventId);
    expect((await db.state_agenda_itens.get(agendaId))?.source_evento_id).toBe(first.eventId);
    db.close();
    await db.open();
    const repeated = await registerCalfJourneyGesture({ ...input(), pesoKg: 999, destinationLoteId: lotId }, readContext);
    expect(repeated).toMatchObject({ txId: first.txId, eventId: first.eventId, replayed: true });
    expect(await queued(first.txId)).toEqual(ops);
    expect(await db.event_eventos.count()).toBe(tipo === "desmame" ? 2 : 1);
    expect(await db.event_eventos_movimentacao.count()).toBe(tipo === "desmame" ? 1 : 0);
    expect(await db.state_agenda_itens.count()).toBe(1);
  });

  it("serializes concurrent confirmations into one command and one movement", async () => {
    await milestone("desmame");
    const results = await Promise.all([registerCalfJourneyGesture(input(), readContext), registerCalfJourneyGesture(input(), readContext)]);
    expect(results[0].txId).toBe(results[1].txId);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await db.queue_gestures.count()).toBe(1);
    expect((await queued(results[0].txId)).filter(op => op.table === "movement_v1")).toHaveLength(1);
  });

  it("allows a separate legitimate intention without replacing the first command", async () => {
    const first = await registerCalfJourneyGesture(input(), readContext);
    const next = "66666666-6666-4666-8666-666666666666";
    await db.state_agenda_itens.put({ ...(await db.state_agenda_itens.get(agendaId))!, id: next, status: "agendado", source_evento_id: null, tipo: "pesagem_d30", payload: { milestone_key: "pesagem_d30" } });
    const second = await registerCalfJourneyGesture({ ...input(), agendaId: next, pesoKg: 70 }, readContext);
    expect(second.eventId).not.toBe(first.eventId);
    expect(await db.event_eventos.count()).toBe(2);
    expect(await db.queue_gestures.count()).toBe(2);
  });

  it.each(["REJECTED", "ERROR"] as const)("preserves %s, rollback and the original CAS envelope instead of reenqueuing", async status => {
    await milestone("desmame");
    const first = await registerCalfJourneyGesture(input(), readContext);
    const ops = await queued(first.txId);
    const animalOp = ops.find(op => op.table === "animais")!;
    expect(animalOp.expected_revision).toBe(3);
    await rollbackOpLocal(animalOp);
    await db.queue_gestures.update(first.txId, { status, last_error: "STATE_REVISION_CONFLICT" });
    await db.queue_rejections.add({ client_tx_id: first.txId, client_op_id: animalOp.client_op_id, fazenda_id: farm, table: "animais", action: "UPDATE", reason_code: "STATE_REVISION_CONFLICT", reason_message: "stale", created_at: new Date().toISOString() });
    await db.state_agenda_itens.update(agendaId, { status: "agendado", source_evento_id: null });
    const before = await queued(first.txId);
    await expect(registerCalfJourneyGesture(input(), readContext)).rejects.toThrow(/Sincronização/);
    expect(await queued(first.txId)).toEqual(before);
    expect(await db.queue_rejections.count()).toBe(1);
  });

  it.each(["SYNCING", "DONE"] as const)("does not recreate operations after %s or a lost local acknowledgement", async status => {
    const first = await registerCalfJourneyGesture(input(), readContext);
    if (status === "DONE") await db.queue_ops.where("client_tx_id").equals(first.txId).delete();
    await db.queue_gestures.update(first.txId, { status, sync_result: status === "DONE" ? "APPLIED" : undefined });
    const before = await queued(first.txId);
    expect(await registerCalfJourneyGesture(input(), readContext)).toMatchObject({ eventId: first.eventId, replayed: true });
    expect(await queued(first.txId)).toEqual(before);
    expect(await db.event_eventos.count()).toBe(1);
  });

  it("aborts the command, all local facts and the queue atomically after a late failure", async () => {
    const fail = () => { throw new Error("CRASH_BEFORE_COMMIT"); };
    db.queue_gestures.hook("updating", fail);
    cleanups.push(() => db.queue_gestures.hook("updating").unsubscribe(fail));
    await expect(registerCalfJourneyGesture(input(), readContext)).rejects.toThrow("CRASH_BEFORE_COMMIT");
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect((await db.state_agenda_itens.get(agendaId))?.status).toBe("agendado");
    cleanups.pop()!();
    expect((await registerCalfJourneyGesture(input(), readContext)).replayed).toBe(false);
  });

  it("rolls back when farm context changes while materializing local effects", async () => {
    const switchFarm = () => { context = { ...context, fazendaId: "other" }; };
    db.event_eventos.hook("creating", switchFarm);
    cleanups.push(() => db.event_eventos.hook("creating").unsubscribe(switchFarm));
    await expect(registerCalfJourneyGesture(input(), readContext)).rejects.toThrow();
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
  });

  it.each([
    { reason: "session", prepare: () => { auth.userId = null; } },
    { reason: "farm", prepare: () => { context.fazendaId = "other"; } },
    { reason: "owner", prepare: () => { auth.userId = "other"; } },
    { reason: "animal", prepare: () => db.state_animais.update(calfId, { fazenda_id: "other" }) },
    { reason: "agenda", prepare: () => db.state_agenda_itens.update(agendaId, { fazenda_id: "other" }) },
    { reason: "lot", prepare: async () => { await milestone("desmame"); await db.state_lotes.update(otherLot, { fazenda_id: "other" }); } },
    { reason: "mother", prepare: async () => {
      await db.state_animais.update(calfId, { mae_id: "mother" });
      await db.state_animais.put({ id: "mother", fazenda_id: "other" } as Animal);
    } },
    { reason: "cancelled", prepare: () => db.state_agenda_itens.update(agendaId, { status: "cancelado" }) },
    { reason: "deleted", prepare: () => db.state_animais.update(calfId, { deleted_at: new Date().toISOString() }) },
    { reason: "sanitary", prepare: () => milestone("cura_umbigo") },
  ])("refuses invalid $reason before committing a command", async ({ prepare }) => {
    await prepare();
    await expect(registerCalfJourneyGesture(input(), readContext)).rejects.toThrow();
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("keeps the existing optional-mother behavior for a calf whose mother is not materialized", async () => {
    await db.state_animais.update(calfId, { mae_id: "missing-mother" });
    expect((await registerCalfJourneyGesture(input(), readContext)).replayed).toBe(false);
  });

  it("does not overwrite another farm's row when the deterministic event ID is already occupied", async () => {
    const first = await registerCalfJourneyGesture(input(), readContext);
    await db.queue_gestures.delete(first.txId);
    await db.queue_ops.where("client_tx_id").equals(first.txId).delete();
    await db.state_agenda_itens.update(agendaId, { status: "agendado", source_evento_id: null });
    await db.event_eventos.update(first.eventId, { fazenda_id: "other" });
    await expect(registerCalfJourneyGesture(input(), readContext)).rejects.toThrow(/ocupada/);
    expect((await db.event_eventos.get(first.eventId))?.fazenda_id).toBe("other");
    expect(await db.queue_gestures.count()).toBe(0);
  });

  it("recognizes an old persisted execution instead of assigning it a new identity", async () => {
    const calf = (await db.state_animais.get(calfId))!;
    const item = (await db.state_agenda_itens.get(agendaId))!;
    const built = buildCalfJourneyCompletionOps({ fazendaId: farm, calf, mother: null, agendaItem: item, pesoKg: 41 });
    const txId = await createGesture(farm, built.ops);
    expect(await registerCalfJourneyGesture(input(), readContext)).toMatchObject({ eventId: built.linkedEventId, txId, replayed: true });
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.queue_gestures.count()).toBe(1);
  });

  it.each(["pesagem_d7", "pesagem_d30", "desmame"])("replays %s through the real worker after lost ACK without changing the transmitted command", async tipo => {
    await milestone(tipo);
    const command = await registerCalfJourneyGesture(input(), readContext);
    const operations = await queued(command.txId);
    const expected = operations.map(op => mapOperationForSync(op, farm));
    const requests: unknown[] = [];
    const accepted = new Set<string>();
    const transport = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      requests.push(body.ops);
      for (const op of body.ops) accepted.add(op.client_op_id);
      if (requests.length === 1) throw new TypeError("Failed to fetch: ACK lost");
      return new Response(JSON.stringify({ results: operations.map(appliedResult) }), { status: 200 });
    });
    vi.stubGlobal("fetch", transport);
    await processGesture((await db.queue_gestures.get(command.txId))!);
    expect((await db.queue_gestures.get(command.txId))?.status).toBe("PENDING");
    db.close();
    await db.open();
    expect((await registerCalfJourneyGesture({ ...input(), pesoKg: 99 }, readContext)).replayed).toBe(true);
    expect(await queued(command.txId)).toEqual(operations);
    // Advance only the persisted scheduling gate; keep every operation/envelope unchanged.
    await db.queue_gestures.update(command.txId, { next_attempt_at: new Date(0).toISOString() });
    await processGesture((await db.queue_gestures.get(command.txId))!);
    expect(requests).toEqual([expected, expected]);
    expect(accepted.size).toBe(operations.length);
    expect(await db.event_eventos.count()).toBe(tipo === "desmame" ? 2 : 1);
    const afterAck = await queued(command.txId);
    if (tipo === "desmame") {
      expect(afterAck.find(op => op.table === "movement_v1")).toMatchObject({ sync_state: "RECONCILE", movement_result: { status: "APPLIED" } });
      expect(await db.sync_reconcile_obligations.count()).toBeGreaterThan(0);
    }
    await registerCalfJourneyGesture(input(), readContext);
    expect(await queued(command.txId)).toEqual(afterAck);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([
    { tipo: "pesagem_d7", rejectedTable: "agenda_itens", status: "REJECTED" },
    { tipo: "desmame", rejectedTable: "animais", status: "CONFLICT" },
  ])("preserves accepted facts and terminal $status for $tipo in a partial worker response", async ({ tipo, rejectedTable, status }) => {
    await milestone(tipo);
    const command = await registerCalfJourneyGesture(input(), readContext);
    const ops = await queued(command.txId);
    const rejected = ops.find(op => op.table === rejectedTable)!;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: ops.map(op =>
      op.client_op_id === rejected.client_op_id
        ? { op_id: op.client_op_id, status, reason_code: "STATE_REVISION_CONFLICT", retryable: false }
        : appliedResult(op),
    ) }), { status: 200 })));
    await processGesture((await db.queue_gestures.get(command.txId))!);
    expect((await db.queue_gestures.get(command.txId))?.status).toBe("REJECTED");
    const remaining = await queued(command.txId);
    const terminal = remaining.find(op => op.client_op_id === rejected.client_op_id)!;
    expect(terminal.sync_state).toBe("REJECTED");
    expect(terminal.expected_revision).toBe(rejected.expected_revision);
    const receipts = await db.queue_rejections.toArray();
    expect(receipts).toEqual(expect.arrayContaining([expect.objectContaining({ client_op_id: rejected.client_op_id, reason_code: "STATE_REVISION_CONFLICT" })]));
    await expect(registerCalfJourneyGesture(input(), readContext)).rejects.toThrow(/Sincronização/);
    expect(await queued(command.txId)).toEqual(remaining);
    expect(await db.queue_rejections.toArray()).toEqual(receipts);
    expect(await db.event_eventos.count()).toBe(tipo === "desmame" ? 2 : 1);
  });
});
