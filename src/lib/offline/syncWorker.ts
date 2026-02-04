import { db } from './db';
import { supabase } from '../supabase';
import { rollbackOpLocal } from './ops';

let isSyncing = false;

export const startSyncWorker = () => {
  setInterval(async () => {
    if (isSyncing || !navigator.onLine) return;
    await processQueue();
  }, 5000);
};

async function processQueue() {
  isSyncing = true;
  try {
    const gesture = await db.queue_gestures
      .where('status')
      .equals('PENDING')
      .first();

    if (!gesture) return;

    await db.queue_gestures.update(gesture.client_tx_id, { status: 'SYNCING' });

    const ops = await db.queue_ops
      .where('client_tx_id')
      .equals(gesture.client_tx_id)
      .toArray();

    const { data, error } = await supabase.functions.invoke('sync-batch', {
      body: {
        client_id: gesture.client_id,
        fazenda_id: gesture.fazenda_id,
        client_tx_id: gesture.client_tx_id,
        ops: ops.map(o => ({
          op_id: o.client_op_id,
          table: o.table.replace('state_', '').replace('event_', ''), // Mapeia para tabelas do banco
          action: o.action,
          record: o.record
        }))
      }
    });

    if (error) {
      await db.queue_gestures.update(gesture.client_tx_id, { 
        status: 'ERROR', 
        last_error: error.message 
      });
      return;
    }

    // Processar resultados
    for (const res of data.results) {
      const op = ops.find(o => o.client_op_id === res.op_id);
      if (!op) continue;

      if (res.status === 'REJECTED') {
        await rollbackOpLocal(op);
        await db.queue_rejections.add({
          id: crypto.randomUUID(),
          client_tx_id: gesture.client_tx_id,
          client_op_id: op.client_op_id,
          fazenda_id: gesture.fazenda_id,
          table: op.table,
          action: op.action,
          reason_code: res.reason_code,
          reason_message: res.reason_message,
          created_at: new Date().toISOString()
        });
      }
      // APPLIED_ALTERED poderia atualizar o record local aqui
    }

    await db.queue_gestures.update(gesture.client_tx_id, { status: 'DONE' });

  } catch (err: any) {
    console.error('Sync error:', err);
  } finally {
    isSyncing = false;
  }
}