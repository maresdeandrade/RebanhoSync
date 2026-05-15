import { describe, expect, it, vi } from "vitest";

import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";
import type { AgendaItem, ProtocoloSanitarioItem } from "@/lib/offline/types";

function createAgendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "agenda-1",
    fazenda_id: "farm-1",
    dominio: "sanitario",
    tipo: "vacinacao",
    status: "agendado",
    data_prevista: "2026-01-01",
    animal_id: "animal-1",
    lote_id: "lote-1",
    dedup_key: null,
    source_kind: "manual",
    source_ref: {},
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: null,
    interval_days_applied: 0,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-01-01T00:00:00.000Z",
    server_received_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function createDeps(overrides: Partial<Parameters<typeof createAgendaActionController>[0]> = {}) {
  return {
    activeFarmId: "farm-1",
    navigate: vi.fn(),
    createGesture: vi.fn().mockResolvedValue(undefined),
    concludePendingSanitary: vi.fn().mockResolvedValue("evento-12345678"),
    pullDataForFarm: vi.fn().mockResolvedValue(undefined),
    getProtocolItemById: vi.fn().mockResolvedValue(null as ProtocoloSanitarioItem | null),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    nowIso: () => "2026-01-01T00:00:00.000Z",
    logError: vi.fn(),
    ...overrides,
  };
}

