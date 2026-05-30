import { describe, expect, it } from "vitest";
import { buildConsumoMovimentacaoOp } from "../consumoGesture";

describe("consumoGesture", () => {
  it("constroi operacao de consumo sanitario no formato correto", () => {
    const op = buildConsumoMovimentacaoOp({
      eventId: "evt-123",
      dominio: "sanitario",
      insumoId: "insumo-abc",
      insumoLoteId: "lote-xyz",
      quantidadeBase: 15,
      unidadeBase: "ml",
      occurredAt: "2026-05-28T20:00:00Z",
      lotRef: {
        custo_unitario: 0.50,
        custo_total: null,
        quantidade_inicial_base: 100,
      },
      animalId: "animal-123",
      observacoes: "Vacina de aftosa",
    });

    expect(op.table).toBe("insumo_movimentacoes");
    expect(op.action).toBe("INSERT");
    expect(op.record).toMatchObject({
      insumo_id: "insumo-abc",
      insumo_lote_id: "lote-xyz",
      tipo: "consumo_sanitario",
      quantidade_base: 15,
      unidade_base: "ml",
      source_evento_id: "evt-123",
      source_evento_dominio: "sanitario",
      animal_id: "animal-123",
      observacoes: "Vacina de aftosa",
      custo_unitario_snapshot: 0.50,
      custo_total_snapshot: 7.50, // 0.5 * 15
      payload: {
        origem_movimentacao: "baixa_automatica_evento",
        custo_status: "informado",
      },
    });
    expect(op.record.id).toBeDefined();
  });

  it("constroi operacao de consumo nutricional no formato correto", () => {
    const op = buildConsumoMovimentacaoOp({
      eventId: "evt-456",
      dominio: "nutricao",
      insumoId: "insumo-alimento",
      insumoLoteId: "lote-alimento",
      quantidadeBase: 50,
      unidadeBase: "kg",
      occurredAt: "2026-05-28T21:00:00Z",
      lotRef: {
        custo_unitario: 2.25,
        custo_total: null,
        quantidade_inicial_base: 100,
      },
      loteId: "lote-boi",
    });

    expect(op.table).toBe("insumo_movimentacoes");
    expect(op.action).toBe("INSERT");
    expect(op.record).toMatchObject({
      insumo_id: "insumo-alimento",
      insumo_lote_id: "lote-alimento",
      tipo: "consumo_nutricao",
      quantidade_base: 50,
      unidade_base: "kg",
      source_evento_id: "evt-456",
      source_evento_dominio: "nutricao",
      rebanho_lote_id: "lote-boi",
      custo_unitario_snapshot: 2.25,
      custo_total_snapshot: 112.50, // 2.25 * 50
      payload: {
        origem_movimentacao: "baixa_automatica_evento",
        custo_status: "informado",
      },
    });
  });

  it("gera snapshot de custo ausente se lote nao possui custo", () => {
    const op = buildConsumoMovimentacaoOp({
      eventId: "evt-789",
      dominio: "nutricao",
      insumoId: "insumo-alimento",
      insumoLoteId: "lote-alimento",
      quantidadeBase: 10,
      unidadeBase: "kg",
      occurredAt: "2026-05-28T21:00:00Z",
      lotRef: {
        custo_unitario: null,
        custo_total: null,
        quantidade_inicial_base: 100,
      },
    });

    expect(op.record.custo_unitario_snapshot).toBeNull();
    expect(op.record.custo_total_snapshot).toBeNull();
    expect(op.record.payload).toMatchObject({
      custo_status: "ausente",
      limitacoes: ["Sem custo unitario cadastrado no lote"],
    });
  });

  it("valida obrigatoriedade de eventId, insumoId e loteId", () => {
    expect(() =>
      buildConsumoMovimentacaoOp({
        eventId: "",
        dominio: "sanitario",
        insumoId: "ins-1",
        insumoLoteId: "lote-1",
        quantidadeBase: 10,
        unidadeBase: "ml",
        occurredAt: "",
      })
    ).toThrow();

    expect(() =>
      buildConsumoMovimentacaoOp({
        eventId: "evt-1",
        dominio: "sanitario",
        insumoId: "",
        insumoLoteId: "lote-1",
        quantidadeBase: 10,
        unidadeBase: "ml",
        occurredAt: "",
      })
    ).toThrow();
  });
});
