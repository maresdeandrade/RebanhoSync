import { describe, expect, it } from "vitest";
import type { AgendaItem, Animal } from "@/lib/offline/types";
import {
  buildCalfJourneyAgendaOps,
  buildCalfJourneyCompletionOps,
  getCalfJourneyStage,
} from "../calfJourney";

function createCalf(overrides: Partial<Animal> = {}): Animal {
  const now = "2026-04-01T10:00:00.000Z";
  return {
    id: "cria-1",
    fazenda_id: "farm-1",
    identificacao: "BZ-001",
    sexo: "F",
    status: "ativo",
    lote_id: "bezerreiro",
    data_nascimento: "2026-04-01",
    data_entrada: null,
    data_saida: null,
    pai_id: "touro-1",
    mae_id: "matriz-1",
    nome: null,
    rfid: null,
    origem: "nascimento",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {
      generated_from: "evento_parto",
      birth_event_id: "evento-1",
    },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: "tx-1",
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

function createAgendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  const now = "2026-04-01T10:00:00.000Z";
  return {
    id: "agenda-1",
    fazenda_id: "farm-1",
    dominio: "pesagem",
    tipo: "pesagem_d7",
    status: "agendado",
    data_prevista: "2026-04-08",
    animal_id: "cria-1",
    lote_id: "bezerreiro",
    dedup_key: "calf_journey:cria-1:pesagem_d7",
    source_kind: "automatico",
    source_ref: {
      journey: "cria",
      milestone_key: "pesagem_d7",
      milestone_label: "Pesagem D7",
    },
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: "evento-1",
    source_task_id: null,
    protocol_item_version_id: null,
    interval_days_applied: 7,
    payload: {
      journey: "cria",
      milestone_key: "pesagem_d7",
      milestone_label: "Pesagem D7",
    },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: "tx-1",
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

describe("calfJourney", () => {
  it("builds automatic agenda milestones up to weaning", () => {
    const result = buildCalfJourneyAgendaOps({
      fazendaId: "farm-1",
      calf: createCalf(),
      mother: {
        id: "matriz-1",
        identificacao: "MAT-001",
      },
      existingAgendaItems: [],
    });

    expect(result.createdCount).toBe(5);
    expect(result.ops.every((op) => op.table === "agenda_itens")).toBe(true);
    expect(result.ops[4]?.record.tipo).toBe("desmame");
    expect(result.ops[4]?.record.data_prevista).toBe("2026-10-28");
  });

  it("builds completion ops for follow-up weight and closes agenda item", () => {
    const result = buildCalfJourneyCompletionOps({
      fazendaId: "farm-1",
      calf: createCalf(),
      mother: {
        id: "matriz-1",
        identificacao: "MAT-001",
      },
      agendaItem: createAgendaItem(),
      pesoKg: 52.4,
    });

    expect(result.milestone.key).toBe("pesagem_d7");
    expect(result.linkedEventId).toBeTruthy();
    expect(result.ops.map((op) => op.table)).toEqual([
      "eventos",
      "eventos_pesagem",
      "agenda_itens",
    ]);
    expect(result.ops[1]?.record.peso_kg).toBe(52.4);
    expect(result.ops[2]?.record).toMatchObject({
      status: "concluido",
      source_evento_id: result.linkedEventId,
    });
  });

  it("classifies the calf as weaned after a completed weaning marker", () => {
    const stage = getCalfJourneyStage(createCalf(), [
      createAgendaItem({
        tipo: "desmame",
        status: "concluido",
        payload: {
          journey: "cria",
          milestone_key: "desmame",
        },
      }),
    ]);

    expect(stage.key).toBe("desmamado");
  });
});
