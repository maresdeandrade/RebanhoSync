// Targeted native PostgreSQL upgrade/compatibility checks; not a substitute for C1-C8.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
const isolated = process.env.SANITARIO_REVIEW_WORKDIR;
assert(isolated);
assert.match(readFileSync(path.join(isolated,"supabase/config.toml"),"utf8"), /^project_id = "sanitario-v2-review-ea70bd7c"$/m);
const env = JSON.parse(execFileSync("supabase",["status","--workdir",isolated,"-o","json"],{cwd:isolated,encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
for (const key of ["DB_URL","API_URL"]) {const u=new URL(env[key]);assert.equal(u.hostname,"127.0.0.1");assert.equal(u.port,key==="DB_URL"?"56322":"56321");}
const db = new pg.Client({connectionString:env.DB_URL});
const racing = new pg.Client({connectionString:env.DB_URL});
const admin = createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const report = {cases:[],environment:"isolated native Supabase; synthetic catalog only"};
const farm=randomUUID(),otherFarm=randomUUID(),animal=randomUUID(),legacy=randomUUID(),legacyItem=randomUUID();
let actor;
async function check(name,fn) {await fn(); report.cases.push({name,result:"PASS"});console.log(`PASS ${name}`);}
async function canonical(scope="fazenda",farmId=farm) {
  const p=randomUUID(),i=randomUUID();
  await db.query(`insert into public.sanitario_protocolos_v2(id,family_code,name,scope,fazenda_id,legal_status,version)
    values($1,$2,'Synthetic reference',$3,$4,'condicional',1)`,[p,`synthetic_${p}`,scope,scope==="fazenda"?farmId:null]);
  await db.query(`insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field)
    values($1,$2,'synthetic',1,'recomendado','manejo_sanitario','none','{}','{}','[]','{}')`,[i,p]);
  return {p,i};
}
function command(p,i) {
  return {actor_user_id:actor,fazenda_id:farm,contract_version:2,client_op_id:randomUUID(),domain_op_id:randomUUID(),
    payload:{id:randomUUID(),dedup_key:randomUUID(),client_id:"catalog-reference-regression",client_tx_id:randomUUID(),client_recorded_at:new Date().toISOString(),
      protocolo_id:p,protocol_item_version_id:i,protocol_item_snapshot:{},janela_inicio:"2026-10-15",data_programada:"2026-10-15",produto_snapshot:{},acao_sanitaria:"manejo_sanitario",metadata:{}},animal_ids:[animal]};
}
const call = args => admin.rpc("internal_sanitario_sync_v2_create_agenda",args);
const row = async id => (await db.query("select * from public.sanitario_agenda_v2 where id=$1",[id])).rows[0];
async function rejected(args,reason) {const result=await call(args);assert(result.error);assert.match(result.error.message,reason);assert.equal(await row(args.payload.id),undefined);}
async function sqlReject(sql,params,reason) {await assert.rejects(db.query(sql,params),reason);}
try {
  await db.connect();await racing.connect();
  const user=await admin.auth.admin.createUser({email:`reference-${randomUUID()}@example.test`,password:`${randomUUID()}-Aa1!`,email_confirm:true});assert.ifError(user.error);actor=user.data.user.id;
  await db.query("insert into public.user_profiles(user_id,display_name) values($1,'Synthetic reference regression')",[actor]);
  for (const id of [farm,otherFarm]) {
    await db.query("insert into public.fazendas(id,nome,codigo,created_by) values($1,'Synthetic reference',$2,$3)",[id,randomUUID(),actor]);
    await db.query("insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values($1,$2,'owner',now())",[id,actor]);
  }
  await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo) values($1,$2,$3,'F')",[animal,farm,randomUUID()]);
  await db.query("insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,allowed_user_ids,allowed_client_ids,rollout_percentage) values($1,true,array[$2::uuid],array['catalog-reference-regression'],100)",[farm,actor]);
  await db.query("insert into public.protocolos_sanitarios(id,fazenda_id,nome) values($1,$2,'Synthetic legacy')",[legacy,farm]);
  await db.query("insert into public.protocolos_sanitarios_itens(id,fazenda_id,protocolo_id,logical_item_key,item_code,tipo,produto) values($1,$2,$3,$4,'synthetic','vacinacao','Synthetic legacy')",[legacyItem,farm,legacy,randomUUID()]);
  await check("old queued legacy payload and replay keep original FKs",async()=>{
    const args=command(legacy,legacyItem);assert.ifError((await call(args)).error);assert.ifError((await call(args)).error);
    const r=await row(args.payload.id);assert.equal(r.protocolo_id,legacy);assert.equal(r.protocol_item_version_id,legacyItem);assert.equal(r.catalog_protocolo_v2_id,null);
    assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[args.client_op_id])).rows[0].n,1);
  });
  const tenant=await canonical();
  for (const scope of ["fazenda","global","pack"]) await check(`${scope} V2 references have explicit storage and integrity`,async()=>{
    const refs=scope==="fazenda"?tenant:await canonical(scope);const args=command(refs.p,refs.i);assert.ifError((await call(args)).error);
    const r=await row(args.payload.id);assert.equal(r.protocolo_id,null);assert.equal(r.protocol_item_version_id,null);assert.equal(r.catalog_protocolo_v2_id,refs.p);assert.equal(r.catalog_protocol_item_version_v2_id,refs.i);
  });
  await check("cross farm and mismatched item are rejected atomically",async()=>{
    const foreign=await canonical("fazenda",otherFarm);await rejected(command(foreign.p,foreign.i),/SANITARIO_CATALOG_PROTOCOL_CROSS_FARM_OR_MISSING/);
    const other=await canonical();await rejected(command(tenant.p,other.i),/SANITARIO_CATALOG_ITEM_PROTOCOL_MISMATCH/);
  });
  await check("referenced tenant, parent and deletes cannot bypass integrity",async()=>{
    const other=await canonical();
    await sqlReject("update public.sanitario_protocolos_v2 set fazenda_id=$2 where id=$1",[tenant.p,otherFarm],/SANITARIO_CATALOG_REFERENCED_PROTOCOL_SCOPE_IMMUTABLE/);
    await sqlReject("update public.sanitario_protocolo_itens_versions_v2 set protocol_id=$2 where id=$1",[tenant.i,other.p],/SANITARIO_CATALOG_REFERENCED_ITEM_PARENT_IMMUTABLE/);
    await sqlReject("delete from public.sanitario_protocolo_itens_versions_v2 where id=$1",[tenant.i],/foreign key constraint/);
  });
  await check("concurrent reference creation serializes a tenant move",async()=>{
    const refs=await canonical();const args=command(refs.p,refs.i);
    await db.query("begin");await db.query("set local role service_role");await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:"service_role",sub:actor})]);
    await db.query("select public.internal_sanitario_sync_v2_create_agenda($1,$2,$3,$4,$5,jsonb_populate_record(null::public.sanitario_sync_v2_agenda_input,$6::jsonb),$7::uuid[])",[actor,farm,2,args.client_op_id,args.domain_op_id,JSON.stringify(args.payload),[animal]]);
    let settled=false;const moved=racing.query("update public.sanitario_protocolos_v2 set fazenda_id=$2 where id=$1",[refs.p,otherFarm]).then(()=>({ok:true}),error=>({error:error.message})).finally(()=>{settled=true;});
    await new Promise(resolve=>setTimeout(resolve,150));assert.equal(settled,false);await db.query("commit");
    assert.match((await moved).error,/SANITARIO_CATALOG_REFERENCED_PROTOCOL_SCOPE_IMMUTABLE/);
  });
} catch(error) { report.failure=error.message;process.exitCode=1;console.error(error.message); }
finally {
  await db.query("rollback");
  await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1",[farm]);
  report.enabled_gate_count_after_cleanup=(await db.query("select count(*)::int n from public.sanitario_sync_v2_gates where enabled")).rows[0].n;
  await db.end();await racing.end();report.source_hash=createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex");
  writeFileSync(path.join(isolated,"catalog-reference-regression.json"),JSON.stringify(report,null,2)+"\n");
}
