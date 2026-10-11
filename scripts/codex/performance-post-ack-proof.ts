import { db } from '../../src/lib/offline/db';
import { createGesture } from '../../src/lib/offline/ops';
import { processGesture, drainReconciliationObligations } from '../../src/lib/offline/syncWorker';
import { pullDataForFarm } from '../../src/lib/offline/pull';
import { setActiveFarmId } from '../../src/lib/storage';
export async function command(input: { kind: string; farm?: string; id?: string; note?: string; tx?: string }) {
  if (input.kind === 'active') { setActiveFarmId(input.farm!); return {}; }
  if (input.kind === 'pull') { await pullDataForFarm(input.farm!, ['animais'], { mode: 'merge' }); return {}; }
  if (input.kind === 'enqueue') {
    const tx = crypto.randomUUID();
    await createGesture(input.farm!, [{ table: 'animais', action: 'UPDATE', record: { id: input.id, observacoes: input.note } }], { clientTxId: tx });
    const op = (await db.queue_ops.where('client_tx_id').equals(tx).first())!;
    return { tx: op.client_tx_id, expected_revision: op.expected_revision };
  }
  if (input.kind === 'process') { await processGesture((await db.queue_gestures.get(input.tx!))!); }
  if (input.kind === 'drain') { await drainReconciliationObligations(input.farm!); }
  return {
    animals: (await db.state_animais.toArray()).map(r => ({ id: r.id, farm: r.fazenda_id, revision: r.revision, note: r.observacoes })),
    gestures: (await db.queue_gestures.toArray()).map(g => ({ tx: g.client_tx_id, status: g.status, results: g.operation_results?.map(r => r.status) })),
    ops: (await db.queue_ops.toArray()).map(op => ({ tx: op.client_tx_id, expected_revision: op.expected_revision, state: op.sync_state })),
    obligations: (await db.sync_reconcile_obligations.toArray()).map(o => ({ farm: o.fazenda_id, generation: o.generation_id, tables: o.tables })),
  };
}
