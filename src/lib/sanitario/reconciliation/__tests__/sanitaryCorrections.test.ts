import { describe, expect, it } from "vitest";

import {
  buildSanitaryCorrectionGesture,
  buildSanitaryInventoryReconciliationGesture,
  buildSanitaryOccurrenceResolutionGesture,
  readSanitaryCorrectionPayload,
} from "@/lib/sanitario/reconciliation/sanitaryCorrections";

const baseCorrection = {
  fazendaId: "farm-1",
  eventoOrigemId: "evt-original",
  dominioOrigem: "sanitario",
  occurredAt: "2026-06-01T12:00:00.000Z",
  motivo: "Fonte tecnica conferida.",
  animalId: "animal-1",
  loteId: "lote-1",
  createdBy: "user-1",
} as const;

const lotRef = {
  id: "stock-1",
  saldo_atual_base: 100,
  unidade_base: "ml",
  status: "ativo",
  deleted_at: null,
  custo_unitario: 2,
  custo_total: 200,
  quantidade_inicial_base: 100,
} as const;

describe("sanitary correction gestures", () => {
  it("complemento de rastreabilidade cria novo evento vinculado", () => {
    const result = buildSanitaryCorrectionGesture({
      ...baseCorrection,
      tipoCorrecao: "complemento_rastreabilidade",
      payloadCorrecao: {
        dose_quantidade: 5,
        dose_unidade: "ml",
        via_aplicacao: "SC",
      },
    });

    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({
      table: "eventos",
      action: "INSERT",
      record: {
        corrige_evento_id: "evt-original",
        payload: {
          sanitary_correction: {
            evento_origem_id: "evt-original",
            tipo_correcao: "complemento_rastreabilidade",
            motivo: "Fonte tecnica conferida.",
            created_by: "user-1",
          },
        },
      },
    });
    expect(readSanitaryCorrectionPayload(result.ops[0].record.payload)).toMatchObject({
      tipo_correcao: "complemento_rastreabilidade",
      evento_origem_id: "evt-original",
    });
  });

  it("correcao de custo cria novo evento vinculado sem detalhe sanitario destrutivo", () => {
    const result = buildSanitaryCorrectionGesture({
      ...baseCorrection,
      tipoCorrecao: "correcao_custo",
      payloadCorrecao: {
        custo_unitario_snapshot: 3,
        custo_total_snapshot: 15,
      },
    });

    expect(result.ops.map((op) => `${op.action}:${op.table}`)).toEqual([
      "INSERT:eventos",
    ]);
    expect(result.ops[0].record.payload.sanitary_correction).toMatchObject({
      tipo_correcao: "correcao_custo",
      payload_correcao: {
        custo_total_snapshot: 15,
      },
    });
  });

  it("estorno de estoque nao apaga baixa original e cria ajuste positivo vinculado", () => {
    const result = buildSanitaryInventoryReconciliationGesture({
      ...baseCorrection,
      tipoCorrecao: "estorno_baixa_estoque",
      insumoId: "insumo-1",
      insumoLoteId: "stock-1",
      quantidadeBase: 10,
      unidadeBase: "ml",
      lotRef,
      originalMovement: {
        id: "mov-original",
        tipo: "consumo_sanitario",
        quantidade_base: 10,
        insumo_lote_id: "stock-1",
        custo_total_snapshot: 20,
      },
    });

    expect(result.ops.map((op) => `${op.action}:${op.table}`)).toEqual([
      "INSERT:eventos",
      "INSERT:insumo_movimentacoes",
    ]);
    expect(result.ops[1].record).toMatchObject({
      tipo: "ajuste_positivo",
      source_evento_id: result.eventId,
      payload: {
        origem_movimentacao: "reconciliacao_sanitaria",
        evento_origem_id: "evt-original",
        movimento_original_id: "mov-original",
      },
    });
  });

  it("contra-lancamento preserva idempotencia por evento corretivo e bloqueia saldo negativo", () => {
    const result = buildSanitaryInventoryReconciliationGesture({
      ...baseCorrection,
      tipoCorrecao: "contra_lancamento_estoque",
      insumoId: "insumo-1",
      insumoLoteId: "stock-1",
      quantidadeBase: 10,
      unidadeBase: "ml",
      lotRef,
      movementTipo: "ajuste_negativo",
    });

    expect(result.ops[1].record.id).toBe(`${result.eventId}:estoque`);
    expect(result.ops[1].record.source_evento_id).toBe(result.eventId);

    expect(() =>
      buildSanitaryInventoryReconciliationGesture({
        ...baseCorrection,
        tipoCorrecao: "contra_lancamento_estoque",
        insumoId: "insumo-1",
        insumoLoteId: "stock-1",
        quantidadeBase: 200,
        unidadeBase: "ml",
        lotRef,
        movementTipo: "ajuste_negativo",
      }),
    ).toThrow("Ajuste negativo deixaria saldo do lote abaixo de zero.");
  });

  it("resolucao de ocorrencia cria evento vinculado e encerra somente pendencia especifica", () => {
    const result = buildSanitaryOccurrenceResolutionGesture({
      ...baseCorrection,
      dominioOrigem: "conformidade",
      action: "resolver",
      agendaItemIds: ["agenda-especifica"],
      acaoRealizada: "Area higienizada.",
    });

    expect(result.ops.map((op) => `${op.action}:${op.table}`)).toEqual([
      "INSERT:eventos",
      "UPDATE:agenda_itens",
    ]);
    expect(result.ops[0].record.payload.sanitary_correction).toMatchObject({
      tipo_correcao: "resolucao_ocorrencia_biosseguranca",
      evento_origem_id: "evt-original",
    });
    expect(result.ops[1].record).toMatchObject({
      id: "agenda-especifica",
      status: "concluido",
      payload: {
        encerramento_corretivo: {
          evento_origem_id: "evt-original",
          evento_resolucao_id: result.eventId,
        },
      },
    });
  });

  it("cancelamento de ocorrencia cria evento vinculado e cancela pendencia especifica", () => {
    const result = buildSanitaryOccurrenceResolutionGesture({
      ...baseCorrection,
      dominioOrigem: "conformidade",
      action: "cancelar",
      agendaItemIds: ["agenda-especifica"],
    });

    expect(result.ops[0].record.payload.sanitary_correction).toMatchObject({
      tipo_correcao: "cancelamento_ocorrencia_biosseguranca",
    });
    expect(result.ops[1].record.status).toBe("cancelado");
  });

  it("agenda geral nao e concluida quando nao foi passada como especifica", () => {
    const result = buildSanitaryOccurrenceResolutionGesture({
      ...baseCorrection,
      dominioOrigem: "conformidade",
      action: "resolver",
      agendaItemIds: [],
    });

    expect(result.ops).toHaveLength(1);
    expect(result.ops.some((op) => op.table === "agenda_itens")).toBe(false);
  });
});
