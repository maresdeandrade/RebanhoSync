import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
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
  it.each(["cura_umbigo", "revisao_neonatal"])("does not independently execute a legacy %s from the chart", (tipo) => {
    expect(() => buildCalfJourneyCompletionOps({ fazendaId: "farm-1", calf: createCalf(), mother: null,
      agendaItem: createAgendaItem({ dominio: "sanitario", tipo, payload: { milestone_key: tipo } }),
    })).toThrow("Central Sanitária");
  });
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

    expect(result.createdCount).toBe(7);
    expect(result.ops.every((op) => op.table === "agenda_itens")).toBe(true);
    const umbigoOps = result.sanitarioAgendaV2.filter(
      (draft) => draft.agenda.acao_sanitaria === "cura_umbigo",
    );
    expect(umbigoOps).toHaveLength(3);
    expect(umbigoOps.map((draft) => draft.agenda.data_programada)).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
    ]);
    expect(umbigoOps[0]?.agenda.metadata).toMatchObject({
      schedule_kind: "once_daily_three_days",
      total_days: 3,
    });
    expect(umbigoOps.map(({ agenda }) => agenda.dedup_key)).toEqual([
      "calf_journey:cria-1:cura_umbigo:d0:diario",
      "calf_journey:cria-1:cura_umbigo:d1:diario",
      "calf_journey:cria-1:cura_umbigo:d2:diario",
    ]);
    expect(new Set(umbigoOps.map(({ agenda }) => agenda.id)).size).toBe(3);
    expect(umbigoOps.map(({ agenda }) => agenda.metadata.sequence_order)).toEqual([1, 2, 3]);
    expect(result.ops[2]?.record.tipo).toBe("desmame");
    expect(result.ops[2]?.record.data_prevista).toBe("2026-10-28");
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

  it("allows deterministic agenda ids", () => {
    const createAgendaId = (dedupKey: string) => `agenda:${dedupKey}`;
    const firstPlan = buildCalfJourneyAgendaOps({
      fazendaId: "farm-1",
      calf: createCalf(),
      mother: { id: "matriz-1", identificacao: "MAT-001" },
      createAgendaId,
    });
    const secondPlan = buildCalfJourneyAgendaOps({
      fazendaId: "farm-1",
      calf: createCalf(),
      mother: { id: "matriz-1", identificacao: "MAT-001" },
      createAgendaId,
    });
    expect(firstPlan).toEqual(secondPlan);
  });
});
