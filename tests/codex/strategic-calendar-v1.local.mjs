import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('calendar CAS, replay, legacy writes, roles and tenant isolation', async () => {
  const run=randomUUID(); let cid;
  const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const sql=input=>new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',cid,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']); let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('exit',code=>code?reject(Error(err)):resolve(out.trim()));p.stdin.end(input);});
  const quote=x=>`'${String(x).replaceAll("'","''")}'`;
  try {
    cid=docker(['run','--rm','--detach','--network','none','--label',`rebanhosync.calendar.run=${run}`,'--env','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.167']);
    let ready=false; for(let i=0;i<100;i++){try{docker(['exec',cid,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}} assert(ready);
    for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) await sql(readFileSync(`supabase/migrations/${file}`,'utf8'));
    const farm=randomUUID(),other=randomUUID(),owner=randomUUID(),cowboy=randomUUID(),outsider=randomUUID();
    await sql(`insert into auth.users(id) values('${owner}'),('${cowboy}'),('${outsider}'); insert into public.fazendas(id,nome) values('${farm}','Calendar fixture'),('${other}','Other'); insert into public.user_fazendas(user_id,fazenda_id,role) values('${owner}','${farm}','owner'),('${cowboy}','${farm}','cowboy'),('${outsider}','${other}','owner');`);
    const command=(revision=0,variant='5-7-9')=>({domain:'sanitary_strategic_calendar_v1',contract_version:1,fazenda_id:farm,client_op_id:randomUUID(),client_tx_id:randomUUID(),expected_revision:revision,variant});
    const asActor=(actor,statement)=>`begin; set local role authenticated; set local request.jwt.claim.sub=${quote(actor)}; ${statement}; commit;`;
    const call=async(cmd,actor=owner)=>JSON.parse(await sql(asActor(actor,`select public.set_sanitary_strategic_calendar_v1(${quote(JSON.stringify(cmd))}::jsonb)`)));
    const read=async()=>JSON.parse(await sql(`select payload from public.fazenda_sanidade_config where fazenda_id='${farm}'`));
    const first=command(); const applied=await call(first); assert.equal(applied.status,'APPLIED'); assert.equal(applied.calendar.variant,'5-7-9');
    await sql(asActor(owner,`update public.fazenda_sanidade_config set payload=payload||'{"sibling":{"keep":true},"activated_template_slugs":["legacy"]}'::jsonb where fazenda_id='${farm}'`));
    const concurrent=await Promise.all([call(command(1,'5-6-9')),call(command(1,'5-7-9'))]);
    assert.deepEqual(concurrent.map(x=>x.status).sort(),['APPLIED','CONFLICT']);
    assert.deepEqual(await call(first),applied,'replay returns original receipt after newer preference');
    const before=await read(); assert.equal(before.sanitary_strategic_calendar_v1.revision,2); assert.deepEqual(before.sibling,{keep:true}); assert.deepEqual(before.activated_template_slugs,['legacy']);
    await sql(asActor(owner,`update public.fazenda_sanidade_config set payload='{"old_writer":true}'::jsonb where fazenda_id='${farm}'`));
    assert.deepEqual((await read()).sanitary_strategic_calendar_v1,before.sanitary_strategic_calendar_v1);
    for(const invalid of ["'[]'::jsonb", "'null'::jsonb", 'null']) await assert.rejects(sql(asActor(owner,`update public.fazenda_sanidade_config set payload=${invalid} where fazenda_id='${farm}'`)),/STRATEGIC_CALENDAR_PAYLOAD_INVALID/);
    for(const actor of [cowboy,outsider]) await assert.rejects(call(command(2),actor),/STRATEGIC_CALENDAR_FORBIDDEN/);
    await assert.rejects(call({...command(),fazenda_id:other}),/STRATEGIC_CALENDAR_FORBIDDEN/);
    const current=await read(); await call(command(2)); const after=await read(); for(const k of Object.keys(current).filter(k=>k!=='sanitary_strategic_calendar_v1')) assert.deepEqual(after[k],current[k]);
    assert.equal(await sql(`select count(*) from public.sanitario_agenda_v2 where fazenda_id='${farm}'`),'0');
  } finally {if(cid){const info=JSON.parse(docker(['inspect',cid]))[0];assert.equal(info.Config.Labels['rebanhosync.calendar.run'],run);assert.equal(info.HostConfig.NetworkMode,'none');docker(['stop',cid]);}}
});
