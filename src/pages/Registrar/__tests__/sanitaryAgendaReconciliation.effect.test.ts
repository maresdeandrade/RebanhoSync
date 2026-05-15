import { describe, expect, it, vi } from "vitest";
import type { AgendaItem, ProtocoloSanitarioItem } from "@/lib/offline/types";
import { resolveManualSanitaryAgendaCompletionOpsEffect } from "@/pages/Registrar/effects/sanitaryAgendaReconciliation";

const nowIso = "2026-05-13T00:00:00.000Z";

function agendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "agenda-1",
    fazenda_id: "farm-1",
    dominio: "sanitario",
    tipo: "vacinacao",
    status: "agendado",
    data_prevista: "2026-05-01",
    animal_id: "animal-1",
    lote_id: "lote-1",
    dedup_key: "dedup-1",
    source_kind: "automatico",
    source_ref: {},
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: "item-1",
    interval_days_applied: 365,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: nowIso,
    server_received_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
    ...overrides,
  };
}

function protocolItem(overrides: Partial<ProtocoloSanitarioItem> = {}): ProtocoloSanitarioItem {
  return {
    id: "item-1",
    fazenda_id: "farm-1",
    protocolo_id: "protocolo-1",
    protocol_item_id: "protocol-item-1",
    version: 1,
    tipo: "vacinacao",
    produto: "Vacina Raiva Herbivoros",
    intervalo_dias: 365,
    dose_num: 1,
    gera_agenda: true,
    dedup_template: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-item-1",
    client_tx_id: null,
    client_recorded_at: nowIso,
    server_received_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
    ...overrides,
  };
}

describe("resolveManualSanitaryAgendaCompletionOpsEffect", () => {
  it("conclui a pendencia mais antiga do animal quando produto e tipo batem", async () => {
    const loadPendingAgendaItems = vi.fn(async () => [
      agendaItem({ id: "agenda-2", data_prevista: "2026-05-10" }),
      agendaItem({ id: "agenda-1", data_prevista: "2026-05-01" }),
    ]);
    const loadProtocolItems = vi.fn(async () => [protocolItem()]);

    const ops = await resolveManualSanitaryAgendaCompletionOpsEffect({
      fazendaId: "farm-1",
      linkedEventId: "evt-1",
      animalId: "animal-1",
      sanitarioTipo: "vacinacao",
      sanitaryProductName: "Vacina Raiva Herbivoros",
      protocoloItem: null,
      loadPendingAgendaItems,
      loadProtocolItems,
    });

    expect(loadPendingAgendaItems).toHaveBeenCalledWith({
      fazendaId: "farm-1",
      animalId: "animal-1",
    });
    expect(ops).toEqual([
      {
        table: "agenda_itens",
        action: "UPDATE",
        record: {
          id: "agenda-1",
          status: "concluido",
          source_evento_id: "evt-1",
        },
      },
    ]);
  });

  it("usa match exato por protocoloItem quando disponivel", async () => {
    const loadPendingAgendaItems = vi.fn(async () => [
      agendaItem({
        id: "agenda-1",
        protocol_item_version_id: "item-1",
      }),
    ]);

    const ops = await resolveManualSanitaryAgendaCompletionOpsEffect({
      fazendaId: "farm-1",
      linkedEventId: "evt-1",
      animalId: "animal-1",
      sanitarioTipo: "vacinacao",
      sanitaryProductName: "",
      protocoloItem: { id: "item-1" },
      loadPendingAgendaItems,
      loadProtocolItems: vi.fn(async () => []),
    });

    expect(ops).toHaveLength(1);
    expect(ops[0].record.id).toBe("agenda-1");
  });
});
