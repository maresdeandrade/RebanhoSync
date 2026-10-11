import { execFileSync, spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import net from 'node:net';
import pg from 'pg';
import { readLocalConnection } from './performance-local-fixture.mjs';

// Own project only. CLI credentials and child output stay in memory.
const root = resolve(import.meta.dirname, '../..');
const p0Reconnect = process.argv.includes('--p0-reconnect');
const ackDiagnosis = process.argv.includes('--ack-diagnosis');
const seedAB = process.argv.includes('--seed-ab-comparison');
const postAckComparison = seedAB || process.argv.includes('--post-ack-comparison');
const postAckProofOnly = process.argv.includes('--post-ack-proof');
const postAckRun = postAckComparison || postAckProofOnly;
const supabaseCli = process.env.REBANHOSYNC_SUPABASE_CLI ?? 'supabase';
process.chdir(root);
const project = `f24-6a0b-${randomUUID().slice(0, 8)}`;
const directory = join(root, 'test-results/f24-6', project);
mkdirSync(directory, { recursive: true });
const report = { independent_series: seedAB ? `F24_6A1_E2-${project}` : null, project, directory, started_at: new Date().toISOString(), ports: [55320, 55321, 55322, 55323, 55324, 55325, 55327, 55329, 55383], steps: {} };
report.harness_sources = Object.fromEntries(['performance-isolated-backend.mjs', 'performance-baseline.mjs', 'performance-browser.ts', 'performance-contract.mjs', 'performance-local-fixture.mjs', 'performance-diagnostics.mjs', 'performance-seed-diagnostics.mjs', 'performance-post-ack-proof.mjs', 'performance-post-ack-proof.ts'].map(name => [name, createHash('sha256').update(readFileSync(join(root, 'scripts/codex', name))).digest('hex')]));
const save = () => writeFileSync(join(directory, 'certification.json'), JSON.stringify(report, null, 2));
const cli = args => execFileSync(supabaseCli, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const snapshot = () => ({ containers: docker(['ps', '-a', '--format', '{{.ID}}|{{.Names}}|{{.State}}|{{.Ports}}']).split('\n').sort(), volumes: docker(['volume', 'ls', '--format', '{{.Name}}']).split('\n').sort(), networks: docker(['network', 'ls', '--format', '{{.Name}}']).split('\n').sort() });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function schemaFingerprint(connection) {
  const db = new pg.Client({ connectionString: connection.database }); await db.connect();
  try {
    const migrations = (await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x => x.version);
    const tables = (await db.query(`select c.relname,c.relkind,c.relrowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname`)).rows;
    const functions = (await db.query(`select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by signature`)).rows;
    const policies = (await db.query(`select * from pg_policies where schemaname='public' order by tablename,policyname`)).rows;
    const columns = (await db.query(`select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`)).rows;
    const indexes = (await db.query(`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by indexname`)).rows;
    const triggers = (await db.query(`select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname`)).rows;
    const constraints = (await db.query(`select c.conrelid::regclass::text as relation,c.conname,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' order by relation,c.conname`)).rows;
    const databases = (await db.query('select datname from pg_database order by datname')).rows.map(x => x.datname);
    return { migrations, databases, schema_sha256: digest({ tables, functions, policies, columns, indexes, triggers, constraints }) };
  } finally { await db.end(); }
}
function child(command, args, env = process.env) {
  return new Promise(resolveChild => {
    const task = spawn(command, args, { cwd: root, env, windowsHide: true, timeout: 300_000, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    task.stdout.on('data', chunk => { stdout += chunk; }); task.stderr.on('data', chunk => { stderr += chunk; });
    task.on('error', () => resolveChild({ code: -1, stdout, stderr: 'CHILD_START_FAILED' }));
    let exitTimer;
    task.on('close', (code, signal) => { clearTimeout(exitTimer); resolveChild({ code, signal, stdout, stderr }); });
    task.on('exit', (code, signal) => {
      if (signal && process.platform === 'win32' && command === process.execPath && args[0] === 'scripts/codex/performance-baseline.mjs') {
        // The existing 300s executor guard can terminate Node before its finally.
        // Reap only Playwright browser descendants of this exact owned child.
        const script = `$items = @(Get-CimInstance Win32_Process); $owned = @(${task.pid}); do { $next = @($items | Where-Object { $_.ParentProcessId -in $owned -and $_.ProcessId -notin $owned }); $owned += @($next.ProcessId) } while ($next.Count); $browsers = @($items | Where-Object { $_.ProcessId -in $owned -and $_.ExecutablePath -match 'ms-playwright' -and $_.Name -match 'chrome|headless|crashpad' }); foreach ($item in $browsers) { Stop-Process -Id $item.ProcessId -ErrorAction SilentlyContinue }; @($browsers.ProcessId) | ConvertTo-Json -Compress`;
        try { report.timeout_browser_cleanup = execFileSync('powershell.exe', ['-NoProfile','-Command',script], { encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','pipe'] }).trim(); }
        catch { report.timeout_browser_cleanup = 'OWNED_BROWSER_CLEANUP_NOT_VERIFIED'; }
      }
      // Windows shims can leave inherited pipe handles open after exiting.
      exitTimer = setTimeout(() => { task.stdout.destroy(); task.stderr.destroy(); resolveChild({ code, signal, stdout, stderr }); }, 2000);
    });
  });
}
let shared, edge;
try {
  report.git = { branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
  report.before = snapshot();
  shared = readLocalConnection();
  report.shared_before = await schemaFingerprint(shared);
  for (const port of report.ports) await new Promise((ok, fail) => { const server = net.createServer(); server.once('error', () => fail(new Error(`PORT_UNAVAILABLE_${port}`))); server.listen(port, '0.0.0.0', () => server.close(ok)); });
  const source = join(root, 'supabase'); const destination = join(directory, 'supabase'); mkdirSync(destination);
  let config = readFileSync(join(source, 'config.toml'), 'utf8').replace('project_id = "GestaoAgro"', `project_id = "${project}"`);
  for (const port of [54320,54321,54322,54323,54324,54325,54327,54329]) config = config.replaceAll(String(port), String(port + 1000));
  config = config.replace('inspector_port = 8083', 'inspector_port = 55383').replace('[db.seed]\nenabled = true', '[db.seed]\nenabled = false').replace('[db.seed]\r\nenabled = true', '[db.seed]\r\nenabled = false');
  config = config.replace(/^\[local_smtp\]$/m, '[local_smtp]\nport = 55324');
  writeFileSync(join(destination, 'config.toml'), config);
  report.config_sha256 = createHash('sha256').update(config).digest('hex');
  cpSync(join(source, 'migrations'), join(destination, 'migrations'), { recursive: true });
  cpSync(join(source, 'functions'), join(destination, 'functions'), { recursive: true });
  // Edge shares this pure contract with the client; preserve its relative import.
  mkdirSync(join(directory, 'src/lib/animals'), { recursive: true });
  cpSync(join(root, 'src/lib/animals/taxonomyFactsContract.ts'), join(directory, 'src/lib/animals/taxonomyFactsContract.ts'));
  report.edge_shared_contract_sha256 = createHash('sha256').update(readFileSync(join(root, 'src/lib/animals/taxonomyFactsContract.ts'))).digest('hex');
  const migrations = readdirSync(join(source, 'migrations')).filter(x => /^\d+_.*\.sql$/.test(x)).sort();
  report.canonical_migrations = migrations.map(name => ({ name, sha256: createHash('sha256').update(readFileSync(join(source, 'migrations', name))).digest('hex') }));
  if (migrations.length !== 60) throw new Error('CANONICAL_COUNT_NOT_60');
  report.steps.prepare = 'PASS'; save(); console.log(JSON.stringify({ phase: 'start', project, directory }));
  const start = await child(supabaseCli, ['start', '--workdir', directory, '--exclude', 'studio,postgres-meta,realtime,storage-api,imgproxy,logflare,vector,supavisor']);
  report.steps.start_exit = start.code;
  // SQL startup diagnostics contain canonical DDL only; never retain CLI keys.
  if (start.code !== 0) {
    report.start_failure = (start.stderr + '\n' + start.stdout).split(/\r?\n/).filter(line => /ERROR:|Applying migration|SQLSTATE|failed to|Stopping containers|At statement/.test(line)).map(line => line.replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')).slice(-20);
    throw new Error('ISOLATED_START_FAILED');
  }
  process.env.REBANHOSYNC_BENCHMARK_SUPABASE_WORKDIR = directory;
  const connection = readLocalConnection();
  report.isolated = await schemaFingerprint(connection);
  const expected = migrations.map(x => x.split('_')[0]);
  if (JSON.stringify(expected) !== JSON.stringify(report.isolated.migrations)) throw new Error('MIGRATION_HISTORY_NOT_ALIGNED');
  report.created_resources = snapshot();
  report.steps.migration_history = 'ALIGNED'; save(); console.log(JSON.stringify({ phase: 'schema', count: expected.length }));
  const db = new pg.Client({ connectionString: connection.database }); await db.connect();
  try {
    const tables = ['animais','eventos','eventos_movimentacao','animal_lot_movement_receipts','metrics_events','fazendas','user_fazendas'];
    report.rls_inventory = (await db.query(`select c.relname,c.relrowsecurity,(select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1) order by c.relname`, [tables])).rows;
    if (report.rls_inventory.length !== tables.length || report.rls_inventory.some(x => !x.relrowsecurity || !x.policies)) throw new Error('REQUIRED_RLS_MISSING');
    report.function_inventory = (await db.query(`select proname,prosecdef,proconfig,has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('service_role',p.oid,'execute') as service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname=any($1) order by proname`, [['apply_animal_lot_movement_v1','guard_animal_lot_fact_insert_v1','purge_expired_metrics_events','stamp_metrics_server_received_at','resolve_animal_lot_movement_pending_v1']])).rows;
    if (report.function_inventory.length !== 5) throw new Error('REQUIRED_FUNCTION_MISSING');
    const purge = report.function_inventory.find(x => x.proname === 'purge_expired_metrics_events');
    if (purge.prosecdef || purge.authenticated_execute || purge.anon_execute || purge.service_execute) throw new Error('PURGE_PRIVILEGE_CONTRACT_FAILED');
    report.retention = (await db.query(`select column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='metrics_events' and column_name='server_received_at'`)).rows;
    report.retention_index = (await db.query(`select indexdef from pg_indexes where schemaname='public' and indexname='idx_metrics_events_server_received_id'`)).rows;
    report.retention_trigger = (await db.query(`select pg_get_triggerdef(oid) as definition,tgenabled from pg_trigger where tgname='metrics_events_stamp_server_received_at'`)).rows;
    report.cron = (await db.query(`select jobname,schedule,command,username,active from cron.job where jobname='metrics-events-retention-daily'`)).rows;
    if (report.retention.length !== 1 || report.retention[0].is_nullable !== 'NO' || report.retention_index.length !== 1 || report.retention_trigger.length !== 1 || report.retention_trigger[0].tgenabled !== 'O' || report.cron.length !== 1 || report.cron[0].schedule !== '0 3 * * *' || report.cron[0].username !== 'postgres' || !report.cron[0].active) throw new Error('RETENTION_SCHEMA_CONTRACT_FAILED');
    report.steps.schema = 'VERIFIED';
  } finally { await db.end(); }
  writeFileSync(join(directory, 'empty.env'), '');
  edge = spawn(supabaseCli, ['functions', 'serve', '--workdir', directory, '--env-file', join(directory, 'empty.env')], { cwd: root, windowsHide: true, stdio: 'ignore' });
  edge.on('error', () => {});
  let ready = false;
  for (let i = 0; i < 80; i++) { try { const response = await fetch(`${connection.api}/functions/v1/sync-batch`, { signal: AbortSignal.timeout(2000) }); if (response.status === 401) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); }
  if (!ready) throw new Error('EDGE_AUTH_GATE_UNAVAILABLE');
  const env = { ...process.env, ...(seedAB ? { REBANHOSYNC_SEED_AB_SERIES: report.independent_series } : {}), ...(postAckRun ? { REBANHOSYNC_POST_ACK_VARIANT: 'optimized' } : {}), REBANHOSYNC_DISPOSABLE_LOCAL_DB: '1', REBANHOSYNC_SKIP_FUNCTIONS_SERVE: '1', DB_URL: connection.database, API_URL: connection.api, FUNCTIONS_URL: `${connection.api}/functions/v1`, ANON_KEY: connection.anon, SERVICE_ROLE_KEY: connection.service };
  const validation = await child(process.execPath, ['scripts/codex/validate-supabase-baseline-functional.mjs'], env);
  report.steps.functional_exit = validation.code;
  report.functional_checks = validation.stdout.split(/\r?\n/).filter(x => /^authenticated privileges|^user_profiles:|^user_settings:|^[1-5]\/5|^OK baseline/.test(x));
  if (validation.code !== 0) {
    // Emit only the assertion's first line, stripping URLs and tokens.
    report.functional_failure = validation.stderr.split(/\r?\n/).filter(x => /^Error:/.test(x)).map(x => x.replace(/https?:\/\/\S+|postgres(?:ql)?:\/\/\S+|eyJ[\w.-]+/g, '[REDACTED]'));
    throw new Error('FUNCTIONAL_CERTIFICATION_FAILED');
  }
  for (const workload of p0Reconnect || ackDiagnosis ? [] : ['pull', 'reconnect']) {
    console.log(JSON.stringify({ phase: workload }));
    const probe = await child(process.execPath, ['scripts/codex/performance-baseline.mjs', '--workload', workload, '--animals', '10', '--gestures', '2', '--farms', '2', '--runs', '1', '--mode', workload === 'pull' ? 'cold' : 'warm', '--purpose', 'benchmark'], env);
    report.steps[`${workload}_exit`] = probe.code;
    try {
      const output = probe.stdout.split(/\r?\n/).findLast(line => line.startsWith('{"status":'));
      const receipt = JSON.parse(output);
      const artifact = resolve(receipt.output);
      if (!artifact.startsWith(join(root, 'test-results/f24-6') + '\\') && !artifact.startsWith(join(root, 'test-results/f24-6') + '/')) throw new Error('UNSAFE_PROBE_ARTIFACT');
      report[`${workload}_probe`] = { ...receipt, evidence: JSON.parse(readFileSync(artifact, 'utf8')) };
    } catch { report[`${workload}_probe`] = { error: 'PROBE_OUTPUT_UNAVAILABLE' }; }
    if (report[`${workload}_probe`].error) throw new Error('PROBE_EVIDENCE_UNAVAILABLE');
    save(); if (probe.code !== 0) throw new Error(`${workload.toUpperCase()}_PROOF_FAILED`);
  }
  if (postAckRun) {
    report.post_ack_series = [];
    const specifications = [...(seedAB ? [{ variant: 'optimized', gestures: 2, controlled_seed: true, proof: true }] : []), { variant: 'optimized', gestures: 10, proof: true }, ...(postAckProofOnly ? [] : Array.from({ length: 5 }, (_, i) => (i % 2 ? ['optimized', 'original'] : ['original', 'optimized']).map(variant => ({ variant, gestures: 100, run: i + 1 }))).flat())];
    report.post_ack_budget = { gestures_max: 100, runs_per_variant: 5, child_limit_ms: 300000, diagnostic_limits: { duration_ms: 240000, requests: 4000, received_mib: 600, heap_mib: 512 }, instrumentation: 'identical diagnostic transform for both variants', order: 'counterbalanced sequential; shared isolated backend warm; new fixture and browser context each run', next_1k: 'NOT_EXECUTED_UNTIL_REVIEW' };
    if (postAckProofOnly) Object.assign(report.post_ack_budget, { gestures_max: 10, runs_per_variant: 0, order: 'additional controlled restart proof only; no quantitative series' });
    save();
    for (const specification of specifications) {
      for (const [name, hash] of Object.entries(report.harness_sources)) { if (createHash('sha256').update(readFileSync(join(root, 'scripts/codex', name))).digest('hex') !== hash) throw new Error('HARNESS_CHANGED_DURING_SERIES'); }
      console.log(JSON.stringify({ phase: 'post_ack_comparison', ...specification, project }));
      const probe = await child(process.execPath, ['scripts/codex/performance-baseline.mjs', '--workload', 'reconnect', '--animals', String(specification.gestures), '--gestures', String(specification.gestures), '--farms', '2', '--runs', '1', '--mode', 'warm', '--purpose', 'benchmark'], { ...env, REBANHOSYNC_POST_ACK_VARIANT: specification.variant, REBANHOSYNC_CONTROLLED_SEED_FAILURE: specification.controlled_seed ? '1' : '0', REBANHOSYNC_POST_ACK_PROOF: specification.proof && !specification.controlled_seed ? '1' : '0', REBANHOSYNC_ACK_DIAGNOSIS: '1' });
      const entry = { ...specification, exit: probe.code, signal: probe.signal };
      try {
        const receipt = JSON.parse(probe.stdout.split(/\r?\n/).findLast(line => line.startsWith('{"status":')));
        entry.artifact = receipt.output; entry.evidence = JSON.parse(readFileSync(receipt.output, 'utf8'));
      } catch { entry.failure = 'PROBE_ARTIFACT_UNAVAILABLE'; entry.initialization_error = probe.stderr.match(/Error: ([A-Z][A-Z0-9_]+)/)?.[1] ?? null; }
      report.post_ack_series.push(entry); save();
      if (specification.controlled_seed) {
        if (probe.code !== 1 || entry.evidence?.active_run?.seed_diagnosis?.browser?.stage !== 'controlled_after_seed' || entry.evidence?.failure_detail?.category !== 'INDEXEDDB_QUOTA' || !entry.evidence?.cleanup_completed || !Object.values(entry.evidence?.failure_cleanup ?? {}).every(v => v === true)) throw new Error('CONTROLLED_SEED_DIAGNOSIS_NOT_VERIFIED');
        report.steps.seed_diagnosis = 'CONTROLLED_FAILURE_CAPTURE_VERIFIED'; save(); continue;
      }
      if (probe.code !== 0 || entry.failure) throw new Error('POST_ACK_PROOF_OR_COMPARISON_FAILED');
    }
  }
  if (p0Reconnect || ackDiagnosis) {
    report.reconnect_series = [];
    for (const specification of ackDiagnosis ? [{ gestures: 10, kind: 'control' }, { gestures: 10, kind: 'instrumented' }, { gestures: 10, kind: 'controlled_transport_failure' }, { gestures: 1000, kind: 'limited_reproduction' }] : [100,1000,10000].map(gestures => ({ gestures }))) {
      const { gestures, kind } = specification;
      const runsRequested = ackDiagnosis ? 1 : 5;
      const series = { gestures, kind, farms: 2, runs_requested: runsRequested, runs: [], classification: 'LIMIT_NOT_PROVEN' };
      report.reconnect_series.push(series); save();
      for (let run = 1; run <= runsRequested; run++) {
        console.log(JSON.stringify({ phase: 'reconnect_series', gestures, run, project }));
        const probe = await child(process.execPath, ['scripts/codex/performance-baseline.mjs', '--workload', 'reconnect', '--animals', String(gestures), '--gestures', String(gestures), '--farms', '2', '--runs', '1', '--mode', 'warm', '--purpose', 'benchmark'], { ...env, REBANHOSYNC_ACK_DIAGNOSIS: ackDiagnosis && kind !== 'control' ? '1' : '0', REBANHOSYNC_CONTROLLED_TRANSPORT_FAILURE: kind === 'controlled_transport_failure' ? '1' : '0' });
        const entry = { run, exit: probe.code, signal: probe.signal };
        try {
          const receipt = JSON.parse(probe.stdout.split(/\r?\n/).findLast(line => line.startsWith('{"status":')));
          entry.artifact = receipt.output; entry.evidence = JSON.parse(readFileSync(receipt.output, 'utf8'));
        } catch {
          entry.failure = 'PROBE_ARTIFACT_UNAVAILABLE';
          entry.initialization_error = probe.stderr.match(/Error: ([A-Z][A-Z0-9_]+)/)?.[1] ?? null;
          const partial = probe.stdout.split(/\r?\n/).findLast(line => line.startsWith('HARNESS_ARTIFACT '))?.slice('HARNESS_ARTIFACT '.length);
          if (partial && resolve(partial).startsWith(join(root, 'test-results/f24-6'))) {
            entry.artifact = partial;
            try { entry.evidence = JSON.parse(readFileSync(partial, 'utf8')); } catch { /* Preserve interruption separately. */ }
          }
        }
        series.runs.push(entry); save();
        if (kind === 'controlled_transport_failure') {
          const observation = entry.evidence?.active_run?.diagnostic;
          if (entry.evidence?.failure_code !== 'ACK_NOT_CONFIRMED' || !observation?.network.some(x => x.stage === 'transport_failure') || !observation?.browser.events.some(x => x.stage === 'gesture_terminal' && x.status === 'PENDING' && x.diagnostics?.last_failure?.cause_code === 'NETWORK_FAILURE')) throw new Error('CONTROLLED_FAILURE_DIAGNOSTICS_NOT_VERIFIED');
          series.classification = 'CONTROLLED_FAILURE_CAPTURE_VERIFIED'; save(); continue;
        }
        if (probe.code !== 0 || entry.failure) {
          series.classification = probe.signal ? 'ENVIRONMENT_LIMITATION' : 'LIMIT_NOT_PROVEN'; save();
          throw new Error('RECONNECT_SERIES_INCOMPLETE');
        }
      }
      if (kind !== 'controlled_transport_failure') series.classification = 'PROVEN_OK'; save();
      console.log(JSON.stringify({ phase: 'reconnect_level_complete', gestures, kind, runs: runsRequested }));
    }
  }
  report.result = 'READY_FOR_P0_BENCHMARKS';
} catch (error) {
  report.result = 'BLOCKED_WITH_REASON'; report.failure = /^[A-Z0-9_]+$/.test(error.message) ? error.message : error.code ?? 'UNEXPECTED_ENVIRONMENT_FAILURE';
} finally {
  if (edge && !edge.killed) edge.kill();
  delete process.env.REBANHOSYNC_BENCHMARK_SUPABASE_WORKDIR;
  try {
    // project is generated here, never a user-supplied or shared identifier.
    try { cli(['stop', '--project-id', project, '--no-backup', '--workdir', directory]); report.stop_exit = 0; }
    catch { report.stop_exit = 1; }
    report.after = snapshot();
    report.cleanup_verified = ![...report.after.containers, ...report.after.volumes, ...report.after.networks].some(x => x.includes(project));
    report.preexisting_resources_unchanged = JSON.stringify(report.before) === JSON.stringify(report.after);
    if (shared) report.shared_after = await schemaFingerprint(shared);
    report.shared_schema_history_unchanged = JSON.stringify(report.shared_before) === JSON.stringify(report.shared_after);
    if (!report.cleanup_verified || !report.preexisting_resources_unchanged || !report.shared_schema_history_unchanged) { report.result = 'BLOCKED_WITH_REASON'; report.cleanup_failure = 'CLEANUP_OR_SHARED_STATE_NOT_VERIFIED'; }
  } catch { report.result = 'BLOCKED_WITH_REASON'; report.cleanup_failure = 'CLEANUP_VERIFICATION_FAILED'; }
  report.finished_at = new Date().toISOString(); save(); console.log(JSON.stringify({ result: report.result, failure: report.failure, report: join(directory, 'certification.json'), cleanup: report.cleanup_verified, shared_unchanged: report.shared_schema_history_unchanged }));
}
process.exitCode = report.result === 'READY_FOR_P0_BENCHMARKS' ? 0 : 1;
