export interface Operation {
  client_op_id: string;
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  record: Record<string, unknown>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SANITARY_MOVEMENT_FINGERPRINT_FIELDS = [
  "id",
  "fazenda_id",
  "insumo_id",
  "insumo_lote_id",
  "tipo",
  "quantidade_base",
  "unidade_base",
  "occurred_at",
  "source_evento_id",
  "source_evento_dominio",
  "animal_id",
  "rebanho_lote_id",
  "pasto_id",
  "observacoes",
  "custo_unitario_snapshot",
  "custo_total_snapshot",
  "payload",
  "domain_op_id",
] as const;

function sanitaryMovementFingerprint(record: Record<string, unknown>) {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
      );
    }
    return value ?? null;
  };
  return JSON.stringify(canonicalize(Object.fromEntries(
    SANITARY_MOVEMENT_FINGERPRINT_FIELDS.map((field) => [
      field,
      record[field] ?? null,
    ]),
  )));
}

export function sameSanitarioInventoryMovement(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  return sanitaryMovementFingerprint(existing) ===
    sanitaryMovementFingerprint(incoming);
}

export function validateSanitarioInventoryMovementRecord(
  op: Operation,
  fazendaId: string,
): string | null {
  if (
    op.table !== "insumo_movimentacoes" ||
    op.action !== "INSERT" ||
    op.record?.tipo !== "consumo_sanitario"
  ) return null;
  const record = op.record;
  if (
    (record.fazenda_id != null && record.fazenda_id !== fazendaId) ||
    !UUID_PATTERN.test(op.client_op_id) ||
    !UUID_PATTERN.test(String(record.id ?? "")) ||
    !UUID_PATTERN.test(String(record.insumo_id ?? "")) ||
    !UUID_PATTERN.test(String(record.insumo_lote_id ?? "")) ||
    !UUID_PATTERN.test(String(record.source_evento_id ?? "")) ||
    !UUID_PATTERN.test(String(record.domain_op_id ?? "")) ||
    record.source_evento_dominio !== "sanitario" ||
    typeof record.quantidade_base !== "number" ||
    !Number.isFinite(record.quantidade_base) ||
    record.quantidade_base <= 0 ||
    typeof record.unidade_base !== "string" ||
    record.unidade_base.length === 0
  ) {
    return "SANITARIO_INVENTORY_MOVEMENT_INVALID";
  }
  return null;
}

