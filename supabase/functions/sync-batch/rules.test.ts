import { describe, expect, it } from 'vitest';
import {
  buildMutationMatch,
  inferAgendaSourceTaskIdForEventInsert,
  normalizeDbError,
  prevalidateAntiTeleport,
  resolveOperationPrimaryKey,
  type Operation,
} from './rules';

function op(partial: Partial<Operation>): Operation {
  return {
    client_op_id: partial.client_op_id ?? 'op-1',
    table: partial.table ?? 'eventos',
    action: partial.action ?? 'INSERT',
    record: partial.record ?? {},
  };
}

describe('sync-batch rules: normalizeDbError', () => {
  it('maps check constraint names to deterministic reason_code', () => {
    const result = normalizeDbError(
      {
        code: '23514',
        message:
          'new row for relation "eventos_financeiro" violates check constraint "ck_evt_fin_valor_total_pos"',
      },
      op({ table: 'eventos_financeiro' }),
    );

    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') {
      expect(result.reason_code).toBe('VALIDATION_FINANCEIRO_VALOR_TOTAL');
    }
  });

  it('maps agenda unique violation to APPLIED_ALTERED dedup', () => {
    const result = normalizeDbError(
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      op({ table: 'agenda_itens' }),
    );

    expect(result).toEqual({
      status: 'APPLIED_ALTERED',
      altered: { dedup: 'collision_noop' },
    });
  });

  it('maps generic unique violation to APPLIED for idempotency', () => {
    const result = normalizeDbError(
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      op({ table: 'eventos_pesagem' }),
    );

    expect(result).toEqual({ status: 'APPLIED' });
  });

  it('maps inventory movement unique violation to APPLIED for replay idempotency', () => {
    const result = normalizeDbError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "insumo_movimentacoes_pkey"',
      },
      op({
        table: 'insumo_movimentacoes',
        record: {
          id: 'evt-nutricao-1',
          source_evento_id: 'evt-nutricao-1',
          tipo: 'consumo_nutricao',
          client_op_id: 'op-nutricao-1',
        },
      }),
    );

    expect(result).toEqual({ status: 'APPLIED' });
  });

  it('sentinela 11.5A: retry offline nao duplica agenda, evento sanitario nem baixa de estoque', () => {
    const agendaRetry = normalizeDbError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "ux_agenda_dedup_active"',
      },
      op({
        table: 'agenda_itens',
        record: {
          id: 'agenda-1',
          dedup_key: 'san:animal:animal-1:proto:item:v1:window:2026-06-01',
          client_op_id: 'op-agenda-1',
        },
      }),
    );

    const eventRetry = normalizeDbError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "ux_eventos_client_op_id"',
      },
      op({
        table: 'eventos',
        record: {
          id: 'evt-san-1',
          dominio: 'sanitario',
          source_task_id: 'agenda-1',
          client_op_id: 'op-event-1',
        },
      }),
    );

    const sanitaryDetailRetry = normalizeDbError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "eventos_sanitario_pkey"',
      },
      op({
        table: 'eventos_sanitario',
        record: {
          evento_id: 'evt-san-1',
          tipo: 'vacinacao',
          client_op_id: 'op-event-detail-1',
        },
      }),
    );

    const stockMovementRetry = normalizeDbError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "ux_insumo_movimentacoes_client_op_id"',
      },
      op({
        table: 'insumo_movimentacoes',
        record: {
          id: 'evt-san-1',
          source_evento_id: 'evt-san-1',
          tipo: 'consumo_sanitario',
          client_op_id: 'op-stock-1',
        },
      }),
    );

    expect(agendaRetry).toEqual({
      status: 'APPLIED_ALTERED',
      altered: { dedup: 'collision_noop' },
    });
    expect(eventRetry).toEqual({ status: 'APPLIED' });
    expect(sanitaryDetailRetry).toEqual({ status: 'APPLIED' });
    expect(stockMovementRetry).toEqual({ status: 'APPLIED' });
  });

  it('maps duplicate agenda source event to deterministic rejection', () => {
    const result = normalizeDbError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "idx_eventos_unique_source_task"',
      },
      op({ table: 'eventos' }),
    );

    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') {
      expect(result.reason_code).toBe('agenda_already_completed_by_event');
    }
  });

  it('maps known FK constraint to domain reason_code', () => {
    const result = normalizeDbError(
      {
        code: '23503',
        message:
          'insert or update on table "eventos_financeiro" violates foreign key constraint "fk_evt_fin_contraparte_fazenda"',
      },
      op({ table: 'eventos_financeiro' }),
    );

    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') {
      expect(result.reason_code).toBe('VALIDATION_FINANCEIRO_CONTRAPARTE');
    }
  });

  it('maps inventory balance and source constraints to deterministic reason_code', () => {
    const saldo = normalizeDbError(
      {
        code: '23514',
        message:
          'new row for relation "insumo_lotes" violates check constraint "ck_insumo_lotes_saldo_non_negative"',
      },
      op({ table: 'insumo_movimentacoes' }),
    );
    const source = normalizeDbError(
      {
        code: '23503',
        message:
          'insert or update on table "insumo_movimentacoes" violates foreign key constraint "fk_insumo_movimentacoes_source_evento_fazenda"',
      },
      op({ table: 'insumo_movimentacoes' }),
    );

    expect(saldo.status).toBe('REJECTED');
    if (saldo.status === 'REJECTED') {
      expect(saldo.reason_code).toBe('VALIDATION_INSUMO_SALDO_INSUFICIENTE');
    }
    expect(source.status).toBe('REJECTED');
    if (source.status === 'REJECTED') {
      expect(source.reason_code).toBe('VALIDATION_INSUMO_SOURCE_EVENTO');
    }
  });
});

