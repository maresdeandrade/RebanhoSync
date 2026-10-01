/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-convergence",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "user-convergence" },
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-convergence-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "user-convergence" },
          },
        },
        error: null,
      })),
    },
    from: vi.fn(),
  },
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { supabase } from "@/lib/supabase";
import { db } from "../db";
import { createGesture } from "../ops";
import { establishLocalOwnership } from "../ownership";
import { pullDataForFarm } from "../pull";
import {
  drainReconciliationObligations,
  mapOperationForSync,
  processGesture,
} from "../syncWorker";
import { upsertReconciliationObligations } from "../reconciliationObligations";
import {
  buildMutationMatch,
  isPersistedOperationReplay,
  validateStateExpectedRevision,
} from "../../../../supabase/functions/sync-batch/rules";

const farmId = "10000000-0000-4000-8000-000000000001";
const animalId = "20000000-0000-4000-8000-000000000001";
const loteOriginId = "30000000-0000-4000-8000-000000000001";
const loteTargetId = "30000000-0000-4000-8000-000000000002";
const loteOtherTargetId = "30000000-0000-4000-8000-000000000003";
let activeFarmId = farmId;

const session = (userId: string) =>
  ({ user: { id: userId } }) as Parameters<typeof establishLocalOwnership>[0];

async function clearStores() {
  await Promise.all([
    db.state_animais.clear(),
    db.state_lotes.clear(),
    db.event_eventos.clear(),
    db.event_eventos_movimentacao.clear(),
    db.queue_gestures.clear(),
    db.queue_ops.clear(),
    db.queue_rejections.clear(),
    db.sync_reconcile_obligations.clear(),
    db.local_ownership.clear(),
  ]);
}

async function seedAnimal(initialLoteId: string, revision = 5) {
  const now = new Date().toISOString();
  await db.state_animais.put({
    id: animalId,
    fazenda_id: farmId,
    identificacao: "BOV-CONV-01",
    sexo: "F",
    status: "ativo",
    lote_id: initialLoteId,
    data_nascimento: "2024-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: "Vaquinha",
    rfid: null,
    especie: "bovino",
    origem: null,
    raca: "Nelore",
    papel_macho: null,
    habilitado_monta: false,
    observacoes: "seed animal for movement characterization",
    payload: {},
    client_id: "seed-client",
    client_op_id: "op-seed",
    client_tx_id: "tx-seed",
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    revision,
  } as never);
}

