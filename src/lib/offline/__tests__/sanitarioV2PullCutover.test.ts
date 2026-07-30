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
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
    ]);
  });

  it("faz merge append-only idempotente e rejeita colisao divergente", async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      ({
        select: () => ({
          eq: async () => ({ data: [relation()], error: null }),
        }),
      }) as never
    );
    await pullDataForFarm(FARM_ID, ["eventos_animais"], { mode: "merge" });
    await pullDataForFarm(FARM_ID, ["eventos_animais"], { mode: "merge" });
    expect(await db.event_eventos_animais.count()).toBe(1);

    vi.mocked(supabase.from).mockImplementation(() =>
      ({
        select: () => ({
          eq: async () => ({
            data: [relation({ animal_id: crypto.randomUUID() })],
            error: null,
          }),
        }),
      }) as never
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
});
