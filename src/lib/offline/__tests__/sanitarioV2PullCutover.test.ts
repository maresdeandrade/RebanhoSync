/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import { recomputeSanitaryComplianceAfterPullV2 } from "@/lib/sanitario/compliance/sanitaryComplianceV2";
import { db } from "../db";
import { pullDataForFarm, pullSanitarioV2CutoverState } from "../pull";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/sanitario/compliance/sanitaryComplianceV2", () => ({
  recomputeSanitaryComplianceAfterPullV2: vi.fn(async () => ({
    evaluatedAt: "2026-07-30",
    rows: [],
    statuses: {},
    byAnimal: [],
    byLot: [],
    byProtocol: [],
    byItem: [],
    createsAgenda: false,
    createsEvent: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    allowsOperationalRelease: false,
  })),
}));

const FARM_ID = "10000000-0000-4000-8000-000000000001";
const EVENT_ID = "30000000-0000-4000-8000-000000000001";
const ANIMAL_ID = "40000000-0000-4000-8000-000000000001";
const RELATION_ID = "50000000-0000-4000-8000-000000000001";
const CREATED_AT = "2026-07-30T12:00:00.000Z";

function relation(overrides: Record<string, unknown> = {}) {
  return {
    id: RELATION_ID,
    fazenda_id: FARM_ID,
    evento_id: EVENT_ID,
    animal_id: ANIMAL_ID,
    created_at: CREATED_AT,
    ...overrides,
  };
}

