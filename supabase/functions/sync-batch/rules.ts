export interface Operation {
  client_op_id: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown>;
}

export interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const CHECK_CONSTRAINT_REASON: Record<string, string> = {
  ck_evt_fin_valor_total_pos: 'VALIDATION_FINANCEIRO_VALOR_TOTAL',
  ck_evt_nutricao_quantidade_pos_nullable: 'VALIDATION_NUTRICAO_QUANTIDADE',
  ck_evt_mov_destino_required: 'VALIDATION_MOVIMENTACAO_DESTINO',
  ck_evt_mov_from_to_diff: 'VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO',
};

const FK_CONSTRAINT_REASON: Record<string, string> = {
  fk_evt_fin_contraparte_fazenda: 'VALIDATION_FINANCEIRO_CONTRAPARTE',
};

const TABLE_PRIMARY_KEY: Record<string, 'id' | 'evento_id' | 'user_id' | 'fazenda_id'> = {
  eventos_sanitario: 'evento_id',
  eventos_pesagem: 'evento_id',
  eventos_nutricao: 'evento_id',
  eventos_movimentacao: 'evento_id',
  eventos_reproducao: 'evento_id',
  eventos_financeiro: 'evento_id',
  user_profiles: 'user_id',
  user_settings: 'user_id',
  fazenda_sanidade_config: 'fazenda_id',
};

function extractConstraintName(error: DbErrorLike): string | null {
  const msg = error.message ?? '';
  const match = msg.match(/constraint "([^"]+)"/i);
  return match?.[1] ?? null;
}

function buildReasonMessage(error: DbErrorLike): string {
  const pieces = [error.message, error.details, error.hint].filter(Boolean);
  return pieces.join(' | ');
}

export function normalizeDbError(
  error: DbErrorLike,
  op: Operation,
):
  | { status: 'APPLIED_ALTERED'; altered: { dedup: 'collision_noop' } }
  | { status: 'APPLIED' }
  | { status: 'REJECTED'; reason_code: string; reason_message: string } {
  const dbCode = error.code ?? 'UNKNOWN_DB_ERROR';

  if (dbCode === '23505' && op.table === 'agenda_itens') {
    return { status: 'APPLIED_ALTERED', altered: { dedup: 'collision_noop' } };
  }

  if (dbCode === '23505') {
    return { status: 'APPLIED' };
  }

  if (dbCode === '23514') {
    const constraint = extractConstraintName(error);
    return {
      status: 'REJECTED',
      reason_code: constraint
        ? (CHECK_CONSTRAINT_REASON[constraint] ?? 'CHECK_CONSTRAINT_VIOLATION')
        : 'CHECK_CONSTRAINT_VIOLATION',
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === '23503') {
    const constraint = extractConstraintName(error);
    return {
      status: 'REJECTED',
      reason_code: constraint
        ? (FK_CONSTRAINT_REASON[constraint] ?? 'FOREIGN_KEY_VIOLATION')
        : 'FOREIGN_KEY_VIOLATION',
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === '23502') {
    return {
      status: 'REJECTED',
      reason_code: 'NOT_NULL_VIOLATION',
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === '22P02') {
    return {
      status: 'REJECTED',
      reason_code: 'INVALID_INPUT_SYNTAX',
      reason_message: buildReasonMessage(error),
    };
  }

  if (dbCode === '42501') {
    return {
      status: 'REJECTED',
      reason_code: 'PERMISSION_DENIED',
      reason_message: buildReasonMessage(error),
    };
  }

  return {
    status: 'REJECTED',
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
    if (typeof value === 'string' && value.length > 0) {
      return { field: preferred, value };
    }
  }

  const fallbackFields = ['id', 'evento_id', 'user_id', 'fazenda_id'] as const;
  for (const field of fallbackFields) {
    const value = op.record?.[field];
    if (typeof value === 'string' && value.length > 0) {
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

export function prevalidateAntiTeleport(ops: Operation[]):
  | { ok: true }
  | {
      ok: false;
      op_id: string;
      reason_code: 'ANTI_TELEPORTE';
      reason_message: string;
    } {
  const movBaseByAnimal = new Map<string, string>();
  const finBaseByAnimal = new Map<string, string>();

  for (const op of ops) {
    if (
      op.table === 'eventos' &&
      op.action === 'INSERT' &&
      op.record?.id
    ) {
      if (op.record.dominio === 'movimentacao') {
        if (typeof op.record.animal_id === 'string') {
          movBaseByAnimal.set(op.record.animal_id as string, op.record.id as string);
        }
      }
      if (op.record.dominio === 'financeiro') {
        if (typeof op.record.animal_id === 'string') {
          finBaseByAnimal.set(op.record.animal_id as string, op.record.id as string);
        }
        const animalIds = Array.isArray(op.record.payload?.animal_ids)
          ? op.record.payload.animal_ids
          : [];
        for (const animalId of animalIds) {
          if (typeof animalId === 'string' && animalId.length > 0) {
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
      op.table === 'eventos_movimentacao' &&
      op.action === 'INSERT' &&
      op.record?.evento_id
    ) {
      movDetalhesEventoIds.add(op.record.evento_id as string);
    }
    if (
      op.table === 'eventos_financeiro' &&
      op.action === 'INSERT' &&
      op.record?.evento_id &&
      op.record?.tipo === 'venda'
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
    if (op.table !== 'animais' || op.action !== 'UPDATE' || !op.record?.id) {
      continue;
    }

    const hasLoteMutation = Object.prototype.hasOwnProperty.call(op.record, 'lote_id');
    const hasPastoMutation = Object.prototype.hasOwnProperty.call(op.record, 'pasto_id');
    if (!hasLoteMutation && !hasPastoMutation) continue;

    const animalId = op.record.id as string;
    const eventoId = movBaseByAnimal.get(animalId);

    if (!eventoId && canExitBySaleAnimalIds.has(animalId)) {
      const status = op.record.status;
      const loteValue = op.record.lote_id;
      const pastoValue = op.record.pasto_id;
      const loteExitOk = !hasLoteMutation || loteValue === null;
      const pastoExitOk = !hasPastoMutation || pastoValue === null;

      if (status === 'vendido' && loteExitOk && pastoExitOk) {
        continue;
      }
    }

    if (!eventoId) {
      return {
        ok: false,
        op_id: op.client_op_id,
        reason_code: 'ANTI_TELEPORTE',
        reason_message:
          'UPDATE animais.lote_id/pasto_id sem evento base de movimentacao no mesmo tx',
      };
    }

    if (!movDetalhesEventoIds.has(eventoId)) {
      return {
        ok: false,
        op_id: op.client_op_id,
        reason_code: 'ANTI_TELEPORTE',
        reason_message:
          'Evento de movimentacao sem detalhe correlato (evento_id mismatch) no mesmo tx',
      };
    }
  }

  return { ok: true };
}
