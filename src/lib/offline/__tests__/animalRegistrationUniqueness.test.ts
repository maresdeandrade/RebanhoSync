/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { createGesture } from '../ops';

const farm = '30000000-0000-4000-8000-000000000001';
const otherFarm = '30000000-0000-4000-8000-000000000002';
const input = (id: string, identificacao = 'BR-001') => [{
  table: 'animais', action: 'INSERT' as const,
  record: { id, identificacao, sexo: 'F', status: 'ativo', payload: {} },
}];
const options = { enforceAnimalIdentificationUnique: true };

describe('unicidade transacional do cadastro individual', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([db.state_animais.clear(), db.queue_ops.clear(), db.queue_gestures.clear()]);
  });

  it('rejeita identificação já pendente na mesma fazenda sem gerar novo gesto', async () => {
    await createGesture(farm, input('animal-1'), options);
    await expect(createGesture(farm, input('animal-2'), options)).rejects.toThrow('ANIMAL_IDENTIFICATION_DUPLICATE');
    expect(await db.state_animais.count()).toBe(1);
    expect(await db.queue_gestures.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(1);
  });

  it('permite a mesma identificação em fazendas diferentes', async () => {
    await createGesture(farm, input('animal-1'), options);
    await createGesture(otherFarm, input('animal-2'), options);
    expect(await db.state_animais.count()).toBe(2);
  });

  it('serializa submissões concorrentes para a mesma identificação', async () => {
    const results = await Promise.allSettled([
      createGesture(farm, input('animal-1'), options),
      createGesture(farm, input('animal-2'), options),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.state_animais.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(1);
  });

  it('considera operação pendente mesmo se a projeção local estiver ausente', async () => {
    await createGesture(farm, input('animal-1'), options);
    await db.state_animais.delete('animal-1');
    await expect(createGesture(farm, input('animal-2'), options)).rejects.toThrow('ANIMAL_IDENTIFICATION_DUPLICATE');
    expect(await db.queue_ops.count()).toBe(1);
  });

  it('preserva replay da mesma operação com identidade original', async () => {
    const fixed = { ...options, clientTxId: 'tx-original', clientOpIds: ['op-original'] };
    await createGesture(farm, input('animal-1'), fixed);
    await expect(createGesture(farm, input('animal-1'), fixed)).resolves.toBe('tx-original');
    expect(await db.queue_ops.count()).toBe(1);
  });

  it('considera animal em compra pendente quando a projeção está ausente', async () => {
    await db.queue_gestures.add({ client_tx_id: 'tx-compra', client_id: 'client', fazenda_id: farm, status: 'PENDING', created_at: '2026-01-01T00:00:00Z' });
    await db.queue_ops.add({
      table: 'commercial_operation_v2', action: 'INSERT', client_op_id: 'op-compra', client_tx_id: 'tx-compra', op_order: 0, created_at: '2026-01-01T00:00:00Z',
      record: { domain: 'commercial_operation_v2', command: 'apply_commercial_operation', contract_version: 2, client_op_id: 'op-compra', client_tx_id: 'tx-compra', operation_id: 'event-1', operation_type: 'compra', scope: 'animal', fazenda_id: farm, animal_ids: ['animal-1'], animals: [{ id: 'animal-1', fazenda_id: farm, identificacao: 'BR-001' }], event: {}, detail: {} },
    });
    await expect(createGesture(farm, input('animal-2'), options)).rejects.toThrow('ANIMAL_IDENTIFICATION_DUPLICATE');
    expect(await db.queue_gestures.count()).toBe(1);
  });
});
