// Isolated, network-free PostgreSQL. Never targets an existing cluster.
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('V3 assessment admission preserves factual and tenant invariants', async () => {
  const run=randomUUID(); let cid;
  const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const quote=x=>`'${String(x).replaceAll("'","''")}'`;
  const sql=input=>new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',cid,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);
    let out='',err=''; child.stdout.on('data',x=>out+=x); child.stderr.on('data',x=>err+=x);
    child.on('error',reject); child.on('exit',code=>code?reject(Error(err)):resolve(out.trim())); child.stdin.end(input);
  });
  try {
    cid=docker(['run','--rm','--detach','--network','none','--label',`rebanhosync.assessment.run=${run}`,'--env','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.167']);
    let ready=false;
    for(let i=0;i<100;i++){try{docker(['exec',cid,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}
    assert(ready);
    for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) await sql(readFileSync(`supabase/migrations/${file}`,'utf8'));
    const farm=randomUUID(),other=randomUUID(),owner=randomUUID(),outsider=randomUUID(),animal=randomUUID(),animal2=randomUUID(),foreign=randomUUID(),protocol=randomUUID(),item=randomUUID();
    await sql(`insert into auth.users(id) values('${owner}'),('${outsider}');
      insert into public.fazendas(id,nome) values('${farm}','Assessment fixture'),('${other}','Other fixture');
      insert into public.user_fazendas(user_id,fazenda_id,role) values('${owner}','${farm}','owner'),('${outsider}','${other}','owner');
      insert into public.animais(id,fazenda_id,identificacao,sexo) values('${animal}','${farm}','a','F'),('${animal2}','${farm}','b','F'),('${foreign}','${other}','c','F');
      insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values('${farm}',true,3,3,'ready');
      insert into public.sanitario_protocolos_v2(id,family_code,name,scope,legal_status,version) values('${protocol}','fixture','Fixture','global','condicional',1);
      insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field,snapshot_template)
      values('${item}','${protocol}','fixture',1,'condicional','manejo_sanitario','none','{}','{}','[]','{}','{"metadata":{"planning_scope":"assessment_only"}}');`);
    const make=(result='no_treatment_indicated', ids=[animal,animal2])=>({
      actor_user_id:owner,fazenda_id:farm,contract_version:3,client_op_id:randomUUID(),domain_op_id:randomUUID(),client_tx_id:randomUUID(),client_id:'fixture-device',
      event_payload:{id:randomUUID(),natureza:'standalone_fact',occurred_at:'2026-01-01T12:00:00Z',client_id:'fixture-device',client_tx_id:randomUUID(),client_recorded_at:'2026-01-01T12:00:00Z',
        payload:{schema:'sanitary_assessment_v1',assessment:{schema_version:1,result,protocol_id:protocol,item_id:item,item_version:1,cycle_key:'2026',responsible_name:'Fixture',origin:'farm_assessment',observation:null}}},
      detail_payload:{tipo:'avaliacao',payload:{},produto_snapshot:{}},
      event_animals:ids.map(id=>({id:randomUUID(),animal_id:id}))
    });
    const admit=async(a,actor=owner)=>JSON.parse(await sql(`begin; set local role service_role; select public.internal_sanitario_admit_v3('${actor}','${farm}','apply_factual_core',${quote(JSON.stringify(a))}::jsonb,false); commit;`));
    const first=make(); const result=await admit(first); assert.equal(result.confirmed,true);
    assert.deepEqual(await admit(first),result,'lost ACK replays immutable receipt');
    // Existing JWTs identify the user, but do not distinguish an old reader
    // from a newer installation of that same user's account.
    const asMember=(actor, query)=>`begin; set local role authenticated; set local request.jwt.claim.sub=${quote(actor)}; ${query}; commit;`;
    const visibleAssessment=`select count(*) from public.eventos e join public.eventos_sanitario d on d.evento_id=e.id and d.fazenda_id=e.fazenda_id where e.id='${first.event_payload.id}' and e.fazenda_id='${farm}' and d.tipo::text='avaliacao'`;
    assert.equal(await sql(asMember(owner, visibleAssessment)),'1','legacy-shaped authenticated JWT can select assessment directly');
    assert.equal(await sql(asMember(outsider, visibleAssessment)),'0','assessment remains isolated from outsiders');
    const second=make('treatment_indicated'); const third=make('insufficient_data');
    assert((await Promise.all([admit(second),admit(third)])).every(x=>x.confirmed));
    assert.equal(await sql(`select count(*) from public.eventos_sanitario where fazenda_id='${farm}' and tipo::text='avaliacao' and produto is null and dose_quantidade is null and carencia_carne_ate is null`),'3');
    assert.equal(await sql(`select count(*) from public.eventos_animais where fazenda_id='${farm}'`),'6');
    assert.equal(await sql(`select count(*) from public.sanitario_agenda_v2 where fazenda_id='${farm}'`),'0');
    assert.equal(await sql(`select count(*) from public.insumo_movimentacoes where fazenda_id='${farm}'`),'0');
    const bad=make(); bad.detail_payload.dose_quantidade=1; await assert.rejects(admit(bad),/SANITARIO_ASSESSMENT_INVALID/);
    const mismatchedAnimal=make('no_treatment_indicated',[animal]); mismatchedAnimal.event_payload.animal_id=animal2;
    await assert.rejects(admit(mismatchedAnimal),/SANITARIO_ASSESSMENT_ANIMAL_MISMATCH/);
    const badPayload=make(); badPayload.event_payload.payload.withdrawalSnapshot={fabricated:true}; await assert.rejects(admit(badPayload),/SANITARIO_ASSESSMENT_INVALID/);
    const wrongYear=make(); wrongYear.event_payload.payload.assessment.cycle_key='2025'; await assert.rejects(admit(wrongYear),/SANITARIO_ASSESSMENT_INVALID/);
    const wrongItem=randomUUID(); await sql(`insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field) values('${wrongItem}','${protocol}','vaccine',1,'condicional','vacinacao','none','{}','{}','[]','{}')`);
    const drugItem=make(); drugItem.event_payload.payload.assessment.item_id=wrongItem; await assert.rejects(admit(drugItem),/SANITARIO_ASSESSMENT_PROTOCOL_INVALID/);
    const foreignOp=make('no_treatment_indicated',[foreign]); await assert.rejects(admit(foreignOp),/SANITARIO_EVENT_ANIMAL_CROSS_FARM_OR_MISSING/);
    await assert.rejects(admit({...make(),actor_user_id:outsider},outsider),/SANITARIO_MEMBERSHIP_REQUIRED/);
    await assert.rejects(admit({...make(),contract_version:2}),/SANITARIO_CLIENT_CONTRACT_OUTDATED/);
    const wrongTargets=make('treatment_indicated',[animal]); wrongTargets.event_payload.natureza='correction'; wrongTargets.event_payload.corrige_evento_id=first.event_payload.id; wrongTargets.event_payload.observacoes='Alvos diferentes';
    await assert.rejects(admit(wrongTargets),/SANITARIO_ASSESSMENT_CORRECTION_INVALID/);
    const beforeOriginal=make(); beforeOriginal.event_payload.natureza='correction'; beforeOriginal.event_payload.corrige_evento_id=first.event_payload.id; beforeOriginal.event_payload.observacoes='Data anterior'; beforeOriginal.event_payload.occurred_at='2025-01-01T12:00:00Z';
    await assert.rejects(admit(beforeOriginal),/SANITARIO_ASSESSMENT_CORRECTION_INVALID/);
    const correction=make('treatment_indicated'); correction.event_payload.natureza='correction'; correction.event_payload.corrige_evento_id=first.event_payload.id; correction.event_payload.observacoes='Correção documentada';
    const correctionReceipt=await admit(correction); assert.equal(correctionReceipt.confirmed,true);
    assert.deepEqual(await admit(correction),correctionReceipt,'lost correction ACK replays original receipt');
    const priorYear=make(); priorYear.event_payload.occurred_at='2025-01-01T12:00:00Z'; priorYear.event_payload.payload.assessment.cycle_key='2025'; await admit(priorYear);
    const laterCorrection=make('treatment_indicated'); laterCorrection.event_payload.natureza='correction'; laterCorrection.event_payload.corrige_evento_id=priorYear.event_payload.id; laterCorrection.event_payload.observacoes='Correção no ano seguinte'; laterCorrection.event_payload.payload.assessment.cycle_key='2025';
    assert.equal((await admit(laterCorrection)).confirmed,true);
    const future=make(); future.event_payload.occurred_at='2999-01-01T12:00:00Z'; future.event_payload.payload.assessment.cycle_key='2999';
    await assert.rejects(admit(future),/SANITARIO_ASSESSMENT_INVALID/);
    const competing=make(); competing.event_payload.natureza='correction'; competing.event_payload.corrige_evento_id=first.event_payload.id; competing.event_payload.observacoes='Concorrência';
    await assert.rejects(admit(competing),/SANITARIO_ASSESSMENT_CORRECTION_INVALID/);
    const concurrentCorrections=[make('treatment_indicated'),make('insufficient_data')];
    for(const c of concurrentCorrections){c.event_payload.natureza='correction';c.event_payload.corrige_evento_id=second.event_payload.id;c.event_payload.observacoes='Correção concorrente';}
    const outcomes=await Promise.allSettled(concurrentCorrections.map(c=>admit(c)));
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    assert.match(String(outcomes.find(x=>x.status==='rejected')?.reason),/SANITARIO_ASSESSMENT_CORRECTION_INVALID/);
    assert.equal(await sql(`select count(*) from public.eventos where fazenda_id='${farm}'`),'7');
    console.log('V3 admission, no pharmacological effects, distinct outcomes, concurrency, replay, tenant and append-only correction verified.');
  } finally {
    if(cid){const info=JSON.parse(docker(['inspect',cid]))[0]; assert.equal(info.Config.Labels['rebanhosync.assessment.run'],run);assert.equal(info.HostConfig.NetworkMode,'none');docker(['stop',cid]);}
  }
});
