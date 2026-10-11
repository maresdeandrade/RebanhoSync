import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { receiptSummary, transportCode, diagnosticTransform, DIAGNOSTIC_LIMITS } from '../../scripts/codex/performance-diagnostics.mjs';

test('exports only receipt identities/status and excludes sensitive fields', () => {
  const tx = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const result = receiptSummary(JSON.stringify({ client_tx_id: tx, token: 'secret', results: [{ op_id: tx, status: 'APPLIED', reason_code: 'secret message', receipt: { animal: 'sensitive' }, record: { password: 'secret' } }] }));
  assert.equal(result.client_tx_id, tx); assert.equal(result.results[0].receipt_present, true);
  assert.equal(result.results[0].reason_code, null); assert.ok(!JSON.stringify(result).includes('secret')); assert.ok(!JSON.stringify(result).includes('sensitive'));
  assert.throws(() => receiptSummary('{'));
});
test('transport codes sanitized and bounded reproduction excludes 10k', () => {
  assert.equal(transportCode('net::ERR_CONNECTION_RESET token=secret'), 'ERR_CONNECTION_RESET');
  assert.equal(transportCode('private text'), 'TRANSPORT_OTHER');
  assert.equal(DIAGNOSTIC_LIMITS.requests, 4000); assert.equal(DIAGNOSTIC_LIMITS.duration_ms, 240000);
});
test('in-memory observation anchors match integrated sources and unrelated modules stay untouched', () => {
  for (const name of ['pull','syncWorker']) {
    const path = `src/lib/offline/${name}.ts`; const transformed = diagnosticTransform(readFileSync(path,'utf8'),path);
    assert.ok(transformed.includes('__f24Diagnostic')); assert.ok(transformed.includes(name === 'pull' ? 'indexeddb_installation' : 'ack_installation'));
  }
  assert.equal(diagnosticTransform('export const x=1','src/other.ts'),null);
});
