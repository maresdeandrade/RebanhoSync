import { db } from './db';
import { Operation, Gesture, OperationInput } from './types';
import { getLocalStoreName } from './tableMap';

export const createGesture = async (fazenda_id: string, ops_input: OperationInput[]) => {
  const client_tx_id = crypto.randomUUID();
  const client_recorded_at = new Date().toISOString();
  const client_id = 'browser-client';

  const gesture: Gesture = {
    client_tx_id,
    fazenda_id,
    client_id,
    status: 'PENDING',
    created_at: client_recorded_at
  };

  const ops: Operation[] = ops_input.map(op => ({
    ...op,
    client_tx_id,
    client_op_id: crypto.randomUUID(),
    created_at: client_recorded_at
  }));

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
  // Traduz o nome da tabela remota para o store local
  const localStoreName = getLocalStoreName(op.table);
  const store = (db as any)[localStoreName];
  
  if (!store) {
    console.error(`[ops] Store ${localStoreName} not found in database.`);
    return;
  }

  if (op.action === 'INSERT' || op.action === 'UPDATE') {
    if (op.action === 'UPDATE' && !op.before_snapshot) {
      const existing = await store.get(op.record.id);
      op.before_snapshot = existing;
      await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    }
    await store.put(op.record);
  } else if (op.action === 'DELETE') {
    const existing = await store.get(op.record.id);
    op.before_snapshot = existing;
    await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    // Soft delete local
    await store.update(op.record.id, { deleted_at: new Date().toISOString() });
  }
};

export const rollbackOpLocal = async (op: Operation) => {
  if (!op.before_snapshot && op.action !== 'INSERT') return;
  
  const localStoreName = getLocalStoreName(op.table);
  const store = (db as any)[localStoreName];
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
  const tableNames = new Set(ops.map(op => getLocalStoreName(op.table)));
  return Array.from(tableNames).map(t => (db as any)[t]).filter(Boolean);
}