// Real PostgreSQL/roles/locks in a NEW disposable local database; never the hosted DB.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import pg from "pg";
import * as contract from "../../scripts/codex/sanitario-v2-contract.mjs";
import { buildApprovalCandidate, DECISION_PATH } from "../../scripts/codex/prepare-sanitario-approval-v2.mjs";
import { prepareClassMigration } from "../../scripts/codex/prepare-sanitario-class-migration-v2.mjs";
import { verifyManualCatalogReview } from "./sanitario-v2-manual-review.cases.mjs";
import { verifyClosurePublication } from "./sanitario-v2-closure-publication.cases.mjs";
import { verifyInitialBootstrap } from "./sanitario-v2-initial-bootstrap.cases.mjs";
import { prepareClassDelta } from "../../scripts/codex/prepare-sanitario-class-delta-v2.mjs";

const root = process.cwd(), sourceContainer = "supabase_db_GestaoAgro";
const container = `sanitario-review-${randomUUID().replaceAll("-", "")}`;
const database = `sanitario_review_${randomUUID().replaceAll("-", "")}`;
const dir = mkdtempSync(path.join(tmpdir(), "sanitario-review-pg-"));
const docker = (args, input) => execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe","pipe","pipe"], maxBuffer: 32*1024*1024 });
const psql = (sql, role = "postgres") => docker(["exec","-i",container,"sh","-c",
  'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -U "$1" -d "$2"',"review-psql",role,database],sql);
const report = { environment: "dedicated local PostgreSQL database; real RLS/roles/locks; JWT transport simulated via PostgREST session claims", cases: [] };
const admin = randomUUID(), second = randomUUID(), outsider = randomUUID();
let client, containerId;
const connect = async () => {
  const c = new pg.Client({host:"127.0.0.1",port:55435,database,user:"postgres",connectionTimeoutMillis:5000});
  await c.connect(); return c;
};
async function asUser(user, fn, role = "authenticated") {
  const c = await connect();
  try {
    await c.query("begin"); await c.query(`set local role ${role === "anon" ? "anon" : "authenticated"}`);
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[user ?? "",role]);
    const value = await fn(c); await c.query("commit"); return value;
  } catch (error) { await c.query("rollback"); throw error; } finally { await c.end(); }
}
const preview = (c, p, ids, version = 1) => c.query("select public.sanitario_catalog_review_preview_v2($1,$2,$3) as result",[p,version,ids]).then(r=>r.rows[0].result);
const decide = (c, v, requestId = randomUUID(), result = "approved", digest = v.reviewed_content_digest) => c.query(
  "select public.sanitario_catalog_decide_v2($1,$2,$3,$4,$5,$6,$7) as result",
  [v.protocol_id,v.expected_version,v.item_ids,digest,result,"Decisao sintetica explicita em teste local descartavel",requestId]).then(r=>r.rows[0].result);
