import type { PastoOcupacao, OperationInput, Lote } from "@/lib/offline/types";

export interface BuildOcupacaoOpsInput {
  ocupacaoAbertaAtual: PastoOcupacao | null;
  lote: Lote;
  toPastoId: string | null;
  eventId: string;
  occurredAt: string;
  animaisCount: number;
}

/**
 * Cria as operações atômicas necessárias para atualizar o estado de ocupação de pasto
 * derivado de uma movimentação de lote.
 * 
 * Regras:
 * - Se o destino for nulo, apenas fecha a ocupação atual.
 * - Se for para um novo pasto, fecha a ocupação atual (se houver) e abre uma nova.
 * - Se o destino for igual ao atual (ocupacaoAbertaAtual.pasto_id === toPastoId), não faz nada.
 */
export const buildPastoOcupacaoOps = (
  input: BuildOcupacaoOpsInput,
): OperationInput[] => {
  const {
    ocupacaoAbertaAtual,
    lote,
    toPastoId,
    eventId,
    occurredAt,
    animaisCount,
  } = input;

  const ops: OperationInput[] = [];

  // Proteção: não gera ops se a intenção for mover para o mesmo pasto
  if (ocupacaoAbertaAtual && ocupacaoAbertaAtual.pasto_id === toPastoId) {
    return ops;
  }

  // 1. Fechar ocupação anterior (se existir)
  if (ocupacaoAbertaAtual) {
    ops.push({
      table: "pasto_ocupacoes",
      action: "UPDATE",
      record: {
        id: ocupacaoAbertaAtual.id,
        status: "fechada",
        saida_em: occurredAt,
        saida_evento_id: eventId,
        animais_fim: animaisCount,
        updated_at: occurredAt,
      },
    });
  }

  // 2. Abrir nova ocupação (somente se houver pasto destino)
  if (toPastoId !== null) {
    ops.push({
      table: "pasto_ocupacoes",
      action: "INSERT",
      record: {
        id: crypto.randomUUID(),
        fazenda_id: lote.fazenda_id,
        pasto_id: toPastoId,
        lote_id: lote.id,
        entrada_em: occurredAt,
        saida_em: null,
        entrada_evento_id: eventId,
        saida_evento_id: null,
        animais_inicio: animaisCount,
        animais_fim: null,
        ua_inicio: null,
        ua_fim: null,
        status: "aberta",
        payload: {},
      },
    });
  }

  return ops;
};
