import { describe, expect, it, vi } from "vitest";
import { tryRegistrarSanitaryRpcFinalizeEffect } from "@/pages/Registrar/effects/sanitaryRpc";

const nowIso = "2026-01-01T00:00:00.000Z";

describe("tryRegistrarSanitaryRpcFinalizeEffect", () => {
  it("retorna skip quando nao eh fluxo sanitario", async () => {
    const result = await tryRegistrarSanitaryRpcFinalizeEffect({
      tipoManejo: "pesagem",
      sourceTaskId: "agenda-1",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      tipo: "vacinacao",
      sanitaryProductName: "Vacina X",
      sanitaryProductMetadata: {},
    });

    expect(result).toEqual({ status: "skip" });
  });

  it("retorna handled quando RPC e pull concluem", async () => {
    const concluirSpy = vi.fn(async () => "evt-1");
    const pullSpy = vi.fn(async () => undefined);

    const result = await tryRegistrarSanitaryRpcFinalizeEffect({
      tipoManejo: "sanitario",
      sourceTaskId: "agenda-1",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      tipo: "vacinacao",
      sanitaryProductName: "Vacina X",
      sanitaryProductMetadata: { lote: "A1" },
      concluirPendenciaSanitariaFn: concluirSpy,
      pullDataForFarmFn: pullSpy,
    });

    expect(result).toEqual({ status: "handled", eventoId: "evt-1" });
    expect(concluirSpy).toHaveBeenCalledTimes(1);
    expect(pullSpy).toHaveBeenCalledWith("farm-1", [
      "agenda_itens",
      "eventos",
      "eventos_sanitario",
    ]);
  });

  it("retorna fallback quando RPC falha", async () => {
    const error = new Error("rpc down");
    const concluirSpy = vi.fn(async () => {
      throw error;
    });
    const logSpy = vi.fn();

    const result = await tryRegistrarSanitaryRpcFinalizeEffect({
      tipoManejo: "sanitario",
      sourceTaskId: "agenda-1",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      tipo: "vacinacao",
      sanitaryProductName: "Vacina X",
      sanitaryProductMetadata: {},
      concluirPendenciaSanitariaFn: concluirSpy,
      onFallbackLog: logSpy,
    });

    expect(result.status).toBe("fallback");
    expect(logSpy).toHaveBeenCalledWith(error);
  });
});