async function check(name, fn) {
  await fn(); report.cases.push({name,result:"PASS"}); console.log(`PASS ${name}`);
}
try {
  assert.match(docker(["context","inspect","--format","{{.Endpoints.docker.Host}}"]), /^(npipe:\/\/|unix:\/\/)/);
  assert.match(database,/^sanitario_review_[a-f0-9]{32}$/);
  const image = docker(["inspect","--format","{{.Config.Image}}",sourceContainer]).trim();
  // Trust is restricted to this disposable, loopback-only server; no secret is copied.
  containerId = docker(["run","--detach","--rm","--name",container,"--publish","127.0.0.1:55435:5432",
    "--user","postgres","--entrypoint","sh",image,"-c",
    `initdb -D /tmp/review-db --auth=trust -U postgres >/tmp/review-init.log && echo 'host all all 0.0.0.0/0 trust' >>/tmp/review-db/pg_hba.conf && exec postgres -D /tmp/review-db -c 'listen_addresses=*' -c shared_preload_libraries=pg_cron -c cron.database_name=${database} -c cron.launch_active_jobs=off`]).trim();
  assert.match(containerId,/^[a-f0-9]{64}$/);
  let ready = false;
  for (let attempt=0; attempt<30 && !ready; attempt++) {
    try { docker(["exec",container,"pg_isready","-U","postgres"]); ready=true; }
    catch { await new Promise(resolve=>setTimeout(resolve,250)); }
  }
  assert(ready,"Disposable PostgreSQL did not start");
  docker(["exec",container,"createdb","-U","postgres","--template=template0",database]);
  const roles = docker(["exec",sourceContainer,"psql","-X","-At","-U","postgres","-d","postgres","-c",
    "select format('create role %I nologin;',rolname) from pg_roles where rolname not like 'pg_%' and rolname <> 'postgres' and rolname not like 'rebanhosync_%'"]);
  psql(roles + "\nalter role supabase_admin superuser login; alter role service_role bypassrls; create schema extensions; create extension pgcrypto with schema extensions;");
  psql(docker(["exec",sourceContainer,"pg_dump","-U","postgres","-d","postgres","--schema-only","--schema=auth","--no-owner"]),"supabase_admin");
  const sql = readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")&&!n.startsWith("20261020232807_")&&!n.startsWith("20261022230000_")).sort()
    .map(name=>`\\echo APPLY ${name}\n${readFileSync(path.join("supabase/migrations",name),"utf8")}`).join("\n");
  try { psql(sql); } catch(error) { throw new Error(`Fresh schema: ${error.stderr?.toString().slice(-1800)}`); }
  client = await connect();
  await check("R04B.2 exact migration dry-run, history CAS, apply and retry preserve data",async()=>{
    const dry=prepareClassMigration("dry-run"), apply=prepareClassMigration("apply");
    await client.query("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])");
    for(const migration of dry.baseline) await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,'{}')",[migration.version,migration.name]);
    const content=()=>client.query("select md5(pg_get_functiondef('public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid)'::regprocedure)) as hash").then(r=>r.rows[0].hash);
    const before=await content();
    psql(dry.sql);assert.equal(await content(),before);
    assert.equal((await client.query("select count(*)::int n from supabase_migrations.schema_migrations")).rows[0].n,63);
    await client.query("update supabase_migrations.schema_migrations set name='synthetic conflict' where version=(select min(version) from supabase_migrations.schema_migrations)");
    assert.throws(()=>psql(apply.sql),e=>e.stderr?.toString().includes("R04B2_MIGRATION_BASELINE_DIVERGED"));
    const first=dry.baseline[0];await client.query("update supabase_migrations.schema_migrations set name=$1 where version=$2",[first.name,first.version]);
    psql(apply.sql);assert.notEqual(await content(),before);
    assert.equal((await client.query("select count(*)::int n from supabase_migrations.schema_migrations")).rows[0].n,64);
    const applied=await content();psql(apply.sql);assert.equal(await content(),applied);
    await client.query("update supabase_migrations.schema_migrations set statements='{}' where version='20261020232807'");
    assert.throws(()=>psql(apply.sql),e=>e.stderr?.toString().includes("R04B2_MIGRATION_HISTORY_CONFLICT"));
    await client.query("update supabase_migrations.schema_migrations set statements=$1 where version='20261020232807'",[[readFileSync("supabase/migrations/20261020232807_sanitario_class_scheme_planning_v2.sql","utf8")]]);
    report.migration={version:"20261020232807",dry_run_rollback:true,exact_history:true,retry_noop:true,baseline_conflict_rejected:true,history_conflict_rejected:true,
      baseline_fingerprint:dry.fingerprint,dry_run_sql_sha256:dry.sql_sha256,apply_sql_sha256:apply.sql_sha256};
  });
  for (const id of [admin,second,outsider]) await client.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@local.invalid`]);
  await client.query("insert into public.app_superadmins(user_id) values($1),($2)",[admin,second]);
  // The historical approval packet pins these exact bytes, before the R03 import.
  // Never rewrite its expected hash to accommodate today's canonical artifact.
  const cb=readFileSync("tests/codex/fixtures/sanitario-v2-before-r03.json"), pb=readFileSync(DECISION_PATH), packet=JSON.parse(pb);
  const candidate=buildApprovalCandidate(JSON.parse(cb),packet,cb,pb);
  const publisherSource=readFileSync("scripts/codex/import-sanitario-protocols-v2.mjs","utf8");
  const privateSource=publisherSource.slice(publisherSource.indexOf("const ROOT ="),publisherSource.indexOf("async function main()")).replace(/\bexport (?=(?:async )?function)/g,"");
  const applyTestOnly=runInNewContext(`${privateSource}\napplyTransaction;`,{...contract,process,path,existsSync,readFileSync,Date});
  await applyTestOnly(client,contract.validateCanonicalTechnicalContract(JSON.parse(cb)).data);
  const originalItems=(await client.query("select * from public.sanitario_protocolo_itens_versions_v2 order by id")).rows;
  await applyTestOnly(client,contract.validateCanonicalTechnicalContract(candidate).data);
  const entries=packet.prepared_item_records;
  const group=(key)=>entries.filter(e=>e.decision_set===key).map(e=>e.record);
  const b19=group("B19")[0];
  await check("upgrade preserves all original physical versions and rejects obsolete review",async()=>{
    const ids=originalItems.map(item=>item.id);
    const preserved=(await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[]) order by id",[ids])).rows;
    assert.equal(preserved.length,20);
    for (const original of originalItems) {
      const row=preserved.find(r=>r.id===original.id);
      for (const field of ["id","protocol_id","logical_item_key","version","snapshot_template","source_refs_by_field","eligibility_rule"]) assert.deepEqual(row[field],original[field]);
    }
    const previous=entries.find(e=>e.decision_set==="B19").expected_previous_id;
    await assert.rejects(asUser(admin,c=>preview(c,b19.protocol_id,[previous])),e=>e.code==="40001"&&e.message==="OBSOLETE_ITEM_VERSION");
  });
  await check("authenticated non-admin, anonymous and direct global writes cannot approve",async()=>{
    await assert.rejects(asUser(outsider,c=>preview(c,b19.protocol_id,[b19.id])),e=>e.code==="42501");
    await assert.rejects(asUser(null,c=>preview(c,b19.protocol_id,[b19.id]),"anon"),e=>e.code==="42501");
    for (const user of [outsider,admin]) await assert.rejects(asUser(user,c=>c.query("update public.sanitario_protocolo_itens_versions_v2 set allows_agenda_auto=true where id=$1 returning id",[b19.id])),e=>e.code==="42501");
    await assert.rejects(asUser(admin,c=>c.query("select public.internal_sanitario_review_content_v2($1,$2)",[b19.protocol_id,[b19.id]])),e=>e.code==="42501");
  });
  const first=await asUser(admin,c=>preview(c,b19.protocol_id,[b19.id]));
  await check("retired or legally blocked protocol cannot be reactivated by review",async()=>{
    const original=(await client.query("select status,legal_status from public.sanitario_protocolos_v2 where id=$1",[b19.protocol_id])).rows[0];
    for (const change of ["status='retired'","legal_status='bloqueado'","legal_status='experimental_alerta'"]) {
      await client.query(`update public.sanitario_protocolos_v2 set ${change} where id=$1`,[b19.protocol_id]);
      const blocked=await asUser(admin,c=>preview(c,b19.protocol_id,[b19.id]));
      assert.deepEqual(blocked.blockers,["PROTOCOL_NOT_AUTOMATABLE"]);
      await assert.rejects(asUser(admin,c=>decide(c,blocked)),e=>e.code==="23514");
      await client.query("update public.sanitario_protocolos_v2 set status=$2,legal_status=$3 where id=$1",[b19.protocol_id,original.status,original.legal_status]);
    }
  });
  const validFirst=await asUser(admin,c=>preview(c,b19.protocol_id,[b19.id]));
  await check("hash and protocol version divergence fail without audit/publication",async()=>{
    assert.deepEqual(first.blockers,[]);
    await assert.rejects(asUser(admin,c=>decide(c,first,randomUUID(),"approved","0".repeat(64))),e=>e.code==="40001");
    await assert.rejects(asUser(admin,c=>preview(c,b19.protocol_id,[b19.id],2)),e=>e.code==="40001");
    assert.equal((await client.query("select count(*)::int as n from public.app_admin_audit_events where action='SANITARY_RULE_DECISION_V2'")).rows[0].n,0);
  });
  await check("authorized explicit B19 approval, trusted actor/time, exact scope and lost-ACK replay",async()=>{
    const request=randomUUID(), receipt=await asUser(admin,c=>decide(c,validFirst,request));
    assert.equal(receipt.actor_id,admin); assert.match(receipt.approved_at,/^\d{4}-/);
    assert.deepEqual(receipt.item_versions,[{id:b19.id,version:b19.version}]);
    assert.deepEqual(await asUser(admin,c=>decide(c,validFirst,request)),receipt);
    await assert.rejects(asUser(second,c=>decide(c,validFirst,request)),e=>e.code==="40001");
    await assert.rejects(asUser(admin,c=>decide(c,validFirst)),e=>e.code==="40001");
    const row=(await client.query("select status,allows_agenda_auto from public.sanitario_protocolo_itens_versions_v2 where id=$1",[b19.id])).rows[0];
    assert.deepEqual(row,{status:"active",allows_agenda_auto:true});
    await assert.rejects(client.query("update public.app_admin_audit_events set action='tampered' where id=$1",[request]),e=>e.code==="23514");
  });
  await check("two reviewers race: one decision wins, other version/hash conflicts",async()=>{
    const item=group("PAR")[0], v=await asUser(admin,c=>preview(c,item.protocol_id,[item.id]));
    assert.deepEqual(v.blockers,[]);
    const outcomes=await Promise.allSettled([asUser(admin,c=>decide(c,v)),asUser(second,c=>decide(c,v))]);
    assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(outcomes.find(r=>r.status==="rejected").reason.code,"40001");
    const rows=(await client.query("select id,allows_agenda_auto from public.sanitario_protocolo_itens_versions_v2 where protocol_id=$1 and deleted_at is null",[item.protocol_id])).rows;
    assert.equal(rows.filter(r=>r.allows_agenda_auto).length,1);
  });
  await check("audit failure rolls back catalog and same request recovers safely",async()=>{
    const item=group("DES")[0], v=await asUser(admin,c=>preview(c,item.protocol_id,[item.id])), request=randomUUID();
    await client.query("create function public.review_test_failure() returns trigger language plpgsql as $$begin if new.action='SANITARY_RULE_DECISION_V2' then raise exception 'simulated storage failure'; end if; return new; end$$; create trigger review_test_failure before insert on public.app_admin_audit_events for each row execute function public.review_test_failure()");
    await assert.rejects(asUser(admin,c=>decide(c,v,request)),/simulated storage failure/);
    assert.equal((await client.query("select allows_agenda_auto from public.sanitario_protocolo_itens_versions_v2 where id=$1",[item.id])).rows[0].allows_agenda_auto,false);
    await client.query("drop trigger review_test_failure on public.app_admin_audit_events; drop function public.review_test_failure()");
    assert.equal((await asUser(admin,c=>decide(c,v,request))).result,"approved");
    assert.equal((await client.query("select count(*)::int as n from public.app_admin_audit_events where id=$1",[request])).rows[0].n,1);
  });
  await check("rejection is auditable and does not enable flags",async()=>{
    const item=group("CONF")[0], v=await asUser(admin,c=>preview(c,item.protocol_id,[item.id]));
    const receipt=await asUser(admin,c=>decide(c,v,randomUUID(),"rejected"));
    assert.equal(receipt.result,"rejected"); assert.equal(receipt.approved_at,null);
    assert.equal((await client.query("select allows_agenda_auto from public.sanitario_protocolo_itens_versions_v2 where id=$1",[item.id])).rows[0].allows_agenda_auto,false);
  });
  await check("registered evidence changes invalidate the reviewed digest",async()=>{
    const item=group("PARTO")[0], v=await asUser(admin,c=>preview(c,item.protocol_id,[item.id]));
    const cov=v.content.coverage[0];
    await client.query("update public.sanitario_fonte_cobertura_campos_v2 set notes=notes||' changed in isolated test' where id=$1",[cov.id]);
    await assert.rejects(asUser(admin,c=>decide(c,v)),e=>e.code==="40001");
    await client.query("update public.sanitario_fonte_cobertura_campos_v2 set notes=$2 where id=$1",[cov.id,cov.notes]);
  });
  await check("all six permanent restrictions and seven commercial evidence gaps stay blocked",async()=>{
    const blocked=[...packet.retained_restricted_records,...entries.filter(e=>["CLO","LEP","IBR"].includes(e.decision_set)).map(e=>e.record)];
    for (const item of blocked) {
      const version=packet.prepared_protocol_records.find(p=>p.record.id===item.protocol_id)?.record.version??1;
      const v=await asUser(admin,c=>preview(c,item.protocol_id,[item.id],version));
      assert(v.blockers.length>0);
      await assert.rejects(asUser(admin,c=>decide(c,v)),e=>e.code==="23514");
      assert.equal((await client.query("select allows_agenda_auto from public.sanitario_protocolo_itens_versions_v2 where id=$1",[item.id])).rows[0].allows_agenda_auto,false);
    }
  });
  await check("complete remaining eligible assessments without a farm or veterinarian",async()=>{
    for (const key of ["PAR","CONF","PARTO"]) {
      const pending=[];
      for (const item of group(key)) if (!(await client.query("select allows_agenda_auto from public.sanitario_protocolo_itens_versions_v2 where id=$1",[item.id])).rows[0].allows_agenda_auto) pending.push(item.id);
      const protocol=group(key)[0].protocol_id;
      if(pending.length) { const v=await asUser(admin,c=>preview(c,protocol,pending)); assert.deepEqual(v.blockers,[]); await asUser(admin,c=>decide(c,v)); }
    }
    assert.equal((await client.query("select count(*)::int as n from public.sanitario_protocolo_itens_versions_v2 where allows_agenda_auto and deleted_at is null")).rows[0].n,7);
    assert.equal((await client.query("select count(*)::int as n from public.sanitario_fontes_tecnicas_v2 where source_key='SRC_EMBRAPA_REC_TEC_26_VERMINOSE_DF' and strength='apoio' and kind='guideline_apoio'")).rows[0].n,1);
    for(const table of ["eventos","insumo_movimentacoes","sanitario_agenda_v2"]) assert.equal((await client.query(`select count(*)::int as n from public.${table}`)).rows[0].n,0);
  });
  await check("R04B class scheme keeps registry evidence, digest, authorization and concurrent replay", async()=>{
    const protocolId=randomUUID(), itemId=randomUUID(), sourceId=randomUUID(), classId=randomUUID();
    const template=group("CLO")[0];
    const insertClone=async(table,id,overrides)=>client.query(`insert into public.${table} select (jsonb_populate_record(null::public.${table},to_jsonb(t)||$2::jsonb)).* from public.${table} t where id=$1`,[id,JSON.stringify(overrides)]);
    await insertClone("sanitario_protocolos_v2",template.protocol_id,{id:protocolId,family_code:"r04b_synthetic_class",name:"R04B synthetic class protocol",metadata:{},status:"draft",approval_status:"draft"});
    const taxonomy=(await client.query("select id from public.sanitario_product_classes_v2 where class_key='vacina_clostridial'")).rows[0];
    await insertClone("sanitario_product_classes_v2",taxonomy.id,{id:classId,class_key:"r04b_synthetic_class",curation_status:"approved_for_catalog"});
    const source=(await client.query("select id from public.sanitario_fontes_tecnicas_v2 where strength='forte' and kind='norma_oficial' limit 1")).rows[0];
    await insertClone("sanitario_fontes_tecnicas_v2",source.id,{id:sourceId,source_key:"SRC_R04B_SYNTHETIC_CLASS_NORM",title:"Synthetic class-applicable source for local tests only"});
    const mappings={};
    for(const field of ["eligibility_rule","operational_window","product_requirement","species_authorization"]) {
      const id=randomUUID();
      await client.query("insert into public.sanitario_fonte_cobertura_campos_v2(id,source_id,field_key,coverage_status,notes) values($1,$2,$3,'covers','Synthetic class scope, not a commercial label')",[id,sourceId,field]);
      mappings[field]=[{id:sourceId,source_ref:"SRC_R04B_SYNTHETIC_CLASS_NORM",metadata:{coverage_ids:[id]}}];
    }
    await insertClone("sanitario_protocolo_itens_versions_v2",template.id,{id:itemId,protocol_id:protocolId,logical_item_key:"r04b_class_dose1",version:2,product_requirement_kind:"product_class",product_class:"r04b_synthetic_class",product_id:null,dose_rule:null,route_rule:null,source_refs_by_field:mappings,snapshot_template:{metadata:{planning_scope:"class_scheme"},executionProductPolicy:"required_at_execution",sourcePolicy:{operational_window:"compatible_product_required_at_execution"}}});
    await assert.rejects(asUser(outsider,c=>preview(c,protocolId,[itemId])),e=>e.code==="42501");
    const first=await asUser(admin,c=>preview(c,protocolId,[itemId]));assert.deepEqual(first.blockers,[]);assert.equal(first.content.classes.length,1);
    await client.query("update public.sanitario_fontes_tecnicas_v2 set kind='registro_produto' where id=$1",[sourceId]);
    assert.match((await asUser(admin,c=>preview(c,protocolId,[itemId]))).blockers[0],/CLASS_APPLICABLE_SOURCE_REQUIRED/);
    await client.query("update public.sanitario_fontes_tecnicas_v2 set kind='norma_oficial' where id=$1",[sourceId]);
    await client.query("update public.sanitario_product_classes_v2 set curation_status='needs_review' where id=$1",[classId]);
    assert.deepEqual((await asUser(admin,c=>preview(c,protocolId,[itemId]))).blockers,["CLASS_SCHEME_CONTRACT_REQUIRED"]);
    await client.query("update public.sanitario_product_classes_v2 set curation_status='approved_for_catalog',name=name||' revised' where id=$1",[classId]);
    await assert.rejects(asUser(admin,c=>decide(c,first)),e=>e.code==="40001");
    const current=await asUser(admin,c=>preview(c,protocolId,[itemId]));assert.deepEqual(current.blockers,[]);
    const users=[admin,second],requests=[randomUUID(),randomUUID()];
    const outcomes=await Promise.allSettled(users.map((user,index)=>asUser(user,c=>decide(c,current,requests[index]))));
    const winner=outcomes.findIndex(o=>o.status==="fulfilled");assert(winner>=0);assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);
    assert.equal(outcomes.find(o=>o.status==="rejected").reason.code,"40001");
    assert.deepEqual(await asUser(users[winner],c=>decide(c,current,requests[winner])),outcomes[winner].value);
    const row=(await client.query("select product_id,dose_rule,route_rule,allows_agenda_auto,source_refs_by_field from public.sanitario_protocolo_itens_versions_v2 where id=$1",[itemId])).rows[0];
    assert.equal(row.product_id,null);assert.equal(row.dose_rule,null);assert.equal(row.route_rule,null);assert.equal(row.allows_agenda_auto,true);
    assert.equal(row.source_refs_by_field.operational_window[0].metadata.catalogFieldReview.scope,"class_scheme");
    assert.equal((await client.query("select count(*)::int as n from public.app_admin_audit_events where target_id=$1",[protocolId])).rows[0].n,1);
  });
  // Rebaseline only test-input fingerprints for this publisher revision. Historical evidence stays immutable.
  const historicalDelta=JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_R04B2_CANONICAL_DELTA_20261021.json","utf8"));
  const currentInputs=Object.fromEntries(Object.entries(historicalDelta.inputs).map(([key,input])=>[key,
    {...input,sha256:createHash("sha256").update(readFileSync(input.path)).digest("hex")} ]));
  const inputJson=key=>JSON.parse(readFileSync(currentInputs[key].path,"utf8"));
  const delta=prepareClassDelta(inputJson("canonical"),inputJson("previews"),inputJson("baseline"),inputJson("technical"),currentInputs);
  assert.deepEqual(delta.payload,historicalDelta.payload,"Test rebaseline cannot alter the publication payload");
  const deltaPath=path.join(dir,"current-publisher-delta.json");writeFileSync(deltaPath,JSON.stringify(delta));
  const deltaItems=delta.payload.protocol_item_rows;
  // Complete the R03 product-reference fixture using the same existing engine.
  // No production authorization is introduced by this test-only fixture setup.
  const fixtureData=Object.fromEntries(Object.keys(contract.validateCanonicalTechnicalContract(JSON.parse(cb)).data).map(k=>[k,[]]));
  fixtureData.product_rows=delta.payload.product_rows;
  await applyTestOnly(client,fixtureData);
  await client.query("insert into public.fazendas(id,nome) values($1,'R05 synthetic preservation fixture')",[delta.protected.r05_farm_id]);
  for(const agenda of JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_R04B_CLASS_REMOTE_FINAL_20261020.json","utf8")).agendas) {
    // Preservation fixture through the supported legacy insert boundary, with gates OFF.
    // It copies R05 identities/snapshots, not the contract-2 operational execution path.
    await client.query("insert into public.sanitario_agenda_v2 select (jsonb_populate_record(null::public.sanitario_agenda_v2,$1::jsonb)).*",[JSON.stringify({...agenda,contract_version:null})]);
  }
  const protectedBefore=(await client.query("select jsonb_build_object('items',(select jsonb_agg(to_jsonb(t) order by id) from public.sanitario_protocolo_itens_versions_v2 t where id=any($1::uuid[])),'agendas',(select jsonb_agg(to_jsonb(a) order by id) from public.sanitario_agenda_v2 a),'events',(select count(*) from public.eventos),'gates',(select jsonb_agg(to_jsonb(g) order by fazenda_id) from public.sanitario_sync_v2_gates g)) as value",[delta.protected.approved_item_ids])).rows[0].value;
  const authorizedPath=path.join(dir,"local-authorized-delta.json");
  writeFileSync(authorizedPath,JSON.stringify({...delta,import_gate:{import_real_authorized:true,authorization_reference:"explicit synthetic authorization in disposable DB only"}}));
  const publish=(mode="apply",file=authorizedPath)=>new Promise(resolve=>execFile(process.execPath,
    ["scripts/codex/import-sanitario-protocols-v2.mjs",`--${mode}`,"--incremental",file],
    {cwd:root,encoding:"utf8",maxBuffer:8*1024*1024,env:{...process.env,PGUSER:"postgres",DB_URL:`postgresql://127.0.0.1:55435/${database}`,
      ALLOW_SANITARIO_IMPORT:"1",SANITARIO_IMPORT_CONFIRM:contract.CANONICAL_ARTIFACT_VERSION,SANITARIO_DELTA_CONFIRM:delta.content_sha256}},
    (error,stdout,stderr)=>resolve({code:error?.code??0,stdout,stderr})));
  const assertNoDelta=async()=>assert.equal((await client.query("select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[])",[deltaItems.map(i=>i.id)])).rows[0].n,0);
  await check("R04B.2 public incremental dry-run, explicit authorization and CAS reject changed source without writes",async()=>{
    const dry=await publish("dry-run",deltaPath);assert.equal(dry.code,0,dry.stderr);await assertNoDelta();
    const blocked=await publish("apply",deltaPath);assert.notEqual(blocked.code,0);assert.match(blocked.stderr,/IMPORT_REAL_NOT_AUTHORIZED/);
    const source=delta.payload.source_rows[0];
    await client.query("update public.sanitario_fontes_tecnicas_v2 set title=title||' concurrent edit' where id=$1",[source.id]);
    const conflict=await publish();assert.notEqual(conflict.code,0);assert.match(conflict.stderr,/INCREMENTAL_BASELINE_CONFLICT/);await assertNoDelta();
    await client.query("update public.sanitario_fontes_tecnicas_v2 set title=$2 where id=$1",[source.id,source.title]);
    const prior=delta.baseline.predecessors[0];
    await client.query("update public.sanitario_protocolo_itens_versions_v2 set status='active',allows_agenda_auto=true where id=$1",[prior.id]);
    const active=await publish();assert.notEqual(active.code,0);await assertNoDelta();
    await client.query("update public.sanitario_protocolo_itens_versions_v2 set status='draft',allows_agenda_auto=false where id=$1",[prior.id]);
    const newerId=randomUUID(),next=deltaItems.find(i=>i.logical_item_key===prior.logical_item_key);
    await client.query("insert into public.sanitario_protocolo_itens_versions_v2 select (jsonb_populate_record(null::public.sanitario_protocolo_itens_versions_v2,to_jsonb(t)||$2::jsonb)).* from public.sanitario_protocolo_itens_versions_v2 t where id=$1",[prior.id,JSON.stringify({id:newerId,version:next.version+1})]);
    const newer=await publish();assert.notEqual(newer.code,0);assert.match(newer.stderr,/INCREMENTAL_NEWER_VERSION_CONFLICT/);await assertNoDelta();
    // Retain the conflicting version as historical test data; no active competing version.
    await client.query("update public.sanitario_protocolo_itens_versions_v2 set status='retired',deleted_at=now() where id=$1",[newerId]);
  });
  await check("R04B.2 failed canonical publication rolls back candidates, class reviews, coverage and links",async()=>{
    await client.query("create function public.delta_test_failure() returns trigger language plpgsql as $$begin if new.logical_item_key='lepto_primovac_dose1' and new.version=3 then raise exception 'delta simulated storage failure'; end if; return new; end$$; create trigger delta_test_failure before insert on public.sanitario_protocolo_itens_versions_v2 for each row execute function public.delta_test_failure()");
    const failed=await publish();assert.notEqual(failed.code,0);assert.match(failed.stderr,/delta simulated storage failure/);await assertNoDelta();
    assert.equal((await client.query("select count(*)::int n from public.sanitario_fonte_cobertura_campos_v2 where id=any($1::uuid[])",[delta.payload.coverage_rows.map(c=>c.id)])).rows[0].n,0);
    assert.equal((await client.query("select count(*)::int n from public.sanitario_product_classes_v2 where id=any($1::uuid[]) and curation_status='needs_review'",[delta.payload.product_class_rows.map(c=>c.id)])).rows[0].n,2);
    await client.query("drop trigger delta_test_failure on public.sanitario_protocolo_itens_versions_v2; drop function public.delta_test_failure()");
  });
  await check("R04B.2 concurrent public imports and lost-ACK replay converge with exact supersession",async()=>{
    const results=await Promise.all([publish(),publish()]);for(const r of results)assert.equal(r.code,0,r.stderr);
    assert(results.some(r=>r.stdout.includes('"create":15')));
    assert(results.some(r=>r.stdout.includes('"create":0,"update":0')));
    const replay=await publish();assert.equal(replay.code,0,replay.stderr);assert.match(replay.stdout,/"create":0,"update":0/);
    for(const item of deltaItems) {
      const rows=(await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where protocol_id=$1 and logical_item_key=$2 order by version",[item.protocol_id,item.logical_item_key])).rows;
      const current=rows.find(r=>r.id===item.id),prior=rows.find(r=>r.id===item.snapshot_template.metadata.supersedes.id);
      assert.equal(current.status,"draft");assert.equal(current.allows_agenda_auto,false);assert.equal(prior.status,"retired");assert(prior.deleted_at);
      assert.deepEqual(prior.snapshot_template,delta.baseline.predecessors.find(p=>p.id===prior.id).snapshot_template);
      assert.equal(rows.filter(r=>r.status==="active"&&!r.deleted_at).length,0);
    }
  });
  if (process.argv.includes("--initial-bootstrap")) {
    await client.query(readFileSync("supabase/migrations/20261022230000_sanitario_manual_catalog_review_v2.sql", "utf8"));
    await verifyInitialBootstrap({ client, admin, second, check, dir, database, contract });
  } else {
  await check("R04B.2 five authenticated previews, grouped approvals, flags and authorized replay preserve R04/R05",async()=>{
    const individual=await asUser(admin,async c=>{ const result=[];for(const i of deltaItems) result.push(await preview(c,i.protocol_id,[i.id]));return result; });
    assert(individual.every(v=>v.blockers.length===0));
    const groups=[...new Set(deltaItems.map(i=>i.protocol_id))];
    const grouped=await asUser(admin,async c=>{ const result=[];for(const p of groups) result.push(await preview(c,p,deltaItems.filter(i=>i.protocol_id===p).map(i=>i.id)));return result; });
    for(const v of grouped) {
      assert.deepEqual(v.blockers,[]);const request=randomUUID();
      const receipt=await asUser(admin,c=>decide(c,v,request));
      assert.equal(receipt.result,"approved");assert.deepEqual(await asUser(admin,c=>decide(c,v,request)),receipt);
    }
    for(const item of deltaItems) {
      const current=(await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where id=$1",[item.id])).rows[0];
      assert.equal(current.status,"active");assert.equal(current.allows_agenda_auto,true);
      assert.equal(current.snapshot_template.metadata.proposal_only,false,"approval must clear transient proposal_only");
      assert.equal(current.snapshot_template.metadata.automationStatus,"agenda_allowed");
      assert.equal((await client.query("select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where protocol_id=$1 and logical_item_key=$2 and status='active' and deleted_at is null",[item.protocol_id,item.logical_item_key])).rows[0].n,1);
    }
    const replay=await publish();assert.equal(replay.code,0,replay.stderr);assert.match(replay.stdout,/"create":0,"update":0/);
    const after=(await client.query("select jsonb_build_object('items',(select jsonb_agg(to_jsonb(t) order by id) from public.sanitario_protocolo_itens_versions_v2 t where id=any($1::uuid[])),'agendas',(select jsonb_agg(to_jsonb(a) order by id) from public.sanitario_agenda_v2 a),'events',(select count(*) from public.eventos),'gates',(select jsonb_agg(to_jsonb(g) order by fazenda_id) from public.sanitario_sync_v2_gates g)) as value",[delta.protected.approved_item_ids])).rows[0].value;
    assert.deepEqual(after,protectedBefore);
    report.incremental={content_sha256:delta.content_sha256,candidates:5,coverage:8,classes:2,product_links:2,
      individual_authenticated_previews:5,authoritative_group_digests:2,original_approvals_preserved:7,r05_agendas_preserved:7,
      agenda_fixture:"R05 IDs/snapshots copied as legacy contract=null; no gate activation or R05 rerun",
      real_remote_mutations:0};
  });
  const catalog={protocols:(await client.query("select * from public.sanitario_protocolos_v2 where deleted_at is null")).rows,
    items:(await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where deleted_at is null")).rows};
  writeFileSync(path.join(dir,"approved-catalog.json"),JSON.stringify(catalog,null,2)+"\n");
  await client.query(readFileSync("supabase/migrations/20261022230000_sanitario_manual_catalog_review_v2.sql", "utf8"));
  await verifyClosurePublication({ client, asUser, admin, preview, decide, check, dir, database, contract });
  await verifyManualCatalogReview({ client, asUser, admin, outsider, preview, decide, check });
  }
  report.result="PASS"; report.original_approvals_preserved=7;
  report.approved_in_disposable_database=(await client.query("select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where allows_agenda_auto")).rows[0].n;
  report.real_catalog_authorizations=0;
} catch(error) { report.result="FAIL";report.error=error.message;console.error(error.message);process.exitCode=1;
} finally {
  await client?.end();
  if(containerId) { assert.match(containerId,/^[a-f0-9]{64}$/);assert.match(container,/^sanitario-review-[a-f0-9]{32}$/);docker(["rm","--force",containerId]);report.disposable_database_removed=true; }
  writeFileSync(path.join(dir,"evidence.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({result:report.result,cases:report.cases.length,catalog_file:report.catalog_file,evidence_directory:dir}));
}
