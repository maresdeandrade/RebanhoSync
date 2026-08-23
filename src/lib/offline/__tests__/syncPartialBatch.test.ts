/** Valida reconciliação por operação para resultados remotos mistos. */
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
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { createGesture, retryRejectedOperation } from "../ops";
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

describe("sync partial batch: reconciliação por operação", () => {
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

  it("APPLIED + REJECTED preserva a aplicada e retém somente a rejeitada", async () => {
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
    expect(opsAfter).toHaveLength(1);
    expect(opsAfter[0]).toMatchObject({
      client_op_id: secondOp.client_op_id,
      sync_state: "REJECTED",
    });

    const reconciled = await db.state_animais.get(animalId);
    expect(reconciled?.observacoes).toBe("after-op1");
    expect(gesture.operation_results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op_id: firstOp.client_op_id,
          status: "APPLIED",
          matched: true,
        }),
        expect.objectContaining({
          op_id: secondOp.client_op_id,
          status: "REJECTED",
          matched: true,
        }),
      ]),
    );

    expect(firstOp.before_snapshot).toBeDefined();
    expect(secondOp.before_snapshot).toBeDefined();
    expect((secondOp.before_snapshot as { observacoes?: string })?.observacoes).toBe(
      "after-op1",
    );
    expect((firstOp.before_snapshot as { observacoes?: string })?.observacoes).toBe(
      "seed-obs",
    );
  });

  it("APPLIED + REJECTED + APPLIED_ALTERED mantém somente a intermediária para reconciliação", async () => {
    const animalId = await seedAnimal({ id: "animal-three-ops" });
    const txId = await createGesture("farm-partial", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "after-a" },
      },
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "after-b" },
      },
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "after-c" },
      },
    ]);
    const [opA, opB, opC] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: opA.client_op_id, status: "APPLIED" },
            {
              op_id: opB.client_op_id,
              status: "REJECTED",
              reason_code: "TEST_MIDDLE_REJECT",
              reason_message: "middle rejected",
            },
            {
              op_id: opC.client_op_id,
              status: "APPLIED_ALTERED",
              altered: { dedup: "collision_noop" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.mocked(pullDataForFarm).mockImplementationOnce(async () => {
      const current = await db.state_animais.get(animalId);
      if (!current) throw new Error("animal missing during pull");
      await db.state_animais.put({
        ...current,
        observacoes: "remote-canonical-c",
      });
    });

    await processGesture(await getGesture(txId));

    expect(await db.queue_ops.where("client_tx_id").equals(txId).toArray()).toEqual([
      expect.objectContaining({
        client_op_id: opB.client_op_id,
        sync_state: "REJECTED",
      }),
    ]);
    expect((await db.state_animais.get(animalId))?.observacoes).toBe(
      "remote-canonical-c",
    );
    expect(pullDataForFarm).toHaveBeenCalledWith("farm-partial", ["animais"]);
    expect((await getGesture(txId)).operation_results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op_id: opA.client_op_id, status: "APPLIED" }),
        expect.objectContaining({ op_id: opB.client_op_id, status: "REJECTED" }),
        expect.objectContaining({
          op_id: opC.client_op_id,
          status: "APPLIED_ALTERED",
        }),
      ]),
    );
  });

  it("reload e retry repetido preservam IDs e não reenviam operações já aplicadas", async () => {
    const animalId = await seedAnimal({ id: "animal-reload-retry" });
    const txId = await createGesture("farm-partial", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "applied" },
      },
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "retry-me" },
      },
    ]);
    const [appliedOp, rejectedOp] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { op_id: appliedOp.client_op_id, status: "APPLIED" },
            {
              op_id: rejectedOp.client_op_id,
              status: "REJECTED",
              reason_code: "TEST_RETRYABLE_REJECT",
              reason_message: "retry explicitly",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await processGesture(await getGesture(txId));

    const rejection = (await db.queue_rejections.toArray())[0];
    await processGesture(await getGesture(txId));
    expect(fetch).toHaveBeenCalledTimes(1);

    await retryRejectedOperation(rejection);
    await expect(retryRejectedOperation(rejection)).rejects.toThrow(
      "REJECTED_OPERATION_ALREADY_QUEUED",
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ op_id: rejectedOp.client_op_id, status: "APPLIED" }],
        }),
        { status: 200 },
      ),
    );
    await processGesture(await getGesture(txId));

    const secondRequest = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body),
    ) as { client_tx_id: string; ops: Array<{ client_op_id: string }> };
    expect(secondRequest.client_tx_id).toBe(txId);
    expect(secondRequest.ops.map((op) => op.client_op_id)).toEqual([
      rejectedOp.client_op_id,
    ]);
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
    expect((await getGesture(txId)).status).toBe("DONE");
    expect(await db.queue_rejections.count()).toBe(1);
  });

  it("timeout após aplicação remota mantém IDs para replay do mesmo fato", async () => {
    const animalId = await seedAnimal({ id: "animal-timeout" });
    const txId = await createGesture("farm-partial", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "timeout-fact" },
      },
    ]);
    const [operation] = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .toArray();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network timeout after remote commit"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ op_id: operation.client_op_id, status: "APPLIED" }],
          }),
          { status: 200 },
        ),
      );

    await processGesture(await getGesture(txId));
    expect((await getGesture(txId)).status).toBe("PENDING");
    expect((await db.queue_ops.get(operation.client_op_id))?.client_tx_id).toBe(
      txId,
    );

    await processGesture(await getGesture(txId));
    const requests = vi.mocked(fetch).mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    ) as Array<{ client_tx_id: string; ops: Array<{ client_op_id: string }> }>;
    expect(requests.map((request) => request.client_tx_id)).toEqual([txId, txId]);
    expect(requests.map((request) => request.ops[0]?.client_op_id)).toEqual([
      operation.client_op_id,
      operation.client_op_id,
    ]);
    expect(await db.queue_ops.count()).toBe(0);
    expect((await getGesture(txId)).status).toBe("DONE");
  });

  it("correção explícita cria novo comando sem apagar a rejeição original", async () => {
    const animalId = await seedAnimal({ id: "animal-explicit-correction" });
    const originalTxId = await createGesture("farm-partial", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "invalid-command" },
      },
    ]);
    const [originalOperation] = await db.queue_ops
      .where("client_tx_id")
      .equals(originalTxId)
      .toArray();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: originalOperation.client_op_id,
              status: "REJECTED",
              reason_code: "VALIDATION_COMMAND",
              reason_message: "Corrija os dados e envie um novo comando.",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await processGesture(await getGesture(originalTxId));

    const correctedTxId = await createGesture("farm-partial", [
      {
        table: "animais",
        action: "UPDATE",
        record: { id: animalId, observacoes: "corrected-command" },
      },
    ]);
    const [correctedOperation] = await db.queue_ops
      .where("client_tx_id")
      .equals(correctedTxId)
      .toArray();

    expect(correctedTxId).not.toBe(originalTxId);
    expect(correctedOperation.client_op_id).not.toBe(
      originalOperation.client_op_id,
    );
    expect(await db.queue_ops.get(originalOperation.client_op_id)).toMatchObject({
      sync_state: "REJECTED",
    });
    expect(await db.queue_rejections.count()).toBe(1);
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
