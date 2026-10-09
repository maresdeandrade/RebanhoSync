// Local-only: real PostgreSQL, full prior migration chain, disposable database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import pg from 'pg';
import ts from 'typescript';

const container = 'supabase_db_GestaoAgro';
const database = `telemetry_retention_${randomUUID().replaceAll('-', '')}`;
const migrationDir = 'supabase/migrations';
const retentionFile = '20261008202000_f24_5e3_remote_telemetry_retention.sql';
const cronFile = '20261008202024_f24_5e3_remote_telemetry_retention_cron.sql';
const retentionSQL = readFileSync(`${migrationDir}/${retentionFile}`, 'utf8');
const cronSQL = readFileSync(`${migrationDir}/${cronFile}`, 'utf8');
const user = randomUUID();
const farm = randomUUID();
const otherFarm = randomUUID();
const legacyID = randomUUID();
let created = false;
let password;
const clients = [];
const docker = args => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
});
const psql = (sql, role = 'postgres') => execFileSync('docker', [
  'exec', '-i', container, 'sh', '-c',
  'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -U "$1" -d "$2"',
  'retention-psql', role, database,
], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
async function connect(db = database) {
  assert.match(database, /^telemetry_retention_[a-f0-9]{32}$/);
  const client = new pg.Client({ host: '127.0.0.1', port: 54322, database: db,
    user: 'postgres', password, connectionTimeoutMillis: 5000 });
  await client.connect();
  clients.push(client);
  return client;
}
let client;
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function asRole(role, fn) {
  assert(['anon', 'authenticated'].includes(role));
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    return await fn();
  } finally { await client.query('rollback'); }
}
async function reset() {
  // Only synthetic rows in this run's disposable database, never shared/local/remote fixtures.
  assert(created && /^telemetry_retention_[a-f0-9]{32}$/.test(database));
  await client.query('delete from public.metrics_events');
}
async function seed(count, age = '31 days') {
  await client.query(`insert into public.metrics_events(fazenda_id,event_name)
    select $1,'synthetic.f24_5e3' from generate_series(1,$2::integer)`, [farm, count]);
  // Owner-only fixture aging. Trigger/RLS stay enabled; end-users cannot UPDATE.
  await client.query('update public.metrics_events set server_received_at=now()-$1::interval', [age]);
}
async function purge(c = client) {
  return (await c.query('select public.purge_expired_metrics_events() as deleted')).rows[0].deleted;
}
async function count() {
  return Number((await client.query('select count(*) from public.metrics_events')).rows[0].count);
}
async function securitySnapshot() {
  return (await client.query(`select c.relrowsecurity,c.relforcerowsecurity,r.rolname as owner,
    (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p
      where schemaname='public' and tablename='metrics_events') as policies,
    has_table_privilege('authenticated',c.oid,'SELECT') as sel,
    has_table_privilege('authenticated',c.oid,'INSERT') as ins,
    has_table_privilege('authenticated',c.oid,'UPDATE') as upd,
    has_table_privilege('authenticated',c.oid,'DELETE') as del
    from pg_class c join pg_roles r on r.oid=c.relowner
    where c.oid='public.metrics_events'::regclass`)).rows[0];
}

