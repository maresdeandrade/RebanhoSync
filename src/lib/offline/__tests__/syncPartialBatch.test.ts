/**
 * Documenta o comportamento atual quando o sync-batch devolve sucesso parcial:
 * a primeira op pode ter sido aplicada no servidor (sequencial), mas qualquer REJECTED
 * faz o cliente marcar o gesto como REJECTED, registrar rejeição e reverter todas as
 * ops locais em ordem reversa — sem garantir atomicidade servidor/cliente.
 *
 * Não altera produção; não corrige atomicidade.
 */
/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-1",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-2",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
    },
  },
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { createGesture } from "../ops";
import { db } from "../db";
import { pullDataForFarm } from "../pull";
import { processGesture } from "../syncWorker";

function dateDaysAgo(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

async function seedAnimal(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  const id = String(overrides.id ?? crypto.randomUUID());
  await db.state_animais.put({
    id,
    fazenda_id: "farm-partial",
    identificacao: String(overrides.identificacao ?? "PB-001"),
    sexo: (overrides.sexo as "F" | "M" | undefined) ?? "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: String(overrides.data_nascimento ?? dateDaysAgo(400)),
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: (overrides.observacoes as string | null | undefined) ?? "seed-obs",
    payload: (overrides.payload as Record<string, unknown> | undefined) ?? {},
    client_id: "client-1",
    client_op_id: `op-seed-${id}`,
    client_tx_id: `tx-seed-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  return id;
}

async function getGesture(txId: string) {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error(`Gesture ${txId} not found`);
  return gesture;
}

describe("sync partial batch (multi-op): cliente rollback total vs servidor possivelmente parcial", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await Promise.all([
      db.state_animais.clear(),
      db.state_agenda_itens.clear(),
      db.event_eventos.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      db.state_animais.clear(),
      db.state_agenda_itens.clear(),
      db.event_eventos.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  it("com APPLIED na 1ª op e REJECTED na 2ª: REJECTED, rejeição, queue_ops retida, estado local restaurado", async () => {
    const animalId = await seedAnimal({ id: "animal-partial-batch" });
    const ts1 = new Date().toISOString();
    const ts2 = new Date().toISOString();

    const txId = await createGesture("farm-partial", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          observacoes: "after-op1",
          updated_at: ts1,
        },
      },
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          observacoes: "after-op2",
          updated_at: ts2,
        },
      },
    ]);

    const ops = await db.queue_ops.where("client_tx_id").equals(txId).sortBy("op_order");
    expect(ops).toHaveLength(2);
    const [firstOp, secondOp] = ops;

    const optimistic = await db.state_animais.get(animalId);
    expect(optimistic?.observacoes).toBe("after-op2");

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: firstOp.client_op_id, status: "APPLIED" },
            {
              op_id: secondOp.client_op_id,
              status: "REJECTED",
              reason_code: "TEST_PARTIAL_REJECT",
              reason_message: "second op failed validation",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    const gesture = await getGesture(txId);
    expect(gesture.status).toBe("REJECTED");
    expect(gesture.sync_result).toBe("REJECTED");

    const rejections = await db.queue_rejections.toArray();
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      client_tx_id: txId,
      client_op_id: secondOp.client_op_id,
      reason_code: "TEST_PARTIAL_REJECT",
      reason_message: "second op failed validation",
    });

    const opsAfter = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
    expect(opsAfter).toHaveLength(2);

    const rolledBack = await db.state_animais.get(animalId);
    expect(rolledBack?.observacoes).toBe("seed-obs");

    // Duas UPDATEs encadeadas no mesmo registro: rollback reverso precisa desfazer op2
    // antes de op1 para voltar ao before_snapshot da primeira op.
    expect(firstOp.before_snapshot).toBeDefined();
    expect(secondOp.before_snapshot).toBeDefined();
    expect((secondOp.before_snapshot as { observacoes?: string })?.observacoes).toBe(
      "after-op1",
    );
    expect((firstOp.before_snapshot as { observacoes?: string })?.observacoes).toBe(
      "seed-obs",
    );
  });

  it("em duplicidade de agenda sanitaria, faz rollback local e puxa agenda/eventos do servidor", async () => {
    const txId = await createGesture("farm-partial", [
      {
        table: "eventos",
        action: "INSERT",
        record: {
          id: "evt-dup-local",
          fazenda_id: "farm-partial",
          dominio: "sanitario",
          occurred_at: "2026-05-26T10:00:00.000Z",
          occurred_on: "2026-05-26",
          animal_id: "animal-dup",
          lote_id: null,
          source_task_id: "agenda-ja-concluida",
          source_tx_id: null,
          source_client_op_id: null,
          corrige_evento_id: null,
          sanitario_caso_id: null,
          observacoes: null,
          payload: {},
          deleted_at: null,
        },
      },
    ]);

    const [eventOp] = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
    expect(await db.event_eventos.get("evt-dup-local")).toBeDefined();

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: eventOp.client_op_id,
              status: "REJECTED",
              reason_code: "agenda_already_completed_by_event",
              reason_message: "Agenda item already completed by event evt-server",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    expect(await db.event_eventos.get("evt-dup-local")).toBeUndefined();
    expect(pullDataForFarm).toHaveBeenCalledWith("farm-partial", [
      "agenda_itens",
      "eventos",
      "eventos_sanitario",
    ]);

    const rejections = await db.queue_rejections.toArray();
    expect(rejections[0]).toMatchObject({
      reason_code: "agenda_already_completed_by_event",
    });
  });
});
