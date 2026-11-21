import { before, after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { readFileSync } from 'node:fs';

// Transactional fixtures only: no original journey data or memberships touched.
const env = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
for (const key of ['DB_URL', 'API_URL']) assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env[key]).hostname), 'Only local Supabase allowed');
const db = new pg.Client({ connectionString: env.DB_URL });
const ids = Object.fromEntries(['farm', 'owner', 'manager', 'cowboy', 'guest', 'wrong', 'unverified', 'invite'].map(k => [k, randomUUID()]));
before(async () => {
  await db.connect(); await db.query('begin');
  if(process.env.MEMBER_INVITES_TEST_MIGRATION) await db.query(readFileSync(process.env.MEMBER_INVITES_TEST_MIGRATION,'utf8'));
  for (const key of ['owner','manager','cowboy','guest','wrong','unverified']) await db.query(
    `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)`,
    [ids[key], `${key}-${ids.farm}@example.test`, key === 'unverified' ? null : new Date(), JSON.stringify({ phone: '+5511999988888' })]);
  await db.query(`insert into public.fazendas(id,nome,created_by) values($1,'J04 transactional fixture',$2)`, [ids.farm, ids.owner]);
  for (const role of ['owner','manager','cowboy']) await db.query(`insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,$3,now())`, [ids[role],ids.farm,role]);
});
after(async () => { await db.query('rollback'); await db.end(); });
beforeEach(async () => db.query('savepoint test_case'));
afterEach(async () => db.query('rollback to savepoint test_case'));
async function as(user, sql, params=[]) {
  await db.query('savepoint invocation');
  try {
    await db.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({sub:user,role:'authenticated'})]);
    await db.query('set local role authenticated');
    const result = await db.query(sql, params);
    await db.query('reset role'); await db.query('release savepoint invocation'); return result;
  } catch (error) { await db.query('rollback to savepoint invocation'); await db.query('release savepoint invocation'); throw error; }
}
async function invite(user='guest', role='cowboy', options={}) {
  const token=randomUUID();
  await db.query(`insert into public.farm_invites(fazenda_id,invited_by,email,role,token,status,created_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ids.farm,ids.owner,`${user}-${ids.farm}@example.test`,role,token,options.status??'pending',options.created??new Date(),options.expires??new Date(Date.now()+86400000)]);
  return token;
}
const accept=(user,token)=>as(ids[user], 'select public.accept_invite($1)',[token]);
const role=(caller,target,value)=>as(ids[caller], 'select public.admin_set_member_role($1,$2,$3)',[ids.farm,ids[target],value]);
const remove=(caller,target)=>as(ids[caller], 'select public.admin_remove_member($1,$2)',[ids.farm,ids[target]]);
const member=async user=>(await db.query('select role,deleted_at,accepted_at from public.user_fazendas where user_id=$1 and fazenda_id=$2',[ids[user],ids.farm])).rows[0];

test('recipient enters correct farm with authorized role',async()=>{
  await accept('guest',await invite()); assert.equal((await member('guest')).role,'cowboy');
});
test('wrong authenticated identity cannot accept another recipient invitation',async()=>{
  await assert.rejects(accept('wrong',await invite()),/email.*match|destinat.rio/i); assert.equal(await member('wrong'),undefined);
});
test('unconfirmed Auth email is not identity proof',async()=>{
  await assert.rejects(accept('unverified',await invite('unverified')),/confirm|verific/i);
});

async function phoneInvite() {
  const token=await invite();
  await db.query('update public.farm_invites set email=null,phone=$1 where token=$2',['5511999988888',token]);
  return token;
}
test('editable phone metadata cannot prove identity',async()=>{
  await assert.rejects(accept('guest',await phoneInvite()),/verific/i);
  assert.equal(await member('guest'),undefined);
});
test('matching but unverified Auth phone cannot prove identity',async()=>{
  await db.query('update auth.users set phone=$1 where id=$2',['5511999988888',ids.guest]);
  await assert.rejects(accept('guest',await phoneInvite()),/verific/i);
});
test('verified Auth phone must match destination',async()=>{
  await db.query('update auth.users set phone=$1,phone_confirmed_at=now() where id=$2',['5511888877777',ids.guest]);
  await assert.rejects(accept('guest',await phoneInvite()),/phone.*match/i);
});
test('matching verified Auth phone permits phone-only invitation',async()=>{
  await db.query('update auth.users set phone=$1,phone_confirmed_at=now() where id=$2',['5511999988888',ids.guest]);
  await accept('guest',await phoneInvite());assert.equal((await member('guest')).role,'cowboy');
});
test('replay of accepted invitation preserves subsequently changed role and joining date',async()=>{
  const token=await invite();await accept('guest',token);const joined=(await member('guest')).accepted_at;
  await role('owner','guest','manager');await accept('guest',token);
  assert.equal((await member('guest')).role,'manager');assert.deepEqual((await member('guest')).accepted_at,joined);
});
test('new invitation cannot silently change active membership role',async()=>{
  await assert.rejects(accept('cowboy',await invite('cowboy','owner')),/already.*member|j. faz parte/i);
  assert.equal((await member('cowboy')).role,'cowboy');
});
test('revoked membership cannot be restored with an older pending invitation',async()=>{
  const token=await invite('cowboy','manager',{created:new Date(Date.now()-86400000)});
  await remove('owner','cowboy');await assert.rejects(accept('cowboy',token),/novo convite|revog|deslig/i);
  assert.ok((await member('cowboy')).deleted_at);
});
test('new invitation issued after revocation permits explicit reentry',async()=>{
  await remove('owner','cowboy');await db.query(`update public.user_fazendas set deleted_at=now()-interval '1 day' where user_id=$1 and fazenda_id=$2`,[ids.cowboy,ids.farm]);
  await accept('cowboy',await invite('cowboy','manager'));assert.equal((await member('cowboy')).deleted_at,null);assert.equal((await member('cowboy')).role,'manager');
});
test('manager cannot demote owner',async()=>{
  await assert.rejects(role('manager','owner','cowboy'),/owner|propriet.rio/i);assert.equal((await member('owner')).role,'owner');
});
test('manager cannot remove owner',async()=>{
  await assert.rejects(remove('manager','owner'),/owner|propriet.rio/i);assert.equal((await member('owner')).deleted_at,null);
});
test('last owner cannot be demoted or removed',async()=>{
  await assert.rejects(role('owner','owner','manager'),/last owner|.ltimo propriet.rio/i);
  await assert.rejects(remove('owner','owner'),/last owner|.ltimo propriet.rio/i);
});
test('outsider cannot administer roles',async()=>{
  await assert.rejects(role('wrong','cowboy','manager'),/Forbidden|permiss/i);
});
test('owner may change non-owner role',async()=>{
  await role('owner','cowboy','manager');assert.equal((await member('cowboy')).role,'manager');
});
test('invalid email is rejected at server boundary',async()=>{
  await assert.rejects(as(ids.owner,'select public.create_invite($1,$2,null,$3)',[ids.farm,'not-an-email','cowboy']),/email|e-mail/i);
});
test('preview retains TABLE cardinality and identifies destination farm',async()=>{
  const token=await invite();const result=await as(ids.guest,'select * from public.get_invite_preview($1)',[token]);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].is_valid,true);assert.equal(result.rows[0].fazenda_id,ids.farm);
});
test('cancelled, accepted and expired previews are not valid',async()=>{
  for(const status of ['cancelled','accepted'])assert.equal((await as(ids.guest,'select * from public.get_invite_preview($1)',[await invite('guest','cowboy',{status})])).rows[0].is_valid,false);
  assert.equal((await as(ids.guest,'select * from public.get_invite_preview($1)',[await invite('guest','cowboy',{expires:new Date(Date.now()-86400000)})])).rows[0].is_valid,false);
});
