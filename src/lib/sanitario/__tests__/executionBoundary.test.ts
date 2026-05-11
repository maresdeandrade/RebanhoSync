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

  it("handled_refresh_failed: RPC sucesso mas refresh falha, preserva evento_id", async () => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-1");
    const refreshError = new Error("pull down failed");
    const refreshStateAfterCompletion = vi.fn(async () => {
      throw refreshError;
    });

    const result = await executeSanitaryCompletion({
      ...baseInput(),
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
    });

    // NOVO CONTRATO: RPC executou com sucesso (evento criado no servidor), mas refresh falhou.
    // - Servidor: evento INSERT OK, agenda atualizada.
    // - Cliente: UI pode mostrar sucesso com aviso de sincronização pendente.
    // - evento_id preservado para referência.
    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(1);
    expect(refreshStateAfterCompletion).toHaveBeenCalledWith("farm-1", [
      "agenda_itens",
      "eventos",
      "eventos_sanitario",
    ]);
    expect(result).toEqual({ status: "handled_refresh_failed", eventoId: "evt-1", error: refreshError });
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

  it("contrato: RPC sucesso + refresh timeout = handled_refresh_failed, evento ja existe no servidor", async () => {
    const completeAgendaWithEvent = vi.fn(async () => "evt-network-123");
    const timeoutError = new Error("Request timeout");
    const refreshStateAfterCompletion = vi.fn(async () => {
      throw timeoutError;
    });

    const result = await executeSanitaryCompletion({
      ...baseInput(),
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
    });

    // Mesmo com falha de refresh (timeout ou conexão), o evento foi criado no servidor.
    // A UI tratará como sucesso com aviso de sincronização pendente.
    // Este cenário é especialmente crítico em conexão fraca ou móvel.
    expect(result.status).toBe("handled_refresh_failed");
    expect(result.eventoId).toBe("evt-network-123");
    expect(result.error).toBe(timeoutError);
    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(1);
  });

  it("contrato: segunda chamada da RPC para mesmo agendaItemId com novo client_op_id", async () => {
    const callsToRpc: string[] = [];
    const completeAgendaWithEvent = vi.fn(async (input) => {
      callsToRpc.push(input.agendaItemId);
      // Simula RPC que sempre retorna evento (sem dedup por cliente).
      return `evt-${callsToRpc.length}`;
    });
    const refreshStateAfterCompletion = vi.fn(async () => undefined);

    // Primeira chamada
    const result1 = await executeSanitaryCompletion({
      ...baseInput(),
      sourceTaskId: "agenda-abc",
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
    });

    // Segunda chamada com mesmo sourceTaskId (simulando retry do cliente sem dedup por side do servidor)
    const result2 = await executeSanitaryCompletion({
      ...baseInput(),
      sourceTaskId: "agenda-abc",
      completeAgendaWithEvent,
      refreshStateAfterCompletion,
    });

    // OBSERVAÇÃO: Este teste documenta que o boundary não impede segunda RPC.
    // A idempotência é responsabilidade do servidor via client_op_id + SELECT ... FOR UPDATE.
    // Se o servidor não bloquear agenda_itens com status='agendado', duas chamadas =
    // dois eventos para a mesma pendência.
    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({ status: "handled", eventoId: "evt-1" });
    expect(result2).toEqual({ status: "handled", eventoId: "evt-2" });
  });
});
