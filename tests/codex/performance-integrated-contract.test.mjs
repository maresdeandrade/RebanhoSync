import { test } from 'vitest';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASELINE_SHA, parseOptions } from '../../scripts/codex/performance-contract.mjs';
import { INTEGRATED_BASELINE_SHA, selectBaseline, assertFrozenProduct, certificationSpecifications, assertOperationalBudget, withDeadline, assertCertifiedRun, summarizeCertification, edgeHandlerReady, cleanupOwnedIndexedDB, verifyRemoteFixture } from '../../scripts/codex/performance-integrated-contract.mjs';

const options = { baseline: 'integrated', workload: 'reconnect', mode: 'warm', purpose: 'benchmark', gestures: 1000, animals: 1000, farms: 2, runs: 1 };
const env = { REBANHOSYNC_ACK_DIAGNOSIS: '1' };

test('explicit integrated adoption preserves historical default and E1/E2 manifest contract', () => {
  assert.equal(BASELINE_SHA, '3b3bc96db331c2917167cf8370024332f505d9f7');
  assert.equal(selectBaseline(parseOptions([])), BASELINE_SHA);
  assert.equal(selectBaseline(options, env), INTEGRATED_BASELINE_SHA);
  assert.equal(selectBaseline({ ...options, gestures: 10, animals: 10 }, env), INTEGRATED_BASELINE_SHA);
  assert.throws(() => parseOptions(['--baseline', INTEGRATED_BASELINE_SHA]), /INVALID_BASELINE/);
  const harness = readFileSync('scripts/codex/performance-baseline.mjs', 'utf8');
  assert.ok(harness.includes('f24-6a1-e1-patch-manifest.json'));
  assert.ok(harness.includes('PATCH_HASH_CHANGED'));
  assert.ok(harness.includes('patchManifest.baseline !== BASELINE_SHA'));
});

test('integrated mode rejects 10k, A/B, uncontrolled workloads and missing instrumentation', () => {
  for (const override of [{ gestures: 10000, animals: 10000 }, { gestures: 100 }, { workload: 'pull' }, { farms: 3 }, { runs: 5 }, { mode: 'cold' }, { purpose: 'proof' }]) assert.throws(() => selectBaseline({ ...options, ...override }, env), /INTEGRATED_RECONNECT_ONLY/);
  for (const key of ['REBANHOSYNC_POST_ACK_VARIANT', 'REBANHOSYNC_POST_ACK_PROOF', 'REBANHOSYNC_SEED_AB_SERIES', 'REBANHOSYNC_CONTROLLED_SEED_FAILURE', 'REBANHOSYNC_CONTROLLED_TRANSPORT_FAILURE']) assert.throws(() => selectBaseline(options, { ...env, [key]: '1' }), /VARIANT_NOT_ALLOWED/);
  assert.throws(() => selectBaseline(options), /OBSERVATION_REQUIRED/);
  for (const args of [[], ['--p0-reconnect'], ['--integrated-reconnect-1k', '--post-ack-comparison'], ['--integrated-reconnect-1k', '--p0-reconnect']]) assert.throws(() => certificationSpecifications(args), /EXCLUSIVE/);
  const specs = certificationSpecifications(['--integrated-reconnect-1k']);
  assert.deepEqual(specs.map(s => s.gestures), [10, 1000, 1000, 1000, 1000, 1000]);
});