describe('sync-batch rules: mutation key resolution', () => {
  it('uses evento_id for event detail tables', () => {
    const operation = op({
      table: 'eventos_pesagem',
      action: 'UPDATE',
      record: { evento_id: 'evt-1', peso_kg: 420.5 },
    });

    const key = resolveOperationPrimaryKey(operation);
    expect(key).toEqual({ field: 'evento_id', value: 'evt-1' });

    const match = buildMutationMatch(operation, 'faz-1');
    expect(match).toEqual({ evento_id: 'evt-1', fazenda_id: 'faz-1' });
  });

  it('uses id for regular tables', () => {
    const operation = op({
      table: 'animais',
      action: 'UPDATE',
      record: { id: 'ani-1', lote_id: 'lote-2' },
    });

    const match = buildMutationMatch(operation, 'faz-1');
    expect(match).toEqual({ id: 'ani-1', fazenda_id: 'faz-1' });
  });

  it('uses id for sanitario_casos', () => {
    const operation = op({
      table: 'sanitario_casos',
      action: 'UPDATE',
      record: { id: 'caso-1', status: 'em_acompanhamento' },
    });

    const match = buildMutationMatch(operation, 'faz-1');
    expect(match).toEqual({ id: 'caso-1', fazenda_id: 'faz-1' });
  });

  it('uses fazenda_id for fazenda_sanidade_config', () => {
    const operation = op({
      table: 'fazenda_sanidade_config',
      action: 'UPDATE',
      record: { fazenda_id: 'faz-1', payload: { overlay_runtime: {} } },
    });

    const key = resolveOperationPrimaryKey(operation);
    expect(key).toEqual({ field: 'fazenda_id', value: 'faz-1' });

    const match = buildMutationMatch(operation, 'faz-1');
    expect(match).toEqual({ fazenda_id: 'faz-1' });
  });

  it('returns null when mutation has no known primary key field', () => {
    const operation = op({
      table: 'animais',
      action: 'UPDATE',
      record: { lote_id: 'lote-2' },
    });

    expect(buildMutationMatch(operation, 'faz-1')).toBeNull();
  });
});

