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

  it.each(["success", "rpc down", "Request timeout"])("bloqueia antes da RPC e do fallback (%s)", async outcome => {
    const complete = vi.fn(async () => { if(outcome !== "success") throw new Error(outcome); return "evt-1"; });
    const pull = vi.fn(); const log = vi.fn();
    await expect(tryRegistrarSanitaryRpcFinalizeEffect({
      tipoManejo:"sanitario", sourceTaskId:"agenda-1", fazendaId:"farm-1", occurredAt:nowIso,
      tipo:"vacinacao",sanitaryProductName:"Vacina X",sanitaryProductMetadata:{},
      concluirPendenciaSanitariaFn:complete,pullDataForFarmFn:pull,onFallbackLog:log,
    })).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");
    expect(complete).not.toHaveBeenCalled(); expect(pull).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
});
