// V3.1-A: real PostgreSQL only, explicitly authorized disposable database.
// No discovery, provisioning, reset, remote fallback, login or automatic cleanup.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

export function authorizedTarget(env) {
  const deny = () => { throw new Error('BLOCKED_NO_AUTHORIZED_TARGET'); };
  if (env.V31_ALLOW_LOCAL_FIXTURES !== '1' || !env.V31_LOCAL_DB_URL ||
      !/^[a-zA-Z0-9_-]{16,}$/.test(env.V31_LOCAL_DISPOSABLE_TOKEN ?? '')) deny();
  let url;
  try { url = new URL(env.V31_LOCAL_DB_URL); } catch { deny(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.search || url.hash || !/^\/v31_disposable_[a-z0-9_]+$/.test(url.pathname)) deny();
  return { connectionString: url.href, database: url.pathname.slice(1),
    marker: `V31_DISPOSABLE:${env.V31_LOCAL_DISPOSABLE_TOKEN}` };
}

function targetGuardSelfTest() {
  const valid = { V31_ALLOW_LOCAL_FIXTURES: '1',
    V31_LOCAL_DB_URL: 'postgresql://127.0.0.1:54322/v31_disposable_guard',
    V31_LOCAL_DISPOSABLE_TOKEN: 'guard_token_123456' };
  assert.equal(authorizedTarget(valid).database, 'v31_disposable_guard');
  for (const change of [
    { V31_ALLOW_LOCAL_FIXTURES: '' }, { V31_LOCAL_DB_URL: '' },
    { V31_LOCAL_DISPOSABLE_TOKEN: '' },
    { V31_LOCAL_DB_URL: 'postgresql://fixture@remote.invalid/v31_disposable_guard' },
    { V31_LOCAL_DB_URL: 'postgresql://fixture@127.0.0.1/postgres' },
    { V31_LOCAL_DB_URL: 'postgresql://fixture@127.0.0.1/v31_disposable_guard?host=remote.invalid' },
    { V31_LOCAL_DB_URL: 'postgresql://fixture@127.0.0.1/v31_disposable_guard#override' },
    { V31_LOCAL_DB_URL: 'https://127.0.0.1/v31_disposable_guard' },
  ]) assert.throws(() => authorizedTarget({ ...valid, ...change }), /BLOCKED_NO_AUTHORIZED_TARGET/);
  console.log('TARGET_GUARD_SELF_TEST=OK; SQL_EXECUTED=false');
}

async function withRole(db, role, fn, actor) {
  assert(['service_role', 'authenticated', 'anon'].includes(role));
  await db.query(db.v31Candidate ? 'savepoint v31_role' : 'begin');
  try {
    await db.query(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
      [actor ?? '', JSON.stringify({ sub: actor, role })]);
    const result = await fn();
    if (db.v31Candidate) { await db.query('reset role'); await db.query('release savepoint v31_role'); }
    else await db.query('commit');
    return result;
  } catch (error) { await db.query(db.v31Candidate ? 'rollback to savepoint v31_role' : 'rollback'); throw error; }
}

async function sqlError(fn, code, reason) {
  await assert.rejects(fn, error => error.code === code && (!reason || error.message.includes(reason)));
}

async function runSQL(target) {
  const { default: pg } = await import('pg');
  const config = { connectionString: target.connectionString, connectionTimeoutMillis: 3000,
    query_timeout: 10000, application_name: 'sanitario-v31-foundation-test' };
  const db = new pg.Client(config);
  const peer = new pg.Client(config);
  const run = randomUUID();
  try {
    await db.connect();
    const identity = (await db.query(`select current_database() as name,
      shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()`)).rows[0];
    assert.equal(identity.name, target.database, 'TARGET_DATABASE_MISMATCH');
    assert.equal(identity.marker, target.marker, 'TARGET_DISPOSABLE_MARKER_REQUIRED');
    const roles = (await db.query(`select rolname, rolbypassrls from pg_roles
      where rolname in ('service_role','authenticated','anon')`)).rows;
    assert.equal(roles.length, 3, 'REAL_SUPABASE_ROLES_REQUIRED');
    assert.equal(roles.find(row => row.rolname === 'authenticated').rolbypassrls, false);
    assert.equal(roles.find(row => row.rolname === 'anon').rolbypassrls, false);
    assert.equal(roles.find(row => row.rolname === 'service_role').rolbypassrls, true);
    await peer.connect();

    const farm = randomUUID(), otherFarm = randomUUID(), animal = randomUUID(), otherAnimal = randomUUID();
    const owner = randomUUID(), manager = randomUUID(), cowboy = randomUUID(), outsider = randomUUID();
    const legacyAgenda = randomUUID(), legacyEvent = randomUUID();
    // Fixtures are unique per run and retained; never clean resources by prefix.
    for (const id of [owner, manager, cowboy, outsider]) {
      await db.query(`insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
        values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'{}','{}')`,
      [id, `${id}@v31.invalid`]);
    }
    await db.query('insert into public.fazendas(id,nome) values ($1,$2),($3,$4)',
      [farm, `V31 ${run}`, otherFarm, `V31 other ${run}`]);
    for (const [id, role, farmId] of [[owner, 'owner', farm], [manager, 'manager', farm],
      [cowboy, 'cowboy', farm], [outsider, 'owner', otherFarm]]) {
      await db.query('insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,$3)', [id, farmId, role]);
    }
    await db.query(`insert into public.animais(id,fazenda_id,identificacao,sexo)
      values ($1,$2,$3,'F'),($4,$5,$6,'F')`, [animal, farm, `V31-${run}`, otherAnimal, otherFarm, `V31-other-${run}`]);
    const agenda = async (id, root, farmId = farm, animalId = animal) => {
      const rooted = root !== undefined;
      await db.query(`insert into public.sanitario_agenda_v2
        (id,fazenda_id,dedup_key,janela_inicio,data_programada,acao_sanitaria${rooted ? ',obrigacao_origem_agenda_id' : ''})
        values ($1,$2,$3,current_date,current_date,'v31-fixture'${rooted ? ',$4' : ''})`,
      rooted ? [id, farmId, id, root] : [id, farmId, id]);
      await db.query(`insert into public.sanitario_agenda_animais_v2
        (agenda_id,fazenda_id,animal_id${rooted ? ',obrigacao_origem_agenda_id' : ''})
        values ($1,$2,$3${rooted ? ',$4' : ''})`, rooted ? [id, farmId, animalId, root] : [id, farmId, animalId]);
    };
    const event = async (id, source, farmId = farm, animalId = animal, nature = 'primary_execution') => {
      await db.query('begin');
      try {
        await db.query("select set_config('rebanhosync.sanitario_sync_v2_internal','on',true)");
        await db.query(`insert into public.eventos
          (id,fazenda_id,dominio,occurred_at,animal_id,source_sanitario_agenda_v2_id,
           sanitario_sync_v2_nature,sanitario_contract_version,domain_op_id)
          values ($1,$2,'sanitario',now(),$3,$4,$5,2,$6)`, [id, farmId, animalId, source, nature, randomUUID()]);
        // Historical detail shape; no technical product or therapeutic inference.
        await db.query(`insert into public.eventos_sanitario(evento_id,fazenda_id,tipo,produto)
          values ($1,$2,(enum_range(null::public.sanitario_tipo_enum))[1],'V31 fixture')`, [id, farmId]);
        await db.query('insert into public.eventos_animais(id,fazenda_id,evento_id,animal_id) values ($1,$2,$3,$4)',
          [randomUUID(), farmId, id, animalId]);
        await db.query('commit');
      } catch (error) { await db.query('rollback'); throw error; }
    };
    await agenda(legacyAgenda, undefined);
    await event(legacyEvent, legacyAgenda);
    const before = (await db.query('select to_jsonb(e) as row from public.eventos e where id=$1', [legacyEvent])).rows[0].row;
    await db.query('insert into public.sanitario_sync_v2_gates(fazenda_id,enabled) values ($1,false)', [farm]);
    const gateBefore = (await db.query('select enabled,minimum_contract_version,maximum_contract_version from public.sanitario_sync_v2_gates where fazenda_id=$1', [farm])).rows[0];
    const kinds = ['agenda_create', 'agenda_targets_replace', 'factual_core', 'administrative_closure', 'automation_plan', 'agenda_schedule'];
    const receipts = [];
    for (const [i, kind] of kinds.entries()) {
      const receipt = { kind, entity: kind === 'automation_plan' ? farm : kind === 'factual_core' ? legacyEvent : randomUUID(),
        client: randomUUID(), domain: randomUUID(), fingerprint: i < 4 ? '1'.repeat(32) : '2'.repeat(64), result: { fixture: run, kind } };
      await db.query(`insert into public.sanitario_sync_v2_operations
        (fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
        values ($1,$2,$3,$4,$5,$6,2,$7,$8)`, [farm, kind, receipt.entity, receipt.client, receipt.domain, owner, receipt.fingerprint, receipt.result]);
      receipts.push(receipt);
    }
    const receiptsBefore = (await db.query(`select to_jsonb(o) as row from public.sanitario_sync_v2_operations o
      where fazenda_id=$1 order by operation_kind`, [farm])).rows;
    // Optional future application, never implicit; marker + both authorizations required.
    if (process.env.V31_APPLY_FOUNDATION === '1') {
      const migration = await readFile(new URL('../../supabase/migrations/20261030120000_sanitario_v3_foundation.sql', import.meta.url), 'utf8');
      await db.query('begin');
      try { await db.query(migration); await db.query('commit'); }
      catch (error) { await db.query('rollback'); throw error; }
    }

    const root = randomUUID(), child = randomUUID(), rootOther = randomUUID();
    const firstEvent = randomUUID(), secondEvent = randomUUID(), otherEvent = randomUUID();
    const standaloneEvent = randomUUID();
    await agenda(root, root); await agenda(child, root); await agenda(rootOther, rootOther, otherFarm, otherAnimal);
    await event(firstEvent, root); await event(secondEvent, child); await event(otherEvent, rootOther, otherFarm, otherAnimal);
    await event(standaloneEvent, null, farm, animal, 'standalone_fact');
    const claim = async (connection, eventId, farmId = farm, rootId = root, animalId = animal) =>
      (await connection.query('select public.internal_sanitario_claim_atendimento($1,$2,$3,$4) as result', [farmId, rootId, animalId, eventId])).rows[0].result;
    const getReceipt = async (receipt, actor = owner, overrides = {}) => {
      const r = { ...receipt, ...overrides };
      return withRole(db, 'service_role', async () => (await db.query(
        'select public.internal_sanitario_get_receipt($1,$2,$3,$4,$5,$6,$7) as result',
        [actor, farm, r.kind, r.entity, r.client, r.domain, r.fingerprint])).rows[0].result);
    };
    await test('V3.1-A real SQL', async t => {
      await t.test('upgrade_preserves_history_gates_and_index', async () => {
        assert.deepEqual((await db.query('select to_jsonb(e) as row from public.eventos e where id=$1', [legacyEvent])).rows[0].row, before);
        assert.equal((await db.query('select obrigacao_origem_agenda_id from public.sanitario_agenda_v2 where id=$1', [legacyAgenda])).rows[0].obrigacao_origem_agenda_id, null);
        const gate = (await db.query('select enabled,minimum_contract_version,maximum_contract_version,foundation_state from public.sanitario_sync_v2_gates where fazenda_id=$1', [farm])).rows[0];
        assert.deepEqual({ enabled: gate.enabled, minimum_contract_version: gate.minimum_contract_version, maximum_contract_version: gate.maximum_contract_version }, gateBefore);
        assert.equal(gate.foundation_state, 'inactive');
        assert.ok((await db.query("select to_regclass('public.ux_eventos_sanitario_agenda_primary_execution') as id")).rows[0].id);
      });
      await t.test('existing_unique_index_still_rejects_second_primary', async () => { await sqlError(() => event(randomUUID(), root), '23505'); });
      await t.test('claim_concurrency_and_same_event_idempotency', async () => {
        await db.query('begin'); await db.query('set local role service_role');
        assert.equal((await claim(db, firstEvent)).outcome, 'claimed');
        // Observe with the fixture connection's privileges, not runtime service_role.
        // RESET ROLE retains this transaction and its advisory lock.
        await db.query('reset role');
        await peer.query('begin'); await peer.query('set local role service_role');
        let finished = false;
        const pending = claim(peer, secondEvent).then(value => { finished = true; return value; });
        // Verify the contender is actually waiting on a lock, not merely a slow promise.
        for (let i = 0; i < 40; i++) {
          const waiting = (await db.query("select wait_event_type from pg_stat_activity where pid=$1", [peer.processID])).rows[0];
          if (waiting?.wait_event_type === 'Lock') break;
          if (i === 39) assert.fail('CONCURRENT_LOCK_NOT_OBSERVED');
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.equal(finished, false); await db.query('commit');
        const collision = await pending; await peer.query('commit');
        assert.equal(collision.outcome, 'collision'); assert.equal(collision.canonical_evento_id, firstEvent);
        assert.equal((await withRole(db, 'service_role', () => claim(db, firstEvent))).outcome, 'same_event');
        assert.equal(Number((await db.query('select count(*) from public.sanitario_atendimentos where fazenda_id=$1', [farm])).rows[0].count), 1);
      });
      await t.test('cross_farm_fk_and_invalid_candidate_denied', async () => {
        await sqlError(() => withRole(db, 'service_role', () => claim(db, otherEvent)), '23503');
        await sqlError(() => withRole(db, 'service_role', () => claim(db, firstEvent, farm, root, otherAnimal)), '23503');
        await sqlError(() => withRole(db, 'service_role', () => claim(db, standaloneEvent)), '23503');
        await sqlError(() => withRole(db, 'service_role', () => claim(db, null)), '22004');
        await sqlError(() => db.query('insert into public.sanitario_atendimentos(fazenda_id,obrigacao_origem_agenda_id,animal_id,evento_id) values ($1,$2,$3,$4)', [farm, rootOther, animal, firstEvent]), '23503');
      });
      await t.test('permissions_and_real_rls_membership', async () => {
        for (const role of ['authenticated', 'anon']) {
          await sqlError(() => withRole(db, role, () => claim(db, firstEvent), owner), '42501');
          const r = receipts[0];
          await sqlError(() => withRole(db, role, () => db.query(
            'select public.internal_sanitario_get_receipt($1,$2,$3,$4,$5,$6,$7)',
            [owner, farm, r.kind, r.entity, r.client, r.domain, r.fingerprint]), owner), '42501');
          await sqlError(() => withRole(db, role, () => db.query('insert into public.sanitario_atendimentos(fazenda_id,obrigacao_origem_agenda_id,animal_id,evento_id) values ($1,$2,$3,$4)', [farm, root, animal, firstEvent]), owner), '42501');
        }
        const own = await withRole(db, 'authenticated', () => db.query('select * from public.sanitario_atendimentos where fazenda_id=$1', [farm]), owner);
        const foreign = await withRole(db, 'authenticated', () => db.query('select * from public.sanitario_atendimentos where fazenda_id=$1', [farm]), outsider);
        assert.equal(own.rowCount, 1); assert.equal(foreign.rowCount, 0);
        await sqlError(() => withRole(db, 'anon', () => db.query('select * from public.sanitario_atendimentos')), '42501');
      });
      await t.test('bound_root_and_animal_identity_cannot_be_rewritten', async () => {
        await sqlError(() => db.query('update public.sanitario_agenda_v2 set obrigacao_origem_agenda_id=null where id=$1', [root]), '23514');
        await sqlError(() => db.query('update public.sanitario_agenda_animais_v2 set obrigacao_origem_agenda_id=null where agenda_id=$1', [root]), '23514');
        await sqlError(() => withRole(db, 'service_role', () => db.query('update public.sanitario_atendimentos set evento_id=$1 where fazenda_id=$2', [secondEvent, farm])), '42501');
      });
      await t.test('six_commands_have_matching_ledger_receipts_with_gate_off', async () => {
        for (const r of receipts) {
          assert.deepEqual(await getReceipt(r), { outcome: 'found', canonical_result: r.result });
          assert.deepEqual(await getReceipt(r, manager), { outcome: 'found', canonical_result: r.result });
          await sqlError(() => getReceipt(r, outsider), '42501');
          await sqlError(() => getReceipt(r, owner, { domain: randomUUID() }), '23505');
          await sqlError(() => getReceipt(r, owner, { fingerprint: 'divergent' }), '23505');
          await sqlError(() => getReceipt(r, owner, { entity: randomUUID() }), '23505');
          await sqlError(() => getReceipt(r, owner, { client: randomUUID() }), '23505');
          await sqlError(() => getReceipt(r, owner, { kind: r.kind === 'agenda_create' ? 'agenda_schedule' : 'agenda_create' }), '23505');
          if (r.kind === 'factual_core') assert.equal((await getReceipt(r, cowboy)).outcome, 'found');
          else await sqlError(() => getReceipt(r, cowboy), '42501');
        }
        assert.equal((await getReceipt({ ...receipts[0], client: randomUUID(), domain: randomUUID() })).outcome, 'absent');
        await sqlError(() => getReceipt(receipts[0], owner, { client: null }), '22004');
        await sqlError(() => getReceipt(receipts[0], owner, { kind: 'not_allowlisted' }), '42501');
        assert.deepEqual((await db.query(`select to_jsonb(o) as row from public.sanitario_sync_v2_operations o
          where fazenda_id=$1 order by operation_kind`, [farm])).rows, receiptsBefore);
      });
      await t.test('rollback_leaves_no_orphan_claim', async () => {
        await db.query('begin'); await db.query('set local role service_role');
        assert.equal((await claim(db, otherEvent, otherFarm, rootOther, otherAnimal)).outcome, 'claimed');
        await db.query('rollback');
        assert.equal(Number((await db.query('select count(*) from public.sanitario_atendimentos where fazenda_id=$1', [otherFarm])).rows[0].count), 0);
      });
      await t.test('claims_and_receipts_do_not_duplicate_facts_or_consumption', async () => {
        assert.equal(Number((await db.query('select count(*) from public.eventos where fazenda_id=$1', [farm])).rows[0].count), 4);
        assert.equal(Number((await db.query('select count(*) from public.insumo_movimentacoes where fazenda_id=$1', [farm])).rows[0].count), 0);
        assert.equal(Number((await db.query('select count(*) from public.sanitario_sync_v2_operations where fazenda_id=$1', [farm])).rows[0].count), 6);
      });
    });
    console.log(`FIXTURES_RETAINED run_id=${run}; automatic_cleanup=false`);
  } finally {
    await Promise.allSettled([db.query('rollback'), peer.query('rollback')]);
    await Promise.allSettled([db.end(), peer.end()]);
  }
}

if (process.argv.includes('--self-test-target-guard')) targetGuardSelfTest();
else {
  let target;
  try { target = authorizedTarget(process.env); }
  catch {
    console.error('SQL_REAL=BLOCKED_NO_AUTHORIZED_TARGET; RLS_INTEGRATION=NOT_TESTED; POSTGRES_CONCURRENCY=NOT_TESTED');
    process.exitCode = 2;
  }
  if (target && process.argv.includes('--check-target')) console.log('TARGET_CONFIG=ACCEPTED; SQL_EXECUTED=false; database_marker_not_checked=true');
  else if (target) {
    try { await (process.env.V31_TEST_ADMISSION === '1' ? runAdmissionSQL(target) : runSQL(target)); }
    catch (error) {
      // Never echo driver messages/URLs/SQL parameters or credentials.
      console.error(`SQL_RUN=INCOMPLETE; code=${/^[A-Z0-9_]{1,50}$/.test(error.code ?? '') ? error.code : 'VALIDATION_ERROR'}; reason=${String(error.message).match(/SANITARIO_[A-Z0-9_]+/)?.[0] ?? 'UNCLASSIFIED'}`);
      if (/^permission denied for (table|schema|function|database) [a-z_0-9]+$/.test(error.message ?? '')) console.error(error.message);
      process.exitCode = 1;
    }
  }
}

async function runAdmissionSQL(target) {
  const { default: pg } = await import('pg');
  const db = new pg.Client({connectionString:target.connectionString, query_timeout:10000});
  const peer = new pg.Client({connectionString:target.connectionString, query_timeout:10000});
  await db.connect(); await peer.connect();
  try {
    const identity=(await db.query("select current_database() name,shobj_description(oid,'pg_database') marker from pg_database where datname=current_database()")).rows[0];
    assert.equal(identity.name,target.database); assert.equal(identity.marker,target.marker);
    if(process.env.V31_CHECK_ADMISSION==='1') {
      const sql=await readFile(new URL('../../supabase/migrations/20261030121000_sanitario_v3_admission.sql',import.meta.url),'utf8');
      await db.query('begin'); db.v31Candidate=true;
      await db.query(sql.replace(/^begin;$/m,'').replace(/^commit;$/m,''));
    }
    if(process.env.V31_APPLY_ADMISSION==='1') {
      const sql=await readFile(new URL('../../supabase/migrations/20261030121000_sanitario_v3_admission.sql',import.meta.url),'utf8');
      const snapshot=async()=> (await db.query(`select
        (select md5(coalesce(jsonb_agg(to_jsonb(g) order by g.fazenda_id),'[]')::text) from public.sanitario_sync_v2_gates g) gates,
        (select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) from public.eventos e) facts,
        (select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]')::text) from public.sanitario_sync_v2_operations o) receipts,
        pg_get_indexdef('public.ux_eventos_sanitario_agenda_primary_execution'::regclass) primary_index`)).rows[0];
      const before=await snapshot();
      await db.query(sql);
      assert.deepEqual(await snapshot(),before,'MIGRATION_CHANGED_EXISTING_GATES_FACTS_RECEIPTS_OR_INDEX');
      console.log('ADMISSION_MIGRATION_APPLIED; existing_gates_facts_receipts_index_unchanged=true');
    }
    const farm=randomUUID(), other=randomUUID(), owner=randomUUID(), cowboy=randomUUID(), outsider=randomUUID(), animal=randomUUID();
    for(const id of [owner,cowboy,outsider]) await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)",[id,id+'@v31.invalid']);
    await db.query('insert into public.fazendas(id,nome) values($1,$2),($3,$4)',[farm,'V31 B '+farm,other,'V31 other '+other]);
    for(const [id,role,f] of [[owner,'owner',farm],[cowboy,'cowboy',farm],[outsider,'owner',other]]) await db.query('insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,$3)',[id,f,role]);
    await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo) values($1,$2,$3,'F')",[animal,farm,animal]);
    await db.query('insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,rollout_percentage) values($1,false,100),($2,false,0)',[farm,other]);
    const tx=randomUUID();
    const transition=(connection,expected,target,revision,evidence=null,id=tx,actor=owner)=>withRole(connection,'service_role',async()=>
      (await connection.query('select public.internal_sanitario_transition_foundation($1,$2,$3,$4,$5,$6,$7) r',[actor,farm,expected,target,id,revision,evidence])).rows[0].r);
    const args=(extra={})=>({actor_user_id:owner,fazenda_id:farm,contract_version:3,client_op_id:randomUUID(),domain_op_id:randomUUID(),...extra});
    const admit=(command,a,lookup=false,actor=owner,f=farm)=>withRole(db,'service_role',async()=>
      (await db.query('select public.internal_sanitario_admit_v3($1,$2,$3,$4,$5) r',[actor,f,command,a,lookup])).rows[0].r);
    const gate=async()=> (await db.query('select * from public.sanitario_sync_v2_gates where fazenda_id=$1',[farm])).rows[0];
    const otherBefore=(await db.query('select to_jsonb(g) r from public.sanitario_sync_v2_gates g where fazenda_id=$1',[other])).rows[0].r;
    await test('V3.1-B real SQL',async t=>{
      await t.test('admission_and_transition_are_installed',async()=>{
        assert.ok((await db.query("select to_regprocedure('public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean)') f")).rows[0].f);
        assert.ok((await db.query("select to_regprocedure('public.internal_sanitario_transition_foundation(uuid,uuid,text,text,uuid,bigint,jsonb)') f")).rows[0].f);
      });
      await t.test('cowboy_and_outsider_cannot_transition',async()=>{
        for(const actor of [cowboy,outsider]) await sqlError(()=>transition(db,'inactive','frozen',0,null,tx,actor),'42501');
      });
      await t.test('rollback_before_transition_commit_keeps_inactive',async()=>{
        await db.query(db.v31Candidate ? 'savepoint v31_abort_transition' : 'begin');
        await db.query('set local role service_role');
        await db.query("select public.internal_sanitario_transition_foundation($1,$2,'inactive','frozen',$3,0,null)",[owner,farm,randomUUID()]);
        await db.query(db.v31Candidate ? 'rollback to savepoint v31_abort_transition' : 'rollback');
        assert.equal((await gate()).foundation_state,'inactive');
      });
      await t.test('transition_waits_for_inflight_writer',async()=>{
        await peer.query('begin');
        await peer.query("select pg_advisory_xact_lock_shared(hashtextextended('sanitario-v31:'||$1,0))",[farm]);
        const pending=transition(db,'inactive','frozen',0); let completed=false; pending.then(()=>{completed=true;});
        await new Promise(resolve=>setTimeout(resolve,100)); assert.equal(completed,false);
        await peer.query('commit');
        assert.equal((await pending).foundation_state,'frozen');
      });
      await t.test('frozen_commit_ack_lost_stays_frozen_and_same_id_is_idempotent',async()=>{
        assert.equal((await transition(db,'inactive','frozen',0)).foundation_revision,1);
        assert.equal((await gate()).foundation_state,'frozen');
        if (!db.v31Candidate) assert.equal((await peer.query('select foundation_state from public.sanitario_sync_v2_gates where fazenda_id=$1',[farm])).rows[0].foundation_state,'frozen');
        await sqlError(()=>transition(db,'frozen','ready',1),'55000');
        await sqlError(()=>transition(db,'frozen','ready',0,{}),'40001');
        assert.equal((await gate()).foundation_state,'frozen');
        await sqlError(()=>admit('create_agenda',args({payload:{id:randomUUID()},animal_ids:[animal]})),'55000');
      });
      let evidence;
      await t.test('ready_atomically_sets_only_target_range_3_3_and_off_gate_remains_off',async()=>{
        const digest=(await db.query('select public.internal_sanitario_v3_guards_digest() d')).rows[0].d;
        evidence={frozen_revision:1,schema_revision:'20261030121000',guards_digest:digest,consumer_build:'v31-local-fixture',checks:{admission:true,consumers:true,inventory:true},inventory_disposition:'preserved'};
        for(const invalid of [{...evidence,guards_digest:'stale'},{...evidence,frozen_revision:0}]) await sqlError(()=>transition(db,'frozen','ready',1,invalid),'55000');
        const ready=await transition(db,'frozen','ready',1,evidence);
        assert.equal(ready.foundation_state,'ready');assert.equal(ready.enabled,false);
        assert.equal(ready.minimum_contract_version,3);assert.equal(ready.maximum_contract_version,3);
        assert.deepEqual((await db.query('select to_jsonb(g) r from public.sanitario_sync_v2_gates g where fazenda_id=$1',[other])).rows[0].r,otherBefore);
        assert.ok((await db.query("select to_regclass('public.ux_eventos_sanitario_agenda_primary_execution') f")).rows[0].f);
      });
      await t.test('ready_ack_lost_returns_existing_revision_and_cannot_downgrade',async()=>{
        assert.equal((await transition(db,'frozen','ready',1,evidence)).foundation_revision,2);
        await sqlError(()=>transition(db,'ready','inactive',2),'22023');
        await sqlError(()=>transition(db,'inactive','frozen',0,null,randomUUID()),'40001');
        assert.equal((await gate()).foundation_state,'ready');
      });
      await t.test('off_gate_denies_new_writes_and_format2_has_no_fallback',async()=>{
        const a=args({payload:{id:randomUUID(),data_programada:'2026-10-30'},animal_ids:[animal]});
        await sqlError(()=>admit('create_agenda',a),'42501');
        await sqlError(()=>admit('create_agenda',{...a,contract_version:2}),'22023');
      });
      await t.test('format3_rejected_by_enabled_gate_2_2',async()=>{
        await db.query('update public.sanitario_sync_v2_gates set enabled=true,minimum_contract_version=2,maximum_contract_version=2 where fazenda_id=$1',[farm]);
        await sqlError(()=>admit('create_agenda',args({payload:{id:randomUUID()},animal_ids:[animal]})),'22023','SANITARIO_CLIENT_CONTRACT_OUTDATED');
        await db.query('update public.sanitario_sync_v2_gates set enabled=false,minimum_contract_version=3,maximum_contract_version=3 where fazenda_id=$1',[farm]);
      });
      await t.test('omitted_version_and_generic_details_cannot_bypass',async()=>{
        await sqlError(()=>withRole(db,'authenticated',()=>db.query("insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id) values($1,$2,'sanitario',now(),$3)",[randomUUID(),farm,animal]),owner),'42501');
        await sqlError(()=>withRole(db,'authenticated',async()=>{
          await db.query("select set_config('rebanhosync.sanitario_v3_farm',$1,true),set_config('rebanhosync.sanitario_v3_actor',$2,true)",[farm,owner]);
          await db.query("insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id,sanitario_contract_version) values($1,$2,'sanitario',now(),$3,3)",[randomUUID(),farm,animal]);
        },owner),'42501');
      });
      await t.test('non_sanitary_insert_remains_allowed',async()=>{
        await withRole(db,'authenticated',()=>db.query("insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id) values($1,$2,'pesagem',now(),$3)",[randomUUID(),farm,animal]),owner);
      });
      // Gate enabled only for this fresh disposable fixture, never a real farm.
      await db.query('update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1',[farm]);
      const agendaId=randomUUID();
      const create=args({payload:{id:agendaId,dedup_key:agendaId,janela_inicio:'2026-10-30',data_programada:'2026-10-30',acao_sanitaria:'fixture',client_id:'v31-test',client_recorded_at:new Date().toISOString(),client_tx_id:randomUUID()},animal_ids:[animal]});
      const replace=args({expected_revision:0,agenda_id:agendaId,client_id:'v31-test',animal_ids:[animal]});
      const schedule=args({expected_revision:1,agenda_id:agendaId,client_id:'v31-test',planned_for:'2026-10-31'});
      const closure=args({expected_revision:2,payload:{id:randomUUID(),agenda_id:agendaId,closure_type:'cancelled',dedup_key:randomUUID(),closed_at:new Date().toISOString(),reason:'fixture',client_id:'v31-test',client_recorded_at:new Date().toISOString(),client_tx_id:randomUUID()}});
      const plan=args({expected_revision:0,client_id:'v31-test',client_recorded_at:new Date().toISOString(),client_tx_id:randomUUID(),plan:{schemaVersion:2,revision:1,enabled:false,rules:[],context:{}},expected_plan:null});
      await db.query("insert into public.fazenda_sanidade_config(fazenda_id) values($1)",[farm]);
      const eventId=randomUUID();
      const fact=args({expected_revision:null,event_payload:{id:eventId,natureza:'standalone_fact',occurred_at:new Date().toISOString(),animal_id:animal,client_id:'v31-test',client_recorded_at:new Date().toISOString(),client_tx_id:randomUUID(),payload:{entry_history_source:'external_declared',evidence_class:'declared'}},detail_payload:{tipo:'vacinacao',produto_nome_snapshot:'declarado'},event_animals:[{id:randomUUID(),animal_id:animal}]});
      const commands=[['create_agenda',create],['replace_agenda_animals',replace],['reschedule_agenda',schedule],['close_agenda',closure],['set_automation_plan',plan],['apply_factual_core',fact]];
      await t.test('six_commands_replay_exact_receipts_with_gates_off_and_conflict_on_divergence',async()=>{
        for(const [command,a] of commands){
          const result=await admit(command,a);
          await db.query('update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1',[farm]);
          assert.deepEqual(await admit(command,a,true),{outcome:'found',canonical_result:result});
          assert.deepEqual(await admit(command,a),result);
          await sqlError(()=>admit(command,{...a,domain_op_id:randomUUID()},true),'23505');
          await sqlError(()=>admit(command,{...a,client_op_id:randomUUID()},true),'23505');
          await sqlError(()=>admit(command,a,true,outsider),'42501');
          if(command!=='apply_factual_core') await sqlError(()=>admit(command,{...a,actor_user_id:cowboy},true,cowboy),'42501');
          await db.query('update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1',[farm]);
        }
        assert.equal((await db.query('select obrigacao_origem_agenda_id from public.sanitario_agenda_v2 where id=$1',[agendaId])).rows[0].obrigacao_origem_agenda_id,agendaId);
        assert.equal(Number((await db.query('select count(*) from public.sanitario_atendimentos where fazenda_id=$1',[farm])).rows[0].count),0);
        assert.equal(Number((await db.query('select count(*) from public.insumo_movimentacoes where fazenda_id=$1',[farm])).rows[0].count),0);
      });
      await t.test('primary_execution_and_correction_through_source_are_blocked',async()=>{
        await sqlError(()=>admit('apply_factual_core',args({...fact,event_payload:{...fact.event_payload,id:randomUUID(),natureza:'primary_execution',source_sanitario_agenda_v2_id:agendaId},client_op_id:randomUUID(),domain_op_id:randomUUID()})),'55000','SANITARIO_V3_EXECUTION_NOT_ENABLED');
        const historical=(await db.query("select e.id,e.fazenda_id,uf.user_id from public.eventos e join public.user_fazendas uf on uf.fazenda_id=e.fazenda_id and uf.role='owner' join public.fazendas f on f.id=e.fazenda_id where e.source_sanitario_agenda_v2_id is not null and f.nome like 'V31 %' limit 1")).rows[0];
        assert.ok(historical);
        const oldGate=(await db.query('select foundation_state from public.sanitario_sync_v2_gates where fazenda_id=$1',[historical.fazenda_id])).rows[0];
        if(oldGate.foundation_state==='inactive') {
          const historicalTransition=randomUUID();
          await withRole(db,'service_role',()=>db.query("select public.internal_sanitario_transition_foundation($1,$2,'inactive','frozen',$3,0,null)",[historical.user_id,historical.fazenda_id,historicalTransition]));
          await withRole(db,'service_role',()=>db.query("select public.internal_sanitario_transition_foundation($1,$2,'frozen','ready',$3,1,$4)",[historical.user_id,historical.fazenda_id,historicalTransition,evidence]));
        }
        await db.query('update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1',[historical.fazenda_id]);
        await sqlError(()=>admit('apply_factual_core',{...fact,actor_user_id:historical.user_id,fazenda_id:historical.fazenda_id,client_op_id:randomUUID(),domain_op_id:randomUUID(),event_payload:{...fact.event_payload,id:randomUUID(),natureza:'correction',corrige_evento_id:historical.id}},false,historical.user_id,historical.fazenda_id),'55000','SANITARIO_V3_EXECUTION_NOT_ENABLED');
      });
      await t.test('concurrent_admission_has_one_receipt_and_divergence_conflicts',async context=>{
        if(db.v31Candidate) {context.skip('requires committed migration visibility on both real connections');return;}
        const invoke=(connection,a)=>withRole(connection,'service_role',async()=>(await connection.query('select public.internal_sanitario_admit_v3($1,$2,$3,$4,false) r',[owner,farm,'create_agenda',a])).rows[0].r);
        const raceId=randomUUID();const race=args({...create,client_op_id:randomUUID(),domain_op_id:randomUUID(),payload:{...create.payload,id:raceId,dedup_key:raceId}});
        const exact=await Promise.all([invoke(db,race),invoke(peer,race)]);
        assert.deepEqual(exact[0],exact[1]);
        assert.equal(Number((await db.query('select count(*) from public.sanitario_sync_v2_operations where fazenda_id=$1 and client_op_id=$2',[farm,race.client_op_id])).rows[0].count),1);
        const divergentId=randomUUID();const one={...race,client_op_id:randomUUID(),domain_op_id:randomUUID(),payload:{...race.payload,id:divergentId,dedup_key:divergentId}};
        const conflict=await Promise.allSettled([invoke(db,one),invoke(peer,{...one,payload:{...one.payload,data_programada:'2026-11-01'}})]);
        assert.equal(conflict.filter(r=>r.status==='fulfilled').length,1);
        assert.equal(conflict.find(r=>r.status==='rejected').reason.code,'23505');
        assert.equal(Number((await db.query('select count(*) from public.sanitario_agenda_v2 where id=$1',[divergentId])).rows[0].count),1);
      });
      await t.test('generic_detail_and_legacy_definer_cannot_bypass',async()=>{
        await sqlError(()=>withRole(db,'authenticated',()=>db.query("insert into public.eventos_sanitario(evento_id,fazenda_id,tipo,produto) values($1,$2,'vacinacao','bypass')",[eventId,farm]),owner),'42501');
        await sqlError(()=>withRole(db,'authenticated',()=>db.query("select public.sanitario_complete_agenda_with_event($1,now(),null,null,null,'{}',null,$2,null,now())",[randomUUID(),randomUUID()]),owner),'42501');
        await sqlError(()=>withRole(db,'authenticated',()=>db.query('insert into public.eventos_animais(id,fazenda_id,evento_id,animal_id) values($1,$2,$3,$4)',[randomUUID(),farm,eventId,animal]),owner),'42501');
        await sqlError(()=>withRole(db,'authenticated',()=>db.query("insert into public.insumo_movimentacoes(id,fazenda_id,source_evento_id,tipo) values($1,$2,$3,'consumo_sanitario')",[randomUUID(),farm,eventId]),owner),'42501');
      });
      await t.test('legacy_receipts_and_claims_remain_unchanged_after_admission',async()=>{
        const legacy=(await db.query('select * from public.sanitario_sync_v2_operations where contract_version=2 order by operation_kind limit 12')).rows;
        assert.ok(legacy.length);
        for(const r of legacy) {
          const receipt=await withRole(db,'service_role',async()=>(await db.query('select public.internal_sanitario_get_receipt($1,$2,$3,$4,$5,$6,$7) r',
            [r.actor_user_id,r.fazenda_id,r.operation_kind,r.entity_id,r.client_op_id,r.domain_op_id,r.request_fingerprint])).rows[0].r);
          assert.deepEqual(receipt,{outcome:'found',canonical_result:r.canonical_result});
        }
        const existing=(await db.query('select * from public.sanitario_atendimentos limit 1')).rows[0]; assert.ok(existing);
        const claim=await withRole(db,'service_role',async()=>(await db.query('select public.internal_sanitario_claim_atendimento($1,$2,$3,$4) r',[existing.fazenda_id,existing.obrigacao_origem_agenda_id,existing.animal_id,existing.evento_id])).rows[0].r);
        assert.equal(claim.outcome,'same_event');
        await sqlError(()=>withRole(db,'authenticated',()=>db.query('select public.internal_sanitario_claim_atendimento($1,$2,$3,$4)',[existing.fazenda_id,existing.obrigacao_origem_agenda_id,existing.animal_id,existing.evento_id]),owner),'42501');
      });
    });
  } finally {if(db.v31Candidate) await db.query('rollback'); await peer.end();await db.end();}
}
