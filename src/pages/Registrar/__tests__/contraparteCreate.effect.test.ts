import { describe, expect, it, vi } from "vitest";
import {
  runRegistrarCreateContraparteEffect,
  type RegistrarNovaContraparteDraft,
} from "@/pages/Registrar/effects/contraparteCreate";

const baseDraft: RegistrarNovaContraparteDraft = {
  tipo: "empresa",
  nome: "  Frigorifico XPTO  ",
  documento: "  12.345.678/0001-99  ",
  telefone: "  +55 11 99999-9999  ",
  email: "  contato@xpto.com  ",
  endereco: "  Rua A, 123  ",
};

describe("runRegistrarCreateContraparteEffect", () => {
  it("monta gesture de contraparte com campos normalizados", async () => {
    const createGestureFn = vi.fn(async () => "tx-123");

    const result = await runRegistrarCreateContraparteEffect({
      fazendaId: "farm-1",
      draft: baseDraft,
      createGestureFn,
    });

    expect(result.txId).toBe("tx-123");
    expect(result.contraparteId).toBeTypeOf("string");
    expect(createGestureFn).toHaveBeenCalledTimes(1);
    const [fazendaId, ops] = createGestureFn.mock.calls[0] as [
      string,
      Array<{ record: Record<string, unknown> }>,
    ];
    expect(fazendaId).toBe("farm-1");
    expect(ops[0]?.record).toMatchObject({
      tipo: "empresa",
      nome: "Frigorifico XPTO",
      documento: "12.345.678/0001-99",
      telefone: "+55 11 99999-9999",
      email: "contato@xpto.com",
      endereco: "Rua A, 123",
      payload: { origem: "registrar_financeiro" },
    });
  });
});
