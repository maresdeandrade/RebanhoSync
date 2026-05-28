// src/lib/offline/__tests__/eventos_ecc_sync.test.ts
import { getRemoteTableName } from '@/lib/offline/tableMap';
import { normalizeTableMutationRecord } from '@/lib/offline/mutationRecord';

describe('eventos_ecc sync integration', () => {
  it('maps local store to remote table correctly', () => {
    expect(getRemoteTableName('event_eventos_ecc')).toBe('eventos_ecc');
  });

  it('does not alter record during normalization for eventos_ecc', () => {
    const record = { event_id: 'ev1', animal_id: 'a1', ecc: 3.5, fazenda_id: 'farm-1' };
    const normalized = normalizeTableMutationRecord('eventos_ecc', { ...record }, undefined);
    expect(normalized).toEqual(record);
  });
});
