import type { EventGestureBuildResult, EventInput } from "@/lib/events/types";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type {
  AgendaStatusEnum,
  DominioEnum,
  InsumoLote,
  InsumoMovimentacao,
  InsumoMovimentacaoTipoEnum,
  InsumoUnidadeBaseEnum,
  OperationInput,
} from "@/lib/offline/types";
import { buildInventoryCostSnapshot } from "@/lib/inventory/costing";
import { evaluateInventoryLotManualMovement } from "@/lib/inventory/inventoryContracts";

export type SanitaryCorrectionType =
  | "complemento_rastreabilidade"
  | "correcao_custo"
  | "correcao_lote_estoque"
  | "estorno_baixa_estoque"
  | "contra_lancamento_estoque"
  | "resolucao_ocorrencia_biosseguranca"
  | "cancelamento_ocorrencia_biosseguranca"
  | "encerramento_pendencia_corretiva";

export type SanitaryCorrectionPayload = {
  schema_version: 1;
  evento_origem_id: string;
  corrige_evento_id: string;
  tipo_correcao: SanitaryCorrectionType;
  motivo: string;
  payload_correcao: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type SanitaryCorrectionEventInput = {
  fazendaId: string;
  eventoOrigemId: string;
  dominioOrigem?: DominioEnum | string | null;
  occurredAt: string;
  tipoCorrecao: SanitaryCorrectionType;
  motivo: string;
  payloadCorrecao?: Record<string, unknown>;
  animalId?: string | null;
  loteId?: string | null;
  createdBy?: string | null;
};

export type BuildSanitaryOccurrenceResolutionGestureInput = Omit<
  SanitaryCorrectionEventInput,
  "tipoCorrecao" | "payloadCorrecao"
> & {
  action: "resolver" | "cancelar";
  agendaItemIds?: readonly string[];
  agendaStatus?: Extract<AgendaStatusEnum, "concluido" | "cancelado">;
  resolvidaPor?: string | null;
  acaoRealizada?: string | null;
};

export type BuildSanitaryInventoryReconciliationGestureInput = Omit<
  SanitaryCorrectionEventInput,
  "payloadCorrecao" | "tipoCorrecao"
> & {
  tipoCorrecao: Extract<
    SanitaryCorrectionType,
    "estorno_baixa_estoque" | "contra_lancamento_estoque"
  >;
  insumoId: string;
  insumoLoteId: string;
  quantidadeBase: number;
  unidadeBase: InsumoUnidadeBaseEnum;
  lotRef?: Pick<
    InsumoLote,
    | "id"
    | "saldo_atual_base"
    | "unidade_base"
    | "status"
    | "deleted_at"
    | "custo_unitario"
    | "custo_total"
    | "quantidade_inicial_base"
  > | null;
  originalMovement?: Pick<
    InsumoMovimentacao,
    "id" | "tipo" | "quantidade_base" | "insumo_lote_id" | "custo_total_snapshot"
  > | null;
  movementTipo?: Extract<
    InsumoMovimentacaoTipoEnum,
    "ajuste_positivo" | "ajuste_negativo"
  >;
};

export function buildSanitaryCorrectionEventInput(
  input: SanitaryCorrectionEventInput,
): EventInput {
  const motivo = input.motivo.trim();
  if (!motivo) {
    throw new Error("Correcao sanitaria exige motivo.");
  }

  const payload = buildSanitaryCorrectionPayload(input, motivo);

  return {
    dominio: "conformidade",
    fazendaId: input.fazendaId,
    occurredAt: input.occurredAt,
    animalId: input.animalId ?? null,
    loteId: input.loteId ?? null,
    corrigeEventoId: input.eventoOrigemId,
    observacoes: motivo,
    complianceKind: "checklist",
    payload: {
      sanitary_correction: payload,
    },
  };
}

export function buildSanitaryCorrectionGesture(
  input: SanitaryCorrectionEventInput,
): EventGestureBuildResult {
  return buildEventGesture(buildSanitaryCorrectionEventInput(input));
}

export function buildSanitaryOccurrenceResolutionGesture(
  input: BuildSanitaryOccurrenceResolutionGestureInput,
): EventGestureBuildResult {
  const tipoCorrecao =
    input.action === "resolver"
      ? "resolucao_ocorrencia_biosseguranca"
      : "cancelamento_ocorrencia_biosseguranca";
  const status = input.action === "resolver" ? "resolvida" : "cancelada";
  const built = buildSanitaryCorrectionGesture({
    ...input,
    tipoCorrecao,
    payloadCorrecao: {
      status,
      resolvida_em: input.occurredAt,
      resolvida_por: input.resolvidaPor ?? input.createdBy ?? null,
      motivo_resolucao: input.motivo,
      acao_realizada: input.acaoRealizada?.trim() || null,
    },
  });

  const agendaStatus =
    input.agendaStatus ?? (input.action === "resolver" ? "concluido" : "cancelado");
  const agendaOps = (input.agendaItemIds ?? []).map<OperationInput>((agendaItemId) => ({
    table: "agenda_itens",
    action: "UPDATE",
    record: {
      id: agendaItemId,
      status: agendaStatus,
      payload: {
        encerramento_corretivo: {
          schema_version: 1,
          evento_origem_id: input.eventoOrigemId,
          evento_resolucao_id: built.eventId,
          tipo_correcao: tipoCorrecao,
          motivo: input.motivo,
          encerrado_em: input.occurredAt,
          encerrado_por: input.createdBy ?? null,
        },
      },
    },
  }));

  return {
    eventId: built.eventId,
    ops: [...built.ops, ...agendaOps],
  };
}

export function buildSanitaryInventoryReconciliationGesture(
  input: BuildSanitaryInventoryReconciliationGestureInput,
): EventGestureBuildResult {
  const movementTipo =
    input.movementTipo ??
    (input.tipoCorrecao === "estorno_baixa_estoque"
      ? "ajuste_positivo"
      : "ajuste_negativo");
  const movementCheck = evaluateInventoryLotManualMovement({
    lot: input.lotRef ?? null,
    tipo: movementTipo,
    quantidadeBase: input.quantidadeBase,
    unidadeBase: input.unidadeBase,
  });

  if (!movementCheck.canRegister) {
    throw new Error(movementCheck.reason);
  }

  const built = buildSanitaryCorrectionGesture({
    ...input,
    payloadCorrecao: {
      estoque_lote_id: input.insumoLoteId,
      insumo_id: input.insumoId,
      quantidade_base: input.quantidadeBase,
      unidade_base: input.unidadeBase,
      movimento_tipo: movementTipo,
      movimento_original_id: input.originalMovement?.id ?? null,
      saldo_projetado: movementCheck.projectedBalance,
    },
  });
  const costSnapshot = buildInventoryCostSnapshot({
    lot: input.lotRef ?? null,
    quantidadeBase: input.quantidadeBase,
  });

  return {
    eventId: built.eventId,
    ops: [
      ...built.ops,
      {
        table: "insumo_movimentacoes",
        action: "INSERT",
        record: {
          id: `${built.eventId}:estoque`,
          insumo_id: input.insumoId,
          insumo_lote_id: input.insumoLoteId,
          tipo: movementTipo,
          quantidade_base: input.quantidadeBase,
          unidade_base: input.unidadeBase,
          occurred_at: input.occurredAt,
          source_evento_id: built.eventId,
          source_evento_dominio: "sanitario",
          animal_id: input.animalId ?? null,
          rebanho_lote_id: input.loteId ?? null,
          pasto_id: null,
          observacoes: input.motivo,
          custo_unitario_snapshot: costSnapshot.custo_unitario_snapshot,
          custo_total_snapshot: costSnapshot.custo_total_snapshot,
          payload: {
            origem_movimentacao: "reconciliacao_sanitaria",
            evento_origem_id: input.eventoOrigemId,
            tipo_correcao: input.tipoCorrecao,
            movimento_original_id: input.originalMovement?.id ?? null,
            custo_status: costSnapshot.custo_status,
            ...(costSnapshot.limitacoes.length > 0
              ? { limitacoes: costSnapshot.limitacoes }
              : {}),
          },
        },
      },
    ],
  };
}

export function readSanitaryCorrectionPayload(
  payload: Record<string, unknown> | null | undefined,
): SanitaryCorrectionPayload | null {
  const correction = payload?.sanitary_correction;
  if (!correction || typeof correction !== "object" || Array.isArray(correction)) {
    return null;
  }

  const record = correction as Record<string, unknown>;
  if (record.schema_version !== 1) return null;
  if (!isSanitaryCorrectionType(record.tipo_correcao)) return null;
  if (typeof record.evento_origem_id !== "string") return null;
  if (typeof record.corrige_evento_id !== "string") return null;
  if (typeof record.motivo !== "string") return null;
  if (typeof record.created_at !== "string") return null;

  return {
    schema_version: 1,
    evento_origem_id: record.evento_origem_id,
    corrige_evento_id: record.corrige_evento_id,
    tipo_correcao: record.tipo_correcao,
    motivo: record.motivo,
    payload_correcao:
      record.payload_correcao &&
      typeof record.payload_correcao === "object" &&
      !Array.isArray(record.payload_correcao)
        ? (record.payload_correcao as Record<string, unknown>)
        : {},
    created_by: typeof record.created_by === "string" ? record.created_by : null,
    created_at: record.created_at,
  };
}

function buildSanitaryCorrectionPayload(
  input: SanitaryCorrectionEventInput,
  motivo: string,
): SanitaryCorrectionPayload {
  return {
    schema_version: 1,
    evento_origem_id: input.eventoOrigemId,
    corrige_evento_id: input.eventoOrigemId,
    tipo_correcao: input.tipoCorrecao,
    motivo,
    payload_correcao: {
      ...(input.dominioOrigem ? { dominio_origem: input.dominioOrigem } : {}),
      ...(input.payloadCorrecao ?? {}),
    },
    created_by: input.createdBy ?? null,
    created_at: input.occurredAt,
  };
}

function isSanitaryCorrectionType(value: unknown): value is SanitaryCorrectionType {
  return (
    value === "complemento_rastreabilidade" ||
    value === "correcao_custo" ||
    value === "correcao_lote_estoque" ||
    value === "estorno_baixa_estoque" ||
    value === "contra_lancamento_estoque" ||
    value === "resolucao_ocorrencia_biosseguranca" ||
    value === "cancelamento_ocorrencia_biosseguranca" ||
    value === "encerramento_pendencia_corretiva"
  );
}