test('real git guards reject staged, unstaged, committed and ignored product changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'f24-frozen-'));
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = () => git(['-c', 'user.name=Harness test', '-c', 'user.email=harness@example.test', 'commit', '-m', 'fixture']);
  try {
    git(['init']); mkdirSync(join(directory, 'src'));
    writeFileSync(join(directory, 'src/product.ts'), 'baseline');
    writeFileSync(join(directory, '.gitignore'), 'src/ignored.ts\n');
    git(['add', '.']); commit(); const baseline = git(['rev-parse', 'HEAD']);
    assertFrozenProduct(git, baseline, baseline);
    writeFileSync(join(directory, 'src/product.ts'), 'changed');
    assert.throws(() => assertFrozenProduct(git, baseline, baseline), /PRODUCT_PATCH_NOT_ALLOWED/);
    git(['add', '.']); assert.throws(() => assertFrozenProduct(git, baseline, baseline), /PRODUCT_PATCH_NOT_ALLOWED/);
    commit(); assert.throws(() => assertFrozenProduct(git, baseline, git(['rev-parse', 'HEAD'])), /REBASELINE_REQUIRED/);
    const fresh = git(['rev-parse', 'HEAD']);
    writeFileSync(join(directory, 'src/ignored.ts'), 'ignored source');
    assert.throws(() => assertFrozenProduct(git, fresh, fresh), /UNTRACKED_PRODUCT/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('all operational budgets reject overflow and invalid observation', () => {
  assertOperationalBudget({ duration_ms: 240000, requests: 4000, received_bytes: 600 * 1048576, heap_bytes: 512 * 1048576 });
  for (const [key, value] of Object.entries({ duration_ms: 240001, requests: 4001, received_bytes: 600 * 1048576 + 1, heap_bytes: 512 * 1048576 + 1 })) assert.throws(() => assertOperationalBudget({ [key]: value }), /LIMIT/);
  assert.throws(() => assertOperationalBudget({ heap_bytes: NaN }), /LIMIT/);
});

test('deadline interrupts a hanging workload and finally cleanup runs once', async () => {
  let interrupts = 0, cleanups = 0;
  try { await assert.rejects(withDeadline(() => new Promise(() => {}), 15, async () => { interrupts++; }), /DURATION_MS_LIMIT/); }
  finally { cleanups++; }
  assert.equal(interrupts, 1); assert.equal(cleanups, 1);
  assert.equal(await withDeadline(async () => 'complete', 30, async () => { interrupts++; }), 'complete');
  assert.equal(interrupts, 1);
});

test('gateway 401 and upstream failures do not satisfy handler readiness', () => {
  assert.equal(edgeHandlerReady(401, { message: 'Missing authorization header' }), false);
  assert.equal(edgeHandlerReady(502, { message: 'An invalid response was received from the upstream server' }), false);
  assert.equal(edgeHandlerReady(401, { error: 'Unauthorized - invalid JWT' }), true);
});

test('interrupted real browser deletes and verifies its owned IndexedDB', async () => {
  const server = createServer((_, response) => response.end('<!doctype html><title>Owned cleanup</title>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const url = `http://127.0.0.1:${server.address().port}`;
    const page = await context.newPage(); await page.goto(url);
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('RebanhoSync', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('owned');
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = reject;
      });
    });
    await assert.rejects(withDeadline(() => page.evaluate(() => new Promise(() => {})), 30, () => page.close()), /DURATION_MS_LIMIT/);
    const cleanupPage = await cleanupOwnedIndexedDB(context, url);
    assert.equal(await cleanupPage.evaluate(async () => (await indexedDB.databases()).some(db => db.name === 'RebanhoSync')), false);
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

const validReport = () => ({ benchmark_baseline_sha: INTEGRATED_BASELINE_SHA, harness_sha256: 'frozen', status: 'PROOF_PASSED', cleanup_completed: true, results: [{ gestures: 1000, operations: 1000, ack_confirmed: 1000, backlog_after: 0, reconciliation_obligations_remaining: 0, isolation_verified: true, remote_verification: { verified: true, animals: 1000, agenda: 0, unique_operations: 1000, unique_transactions: 1000, farms: [{ animals: 500 }, { animals: 500 }] }, local_convergence_verified: true, errors: 0, repeated_operation_submissions: 0, cleanup: { indexeddb_deleted: true, fixture_farms_deleted: true, fixture_user_deleted: true }, duration_ms: 100, requests: 3002, payload_bytes_received: 1000, heap_peak_observed_bytes: 1000 }] });

test('PG bigint revisions converge with browser numbers without tolerating duplicate updates or cross-farm rows', () => {
  const remote = [{ id: 'a', fazenda_id: 'farm-a', revision: '2', observacoes: 'F24.6 benchmark updated', client_op_id: 'op-a', client_tx_id: 'tx-a' }, { id: 'b', fazenda_id: 'farm-b', revision: '2', observacoes: 'F24.6 benchmark updated', client_op_id: 'op-b', client_tx_id: 'tx-b' }];
  const input = { initial: [{ id: 'a', revision: '1' }, { id: 'b', revision: '1' }], animals: remote.map(({ id, fazenda_id }) => ({ id, fazenda_id })), remote, localRows: remote.map(a => ({ ...a, revision: 2 })), agenda: 0, farms: ['farm-a', 'farm-b'] };
  assert.equal(verifyRemoteFixture(input).verified, true);
  for (const patch of [{ revision: '3' }, { revision: '9007199254740992' }, { fazenda_id: 'farm-b' }, { client_op_id: 'op-b' }, { observacoes: 'old value' }]) {
    const altered = structuredClone(input); Object.assign(altered.remote[0], patch); assert.throws(() => verifyRemoteFixture(altered));
  }
  const localMismatch = structuredClone(input); localMismatch.localRows[0].revision = 1;
  assert.throws(() => verifyRemoteFixture(localMismatch), /CONVERGENCE/);
});

test('partial ACK, cleanup, convergence, duplication or mixed baselines cannot certify', () => {
  assertCertifiedRun(validReport(), 1000);
  for (const override of [{ ack_confirmed: 999 }, { backlog_after: 1 }, { reconciliation_obligations_remaining: 1 }, { isolation_verified: false }, { local_convergence_verified: false }, { remote_verification: { verified: false } }, { errors: 1 }, { repeated_operation_submissions: 1 }, { cleanup: {} }, { heap_peak_observed_bytes: null }, { requests: 4001 }, { requests: undefined }, { payload_bytes_received: undefined }]) {
    const report = validReport(); Object.assign(report.results[0], override); assert.throws(() => assertCertifiedRun(report, 1000));
  }
  assert.throws(() => summarizeCertification(Array.from({ length: 4 }, validReport)), /INCOMPLETE/);
  const reports = Array.from({ length: 5 }, validReport);
  assert.equal(summarizeCertification(reports).p95_ms, null);
  reports[4].benchmark_baseline_sha = BASELINE_SHA; assert.throws(() => summarizeCertification(reports), /INCOMPLETE/);
});