describe('sync-batch rules: agenda source inference', () => {
  it('uses direct source_task_id on event insert', () => {
    const operation = op({
      table: 'eventos',
      action: 'INSERT',
      record: { id: 'evt-1', source_task_id: 'agenda-1' },
    });

    expect(inferAgendaSourceTaskIdForEventInsert(operation, [operation])).toBe('agenda-1');
  });

  it('infers agenda source from same-batch agenda completion update', () => {
    const eventOp = op({
      table: 'eventos',
      action: 'INSERT',
      record: { id: 'evt-1', source_task_id: null },
    });
    const agendaOp = op({
      table: 'agenda_itens',
      action: 'UPDATE',
      record: { id: 'agenda-1', status: 'concluido', source_evento_id: 'evt-1' },
    });

    expect(inferAgendaSourceTaskIdForEventInsert(eventOp, [eventOp, agendaOp])).toBe(
      'agenda-1',
    );
  });
});

describe('sync-batch rules: anti-teleporte', () => {
  it('rejects lote update without movement event in same tx', () => {
    const result = prevalidateAntiTeleport([
      op({
        client_op_id: 'op-update',
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-1', lote_id: 'lote-2' },
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason_code).toBe('ANTI_TELEPORTE');
    }
  });

  it('rejects pasto update without movement event in same tx', () => {
    const result = prevalidateAntiTeleport([
      op({
        client_op_id: 'op-update',
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-1', pasto_id: 'pasto-2' },
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason_code).toBe('ANTI_TELEPORTE');
    }
  });

  it('accepts composed movement tx (event base + detail + animal update)', () => {
    const eventoId = 'evt-1';
    const result = prevalidateAntiTeleport([
      op({
        table: 'eventos',
        action: 'INSERT',
        record: { id: eventoId, dominio: 'movimentacao', animal_id: 'ani-1' },
      }),
      op({
        table: 'eventos_movimentacao',
        action: 'INSERT',
        record: { evento_id: eventoId, to_lote_id: 'lote-2' },
      }),
      op({
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-1', lote_id: 'lote-2' },
      }),
    ]);

    expect(result).toEqual({ ok: true });
  });

  it('accepts animal exit on sale when financeiro venda is in same tx', () => {
    const eventoId = 'evt-fin-1';
    const result = prevalidateAntiTeleport([
      op({
        table: 'eventos',
        action: 'INSERT',
        record: { id: eventoId, dominio: 'financeiro', animal_id: 'ani-1' },
      }),
      op({
        table: 'eventos_financeiro',
        action: 'INSERT',
        record: { evento_id: eventoId, tipo: 'venda', valor_total: 1200 },
      }),
      op({
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-1', status: 'vendido', lote_id: null },
      }),
    ]);

    expect(result).toEqual({ ok: true });
  });

  it('accepts grouped sale when financeiro payload references all animal_ids', () => {
    const eventoId = 'evt-fin-lote-1';
    const result = prevalidateAntiTeleport([
      op({
        table: 'eventos',
        action: 'INSERT',
        record: {
          id: eventoId,
          dominio: 'financeiro',
          animal_id: null,
          lote_id: 'lote-1',
          payload: { animal_ids: ['ani-1', 'ani-2'] },
        },
      }),
      op({
        table: 'eventos_financeiro',
        action: 'INSERT',
        record: { evento_id: eventoId, tipo: 'venda', valor_total: 2400 },
      }),
      op({
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-1', status: 'vendido', lote_id: null },
      }),
      op({
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-2', status: 'vendido', lote_id: null },
      }),
    ]);

    expect(result).toEqual({ ok: true });
  });

  it('keeps anti-teleporte rejection when sale tx tries to move animal to another lote', () => {
    const eventoId = 'evt-fin-1';
    const result = prevalidateAntiTeleport([
      op({
        table: 'eventos',
        action: 'INSERT',
        record: { id: eventoId, dominio: 'financeiro', animal_id: 'ani-1' },
      }),
      op({
        table: 'eventos_financeiro',
        action: 'INSERT',
        record: { evento_id: eventoId, tipo: 'venda', valor_total: 1200 },
      }),
      op({
        table: 'animais',
        action: 'UPDATE',
        record: { id: 'ani-1', status: 'vendido', lote_id: 'lote-2' },
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason_code).toBe('ANTI_TELEPORTE');
    }
  });
});
