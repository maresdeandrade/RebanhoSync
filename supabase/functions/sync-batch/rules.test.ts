import { describe, expect, it } from 'vitest';
import {
  buildMutationMatch,
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
