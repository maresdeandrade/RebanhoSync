import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyABEquivalence } from './performance-ab-equivalence.mjs';
import { summarize } from './performance-contract.mjs';
const root = resolve(import.meta.dirname, '../..');
const certification = resolve(process.argv[2]);
const certificate = JSON.parse(readFileSync(certification, 'utf8'));
if (!certificate.cleanup_verified || !certificate.preexisting_resources_unchanged || !certificate.shared_schema_history_unchanged) throw new Error('ENVIRONMENT_INTEGRITY_NOT_PROVEN');
const proof = certificate.post_ack_series.find(s => s.proof && !s.controlled_seed)?.evidence.post_ack_proof;
if (proof?.status !== 'PASS' || Object.values(proof.checks).some(v => v !== 'PASS')) throw new Error('FUNCTIONAL_PROOF_NOT_PASSED');
const sum = (events, key) => events.reduce((total, event) => total + (event[key] ?? 0), 0);
const stats = values => {
  const s = summarize(values);
  return { samples: s.sample_count, median: s.median_ms, min: s.min_ms, max: s.max_ms, mad: s.median_absolute_deviation_ms, range: s.range_ms, p95: s.p95_ms, p99: s.p99_ms };
};
const attempted = certificate.post_ack_series.filter(s => !s.proof);
const equivalence = certificate.independent_series && attempted.length ? verifyABEquivalence(certificate) : null;
const failures = attempted.filter(s => s.exit !== 0 || s.evidence?.status !== 'PROOF_PASSED').map(s => ({ variant: s.variant, run: s.run, artifact: s.artifact, code: s.evidence?.failure_code ?? s.failure, phase: s.evidence?.active_run?.phase, cleanup: s.evidence?.failure_cleanup, diagnostic_available: Boolean(s.evidence?.active_run?.diagnostic), failure_detail: s.evidence?.failure_detail, seed_diagnosis: s.evidence?.active_run?.seed_diagnosis, classification: 'LIMIT_NOT_PROVEN; failure preserved; no ACK inference from seed failure' }));
const rows = attempted.filter(s => s.exit === 0 && s.evidence.status === 'PROOF_PASSED').map(series => {
  const run = series.evidence.results[0];
  const events = run.diagnostic.browser.events;
  const network = run.diagnostic.network;
  const acks = events.filter(e => e.stage === 'ack_installation' && e.committed);
  const terminals = events.filter(e => e.stage === 'gesture_terminal');
  const receipts = network.filter(e => e.endpoint === '/functions/v1/sync-batch' && e.stage === 'http_response');
  if (series.exit !== 0 || series.evidence.status !== 'PROOF_PASSED' || run.gestures !== 100 ||
    run.operations !== 100 || run.backlog_after !== 0 || run.reconciliation_obligations_remaining !== 0 ||
    run.errors !== 0 || run.timeouts !== 0 || run.retry_counter_after_processing !== 0 ||
    run.repeated_operation_submissions !== 0 || run.rows_installed !== run.rows_expected ||
    !run.isolation_verified || !['indexeddb_deleted', 'fixture_farms_deleted', 'fixture_user_deleted'].every(key => run.cleanup?.[key] === true) ||
    acks.length !== 100 || terminals.length !== 100 || receipts.length !== 100 ||
    terminals.some(e => e.status !== 'DONE' || e.operation_statuses.length !== 1 || e.operation_statuses[0].status !== 'APPLIED') ||
    receipts.some(e => e.http_status !== 200 || e.receipt.results.length !== 1 || e.receipt.results[0].status !== 'APPLIED')) throw new Error('RUN_INTEGRITY_NOT_PROVEN');
  const pulls = events.filter(e => e.stage === 'pull_end');
  const pullResponses = network.filter(e => e.stage === 'http_response' && e.endpoint.startsWith('/rest/v1/'));
  return {
    variant: series.variant, run: series.run, artifact: series.artifact,
    seed_duration_ms: run.phase_timings.seed_and_preparation_ms, seed_observer_node_ms: run.seed_diagnosis?.observer_ms ?? 0,
    ack_installed_observed_from_diagnostic_start_ms: Math.max(...acks.map(e => e.at_ms)),
    duration_ms: run.duration_ms, ack_upper_bound_ms: run.ack_duration_upper_bound_ms,
    convergence_ms: run.convergence_duration_ms, requests: run.requests,
    sent_bytes: run.payload_bytes_sent, received_bytes: run.payload_bytes_received,
    animal_rows_received: run.rows_received_total, all_pull_rows: sum(pullResponses, 'rows'),
    pull_calls: pulls.length, inline_pulls: pulls.filter(e => e.client_tx_id).length,
    pull_responses: pullResponses.length, pull_bytes: sum(pullResponses, 'response_bytes'),
    pull_duration_ms: sum(pulls, 'duration_ms'), ack_installation_ms: sum(acks, 'duration_ms'),
    installation_ms: sum(events.filter(e => e.stage === 'indexeddb_installation'), 'duration_ms'),
    reconciliation_ms: sum(events.filter(e => e.stage === 'reconciliation'), 'duration_ms'),
    observed_receipts: receipts.length, committed_acks: acks.length, operations: run.operations,
    heap_before_bytes: run.heap_before_bytes, heap_after_bytes: run.heap_after_bytes,
    cpu_task_ms: run.cpu_task_duration_ms, observer_node_ms: run.diagnostic.observer_cost_ms,
    observer_browser_ms: run.diagnostic.browser.overhead_ms, timeouts: run.timeouts, errors: run.errors,
    retries: run.retry_counter_after_processing, backlog_after: run.backlog_after,
    obligations_after: run.reconciliation_obligations_remaining,
  };
});
const variants = Object.fromEntries(['original', 'optimized'].map(variant => {
  const samples = rows.filter(r => r.variant === variant);
  if (samples.length === 0) return [variant, { samples: 0 }];
  return [variant, Object.fromEntries(Object.keys(samples[0]).filter(k => typeof samples[0][k] === 'number' && k !== 'run').map(k => [k, stats(samples.map(s => s[k]))]))];
}));
const preserved = JSON.parse(readFileSync(resolve(root, 'test-results/f24-6/f24-6a1-d-preserved-manifest.json'), 'utf8')).map(entry => ({ ...entry, unchanged: createHash('sha256').update(readFileSync(resolve(root, entry.path))).digest('hex') === entry.sha256 }));
if (preserved.some(p => !p.unchanged)) throw new Error('ORIGINAL_ARTIFACT_CHANGED');
const e2Preserved = certificate.independent_series ? JSON.parse(readFileSync(resolve(root, 'test-results/f24-6/f24-6a1-e2-preserved-manifest.json'), 'utf8')).map(entry => ({ ...entry, unchanged: createHash('sha256').update(readFileSync(resolve(root, entry.path))).digest('hex') === entry.sha256 })) : null;
if (e2Preserved?.some(p => !p.unchanged)) throw new Error('E2_PREEXISTING_ARTIFACT_CHANGED');
const output = resolve(root, certificate.independent_series ? 'test-results/f24-6/f24-6a1-e2-analysis.json' : 'test-results/f24-6/f24-6a1-e1-analysis.json');
if (certificate.independent_series && rows.some(row => !attempted.find(s => s.artifact === row.artifact)?.evidence.independent_series)) throw new Error('SERIES_PROVENANCE_MISSING');
const complete = failures.length === 0 && ['original', 'optimized'].every(v => rows.filter(r => r.variant === v).length === 5);
writeFileSync(output, JSON.stringify({ decision: complete ? 'READY_FOR_REVIEW' : 'PARTIAL / BLOCKED_WITH_REASON', independent_series: certificate.independent_series ?? null, equivalence, certification, project: certificate.project, functional_proof: proof, variants, rows, failures, not_executed: { original: 5 - attempted.filter(s => s.variant === 'original').length, optimized: 5 - attempted.filter(s => s.variant === 'optimized').length }, preserved, e2_preserved: e2Preserved, constraints: { five_complete_runs_per_variant: complete, physical_ack_latency: 'NOT_MEASURED', heap_peak_total: 'NOT_MEASURED', instrumented_only: true, reconnect_1k: 'NOT_CERTIFIED', original_ack_cause: 'LIMIT_NOT_PROVEN', requests_reduction: 'NOT_EXPECTED; agenda and full drains preserved' } }, null, 2));
console.log(JSON.stringify({ output, complete, rows: rows.length, failures, medians: Object.fromEntries(Object.entries(variants).map(([key, value]) => [key, { duration_ms: value.duration_ms, received_bytes: value.received_bytes, animal_rows: value.animal_rows_received }])) }));
