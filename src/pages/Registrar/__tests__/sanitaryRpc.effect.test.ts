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

  it("retorna handled_refresh_failed quando RPC sucesso mas pull falha", async () => {
    const concluirSpy = vi.fn(async () => "evt-1");
    const pullError = new Error("pull failed");
    const pullSpy = vi.fn(async () => {
      throw pullError;
    });

    const result = await tryRegistrarSanitaryRpcFinalizeEffect({
      tipoManejo: "sanitario",
      sourceTaskId: "agenda-1",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      tipo: "vacinacao",
      sanitaryProductName: "Vacina X",
      sanitaryProductMetadata: {},
      concluirPendenciaSanitariaFn: concluirSpy,
      pullDataForFarmFn: pullSpy,
    });

    expect(result).toEqual({ status: "handled_refresh_failed", eventoId: "evt-1", error: pullError });
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

  it("retorna ambiguous quando RPC falha por timeout/network", async () => {
    const error = new Error("Request timeout");
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

    expect(result).toEqual({ status: "ambiguous", error });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
