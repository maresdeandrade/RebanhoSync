import { db } from './db';
import { Operation, Gesture, OpAction } from './types';

export const createGesture = async (fazenda_id: string, ops_input: Omit<Operation, 'client_tx_id' | 'client_op_id' | 'created_at'>[]) => {
  const client_tx_id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const client_id = 'browser-client'; // Idealmente viria de um config

  const gesture: Gesture = {
    client_tx_id,
    fazenda_id,
    client_id,
    status: 'PENDING',
    created_at
  };

  const ops: Operation[] = ops_input.map(op => ({
    ...op,
    client_tx_id,
    client_op_id: crypto.randomUUID(),
    created_at
  }));

  // Transação Dexie para garantir atomicidade local
  await db.transaction('rw', [db.queue_gestures, db.queue_ops, ...getAffectedStores(ops)], async () => {
    await db.queue_gestures.add(gesture);
    await db.queue_ops.bulkAdd(ops);

    for (const op of ops) {
      await applyOpLocal(op);
    }
  });

  return client_tx_id;
};

export const applyOpLocal = async (op: Operation) => {
  const store = (db as any)[op.table];
  if (!store) return;

  if (op.action === 'INSERT' || op.action === 'UPDATE') {
    // Para UPDATE, salvamos o estado anterior se ainda não existir no op
    if (op.action === 'UPDATE' && !op.before_snapshot) {
      const existing = await store.get(op.record.id);
      op.before_snapshot = existing;
      await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    }
    await store.put(op.record);
  } else if (op.action === 'DELETE') {
    // Soft delete local (tombstone)
    const existing = await store.get(op.record.id);
    op.before_snapshot = existing;
    await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    await store.update(op.record.id, { deleted_at: new Date().toISOString() });
  }
};

export const rollbackOpLocal = async (op: Operation) => {
  const store = (db as any)[op.table];
  if (!store) return;

  if (op.action === 'INSERT') {
    await store.delete(op.record.id);
  } else if (op.action === 'UPDATE' || op.action === 'DELETE') {
    if (op.before_snapshot) {
      await store.put(op.before_snapshot);
    }
  }
};

function getAffectedStores(ops: Operation[]) {
  const tables = new Set(ops.map(op => op.table));
  return Array.from(tables).map(t => (db as any)[t]);
}