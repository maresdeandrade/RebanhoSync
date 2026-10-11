import { createHash } from 'node:crypto';

export const DIAGNOSTIC_LIMITS = { duration_ms: 240000, requests: 4000, received_bytes: 600 * 1048576, heap_bytes: 512 * 1048576 };
export const identity = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value) ? value : null;
const code = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : null;
export function transportCode(value) {
  return typeof value === 'string' ? value.match(/(?:net::)?(ERR_[A-Z_]+)/)?.[1] ?? 'TRANSPORT_OTHER' : 'TRANSPORT_UNKNOWN';
}
export function receiptSummary(body) {
  const value = JSON.parse(body);
  return { client_tx_id: identity(value.client_tx_id), results: Array.isArray(value.results) ? value.results.map(r => ({ op_id: identity(r.op_id), status: code(r.status), reason_code: code(r.reason_code), receipt_present: Boolean(r.receipt) })) : [], error_present: Boolean(value.error) };
}
export const snapshotDigest = body => createHash('sha256').update(body).digest('hex');

// Applied only to Vite's in-memory diagnostic harness, never saved to src.
export function diagnosticTransform(source, id) {
  if (id.replaceAll('\\', '/').endsWith('src/lib/offline/pull.ts')) {
    const start = source.indexOf('export const pullDataForFarm = async');
    const end = source.indexOf('\n};', start) + 3;
    if (start < 0 || end < start) throw new Error('DIAGNOSTIC_PULL_ANCHOR_MISSING');
    let block = source.slice(start, end).replace('export const pullDataForFarm', 'const diagnosticOriginalPull');
    block = block.replace('// 3. Write in a single transaction', 'const diagnosticInstallStart = performance.now();\n  // 3. Write in a single transaction');
    const ending = block.lastIndexOf('\n};');
    block = block.slice(0, ending) + '\n  globalThis.__f24Diagnostic?.event("indexeddb_installation", { duration_ms: performance.now() - diagnosticInstallStart });' + block.slice(ending);
    return source.slice(0, start) + block + '\nexport const pullDataForFarm = (...args: Parameters<typeof diagnosticOriginalPull>) => globalThis.__f24Diagnostic ? globalThis.__f24Diagnostic.span("pull", () => diagnosticOriginalPull(...args), { tables: args[1] ?? [], origin: new Error().stack?.includes("syncWorker") ? "syncWorker" : "harness_or_reconciliation" }) : diagnosticOriginalPull(...args);\n' + source.slice(end);
  }
  if (id.replaceAll('\\', '/').endsWith('src/lib/offline/syncWorker.ts')) {
    const start = source.indexOf('    if (allApplied) {');
    const end = source.indexOf('      await recordAcknowledgementIfCommitted', start);
    if (start < 0 || end < start) throw new Error('DIAGNOSTIC_ACK_ANCHOR_MISSING');
    const block = source.slice(start, end).replace('let ackCommitted = false;', 'let ackCommitted = false; const diagnosticAckStart = performance.now();');
    return source.slice(0, start) + block + '      globalThis.__f24Diagnostic?.event("ack_installation", { duration_ms: performance.now() - diagnosticAckStart, committed: ackCommitted });\n' + source.slice(end);
  }
  return null;
}
