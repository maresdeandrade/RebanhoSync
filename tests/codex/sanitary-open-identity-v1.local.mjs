import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('open strategic obligations: concurrency, reschedule, replay and tenant isolation', async () => {
 const run=randomUUID(); let cid;
 const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 const sql=input=>new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',cid,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('exit',code=>code?reject(Error(err)):resolve(out.trim()));p.stdin.end(input);});
 const quote=x=>`'${String(x).replaceAll("'","''")}'`;
 try {
  cid=docker(['run','--rm','--detach','--network','none','--label',`rebanhosync.openidentity.run=${run}`,'--env','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.167']);
  let ready=false;for(let i=0;i<100;i++){try{docker(['exec',cid,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}assert(ready);
  for(const f of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) await sql(readFileSync(`supabase/migrations/${f}`,'utf8'));
  const farm=randomUUID(),other=randomUUID(),actor=randomUUID(),outsider=randomUUID(),animals=Array.from({length:6},()=>randomUUID());
  await sql(`insert into auth.users(id) values('${actor}'),('${outsider}'); insert into public.fazendas(id,nome) values('${farm}','identity'),('${other}','other'); insert into public.user_fazendas(user_id,fazenda_id,role) values('${actor}','${farm}','owner'),('${outsider}','${other}','owner'); insert into public.animais(id,fazenda_id,identificacao,sexo) values ${animals.map(id=>`('${id}','${farm}','${id}','F')`).join(',')}; insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values('${farm}',true,3,3,'ready');`);
  const base=extra=>({actor_user_id:actor,fazenda_id:farm,contract_version:3,client_op_id:randomUUID(),domain_op_id:randomUUID(),...extra});
  const create=(ids,year=2026,item='recria_julho')=>base({payload:{id:randomUUID(),dedup_key:randomUUID(),janela_inicio:`${year}-01-01`,janela_fim:`${year+1}-12-31`,data_programada:`${year}-07-01`,acao_sanitaria:'avaliacao',client_id:'identity-test',client_recorded_at:new Date().toISOString(),protocol_item_snapshot:{familyCode:'controle_parasitario_recria_5_7_9',itemKey:item}},animal_ids:ids});
  const call=(cmd,args,user=actor,f=farm)=>sql(`begin;set local role service_role;select public.internal_sanitario_admit_v3(${quote(user)}::uuid,${quote(f)}::uuid,${quote(cmd)},${quote(JSON.stringify(args))}::jsonb,false);commit;`).then(JSON.parse);
  // Exercise the real closure and continuation transaction, including rollback.
  const source=create([animals[5]]); await call('create_agenda',source);
  const manage=(agenda,action,fields={})=>base({client_id:'identity-test',payload:{agenda_id:agenda,action,...fields}});
  const close=async agenda=>{
   const barrier=await call('manage_agenda',manage(agenda,'prepare_close',{not_executed:[{animal_id:animals[5],reason:'Ausente'}]}));
   return call('manage_agenda',manage(agenda,'confirm_close',{barrier_id:barrier.barrier_id}));
  };
  const closed=await close(source.payload.id);
  const requestOp=manage(source.payload.id,'request_continuation',{result_id:closed.result_id,reason:'Retomar',animals:[{animal_id:animals[5],reason:'Ausente'}]});
  const request=await call('manage_agenda',requestOp);
  assert.deepEqual(await call('manage_agenda',requestOp),request);
  const competing=create([animals[5]]); await call('create_agenda',competing);
  const decision=manage(source.payload.id,'decide_continuation',{request_id:request.request_id,decision:'approved',reason:'Retomar',planned_for:'2027-07-01'});
  await assert.rejects(call('manage_agenda',decision,outsider),/SANITARIO_MEMBERSHIP_REQUIRED/);
  await assert.rejects(call('manage_agenda',decision),/SANITARIO_OPEN_OBLIGATION_CONFLICT/);
  assert.equal(await sql(`select count(*) from public.sanitario_agenda_v2 where id='${decision.domain_op_id}'`),'0');
  assert.equal(await sql(`select coalesce(decision,'pending') from public.sanitario_continuidade_solicitacoes where id='${request.request_id}'`),'pending');
  await close(competing.payload.id);
  const approved=await call('manage_agenda',decision);
  assert.equal(approved.continuation_id,decision.domain_op_id);
  assert.deepEqual(await call('manage_agenda',decision),approved);
  assert.equal(await sql(`select obrigacao_origem_agenda_id||':'||strategic_cycle_year_v1||':'||strategic_family_v1||':'||strategic_stage_v1 from public.sanitario_agenda_v2 where id='${approved.continuation_id}'`),`${source.payload.id}:2026:controle_parasitario_recria_5_7_9:middle`);
  assert.equal(await sql(`select count(*) from public.sanitario_agenda_animais_v2 where agenda_id='${approved.continuation_id}' and animal_id='${animals[5]}'`),'1');
  assert.equal(await sql(`select count(*) from public.sanitario_agenda_v2 where metadata->>'source_agenda_id'='${source.payload.id}'`),'1');
  const genericA=create([animals[4]]),genericB=create([animals[4]]);
  genericA.payload.protocol_item_snapshot={}; genericB.payload.protocol_item_snapshot={};
  await call('create_agenda',genericA); await call('create_agenda',genericB);
  const a=create(animals.slice(0,2)), b=create(animals.slice(1,3));
  const [x,y]=await Promise.allSettled([call('create_agenda',a),call('create_agenda',b)]);
  assert.deepEqual([x.status,y.status].sort(),['fulfilled','rejected']); assert.match((x.status==='rejected'?x:y).reason.message,/SANITARIO_OPEN_OBLIGATION_CONFLICT/);
  const accepted=x.status==='fulfilled'?a:b, rejected=x.status==='rejected'?a:b;
  assert.deepEqual(await call('create_agenda',accepted),x.status==='fulfilled'?x.value:y.value);
  await assert.rejects(call('create_agenda',rejected,outsider),/SANITARIO_MEMBERSHIP_REQUIRED/);
  const id=accepted.payload.id;
  // Exercise the actual BEFORE INSERT trigger in a rolled-back continuation fixture.
  const continuationIdentity=async(root)=>{const child=randomUUID(); return await sql(`begin; set local role service_role; set local rebanhosync.sanitario_v3_farm='${farm}'; set local rebanhosync.sanitario_v3_actor='${actor}'; set local rebanhosync.sanitario_continuation_root='${root}'; insert into public.sanitario_agenda_v2(id,fazenda_id,dedup_key,janela_inicio,data_programada,acao_sanitaria) values('${child}','${farm}','${child}','2029-01-01','2029-07-01','avaliacao') returning coalesce(strategic_cycle_year_v1::text,'NULL')||':'||coalesce(strategic_family_v1,'NULL')||':'||coalesce(strategic_stage_v1,'NULL'); rollback;`);};
  assert.equal(await continuationIdentity(id),'2026:controle_parasitario_recria_5_7_9:middle');
  const schedule=base({agenda_id:id,expected_revision:0,client_id:'identity-test',planned_for:'2027-07-01'});
  await call('reschedule_agenda',schedule);
  assert.equal(await sql(`select strategic_cycle_year_v1 from public.sanitario_agenda_v2 where id='${id}'`),'2026');
  for(const change of [`strategic_cycle_year_v1=2029`, `strategic_family_v1='other'`, `strategic_stage_v1='may'`]) await assert.rejects(sql(`begin;set local role service_role;select set_config('rebanhosync.sanitario_v3_farm','${farm}',true),set_config('rebanhosync.sanitario_v3_actor','${actor}',true);update public.sanitario_agenda_v2 set ${change} where id='${id}';commit;`),/SANITARIO_CYCLE_IDENTITY_IMMUTABLE/);
  await assert.rejects(call('create_agenda',create([accepted.animal_ids[0]])),/SANITARIO_OPEN_OBLIGATION_CONFLICT/);
  await call('create_agenda',create([accepted.animal_ids[0]],2027));
  assert.deepEqual(await call('reschedule_agenda',schedule),await call('reschedule_agenda',schedule));
  const distinct=animals.find(animal=>!accepted.animal_ids.includes(animal));
  const distinctAgenda=create([distinct]); await call('create_agenda',distinctAgenda);
  const replace=base({agenda_id:distinctAgenda.payload.id,expected_revision:0,client_id:'identity-test',animal_ids:[distinct,accepted.animal_ids[0]]});
  await assert.rejects(call('replace_agenda_animals',replace),/SANITARIO_OPEN_OBLIGATION_CONFLICT/);
  assert.equal(await sql(`select count(*) from public.sanitario_agenda_animais_v2 where agenda_id='${distinctAgenda.payload.id}'`),'1');
  // Capture the canonical catalog identity before later catalog edits.
  const protocol=randomUUID(),item=randomUUID();
  await sql(`insert into public.sanitario_protocolos_v2(id,family_code,name,scope,legal_status,version,status,approval_status) values('${protocol}','controle_parasitario_recria_5_7_9','identity','global','estrategico',1,'active','approved'); insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field,status) values('${item}','${protocol}','recria_maio',1,'estrategico','manejo_sanitario','none','{}','{}','[]','{}','active');`);
  const catalogAgenda=create([animals[3]],2026,'unrelated'); catalogAgenda.payload.protocolo_id=protocol; catalogAgenda.payload.protocol_item_version_id=item; catalogAgenda.payload.protocol_item_snapshot.familyCode='unrelated';
  await call('create_agenda',catalogAgenda);
  assert.equal(await sql(`select strategic_family_v1||':'||strategic_stage_v1 from public.sanitario_agenda_v2 where id='${catalogAgenda.payload.id}'`),'controle_parasitario_recria_5_7_9:may');
  await sql(`update public.sanitario_protocolos_v2 set family_code='modified' where id='${protocol}'; update public.sanitario_protocolo_itens_versions_v2 set logical_item_key='modified' where id='${item}';`);
  await assert.rejects(call('create_agenda',create([animals[3]],2026,'recria_maio')),/SANITARIO_OPEN_OBLIGATION_CONFLICT/);
  // The unapproved contextual June writer is blocked before any new materialization.
  const june=create([accepted.animal_ids[0]],2026,'declared_june');
  await assert.rejects(call('create_agenda',june),/SANITARIO_CONTEXTUAL_JUNE_NOT_ENABLED/);
  assert.equal(await sql(`select count(*) from public.sanitario_agenda_v2 where id='${june.payload.id}'`),'0');
  // A historical contextual June and July are a conflict, not clinical equivalence.
  await sql(`set session_replication_role=replica; update public.sanitario_agenda_v2 set strategic_cycle_year_v1=null,strategic_family_v1=null,strategic_stage_v1=null,protocol_item_snapshot='{"familyCode":"controle_parasitario_recria_5_7_9","itemKey":"declared_june"}'::jsonb where id='${id}'; set session_replication_role=origin;`);
  await assert.rejects(call('create_agenda',create([accepted.animal_ids[0]],2029)),new RegExp(`SANITARIO_OPEN_OBLIGATION_CONFLICT.*agenda_id=`+id));
  assert.equal(await continuationIdentity(id),'NULL:NULL:NULL');
  // A pre-upgrade row may have been rescheduled and may lack participants.
  // Simulate that history without updating any production or shared database.
  await sql(`set session_replication_role=replica; update public.sanitario_agenda_v2 set strategic_cycle_year_v1=null,protocol_item_snapshot='{}'::jsonb where id='${distinctAgenda.payload.id}'; delete from public.sanitario_agenda_animais_v2 where agenda_id='${distinctAgenda.payload.id}'; set session_replication_role=origin;`);
  await assert.rejects(call('create_agenda',create([animals[3]],2029)),new RegExp(`SANITARIO_OPEN_OBLIGATION_CONFLICT.*agenda_id=`+distinctAgenda.payload.id));
  const legacySchedule=base({agenda_id:distinctAgenda.payload.id,expected_revision:0,client_id:'identity-test',planned_for:'2027-07-01'});
  await assert.rejects(call('reschedule_agenda',legacySchedule),/SANITARIO_OPEN_OBLIGATION_CONFLICT/);
  assert.deepEqual(await call('create_agenda',accepted),x.status==='fulfilled'?x.value:y.value);
  assert.equal(await sql(`select status||':'||protocol_item_snapshot::text from public.sanitario_agenda_v2 where id='${distinctAgenda.payload.id}'`),'programada:{}');

 } finally {if(cid){const info=JSON.parse(docker(['inspect',cid]))[0];assert.equal(info.Config.Labels['rebanhosync.openidentity.run'],run);assert.equal(info.HostConfig.NetworkMode,'none');docker(['stop',cid]);}}
});