describe("F24.4E2 — characterization: convergência entre Evento de movimentação e state_*", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    activeFarmId = farmId;
    vi.mocked(pullDataForFarm).mockReset();
    vi.mocked(pullDataForFarm).mockResolvedValue(undefined);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) =>
        key === "gestao_agro_active_fazenda_id" ? activeFarmId : null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await clearStores();
    await establishLocalOwnership(session("user-convergence"));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearStores();
  });

  it("E2.1 — Evento aplicado + state conflitante (STATE_REVISION_CONFLICT): preserva fato, reverte state otimista e gera obligation", async () => {
    await seedAnimal(loteOriginId, 5);

    // 1. Constrói gesto de movimentação com aplicação de state
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      eventId: "40000000-0000-4000-8000-000000000001",
      animalId,
      occurredAt: "2026-10-01T10:00:00.000Z",
      fromLoteId: loteOriginId,
      toLoteId: loteTargetId,
      observacoes: "Manejo para lote target",
      applyAnimalStateUpdate: true,
    });

    // 3 operações esperadas: eventos, eventos_movimentacao, animais
    expect(built.ops).toHaveLength(3);
    expect(built.ops[0].table).toBe("eventos");
    expect(built.ops[1].table).toBe("eventos_movimentacao");
    expect(built.ops[2].table).toBe("animais");

    const txId = await createGesture(farmId, built.ops);

    // Verifica que o snapshot capturou expected_revision = 5
    const queuedOps = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    expect(queuedOps).toHaveLength(3);
    const animalOp = queuedOps.find((op) => op.table === "animais")!;
    expect(animalOp.expected_revision).toBe(5);

    // Verifica mutação otimista aplicada localmente
    const optimisticAnimal = await db.state_animais.get(animalId);
    expect(optimisticAnimal?.lote_id).toBe(loteTargetId);
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);

    // 2. Simula resposta do sync-batch:
    // Evento e Detalhe APPLIED, mas UPDATE animais = CONFLICT (STATE_REVISION_CONFLICT)
    const eventOp = queuedOps.find((op) => op.table === "eventos")!;
    const detailOp = queuedOps.find(
      (op) => op.table === "eventos_movimentacao",
    )!;

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: eventOp.client_op_id, status: "APPLIED" },
            { op_id: detailOp.client_op_id, status: "APPLIED" },
            {
              op_id: animalOp.client_op_id,
              status: "CONFLICT",
              retryable: false,
              reason_code: "STATE_REVISION_CONFLICT",
              reason_message: "State changed concurrently during the mutation",
              current_revision: 6,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    // 3. Executa o worker
    const gesture = await db.queue_gestures.get(txId);
    await processGesture(gesture!);

    // 4. Observa o resultado:
    // - O Evento e o Detalhe permanecem no banco local
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);

    // - As operações de evento foram removidas da fila (já aplicadas remotamente)
    expect(await db.queue_ops.get(eventOp.client_op_id)).toBeUndefined();
    expect(await db.queue_ops.get(detailOp.client_op_id)).toBeUndefined();

    // - A operação de UPDATE animais foi retida como REJECTED
    const retainedAnimalOp = await db.queue_ops.get(animalOp.client_op_id);
    expect(retainedAnimalOp?.sync_state).toBe("REJECTED");
    expect(retainedAnimalOp?.blocked_reason).toBe("STATE_REVISION_CONFLICT");

    // - O state local do animal foi revertido para o lote de origem (before_snapshot)
    const rolledBackAnimal = await db.state_animais.get(animalId);
    expect(rolledBackAnimal?.lote_id).toBe(loteOriginId);

    // - O gesture foi marcado como REJECTED
    const finalGesture = await db.queue_gestures.get(txId);
    expect(finalGesture?.status).toBe("REJECTED");
    expect(finalGesture?.sync_result).toBe("REJECTED");

    // - Rejeição registrada em queue_rejections
    const rejections = await db.queue_rejections.toArray();
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      client_tx_id: txId,
      client_op_id: animalOp.client_op_id,
      table: "animais",
      reason_code: "STATE_REVISION_CONFLICT",
    });

    // - Surgiu obligation durável de reconciliação
    const obligations = await db.sync_reconcile_obligations.toArray();
    expect(obligations.length).toBeGreaterThan(0);
    expect(obligations[0].fazenda_id).toBe(farmId);

    // - pullDataForFarm foi chamado para reconciliar tabelas afetadas
    expect(pullDataForFarm).toHaveBeenCalledWith(
      farmId,
      expect.arrayContaining(["eventos", "eventos_movimentacao", "animais"]),
      expect.anything(),
    );
  });

  it("E2.2 — Evento aplicado + state target inválido: gera REJECTED com STATE_TARGET_NOT_FOUND_OR_FORBIDDEN e reverte state", async () => {
    await seedAnimal(loteOriginId, 5);

    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      eventId: "40000000-0000-4000-8000-000000000002",
      animalId,
      occurredAt: "2026-10-01T10:30:00.000Z",
      fromLoteId: loteOriginId,
      toLoteId: loteTargetId,
      applyAnimalStateUpdate: true,
    });

    const txId = await createGesture(farmId, built.ops);
    const queuedOps = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    const [eventOp, detailOp, animalOp] = queuedOps;

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { op_id: eventOp.client_op_id, status: "APPLIED" },
            { op_id: detailOp.client_op_id, status: "APPLIED" },
            {
              op_id: animalOp.client_op_id,
              status: "REJECTED",
              reason_code: "STATE_TARGET_NOT_FOUND_OR_FORBIDDEN",
              reason_message:
                "State target was not found in the authenticated farm scope",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const gesture = await db.queue_gestures.get(txId);
    await processGesture(gesture!);

    // Eventos permanecem, state é revertido
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);
    const rolledBackAnimal = await db.state_animais.get(animalId);
    expect(rolledBackAnimal?.lote_id).toBe(loteOriginId);

    const finalGesture = await db.queue_gestures.get(txId);
    expect(finalGesture?.status).toBe("REJECTED");
  });

  it("E2.3 — regra pura reconhece replay com revision antiga; não executa CAS remoto", () => {
    const existingAnimal = {
      id: animalId,
      fazenda_id: farmId,
      lote_id: loteTargetId,
      revision: 6,
      client_op_id: "op-ani-replay",
      client_tx_id: "tx-replay-1",
    };

    const opToReplay = {
      client_op_id: "op-ani-replay",
      table: "animais",
      action: "UPDATE" as const,
      expected_revision: 5, // Antiga revisão esperada enviada no retry
      record: { id: animalId, lote_id: loteTargetId },
    };

    // 1. isPersistedOperationReplay é verdadeiro
    expect(
      isPersistedOperationReplay(existingAnimal, opToReplay, "tx-replay-1"),
    ).toBe(true);

    // 2. validateStateExpectedRevision confirma proteção
    const policy = validateStateExpectedRevision(opToReplay);
    expect(policy).toMatchObject({
      protected: true,
      ok: true,
      expected_revision: 5,
    });

    // Em sync-batch/index.ts, isPersistedOperationReplay é checado ANTES de comparar currentRevision !== expected_revision.
    // Portanto, o replay é retornado como APPLIED sem disparar STATE_REVISION_CONFLICT e sem novo revision bump.
  });

  it("E2.6 — builder preserva duas identidades factuais distintas; não executa concorrência remota", () => {
    // Fato A
    const eventA = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      eventId: "40000000-0000-4000-8000-000000000010",
      animalId,
      occurredAt: "2026-10-01T08:00:00.000Z",
      toLoteId: "lote-A",
      applyAnimalStateUpdate: true,
    });

    // Fato B (horário posterior, dispositivo distinto)
    const eventB = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      eventId: "40000000-0000-4000-8000-000000000020",
      animalId,
      occurredAt: "2026-10-01T09:00:00.000Z",
      toLoteId: "lote-B",
      applyAnimalStateUpdate: true,
    });

    // Fatos são distintos
    expect(eventA.eventId).not.toBe(eventB.eventId);
    expect(eventA.ops[0].record.id).not.toBe(eventB.ops[0].record.id);
  });

  it.each([
    [
      "dois fatos com conteúdo igual",
      "2026-10-01T10:00:00Z",
      "2026-10-01T10:00:00Z",
      loteTargetId,
    ],
    [
      "T2 recebido antes de T1",
      "2026-10-01T11:00:00Z",
      "2026-10-01T10:00:00Z",
      loteOtherTargetId,
    ],
    [
      "clock skew +55/-55 minutos",
      "2026-10-01T10:55:00Z",
      "2026-10-01T09:05:00Z",
      loteOtherTargetId,
    ],
    [
      "mesmo occurred_at",
      "2026-10-01T10:00:00Z",
      "2026-10-01T10:00:00Z",
      loteOtherTargetId,
    ],
  ])(
    "E2.7 — %s: ACKs simulados preservam ambos os fatos e terminalizam state conflitante",
    async (_scenario, timeA, timeB, targetB) => {
      await seedAnimal(loteOriginId);
      const build = (eventId: string, occurredAt: string, toLoteId: string) =>
        buildEventGesture({
          dominio: "movimentacao",
          fazendaId: farmId,
          animalId,
          eventId,
          occurredAt,
          fromLoteId: loteOriginId,
          toLoteId,
        });
      const a = build(
        "40000000-0000-4000-8000-000000000030",
        timeA,
        loteTargetId,
      );
      const b = build("40000000-0000-4000-8000-000000000031", timeB, targetB);
      const txA = await createGesture(farmId, a.ops);
      // Segundo snapshot independente do mesmo animal (não são dois devices físicos).
      await seedAnimal(loteOriginId);
      const txB = await createGesture(farmId, b.ops);
      const opsA = await db.queue_ops
        .where("client_tx_id")
        .equals(txA)
        .sortBy("op_order");
      const opsB = await db.queue_ops
        .where("client_tx_id")
        .equals(txB)
        .sortBy("op_order");
      for (const operations of [opsA, opsB]) {
        expect(operations[2].expected_revision).toBe(5);
        const envelope = mapOperationForSync(operations[2], farmId);
        expect(buildMutationMatch(envelope, farmId)).toEqual({
          id: animalId,
          fazenda_id: farmId,
          revision: 5,
        });
        expect(envelope.record).not.toHaveProperty("occurred_at");
      }
      // O resultado CAS é fixture de transporte, não uma execução de PostgreSQL.
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              results: opsA.map((op) => ({
                op_id: op.client_op_id,
                status: "APPLIED",
              })),
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              results: opsB.map((op) =>
                op.table === "animais"
                  ? {
                      op_id: op.client_op_id,
                      status: "CONFLICT",
                      retryable: false,
                      reason_code: "STATE_REVISION_CONFLICT",
                      current_revision: 6,
                    }
                  : { op_id: op.client_op_id, status: "APPLIED" },
              ),
            }),
            { status: 200 },
          ),
        );
      await processGesture((await db.queue_gestures.get(txA))!);
      await processGesture((await db.queue_gestures.get(txB))!);
      await processGesture((await db.queue_gestures.get(txB))!);
      expect(await db.event_eventos.count()).toBe(2);
      expect(await db.event_eventos_movimentacao.count()).toBe(2);
      expect((await db.queue_ops.get(opsB[2].client_op_id))?.sync_state).toBe(
        "REJECTED",
      );
      expect((await db.state_animais.get(animalId))?.lote_id).toBe(
        loteOriginId,
      );
      expect((await db.state_animais.get(animalId))?.revision).toBe(5);
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("E2.8 — lost ACK simulado: worker reenvia a mesma identidade e expected_revision", async () => {
    await seedAnimal(loteOriginId);
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      animalId,
      toLoteId: loteTargetId,
    });
    const tx = await createGesture(farmId, built.ops);
    const operations = await db.queue_ops
      .where("client_tx_id")
      .equals(tx)
      .sortBy("op_order");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network ACK lost"));
    await processGesture((await db.queue_gestures.get(tx))!);
    expect(await db.queue_ops.count()).toBe(3);
    // Retira somente o backoff para exercitar o replay; não fabrica revision.
    await db.queue_gestures.update(tx, {
      status: "PENDING",
      next_attempt_at: undefined,
    });
    await db.state_animais.update(animalId, { revision: 6 });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: operations.map((op) => ({
            op_id: op.client_op_id,
            status: "APPLIED",
          })),
        }),
        { status: 200 },
      ),
    );
    await processGesture((await db.queue_gestures.get(tx))!);
    const requests = vi
      .mocked(fetch)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(
      requests[1].ops.find((op: { table: string }) => op.table === "animais")
        .expected_revision,
    ).toBe(5);
    expect(await db.event_eventos.count()).toBe(1);
    expect((await db.queue_gestures.get(tx))?.status).toBe("DONE");
  });

  it("E2.9 — pull real com transporte mockado copia state remoto divergente; não reconstrói pelo Evento", async () => {
    await seedAnimal(loteOriginId);
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      animalId,
      toLoteId: loteTargetId,
    });
    const tx = await createGesture(farmId, built.ops);
    const operations = await db.queue_ops
      .where("client_tx_id")
      .equals(tx)
      .sortBy("op_order");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: operations.map((op) =>
            op.table === "animais"
              ? {
                  op_id: op.client_op_id,
                  status: "CONFLICT",
                  reason_code: "STATE_REVISION_CONFLICT",
                  retryable: false,
                }
              : { op_id: op.client_op_id, status: "APPLIED" },
          ),
        }),
        { status: 200 },
      ),
    );
    await processGesture((await db.queue_gestures.get(tx))!);
    const serverAnimal = {
      ...(await db.state_animais.get(animalId))!,
      revision: 6,
    };
    const remote: Record<string, unknown[]> = {
      animais: [serverAnimal],
      eventos: await db.event_eventos.toArray(),
      eventos_movimentacao: await db.event_eventos_movimentacao.toArray(),
    };
    vi.mocked(supabase.from).mockImplementation(
      (table: string) =>
        ({
          select: () => ({
            eq: async (_field: string, farm: string) => {
              expect(farm).toBe(farmId);
              return { data: remote[table], error: null };
            },
          }),
        }) as never,
    );
    const actual = await vi.importActual<typeof import("../pull")>("../pull");
    await actual.pullDataForFarm(
      farmId,
      ["animais", "eventos", "eventos_movimentacao"],
      { mode: "merge" },
    );
    expect((await db.state_animais.get(animalId))?.revision).toBe(6);
    expect((await db.state_animais.get(animalId))?.lote_id).toBe(loteOriginId);
    expect(
      (await db.event_eventos_movimentacao.get(built.eventId))?.to_lote_id,
    ).toBe(loteTargetId);
  });

  it("E2.10 — farm switch: drain de B não consome obligation de movimentação de A", async () => {
    const farmB = "10000000-0000-4000-8000-000000000002";
    await upsertReconciliationObligations([
      {
        fazendaId: farmId,
        scope: "factual",
        tables: ["eventos", "eventos_movimentacao", "animais"],
      },
    ]);
    activeFarmId = farmB;
    await drainReconciliationObligations(farmB);
    expect(pullDataForFarm).not.toHaveBeenCalled();
    expect(await db.sync_reconcile_obligations.count()).toBe(1);
    activeFarmId = farmId;
    await drainReconciliationObligations(farmId);
    expect(pullDataForFarm).toHaveBeenCalledWith(
      farmId,
      expect.arrayContaining(["eventos_movimentacao", "animais"]),
      expect.anything(),
    );
    expect(await db.sync_reconcile_obligations.count()).toBe(0);
  });

  it("E2.11 — lote→pasto: captura snapshot, mas envelope e matcher não têm CAS de revision", async () => {
    const fromPastoId = "70000000-0000-4000-8000-000000000001";
    const toPastoId = "70000000-0000-4000-8000-000000000002";
    await db.state_lotes.put({
      id: loteOriginId,
      fazenda_id: farmId,
      pasto_id: fromPastoId,
    } as never);
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      loteId: loteOriginId,
      fromLoteId: loteOriginId,
      toLoteId: loteOriginId,
      movementKind: "lote_pasto",
      fromPastoId,
      toPastoId,
      applyAnimalStateUpdate: false,
      applyLoteStateUpdate: true,
    });
    const tx = await createGesture(farmId, built.ops);
    const update = (
      await db.queue_ops.where("client_tx_id").equals(tx).toArray()
    ).find((op) => op.table === "lotes")!;
    expect(update.before_snapshot?.pasto_id).toBe(fromPastoId);
    expect(update.expected_revision).toBeUndefined();
    const envelope = mapOperationForSync(update, farmId);
    expect(validateStateExpectedRevision(envelope)).toEqual({
      protected: false,
      ok: true,
    });
    expect(buildMutationMatch(envelope, farmId)).toEqual({
      id: loteOriginId,
      fazenda_id: farmId,
    });
  });

  it("E2.12 — snapshot legado: não fabrica revision e regra remota rejeita UPDATE", async () => {
    await seedAnimal(loteOriginId);
    const legacy = { ...(await db.state_animais.get(animalId))! };
    delete legacy.revision;
    await db.state_animais.put(legacy);
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      animalId,
      toLoteId: loteTargetId,
    });
    const tx = await createGesture(farmId, built.ops);
    const update = (
      await db.queue_ops.where("client_tx_id").equals(tx).toArray()
    ).find((op) => op.table === "animais")!;
    expect(
      validateStateExpectedRevision(mapOperationForSync(update, farmId)),
    ).toEqual({
      protected: true,
      ok: false,
      reason_code: "STATE_EXPECTED_REVISION_REQUIRED",
    });
    expect(await db.event_eventos.count()).toBe(1);
  });

  it("E2.13 — corrige_evento_id: builder ainda emite UPDATE comum sem resolvedor de correção", () => {
    const built = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: farmId,
      animalId,
      corrigeEventoId: "40000000-0000-4000-8000-000000000050",
      toLoteId: loteTargetId,
    });
    expect(built.ops[0].record.corrige_evento_id).toBe(
      "40000000-0000-4000-8000-000000000050",
    );
    expect(built.ops[2]).toMatchObject({
      table: "animais",
      action: "UPDATE",
      record: { lote_id: loteTargetId },
    });
  });

  it("CURRENT_BEHAVIOR / E2.1 — A→B→C→D offline captura a mesma revision e não declara predecessor entre gestos", async () => {
    await seedAnimal(loteOriginId, 5);
    const loteFinalId = "30000000-0000-4000-8000-000000000004";
    const targets = [loteTargetId, loteOtherTargetId, loteFinalId];
    const txIds: string[] = [];
    let fromLoteId = loteOriginId;

    for (const [index, toLoteId] of targets.entries()) {
      const eventId = `40000000-0000-4000-8000-00000000006${index}`;
      const built = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: farmId,
        animalId,
        eventId,
        fromLoteId,
        toLoteId,
        occurredAt: "2026-10-01T10:00:00Z",
      });
      const txId = await createGesture(farmId, built.ops);
      txIds.push(txId);
      const operations = await db.queue_ops
        .where("client_tx_id")
        .equals(txId)
        .sortBy("op_order");

      expect(operations.map((op) => op.op_order)).toEqual([0, 1, 2]);
      expect(operations[2].expected_revision).toBe(5);
      expect(operations[2].before_snapshot?.lote_id).toBe(fromLoteId);
      expect(operations[1].record).toMatchObject({
        evento_id: eventId,
        from_lote_id: fromLoteId,
        to_lote_id: toLoteId,
      });
      expect(operations[0].record.source_task_id).toBeNull();
      expect(operations[0].record.corrige_evento_id).toBeNull();
      for (const operation of operations) {
        const envelope = mapOperationForSync(operation, farmId);
        expect(envelope).not.toHaveProperty("movement_base");
        expect(envelope.record).not.toHaveProperty(
          "previous_movement_event_id",
        );
      }
      fromLoteId = toLoteId;
    }

    expect(new Set(txIds).size).toBe(3);
    expect(await db.event_eventos.count()).toBe(3);
    expect(await db.event_eventos_movimentacao.count()).toBe(3);
    expect(await db.state_animais.get(animalId)).toMatchObject({
      lote_id: loteFinalId,
      revision: 5,
    });
    expect(fetch).not.toHaveBeenCalled();
    // Só caracteriza enqueue/optimistic real. Não executa RPC/CAS remoto ou contrato proposto.
  });
});