try {
  assert.match(docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).trim(), /^(npipe:\/\/|unix:\/\/)/);
  const bindings = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]));
  assert(bindings['5432/tcp'].some(binding => binding.HostPort === '54322'));
  // Local container credential consumed in memory only; never output or persisted.
  password = docker(['exec', container, 'printenv', 'POSTGRES_PASSWORD']).trim();
  docker(['exec', container, 'createdb', '-U', 'postgres', '--template=template0', database]);
  created = true;
  const authSchema = docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres',
    '--schema-only', '--schema=auth', '--no-owner']);
  try { psql(authSchema, 'supabase_admin'); }
  catch { throw new Error('Auth schema bootstrap failed'); }
  psql('create schema extensions; create extension pgcrypto with schema extensions;');
  const prior = readdirSync(migrationDir).filter(file => file.endsWith('.sql') && file < retentionFile).sort();
  for (const file of prior) {
    try { psql(readFileSync(`${migrationDir}/${file}`, 'utf8')); }
    catch (error) {
      console.error(`Bootstrap migration failed: ${file}`);
      // PostgreSQL diagnostics for repository SQL only, not connection/auth output.
      console.error(error.stderr?.toString().split('\n').filter(line => /ERROR:|DETAIL:/.test(line)).join('\n'));
      throw new Error('Prior migration bootstrap failed');
    }
  }
  client = await connect();
  console.log(`LOCAL_ONLY PostgreSQL ${(await client.query('show server_version')).rows[0].server_version}; prior_migrations=${prior.length}`);
  await client.query('insert into auth.users(id) values($1)', [user]);
  await client.query("insert into public.fazendas(id,nome) values($1,'Synthetic retention A'),($2,'Synthetic retention B')", [farm, otherFarm]);
  await client.query("insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,'owner',now())", [user, farm]);
  await client.query(`insert into public.metrics_events(id,fazenda_id,event_name,created_at)
    values($1,$2,'synthetic.legacy',now()-interval '100 days')`, [legacyID, farm]);
  const securityBefore = await securitySnapshot();
  const existingIndexes = (await client.query("select indexname,indexdef from pg_indexes where tablename='metrics_events' order by indexname")).rows;
  await client.query('begin');
  const migrationTime = (await client.query('select now() as stamp')).rows[0].stamp;
  await client.query(retentionSQL);
  await client.query('commit');

  await test('conservative backfill and client timestamp preserved', async () => {
    const row = (await client.query('select * from public.metrics_events where id=$1', [legacyID])).rows[0];
    assert.equal(row.server_received_at.toISOString(), migrationTime.toISOString());
    assert(row.created_at < row.server_received_at);
    assert.equal(await purge(), 0);
  });
  await test('RLS, table ACL and old indexes unchanged; new ordered index', async () => {
    assert.deepEqual(await securitySnapshot(), securityBefore);
    assert.deepEqual(securityBefore, { ...securityBefore, relrowsecurity: true, relforcerowsecurity: false,
      owner: 'postgres', sel: true, ins: true, upd: false, del: false });
    const indexes = (await client.query("select indexname,indexdef from pg_indexes where tablename='metrics_events' order by indexname")).rows;
    for (const index of existingIndexes) assert.deepEqual(indexes.find(i => i.indexname === index.indexname), index);
    assert.match(indexes.find(i => i.indexname === 'idx_metrics_events_server_received_id').indexdef, /\(server_received_at, id\)/);
    const fn = (await client.query("select prosecdef,proconfig from pg_proc where oid='public.purge_expired_metrics_events()'::regprocedure")).rows[0];
    assert.equal(fn.prosecdef, false);
    assert(fn.proconfig.some(value => value.startsWith('search_path=')));
  });
  for (const role of ['anon', 'authenticated']) {
    await test(`${role} cannot execute purge`, async () => {
      await asRole(role, async () => {
        await assert.rejects(purge(), error => error.code === '42501');
      });
    });
  }
  await test('authenticated INSERT overwrites forged and NULL server timestamps', async () => {
    await asRole('authenticated', async () => {
      for (const forged of ['1900-01-01', '2200-01-01', null]) {
        const row = (await client.query(`insert into public.metrics_events(fazenda_id,event_name,server_received_at)
          values($1,'synthetic.forged',$2) returning server_received_at=now() as authoritative`, [farm, forged])).rows[0];
        assert.equal(row.authoritative, true);
      }
    });
  });
  await test('legacy INSERT/own SELECT work, cross-tenant INSERT/SELECT remain isolated', async () => {
    await client.query("insert into public.metrics_events(fazenda_id,event_name) values($1,'synthetic.other-tenant')", [otherFarm]);
    await asRole('authenticated', async () => {
      const result = await client.query("insert into public.metrics_events(fazenda_id,event_name) values($1,'synthetic.old-client') returning id,server_received_at", [farm]);
      assert(result.rows[0].server_received_at instanceof Date);
      assert.equal((await client.query('select id from public.metrics_events where id=$1', [result.rows[0].id])).rowCount, 1);
      assert.equal((await client.query('select id from public.metrics_events where fazenda_id=$1', [otherFarm])).rowCount, 0);
      await assert.rejects(client.query("insert into public.metrics_events(fazenda_id,event_name) values($1,'synthetic.forbidden')", [otherFarm]), e => e.code === '42501');
    });
  });
  await test('replay DO NOTHING preserves first ingestion timestamp', async () => {
    await asRole('authenticated', async () => {
      const original = (await client.query('select server_received_at from public.metrics_events where id=$1', [legacyID])).rows[0];
      const replay = await client.query(`insert into public.metrics_events(id,fazenda_id,event_name,server_received_at)
        values($1,$2,'synthetic.replay','2200-01-01') on conflict(id) do nothing returning id`, [legacyID, farm]);
      assert.equal(replay.rowCount, 0);
      assert.deepEqual((await client.query('select server_received_at from public.metrics_events where id=$1', [legacyID])).rows[0], original);
    });
  });
  await test('strict 30-day boundary: younger and exact kept, older removed', async () => {
    await reset();
    await client.query('begin');
    await seed(3);
    await client.query(`with ranked as (select id,row_number() over(order by id) as n from public.metrics_events)
      update public.metrics_events m set server_received_at=now()-interval '30 days'+
        case r.n when 1 then interval '-1 microsecond' when 2 then interval '0' else interval '1 microsecond' end
      from ranked r where r.id=m.id`);
    assert.equal(await purge(), 1);
    assert.equal(await count(), 2);
    assert.equal(await purge(), 0);
    await client.query('rollback');
  });
  await test('batch 1000, deterministic timestamp/id ordering and empty repeat', async () => {
    await reset();
    await seed(1005);
    const expected = (await client.query('select id from public.metrics_events order by server_received_at,id offset 1000')).rows;
    assert.equal(await purge(), 1000);
    assert.deepEqual((await client.query('select id from public.metrics_events order by server_received_at,id')).rows, expected);
    assert.equal(await purge(), 5);
    assert.equal(await purge(), 0);
    assert.equal(await count(), 0);
  });
  await test('concurrent purges skip locks, never double delete; recent INSERT unaffected', async () => {
    await reset();
    await seed(1500);
    const first = await connect();
    const second = await connect();
    await first.query('begin');
    await second.query('begin');
    await second.query("set local statement_timeout='1500ms'");
    const a = await purge(first); // Keep deleted rows locked and uncommitted.
    const b = await purge(second);
    assert.equal(a, 1000);
    assert.equal(b, 500);
    assert.equal(await purge(second), 0);
    await second.query("insert into public.metrics_events(fazenda_id,event_name) values($1,'synthetic.concurrent-recent')", [farm]);
    await second.query('commit');
    await first.query('commit');
    assert.equal(await count(), 1);
    assert.equal(await purge(), 0);
  });
  await test('late replay after purge is a fresh ingestion (bounded deduplication)', async () => {
    await reset();
    const id = randomUUID();
    await client.query("insert into public.metrics_events(id,fazenda_id,event_name) values($1,$2,'synthetic.late')", [id, farm]);
    await client.query("update public.metrics_events set server_received_at=now()-interval '31 days'");
    assert.equal(await purge(), 1);
    await asRole('authenticated', async () => {
      const replay = await client.query(`insert into public.metrics_events(id,fazenda_id,event_name)
        values($1,$2,'synthetic.late') on conflict(id) do nothing returning server_received_at=now() as fresh`, [id, farm]);
      assert.equal(replay.rows[0].fresh, true);
    });
  });
  await test('unchanged Edge handler: old payload accepted, receipts inserted=1 then replay=0', async () => {
    let handler;
    const source = readFileSync('supabase/functions/telemetry-ingest/index.ts', 'utf8').replace(/^import .*\r?\n/, '');
    const createClient = () => ({ auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) },
      from: table => ({ upsert: (events, options) => ({ select: async columns => {
        assert.equal(table, 'metrics_events');
        assert.deepEqual(JSON.parse(JSON.stringify(options)), { onConflict: 'id', ignoreDuplicates: true });
        assert.equal(columns, 'id');
        const rows = [];
        for (const e of events) {
          const result = await client.query(`insert into public.metrics_events
            (id,fazenda_id,event_name,status,route,entity,quantity,reason_code,payload,created_at)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do nothing returning id`,
          [e.id,e.fazenda_id,e.event_name,e.status,e.route,e.entity,e.quantity,e.reason_code,e.payload,e.created_at]);
          rows.push(...result.rows);
        }
        return { data: rows, error: null };
      } }) }) });
    runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext } }).outputText, {
      createClient, Request, Response, console: { error: () => {} },
      Deno: { env: { get: () => 'local-harness' }, serve: fn => { handler = fn; } },
    });
    const event = { id: randomUUID(), fazenda_id: farm, event_name: 'synthetic.edge', payload: { synthetic: true } };
    await asRole('authenticated', async () => {
      for (const inserted of [1, 0]) {
        const response = await handler(new Request('http://localhost/telemetry-ingest', {
          method: 'POST', headers: { Authorization: 'Bearer synthetic-harness' },
          body: JSON.stringify({ events: [event] }),
        }));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, inserted });
      }
    });
  });
  await test('exact cron migration installs/schedules idempotently, then rolls back locally', async () => {
    // pg_cron can only be installed in cron.database_name=postgres. No durable
    // mutation: uncommitted jobs cannot run; rollback restores extension/jobs.
    const maintenance = await connect('postgres');
    await maintenance.query('begin');
    try {
      const extensionBefore = (await maintenance.query("select extversion from pg_extension where extname='pg_cron'")).rows;
      await maintenance.query('create extension if not exists pg_cron with schema pg_catalog');
      assert.equal((await maintenance.query("select count(*)::integer n from cron.job where jobname='metrics-events-retention-daily'")).rows[0].n, 0,
        'Refuse to touch an existing shared-local retention job');
      // cron.schedule stores SQL without invoking it; purge already validated in
      // the disposable database. No shared metrics table/function modifications.
      await maintenance.query(cronSQL);
      await maintenance.query(cronSQL);
      const jobs = (await maintenance.query("select schedule,command,username,active from cron.job where jobname='metrics-events-retention-daily'")).rows;
      assert.deepEqual(jobs, [{ schedule: '0 3 * * *', command: 'SELECT public.purge_expired_metrics_events();', username: 'postgres', active: true }]);
      assert.equal((await maintenance.query("select extversion from pg_extension where extname='pg_cron'")).rows[0].extversion, '1.6.4');
      assert.equal((await maintenance.query("select to_regclass('cron.job_run_details') is not null as audit")).rows[0].audit, true);
      await maintenance.query('rollback');
      assert.deepEqual((await maintenance.query("select extversion from pg_extension where extname='pg_cron'")).rows, extensionBefore);
    } finally { await maintenance.query('rollback'); }
  });
  console.log(`PASS telemetry retention: ${passed} grouped cases; no remote operations`);
} catch (error) {
  // Do not dump child-process output, pg connection config or credentials.
  console.error(`FAIL telemetry retention: ${error.code ?? error.name}`);
  if (error.name === 'Error' && !error.code) console.error(error.message);
  if (error.name === 'AssertionError') console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const c of clients) { try { await c.query('rollback'); await c.end(); } catch { /* no secrets */ } }
  password = undefined;
  if (created) {
    assert.match(database, /^telemetry_retention_[a-f0-9]{32}$/);
    docker(['exec', container, 'dropdb', '-U', 'postgres', database]);
    console.log('DISPOSED run-owned local test database; shared fixtures untouched');
  }
}
