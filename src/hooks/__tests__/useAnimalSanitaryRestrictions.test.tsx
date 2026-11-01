/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import type { SanitarioCaso } from "@/lib/offline/types";
import { useAnimalSanitaryRestrictions } from "../useAnimalSanitaryRestrictions";
import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
const animal = { id: "synthetic-hook-animal", fazenda_id: "farm-a", identificacao: "SYNTHETIC", payload: {} };
const row = { id: "synthetic-hook-case", fazenda_id: "farm-a", animal_id: animal.id,
  status: "aberto", movement_blocked: true, closed_at: null, deleted_at: null, disease_name: "Caso local" } as SanitarioCaso;
beforeEach(async () => { await db.state_sanitario_casos.clear(); });
afterEach(async () => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); await db.state_sanitario_casos.clear(); });
describe("local sanitary case subscription", () => {
  it("has no case evidence without an active farm", async () => {
    const { result } = renderHook(() => useAnimalSanitaryRestrictions(undefined, [animal]));
    expect(result.current.restrictions).toEqual([]);
    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.restrictions).toEqual([]);
  });

  it("retains the last observed cases as stale evidence after a later query failure, never across farms", async () => {
    await db.state_sanitario_casos.put(row);
    const { result, rerender } = renderHook(({ farmId }) => useAnimalSanitaryRestrictions(farmId, [animal]), { initialProps: { farmId: "farm-a" } });
    await waitFor(() => expect(result.current.restrictions[0]?.caseIds).toEqual([row.id]));
    vi.spyOn(db.state_sanitario_casos, "where").mockReturnValue({ equals: () => ({
      toArray: async () => { throw new Error("LOCAL_CASE_QUERY_FAILED_AFTER_READ"); },
    }) } as never);
    await act(async () => { await db.state_sanitario_casos.put({ ...row, observacoes: "invalidate live query" }); });
    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.restrictions[0]?.caseIds).toEqual([row.id]);
    rerender({ farmId: "farm-b" });
    expect(result.current.restrictions).toEqual([]);
    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.restrictions).toEqual([]);
  });

  it("reports unavailable cases without crashing the page or clearing legacy evidence", async () => {
    vi.spyOn(db.state_sanitario_casos, "where").mockReturnValue({ equals: () => ({
      toArray: async () => { throw new Error("LOCAL_CASE_QUERY_FAILED"); },
    }) } as never);
    const legacy = { ...animal, payload: { sanidade_alerta: { status: "suspeita_aberta", movement_blocked: true } } };
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() { return { failed: true }; }
      render() { return this.state.failed ? <p>QUERY_CRASH</p> : this.props.children; }
    }
    function Subject() {
      const result = useAnimalSanitaryRestrictions("farm-a", [legacy]);
      return <p>{result.isUnavailable ? "unavailable" : "pending"}:{result.restrictions.length}</p>;
    }
    render(<Boundary><Subject /></Boundary>);
    expect(await screen.findByText("unavailable:1")).toBeTruthy();
    expect(screen.queryByText("QUERY_CRASH")).toBeNull();
  });

  it("observes offline insertion and closure without writing projection or queue", async () => {
    const network = vi.fn(() => { throw new Error("NETWORK_FORBIDDEN"); }); vi.stubGlobal("fetch", network);
    const beforeQueue = await db.queue_ops.count();
    const { result } = renderHook(() => useAnimalSanitaryRestrictions("farm-a", [animal]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.restrictions).toEqual([]);
    await act(async () => { await db.state_sanitario_casos.put(row); });
    await waitFor(() => expect(result.current.restrictions[0]?.caseIds).toEqual([row.id]));
    await act(async () => { await db.state_sanitario_casos.update(row.id, { status: "encerrado", closed_at: "2026-10-30" }); });
    await waitFor(() => expect(result.current.restrictions).toEqual([]));
    expect(network).not.toHaveBeenCalled(); expect(await db.queue_ops.count()).toBe(beforeQueue);
    expect(animal.payload).toEqual({});
  });
  it("drops previous farm snapshot immediately on switch", async () => {
    await db.state_sanitario_casos.put(row);
    const { result, rerender } = renderHook(({ farmId }) => useAnimalSanitaryRestrictions(farmId, [animal]), { initialProps: { farmId: "farm-a" } });
    await waitFor(() => expect(result.current.restrictions).toHaveLength(1));
    rerender({ farmId: "farm-b" }); expect(result.current.restrictions).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false)); expect(result.current.cases).toEqual([]);
  });
});
