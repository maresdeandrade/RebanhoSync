import { db } from './db';
import { env } from '@/lib/env';
import type { Gesture } from './types';

let intervalId: NodeJS.Timeout | null = null;

export const startSyncWorker = () => {
  if (intervalId) return;

  console.log('[sync-worker] Starting sync worker');
  intervalId = setInterval(async () => {
    const pending = await db.queue_gestures
      .where('status')
      .equals('PENDING')
      .sortBy('created_at');

    for (const gesture of pending) {
      try {
        await processGesture(gesture);
      } catch (e: any) {
        console.error('[sync-worker] Error processing gesture:', e);
        await db.queue_gestures.update(gesture.client_tx_id, { 
          status: 'ERROR', 
          last_error: e.message 
        });
      }
    }
  }, 5000);
};

export const stopSyncWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

async function processGesture(gesture: Gesture) {
  await db.queue_gestures.update(gesture.client_tx_id, { status: 'SYNCING' });

  const ops = await db.queue_ops
    .where('client_tx_id')
    .equals(gesture.client_tx_id)
    .toArray();

  try {
    const response = await fetch(`${env.supabaseFunctionsUrl}/sync-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: gesture.client_id,
        fazenda_id: gesture.fazenda_id,
        client_tx_id: gesture.client_tx_id,
        ops: ops.map(o => ({
          client_op_id: o.client_op_id,
          table: o.table, // Mantém o nome remoto para o servidor
          action: o.action,
          record: o.record
        }))
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    // Verificação de status baseada no retorno da Edge Function (APPLIED ou REJECTED)
    // Se todos os resultados individuais forem bem-sucedidos ou idempotentes
    const allApplied = result.results.every((r: any) => r.status === 'APPLIED' || r.status === 'APPLIED_ALTERED');
    const hasRejected = result.results.some((r: any) => r.status === 'REJECTED');

    if (allApplied) {
      await db.queue_gestures.update(gesture.client_tx_id, { status: 'DONE' });
      await db.queue_ops.where('client_tx_id').equals(gesture.client_tx_id).delete();
      console.log(`[sync-worker] TX ${gesture.client_tx_id} synced successfully`);
    } else if (hasRejected) {
      await db.queue_gestures.update(gesture.client_tx_id, { status: 'REJECTED' });
      
      // Salva as rejeições para reconciliação
      for (const res of result.results.filter((r: any) => r.status === 'REJECTED')) {
        const originalOp = ops.find(o => o.client_op_id === res.op_id);
        if (originalOp) {
          await db.queue_rejections.add({
            client_tx_id: gesture.client_tx_id,
            client_op_id: res.op_id,
            fazenda_id: gesture.fazenda_id,
            table: originalOp.table,
            action: originalOp.action,
            reason_code: res.reason_code,
            reason_message: res.reason_message,
            created_at: new Date().toISOString()
          });
        }
      }
      console.warn(`[sync-worker] TX ${gesture.client_tx_id} had rejections`);
    }
  } catch (e: any) {
    const retryCount = gesture.retry_count || 0;
    if (retryCount < 3) {
      await db.queue_gestures.update(gesture.client_tx_id, { 
        status: 'PENDING',
        retry_count: retryCount + 1,
        last_error: e.message 
      });
    } else {
      await db.queue_gestures.update(gesture.client_tx_id, { 
        status: 'ERROR', 
        last_error: `Max retries: ${e.message}` 
      });
    }
  }
}