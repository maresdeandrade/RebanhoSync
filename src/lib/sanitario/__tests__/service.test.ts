import { beforeEach, describe, expect, it, vi } from "vitest";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/infrastructure/service";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: rpcMock, from: fromMock },
}));

describe("conclusão sanitária anterior sob o contrato V3", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([undefined, "original-client-op"])(
    "bloqueia antes de qualquer acesso remoto, com clientOpId=%s",
    async (clientOpId) => {
      await expect(concluirPendenciaSanitaria({
        agendaItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        tipo: "vacinacao",
        produto: "Vacina X",
        clientOpId,
      })).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");

      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

  it("mantém o bloqueio em tentativas repetidas sem gerar execução remota", async () => {
    const input = { agendaItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" };
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(concluirPendenciaSanitaria(input))
        .rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");
    }
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
