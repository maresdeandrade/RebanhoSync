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

  it("fallback: refresh/pull falha mesmo com RPC concluida (servidor pode ter criado evento)", async () => {
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

    // CONTRATO CRÍTICO: boundary não diferencia "RPC ok mas refresh falhou" de "RPC falhou".
    // Se o RPC resolve (retorna evt-1), mas o refresh rejeita:
    // - Servidor: evento INSERT OK, agenda atualizada, recompute executado.
    // - Cliente: UI percebe fallback/erro.
    // - Risco: inconsistência percetível — pendência sanitária pode estar concluída no servidor,
    //   mas usuário vê "Falha ao concluir" na tela e pode tentar novamente.
    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(1);
    expect(refreshStateAfterCompletion).toHaveBeenCalledWith("farm-1", [
      "agenda_itens",
      "eventos",
      "eventos_sanitario",
    ]);
    expect(result).toEqual({ status: "fallback", error: refreshError });
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

  it("contrato: RPC sucesso + refresh timeout = fallback, mas evento ja existe no servidor", async () => {
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
    // A UI tratará como fallback/erro, mas a próxima sincronização (offline) recuperará o evento.
    // Este cenário é especialmente crítico em conexão fraca ou móvel.
    expect(result.status).toBe("fallback");
    expect(completeAgendaWithEvent).toHaveBeenCalledTimes(1);
    // Nota: completou, mas refresh falhou → estado inconsistente temporariamente.
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
