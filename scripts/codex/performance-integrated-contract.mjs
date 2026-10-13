import { BASELINE_SHA, summarize } from './performance-contract.mjs';

export const INTEGRATED_BASELINE_SHA = '869f006679827f3baddb0afed3c3cbf22e976fa5';
export const PRODUCT_PATHS = ['src', 'supabase', 'package.json', 'pnpm-lock.yaml', 'vite.config.ts', ':(exclude)supabase/.temp/cli-latest'];
export const CERTIFICATION_LIMITS = Object.freeze({ duration_ms: 240000, child_ms: 300000, requests: 4000, received_bytes: 600 * 1048576, heap_bytes: 512 * 1048576 });

export function assertOperationalBudget({ duration_ms = 0, requests = 0, received_bytes = 0, heap_bytes = 0 }) {
  for (const [key, value] of Object.entries({ duration_ms, requests, received_bytes, heap_bytes })) {
    if (!Number.isFinite(value) || value < 0 || value > CERTIFICATION_LIMITS[key]) throw new Error(`CERTIFICATION_${key.toUpperCase()}_LIMIT`);
  }
}

export async function withDeadline(execute, milliseconds, interrupt) {
  let timer;
  try {
    return await Promise.race([execute(), new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error('CERTIFICATION_DURATION_MS_LIMIT')); void interrupt(); }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function edgeHandlerReady(status, body) {
  // A gateway 401 with "Missing authorization header" does not prove that
  // the worker loaded. An anon JWT reaches the handler but is not an Auth user.
  return status === 401 && body?.error === 'Unauthorized - invalid JWT';
}

export async function cleanupOwnedIndexedDB(context, url) {
  const page = await context.newPage();
  await page.goto(url);
  await page.evaluate(async () => {
    await new Promise((ok, fail) => { const request = indexedDB.deleteDatabase('RebanhoSync'); request.onsuccess = ok; request.onerror = fail; request.onblocked = fail; });
    if ((await indexedDB.databases()).some(db => db.name === 'RebanhoSync')) throw new Error('DATABASE_CLEANUP_FAILED');
  });
  return page;
}

export function selectBaseline(options, env = {}) {
  if (options.baseline === 'historical') return BASELINE_SHA;
  if (options.baseline !== 'integrated') throw new Error('INVALID_BASELINE');
  if (options.workload !== 'reconnect' || options.mode !== 'warm' || options.purpose !== 'benchmark' || options.farms !== 2 || options.runs !== 1 || ![10, 1000].includes(options.gestures) || options.animals !== options.gestures) throw new Error('INTEGRATED_RECONNECT_ONLY');
  for (const key of ['REBANHOSYNC_POST_ACK_VARIANT', 'REBANHOSYNC_POST_ACK_PROOF', 'REBANHOSYNC_SEED_AB_SERIES', 'REBANHOSYNC_CONTROLLED_SEED_FAILURE', 'REBANHOSYNC_CONTROLLED_TRANSPORT_FAILURE']) {
    if (env[key] && env[key] !== '0') throw new Error('INTEGRATED_VARIANT_NOT_ALLOWED');
  }
  if (env.REBANHOSYNC_ACK_DIAGNOSIS !== '1') throw new Error('INTEGRATED_OBSERVATION_REQUIRED');
  return INTEGRATED_BASELINE_SHA;
}

export function assertFrozenProduct(git, baseline, head) {
  git(['merge-base', '--is-ancestor', baseline, head]);
  if (git(['diff', baseline, head, '--name-only', '--', ...PRODUCT_PATHS])) throw new Error('BENCHMARK_REBASELINE_REQUIRED');
  if (git(['diff', baseline, '--name-only', '--', ...PRODUCT_PATHS])) throw new Error('PRODUCT_PATCH_NOT_ALLOWED');
  // Include ignored files: an ignored TS module could otherwise enter Vite's graph.
  if (git(['ls-files', '--others', '--', ...PRODUCT_PATHS])) throw new Error('UNTRACKED_PRODUCT_PATCH_NOT_ALLOWED');
}

export function certificationSpecifications(args) {
  if (args.length !== 1 || args[0] !== '--integrated-reconnect-1k') throw new Error('EXCLUSIVE_CERTIFICATION_MODE_REQUIRED');
  return [{ gestures: 10, kind: 'smoke' }, ...Array.from({ length: 5 }, (_, i) => ({ gestures: 1000, kind: 'certification', run: i + 1 }))];
}

const revisionNumber = value => {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('UNSAFE_REMOTE_REVISION');
  return number;
};

export function verifyRemoteFixture({ initial, animals, remote, localRows, agenda, farms }) {
  const count = animals.length;
  const expected = new Map(animals.map(a => [a.id, a]));
  const revisions = new Map(initial.map(a => [a.id, revisionNumber(a.revision)]));
  const local = new Map(localRows.map(a => [a.id, a]));
  if (remote.length !== count || new Set(remote.map(a => a.id)).size !== count || localRows.length !== count || local.size !== count || agenda !== 0 || new Set(remote.map(a => a.client_op_id)).size !== count || new Set(remote.map(a => a.client_tx_id)).size !== count) throw new Error('REMOTE_INTEGRITY_FAILED');
  for (const row of remote) {
    const counterpart = local.get(row.id);
    if (!expected.has(row.id) || row.fazenda_id !== expected.get(row.id).fazenda_id || row.observacoes !== 'F24.6 benchmark updated' || revisionNumber(row.revision) !== revisions.get(row.id) + 1 || revisionNumber(row.revision) !== counterpart?.revision || !row.client_op_id || !row.client_tx_id || ['fazenda_id', 'observacoes', 'client_op_id', 'client_tx_id'].some(key => row[key] !== counterpart?.[key])) throw new Error('REMOTE_CONVERGENCE_FAILED');
  }
  return { verified: true, animals: count, farms: farms.map(farm => ({ animals: remote.filter(row => row.fazenda_id === farm).length })), agenda, revision_increment: 1, unique_operations: count, unique_transactions: count };
}

export function assertCertifiedRun(report, gestures) {
  const result = report?.results?.[0];
  if (report?.status !== 'PROOF_PASSED' || !report.cleanup_completed || report.results.length !== 1 || !result) throw new Error('RUN_EVIDENCE_INCOMPLETE');
  if (result.gestures !== gestures || result.operations !== gestures || result.ack_confirmed !== gestures || result.backlog_after !== 0 || result.reconciliation_obligations_remaining !== 0 || !result.isolation_verified || !result.remote_verification?.verified || !result.local_convergence_verified || result.errors || result.repeated_operation_submissions || !Object.values(result.cleanup ?? {}).every(v => v === true) || Object.keys(result.cleanup ?? {}).length !== 3) throw new Error('RUN_INTEGRITY_FAILED');
  if (result.remote_verification.animals !== gestures || result.remote_verification.agenda !== 0 || result.remote_verification.unique_operations !== gestures || result.remote_verification.unique_transactions !== gestures || result.remote_verification.farms?.length !== 2 || result.remote_verification.farms.some(farm => farm.animals !== gestures / 2)) throw new Error('RUN_REMOTE_SCOPE_INCOMPLETE');
  if (![result.requests, result.payload_bytes_received, result.errors, result.repeated_operation_submissions].every(value => Number.isFinite(value) && value >= 0)) throw new Error('RUN_OBSERVATION_INCOMPLETE');
  if (!Number.isFinite(result.duration_ms) || result.duration_ms > CERTIFICATION_LIMITS.duration_ms || result.requests > CERTIFICATION_LIMITS.requests || result.payload_bytes_received > CERTIFICATION_LIMITS.received_bytes || !Number.isFinite(result.heap_peak_observed_bytes) || result.heap_peak_observed_bytes > CERTIFICATION_LIMITS.heap_bytes) throw new Error('RUN_LIMIT_EXCEEDED');
  return result;
}

export function summarizeCertification(reports) {
  if (reports.length !== 5 || reports.some(r => r.benchmark_baseline_sha !== INTEGRATED_BASELINE_SHA || r.harness_sha256 !== reports[0].harness_sha256)) throw new Error('CERTIFICATION_SERIES_INCOMPLETE');
  return summarize(reports.map(r => assertCertifiedRun(r, 1000).duration_ms));
}
