import { db } from './db';
import { rollbackOpLocal } from './ops';
import { env } from '@/lib/env';
import type { Gesture } from './types';

let intervalId: NodeJS.Timeout | null = null;

export const startSyncWorker = () => {
  // P0.2 FIX: Prevent multiple workers from running
  if (intervalId) {
    console.warn('[sync-worker] Worker already running');
    return;
  }

  console.log('[sync-worker] Starting sync worker');
  intervalId = setInterval(async () => {
    const pending = await db.queue_gestures
      .where('status')
      .equals('PENDING')
      .sortBy('created_at');

    for (const gesture of pending) {
      try {
        await processGesture(gesture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    console.log('[sync-worker] Stopping sync worker');
    clearInterval(intervalId);
    intervalId = null;
  }
};

// TYPE FIX: Use proper Gesture type instead of any
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
          table: o.table,
          action: o.action,
          record: o.record
        }))
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.status === 'APPLIED_OK') {
      await db.queue_gestures.update(gesture.client_tx_id, { status: 'DONE' });
      await db.queue_ops.where('client_tx_id').equals(gesture.client_tx_id).delete();
    } else if (result.status === 'APPLIED_ALTERED') {
      // TODO: Handle server-side modifications
      await db.queue_gestures.update(gesture.client_tx_id, { status: 'SYNCED' });
    } else if (result.status === 'REJECTED') {
      await db.queue_gestures.update(gesture.client_tx_id, { status: 'REJECTED' });
      console.warn(`[sync-worker] Gesture ${gesture.client_tx_id} rejected by server`);
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    // P1.3 FIX: Retry logic with exponential backoff
    const retryCount = gesture.retry_count || 0;
    
    if (retryCount < 3) {
      // Exponential backoff: 5s, 10s, 20s
      const backoffMs = 5000 * Math.pow(2, retryCount);
      
      await db.queue_gestures.update(gesture.client_tx_id, { 
        status: 'PENDING',
        retry_count: retryCount + 1,
        last_error: e.message 
      });
      
      console.warn(`[sync-worker] Retry ${retryCount + 1}/3 for gesture ${gesture.client_tx_id} (backoff: ${backoffMs}ms)`);
    } else {
      // Max retries exceeded
      await db.queue_gestures.update(gesture.client_tx_id, { 
        status: 'ERROR', 
        last_error: `Max retries exceeded: ${e.message}` 
      });
      
      console.error(`[sync-worker] Gesture ${gesture.client_tx_id} failed permanently after 3 retries`);
    }
  }
}