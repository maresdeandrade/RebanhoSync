import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';

const env=JSON.parse(execFileSync('supabase',['status','--workdir','.work/block1/disposable','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(new URL(env.DB_URL).hostname,'127.0.0.1');assert.equal(new URL(env.DB_URL).port,'54422');
async function authenticate(db,id){await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);await db.query('set local role authenticated');}
async function blocked(observer,pid){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){if((await observer.query("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,25));}
  throw Error('Contending transaction did not wait on row lock');
}
test('row lock rejects stale manager payload and authority revoked while UPDATE waits',async()=>{
  const a=new pg.Client({connectionString:env.DB_URL}),b=new pg.Client({connectionString:env.DB_URL}),observer=new pg.Client({connectionString:env.DB_URL});
  await Promise.all([a.connect(),b.connect(),observer.connect()]);
  const farm=randomUUID(),owner=randomUUID(),second=randomUUID(),manager=randomUUID();
  try{
    await a.query('begin');
    for(const id of [owner,second,manager])await a.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@example.test`]);
    await a.query("insert into public.fazendas(id,nome,created_by) values($1,'Block1 isolated concurrency',$2)",[farm,owner]);
    for(const [id,role]of [[owner,'owner'],[second,'owner'],[manager,'manager']])await a.query('insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,$3,now())',[id,farm,role]);
    await a.query('commit');
    const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
    await a.query('begin');await authenticate(a,owner);
    await a.query(`update public.fazendas set metadata='{"eventos_rollout":{"strict_rules_enabled":false}}' where id=$1`,[farm]);
    await b.query('begin');await authenticate(b,manager);
    const stale=b.query(`update public.fazendas set metadata='{"eventos_rollout":{"strict_rules_enabled":true},"preference":"kg"}' where id=$1`,[farm]).then(()=>null,e=>e);
    await blocked(observer,pid);await a.query('commit');
    assert.match((await stale)?.message??'',/propriet.rio/i);await b.query('rollback');
    // A demotion serialized by the J04 farm lock must be visible to the trigger.
    await a.query('begin');await authenticate(a,second);
    await a.query("select public.admin_set_member_role($1,$2,'manager')",[farm,owner]);
    await b.query('begin');await authenticate(b,owner);
    const revoked=b.query(`update public.fazendas set metadata='{"eventos_rollout":{"strict_rules_enabled":true}}' where id=$1`,[farm]).then(()=>null,e=>e);
    await blocked(observer,pid);await a.query('commit');
    assert.match((await revoked)?.message??'',/propriet.rio/i);await b.query('rollback');
    const current=(await observer.query('select metadata from public.fazendas where id=$1',[farm])).rows[0].metadata;
    assert.equal(current.eventos_rollout.strict_rules_enabled,false);
    console.log(JSON.stringify({farm,scope:'isolated disposable database; synthetic fixture retained'}));
  }finally{await Promise.allSettled([a.query('rollback'),b.query('rollback')]);await Promise.all([a.end(),b.end(),observer.end()]);}
});
