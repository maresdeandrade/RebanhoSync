import { describe, expect, it, vi } from "vitest";

import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";
import type { AgendaItem } from "@/lib/offline/types";

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
    showError: vi.fn(),
    showSuccess: vi.fn(),
    ...overrides,
  };
}

describe("createAgendaActionController", () => {
  it.each(["concluido", "cancelado"] as const)("bloqueia status sanitário %s sem escrever em agenda_itens", async (status) => {
    const deps = createDeps();
    await createAgendaActionController(deps).updateStatus(createAgendaItem(), status);

    expect(deps.showError).toHaveBeenCalledWith(
      "Itens sanitários devem ser gerenciados exclusivamente na Central Sanitária.",
    );
    expect(deps.createGesture).not.toHaveBeenCalled();
    expect(deps.showSuccess).not.toHaveBeenCalled();
  });
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
        protocol_item_version_id: "protocolo-item-1",
        source_ref: {
          protocolo_id: "protocolo-1",
          produto: "Vacina X",
          tipo: "vacinacao",
        },
      }),
    );

    expect(deps.navigate).toHaveBeenCalledWith("/protocolos-sanitarios?tab=agenda");
  });

  it("navigates lote-only agenda item to Registrar with lote context", () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    controller.goToRegistrar(
      createAgendaItem({
        animal_id: null,
        lote_id: "lote-1",
        source_ref: {
          protocolo_id: "protocolo-1",
          produto: "Vacina Lote",
          tipo: "vacinacao",
        },
      }),
    );

    expect(deps.navigate).toHaveBeenCalledWith("/protocolos-sanitarios?tab=agenda");
  });

  it("does not use legacy source_ref key as protocol version id", () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    controller.goToRegistrar(
      createAgendaItem({
        protocol_item_version_id: null,
        source_ref: {
          protocolo_id: "protocolo-1",
          item_code: "dose_1",
          tipo: "vacinacao",
        },
      }),
    );

    expect(deps.navigate).toHaveBeenCalledWith("/protocolos-sanitarios?tab=agenda");
  });
  it("updates locally through gesture for non-sanitary branches", async () => {
    const deps = createDeps();
    const controller = createAgendaActionController(deps);

    await controller.updateStatus(
      createAgendaItem({ dominio: "pesagem" }),
      "cancelado",
    );

    expect(deps.createGesture).toHaveBeenCalled();
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

});