export function validateSanitarioInventoryMovementSource(
  movement: Record<string, unknown>,
  event: Record<string, unknown> | null,
  detail: Record<string, unknown> | null,
): string | null {
  if (!event || event.deleted_at != null || event.dominio !== "sanitario") {
    return "SANITARIO_INVENTORY_SOURCE_EVENT_INVALID";
  }
  if (event.sanitario_sync_v2_nature !== "primary_execution") {
    return "SANITARIO_INVENTORY_SOURCE_NOT_PRIMARY_EXECUTION";
  }
  const eventPayload = isRecord(event.payload) ? event.payload : {};
  const product = isRecord(eventPayload.product) ? eventPayload.product : {};
  if (
    eventPayload.schema !== "sanitary_agenda_execution_v2" ||
    eventPayload.entry_history_source === "external_declared" ||
    eventPayload.entry_history_source === "external_documented"
  ) {
    return "SANITARIO_INVENTORY_EXTERNAL_OR_NON_EXECUTION_SOURCE";
  }
  if (!detail || detail.deleted_at != null) {
    return "SANITARIO_INVENTORY_DETAIL_REQUIRED";
  }
  if (
    typeof product.productId !== "string" ||
    product.productId.length === 0 ||
    product.productId !== detail.produto_sanitario_v2_id ||
    detail.insumo_id !== movement.insumo_id ||
    detail.estoque_lote_id !== movement.insumo_lote_id ||
    product.inventoryLotId !== movement.insumo_lote_id ||
    product.quantityConsumed !== movement.quantidade_base ||
    product.unit !== movement.unidade_base
  ) {
    return "SANITARIO_INVENTORY_CONTENT_MISMATCH";
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readReproductionPayload(value: unknown) {
  const reproductionPayload = isRecord(value) ? value : {};
  const schemaVersion = reproductionPayload.schema_version;
  const episodeEventId =
    typeof reproductionPayload.episode_evento_id === "string"
      ? reproductionPayload.episode_evento_id
      : null;
  const episodeLinkMethod =
    typeof reproductionPayload.episode_link_method === "string"
      ? reproductionPayload.episode_link_method
      : null;

  return {
    reproductionPayload,
    schemaVersion,
    episodeEventId,
    episodeLinkMethod,
  };
}

export function readLinkedReproductionType(relation: unknown): string | null {
  const linkedReproduction = Array.isArray(relation) ? relation[0] : relation;
  return isRecord(linkedReproduction) &&
      typeof linkedReproduction.tipo === "string"
    ? linkedReproduction.tipo
    : null;
}

export function buildInternalErrorResult(
  rawOp: Pick<Operation, "client_op_id">,
  cause: unknown,
) {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  return {
    op_id: rawOp.client_op_id,
    status: "REJECTED" as const,
    reason_code: "INTERNAL_ERROR" as const,
    reason_message: error.message,
  };
}

export interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

export function validateSanitarioAgendaClosurePush(op: Operation):
  | null
  | {
    status: "REJECTED";
    reason_code: "SANITARIO_AGENDA_CLOSURE_EXECUTION_BLOCKED";
    reason_message: string;
  } {
  if (op.table !== "sanitario_agenda_closures_v2") return null;

  const closureType = op.record?.closure_type;
  const executionEventoId = op.record?.execution_evento_id;

  if (
    closureType === "executed_with_event" ||
    closureType === "partially_executed_with_event" ||
    executionEventoId != null
  ) {
    return {
      status: "REJECTED",
      reason_code: "SANITARIO_AGENDA_CLOSURE_EXECUTION_BLOCKED",
      reason_message:
        "Agenda v2 closure push in 12E4 cannot confirm executed sanitary events",
    };
  }

  return null;
}

const CHECK_CONSTRAINT_REASON: Record<string, string> = {
  ck_evt_fin_valor_total_pos: "VALIDATION_FINANCEIRO_VALOR_TOTAL",
  ck_evt_nutricao_quantidade_pos_nullable: "VALIDATION_NUTRICAO_QUANTIDADE",
  ck_evt_mov_destino_required: "VALIDATION_MOVIMENTACAO_DESTINO",
  ck_evt_mov_from_to_diff: "VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO",
  ck_insumos_tipo: "VALIDATION_INSUMO_TIPO",
  ck_insumos_unidade_base: "VALIDATION_INSUMO_UNIDADE",
  ck_insumo_apresentacoes_quantidade_pos:
    "VALIDATION_INSUMO_APRESENTACAO_QUANTIDADE",
  ck_insumo_lotes_saldo_non_negative: "VALIDATION_INSUMO_SALDO_INSUFICIENTE",
  ck_insumo_movimentacoes_tipo: "VALIDATION_INSUMO_MOVIMENTACAO_TIPO",
  ck_insumo_movimentacoes_quantidade_pos:
    "VALIDATION_INSUMO_MOVIMENTACAO_QUANTIDADE",
  ck_insumo_movimentacoes_consumo_source: "VALIDATION_INSUMO_CONSUMO_SOURCE",
  ck_insumo_movimentacoes_append_only:
    "VALIDATION_INSUMO_MOVIMENTACAO_APPEND_ONLY",
  ck_eventos_comercial_quantidade_animais:
    "VALIDATION_COMERCIAL_QUANTIDADE_ANIMAIS",
  ck_eventos_comercial_valor_liquido_derivado:
    "VALIDATION_COMERCIAL_VALOR_LIQUIDO_DERIVADO",
};

const FK_CONSTRAINT_REASON: Record<string, string> = {
  fk_evt_fin_contraparte_fazenda: "VALIDATION_FINANCEIRO_CONTRAPARTE",
  fk_insumo_movimentacoes_lote_fazenda: "VALIDATION_INSUMO_LOTE",
  fk_insumo_movimentacoes_source_evento_fazenda:
    "VALIDATION_INSUMO_SOURCE_EVENTO",
  fk_finance_transactions_category_fazenda: "VALIDATION_FINANCEIRO_CATEGORIA",
  fk_finance_transactions_reverses_fazenda: "VALIDATION_FINANCEIRO_ESTORNO_ORIGEM",
};

const UNIQUE_CONSTRAINT_REASON: Record<string, string> = {
  idx_eventos_unique_source_task: "agenda_already_completed_by_event",
  ux_sanitario_agenda_closures_v2_agenda_active:
    "sanitario_agenda_closure_already_exists",
  uq_finance_categories_slug: "finance_category_slug_already_exists",
  ux_finance_transactions_unique_reversal: "finance_reversal_already_exists",
};

const TABLE_PRIMARY_KEY: Record<
  string,
  "id" | "evento_id" | "user_id" | "fazenda_id"
> = {
  eventos_sanitario: "evento_id",
  eventos_pesagem: "evento_id",
  eventos_nutricao: "evento_id",
  eventos_movimentacao: "evento_id",
  eventos_reproducao: "evento_id",
  eventos_financeiro: "evento_id",
  eventos_comercial: "evento_id",
  user_profiles: "user_id",
  user_settings: "user_id",
  fazenda_sanidade_config: "fazenda_id",
};

function extractConstraintName(error: DbErrorLike): string | null {
  const msg = error.message ?? "";
  const match = msg.match(/constraint "([^"]+)"/i);
  return match?.[1] ?? null;
}

function buildReasonMessage(error: DbErrorLike): string {
  const pieces = [error.message, error.details, error.hint].filter(Boolean);
  return pieces.join(" | ");
}

export function normalizeDbError(
  error: DbErrorLike,
  op: Operation,
):
  | { status: "APPLIED_ALTERED"; altered: { dedup: "collision_noop" } }
  | { status: "APPLIED" }
  | { status: "REJECTED"; reason_code: string; reason_message: string } {
  const dbCode = error.code ?? "UNKNOWN_DB_ERROR";

  if (dbCode === "23505") {
    const constraint = extractConstraintName(error);
    const reasonCode = constraint
      ? UNIQUE_CONSTRAINT_REASON[constraint]
      : undefined;
    if (reasonCode) {
      return {
        status: "REJECTED",
        reason_code: reasonCode,
        reason_message: buildReasonMessage(error),
      };
    }
  }

  if (dbCode === "23505" && op.table === "agenda_itens") {
    return { status: "APPLIED_ALTERED", altered: { dedup: "collision_noop" } };
  }

  if (dbCode === "23505" && op.table === "finance_categories") {
    // A validação de conteúdo e reconciliação exata foi movida para o laço principal
    // para permitir acesso assíncrono ao banco de dados, mas caso o erro chegue
    // até aqui por alguma falha na pré-validação ou concorrência extrema,
    // tratamos de forma conservadora.
    return { status: "CONFLICT", reason_code: "finance_category_slug_already_exists", reason_message: "Slug já existe. A pré-validação falhou ou houve concorrência." };
  }

  if (dbCode === "23505") {
    return { status: "APPLIED" };
  }

  if (dbCode === "23514") {
    const constraint = extractConstraintName(error);
    return {
      status: "REJECTED",
      reason_code: constraint
        ? (CHECK_CONSTRAINT_REASON[constraint] ?? "CHECK_CONSTRAINT_VIOLATION")
        : "CHECK_CONSTRAINT_VIOLATION",
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === "23503") {
    const constraint = extractConstraintName(error);
    return {
      status: "REJECTED",
      reason_code: constraint
        ? (FK_CONSTRAINT_REASON[constraint] ?? "FOREIGN_KEY_VIOLATION")
        : "FOREIGN_KEY_VIOLATION",
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === "23502") {
    return {
      status: "REJECTED",
      reason_code: "NOT_NULL_VIOLATION",
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === "22P02") {
    return {
      status: "REJECTED",
      reason_code: "INVALID_INPUT_SYNTAX",
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === "42501") {
    return {
      status: "REJECTED",
      reason_code: "PERMISSION_DENIED",
      reason_message: buildReasonMessage(error),
    };
  }

  return {
    status: "REJECTED",
    reason_code: `DB_${dbCode}`,
    reason_message: buildReasonMessage(error),
  };
}

export function resolveOperationPrimaryKey(
  op: Operation,
): { field: string; value: string } | null {
  const preferred = TABLE_PRIMARY_KEY[op.table];
  if (preferred) {
    const value = op.record?.[preferred];
    if (typeof value === "string" && value.length > 0) {
      return { field: preferred, value };
    }
  }

  const fallbackFields = ["id", "evento_id", "user_id", "fazenda_id"] as const;
  for (const field of fallbackFields) {
    const value = op.record?.[field];
    if (typeof value === "string" && value.length > 0) {
      return { field, value };
    }
  }

  return null;
}

export function buildMutationMatch(
  op: Operation,
  fazenda_id: string,
): Record<string, string> | null {
  const pk = resolveOperationPrimaryKey(op);
  if (!pk) return null;
  return { [pk.field]: pk.value, fazenda_id };
}

export function inferAgendaSourceTaskIdForEventInsert(
  op: Operation,
  ops: Operation[],
): string | null {
  if (op.table !== "eventos" || op.action !== "INSERT") return null;

  const directSourceTaskId = op.record?.source_task_id;
  if (typeof directSourceTaskId === "string" && directSourceTaskId.length > 0) {
    return directSourceTaskId;
  }

  const eventId = op.record?.id;
  if (typeof eventId !== "string" || eventId.length === 0) return null;

  const agendaUpdate = ops.find((candidate) => {
    const candidateRecord = candidate.record ?? {};
    return (
      candidate.table === "agenda_itens" &&
      candidate.action === "UPDATE" &&
      typeof candidateRecord.id === "string" &&
      typeof candidateRecord.source_evento_id === "string" &&
      candidateRecord.source_evento_id === eventId
    );
  });

  return typeof agendaUpdate?.record?.id === "string"
    ? agendaUpdate.record.id
    : null;
}

export function prevalidateAntiTeleport(ops: Operation[]):
  | { ok: true }
  | {
    ok: false;
    op_id: string;
    reason_code: "ANTI_TELEPORTE";
    reason_message: string;
  } {
  const movBaseByAnimal = new Map<string, string>();
  const finBaseByAnimal = new Map<string, string>();

  for (const op of ops) {
    if (
      op.table === "eventos" &&
      op.action === "INSERT" &&
      op.record?.id
    ) {
      if (op.record.dominio === "movimentacao") {
        if (typeof op.record.animal_id === "string") {
          movBaseByAnimal.set(
            op.record.animal_id as string,
            op.record.id as string,
          );
        }
      }
      if (op.record.dominio === "financeiro") {
        if (typeof op.record.animal_id === "string") {
          finBaseByAnimal.set(
            op.record.animal_id as string,
            op.record.id as string,
          );
        }
        const payload = isRecord(op.record.payload) ? op.record.payload : {};
        const animalIds = Array.isArray(payload.animal_ids)
          ? payload.animal_ids
          : [];
        for (const animalId of animalIds) {
          if (typeof animalId === "string" && animalId.length > 0) {
            finBaseByAnimal.set(animalId, op.record.id as string);
          }
        }
      }
    }
  }

  const movDetalhesEventoIds = new Set<string>();
  const finVendaEventoIds = new Set<string>();
  for (const op of ops) {
    if (
      op.table === "eventos_movimentacao" &&
      op.action === "INSERT" &&
      op.record?.evento_id
    ) {
      movDetalhesEventoIds.add(op.record.evento_id as string);
    }
    if (
      op.table === "eventos_financeiro" &&
      op.action === "INSERT" &&
      op.record?.evento_id &&
      op.record?.tipo === "venda"
    ) {
      finVendaEventoIds.add(op.record.evento_id as string);
    }
  }

  const canExitBySaleAnimalIds = new Set<string>();
  for (const [animalId, eventId] of finBaseByAnimal.entries()) {
    if (finVendaEventoIds.has(eventId)) {
      canExitBySaleAnimalIds.add(animalId);
    }
  }

  for (const op of ops) {
    if (op.table !== "animais" || op.action !== "UPDATE" || !op.record?.id) {
      continue;
    }

    const hasLoteMutation = Object.prototype.hasOwnProperty.call(
      op.record,
      "lote_id",
    );
    const hasPastoMutation = Object.prototype.hasOwnProperty.call(
      op.record,
      "pasto_id",
    );
    if (!hasLoteMutation && !hasPastoMutation) continue;

    const animalId = op.record.id as string;
    const eventoId = movBaseByAnimal.get(animalId);

    if (!eventoId && canExitBySaleAnimalIds.has(animalId)) {
      const status = op.record.status;
      const loteValue = op.record.lote_id;
      const pastoValue = op.record.pasto_id;
      const loteExitOk = !hasLoteMutation || loteValue === null;
      const pastoExitOk = !hasPastoMutation || pastoValue === null;

      if (status === "vendido" && loteExitOk && pastoExitOk) {
        continue;
      }
    }

    if (!eventoId) {
      return {
        ok: false,
        op_id: op.client_op_id,
        reason_code: "ANTI_TELEPORTE",
        reason_message:
          "UPDATE animais.lote_id/pasto_id sem evento base de movimentacao no mesmo tx",
      };
    }

    if (!movDetalhesEventoIds.has(eventoId)) {
      return {
        ok: false,
        op_id: op.client_op_id,
        reason_code: "ANTI_TELEPORTE",
        reason_message:
          "Evento de movimentacao sem detalhe correlato (evento_id mismatch) no mesmo tx",
      };
    }
  }

  return { ok: true };
}
