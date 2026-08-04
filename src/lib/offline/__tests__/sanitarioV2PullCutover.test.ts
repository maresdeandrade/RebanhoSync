/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import { db } from "../db";
import { pullDataForFarm, pullSanitarioV2CutoverState } from "../pull";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

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
    await pullSanitarioV2CutoverState(FARM_ID);
    expect(calls).toEqual([
      "sanitario_agenda_v2",
      "sanitario_agenda_animais_v2",
      "eventos",
      "eventos_sanitario",
      "eventos_animais",
      "sanitario_agenda_closures_v2",
    ]);
    expect(await db.queue_gestures.get("tx-pending-before-pull")).toMatchObject(
      { status: "PENDING" },
    );
  });

  it("usa cursor incremental existente e permanece idempotente", async () => {
    const gteCalls: Array<{ table: string; value: string }> = [];
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
  });

  it("protege evento, detalhe e relação pendentes contra tombstone remoto parcial", async () => {
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
    expect(
      await db.sync_pull_cursors.get(`eventos:fazenda:${FARM_ID}`),
    ).toBeUndefined();
    expect(
      await db.sync_pull_cursors.get(`eventos_sanitario:fazenda:${FARM_ID}`),
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
