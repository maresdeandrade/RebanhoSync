import { describe, expect, it, vi } from "vitest";

import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";
import type { AgendaItem, ProtocoloSanitarioItem } from "@/lib/offline/types";

function createAgendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "agenda-smoke-1",
    fazenda_id: "farm-1",
    dominio: "sanitario",
    tipo: "vacinacao",
    status: "agendado",
    data_prevista: "2026-04-19",
    animal_id: "animal-1",
    lote_id: "lote-1",
    dedup_key: null,
    source_kind: "manual",
    source_ref: {
      tipo: "vacinacao",
      produto: "Vacina X",
      protocolo_id: "protocolo-1",
    },
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: "evento-1",
    protocol_item_version_id: "protocolo-item-1",
    protocol_item_logical_key: "logical-item-1",
    protocol_item_version: 1,
    protocol_item_code: "dose_1",
    interval_days_applied: 0,
    payload: {
      produto: "Vacina X",
    },
    client_id: "client-1",
    client_op_id: "agenda-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-19T00:00:00.000Z",
    server_received_at: "2026-04-19T00:00:00.000Z",
    created_at: "2026-04-19T00:00:00.000Z",
    updated_at: "2026-04-19T00:00:00.000Z",
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
    nowIso: () => "2026-04-19T10:00:00.000Z",
    logError: vi.fn(),
    ...overrides,
  };
}

describe("smoke: agenda sanitaria", () => {
  it("direciona para a central e impede conclusao pela agenda legada", async () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);
    const item = createAgendaItem();

    controller.goToRegistrar(item);

    expect(deps.navigate).toHaveBeenCalledWith("/protocolos-sanitarios?tab=agenda");

    await controller.updateStatus(item, "concluido");

    expect(deps.showError).toHaveBeenCalledWith("Itens sanitários devem ser gerenciados exclusivamente na Central Sanitária.");
    expect(deps.createGesture).not.toHaveBeenCalled();
    expect(deps.concludePendingSanitary).not.toHaveBeenCalled();
    expect(deps.pullDataForFarm).not.toHaveBeenCalled();
  });
});
