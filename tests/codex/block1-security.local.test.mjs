import { before, after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// Rollback-only fixtures; never alter journey farms or identities.
const env = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DB_URL).hostname));
const db = new pg.Client({ connectionString: env.DB_URL });
const ids = Object.fromEntries(['farm', 'otherFarm', 'owner', 'manager', 'cowboy', 'outsider'].map(k => [k, randomUUID()]));
before(async () => {
  await db.connect(); await db.query('begin');
  if (process.env.BLOCK1_MIGRATION) await db.query(readFileSync(process.env.BLOCK1_MIGRATION, 'utf8'));
  for (const role of ['owner', 'manager', 'cowboy', 'outsider']) await db.query('insert into auth.users(id,email) values($1,$2)', [ids[role], `${ids[role]}@example.test`]);
  for (const key of ['farm', 'otherFarm']) await db.query("insert into public.fazendas(id,nome,created_by,metadata) values($1,'Block1 rollback fixture',$2,$3)", [ids[key], ids.owner, {keep: {nested: 42}, eventos_rollout: {strict_rules_enabled:true, strict_anti_teleporte:true}}]);
  for (const role of ['owner', 'manager', 'cowboy']) await db.query('insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,$3,now())', [ids[role], ids.farm, role]);
  // Being owner elsewhere must not grant owner authority here.
  await db.query("insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,'owner',now())", [ids.manager,ids.otherFarm]);
});
after(async () => { await db.query('rollback'); await db.end(); });
beforeEach(async () => db.query('savepoint case_start'));
afterEach(async () => db.query('rollback to savepoint case_start'));
async function as(role, sql, params=[]) {
  await db.query('savepoint invocation');
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:ids[role],role:'authenticated',user_metadata:{role:'owner'}})]);
    await db.query('set local role authenticated');
    const result = await db.query(sql,params);
    await db.query('reset role'); await db.query('release savepoint invocation'); return result;
  } catch (e) { await db.query('rollback to savepoint invocation'); throw e; }
}
const metadata = async () => (await db.query('select metadata from public.fazendas where id=$1',[ids.farm])).rows[0].metadata;
const update = (role,value,farm=ids.farm) => as(role,'update public.fazendas set metadata=$1 where id=$2 returning metadata',[value,farm]);
test('owner can change both protected flags preserving unrelated metadata',async()=>{
  const value=await metadata(); value.eventos_rollout={strict_rules_enabled:false,strict_anti_teleporte:false};
  assert.equal((await update('owner',value)).rowCount,1); assert.deepEqual(await metadata(),value);
});
for (const flag of ['strict_rules_enabled','strict_anti_teleporte']) test(`manager cannot change ${flag}, even as owner of another farm or with editable claims`,async()=>{
  const value=await metadata(); value.eventos_rollout[flag]=false;
  await assert.rejects(update('manager',value),/propriet.rio|owner/i); assert.equal((await metadata()).eventos_rollout[flag],true);
});
test('manager can change unrelated metadata and farm data',async()=>{
  const value=await metadata(); value.preference='kg';
  assert.equal((await update('manager',value)).rowCount,1);
  assert.equal((await as('manager',"update public.fazendas set nome='Permitted edit' where id=$1 returning id",[ids.farm])).rowCount,1);
  assert.deepEqual(await metadata(),value);
});
test('cowboy and outsider cannot update farm data',async()=>{
  for (const role of ['cowboy','outsider']) assert.equal((await update(role,{})).rowCount,0);
});
test('stale full metadata cannot silently restore owner flag change',async()=>{
  const stale=await metadata(), changed=structuredClone(stale); changed.eventos_rollout.strict_rules_enabled=false;
  await update('owner',changed); stale.preference='arroba';
  await assert.rejects(update('manager',stale),/propriet.rio|owner/i); assert.deepEqual(await metadata(),changed);
});
test('omitting or corrupting namespace cannot remove an existing false protection',async()=>{
  const changed=await metadata(); changed.eventos_rollout.strict_rules_enabled=false; await update('owner',changed);
  for(const value of [{keep:42},{eventos_rollout:null},{eventos_rollout:{strict_rules_enabled:'false'}}]) await assert.rejects(update('manager',value),/propriet.rio|owner/i);
});
test('implicit true defaults permit manager to send unchanged effective flags',async()=>{
  await db.query("update public.fazendas set metadata='{}' where id=$1",[ids.farm]);
  assert.equal((await update('manager',{eventos_rollout:{strict_rules_enabled:true,strict_anti_teleporte:true},preference:'kg'})).rowCount,1);
});
test('revoked owner cannot change protected flags',async()=>{
  await db.query('update public.user_fazendas set deleted_at=now() where user_id=$1',[ids.owner]);
  assert.equal((await update('owner',{})).rowCount,0);
});
test('profile first save, update and cross-identity writes obey existing RLS',async()=>{
  assert.equal((await as('owner',"insert into public.user_profiles(user_id,display_name) values($1,'First') on conflict(user_id) do update set display_name=excluded.display_name returning user_id",[ids.owner])).rowCount,1);
  assert.equal((await as('owner',"insert into public.user_profiles(user_id,display_name) values($1,'Second') on conflict(user_id) do update set display_name=excluded.display_name returning display_name",[ids.owner])).rows[0].display_name,'Second');
  assert.equal((await as('manager',"update public.user_profiles set display_name='Spoof' where user_id=$1 returning user_id",[ids.owner])).rowCount,0);
  await assert.rejects(as('manager',"insert into public.user_profiles(user_id,display_name) values($1,'Spoof') on conflict(user_id) do update set display_name=excluded.display_name",[ids.owner]),/row.level security/i);
});
