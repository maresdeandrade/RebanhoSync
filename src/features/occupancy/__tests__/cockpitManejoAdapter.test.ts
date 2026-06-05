// src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import { calculateLoteMetrics, calculatePastoMetrics } from "../cockpitManejoAdapter";
import type { Animal, Evento, EventoPesagem, EventoEcc, EventoMovimentacao, PastoOcupacao, Pasto, Lote } from "../../../lib/offline/types";

describe("cockpitManejoAdapter unit tests", () => {
  // Test Lote cockpit metrics calculations
  describe("calculateLoteMetrics", () => {
    const refDate = "2026-05-28";

    it("calculates correct GMD with 2 weights and days interval", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBe(1); // 10kg gain / 10 days = 1.0 kg/day
      expect(metrics.ganhoMedio).toBe(10); // 10kg gain
      expect(metrics.gmdStatus.status).toBe("complete");
      expect(metrics.gmdStatus.reason).toContain("animais atuais do lote");
      expect(metrics.gmdStatus.limitation).toContain("não comprova desempenho histórico completo do lote");
      expect(metrics.gmdStatus.limitation).toContain("permanência no período");
    });

    it("blocks GMD with less than 2 weights", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
      expect(metrics.gmdStatus.limitation).toContain("pesagens");
      expect(metrics.gmdStatus.limitation).toContain("não comprova desempenho histórico completo do lote");
    });

    it("blocks GMD with 0 days interval", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
    });

    it("ignores soft-deleted weights and excluded dead or sold animals", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "morto", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
        { id: "ani-2", status: "ativo", lote_id: "lote-1", rfid: null, identificacao: "A2", sexo: "F", fazenda_id: "faz-1", payload: {}, deleted_at: "2026-05-28" } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.quantidadeAtual).toBe(0);
      expect(metrics.gmdMedio).toBeNull();
    });

    it("calculates lotation UA correctly with fresh and stale weights", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
        { id: "ani-2", status: "ativo", lote_id: "lote-1", identificacao: "A2", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-2", occurred_at: "2026-04-10", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any,
        { evento_id: "evt-2", peso_kg: 450 } as any
      ];

      // freshness is 30 days. ani-2's weight is expired (April 10 vs May 28).
      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.uaTotal).toBe(2); // (450 + 450) / 450 = 2 UA
      expect(metrics.lotacaoStatus.status).toBe("partial"); // contains outdated weights
      expect(metrics.lotacaoStatus.limitation).toContain("desatualizados");
    });

    it("uses state_pasto_ocupacoes for permanence and prioritises it over movements", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      // Movimentacao factual indicating entry on 2026-05-20
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-20", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_lote_id: "lote-1" } as any
      ];

      // Materialised pasto_ocupacoes indicating entry on 2026-05-25 (3 days before refDate)
      const pastoOcupacoes: PastoOcupacao[] = [
        { id: "ocup-1", lote_id: "lote-1", pasto_id: "pasto-1", entrada_em: "2026-05-25", saida_em: null } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, [], [], movimentacoes, [], pastoOcupacoes);
      expect(metrics.tempoMedioPermanencia).toBe(3); // 2026-05-25 to 2026-05-28
      expect(metrics.permanenciaStatus.source).toBe("state_pasto_ocupacoes (read model)");
      expect(metrics.permanenciaStatus.status).toBe("partial");
      expect(metrics.permanenciaStatus.limitation).toContain("não é fonte histórica primária completa");
    });

    it("falls back to events_movimentacao for permanence when pasto_ocupacoes is empty", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", rfid: null, identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-20", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_lote_id: "lote-1" } as any
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, [], [], movimentacoes, []);
      expect(metrics.tempoMedioPermanencia).toBe(8); // 2026-05-20 to 2026-05-28 = 8 days
      expect(metrics.permanenciaStatus.source).toBe("eventos_movimentacao");
      expect(metrics.permanenciaStatus.reason).toContain("movimentações de entrada");
      expect(metrics.permanenciaStatus.limitation).toContain("não substitui auditoria histórica completa");
    });
  });

  // Test Pasto cockpit metrics calculations
  describe("calculatePastoMetrics", () => {
    const refDate = "2026-05-28";
    const pastos: Pasto[] = [
      { id: "pasto-1", nome: "Pasto Verde", area_ha: 10 } as any
    ];
    const lotes: Lote[] = [
      { id: "lote-1", pasto_id: "pasto-1" } as any
    ];

    it("calculates stocking rate UA/ha correctly when area is valid", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], []);
      expect(metrics.uaTotal).toBe(1); // 450 / 450 = 1 UA
      expect(metrics.taxaLotacaoUaHa).toBe(0.1); // 1 UA / 10 ha = 0.1 UA/ha
      expect(metrics.taxaLotacaoStatus.status).toBe("complete");
      expect(metrics.taxaLotacaoStatus.limitation).toContain("area_ha válida");
      expect(metrics.taxaLotacaoStatus.limitation).toContain("peso explícito");
    });

    it("blocks stocking rate UA/ha when area is <= 0 or missing", () => {
      const pastosNoArea: Pasto[] = [
        { id: "pasto-1", nome: "Pasto Verde", area_ha: 0 } as any
      ];
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastosNoArea, events, pesagens, [], [], []);
      expect(metrics.taxaLotacaoUaHa).toBeNull();
      expect(metrics.taxaLotacaoStatus.status).toBe("bloqueado");
      expect(metrics.taxaLotacaoStatus.limitation).toContain("area_ha válida");
    });

    it("treats state_pasto_ocupacoes as current occupancy read model, not complete history", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any
      ];
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-01", deleted_at: null } as any
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_pasto_id: "pasto-1", to_lote_id: "lote-1" } as any
      ];
      const pastoOcupacoes: PastoOcupacao[] = [
        { id: "ocup-1", lote_id: "lote-1", pasto_id: "pasto-1", entrada_em: "2026-05-20", saida_em: null } as any
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, [], [], movimentacoes, [], pastoOcupacoes);
      expect(metrics.tempoUsoDias).toBe(8);
      expect(metrics.permanenciaStatus.status).toBe("partial");
      expect(metrics.permanenciaStatus.source).toBe("state_pasto_ocupacoes (read model)");
      expect(metrics.permanenciaStatus.limitation).toContain("não é fonte histórica primária completa");
    });
  });

  // Testes adicionais Fase 5.1
  describe("Testes adicionais Fase 5.1 — invariantes KPI", () => {
    const refDate = "2026-05-28";

    it("GMD usa occurred_at do evento, não outra data", () => {
      // occurred_at = "2026-05-18" e "2026-05-28" => 10 dias de intervalo
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      // ganho 10 kg / 10 dias = 1.0 kg/dia
      expect(metrics.gmdMedio).toBe(1.0);
      expect(metrics.gmdStatus.status).toBe("complete");
    });

    it("pesagem com soft delete é ignorada no cálculo de GMD", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-18", deleted_at: null } as any,
        // Este evento está deletado — não deve ser contado
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: "2026-05-28" } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      // Apenas 1 pesagem válida (evt-2 deletado), GMD deve ser bloqueado
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
    });

    it("animal morto é excluído do cálculo de GMD", () => {
      const animals: Animal[] = [
        { id: "ani-morto", status: "morto", lote_id: "lote-1", identificacao: "M1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-morto", occurred_at: "2026-05-18", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-morto", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      // Animal morto não está ativo, quantidadeAtual = 0 e gmdMedio = null
      expect(metrics.quantidadeAtual).toBe(0);
      expect(metrics.gmdMedio).toBeNull();
    });

it("animal vendido é excluído do cálculo de GMD", () => {
       const animals: Animal[] = [
         { id: "ani-vendido", status: "vendido", lote_id: "lote-1", identificacao: "V1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
       ];
       const events: Evento[] = [
         { id: "evt-1", dominio: "pesagem", animal_id: "ani-vendido", occurred_at: "2026-05-18", deleted_at: null } as any,
         { id: "evt-2", dominio: "pesagem", animal_id: "ani-vendido", occurred_at: "2026-05-28", deleted_at: null } as any,
       ];
       const pesagens: EventoPesagem[] = [
         { evento_id: "evt-1", peso_kg: 200 } as any,
         { evento_id: "evt-2", peso_kg: 210 } as any,
       ];

       const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
       expect(metrics.quantidadeAtual).toBe(0);
       expect(metrics.gmdMedio).toBeNull();
     });

     it("animal retirado é excluído do cálculo de GMD", () => {
       const animals: Animal[] = [
         { id: "ani-retirado", status: "retirado", lote_id: "lote-1", identificacao: "R1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
       ];
       const events: Evento[] = [
         { id: "evt-1", dominio: "pesagem", animal_id: "ani-retirado", occurred_at: "2026-05-18", deleted_at: null } as any,
         { id: "evt-2", dominio: "pesagem", animal_id: "ani-retirado", occurred_at: "2026-05-28", deleted_at: null } as any,
       ];
       const pesagens: EventoPesagem[] = [
         { evento_id: "evt-1", peso_kg: 200 } as any,
         { evento_id: "evt-2", peso_kg: 210 } as any,
       ];

       const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
       expect(metrics.quantidadeAtual).toBe(0);
       expect(metrics.gmdMedio).toBeNull();
     });

    it("mesmo dia (intervalo 0) bloqueia GMD", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        // Mesmo dia — intervalo 0 dias
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
        { id: "evt-2", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 200 } as any,
        { evento_id: "evt-2", peso_kg: 210 } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, pesagens, [], [], []);
      expect(metrics.gmdMedio).toBeNull();
      expect(metrics.gmdStatus.status).toBe("empty");
      expect(metrics.gmdStatus.limitation).toContain("intervalo inválido");
    });

    it("UA/ha bloqueia quando área do pasto é 0", () => {
      const pastos: Pasto[] = [
        { id: "pasto-1", nome: "Pasto", area_ha: 0 } as any,
      ];
      const lotes: Lote[] = [
        { id: "lote-1", pasto_id: "pasto-1" } as any,
      ];
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any,
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], []);
      expect(metrics.taxaLotacaoUaHa).toBeNull();
      expect(metrics.taxaLotacaoStatus.status).toBe("bloqueado");
    });

    it("UA/ha bloqueia quando área do pasto é ausente (null)", () => {
      const pastos: Pasto[] = [
        { id: "pasto-1", nome: "Pasto", area_ha: null } as any,
      ];
      const lotes: Lote[] = [
        { id: "lote-1", pasto_id: "pasto-1" } as any,
      ];
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      const events: Evento[] = [
        { id: "evt-1", dominio: "pesagem", animal_id: "ani-1", occurred_at: "2026-05-28", deleted_at: null } as any,
      ];
      const pesagens: EventoPesagem[] = [
        { evento_id: "evt-1", peso_kg: 450 } as any,
      ];

      const metrics = calculatePastoMetrics("pasto-1", refDate, 30, animals, lotes, pastos, events, pesagens, [], [], []);
      expect(metrics.taxaLotacaoUaHa).toBeNull();
      expect(metrics.taxaLotacaoStatus.status).toBe("bloqueado");
    });

    it("permanência via ocupação materializada (state_pasto_ocupacoes) tem precedência sobre movimentação", () => {
      const animals: Animal[] = [
        { id: "ani-1", status: "ativo", lote_id: "lote-1", identificacao: "A1", sexo: "F", fazenda_id: "faz-1", payload: {} } as any,
      ];
      // Movimentação indica entrada em 2026-05-01 (mais antiga)
      const events: Evento[] = [
        { id: "evt-mov", dominio: "movimentacao", animal_id: "ani-1", occurred_at: "2026-05-01", deleted_at: null } as any,
      ];
      const movimentacoes: EventoMovimentacao[] = [
        { evento_id: "evt-mov", to_lote_id: "lote-1" } as any,
      ];
      // Ocupação materializada indica entrada em 2026-05-20 (mais recente, deve ter precedência)
      const pastoOcupacoes: PastoOcupacao[] = [
        { id: "ocup-1", lote_id: "lote-1", pasto_id: "pasto-1", entrada_em: "2026-05-20", saida_em: null } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, events, [], [], movimentacoes, [], pastoOcupacoes);
      // Deve usar state_pasto_ocupacoes (2026-05-20) = 8 dias, NÃO eventos_movimentacao (2026-05-01) = 27 dias
      expect(metrics.tempoMedioPermanencia).toBe(8);
      expect(metrics.permanenciaStatus.source).toBe("state_pasto_ocupacoes (read model)");
      expect(metrics.permanenciaStatus.status).toBe("partial");
      expect(metrics.permanenciaStatus.limitation).toContain("não é fonte histórica primária completa");
    });

    it("categoriaPredominante não exibe snake_case — exibe label formatado", () => {
      const animals: Animal[] = [
        {
          id: "ani-1",
          status: "ativo",
          lote_id: "lote-1",
          identificacao: "A1",
          sexo: "F",
          fazenda_id: "faz-1",
          categoria_zootecnica: "novilha_solteira",
          payload: {},
        } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, [], [], [], [], []);
      // Usa classificationSnapshot como leitura operacional canonica, nunca snake_case cru.
      expect(metrics.categoriaPredominante).toBe("Novilha");
      expect(metrics.categoriaPredominante).not.toContain("_");
      expect(metrics.categoriaStatus.source).toContain("classificationSnapshot");
      expect(metrics.categoriaStatus.status).toBe("partial");
      expect(metrics.categoriaStatus.limitation).toContain("sem data de nascimento");
    });

    it("categoriaPredominante propaga limitacao quando a classificacao e parcial", () => {
      const animals: Animal[] = [
        {
          id: "ani-1",
          status: "ativo",
          lote_id: "lote-1",
          identificacao: "A1",
          sexo: "F",
          fazenda_id: "faz-1",
          payload: {},
        } as any,
      ];

      const metrics = calculateLoteMetrics("lote-1", refDate, 30, animals, [], [], [], [], []);
      expect(metrics.categoriaPredominante).toBe("Categoria desconhecida");
      expect(metrics.categoriaStatus.source).toBe("classificationSnapshot");
      expect(metrics.categoriaStatus.status).toBe("empty");
      expect(metrics.categoriaStatus.limitation).toContain("sem data de nascimento");
    });

  });
});
