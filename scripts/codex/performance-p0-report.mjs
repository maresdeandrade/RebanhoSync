import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { summarize } from './performance-contract.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifactRoot = join(root, 'test-results/f24-6');
const read = input => {
  const path = resolve(root, input);
  if (!path.startsWith(artifactRoot + '/') && !path.startsWith(artifactRoot + '\\')) throw new Error('LOCAL_ARTIFACT_REQUIRED');
  return { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), data: JSON.parse(readFileSync(path, 'utf8')) };
};
const native = read(process.argv[2]); const backend = read(process.argv[3]);
const metric = (rows, key) => { const values = rows.map(x => x[key]).filter(x => typeof x === 'number' && Number.isFinite(x)); return values.length ? summarize(values) : null; };
function point(label, rows, attempts, classification, artifacts, failures = []) {
  for (const row of rows) {
    if (row.rows_expected !== row.rows_installed || !row.isolation_verified || !row.cleanup.indexeddb_deleted) throw new Error('INTEGRITY_NOT_PROVEN');
    if (label.startsWith('Reconnect') && (row.backlog_after || row.reconciliation_obligations_remaining || !row.cleanup.fixture_farms_deleted || !row.cleanup.fixture_user_deleted)) throw new Error('FLOW_INTEGRITY_NOT_PROVEN');
  }
  return { label, complete_runs: rows.length, attempts, classification, artifacts, failures,
    metrics: Object.fromEntries(['duration_ms','indexeddb_transaction_duration_ms','queue_selection_duration_ms','heap_before_bytes','heap_after_bytes','cpu_task_duration_ms','gestures','operations','queue_serialized_bytes','rows_expected','rows_installed','ack_duration_upper_bound_ms','convergence_duration_ms','requests','payload_bytes_sent','payload_bytes_received','rows_received_total','errors','timeouts','repeated_operation_submissions','backlog_before','backlog_after','reconciliation_obligations_remaining'].map(key => [key, metric(rows, key)])),
  };
}
const points = native.data.points.map(x => point(`${x.workload === 'indexeddb' ? 'IDB' : 'Queue'} ${x.workload === 'indexeddb' ? `${x.animals}/${x.events}` : x.gestures} F${x.farms} ${x.mode}`, x.evidence.results, 5, x.classification, [x.artifact]));
for (const series of backend.data.reconnect_series) {
  const complete = series.runs.filter(x => x.exit === 0 && x.evidence.status === 'PROOF_PASSED');
  const failures = series.runs.filter(x => x.exit !== 0).map(x => ({ artifact: x.artifact, code: x.evidence?.failure_code, wire: x.evidence?.active_run?.wire, status: x.evidence?.status }));
  points.push(point(`Reconnect ${series.gestures} F2 warm`, complete.flatMap(x => x.evidence.results), series.runs.length, complete.length === 5 ? 'PROVEN_OK' : 'LIMIT_NOT_PROVEN', series.runs.map(x => x.artifact), failures));
}
if (!backend.data.reconnect_series.some(x => x.gestures === 10000)) points.push(point('Reconnect 10000 F2 warm', [], 0, 'LIMIT_NOT_PROVEN', [], [{ code: 'PREVIOUS_LEVEL_NOT_COMPLETE' }]));
const report = { status: 'PARTIAL / BLOCKED_WITH_REASON', sources: [native, backend].map(({ path, sha256 }) => ({ path, sha256 })), points,
  shared_unchanged: backend.data.shared_schema_history_unchanged && backend.data.preexisting_resources_unchanged,
  backend_cleanup: backend.data.cleanup_verified,
};
const out = join(artifactRoot, 'f24-6a1-analysis.json'); writeFileSync(out, JSON.stringify(report, null, 2));
const value = (p, key, scale = 1) => p.metrics[key] ? (p.metrics[key].median_ms / scale).toFixed(1) : '—';
const range = (p,key,scale=1) => p.metrics[key] ? `${(p.metrics[key].min_ms/scale).toFixed(1)}–${(p.metrics[key].max_ms/scale).toFixed(1)}` : '—';
let md = '| Ponto | completos/tentados | mediana ms | min–max ms | MAD ms | tx/seleção ms | heap antes→depois MiB | linhas / gestos / ops selecionados | erros completos+falha | classe |\n|---|---:|---:|---:|---:|---:|---|---|---|---|\n';
for (const p of points) md += `| ${p.label} | ${p.complete_runs}/${p.attempts} | ${value(p,'duration_ms')} | ${range(p,'duration_ms')} | ${p.metrics.duration_ms?.median_absolute_deviation_ms.toFixed(1) ?? '—'} | ${value(p,p.label.startsWith('Queue')?'queue_selection_duration_ms':'indexeddb_transaction_duration_ms')} | ${value(p,'heap_before_bytes',1048576)}→${value(p,'heap_after_bytes',1048576)} | ${value(p,'rows_installed')} / ${value(p,'gestures')} / ${value(p,'operations')} | ${value(p,'errors')} + ${p.failures.reduce((n,x)=>n+(x.wire?.errors??0),0)} | ${p.classification} |\n`;
md += '\n| Reconnect | ACK upper bound mediana ms | convergência mediana ms | requests/run | enviado/recebido MiB mediana | linhas recebidas/run | reenvios | backlog final / obrigações |\n|---|---:|---:|---:|---|---:|---:|---|\n';
for (const p of points.filter(x => x.label.startsWith('Reconnect'))) md += `| ${p.label} | ${value(p,'ack_duration_upper_bound_ms')} | ${value(p,'convergence_duration_ms')} | ${value(p,'requests')} | ${value(p,'payload_bytes_sent',1048576)} / ${value(p,'payload_bytes_received',1048576)} | ${value(p,'rows_received_total')} | ${value(p,'repeated_operation_submissions')} | ${value(p,'backlog_after')} / ${value(p,'reconciliation_obligations_remaining')} |\n`;
writeFileSync(join(artifactRoot,'f24-6a1-tables.md'),md);
console.log(md); console.log(JSON.stringify({ output: out, complete_runs: points.reduce((n,x)=>n+x.complete_runs,0), attempts: points.reduce((n,x)=>n+x.attempts,0), shared_unchanged: report.shared_unchanged, cleanup: report.backend_cleanup }));
