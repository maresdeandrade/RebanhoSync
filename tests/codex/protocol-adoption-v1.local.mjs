// Task-owned network-disabled PostgreSQL; never connects to existing resources.
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('protocol adoption: full chain, CAS, durable receipts, RBAC and legacy compatibility', async () => {
 const run = randomUUID();
 let cid;
 const docker = args => execFileSync('docker', args, { encoding:'utf8', stdio:['pipe','pipe','pipe'] }).trim();
 const quote = x => `'${String(x).replaceAll("'", "''")}'`;
 const sql = input => new Promise((resolve,reject) => {
   const child=spawn('docker',['exec','-i',cid,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);
   let out='',err=''; child.stdout.on('data',x=>out+=x); child.stderr.on('data',x=>err+=x);
   child.on('error',reject); child.on('exit',code=>code?reject(Error(err)):resolve(out.trim())); child.stdin.end(input);
 });
 try {
   cid=docker(['run','--rm','--detach','--network','none','--label',`rebanhosync.adoption.run=${run}`,'--env','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.167']);
   let ready=false;
   for(let i=0;i<100;i++) { try { docker(['exec',cid,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break; } catch { await new Promise(r=>setTimeout(r,200)); } }
   assert(ready);
   for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) await sql(readFileSync(`supabase/migrations/${file}`,'utf8'));
   const operationalState=()=>sql(`select jsonb_build_object(
     'agendas',(select count(*) from public.sanitario_agenda_v2),
     'events',(select count(*) from public.eventos),
     'sanitary_events',(select count(*) from public.eventos_sanitario),
     'stock',(select count(*) from public.insumo_movimentacoes),
     'animals',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.animais a),'[]'::jsonb)
   )`);
   const operationalBefore=await operationalState();
   const owner=randomUUID(), manager=randomUUID(), cowboy=randomUUID(), outsider=randomUUID(), farm=randomUUID(), other=randomUUID();
   await sql(`insert into auth.users(id) values('${owner}'),('${manager}'),('${cowboy}'),('${outsider}');
     insert into public.fazendas(id,nome) values('${farm}','Adoption isolated fixture'),('${other}','Other');
     insert into public.user_fazendas(user_id,fazenda_id,role) values('${owner}','${farm}','owner'),('${manager}','${farm}','manager'),('${cowboy}','${farm}','cowboy'),('${outsider}','${other}','owner');`);
   const codes=['brucelose_b19','clostridioses','raiva_herbivoros','ibr_bvd','leptospirose','vermifugacao_pre_desmama','matrizes_pre_parto','controle_parasitario_recria_5_7_9','vermifugacao_pre_confinamento_pasto_vedado'];
   const families=Object.fromEntries(codes.map(code=>[code,{monitoringEnabled:code!==codes.at(-1)}]));
   const command=(revision=0)=>({domain:'sanitary_protocol_adoption_v1',contract_version:1,fazenda_id:farm,client_op_id:randomUUID(),client_tx_id:randomUUID(),expected_revision:revision,families});
   const asActor=(actor,statement)=>`begin; set local role authenticated; set local request.jwt.claim.sub=${quote(actor)}; ${statement}; commit;`;
   const call=async(cmd,actor=owner)=>JSON.parse(await sql(asActor(actor,`select public.set_sanitary_protocol_adoption_v1(${quote(JSON.stringify(cmd))}::jsonb)`)));
   const get=async()=>JSON.parse(await sql(`select payload from public.fazenda_sanidade_config where fazenda_id='${farm}'`));
   // Unknown versions and malformed existing namespaces are not an empty state.
   await sql(`insert into public.fazenda_sanidade_config(fazenda_id) values('${other}');`);
   for (const value of [{schemaVersion:2,revision:1,families}, {schemaVersion:1,revision:1,families:{}}, null]) {
     await sql(`alter table public.fazenda_sanidade_config disable trigger guard_sanitary_protocol_adoption_v1; update public.fazenda_sanidade_config set payload=jsonb_set(payload,'{sanitary_protocol_adoption_v1}',${quote(JSON.stringify(value))}::jsonb) where fazenda_id='${other}'; alter table public.fazenda_sanidade_config enable trigger guard_sanitary_protocol_adoption_v1;`);
     const unsafe={...command(0),fazenda_id:other};
     await assert.rejects(call(unsafe,outsider),/PROTOCOL_ADOPTION_CONFIG_UNAVAILABLE/);
     assert.deepEqual(JSON.parse(await sql(`select payload->'sanitary_protocol_adoption_v1' from public.fazenda_sanidade_config where fazenda_id='${other}'`)),value);
   }
   // Dedicated RPC initializes a previously absent row with compatible defaults.
   const initial=command(); const first=await call(initial);
   assert.equal(first.status,'APPLIED'); assert.equal(first.adoption.revision,1);
   await sql(asActor(owner,`update public.fazenda_sanidade_config set payload=payload||'{"sibling":{"keep":true},"activated_template_slugs":["legacy"]}'::jsonb where fazenda_id='${farm}'`));
   const later=await call({...command(1),families:{...families,clostridioses:{monitoringEnabled:false}}},manager);
   assert.equal(later.adoption.revision,2);
   assert.deepEqual(await call(initial),first,'lost ACK returns original receipt after later preference');
   assert.equal((await get()).sanitary_protocol_adoption_v1.revision,2);
   const concurrent=await Promise.all([call(command(2)),call(command(2))]);
   assert.deepEqual(concurrent.map(x=>x.status).sort(),['APPLIED','CONFLICT']);
   const loser=command(0); const conflict=await call(loser); assert.equal(conflict.status,'CONFLICT');
   assert.deepEqual(await call(loser),conflict);
   await assert.rejects(call({...initial,expected_revision:3}),/IDENTITY_REUSE/);
   await assert.rejects(call(initial,manager),/IDENTITY_REUSE/);
   for(const actor of [cowboy,outsider]) await assert.rejects(call(command(3),actor),/FORBIDDEN/);
   await assert.rejects(call({...command(),fazenda_id:other}),/FORBIDDEN/);
   await assert.rejects(call({...command(3),families:{...families,aftosa:{monitoringEnabled:true}}}),/INVALID_FAMILIES/);
   const before=await get();
   await sql(asActor(owner,`update public.fazenda_sanidade_config set payload='{"old_writer":true}'::jsonb where fazenda_id='${farm}'`));
   assert.deepEqual((await get()).sanitary_protocol_adoption_v1,before.sanitary_protocol_adoption_v1);
   await sql(asActor(owner,`update public.fazenda_sanidade_config set payload=payload||${quote(JSON.stringify({sanitary_protocol_adoption_v1:first.adoption}))}::jsonb where fazenda_id='${farm}'`));
   assert.deepEqual((await get()).sanitary_protocol_adoption_v1,before.sanitary_protocol_adoption_v1);
   // Namespace RPC preserves sibling values, including legacy automation keys.
   await sql(asActor(owner,`update public.fazenda_sanidade_config set payload=payload||'{"sibling":{"keep":true},"activated_template_slugs":["legacy"]}'::jsonb where fazenda_id='${farm}'`));
   const beforeRpc=await get(); await call(command(3)); const afterRpc=await get();
   for(const key of Object.keys(beforeRpc).filter(k=>k!=='sanitary_protocol_adoption_v1')) assert.deepEqual(afterRpc[key],beforeRpc[key]);
   const sameTxCommand=command(4);
   await sql(asActor(owner,`do $proof$ declare prior jsonb; begin
     prior := public.set_sanitary_protocol_adoption_v1(${quote(JSON.stringify(sameTxCommand))}::jsonb);
     perform public.set_sanitary_protocol_adoption_v1(${quote(JSON.stringify(command(5)))}::jsonb);
     update public.fazenda_sanidade_config set payload=payload||jsonb_build_object('sanitary_protocol_adoption_v1',prior->'adoption') where fazenda_id='${farm}';
     end $proof$`));
   assert.equal((await get()).sanitary_protocol_adoption_v1.revision,6,'legacy writer in RPC transaction cannot replay consumed authorization');
   const protectedPayload=await get();
   for(const invalid of ["'[]'::jsonb", "'42'::jsonb", "'\"scalar\"'::jsonb", "'null'::jsonb", 'null']) {
     await assert.rejects(sql(asActor(owner,`update public.fazenda_sanidade_config set payload=${invalid} where fazenda_id='${farm}'`)),/PROTOCOL_ADOPTION_PAYLOAD_INVALID/);
     assert.deepEqual(await get(),protectedPayload,'non-object legacy payload cannot erase protected namespace');
   }
   assert.equal(await sql(asActor(outsider,`select count(*) from public.fazenda_sanidade_config where fazenda_id='${farm}'`)),'0');
   await assert.rejects(sql(asActor(owner,'select * from public.sanitary_protocol_adoption_receipts_v1')),/permission denied/);
   assert.equal(await operationalState(),operationalBefore,'preference writes create no Agenda, Event, stock movement or animal withdrawal state');
   console.log('Full migration chain; CAS concurrency, durable replay, identity, defaults, siblings, legacy snapshot, RBAC and farm RLS verified.');
 } finally {
   if(cid) { const info=JSON.parse(docker(['inspect',cid]))[0]; assert.equal(info.Config.Labels['rebanhosync.adoption.run'],run); assert.equal(info.HostConfig.NetworkMode,'none'); docker(['stop',cid]); }
 }
});
