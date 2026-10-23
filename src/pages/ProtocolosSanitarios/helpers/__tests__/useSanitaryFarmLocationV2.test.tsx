// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSanitaryFarmLocationV2 } from "../useSanitaryFarmLocationV2";
const { maybeSingle } = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: () => query, is: () => query, maybeSingle };
  return query;
} } }));
const deferred = () => {
  let resolve!: (value: { data: { municipio: string } | null; error: null }) => void;
  const promise = new Promise<{ data: { municipio: string } | null; error: null }>(done => { resolve = done; });
  return { promise, resolve };
};
describe("localização cadastrada e troca de fazenda", () => {
  beforeEach(() => maybeSingle.mockReset());
  it("ignora resposta tardia da fazenda anterior e só expõe município da fazenda atual", async () => {
    const first = deferred(), second = deferred();
    maybeSingle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ id }) => useSanitaryFarmLocationV2(id), { initialProps: { id: "farm-a" } });
    rerender({ id: "farm-b" });
    await act(async () => first.resolve({ data: { municipio: "Cidade A" }, error: null }));
    expect(result.current).toBeNull();
    await act(async () => second.resolve({ data: { municipio: "Cidade B" }, error: null }));
    expect(result.current).toEqual({ fazendaId: "farm-b", municipio: "Cidade B" });
  });
  it("não reutiliza município anterior quando a nova fazenda está offline", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { municipio: "Cidade A" }, error: null });
    const { result, rerender } = renderHook(({ id }) => useSanitaryFarmLocationV2(id), { initialProps: { id: "farm-a" } });
    await act(async () => {});
    expect(result.current?.municipio).toBe("Cidade A");
    maybeSingle.mockRejectedValueOnce(new Error("offline"));
    rerender({ id: "farm-b" });
    expect(result.current).toBeNull();
    await act(async () => {});
    expect(result.current).toBeNull();
  });
});
