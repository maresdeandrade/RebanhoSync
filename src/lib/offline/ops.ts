import { db } from './db';
import { Operation, Gesture, OpAction } from './types';

export const createGesture = async (fazenda_id: string, ops_input: Omit<Operation, 'client_tx_id' | 'client_op_id' | 'created_at'>[]) => {
  const client_tx_id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const client_id = 'browser-client'; // Idealmente viria de um config

  const ops: Operation[] = ops_input.map(op => ({
    ...op,
    client_tx_id,
    client_op_id: crypto.randomUUID(),
    created_at
  }));

  const gesture: Gesture = {
    client_tx_id,
    fazenda_id,
    client_id,
    created_at,
    status: 'PENDING'
  };

  await db.transaction('rw', [db.queue_gestures, db.queue_ops, ...getAffectedTables(ops)], async () => {
    await db.queue_gestures.add(gesture);
    await db.queue_ops.bulkAdd(ops);
    
    for (const op of ops) {
      await applyOpLocal(op);
    }
  });

  return client_tx_id;
};

async function applyOpLocal(op: Operation) {
  const table = (db as any)[op.table];
  if (!table) return;

  if (op.action === 'INSERT' || op.action === 'UPDATE') {
    // Para UPDATE, salvamos o estado anterior se não existir no op
    if (op.action === 'UPDATE' && !op.before_snapshot) {
      const existing = await table.get(op.record.id || op.record.evento_id);
      op.before_snapshot = existing;
    }
    await table.put(op.record);
  } else if (op.action === 'DELETE') {
    const id = op.record.id || op.record.evento_id;
    const existing = await table.get(id);
    op.before_snapshot = existing;
    // Soft delete local
    await table.update(id, { deleted_at: new Date().toISOString() });
  }
}

export async function rollbackOpLocal(op: Operation) {
  const table = (db as any)[op.table];
  if (!table) return;

  if (op.action === 'INSERT') {
    await table.delete(op.record.id || op.record.evento_id);
  } else if (op.action === 'UPDATE' || op.action === 'DELETE') {
    if (op.before_snapshot) {
      await table.put(op.before_snapshot);
    }
  }
}

function getAffectedTables(ops: Operation[]) {
  const tables = new Set<any>();
  ops.forEach(op => {
    const t = (db as any)[op.table];
    if (t) tables.add(t);
  });
  return Array.from(tables);
}