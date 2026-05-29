import { describe, expect, it } from "vitest";
import {
  computeHomeIndicators,
  type HomeIndicatorsInput,
  type FactualAnimal,
  type FactualLote,
  type FactualPasto,
  type FactualAgendaItem,
  type FactualEvent,
  type FactualPesagem,
  type FactualEcc,
  type FactualMovimentacao,
} from "../operationalHomeIndicatorsAdapter";

const referenceDate = "2026-05-28";

function createMockInput(overrides: Partial<HomeIndicatorsInput> = {}): HomeIndicatorsInput {
  return {
    referenceDate,
    animals: [],
    lotes: [],
    pastos: [],
    agenda: [],
    events: [],
    pesagens: [],
    eccs: [],
    movimentacoes: [],
    ...overrides,
  };
}

describe("operationalHomeIndicatorsAdapter", () => {
  describe("computeAgenda", () => {
    it("returns empty/vazio when agenda is empty", () => {
      const input = createMockInput();
      const res = computeHomeIndicators(input);
      expect(res.agenda.status).toBe("vazio");
      expect(res.agenda.totalOpen).toBe(0);
    });

    it("counts overdue, today and upcoming items correctly", () => {
      const agenda: FactualAgendaItem[] = [
        { id: "1", dominio: "sanitario", tipo: "vacina", status: "agendado", data_prevista: "2026-05-27" },
        { id: "2", dominio: "sanitario", tipo: "vacina", status: "agendado", data_prevista: "2026-05-28" },
        { id: "3", dominio: "sanitario", tipo: "vacina", status: "agendado", data_prevista: "2026-05-29" },
        { id: "4", dominio: "sanitario", tipo: "vacina", status: "concluido", data_prevista: "2026-05-27" }, // should be ignored
      ];
      const input = createMockInput({ agenda });
      const res = computeHomeIndicators(input);
      expect(res.agenda.status).toBe("completo");
      expect(res.agenda.totalOpen).toBe(3);
      expect(res.agenda.overdue).toBe(1);
      expect(res.agenda.dueToday).toBe(1);
      expect(res.agenda.upcoming).toBe(1);
    });
  });

  describe("computeEcc", () => {
    it("correctly filters active animals and calculates ECC coverage and global average", () => {
      const animals: FactualAnimal[] = [
        { id: "a1", identificacao: "001", status: "ativo" },
        { id: "a2", identificacao: "002", status: "ativo" },
        { id: "a3", identificacao: "003", status: "vendido" }, // should be ignored
        { id: "a4", identificacao: "004", status: "ativo", deleted_at: "2026-05-28T00:00:00Z" }, // should be ignored
      ];

      const events: FactualEvent[] = [
        { id: "e1", dominio: "ecc", animal_id: "a1", occurred_at: "2026-05-25T10:00:00Z" },
        { id: "e2", dominio: "ecc", animal_id: "a1", occurred_at: "2026-05-26T10:00:00Z" }, // more recent
        { id: "e3", dominio: "ecc", animal_id: "a2", occurred_at: "2026-05-24T10:00:00Z" },
      ];

      const eccs: FactualEcc[] = [
        { event_id: "e1", ecc: 3.5 },
        { event_id: "e2", ecc: 4.0 }, // this should be the latest for a1
        { event_id: "e3", ecc: 3.0 },
      ];

      const input = createMockInput({ animals, events, eccs });
      const res = computeHomeIndicators(input);

      expect(res.ecc.status).toBe("completo");
      expect(res.ecc.coberturaAtiva.evaluated).toBe(2);
      expect(res.ecc.coberturaAtiva.total).toBe(2);
      expect(res.ecc.coberturaAtiva.percentage).toBe(100);
      expect(res.ecc.eccMedioGlobal).toBe(3.5); // (4.0 + 3.0) / 2
      expect(res.ecc.animaisSemEccCount).toBe(0);
    });

    it("correctly lists animals without ECC and ranks lotes by lowest coverage", () => {
      const lotes: FactualLote[] = [
        { id: "l1", nome: "Lote A" },
        { id: "l2", nome: "Lote B" },
      ];
      const animals: FactualAnimal[] = [
        { id: "a1", identificacao: "001", status: "ativo", lote_id: "l1" },
        { id: "a2", identificacao: "002", status: "ativo", lote_id: "l1" },
        { id: "a3", identificacao: "003", status: "ativo", lote_id: "l2" },
      ];
      // Only a1 has ECC
      const events: FactualEvent[] = [
        { id: "e1", dominio: "ecc", animal_id: "a1", occurred_at: "2026-05-25T10:00:00Z" },
      ];
      const eccs: FactualEcc[] = [
        { event_id: "e1", ecc: 3.0 },
      ];

      const input = createMockInput({ lotes, animals, events, eccs });
      const res = computeHomeIndicators(input);

      expect(res.ecc.animaisSemEccCount).toBe(2);
      expect(res.ecc.animaisSemEccList).toContainEqual({ id: "a2", identificacao: "002" });
      expect(res.ecc.animaisSemEccList).toContainEqual({ id: "a3", identificacao: "003" });

      // Lote B has 0% coverage, Lote A has 50%
      expect(res.ecc.lotesSemEcc).toContainEqual({ loteId: "l2", nome: "Lote B" });
      expect(res.ecc.lotesComMenorCobertura[0].loteId).toBe("l2");
      expect(res.ecc.lotesComMenorCobertura[1].loteId).toBe("l1");
    });
  });

  describe("computeGmd", () => {
    it("correctly computes weight gain only for animals with >= 2 weights", () => {
      const lotes: FactualLote[] = [{ id: "l1", nome: "Lote A" }];
      const animals: FactualAnimal[] = [
        { id: "a1", identificacao: "001", status: "ativo", lote_id: "l1" },
        { id: "a2", identificacao: "002", status: "ativo", lote_id: "l1" },
      ];
      const events: FactualEvent[] = [
        { id: "e1", dominio: "pesagem", animal_id: "a1", occurred_at: "2026-05-01T10:00:00Z" },
        { id: "e2", dominio: "pesagem", animal_id: "a1", occurred_at: "2026-05-15T10:00:00Z" },
        { id: "e3", dominio: "pesagem", animal_id: "a2", occurred_at: "2026-05-01T10:00:00Z" }, // Only 1 weight for a2
      ];
      const pesagens: FactualPesagem[] = [
        { evento_id: "e1", peso_kg: 200 },
        { evento_id: "e2", peso_kg: 220 },
        { evento_id: "e3", peso_kg: 210 },
      ];

      const input = createMockInput({ lotes, animals, events, pesagens });
      const res = computeHomeIndicators(input);

      expect(res.gmd.status).toBe("completo");
      expect(res.gmd.animaisComApenasUmaPesagemCount).toBe(1);
      // Lote A has only 1 animal (a1) with sufficient weights. Weight gain for a1 is 20 kg
      expect(res.gmd.lotesComGmd).toContainEqual({ loteId: "l1", nome: "Lote A", gmdMedio: 1.43, ganhoMedio: 20, animaisCount: 1 });
    });
  });

  describe("computeLotacao", () => {
    it("calculates permanence and handles partial status when movement is missing", () => {
      const lotes: FactualLote[] = [
        { id: "l1", nome: "Lote A" },
        { id: "l2", nome: "Lote B" },
      ];
      const events: FactualEvent[] = [
        { id: "e1", dominio: "movimentacao", occurred_at: "2026-05-20T10:00:00Z" },
        { id: "e2", dominio: "movimentacao", occurred_at: "2026-05-25T10:00:00Z" },
      ];
      const movimentacoes: FactualMovimentacao[] = [
        { evento_id: "e1", from_lote_id: "l1", to_lote_id: "l2" },
        { evento_id: "e2", from_lote_id: "l2", to_lote_id: "l1" },
      ];

      const input = createMockInput({ lotes, events, movimentacoes });
      const res = computeHomeIndicators(input);

      expect(res.lotacao.status).toBe("completo");
      const l1Info = res.lotacao.lotePermanencia.find(p => p.loteId === "l1");
      expect(l1Info?.permanenciaMediaDias).toBe(5); // 20 to 25 is 5 days
      expect(l1Info?.isPartial).toBe(false);
    });
  });

  describe("computePesoConfiavel", () => {
    it("blocks/sets partial when weightFreshnessDays is not configured", () => {
      const animals: FactualAnimal[] = [
        { id: "a1", identificacao: "001", status: "ativo" },
      ];
      const events: FactualEvent[] = [
        { id: "e1", dominio: "pesagem", animal_id: "a1", occurred_at: "2026-05-27T10:00:00Z" },
      ];
      const pesagens: FactualPesagem[] = [
        { evento_id: "e1", peso_kg: 350 },
      ];

      const input = createMockInput({ animals, events, pesagens, weightFreshnessDays: undefined });
      const res = computeHomeIndicators(input);

      expect(res.pesoConfiavel.status).toBe("parcial");
      expect(res.pesoConfiavel.classification).toBe("parcial");
      expect(res.pesoConfiavel.label).toBe("Último peso registrado");
      expect(res.pesoConfiavel.coberturaAtiva.percentage).toBe(0); // freshness is missing, so 0 evaluated confiavel
    });

    it("respects weightFreshnessDays limits when configured", () => {
      const animals: FactualAnimal[] = [
        { id: "a1", identificacao: "001", status: "ativo" },
        { id: "a2", identificacao: "002", status: "ativo" },
      ];
      const events: FactualEvent[] = [
        { id: "e1", dominio: "pesagem", animal_id: "a1", occurred_at: "2026-05-27T10:00:00Z" }, // 1 day old (recent)
        { id: "e2", dominio: "pesagem", animal_id: "a2", occurred_at: "2026-05-01T10:00:00Z" }, // 27 days old (stale)
      ];
      const pesagens: FactualPesagem[] = [
        { evento_id: "e1", peso_kg: 350 },
        { evento_id: "e2", peso_kg: 400 },
      ];

      const input = createMockInput({ animals, events, pesagens, weightFreshnessDays: 10 });
      const res = computeHomeIndicators(input);

      expect(res.pesoConfiavel.status).toBe("completo");
      expect(res.pesoConfiavel.classification).toBe("confiavel");
      expect(res.pesoConfiavel.label).toBe("Peso atual confiável");
      expect(res.pesoConfiavel.animaisConfiaveisCount).toBe(1);
      expect(res.pesoConfiavel.animaisDesatualizadosCount).toBe(1);
      expect(res.pesoConfiavel.coberturaAtiva.percentage).toBe(50);
      expect(res.pesoConfiavel.pesoMedioGlobal).toBe(350);
    });
  });

  describe("computeSanitario", () => {
    it("counts sanitary-specific agenda items and sets correct status", () => {
      const agenda: FactualAgendaItem[] = [
        { id: "1", dominio: "sanitario", tipo: "vacina", status: "agendado", data_prevista: "2026-05-27" },
        { id: "2", dominio: "sanitario", tipo: "vacina", status: "agendado", data_prevista: "2026-05-28" },
        { id: "3", dominio: "pesagem", tipo: "pesagem", status: "agendado", data_prevista: "2026-05-28" }, // not sanitary
      ];
      const input = createMockInput({ agenda });
      const res = computeHomeIndicators(input);

      expect(res.sanitario.status).toBe("completo");
      expect(res.sanitario.totalOpen).toBe(2);
      expect(res.sanitario.overdue).toBe(1);
      expect(res.sanitario.dueToday).toBe(1);
    });
  });
});
