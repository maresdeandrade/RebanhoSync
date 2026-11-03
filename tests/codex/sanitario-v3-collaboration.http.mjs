// fallow-ignore-file unused-file -- Manual disposable integration entry; run with node --test.
// New, task-owned HTTP stack only. No existing container, network or credential is adopted.
// Run: node --test tests/codex/sanitario-v3-collaboration.http.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
const label = 'rebanhosync.v3.http.run';
const run = randomUUID();
const prefix = `rebanhosync-v3-http-${run.slice(0,8)}`;
const docker = (args, options = {}) => execFileSync('docker', args, { encoding:'utf8', stdio:['pipe','pipe','pipe'], maxBuffer:8*1024*1024, ...options }).trim();
const secret = randomBytes(48).toString('hex');
const password = randomBytes(32).toString('hex');
const jwt = (claims) => {
  const head = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify({iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url');
  return `${head}.${body}.${createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url')}`;
};
const anon = jwt({role:'anon'}), service = jwt({role:'service_role'});
const created = [];
const delay = ms => new Promise(r=>setTimeout(r,ms));
const db = `${prefix}-db`, auth = `${prefix}-auth`, rest = `${prefix}-rest`, edge = `${prefix}-edge`, gateway = `${prefix}-gateway`;
const sql = (input,user='postgres') => docker(['exec','-i',db,'psql','-XqAt','-U',user,'-d','postgres','-v','ON_ERROR_STOP=1'],{input});
const create = (name,image,env={},extra=[],command=[]) => {
  const id = docker(['create','--name',name,'--network',prefix,'--label',`${label}=${run}`,
    ...Object.keys(env).flatMap(k=>['--env',k]),...extra,image,...command],{env:{...process.env,...env}});
  created.push(id);
  docker(['start',id]);
  return id;
};
const port = name => {
  const parsed = JSON.parse(docker(['inspect',name]))[0];
  assert.equal(parsed.Config.Labels[label],run);
  const bindings = Object.values(parsed.NetworkSettings.Ports).flat().filter(Boolean);
  assert.equal(bindings.length,1);
  assert.equal(bindings[0].HostIp,'127.0.0.1');
  return `http://127.0.0.1:${bindings[0].HostPort}`;
};
const ready = async (name,check) => {
  for(let i=0;i<120;i++) {
    const target={edge,auth,rest}[name];
    if(target && JSON.parse(docker(['inspect',target]))[0].State.Status==='exited') throw Error(`HTTP_FIXTURE_EXITED:${name}`);
    try { if(await check()) return; } catch {} await delay(250);
  }
  throw Error(`HTTP_FIXTURE_NOT_READY:${name}`);
};

test('Agenda V3 through real Auth, Edge, RPC, PostgreSQL and authenticated pull',async t=>{
  const dir = mkdtempSync(path.join(tmpdir(),'rebanhosync-v3-http-'));
  let base;
  try {
    docker(['network','create','--label',`${label}=${run}`,prefix]);
    create(db,'public.ecr.aws/supabase/postgres:17.6.1.167',{POSTGRES_HOST_AUTH_METHOD:'trust'});
    await ready('postgres',()=>{docker(['exec',db,'pg_isready','-h','127.0.0.1','-U','postgres']);return true;});
    for(const f of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) sql(readFileSync(`supabase/migrations/${f}`,'utf8'));
    sql(`alter role authenticator password '${password}'; alter role supabase_auth_admin password '${password}';`,'supabase_admin');
    const gatewayCode = `Deno.serve({port:9000},async req=>{ const u=new URL(req.url); const match=u.pathname.startsWith('/auth/v1')?['/auth/v1','${auth}:9999']:u.pathname.startsWith('/rest/v1')?['/rest/v1','${rest}:3000']:['/functions/v1','${edge}:9000']; const target='http://'+match[1]+u.pathname.slice(match[0].length)+u.search; try {return await fetch(new Request(target,req));} catch {return new Response('Fixture dependency unavailable',{status:502});} });`;
    writeFileSync(path.join(dir,'index.ts'),gatewayCode);
    create(rest,'public.ecr.aws/supabase/postgrest:v16.2',{
      PGRST_DB_URI:`postgres://authenticator:${password}@${db}:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_DB_EXTRA_SEARCH_PATH:'public,extensions',
    });
    create(auth,'public.ecr.aws/supabase/gotrue:v2.196.0',{
      GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:`http://${gateway}:9000/auth/v1`,
      GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@${db}:5432/postgres`,
      GOTRUE_SITE_URL:'http://localhost',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
      GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_RATE_LIMIT_EMAIL_SENT:'100',
    });
    create(gateway,'public.ecr.aws/supabase/edge-runtime:v1.74.3',{},['--publish','127.0.0.1::9000','--mount',`type=bind,src=${dir},dst=/main,readonly`],['start','--main-service','/main']);
    create(edge,'public.ecr.aws/supabase/edge-runtime:v1.74.3',{
      SUPABASE_URL:`http://${gateway}:9000`,SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,
    },['--mount',`type=bind,src=${path.resolve('supabase/functions')},dst=/repo/supabase/functions,readonly`,'--mount',`type=bind,src=${path.resolve('src')},dst=/repo/src,readonly`],['start','--main-service','/repo/supabase/functions/sync-batch']);
    base=port(gateway);
    const api=async(route,token,method='GET',body)=>{
      const response=await fetch(base+route,{method,headers:{apikey:anon,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
      const text=await response.text();
      let data; try {data=JSON.parse(text);} catch {data={error:'NON_JSON_RESPONSE'};}
      return {status:response.status,data};
    };
    await ready('auth',async()=> (await api('/auth/v1/health')).status===200);
    await ready('rest',async()=> (await api('/rest/v1/',anon)).status===200);
    await ready('edge',async()=> (await api('/functions/v1/sync-batch')).status===401);
    const users=[];
    for(const role of ['owner','manager','cowboy','outsider']) {
      const credentials={email:`${role}-${run}@example.test`,password:randomBytes(24).toString('hex')};
      const r=await api('/auth/v1/signup',null,'POST',credentials);
      assert.equal(r.status,200,`Auth signup ${role}: ${r.data.error_code??'unexpected response'}`);
      assert(r.data.user?.id && r.data.access_token,'AUTH_CONFIRMED_SESSION_REQUIRED');
      const signed=await api('/auth/v1/token?grant_type=password',null,'POST',credentials);
      assert.equal(signed.status,200); assert(signed.data.access_token);
      users.push({role,id:r.data.user.id,token:signed.data.access_token});
    }
    const [owner,manager,cowboy,outsider]=users;
    const farm=randomUUID(),other=randomUUID(),animals=Array.from({length:30},randomUUID),foreign=randomUUID(),agenda=randomUUID();
    sql(`insert into public.fazendas(id,nome) values('${farm}','HTTP V3 fixture'),('${other}','HTTP other');
      insert into public.user_fazendas(user_id,fazenda_id,role) values ${users.map(u=>`('${u.id}','${u===outsider?other:farm}','${u===outsider?'owner':u.role}')`).join(',')};
      insert into public.animais(id,fazenda_id,identificacao,sexo) values ${animals.map(id=>`('${id}','${farm}','${id}','F')`).join(',')},('${foreign}','${other}','foreign','F');
      insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values('${farm}',true,3,3,'ready');`);
    const op=(command,payload)=>({domain:'sanitario_v2',command,contract_version:3,client_op_id:randomUUID(),client_tx_id:randomUUID(),domain_op_id:randomUUID(),payload});
    const manage=(action,extra={})=>op('manage_agenda',{agenda_id:agenda,action,...extra});
    const envelope=(operation,f=farm)=>({client_id:'http-fixture-device',fazenda_id:f,client_tx_id:operation.client_tx_id,ops:[operation]});
    const send=async(operation,user=owner)=>{
      const r=await api('/functions/v1/sync-batch',user.token,'POST',envelope(operation));
      assert.equal(r.status,200,`Edge response ${r.status}`);
      assert.equal(r.data.results?.length,1);
      return r.data.results[0];
    };
    const applied=async(operation,user=owner)=>{
      const r=await send(operation,user); assert.equal(r.status,'APPLIED',r.reason_code); return r.canonical_result;
    };
    const pull=async(table,filter='',user=owner)=>{
      const r=await api(`/rest/v1/${table}?select=*&${filter}`,user.token); assert.equal(r.status,200); assert(Array.isArray(r.data));return r.data;
    };
    await t.test('real Auth tokens, expired JWT and farm-switch are enforced',async()=>{
      const operation=manage('prepare_close');
      for(const token of [null,'invalid',jwt({sub:owner.id,role:'authenticated',aud:'authenticated',exp:1})])
        assert.equal((await api('/functions/v1/sync-batch',token,'POST',envelope(operation))).status,401);
      assert.equal((await api('/functions/v1/sync-batch',outsider.token,'POST',envelope(operation))).status,403);
      assert.equal((await api('/functions/v1/sync-batch',owner.token,'POST',envelope(operation,other))).status,403);
    });
    await applied(op('create_agenda',{agenda:{id:agenda,dedup_key:agenda,janela_inicio:'2026-10-30',data_programada:'2026-10-30',acao_sanitaria:'vacinacao',client_recorded_at:'2026-10-30T12:00:00Z'},animal_ids:animals}));
    const p1=randomUUID(),p2=randomUUID();
    await t.test('Owner and Cowboy participation; Cowboy manager actions and direct RPC denied',async()=>{
      await applied(manage('participate',{participation_id:p1}));
      await applied(manage('participate',{participation_id:p2}),cowboy);
      for(const action of ['prepare_close','confirm_close','resolve','decide_continuation'])
        assert.equal((await send(manage(action),cowboy)).status,'REJECTED');
      for(const user of [owner,manager,cowboy,outsider]) {
        const r=await api('/rest/v1/rpc/internal_sanitario_admit_v3',user.token,'POST',{actor_user_id:user.id,fazenda_id:farm,command:'manage_agenda',operation_args:{},receipt_only:false});
        assert([401,403].includes(r.status),'DIRECT_AUTHENTICATED_RPC_DENIED');
      }
    });
    const group=(ids,participant,sequence)=>({...op('apply_factual_core',{
      event:{id:randomUUID(),natureza:'primary_execution',source_sanitario_agenda_v2_id:agenda,occurred_at:'2026-10-30T12:00:00Z',client_recorded_at:'2026-10-30T12:00:00Z',payload:{sanitario_v3_progressive:true,participation_id:participant,participation_sequence:sequence}},
      detail:{tipo:'vacinacao',produto_nome_snapshot:'Produto HTTP',dose_quantidade:2,dose_unidade:'mL',via_aplicacao:'SC'},event_animals:ids.map(animal_id=>({id:randomUUID(),animal_id})),
    }),expected_revision:0});
    const first=group(animals.slice(0,15),p1,1);
    await t.test('simultaneous operators, ACK replay, three Events and 25 attendance rows',async()=>{
      await Promise.all([applied(first),applied(group(animals.slice(15,20),p2,1),cowboy)]);
      await applied(group(animals.slice(20,25),p2,2),cowboy);
      const replay=await applied(first);
      assert.equal(replay.evento_id,first.payload.event.id);
      assert.equal((await pull('sanitario_atendimentos',`fazenda_id=eq.${farm}`)).length,25);
      assert.equal((await pull('eventos',`source_sanitario_agenda_v2_id=eq.${agenda}`)).length,3);
      const rejected=await send(group([foreign],p2,3),cowboy); assert.notEqual(rejected.status,'APPLIED');
    });
    const reasons=animals.slice(25).map(animal_id=>({animal_id,reason:'Não localizado'}));
    let closed;
    await t.test('Manager resolves collision; missing participant sequence and duplicate not_executed block closure',async()=>{
      assert.equal((await send(manage('prepare_close'),manager)).reason_code,'SANITARIO_PARTICIPANTS_INCOMPLETE');
      await applied(manage('complete',{participation_id:p1,final_sequence:1}));
      await applied(manage('complete',{participation_id:p2,final_sequence:3}),cowboy);
      assert.equal((await send(manage('prepare_close'),manager)).reason_code,'SANITARIO_PARTICIPANTS_INCOMPLETE');
      const collision=group([animals[0]],p2,3);
      assert.equal((await send(collision,cowboy)).status,'CONFLICT');
      assert.equal((await send(manage('prepare_close'),manager)).reason_code,'SANITARIO_UNRESOLVED_EVIDENCE');
      await applied(manage('resolve',{declaration_id:collision.client_op_id,decision:'duplicate',reason:'Mesma aplicação'}),manager);
      assert.equal((await send(manage('prepare_close',{not_executed:[...reasons,reasons[0]]}),manager)).reason_code,'SANITARIO_NOT_EXECUTED_TARGET_INVALID');
    });
    await t.test('Manager closes partial result; replay and pull retain date, snapshot and individual facts',async()=>{
      const barrier=await applied(manage('prepare_close',{not_executed:reasons}),manager);
      const close=manage('confirm_close',{barrier_id:barrier.barrier_id});
      closed=await applied(close,manager);
      assert.deepEqual(await applied(close,manager),closed);
      assert.equal(closed.snapshot.outcome,'partial');
      assert.equal(closed.snapshot.animals.filter(a=>a.planned_status==='nao_executado').length,5);
      assert.equal(closed.snapshot.agenda.data_programada,'2026-10-30');
      assert.equal((await pull('sanitario_agenda_v2',`id=eq.${agenda}`))[0].status,'fechada');
      assert.equal((await pull('sanitario_agenda_resultados',`agenda_id=eq.${agenda}`)).length,1);
      assert.equal((await applied(first)).evento_id,first.payload.event.id);
    });
    await t.test('RLS pull and direct writes isolate all collaboration tables across tenants',async()=>{
      for(const table of ['sanitario_agenda_v2','sanitario_participacoes','sanitario_participacao_operacoes','sanitario_agenda_resultados']) {
        assert.equal((await pull(table,`fazenda_id=eq.${farm}`,outsider)).length,0);
      }
      const forbidden=await api('/rest/v1/sanitario_participacoes',cowboy.token,'POST',{id:randomUUID(),fazenda_id:farm,agenda_id:agenda,actor_user_id:cowboy.id,client_id:'direct'});
      assert.equal(forbidden.status,403);
    });
    await t.test('Cowboy requests; Owner rejects without creation and Manager approves only once',async()=>{
      const request=()=>manage('request_continuation',{result_id:closed.result_id,animals:reasons,reason:'Retomar pendentes'});
      const rejected=await applied(request(),cowboy);
      await applied(manage('decide_continuation',{request_id:rejected.request_id,decision:'rejected',reason:'Aguardar'}));
      assert.equal((await pull('sanitario_agenda_v2',`metadata->>source_agenda_id=eq.${agenda}`)).length,0);
      const pending=await applied(request(),cowboy);
      const decide=manage('decide_continuation',{request_id:pending.request_id,decision:'approved',reason:'Manejo autorizado',planned_for:'2026-11-03'});
      const child=await applied(decide,manager); assert.deepEqual(await applied(decide,manager),child);
      const second=await applied(request(),cowboy);
      assert.notEqual((await send(manage('decide_continuation',{request_id:second.request_id,decision:'approved',reason:'Duplicada',planned_for:'2026-11-03'}),manager)).status,'APPLIED');
      const rows=await pull('sanitario_agenda_v2',`metadata->>source_agenda_id=eq.${agenda}`);
      assert.equal(rows.length,1);assert.equal(rows[0].obrigacao_origem_agenda_id,agenda);
      assert.equal((await pull('sanitario_agenda_animais_v2',`agenda_id=eq.${child.continuation_id}`)).length,5);
      assert.equal((await pull('sanitario_continuidade_solicitacoes',`fazenda_id=eq.${farm}`,outsider)).length,0);
    });
    await t.test('late operation and ACK remain durable; explicit rejection appends result without reopening',async()=>{
      const late=group([animals[25]],randomUUID(),1);
      const r=await send(late,cowboy); assert.equal(r.status,'CONFLICT');assert.equal(r.reason_code,'SANITARIO_LATE_RECORD');
      assert.deepEqual(await send(late,cowboy),r);
      assert.equal((await pull('eventos',`id=eq.${late.payload.event.id}`)).length,0);
      await applied(manage('reconcile_late',{declaration_id:late.client_op_id,decision:'rejected',reason:'Evidência não confirmada'}),manager);
      const declaration=(await pull('sanitario_participacao_operacoes',`id=eq.${late.client_op_id}`))[0];
      assert.equal(declaration.outcome,'late');assert.equal(declaration.resolution.decision,'rejected');
      const results=await pull('sanitario_agenda_resultados',`agenda_id=eq.${agenda}&order=revision.asc`);
      assert.equal(results.length,2); assert.deepEqual(results[0].snapshot,closed.snapshot);
      assert.equal((await pull('sanitario_agenda_v2',`id=eq.${agenda}`))[0].status,'fechada');
    });
    console.log('Task-owned HTTP stack verified; all published ports loopback; real Auth/Edge/PostgREST; no existing stack used.');
  } finally {
    for(const id of created.reverse()) {
      const inspect=JSON.parse(docker(['inspect',id]))[0];
      assert.equal(inspect.Id,id); assert.equal(inspect.Config.Labels[label],run);
      if(inspect.State.Running) docker(['stop','--time','3',id]);
    }
  }
});
