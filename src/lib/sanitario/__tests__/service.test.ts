import { describe, it, expect, vi, beforeEach } from 'vitest';
import { concluirPendenciaSanitaria } from "@/lib/sanitario/infrastructure/service";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

describe("sanitario service", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
  });

  it("calls RPC with idempotency metadata and returns evento_id", async () => {
    rpcMock.mockResolvedValue({
      data: "11111111-1111-1111-1111-111111111111",
      error: null,
    });

    const eventoId = await concluirPendenciaSanitaria({
      agendaItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      tipo: "vacinacao",
      produto: "Vacina X",
      payload: { fabricante: "Lab Y" },
    });

    expect(eventoId).toBe("11111111-1111-1111-1111-111111111111");
    expect(rpcMock).toHaveBeenCalledTimes(1);

    const [rpcName, params] = rpcMock.mock.calls[0];
    expect(rpcName).toBe("sanitario_complete_agenda_with_event");
    expect(params._agenda_item_id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(params._tipo).toBe("vacinacao");
    expect(params._produto).toBe("Vacina X");
    expect(params._sanitario_payload).toEqual({ fabricante: "Lab Y" });
    expect(params._client_id).toMatch(/^browser:/);
    expect(typeof params._client_op_id).toBe("string");
  });

  it("throws when RPC returns error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "erro rpc" },
    });

    await expect(
      concluirPendenciaSanitaria({
        agendaItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      }),
    ).rejects.toThrow("erro rpc");
  });
});