describe("sanitario v2 ordered pull", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      db.event_eventos_animais.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.ops_sanitario_agenda_closures_v2.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.sync_pull_cursors.clear(),
    ]);
  });

  it("faz merge append-only idempotente e rejeita colisao divergente", async () => {
    vi.mocked(supabase.from).mockImplementation(
      () =>
        ({
          select: () => ({
            eq: async () => ({ data: [relation()], error: null }),
          }),
        }) as never,
    );
    await pullDataForFarm(FARM_ID, ["eventos_animais"], { mode: "merge" });
    await pullDataForFarm(FARM_ID, ["eventos_animais"], { mode: "merge" });
    expect(await db.event_eventos_animais.count()).toBe(1);

    const canonicalCreatedAt = "2026-07-30T12:00:01.000Z";
    vi.mocked(supabase.from).mockImplementation(
      () =>
        ({
          select: () => ({
            eq: async () => ({
              data: [relation({ created_at: canonicalCreatedAt })],
              error: null,
            }),
          }),
        }) as never,
    );
    await pullDataForFarm(FARM_ID, ["eventos_animais"], { mode: "merge" });
    expect(await db.event_eventos_animais.get(RELATION_ID)).toMatchObject({
      created_at: canonicalCreatedAt,
    });

    vi.mocked(supabase.from).mockImplementation(
      () =>
        ({
          select: () => ({
            eq: async () => ({
              data: [relation({ animal_id: crypto.randomUUID() })],
              error: null,
            }),
          }),
        }) as never,
    );
    await expect(
      pullDataForFarm(FARM_ID, ["eventos_animais"], { mode: "merge" }),
    ).rejects.toThrow("SANITARIO_V2_EVENT_ANIMAL_APPEND_ONLY_VIOLATION");
    expect(await db.event_eventos_animais.count()).toBe(1);
  });

  it("preserva snapshot técnico no round-trip sem sobrescrever fato local pendente", async () => {
    const technicalSnapshot = {
      schemaVersion: "sanitario-executed-product-technical-snapshot-v2",
      eventId: EVENT_ID,
      executedProductId: "60000000-0000-4000-8000-000000000001",
      executedProductName: "Vacina",
      executedProductSnapshot: { productId: "60000000-0000-4000-8000-000000000001", catalogUpdatedAt: CREATED_AT },
      executedDose: { quantity: 2, unit: "mL", basis: "animal" },
      executedRoute: "subcutanea",
      fieldEvidence: [],
      sourceRefs: [],
      limitations: ["technical_source_unavailable"],
    };
    const remoteDetail = {
      evento_id: EVENT_ID,
      fazenda_id: FARM_ID,
      tipo: "vacinacao",
      produto_snapshot: technicalSnapshot,
      updated_at: CREATED_AT,
      deleted_at: null,
    };
    vi.mocked(supabase.from).mockImplementation(
      () => ({ select: () => ({ eq: async () => ({ data: [remoteDetail], error: null }) }) }) as never,
    );

    await pullDataForFarm(FARM_ID, ["eventos_sanitario"], { mode: "merge" });
    await pullDataForFarm(FARM_ID, ["eventos_sanitario"], { mode: "merge" });
    expect((await db.event_eventos_sanitario.get(EVENT_ID))?.produto_snapshot).toEqual(technicalSnapshot);

    await db.queue_ops.add({
      client_op_id: "90000000-0000-4000-8000-000000000001",
      client_tx_id: "90000000-0000-4000-8000-000000000002",
      domain_op_id: "90000000-0000-4000-8000-000000000003",
      table: "sanitario_v2",
      action: "INSERT",
      record: { command: "apply_factual_core", payload: { event: { id: EVENT_ID } } },
      sync_state: "PENDING",
      created_at: CREATED_AT,
    });
    const divergent = { ...remoteDetail, produto_snapshot: { ...technicalSnapshot, executedRoute: "intramuscular" } };
    vi.mocked(supabase.from).mockImplementation(
      (table: string) => ({
        select: () => ({
          eq: async () => ({ data: table === "eventos_sanitario" ? [divergent] : [], error: null }),
        }),
      }) as never,
    );

    await pullSanitarioV2CutoverState(FARM_ID);
    expect((await db.event_eventos_sanitario.get(EVENT_ID))?.produto_snapshot).toEqual(technicalSnapshot);
  });

  it("reconcilia na ordem agenda, alvos, fato, detalhe, animais e closure", async () => {
    await db.queue_gestures.add({
      client_tx_id: "tx-pending-before-pull",
      fazenda_id: FARM_ID,
      client_id: "client-pending-before-pull",
      status: "PENDING",
      created_at: CREATED_AT,
    });
    const calls: string[] = [];
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      calls.push(table);
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      } as never;
    });
    const compliance = await pullSanitarioV2CutoverState(FARM_ID);
    expect(calls).toEqual([
      "sanitario_agenda_v2",
      "sanitario_agenda_animais_v2",
      "eventos",
      "eventos_sanitario",
      "eventos_animais",
      "insumo_movimentacoes",
      "sanitario_agenda_closures_v2",
    ]);
    expect(await db.queue_gestures.get("tx-pending-before-pull")).toMatchObject(
      { status: "PENDING" },
    );
    expect(recomputeSanitaryComplianceAfterPullV2).toHaveBeenCalledOnce();
    expect(recomputeSanitaryComplianceAfterPullV2).toHaveBeenCalledWith({
      fazendaId: FARM_ID,
    });
    expect(compliance).toMatchObject({
      createsAgenda: false,
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
      allowsOperationalRelease: false,
    });
  });

  it("não grava estado parcial nem recalcula conformidade quando uma fonte factual falha", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      ({
        select: () => ({
          eq: async () =>
            table === "eventos_sanitario"
              ? { data: null, error: { message: "detail pull failed" } }
              : {
                  data:
                    table === "eventos"
                      ? [
                          {
                            id: EVENT_ID,
                            fazenda_id: FARM_ID,
                            dominio: "sanitario",
                            updated_at: CREATED_AT,
                            deleted_at: null,
                          },
                        ]
                      : [],
                  error: null,
                },
        }),
      }) as never
    );

    await expect(pullSanitarioV2CutoverState(FARM_ID)).rejects.toMatchObject({
      message: "detail pull failed",
    });

    expect(await db.event_eventos.get(EVENT_ID)).toBeUndefined();
    expect(recomputeSanitaryComplianceAfterPullV2).not.toHaveBeenCalled();
  });

  it("usa cursor incremental existente e permanece idempotente", async () => {
    const gteCalls: Array<{ table: string; value: string }> = [];
    vi.mocked(recomputeSanitaryComplianceAfterPullV2).mockImplementation(
      async ({ fazendaId }) => {
        expect(fazendaId).toBe(FARM_ID);
        expect(await db.event_eventos.get(EVENT_ID)).toMatchObject({
          fazenda_id: FARM_ID,
        });
        return {
          evaluatedAt: "2026-07-30",
          rows: [],
          statuses: {},
          byAnimal: [],
          byLot: [],
          byProtocol: [],
          byItem: [],
          createsAgenda: false,
          createsEvent: false,
          createsStockMovement: false,
          createsActiveWithdrawal: false,
          allowsOperationalRelease: false,
        };
      },
    );
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const result =
        table === "eventos"
          ? {
              data: [
                {
                  id: EVENT_ID,
                  fazenda_id: FARM_ID,
                  dominio: "sanitario",
                  updated_at: CREATED_AT,
                  deleted_at: null,
                },
              ],
              error: null,
            }
          : { data: [], error: null };
      const query = {
        gte: (_column: string, value: string) => {
          gteCalls.push({ table, value });
          return Promise.resolve(result);
        },
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return { select: () => ({ eq: () => query }) } as never;
    });

    await pullSanitarioV2CutoverState(FARM_ID);
    await pullSanitarioV2CutoverState(FARM_ID);

    expect(await db.event_eventos.count()).toBe(1);
    expect(gteCalls).toContainEqual({ table: "eventos", value: CREATED_AT });
    expect(recomputeSanitaryComplianceAfterPullV2).toHaveBeenCalledTimes(2);
  });

  it("protege evento, detalhe, relação e movimento pendentes contra tombstone remoto parcial", async () => {
    await db.event_eventos.put({
      id: EVENT_ID,
      fazenda_id: FARM_ID,
      dominio: "sanitario",
      deleted_at: null,
      updated_at: CREATED_AT,
    } as never);
    await db.event_eventos_sanitario.put({
      evento_id: EVENT_ID,
      fazenda_id: FARM_ID,
      tipo: "vacinacao",
      produto: "Histórico externo",
      payload: {},
      client_id: "client-local",
      client_op_id: "90000000-0000-4000-8000-000000000004",
      client_tx_id: "90000000-0000-4000-8000-000000000002",
      client_recorded_at: CREATED_AT,
      server_received_at: CREATED_AT,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      deleted_at: null,
    } as never);
    await db.event_eventos_animais.put(relation());
    await db.state_insumo_movimentacoes.put({
      id: EVENT_ID,
      fazenda_id: FARM_ID,
      insumo_id: "60000000-0000-4000-8000-000000000001",
      insumo_lote_id: "70000000-0000-4000-8000-000000000001",
      tipo: "consumo_sanitario",
      quantidade_base: 2,
      unidade_base: "ml",
      occurred_at: CREATED_AT,
      source_evento_id: EVENT_ID,
      source_evento_dominio: "sanitario",
      animal_id: ANIMAL_ID,
      rebanho_lote_id: null,
      pasto_id: null,
      observacoes: null,
      payload: {},
      client_id: "client-local",
      client_op_id: "90000000-0000-4000-8000-000000000005",
      client_tx_id: "90000000-0000-4000-8000-000000000002",
      client_recorded_at: CREATED_AT,
      server_received_at: CREATED_AT,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      deleted_at: null,
    });
    await db.queue_ops.add({
      client_op_id: "90000000-0000-4000-8000-000000000001",
      client_tx_id: "90000000-0000-4000-8000-000000000002",
      domain_op_id: "90000000-0000-4000-8000-000000000003",
      table: "sanitario_v2",
      action: "INSERT",
      record: {
        command: "apply_factual_core",
        payload: { event: { id: EVENT_ID } },
      },
      sync_state: "PENDING",
      created_at: CREATED_AT,
    });
    await db.queue_ops.add({
      client_op_id: "90000000-0000-4000-8000-000000000005",
      client_tx_id: "90000000-0000-4000-8000-000000000002",
      domain_op_id: "90000000-0000-4000-8000-000000000006",
      table: "state_insumo_movimentacoes",
      action: "INSERT",
      record: { source_evento_id: EVENT_ID },
      sync_state: "PENDING",
      created_at: CREATED_AT,
    });
    vi.mocked(supabase.from).mockImplementation(
      (table: string) =>
        ({
          select: () => ({
            eq: async () => ({
              data:
                table === "eventos"
                  ? [
                      {
                        id: EVENT_ID,
                        fazenda_id: FARM_ID,
                        dominio: "sanitario",
                        deleted_at: "2026-07-31T12:00:00.000Z",
                        updated_at: "2026-07-31T12:00:00.000Z",
                      },
                    ]
                  : table === "eventos_sanitario"
                    ? [
                        {
                          evento_id: EVENT_ID,
                          fazenda_id: FARM_ID,
                          deleted_at: "2026-07-31T12:00:00.000Z",
                          updated_at: "2026-07-31T12:00:00.000Z",
                        },
                      ]
                    : table === "eventos_animais"
                      ? [relation({ animal_id: crypto.randomUUID() })]
                      : table === "insumo_movimentacoes"
                        ? [
                            {
                              id: EVENT_ID,
                              fazenda_id: FARM_ID,
                              source_evento_id: EVENT_ID,
                              deleted_at: "2026-07-31T12:00:00.000Z",
                              updated_at: "2026-07-31T12:00:00.000Z",
                            },
                          ]
                      : [],
              error: null,
            }),
          }),
        }) as never,
    );

    await pullSanitarioV2CutoverState(FARM_ID);

    expect(await db.event_eventos.get(EVENT_ID)).toMatchObject({
      deleted_at: null,
    });
    expect(await db.event_eventos_sanitario.get(EVENT_ID)).toMatchObject({
      deleted_at: null,
    });
    expect(await db.event_eventos_animais.get(RELATION_ID)).toMatchObject({
      animal_id: ANIMAL_ID,
    });
    expect(await db.state_insumo_movimentacoes.get(EVENT_ID)).toMatchObject({
      deleted_at: null,
      quantidade_base: 2,
    });
    expect(
      await db.sync_pull_cursors.get(`eventos:fazenda:${FARM_ID}`),
    ).toBeUndefined();
    expect(
      await db.sync_pull_cursors.get(`eventos_sanitario:fazenda:${FARM_ID}`),
    ).toBeUndefined();
    expect(
      await db.sync_pull_cursors.get(
        `insumo_movimentacoes:fazenda:${FARM_ID}`,
      ),
    ).toBeUndefined();
  });

  it("aplica tombstone remoto conservador quando não há operação pendente", async () => {
    await db.event_eventos.put({
      id: EVENT_ID,
      fazenda_id: FARM_ID,
      dominio: "sanitario",
      deleted_at: null,
      updated_at: CREATED_AT,
    } as never);
    vi.mocked(supabase.from).mockImplementation(
      (table: string) =>
        ({
          select: () => ({
            eq: async () => ({
              data:
                table === "eventos"
                  ? [
                      {
                        id: EVENT_ID,
                        fazenda_id: FARM_ID,
                        dominio: "sanitario",
                        deleted_at: "2026-07-31T12:00:00.000Z",
                        updated_at: "2026-07-31T12:00:00.000Z",
                      },
                    ]
                  : [],
              error: null,
            }),
          }),
        }) as never,
    );

    await pullSanitarioV2CutoverState(FARM_ID);

    expect(await db.event_eventos.get(EVENT_ID)).toMatchObject({
      deleted_at: "2026-07-31T12:00:00.000Z",
    });
  });
});
