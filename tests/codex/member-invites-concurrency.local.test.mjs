import { before, after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const env=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
for(const k of ['API_URL','DB_URL'])assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(env[k]).hostname),'Local only');
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db=new pg.Client({connectionString:env.DB_URL});
const actors={};const run=randomUUID();let farm;
function must(r){if(r.error)throw new Error(r.error.message);return r.data;}
before(async()=>{
  await db.connect();
  for(const name of ['a','b','manager','cowboy','outsider']){
    const email=`j04-roles-${name}-${run}@example.test`,password=randomUUID()+'-Aa1!';
    const user=must(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
    const client=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    must(await client.auth.signInWithPassword({email,password}));actors[name]={id:user.id,email,client};
  }
  farm=must(await actors.a.client.rpc('create_fazenda',{_nome:`J04 isolated role contract ${run}`}));
  for(const [name,role] of [['b','owner'],['manager','manager'],['cowboy','cowboy']]){
    const invite=must(await actors.a.client.rpc('create_invite',{_fazenda_id:farm,_email:actors[name].email,_role:role}));
    must(await actors[name].client.rpc('accept_invite',{_token:invite.token}));
  }
  console.log(JSON.stringify({fixture_run:run,farm,user_ids:Object.values(actors).map(a=>a.id),scope:'new isolated test actors only; no journey identity/farm used; fixtures retained'}));
});
async function resetOwners(){await db.query(`update public.user_fazendas set role='owner',deleted_at=null where fazenda_id=$1 and user_id=any($2::uuid[])`,[farm,[actors.a.id,actors.b.id]]);}
beforeEach(resetOwners);
afterEach(resetOwners);
after(async()=>{await db.end();});
const change=(who,target,role)=>actors[who].client.rpc('admin_set_member_role',{_fazenda_id:farm,_target_user_id:actors[target].id,_new_role:role});
const remove=who=>actors[who].client.rpc('admin_remove_member',{_fazenda_id:farm,_target_user_id:actors[who].id});
async function oneOwner(){assert.equal(Number((await db.query(`select count(*) from public.user_fazendas where fazenda_id=$1 and role='owner' and deleted_at is null`,[farm])).rows[0].count),1);}
test('concurrent authenticated self-demotions preserve one owner',async()=>{
  const results=await Promise.all([change('a','a','manager'),change('b','b','manager')]);
  assert.equal(results.filter(r=>r.error).length,1);await oneOwner();
});
test('concurrent authenticated self-removals preserve one owner',async()=>{
  const results=await Promise.all([remove('a'),remove('b')]);
  assert.equal(results.filter(r=>r.error).length,1);await oneOwner();
});
test('mixed concurrent demotion/removal preserves one owner',async()=>{
  const results=await Promise.all([change('a','a','manager'),remove('b')]);
  assert.equal(results.filter(r=>r.error).length,1);await oneOwner();
});
test('real manager cannot demote/remove owner or assign owner',async()=>{
  assert.ok((await change('manager','a','cowboy')).error);
  assert.ok((await actors.manager.client.rpc('admin_remove_member',{_fazenda_id:farm,_target_user_id:actors.a.id})).error);
  assert.ok((await change('manager','cowboy','owner')).error);
});
test('real cowboy and outsider cannot administer membership',async()=>{
  assert.ok((await change('cowboy','manager','cowboy')).error);
  assert.ok((await change('outsider','manager','cowboy')).error);
});
test('membership reads remain scoped for actual owner/manager/cowboy/outsider JWTs',async()=>{
  for(const who of ['a','manager','cowboy','outsider']){
    const data=must(await actors[who].client.from('user_fazendas').select('user_id,role').eq('fazenda_id',farm));
    assert.equal(data.length,who==='outsider'?0:4);
  }
});

test('actual wrong recipient cannot accept another verified email invitation',async()=>{
  const invite=must(await actors.a.client.rpc('create_invite',{_fazenda_id:farm,_email:actors.cowboy.email,_role:'manager'}));
  assert.ok((await actors.outsider.client.rpc('accept_invite',{_token:invite.token})).error);
  assert.equal((await db.query('select count(*)::integer as count from public.user_fazendas where fazenda_id=$1 and user_id=$2',[farm,actors.outsider.id])).rows[0].count,0);
  must(await actors.a.client.rpc('cancel_invite',{_invite_id:invite.id}));
});

test('actual active member cannot escalate through a new owner invitation',async()=>{
  const invite=must(await actors.a.client.rpc('create_invite',{_fazenda_id:farm,_email:actors.cowboy.email,_role:'owner'}));
  assert.ok((await actors.cowboy.client.rpc('accept_invite',{_token:invite.token})).error);
  assert.equal((await db.query('select role from public.user_fazendas where fazenda_id=$1 and user_id=$2',[farm,actors.cowboy.id])).rows[0].role,'cowboy');
  must(await actors.a.client.rpc('cancel_invite',{_invite_id:invite.id}));
});
