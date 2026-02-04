import { db } from './db';
import { rollbackOpLocal } from './ops';

let isSyncing = false;

export const startSyncWorker = () => {
  setInterval(async () => {
    if (isSyncing || !navigator.onLine) return;
    
    const nextGesture = await db.queue_gestures
      .where('status')
      .equals('PENDING')
      .first();

    if (!nextGesture) return;

    isSyncing = true;
    try {
      await processGesture(nextGesture);
    } catch (e) {
      console.error('[sync-worker] Error processing gesture:', e);
      await db.queue_gestures.update(nextGesture.client_tx_id, { 
        status: 'ERROR', 
        last_error: e.message 
      });
    } finally {
      isSyncing = false;
    }
  }, 5000);
};

async function processGesture(gesture: any) {
  await db.queue_gestures.update(gesture.client_tx_id, { status: 'SYNCING' });

  const ops = await db.queue_ops
    .where('client_tx_id')
    .equals(gesture.client_tx_id)
    .toArray();

  const response = await fetch('https://zqloazqzhwauamcejmuz.supabase.co/functions/v1/sync-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: gesture.client_id,
      fazenda_id: gesture.fazenda_id,
      client_tx_id: gesture.client_tx_id,
      ops: ops.map(o => ({
        client_op_id: o.client_op_id,
        table: o.table,
        action: o.action,
        record: o.record
      }))
    })
  });

  if (!response.ok) throw new Error(`Server returned ${response.status}`);

  const { results } = await response.json();

  for (const res of results) {
    const op = ops.find(o => o.client_op_id === res.op_id);
    if (!op) continue;

    if (res.status === 'REJECTED') {
      await rollbackOpLocal(op);
      await db.queue_rejections.add({
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
    // APPLIED e APPLIED_ALTERED não exigem ação local imediata no MVP
  }

  await db.queue_gestures.update(gesture.client_tx_id, { status: 'DONE' });
}