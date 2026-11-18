// Run only against the task-owned disposable stack identified by the marker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

test('sync-batch HTTP/Auth: calendar CAS, RBAC, isolation and replay', { timeout: 120000 }, async () => {
  const project = process.env.REBANHOSYNC_CALENDAR_HTTP_WORKDIR;
  assert(project && readFileSync(`${project}/task-owned.marker`, 'utf8').trim() === 'rs-calendar-http-58431');
  const labels=JSON.parse(execFileSync('docker',['inspect','supabase_db_rs-calendar-http-58431','--format','{{json .Config.Labels}}'],{encoding:'utf8'}));
  assert.equal(labels['com.supabase.cli.project'],'rs-calendar-http-58431');
  assert.equal(resolve(labels['com.supabase.cli.workdir']).toLowerCase(),resolve(project).toLowerCase());
  const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', project, '-o', 'json'], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }));
  assert.equal(new URL(status.API_URL).hostname, '127.0.0.1');
  assert.equal(new URL(status.API_URL).port, '58431');
  assert.equal(new URL(status.DB_URL).hostname, '127.0.0.1');
  assert.equal(new URL(status.DB_URL).port, '58432');
  const database = new pg.Client({ connectionString:status.DB_URL });
  await database.connect();
  const listener=createServer();
  await new Promise((ok,fail)=>listener.once('error',fail).listen(0,'127.0.0.1',ok));
  const port=listener.address().port;
  await new Promise(ok=>listener.close(ok));
  const source=pathToFileURL(resolve('supabase/functions/sync-batch/index.ts')).href;
  const bootstrap=`const serve=Deno.serve.bind(Deno); Deno.serve=(handler)=>serve({port:${port},hostname:'127.0.0.1'},handler); await import(${JSON.stringify(source)});`;
  const endpoint=`http://127.0.0.1:${port}`;
  const proc = spawn('deno', ['eval','--no-lock','--allow-env','--allow-net','--allow-read',bootstrap], {
    cwd:process.cwd(), env:{...process.env,SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY}, stdio:'ignore',
  });
  try {
    let ready=false;
    for(let n=0;n<150;n++) {
      if(proc.exitCode!==null) throw Error(`Deno server exited (${proc.exitCode})`);
      try {
        const response=await fetch(endpoint, {signal:AbortSignal.timeout(500)});
        const listeners=execFileSync('netstat',['-ano','-p','tcp'],{encoding:'utf8'}).split(/\r?\n/);
        const owned=listeners.some(line=>line.includes(`127.0.0.1:${port}`) && line.includes('LISTENING') && line.trim().split(/\s+/).at(-1)===String(proc.pid));
        if(response.status===401 && owned && proc.exitCode===null){ready=true;break;}
      } catch {}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert(ready, 'sync-batch did not start');
    async function signup() {
      const client=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await client.auth.signUp({email:`${randomUUID()}@example.test`,password:`${randomUUID()}Aa1!`});
      assert.ifError(error); assert(data.session && data.user); return {client,user:data.user,token:data.session.access_token};
    }
    const owner=await signup(), cowboy=await signup(), outsider=await signup();
    const farm=randomUUID(), other=randomUUID();
    await database.query('insert into public.fazendas(id,nome) values($1,$2),($3,$4)',[farm,'Fixture A',other,'Fixture B']);
    await database.query("insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,'owner'),($3,$2,'cowboy'),($4,$5,'owner')",[owner.user.id,farm,cowboy.user.id,outsider.user.id,other]);
    await database.query("insert into public.fazenda_sanidade_config(fazenda_id,payload) values($1,$2::jsonb)",[farm,JSON.stringify({ sibling:{keep:true},activated_template_slugs:['legacy'] })]);
    const op=(farmId,revision,variant='5-7-9')=>({domain:'sanitary_strategic_calendar_v1',contract_version:1,fazenda_id:farmId,client_op_id:randomUUID(),client_tx_id:randomUUID(),expected_revision:revision,variant});
    async function send(actor,command) {
      const res=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${actor.token}`,'content-type':'application/json'},body:JSON.stringify({client_id:'http-fixture',fazenda_id:command.fazenda_id,client_tx_id:command.client_tx_id,ops:[command]})});
      return {status:res.status,body:await res.json()};
    }
    const first=op(farm,0); const applied=await send(owner,first);
    assert.equal(applied.status,200); assert.equal(applied.body.results[0].status,'APPLIED');
    assert.equal(applied.body.results[0].canonical_result.calendar.variant,'5-7-9');
    const concurrent=await Promise.all([send(owner,op(farm,1,'5-6-9')),send(owner,op(farm,1,'5-7-9'))]);
    assert.deepEqual(concurrent.map(x=>x.body.results[0].status).sort(),['APPLIED','CONFLICT']);
    const replay=await send(owner,first);
    assert.deepEqual(replay.body.results[0].canonical_result,applied.body.results[0].canonical_result);
    const reused=await send(owner,{...first,variant:'5-6-9'});
    assert.equal(reused.body.results[0].status,'REJECTED');
    const denied=await send(cowboy,op(farm,2)); assert.equal(denied.body.results[0].status,'REJECTED');
    assert.equal((await send(outsider,op(farm,2))).status,403);
    assert.equal((await send(outsider,op(other,0,'5-6-9'))).body.results[0].status,'APPLIED');
    const {data,error}=await owner.client.from('fazenda_sanidade_config').select('payload').eq('fazenda_id',farm).single();
    assert.ifError(error); assert.deepEqual(data.payload.sibling,{keep:true}); assert.deepEqual(data.payload.activated_template_slugs,['legacy']);
    assert.equal(data.payload.sanitary_strategic_calendar_v1.revision,2);
    const otherRead=await owner.client.from('fazenda_sanidade_config').select('fazenda_id').eq('fazenda_id',other);
    assert.ifError(otherRead.error); assert.deepEqual(otherRead.data,[]);
    const counts=await database.query('select (select count(*) from public.sanitario_agenda_v2) agendas,(select count(*) from public.eventos) events,(select count(*) from public.insumo_movimentacoes) stock');
    assert.deepEqual(counts.rows[0],{agendas:'0',events:'0',stock:'0'});
  } finally { proc.kill(); await database.end(); }
});
