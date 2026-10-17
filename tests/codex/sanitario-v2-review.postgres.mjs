// Real PostgreSQL/roles/locks in a NEW disposable local database; never the hosted DB.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import pg from "pg";
import * as contract from "../../scripts/codex/sanitario-v2-contract.mjs";
import { buildApprovalCandidate, CANONICAL_PATH, DECISION_PATH } from "../../scripts/codex/prepare-sanitario-approval-v2.mjs";

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
  const sql = readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort()
    .map(name=>`\\echo APPLY ${name}\n${readFileSync(path.join("supabase/migrations",name),"utf8")}`).join("\n");
  try { psql(sql); } catch(error) { throw new Error(`Fresh schema: ${error.stderr?.toString().slice(-1800)}`); }
  client = await connect();
  for (const id of [admin,second,outsider]) await client.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@local.invalid`]);
  await client.query("insert into public.app_superadmins(user_id) values($1),($2)",[admin,second]);
  const cb=readFileSync(CANONICAL_PATH), pb=readFileSync(DECISION_PATH), packet=JSON.parse(pb);
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
  const catalog={protocols:(await client.query("select * from public.sanitario_protocolos_v2 where deleted_at is null")).rows,
    items:(await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where deleted_at is null")).rows};
  writeFileSync(path.join(dir,"approved-catalog.json"),JSON.stringify(catalog,null,2)+"\n");
  report.result="PASS"; report.approved_in_disposable_database=7; report.real_catalog_authorizations=0; report.catalog_file=path.join(dir,"approved-catalog.json");
} catch(error) { report.result="FAIL";report.error=error.message;console.error(error.message);process.exitCode=1;
} finally {
  await client?.end();
  if(containerId) { assert.match(containerId,/^[a-f0-9]{64}$/);assert.match(container,/^sanitario-review-[a-f0-9]{32}$/);docker(["rm","--force",containerId]);report.disposable_database_removed=true; }
  writeFileSync(path.join(dir,"evidence.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({result:report.result,cases:report.cases.length,catalog_file:report.catalog_file,evidence_directory:dir}));
}
