import { describe, expect, it, vi } from "vitest";

import { createAgendaActionController } from "@/pages/Agenda/createAgendaActionController";
import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import type { AgendaItem } from "@/lib/offline/types";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

function createAgendaItem(): AgendaItem {
  return {
    id: "agenda-1",
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
      protocolo_id: "protocol-1",
      protocolo_item_id: "protocol-item-1",
    },
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: "protocol-item-1",
    interval_days_applied: 0,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-19T00:00:00.000Z",
    server_received_at: "2026-04-19T00:00:00.000Z",
    created_at: "2026-04-19T00:00:00.000Z",
    updated_at: "2026-04-19T00:00:00.000Z",
    deleted_at: null,
  };
}

describe("flow: agenda -> registrar -> estado", () => {
  it("encadeia navegacao contextual e conclui agenda ao finalizar registro", async () => {
    const navigate = vi.fn();
    const agendaController = createAgendaActionController({
      activeFarmId: "farm-1",
      navigate,
      createGesture: vi.fn().mockResolvedValue(undefined),
      concludePendingSanitary: vi.fn().mockResolvedValue("evt-srv-1"),
      pullDataForFarm: vi.fn().mockResolvedValue(undefined),
      getProtocolItemById: vi.fn().mockResolvedValue(null),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      nowIso: () => "2026-04-19T10:00:00.000Z",
      logError: vi.fn(),
    });

    const agendaItem = createAgendaItem();
    agendaController.goToRegistrar(agendaItem);

    expect(navigate).toHaveBeenCalledWith(
      "/registrar?sourceTaskId=agenda-1&dominio=sanitario&animalId=animal-1&loteId=lote-1&protocoloId=protocol-1&protocoloItemId=protocol-item-1&produto=Vacina+X&sanitarioTipo=vacinacao",
    );

    const deps = createBaseFinalizeDeps();
    const finalize = createRegistrarFinalizeController(deps);
    const onFinalizeHandled = vi.fn();

    await finalize({
      ...createBaseFinalizeInput(),
      onFinalizeHandled,
    });

    expect(deps.commit.buildAgendaCompletionOp).toHaveBeenCalledWith({
      sourceTaskId: "agenda-1",
      linkedEventId: "evt-1",
    });
    expect(deps.commit.runFinalizeGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        fazendaId: "farm-1",
        ops: expect.arrayContaining([
          expect.objectContaining({ table: "eventos", action: "INSERT" }),
          expect.objectContaining({
            table: "agenda_itens",
            action: "UPDATE",
            record: expect.objectContaining({
              id: "agenda-1",
              status: "concluido",
              source_evento_id: "evt-1",
            }),
          }),
        ]),
      }),
    );
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/agenda");
    expect(onFinalizeHandled).toHaveBeenCalled();
  });
});
