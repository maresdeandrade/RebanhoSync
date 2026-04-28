import { describe, expect, it, vi } from "vitest";
import { executeSanitaryCompletion } from "@/lib/sanitario/infrastructure/executionBoundary";

const nowIso = "2026-01-01T00:00:00.000Z";

function baseInput() {
  return {
    tipoManejo: "sanitario",
    sourceTaskId: "agenda-1",
    fazendaId: "farm-1",
    occurredAt: nowIso,
    tipo: "vacinacao" as const,
    sanitaryProductName: "Vacina X",
    sanitaryProductMetadata: {
      protocolo_item_id: "item-1",
      protocolo_id: "proto-1",
      family_code: "raiva_herbivoros",
      regime_sanitario: {
        family_code: "raiva_herbivoros",
        milestone_code: "raiva_d1",
      },
    },
  };
}

describe("executeSanitaryCompletion", () => {
  it("online: conclui agenda sanitaria via RPC e atualiza estado local", async () => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-1");
    const refreshStateAfterCompletion = vi.fn(async () => undefined);

    const result = await executeSanitaryCompletion({
      ...baseInput(),
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
    });

    expect(result).toEqual({ status: "handled", eventoId: "evt-1" });
    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(1);
    expect(completeAgendaWithEvent).toHaveBeenCalledWith({
      agendaItemId: "agenda-1",
      occurredAt: nowIso,
      tipo: "vacinacao",
      produto: "Vacina X",
      payload: {
        origem: "registrar_manejo",
        protocolo_item_id: "item-1",
        protocolo_id: "proto-1",
        family_code: "raiva_herbivoros",
        regime_sanitario: {
          family_code: "raiva_herbivoros",
          milestone_code: "raiva_d1",
        },
      },
    });
    expect(refreshStateAfterCompletion).toHaveBeenCalledWith("farm-1", [
      "agenda_itens",
      "eventos",
      "eventos_sanitario",
    ]);
  });

  it("fallback: retorna fallback quando RPC falha de forma recuperavel", async () => {
    const error = new Error("rpc down");
    const completeAgendaWithEvent = vi.fn(async () => {
      throw error;
    });
    const refreshStateAfterCompletion = vi.fn(async () => undefined);
    const onFallbackLog = vi.fn();

    const result = await executeSanitaryCompletion({
      ...baseInput(),
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
      onFallbackLog,
    });

    expect(result).toEqual({ status: "fallback", error });
    expect(onFallbackLog).toHaveBeenCalledWith(error);
    expect(refreshStateAfterCompletion).not.toHaveBeenCalled();
  });

  it("erro nao recuperavel: preserva erro e mensagem sem acionar fallback", async () => {
    const error = new Error("permission denied");
    const completeAgendaWithEvent = vi.fn(async () => {
      throw error;
    });
    const onFallbackLog = vi.fn();

    const result = await executeSanitaryCompletion({
      ...baseInput(),
      completeAgendaWithEvent,
      shouldFallbackOnError: () => false,
      onFallbackLog,
    });

    expect(result).toEqual({
      status: "error",
      error,
      message: "permission denied",
    });
    expect(onFallbackLog).not.toHaveBeenCalled();
  });

  it("sourceTaskId: preserva sourceTaskId como agendaItemId", async () => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-1");

    await executeSanitaryCompletion({
      ...baseInput(),
      sourceTaskId: "agenda-source-123",
      completeAgendaWithEvent,
      refreshStateAfterCompletion: vi.fn(async () => undefined),
    });

    expect(completeAgendaWithEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        agendaItemId: "agenda-source-123",
      }),
    );
  });

  it("idempotencia: nao duplica tentativa de RPC para uma chamada de boundary", async () => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-1");

    await executeSanitaryCompletion({
      ...baseInput(),
      completeAgendaWithEvent,
      refreshStateAfterCompletion: vi.fn(async () => undefined),
    });

    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(1);
  });

  it("skip: ignora fluxo que nao e sanitario ou nao possui sourceTaskId", async () => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-1");

    const nonSanitary = await executeSanitaryCompletion({
      ...baseInput(),
      tipoManejo: "pesagem",
      completeAgendaWithEvent,
    });
    const withoutSourceTask = await executeSanitaryCompletion({
      ...baseInput(),
      sourceTaskId: "",
      completeAgendaWithEvent,
    });

    expect(nonSanitary).toEqual({ status: "skip" });
    expect(withoutSourceTask).toEqual({ status: "skip" });
    expect(completeAgendaWithEvent).not.toHaveBeenCalled();
  });
});
