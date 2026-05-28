import { describe, it, expect } from "vitest";
import { calculateLoteMetrics, calculatePastoMetrics } from "../cockpitManejoAdapter";
import type {
  Animal,
  Lote,
  Pasto,
  Evento,
  EventoPesagem,
  EventoEcc,
  EventoMovimentacao,
  AgendaItem,
} from "@/lib/offline/types";

describe("cockpitManejoAdapter", () => {
  const referenceDate = "2026-05-28";

  const mockAnimals: Animal[] = [
    {
      id: "animal-1",
      fazenda_id: "fazenda-1",
      identificacao: "A001",
      sexo: "F",
      status: "ativo",
      categoria_zootecnica: "Novilha",
      lote_id: "lote-1",
      nascimento_data: "2024-01-01",
      client_id: "c1",
      client_op_id: "op1",
      client_tx_id: null,
      client_recorded_at: "2026-01-01",
      server_received_at: "2026-01-01",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      deleted_at: null,
    },
    {
      id: "animal-2",
      fazenda_id: "fazenda-1",
      identificacao: "A002",
      sexo: "M",
      status: "ativo",
      categoria_zootecnica: "Garrote",
      lote_id: "lote-1",
      nascimento_data: "2024-01-01",
      client_id: "c2",
      client_op_id: "op2",
      client_tx_id: null,
      client_recorded_at: "2026-01-01",
      server_received_at: "2026-01-01",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      deleted_at: null,
    },
    {
      id: "animal-3",
      fazenda_id: "fazenda-1",
      identificacao: "A003",
      sexo: "F",
      status: "morto", // should be ignored
      categoria_zootecnica: "Vaca",
      lote_id: "lote-1",
      nascimento_data: "2024-01-01",
      client_id: "c3",
      client_op_id: "op3",
      client_tx_id: null,
      client_recorded_at: "2026-01-01",
      server_received_at: "2026-01-01",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      deleted_at: null,
    },
  ];

  const mockLotes: Lote[] = [
    {
      id: "lote-1",
      fazenda_id: "fazenda-1",
      nome: "Lote Recria",
      status: "ativo",
      pasto_id: "pasto-1",
      client_id: "c_l1",
      client_op_id: "op_l1",
      client_tx_id: null,
      client_recorded_at: "2026-01-01",
      server_received_at: "2026-01-01",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      deleted_at: null,
    },
  ];

  const mockPastos: Pasto[] = [
    {
      id: "pasto-1",
      fazenda_id: "fazenda-1",
      nome: "Piquete 1",
      status: "ativo",
      area_ha: 10,
      capacidade_ua: 15,
      client_id: "c_p1",
      client_op_id: "op_p1",
      client_tx_id: null,
      client_recorded_at: "2026-01-01",
      server_received_at: "2026-01-01",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      deleted_at: null,
    },
  ];

  const mockEvents: Evento[] = [
    // Animal 1: pesagens
    {
      id: "ev-p1-1",
      fazenda_id: "fazenda-1",
      animal_id: "animal-1",
      dominio: "pesagem",
      occurred_at: "2026-05-18", // 10 days ago
      client_id: "ce1",
      client_op_id: "ope1",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
    {
      id: "ev-p1-2",
      fazenda_id: "fazenda-1",
      animal_id: "animal-1",
      dominio: "pesagem",
      occurred_at: "2026-05-08", // 20 days ago
      client_id: "ce2",
      client_op_id: "ope2",
      client_tx_id: null,
      client_recorded_at: "2026-05-08",
      server_received_at: "2026-05-08",
      created_at: "2026-05-08",
      updated_at: "2026-05-08",
      deleted_at: null,
    },
    // Animal 2: only 1 pesagem
    {
      id: "ev-p2-1",
      fazenda_id: "fazenda-1",
      animal_id: "animal-2",
      dominio: "pesagem",
      occurred_at: "2026-05-18",
      client_id: "ce3",
      client_op_id: "ope3",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
    // ECC
    {
      id: "ev-ecc-1",
      fazenda_id: "fazenda-1",
      animal_id: "animal-1",
      dominio: "ecc",
      occurred_at: "2026-05-18",
      client_id: "ce4",
      client_op_id: "ope4",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
    // Movimentacoes
    {
      id: "ev-mov-1",
      fazenda_id: "fazenda-1",
      animal_id: "animal-1",
      dominio: "movimentacao",
      occurred_at: "2026-05-18",
      client_id: "ce5",
      client_op_id: "ope5",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
    {
      id: "ev-mov-2",
      fazenda_id: "fazenda-1",
      animal_id: "animal-2",
      dominio: "movimentacao",
      occurred_at: "2026-05-23",
      client_id: "ce6",
      client_op_id: "ope6",
      client_tx_id: null,
      client_recorded_at: "2026-05-23",
      server_received_at: "2026-05-23",
      created_at: "2026-05-23",
      updated_at: "2026-05-23",
      deleted_at: null,
    },
  ];

  const mockPesagens: EventoPesagem[] = [
    {
      evento_id: "ev-p1-1",
      fazenda_id: "fazenda-1",
      peso_kg: 210,
      client_id: "cp1",
      client_op_id: "cop1",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
    {
      evento_id: "ev-p1-2",
      fazenda_id: "fazenda-1",
      peso_kg: 200,
      client_id: "cp2",
      client_op_id: "cop2",
      client_tx_id: null,
      client_recorded_at: "2026-05-08",
      server_received_at: "2026-05-08",
      created_at: "2026-05-08",
      updated_at: "2026-05-08",
      deleted_at: null,
    },
    {
      evento_id: "ev-p2-1",
      fazenda_id: "fazenda-1",
      peso_kg: 350,
      client_id: "cp3",
      client_op_id: "cop3",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
  ];

  const mockEccs: EventoEcc[] = [
    {
      event_id: "ev-ecc-1",
      fazenda_id: "fazenda-1",
      ecc: 3.5,
      client_id: "cecc1",
      client_op_id: "coecc1",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
  ];

  const mockMovimentacoes: EventoMovimentacao[] = [
    {
      evento_id: "ev-mov-1",
      fazenda_id: "fazenda-1",
      to_lote_id: "lote-1",
      to_pasto_id: "pasto-1",
      from_lote_id: null,
      from_pasto_id: null,
      client_id: "cm1",
      client_op_id: "com1",
      client_tx_id: null,
      client_recorded_at: "2026-05-18",
      server_received_at: "2026-05-18",
      created_at: "2026-05-18",
      updated_at: "2026-05-18",
      deleted_at: null,
    },
    {
      evento_id: "ev-mov-2",
      fazenda_id: "fazenda-1",
      to_lote_id: "lote-1",
      to_pasto_id: "pasto-1",
      from_lote_id: null,
      from_pasto_id: null,
      client_id: "cm2",
      client_op_id: "com2",
      client_tx_id: null,
      client_recorded_at: "2026-05-23",
      server_received_at: "2026-05-23",
      created_at: "2026-05-23",
      updated_at: "2026-05-23",
      deleted_at: null,
    },
  ];

  const mockAgendaItens: AgendaItem[] = [
    {
      id: "agenda-1",
      fazenda_id: "fazenda-1",
      lote_id: "lote-1",
      animal_id: null,
      dominio: "sanitario",
      due_date: "2026-05-27", // Atrasada
      status: "agendado",
      gera_agenda: true,
      tipo_evento: "vacinacao",
      source_kind: "manual",
      client_id: "ca1",
      client_op_id: "coa1",
      client_tx_id: null,
      client_recorded_at: "2026-05-27",
      server_received_at: "2026-05-27",
      created_at: "2026-05-27",
      updated_at: "2026-05-27",
      deleted_at: null,
    },
    {
      id: "agenda-2",
      fazenda_id: "fazenda-1",
      lote_id: null,
      animal_id: "animal-1", // Active animal in lote-1
      dominio: "pesagem",
      due_date: "2026-05-28", // Hoje
      status: "agendado",
      gera_agenda: true,
      tipo_evento: "pesagem",
      source_kind: "manual",
      client_id: "ca2",
      client_op_id: "coa2",
      client_tx_id: null,
      client_recorded_at: "2026-05-28",
      server_received_at: "2026-05-28",
      created_at: "2026-05-28",
      updated_at: "2026-05-28",
      deleted_at: null,
    },
    {
      id: "agenda-3",
      fazenda_id: "fazenda-1",
      lote_id: "lote-1",
      animal_id: null,
      dominio: "ecc",
      due_date: "2026-05-29", // Proxima
      status: "agendado",
      gera_agenda: true,
      tipo_evento: "ecc",
      source_kind: "manual",
      client_id: "ca3",
      client_op_id: "coa3",
      client_tx_id: null,
      client_recorded_at: "2026-05-29",
      server_received_at: "2026-05-29",
      created_at: "2026-05-29",
      updated_at: "2026-05-29",
      deleted_at: null,
    },
    {
      id: "agenda-4",
      fazenda_id: "fazenda-1",
      lote_id: "lote-1",
      animal_id: null,
      dominio: "ecc",
      due_date: "2026-05-20",
      status: "concluido", // should be ignored
      gera_agenda: true,
      tipo_evento: "ecc",
      source_kind: "manual",
      client_id: "ca4",
      client_op_id: "coa4",
      client_tx_id: null,
      client_recorded_at: "2026-05-20",
      server_received_at: "2026-05-20",
      created_at: "2026-05-20",
      updated_at: "2026-05-20",
      deleted_at: null,
    },
  ];

  it("calculates Lote metrics correctly with weightFreshnessDays", () => {
    // freshness is 15 days, both animal-1 (10 days ago) and animal-2 (10 days ago) are fresh
    const metrics = calculateLoteMetrics(
      "lote-1",
      referenceDate,
      15,
      mockAnimals,
      mockEvents,
      mockPesagens,
      mockEccs,
      mockMovimentacoes,
      mockAgendaItens
    );

    expect(metrics.quantidadeAtual).toBe(2); // animal-1 and animal-2, animal-3 is ignored (dead)
    expect(metrics.pesoMedio).toBe((210 + 350) / 2); // 280
    expect(metrics.pesoStatus.status).toBe("complete");

    // GMD: animal-1 has 2 pesagens (210 and 200, interval 10 days -> GMD = 1.0 kg/day)
    // animal-2 has only 1 pesagem -> GMD cannot be calculated (dados insuficientes)
    // Average GMD = 1.0
    expect(metrics.gmdMedio).toBe(1.0);
    expect(metrics.gmdStatus.status).toBe("partial"); // only 1 of 2 animals has GMD
    expect(metrics.gmdStatus.limitation).toContain("dados insuficientes");

    // ECC: animal-1 has 3.5, animal-2 has none. Cobertura = 1/2.
    expect(metrics.eccMedio).toBe(3.5);
    expect(metrics.eccStatus.status).toBe("partial");
    expect(metrics.eccCobertura.avaliados).toBe(1);
    expect(metrics.eccCobertura.total).toBe(2);
    expect(metrics.animaisSemEcc).toContain("A002");

    // Lotação:
    // animal-1 entered lote-1 on 2026-05-18 (10 days ago)
    // animal-2 entered lote-1 on 2026-05-23 (5 days ago)
    expect(metrics.tempoMedioPermanencia).toBe((10 + 5) / 2); // 7.5
    expect(metrics.tempoMaximoPermanencia).toBe(10);
    expect(metrics.tempoLotacaoStatus.status).toBe("complete");

    // Agenda: agenda-1 (atrasada), agenda-2 (hoje), agenda-3 (próxima)
    expect(metrics.agendaItensAbertos.total).toBe(3);
    expect(metrics.agendaItensAbertos.atrasados).toBe(1);
    expect(metrics.agendaItensAbertos.hoje).toBe(1);
    expect(metrics.agendaItensAbertos.proximos).toBe(1);
  });

  it("sets weight status to partial and reports Último peso registrado when weightFreshnessDays is not configured", () => {
    const metrics = calculateLoteMetrics(
      "lote-1",
      referenceDate,
      undefined, // not configured
      mockAnimals,
      mockEvents,
      mockPesagens,
      mockEccs,
      mockMovimentacoes,
      mockAgendaItens
    );

    expect(metrics.pesoMedio).toBe((210 + 350) / 2); // uses both latest weights
    expect(metrics.pesoStatus.status).toBe("partial");
    expect(metrics.pesoStatus.source).toBe("Último peso registrado");
    expect(metrics.pesoStatus.limitation).toBe("FreshnessDays não configurado");
  });

  it("restricts weight coverage if weightFreshnessDays causes expiration", () => {
    // freshness is 5 days -> both weight events (10 days ago) are expired
    const metrics = calculateLoteMetrics(
      "lote-1",
      referenceDate,
      5,
      mockAnimals,
      mockEvents,
      mockPesagens,
      mockEccs,
      mockMovimentacoes,
      mockAgendaItens
    );

    expect(metrics.pesoMedio).toBeNull();
    expect(metrics.pesoStatus.status).toBe("empty");
    expect(metrics.pesoStatus.limitation).toContain("Todos os 2 animais com peso expirado ou ausente");
  });

  it("calculates Pasto metrics correctly", () => {
    const metrics = calculatePastoMetrics(
      "pasto-1",
      referenceDate,
      15,
      mockAnimals,
      mockLotes,
      mockPastos,
      mockEvents,
      mockPesagens,
      mockEccs,
      mockMovimentacoes,
      mockAgendaItens
    );

    expect(metrics.lotacaoAtual).toBe(2);
    expect(metrics.pesoMedio).toBe((210 + 350) / 2);
    expect(metrics.tempoUsoDias).toBe((10 + 5) / 2); // average usage time for active animals currently in the pasture
    expect(metrics.agendaItensAbertos.total).toBe(3);
  });
});
