import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../..'); const artifactRoot = join(root, 'test-results/f24-6');
const path = resolve(root, process.argv[2]);
if (!path.startsWith(artifactRoot + '/') && !path.startsWith(artifactRoot + '\\')) throw new Error('LOCAL_ARTIFACT_REQUIRED');
const certification = JSON.parse(readFileSync(path, 'utf8'));
const sum = (rows, key) => rows.reduce((n, row) => n + (row[key] ?? 0), 0);
const summary = { source: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), points: [] };
for (const series of certification.reconnect_series) {
  const evidence = series.runs[0]?.evidence; if (!evidence) continue;
  const completed = evidence.results[0]; const d = completed?.diagnostic ?? evidence.active_run?.diagnostic;
  if (!d) { summary.points.push({ kind: series.kind, duration_ms: completed?.duration_ms, instrumented: false }); continue; }
  const events = d.browser.events; const net = d.network;
  const stages = name => events.filter(e => e.stage === name);
  const animals = net.filter(e => e.endpoint === '/rest/v1/animais' && e.rows !== undefined);
  const pulls = net.filter(e => e.endpoint.startsWith('/rest/v1/') && e.http_status !== undefined);
  const batches = net.filter(e => e.endpoint === '/functions/v1/sync-batch' && e.http_status !== undefined);
  const inline = stages('pull_end').filter(e => e.client_tx_id);
  const terminal = stages('gesture_terminal');
  const duration = completed?.duration_ms ?? Math.max(...events.map(e => e.at_ms ?? 0));
  summary.points.push({ kind: series.kind, instrumented: true, failure_code: evidence.failure_code ?? null, duration_observed_ms: duration,
    confirmed_gestures: terminal.filter(e => e.status === 'DONE').length, last_terminal: terminal.at(-1), cleanup: completed?.cleanup ?? evidence.failure_cleanup,
    phase_totals_ms: { gesture_processing: sum(terminal,'duration_ms'), batch_request_to_headers: sum(batches,'request_to_headers_ms'), batch_request_to_observed_body: sum(batches,'request_to_body_ms'), ack_installation: sum(stages('ack_installation'),'duration_ms'), inline_pull: sum(inline,'duration_ms'), all_pull: sum(stages('pull_end'),'duration_ms'), indexeddb_installation: sum(stages('indexeddb_installation'),'duration_ms'), pull_http_request_to_observed_body: sum(pulls,'request_to_body_ms'), final_reconciliation: sum(stages('reconciliation'),'duration_ms') },
    inline_pull_fraction_of_observed_duration: sum(inline,'duration_ms') / duration,
    pull_calls: stages('pull_end').length, inline_pull_calls: inline.length, pull_http_requests: pulls.length, pull_bytes: sum(pulls,'response_bytes'), animal_rows: sum(animals,'rows'), unchanged_rows: sum(animals,'unchanged_rows'), changed_or_new_rows: sum(animals,'changed_or_new_rows'), comparable_snapshots: animals.filter(e=>e.previous_snapshot_present).length,
    exact_repeated_snapshot_responses: animals.filter((e,i)=>animals.slice(0,i).some(old=>old.snapshot_sha256===e.snapshot_sha256)).length,
    batch_requests_observed: batches.length, batch_results: batches.flatMap(e=>e.receipt?.results ?? []).reduce((m,r)=>(m[r.status ?? 'UNKNOWN']=(m[r.status ?? 'UNKNOWN']??0)+1,m),{}), observer_node_ms: d.observer_cost_ms, observer_browser_ms: d.browser.overhead_ms,
    failures: net.filter(e=>e.stage==='transport_failure'||e.stage==='body_observation_failure'||e.parse_error||e.http_status>=400), wire: completed ? Object.fromEntries(['requests','errors','timeouts','repeated_operation_submissions','payload_bytes_received'].map(k=>[k,completed[k]])) : evidence.active_run.wire,
  });
}
summary.preserved_artifacts_unchanged = JSON.parse(readFileSync(join(artifactRoot,'f24-6a1-d-preserved-manifest.json'))).every(e=>createHash('sha256').update(readFileSync(join(root,e.path))).digest('hex')===e.sha256);
summary.cleanup_verified = certification.cleanup_verified; summary.shared_unchanged = certification.shared_schema_history_unchanged && certification.preexisting_resources_unchanged;
const out = join(artifactRoot,'f24-6a1-d-analysis.json');writeFileSync(out,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary.points.map(p=>({...p,last_terminal:undefined})),null,2));
console.log(JSON.stringify({output:out,preserved:summary.preserved_artifacts_unchanged,cleanup:summary.cleanup_verified,shared_unchanged:summary.shared_unchanged}));