describe("createAgendaActionController", () => {
  it("navigates calf journey items to cria-inicial", () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    controller.goToRegistrar(
      createAgendaItem({
        tipo: "desmame",
        dominio: "nutricao",
        source_evento_id: "evento-1",
      }),
    );

    expect(deps.navigate).toHaveBeenCalledWith(
      "/animais/animal-1/cria-inicial?agendaItemId=agenda-1&eventoId=evento-1",
    );
  });

  it("navigates agenda item to Registrar with source task context", () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    controller.goToRegistrar(
      createAgendaItem({
        source_ref: {
          protocolo_id: "protocolo-1",
          protocolo_item_id: "protocolo-item-1",
          produto: "Vacina X",
          tipo: "vacinacao",
        },
      }),
    );

    expect(deps.navigate).toHaveBeenCalledWith(
      "/registrar?sourceTaskId=agenda-1&dominio=sanitario&animalId=animal-1&loteId=lote-1&protocoloId=protocolo-1&protocoloItemId=protocolo-item-1&produto=Vacina+X&sanitarioTipo=vacinacao",
    );
    expect(deps.createGesture).not.toHaveBeenCalled();
    expect(deps.concludePendingSanitary).not.toHaveBeenCalled();
  });

  it("navigates with protocol_item_id legacy key from source_ref", () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    controller.goToRegistrar(
      createAgendaItem({
        protocol_item_version_id: null,
        source_ref: {
          protocolo_id: "protocolo-1",
          protocol_item_id: "protocolo-item-1",
          tipo: "vacinacao",
        },
      }),
    );

    expect(deps.navigate).toHaveBeenCalledWith(
      "/registrar?sourceTaskId=agenda-1&dominio=sanitario&animalId=animal-1&loteId=lote-1&protocoloId=protocolo-1&protocoloItemId=protocolo-item-1&sanitarioTipo=vacinacao",
    );
  });


  it("routes generic conclude to sanitary event and refresh", async () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(
      createAgendaItem({
        source_ref: { tipo: "vacinacao", produto: "Vacina X" },
      }),
      "concluido",
    );

    expect(deps.concludePendingSanitary).toHaveBeenCalled();
    expect(deps.pullDataForFarm).toHaveBeenCalledWith(
      "farm-1",
      ["agenda_itens", "eventos", "eventos_sanitario"],
      { mode: "merge" },
    );
    expect(deps.showSuccess).toHaveBeenCalledWith(
      "Concluído direto na agenda com evento sanitário. Evento evento-1.",
    );
  });

  it("agenda: se concluirPendenciaSanitaria resolve, mas pullDataForFarm falha, trata como sucesso com aviso", async () => {
    const pullError = new Error("pull down failed");
    const deps = createDeps({
      pullDataForFarm: vi.fn().mockRejectedValue(pullError),
    });
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(
      createAgendaItem({
        source_ref: { tipo: "vacinacao", produto: "Vacina X" },
      }),
      "concluido",
    );

    // NOVO CONTRATO: RPC OK, refresh falhou ≠ execução falhou.
    // - Servidor: evento criado, agenda atualizada.
    // - Cliente: UI mostra sucesso com aviso de sincronização pendente.
    // - evento_id preservado.
    expect(deps.concludePendingSanitary).toHaveBeenCalledTimes(1);
    expect(deps.pullDataForFarm).toHaveBeenCalledTimes(1);
    expect(deps.showSuccess).toHaveBeenCalledWith(
      "Execução registrada. A atualização local falhou; sincronize/atualize para refletir o novo estado. Evento evento-1.",
    );
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it("updates locally through gesture for non-sanitary branches", async () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(
      createAgendaItem({ dominio: "pesagem" }),
      "cancelado",
    );

    expect(deps.createGesture).toHaveBeenCalled();
    expect(deps.concludePendingSanitary).not.toHaveBeenCalled();
  });

  it("ignores concurrent duplicate updates for the same agenda item", async () => {
    let releaseCreateGesture: (() => void) | null = null;
    const createGesturePromise = new Promise<void>((resolve) => {
      releaseCreateGesture = resolve;
    });
    const deps = createDeps({
      createGesture: vi.fn().mockImplementation(() => createGesturePromise),
    });
    const controller = createAgendaActionController(deps);
    const item = createAgendaItem({ dominio: "pesagem" });

    const firstCall = controller.updateStatus(item, "cancelado");
    const secondCall = controller.updateStatus(item, "cancelado");

    expect(deps.createGesture).toHaveBeenCalledTimes(1);

    releaseCreateGesture?.();
    await Promise.all([firstCall, secondCall]);
  });

  it("shows farm error when no active farm is available", async () => {
    const deps = createDeps({ activeFarmId: null });
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(createAgendaItem(), "cancelado");

    expect(deps.showError).toHaveBeenCalledWith("Fazenda ativa não encontrada.");
    expect(deps.createGesture).not.toHaveBeenCalled();
  });

  it("regressão: não exibe sucesso se concluirPendenciaSanitaria falhar", async () => {
    const rpcError = new Error("RPC unauthorized");
    const deps = createDeps({
      concludePendingSanitary: vi.fn().mockRejectedValue(rpcError),
    });
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(
      createAgendaItem({
        source_ref: { tipo: "vacinacao", produto: "Vacina X" },
      }),
      "concluido",
    );

    expect(deps.showError).toHaveBeenCalledWith(
      "Falha ao concluir pendência sanitária com evento.",
    );
    expect(deps.showSuccess).not.toHaveBeenCalled();
    expect(deps.pullDataForFarm).not.toHaveBeenCalled();
  });

  it("contrato: RPC sucesso + refresh falha = sucesso com aviso, não erro", async () => {
    // Novo contrato: RPC OK + refresh falha ≠ execução falhou.
    // UI deve mostrar sucesso com aviso de sincronização pendente.
    const pullError = new Error("network down");
    const deps = createDeps({
      pullDataForFarm: vi.fn().mockRejectedValue(pullError),
    });
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(
      createAgendaItem({
        dominio: "sanitario",
        source_ref: { tipo: "vacinacao", produto: "Vacina X" },
      }),
      "concluido",
    );

    expect(deps.concludePendingSanitary).toHaveBeenCalledTimes(1);
    expect(deps.showSuccess).toHaveBeenCalledWith(
      "Execução registrada. A atualização local falhou; sincronize/atualize para refletir o novo estado. Evento evento-1.",
    );
    expect(deps.showError).not.toHaveBeenCalled();
  });
});
