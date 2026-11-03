import { describe, expect, it, vi } from "vitest";
import { executeSanitaryCompletion } from "@/lib/sanitario/infrastructure/executionBoundary";

function baseInput() {
  return {
    tipoManejo: "sanitario",
    sourceTaskId: "agenda-1",
    fazendaId: "farm-1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    tipo: "vacinacao" as const,
    sanitaryProductName: "Vacina X",
    sanitaryProductMetadata: {},
  };
}

describe("executeSanitaryCompletion sob o contrato V3", () => {
  it.each(["success", "rpc down", "Request timeout"])(
    "propaga bloqueio antes de RPC, refresh ou fallback (%s)",
    async (outcome) => {
      const completeAgendaWithEvent = vi.fn(async () => {
        if (outcome !== "success") throw new Error(outcome);
        return "evt-1";
      });
      const refreshStateAfterCompletion = vi.fn(async () => undefined);
      const shouldFallbackOnError = vi.fn(() => true);
      const onFallbackLog = vi.fn();

      await expect(executeSanitaryCompletion({
        ...baseInput(),
        completeAgendaWithEvent,
        refreshStateAfterCompletion,
        shouldFallbackOnError,
        onFallbackLog,
      })).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");

      expect(completeAgendaWithEvent).not.toHaveBeenCalled();
      expect(refreshStateAfterCompletion).not.toHaveBeenCalled();
      expect(shouldFallbackOnError).not.toHaveBeenCalled();
      expect(onFallbackLog).not.toHaveBeenCalled();
    },
  );

  it.each([
    { tipoManejo: "pesagem", sourceTaskId: "agenda-1" },
    { tipoManejo: "sanitario", sourceTaskId: "" },
  ])("preserva skip sem efeitos para %j", async (input) => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-1");
    const refreshStateAfterCompletion = vi.fn(async () => undefined);
    const onFallbackLog = vi.fn();

    await expect(executeSanitaryCompletion({
      ...baseInput(),
      ...input,
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
      onFallbackLog,
    })).resolves.toEqual({ status: "skip" });

    expect(completeAgendaWithEvent).not.toHaveBeenCalled();
    expect(refreshStateAfterCompletion).not.toHaveBeenCalled();
    expect(onFallbackLog).not.toHaveBeenCalled();
  });
});
