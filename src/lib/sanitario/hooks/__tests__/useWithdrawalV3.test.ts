// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { db } from "@/lib/offline/db";
import { useAnimalWithdrawal, useLoteWithdrawal } from "../useWithdrawal";
vi.mock("@/lib/offline/localReadBoundary", () => ({
  requireTenantSensitiveRead: vi.fn(async () => {}),
}));
afterEach(async () => {
  cleanup();
  for (const table of [
    db.event_eventos,
    db.event_eventos_sanitario,
    db.event_eventos_animais,
    db.state_animais,
  ])
    await table.clear();
});
it("reads confirmed group relations for animal and lot without assigning group withdrawal to the remaining animals", async () => {
  for (const id of ["a", "b", "pending-animal"])
    await db.state_animais.put({
      id,
      fazenda_id: "farm",
      lote_id: "lot",
      status: "ativo",
    } as never);
  for (const [id, state, animal] of [
    ["yes", "confirmed", "a"],
    ["wait", "pending", "pending-animal"],
    ["dispute", "collision", "pending-animal"],
    ["late", "late", "pending-animal"],
  ] as const) {
    await db.event_eventos.put({
      id,
      fazenda_id: "farm",
      dominio: "sanitario",
      occurred_at: "2026-10-30T12:00:00Z",
      animal_id: null,
      lote_id: "lot",
      sanitario_v3_confirmation: state,
      payload: {},
    } as never);
    await db.event_eventos_sanitario.put({
      evento_id: id,
      fazenda_id: "farm",
      produto: "Produto A",
      carencia_carne_dias: 30,
      carencia_carne_ate: "2099-01-01",
      payload: {},
    } as never);
    await db.event_eventos_animais.put({
      id: `${id}-animal`,
      fazenda_id: "farm",
      evento_id: id,
      animal_id: animal,
      created_at: new Date().toISOString(),
    });
  }
  const animal = renderHook(() => useAnimalWithdrawal("a", "farm"));
  const remaining = renderHook(() =>
    useAnimalWithdrawal("pending-animal", "farm"),
  );
  const lot = renderHook(() => useLoteWithdrawal("lot", "farm"));
  await waitFor(() =>
    expect(animal.result.current?.carne?.status).toBe("carencia_ativa"),
  );
  await waitFor(() =>
    expect(remaining.result.current?.status).toBe("sem_evento_sanitario"),
  );
  await waitFor(() =>
    expect(lot.result.current?.carne?.status).toBe("carencia_ativa"),
  );
});
