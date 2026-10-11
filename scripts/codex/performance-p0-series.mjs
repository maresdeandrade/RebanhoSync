import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { summarize } from './performance-contract.mjs';

// Storage-only series: no database credentials, backend or product configuration.
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'test-results/f24-6', `p0-native-${randomUUID()}.json`);
mkdirSync(resolve(root, 'test-results/f24-6'), { recursive: true });
const report = { started_at: new Date().toISOString(), points: [], status: 'RUNNING' };
const save = () => writeFileSync(output, JSON.stringify(report, null, 2));
const points = [];
for (const [animals, events] of [[1000,10000],[10000,100000],[50000,500000]])
  for (const mode of ['cold','warm']) points.push({ workload: 'indexeddb', animals, events, farms: 2, mode });
for (const gestures of [100,1000,10000])
  for (const farms of [2,5]) points.push({ workload: 'queue', animals: 1000, events: 10000, gestures, farms, mode: 'warm' });
for (const point of points) {
  console.log(JSON.stringify({ phase: 'point', ...point }));
  const args = ['scripts/codex/performance-baseline.mjs','--runs','5','--purpose','benchmark', ...Object.entries(point).flatMap(([key,value]) => [`--${key}`, String(value)])];
  const result = await new Promise(done => {
    const task = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    let stdout = '';
    task.stdout.on('data', chunk => { stdout += chunk; for (const line of chunk.toString().split(/\r?\n/)) if (line.startsWith('HARNESS_RUN_COMPLETE')) console.log(line); });
    task.stderr.on('data', () => {});
    task.on('error', () => done({ code: -1, stdout }));
    task.on('close', code => done({ code, stdout }));
  });
  const entry = { ...point, exit: result.code };
  try {
    const receipt = JSON.parse(result.stdout.split(/\r?\n/).findLast(line => line.startsWith('{"status":')));
    entry.artifact = receipt.output; entry.evidence = JSON.parse(readFileSync(receipt.output, 'utf8'));
    entry.classification = result.code === 0 && entry.evidence.results.length === 5 ? 'PROVEN_OK' : 'LIMIT_NOT_PROVEN';
    if (entry.evidence.results.length) entry.distribution = summarize(entry.evidence.results.map(x => x.duration_ms));
  } catch { entry.classification = 'ENVIRONMENT_LIMITATION'; entry.failure = 'ARTIFACT_UNAVAILABLE'; }
  report.points.push(entry); save();
  console.log(JSON.stringify({ phase: 'point_complete', ...point, classification: entry.classification, artifact: entry.artifact }));
  if (result.code !== 0) { report.status = 'PARTIAL'; break; }
}
report.status = report.status === 'PARTIAL' ? 'PARTIAL' : 'CHARACTERIZED'; report.finished_at = new Date().toISOString(); save();
console.log(JSON.stringify({ status: report.status, output }));
