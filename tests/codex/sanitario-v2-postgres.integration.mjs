// P3 TEST-ONLY. Run with node; never invokes the production CLI or apply gate.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { runInNewContext } from "node:vm";
import pg from "pg";
import * as contract from "../../scripts/codex/sanitario-v2-contract.mjs";
import * as publicPublisher from "../../scripts/codex/import-sanitario-protocols-v2.mjs";

const root = process.cwd();
const container = "supabase_db_GestaoAgro";
const host = "127.0.0.1";
const port = 54322;
const database = `sanitario_p3_${randomUUID().replaceAll("-", "")}`;
const publisherSource = readFileSync(path.join(root, "scripts/codex/import-sanitario-protocols-v2.mjs"), "utf8");
const payload = JSON.parse(readFileSync(path.join(root, "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json"), "utf8"));
// Same sandbox technique as P2: unchanged private implementation, no copied logic.
const privateSource = publisherSource.slice(publisherSource.indexOf("const ROOT ="),
  publisherSource.indexOf("async function main()")).replace(/\bexport (?=(?:async )?function)/g, "");
const engine = runInNewContext(`${privateSource}\n({applyTransaction, IMPORT_LOCK_KEY, PUBLISHERS, PIPELINE_STATUS});`,
  { ...contract, process, path, existsSync, readFileSync, Date });
const tables = Object.fromEntries(engine.PUBLISHERS.map(p => [p.collection, p.table]));
const report = {
  baseline: { branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() },
  environment: { host, port, database, local_only: true, isolation: "new dedicated disposable database" },
  migrations: [], cases: [], status: "BLOCKED", gates: {},
};
let client;
let password;
let created = false;
const docker = args => execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
const psql = (sql, role = "postgres") => execFileSync("docker", ["exec", "-i", container, "sh", "-c",
  'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -U "$1" -d "$2"', "p3-psql", role, database],
  { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
async function connect() {
  assert.equal(host, "127.0.0.1");
  assert.match(database, /^sanitario_p3_[a-f0-9]{32}$/);
  const c = new pg.Client({ host, port, database, user: "postgres", password, connectionTimeoutMillis: 5000 });
  await c.connect();
  return c;
}
async function test(name, fn) {
  try { const evidence = await fn(); report.cases.push({ name, result: "PASS", evidence }); console.log(`PASS ${name}`); }
  catch (error) { report.cases.push({ name, result: "FAIL", code: error.code, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
const id = n => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  return {
    source_rows: [{ id: id(1), source_key: "SRC_P3_SOURCE", kind: "bula", scope: "global", title: "Fonte sintetica P3",
      published_at: "2026-01-02", accessed_at: "2026-09-30", strength: "forte", evidence_status: "SIM_BULA",
      limitations: ["synthetic"], metadata: { certification: "P3", nested: { value: 2 } } }],
    coverage_rows: [{ id: id(2), source_key: "SRC_P3_SOURCE", field_key: "dose", coverage_status: "covers", notes: "P3" }],
    product_rows: [{ id: id(3), product_key: "P3_PRODUCT", nome_comercial: "Produto P3 sintetico", classe: "vacina",
      tipo_produto: "vacina", status_curatorial: "precisa_validar", metadata: { synthetic: true } }],
    product_authorization_rows: [{ id: id(4), product_key: "P3_PRODUCT", species_code: "bovino", aptitude: "all",
      authorization_status: "SIM_BULA", lactacao_permitida: true, gestacao_permitida: false, idade_min_dias: 10 }],
    product_source_rows: [{ product_key: "P3_PRODUCT", source_key: "SRC_P3_SOURCE", field_key: "dose" }],
    dose_rule_rows: [{ id: id(5), product_key: "P3_PRODUCT", route: "subcutanea", dose_quantity: 1.2345,
      dose_unit: "mL", dose_basis: "animal", min_weight_kg: 20.125, max_weight_kg: 500.875 }],
    withdrawal_rule_rows: [{ id: id(6), withdrawal_rule_key: "P3_WITHDRAWAL", product_key: "P3_PRODUCT",
      species_code: "bovino", aptitude: "all", applicability: "period", meat_days: 30, milk_days: 2, milk_hours: 48,
      valid_from: "2026-01-02", valid_until: "2027-01-02", metadata: { synthetic: true } }],
    withdrawal_source_rows: [{ withdrawal_rule_key: "P3_WITHDRAWAL", source_key: "SRC_P3_SOURCE", field_key: "withdrawal" }],
    product_class_rows: [{ id: id(7), class_key: "P3_CLASS", name: "Classe P3", scope: "global", product_type: "vacina",
      species_scope: ["bovino", "bubalino"], curation_status: "candidate", automation_status: "manual_only",
      limitations: ["synthetic", "no execution"], metadata: { synthetic: true } }],
    product_class_group_rows: [{ id: id(8), group_key: "P3_GROUP", name: "Grupo P3", scope: "global",
      curation_status: "needs_review", automation_status: "manual_only", limitations: ["synthetic"] }],
    product_class_group_member_rows: [{ id: id(9), group_key: "P3_GROUP", class_key: "P3_CLASS", limitations: ["synthetic"] }],
    product_class_default_rule_rows: [{ id: id(10), class_key: "P3_CLASS", species_code: "bovino", aptitude: "all",
      dose_rule: { quantity: 1.5, unit: "mL" }, route_rule: { route: "subcutanea" },
      withdrawal_rule: { unknown: true }, source_refs: [{ source_key: "SRC_P3_SOURCE" }], limitations: ["synthetic"] }],
    protocol_rows: [{ id: id(11), protocol_key: "P3_PROTOCOL", family_code: "P3_FAMILY", name: "Protocolo P3",
      scope: "global", species_scope: ["bovino"], legal_status: "recomendado_tecnico", version: 1, status: "draft",
      source_refs_snapshot: [{ source_key: "SRC_P3_SOURCE" }], metadata: { synthetic: true } }],
    protocol_item_rows: ["specific_product", "product_class", "product_class_group", "none"].map((kind, i) => ({
      id: id(12 + i), protocol_key: "P3_PROTOCOL", logical_item_key: `P3_ITEM_${i}`, version: 1,
      item_status: "recomendado", action_type: "vacinacao", product_requirement_kind: kind,
      product_key: "P3_PRODUCT", class_key: "P3_CLASS", group_key: "P3_GROUP",
      eligibility_rule: { minimum_days: 10 }, operational_window_rule: { days: [1, 2] },
      dose_rule: { quantity: 1.2345, unit: "mL" }, route_rule: { route: "subcutanea", qualifiers: ["synthetic"] },
      species_authorization: ["bovino"], source_refs_by_field: { dose: ["SRC_P3_SOURCE"] }, limitations: ["synthetic"] })),
  };
}
async function snapshot() {
  const out = {};
  for (const table of Object.values(tables)) out[table] = (await client.query(`select * from public.${table} order by 1,2,3`)).rows;
  return out;
}
async function reset() {
  assert(created && /^sanitario_p3_[a-f0-9]{32}$/.test(database));
  // Only this run's new, dedicated database; never the shared local database.
  await client.query(`truncate ${Object.values(tables).map(t => `public.${t}`).join(",")} cascade`);
}
async function seed(data = fixture()) { await reset(); return engine.applyTransaction(client, data); }
async function rejectSQL(sql, values, code) {
  await assert.rejects(client.query(sql, values), e => { assert.equal(e.code, code); return true; });
  return code;
}
async function cloneRow(table, sourceId, changes) {
  return client.query(`insert into public.${table} select (jsonb_populate_record(null::public.${table},
    to_jsonb(t)||$2::jsonb)).* from public.${table} t where id=$1 returning *`,[sourceId,JSON.stringify(changes)]);
}
function barrier() {
  let release; const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}
async function observeBlocked(observer, pid, blockerPid) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const row = (await observer.query("select pg_blocking_pids($1) as blockers",[pid])).rows[0];
    if (row.blockers.includes(blockerPid)) return row.blockers;
    await new Promise(resolve => setTimeout(resolve,25));
  }
  throw new Error("Expected PostgreSQL blocker was not observed");
}

try {
  assert.equal(report.baseline.branch, "feat/sanitario-v2-publisher-completion");
  assert.equal(engine.PIPELINE_STATUS.PUBLISHER_COMPLETE,true);
  assert.equal(payload.execute_import,false);
  assert.equal(payload.import_gate.import_real_authorized,false);
  assert.notEqual(process.env.ALLOW_SANITARIO_IMPORT,"1");
  assert.notEqual(process.env.ALLOW_SANITARIO_REMOTE_IMPORT,"1");
  assert.equal(publicPublisher.applyTransaction,undefined);
  assert.equal(publicPublisher.applyImport,undefined);
  assert.equal(publicPublisher.writeOperation,undefined);
  assert.throws(() => publicPublisher.assertApplyGate(payload),/IMPORT_REAL_NOT_AUTHORIZED/);
  report.gates = { PUBLISHER_COMPLETE: true, IMPORT_REAL_AUTHORIZED: false, execute_import: false };
  const endpoint = docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"] ).trim();
  assert.match(endpoint, /^(npipe:\/\/|unix:\/\/)/, "Docker must use a local engine socket");
  const bindings = JSON.parse(docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", container]));
  assert(bindings["5432/tcp"].some(b => b.HostPort === String(port)));
  password = docker(["exec", container, "printenv", "POSTGRES_PASSWORD"]).trim(); // memory only, never logged
  docker(["exec", container, "createdb", "-U", "postgres", "--template=template0", database]);
  created = true;
  // Genuine local Supabase auth infrastructure, schema only, no user data or credentials.
  const authSchema = docker(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--schema=auth", "--no-owner"]);
  report.environment.auth_schema_sha256 = createHash("sha256").update(authSchema).digest("hex");
  psql(authSchema, "supabase_admin");
  for (const file of readdirSync(path.join(root, "supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(root, "supabase/migrations", file), "utf8");
    try { psql(sql); }
    catch (error) { throw new Error(`Migration ${file}: ${error.stderr?.toString().slice(-2000) ?? "failed"}`); }
    report.migrations.push({ file, sha256: createHash("sha256").update(sql).digest("hex") });
  }
  client = await connect();
  report.environment.version = (await client.query("select version() as version")).rows[0].version;
  console.log(`LOCAL_ONLY ${host}:${port}/${database}; migrations=${report.migrations.length}`);
  await test("schema / RLS / role / ACL", async () => {
    const result = (await client.query(`select c.relname, c.relrowsecurity, c.relforcerowsecurity,
      has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
      has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
      has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,
      has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1) order by c.relname`, [Object.values(tables)])).rows;
    assert.equal(result.length, 14); assert(result.every(r => r.relrowsecurity));
    const role = (await client.query("select current_user, rolsuper, rolbypassrls from pg_roles where rolname=current_user")).rows[0];
    report.schema = { tables: result, role,
      available_roles: (await client.query("select rolname,rolsuper,rolbypassrls from pg_roles where rolname=any($1) order by rolname",[["postgres","supabase_admin","authenticated","anon","service_role"]])).rows,
      columns: (await client.query(`select table_name,column_name,data_type,udt_name,is_nullable,column_default
        from information_schema.columns where table_schema='public' and table_name=any($1) order by table_name,ordinal_position`,[Object.values(tables)])).rows,
      triggers: (await client.query(`select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t
        join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relname=any($1) order by 1,2`, [Object.values(tables)])).rows };
    return report.schema;
  });
  await test("create 14/14 / bindings / canonical UUID / composite PK", async () => {
    const data = fixture(); const counts = await seed(data); assert.equal(counts.create, 17);
    const stored = await snapshot();
    for (const [collection, table] of Object.entries(tables)) {
      assert.equal(stored[table].length, data[collection].length);
      if (collection.endsWith("source_rows") && collection !== "source_rows") assert(stored[table].every(r => !("id" in r)));
      else assert.deepEqual(stored[table].map(r => r.id).sort(), data[collection].map(r => r.id).sort());
    }
    report.create = { counts, rows: Object.fromEntries(Object.entries(stored).map(([t,r]) => [t,r.length])) };
    return report.create;
  });
  await test("real SQL types / direct reads", async () => {
    const stored = await snapshot();
    assert.deepEqual(stored[tables.source_rows][0].metadata, fixture().source_rows[0].metadata);
    const date = value => [value.getFullYear(),value.getMonth()+1,value.getDate()];
    assert.deepEqual(date(stored[tables.source_rows][0].published_at),[2026,1,2]);
    assert.deepEqual(date(stored[tables.source_rows][0].accessed_at),[2026,9,30]);
    assert(stored[tables.source_rows][0].created_at instanceof Date);
    assert.deepEqual(stored[tables.product_class_rows][0].species_scope, ["bovino", "bubalino"]);
    assert.deepEqual(stored[tables.product_class_rows][0].limitations, ["synthetic", "no execution"]);
    const dose = stored[tables.dose_rule_rows][0];
    assert.equal(dose.dose_quantity, "1.2345"); assert.equal(dose.min_weight_kg, "20.125"); assert.equal(dose.max_weight_kg, "500.875");
    const withdrawal = stored[tables.withdrawal_rule_rows][0];
    assert.deepEqual([withdrawal.meat_days,withdrawal.milk_days,withdrawal.milk_hours], [30,2,48]);
    assert.deepEqual(date(withdrawal.valid_from),[2026,1,2]);
    assert.deepEqual(date(withdrawal.valid_until),[2027,1,2]); assert.equal(withdrawal.route, null);
    const auth = stored[tables.product_authorization_rows][0];
    assert.equal(auth.lactacao_permitida,true); assert.equal(auth.gestacao_permitida,false); assert.equal(auth.sexo,null);
    for (const row of stored[tables.protocol_item_rows]) {
      assert.deepEqual(row.dose_rule, fixture().protocol_item_rows[0].dose_rule);
      assert.deepEqual(row.route_rule, fixture().protocol_item_rows[0].route_rule);
      assert.equal(row.allows_agenda_auto,false);
    }
    assert.deepEqual(stored[tables.product_class_default_rule_rows][0].source_refs, [{ source_key: "SRC_P3_SOURCE" }]);
    return { jsonb: "persisted", arrays: "text[] persisted", dates: "date and timestamptz", numeric: dose, nullable_boolean: "persisted" };
  });
  await test("replay / post-commit / unchanged rows", async () => {
    const before = await snapshot(); const counts = await engine.applyTransaction(client, fixture());
    assert.equal(counts.skip,17); assert.equal(counts.create,0); assert.equal(counts.update,0);
    assert.deepEqual(await snapshot(), before); report.replay = counts; return counts;
  });
  await test("convergent update / 12 mutable collections / replay", async () => {
    const data = fixture(); await seed(data);
    data.source_rows[0].title += " updated";
    data.coverage_rows[0].notes = "updated";
    data.product_rows[0].metadata.updated = true;
    data.product_class_rows[0].name += " updated";
    data.product_class_group_rows[0].name += " updated";
    data.product_authorization_rows[0].lactacao_permitida = false;
    data.dose_rule_rows[0].dose_quantity = 2.3456;
    data.withdrawal_rule_rows[0].meat_days = 31;
    data.product_class_default_rule_rows[0].dose_rule.quantity = 2;
    data.product_class_group_member_rows[0].is_allowed = false;
    data.protocol_rows[0].name += " updated";
    for (const item of data.protocol_item_rows) item.dose_rule.quantity = 2;
    const plan = await publicPublisher.buildPlan(client,data);
    assert.equal(plan.filter(p => p.action === "update").length,15);
    const counts = await engine.applyTransaction(client,data);
    assert.equal(counts.update,15); assert.equal(counts.skip,2);
    const stored = await snapshot();
    for (const op of plan.filter(p => p.action === "update")) {
      const row = stored[op.table].find(r => r.id === op.row.id);
      for (const [field,value] of Object.entries(op.row)) {
        if (row[field] instanceof Date) continue;
        assert.deepEqual(typeof row[field] === "string" && typeof value === "number" ? Number(row[field]) : row[field], value);
      }
    }
    const replay = await engine.applyTransaction(client,data); assert.equal(replay.skip,17);
    assert.deepEqual(await snapshot(),stored); return { counts, replay };
  });
  const protectedCases = [
    ["protocol approved", "protocol_rows", "approval_status='approved'", "name", "protocol"],
    ["protocol active", "protocol_rows", "status='active'", "name", "protocol"],
    ["group curated", "product_class_group_rows", "curation_status='approved_for_catalog'", "name", "group"],
    ["group operational", "product_class_group_rows", "automation_status='agenda_allowed'", "name", "group"],
    ["class curated", "product_class_rows", "curation_status='approved_for_catalog'", "name", "class"],
    ["class blocked", "product_class_rows", "automation_status='blocked'", "name", "class"],
    ["item active", "protocol_item_rows", "status='active'", "dose_rule", "item"],
    ["product curated", "product_rows", "status_curatorial='ativo'", "metadata", "technical"],
    ["dose curated", "dose_rule_rows", "status_curatorial='ativo'", "dose_quantity", "technical"],
    ["withdrawal curated", "withdrawal_rule_rows", "status_curatorial='ativo'", "meat_days", "technical"],
    ["default curated", "product_class_default_rule_rows", "curation_status='approved_for_catalog'", "dose_rule", "default"],
  ];
  for (const [label,collection,sql,field,reason] of protectedCases) await test(`protected / ${label}`, async () => {
    const data = fixture(); await seed(data);
    await client.query(`update public.${tables[collection]} set ${sql} where id=$1`,[data[collection][0].id]);
    const before = await snapshot();
    data[collection][0][field] = typeof data[collection][0][field] === "number" ? 99
      : typeof data[collection][0][field] === "object" ? { divergent: true } : "divergent";
    const target = (await publicPublisher.buildPlan(client,data)).find(p => p.collection === collection);
    assert.equal(target.action,"reject"); assert(target.reason.includes(reason));
    await assert.rejects(engine.applyTransaction(client,data),/UNEXPECTED_CONFLICT/);
    assert.deepEqual(await snapshot(),before); return { rejection: target.reason, unchanged: true };
  });
  const identityFields = {
    source_rows: "source_key", coverage_rows: "field_key", product_rows: "nome_comercial",
    product_class_rows: "class_key", product_class_group_rows: "group_key", product_authorization_rows: "sexo",
    dose_rule_rows: "route", withdrawal_rule_rows: "route", product_class_default_rule_rows: "aptitude",
    product_class_group_member_rows: "class_id", protocol_rows: "family_code", protocol_item_rows: "logical_item_key",
  };
  for (const [collection,field] of Object.entries(identityFields)) await test(`UUID conflict / ${collection}`,async () => {
    const data = fixture(); await seed(data);
    // Divergent canonical identity; references remain unchanged and must also fail closed.
    if (collection === "product_class_group_member_rows") {
      data.product_class_rows.push({ ...data.product_class_rows[0], id:id(30), class_key:"P3_OTHER_CLASS" });
      data[collection][0].class_key = "P3_OTHER_CLASS";
    } else data[collection][0][field] = field === "aptitude" ? "corte" : field === "source_key" ? "SRC_P3_OTHER" : "other";
    const before = await snapshot();
    const op = (await publicPublisher.buildPlan(client,data)).find(p => p.collection === collection);
    assert.equal(op.reason,"CANONICAL_UUID_OTHER_IDENTITY");
    await assert.rejects(engine.applyTransaction(client,data),/UNEXPECTED_CONFLICT/);
    assert.deepEqual(await snapshot(),before); return op.reason;
  });
  for (const collection of Object.keys(identityFields).filter(c => !["dose_rule_rows","withdrawal_rule_rows"].includes(c))) {
    await test(`natural key conflict / ${collection}`,async () => {
      const data = fixture(); await seed(data); const before = await snapshot();
      data[collection][0].id = id(31);
      const op = (await publicPublisher.buildPlan(client,data)).find(p => p.collection === collection && p.canonical_id === id(31));
      assert.equal(op.reason,"IDENTITY_CONFLICT");
      await assert.rejects(engine.applyTransaction(client,data),/UNEXPECTED_CONFLICT/);
      assert.deepEqual(await snapshot(),before); return op.reason;
    });
  }
  for (const collection of Object.keys(identityFields)) await test(`tombstone reserved / ${collection}`,async () => {
    const data = fixture(); await seed(data);
    await client.query(`update public.${tables[collection]} set deleted_at=now() where id=$1`,[data[collection][0].id]);
    const before = await snapshot();
    const op = (await publicPublisher.buildPlan(client,data)).find(p => p.collection === collection);
    assert.equal(op.reason,"TOMBSTONE_IDENTITY_RESERVED");
    await assert.rejects(engine.applyTransaction(client,data),/UNEXPECTED_CONFLICT/);
    assert.deepEqual(await snapshot(),before);
    let newUuidSameKey = "not applicable: UUID-only rule has no independent natural key";
    if (!["dose_rule_rows","withdrawal_rule_rows"].includes(collection)) {
      const replacement = structuredClone(data); replacement[collection][0].id = id(32);
      const conflict = (await publicPublisher.buildPlan(client,replacement)).find(p => p.canonical_id === id(32));
      assert.equal(conflict.reason,"IDENTITY_CONFLICT");
      await assert.rejects(engine.applyTransaction(client,replacement),/UNEXPECTED_CONFLICT/);
      assert.deepEqual(await snapshot(),before); newUuidSameKey = conflict.reason;
    }
    if (["source_rows","product_class_rows"].includes(collection)) {
      await rejectSQL(`insert into public.${tables[collection]} select (jsonb_populate_record(null::public.${tables[collection]},
        to_jsonb(t)||jsonb_build_object('id',$2::uuid,'deleted_at',null))).* from public.${tables[collection]} t where id=$1`,
      [data[collection][0].id,id(32)],"23505");
    }
    return { rejection: op.reason, new_uuid_same_natural_key: newUuidSameKey, restored: false };
  });
  await test("absence does not tombstone / explicit deprecated draft contract",async () => {
    const data = fixture(); data.protocol_rows[0].family_code = "raiva_herbivoros"; await seed(data);
    const smaller = structuredClone(data); smaller.coverage_rows = []; smaller.protocol_item_rows.pop();
    const before = await snapshot(); await engine.applyTransaction(client,smaller); assert.deepEqual(await snapshot(),before);
    await client.query(`insert into public.${tables.protocol_item_rows} select (jsonb_populate_record(null::public.${tables.protocol_item_rows},
      to_jsonb(t)||jsonb_build_object('id',$2::uuid,'logical_item_key','raiva_area_risco_anual'))).* from public.${tables.protocol_item_rows} t where id=$1`,[id(12),id(33)]);
    const counts = await engine.applyTransaction(client,data);
    const retired = (await client.query(`select * from public.${tables.protocol_item_rows} where id=$1`,[id(33)])).rows[0];
    assert(retired.deleted_at); assert.equal(retired.status,"retired"); assert.equal(retired.allows_agenda_auto,false);
    assert.equal((await engine.applyTransaction(client,data)).skip,17);
    await client.query(`update public.${tables.protocol_item_rows} set status='active',deleted_at=null where id=$1`,[id(33)]);
    const protectedBefore = await snapshot();
    await assert.rejects(engine.applyTransaction(client,data),/deprecated_item_not_draft/);
    assert.deepEqual(await snapshot(),protectedBefore); return { absent_preserved:true, retired_id:retired.id, counts, protected_rejected:true };
  });
  await test("duplicate PK / all 14 tables",async () => {
    await seed(); const before = await snapshot(); const results = {};
    for (const table of Object.values(tables)) results[table] = await rejectSQL(`insert into public.${table} select * from public.${table} limit 1`,[],"23505");
    assert.deepEqual(await snapshot(),before); return results;
  });
  await test("real foreign keys / product source authorization dose withdrawal coverage item",async () => {
    await seed(); const results = {};
    for (const [collection,column] of [["coverage_rows","source_id"],["product_authorization_rows","product_id"],
      ["product_source_rows","source_id"],["dose_rule_rows","product_id"],["withdrawal_rule_rows","product_id"],
      ["withdrawal_source_rows","withdrawal_rule_id"],["protocol_item_rows","product_id"]]) {
      results[collection] = await rejectSQL(`update public.${tables[collection]} set ${column}=$1${collection === "protocol_item_rows" ? " where product_requirement_kind='specific_product'" : ""}`,[id(99)],"23503");
    }
    return results;
  });
  await test("natural uniques / source product authorization class group coverage protocol item default member",async () => {
    await seed(); const results = {};
    for (const collection of Object.keys(identityFields).filter(c => !["dose_rule_rows","withdrawal_rule_rows"].includes(c))) {
      const table = tables[collection];
      await assert.rejects(cloneRow(table,fixture()[collection][0].id,{ id:id(60) }),e => { assert.equal(e.code,"23505"); return true; });
      results[collection] = "23505";
    }
    return { results, uuid_only_rules: "dose/withdrawal have no independent natural unique" };
  });
  await test("real scope triggers / cross-farm / tombstoned parents / default derivation",async () => {
    await seed();
    await client.query("insert into public.fazendas(id,nome) values($1,'P3 farm A'),($2,'P3 farm B')",[id(40),id(41)]);
    await cloneRow(tables.product_class_rows,id(7),{ id:id(42),scope:"tenant",fazenda_id:id(40),class_key:"P3_TENANT_A" });
    await cloneRow(tables.product_class_rows,id(7),{ id:id(43),scope:"tenant",fazenda_id:id(41),class_key:"P3_TENANT_B" });
    await cloneRow(tables.product_class_group_rows,id(8),{ id:id(44),scope:"tenant",fazenda_id:id(40),group_key:"P3_TENANT_GROUP" });
    const checks = {};
    for (const [label,changes] of [
      ["member cross-scope",{id:id(45),class_id:id(42)}],
      ["member cross-farm",{id:id(45),class_id:id(43),group_id:id(44)}],
      ["member missing group",{id:id(45),group_id:id(99)}],
      ["member missing class",{id:id(45),class_id:id(99)}],
    ]) {
      await assert.rejects(cloneRow(tables.product_class_group_member_rows,id(9),changes),e => { assert.equal(e.code,"P0001"); return true; });
      checks[label] = "P0001";
    }
    const derivedMember = (await cloneRow(tables.product_class_group_member_rows,id(9),{id:id(46),group_id:id(44),scope:"global",fazenda_id:null})).rows[0];
    assert.equal(derivedMember.scope,"tenant"); assert.equal(derivedMember.fazenda_id,id(40));
    const derivedDefault = (await cloneRow(tables.product_class_default_rule_rows,id(10),{id:id(47),class_id:id(42),scope:"global",fazenda_id:null})).rows[0];
    assert.equal(derivedDefault.scope,"tenant"); assert.equal(derivedDefault.fazenda_id,id(40));
    checks["default incompatible supplied scope"] = "normalized from real parent by trigger (no rejection contract)";
    const mismatched = fixture(); mismatched.product_class_default_rule_rows[0].scope = "tenant";
    await assert.rejects(engine.applyTransaction(client,mismatched),/default_rule_scope_mismatch/);
    await cloneRow(tables.protocol_rows,id(11),{id:id(48),scope:"fazenda",fazenda_id:id(41),family_code:"P3_FARM_B"});
    for (const [label,changes] of [
      ["item group cross-scope",{id:id(49),product_class_group_id:id(44)}],
      ["item group cross-farm",{id:id(49),product_class_group_id:id(44),protocol_id:id(48)}],
      ["item missing group",{id:id(49),product_class_group_id:id(99)}],
      ["item missing protocol",{id:id(49),protocol_id:id(99)}],
    ]) {
      await assert.rejects(cloneRow(tables.protocol_item_rows,id(14),changes),e => { assert.equal(e.code,"23514"); return true; });
      checks[label] = "23514";
    }
    await client.query(`update public.${tables.product_class_group_rows} set automation_status='blocked' where id=$1`,[id(8)]);
    await assert.rejects(cloneRow(tables.protocol_item_rows,id(14),{id:id(49),allows_agenda_auto:true}),e => { assert.equal(e.code,"23514"); return true; });
    checks["blocked group auto agenda"] = "23514";
    await client.query(`update public.${tables.product_class_rows} set deleted_at=now() where id=$1`,[id(7)]);
    await assert.rejects(cloneRow(tables.product_class_group_member_rows,id(9),{id:id(49)}),e => { assert.equal(e.code,"P0001"); return true; });
    await assert.rejects(cloneRow(tables.product_class_default_rule_rows,id(10),{id:id(49)}),e => { assert.equal(e.code,"P0001"); return true; });
    await assert.rejects(cloneRow(tables.product_class_default_rule_rows,id(10),{id:id(49),class_id:id(99)}),e => { assert.equal(e.code,"P0001"); return true; });
    checks["member/default inactive or missing class"] = "P0001";
    await client.query(`update public.${tables.product_class_group_rows} set deleted_at=now() where id=$1`,[id(8)]);
    await assert.rejects(cloneRow(tables.product_class_group_member_rows,id(9),{id:id(49)}),e => { assert.equal(e.code,"P0001"); return true; });
    await assert.rejects(cloneRow(tables.protocol_item_rows,id(14),{id:id(49)}),e => { assert.equal(e.code,"23514"); return true; });
    checks["member/item tombstoned group"] = "P0001 / 23514";
    await client.query(`update public.${tables.protocol_rows} set deleted_at=now() where id=$1`,[id(11)]);
    await assert.rejects(cloneRow(tables.protocol_item_rows,id(14),{id:id(49),product_class_group_id:id(44)}),e => { assert.equal(e.code,"23514"); return true; });
    checks["item tombstoned protocol"] = "23514";
    await client.query("delete from public.fazendas where id=any($1)",[[id(40),id(41)]]);
    return { checks, member_scope_derived: true, default_scope_derived: true };
  });
  await test("updated_at triggers / SQL checks / enum types",async () => {
    await seed(); const results = {};
    for (const trigger of report.schema.triggers.filter(t => t.tgname.startsWith("set_updated_at"))) {
      const rows = (await client.query(`update public.${trigger.relname} set updated_at='2000-01-01' returning updated_at`)).rows;
      assert(rows.every(r => r.updated_at.getFullYear() > 2000)); results[trigger.tgname] = "observed";
    }
    for (const [collection,assignment,code] of [
      ["dose_rule_rows","dose_quantity=-1","23514"], ["dose_rule_rows","min_weight_kg=600,max_weight_kg=100","23514"],
      ["withdrawal_rule_rows","meat_days=-1","23514"], ["withdrawal_rule_rows","valid_until='2020-01-01'","23514"],
      ["source_rows","metadata='[]'::jsonb","23514"], ["source_rows","evidence_status='INVALID'","22P02"],
      ["protocol_item_rows","dose_rule='[]'::jsonb","23514"],
      ["product_class_default_rule_rows","can_validate_execution=true","23514"],
      ["product_class_default_rule_rows","source_refs='[]'::jsonb","23514"],
    ]) results[`${collection}: ${assignment}`] = await rejectSQL(`update public.${tables[collection]} set ${assignment}`,[],code);
    return results;
  });
  await test("partial SQL failure / rollback / clean replay",async () => {
    await reset(); const invalid = fixture(); invalid.dose_rule_rows[0].dose_quantity = -1;
    let inserted = 0; let rollback = false;
    const transport = { query: async (sql,values) => {
      const result = await client.query(sql,values);
      if (/^insert into/i.test(sql.trim())) inserted++;
      if (sql === "rollback") rollback = true;
      return result;
    } };
    await assert.rejects(engine.applyTransaction(transport,invalid),e => { assert.equal(e.code,"23514"); return true; });
    assert(inserted > 0); assert(rollback);
    assert(Object.values(await snapshot()).every(rows => rows.length === 0));
    const replay = await engine.applyTransaction(client,fixture()); assert.equal(replay.create,17);
    assert.equal((await engine.applyTransaction(client,fixture())).skip,17);
    return { successful_inserts_before_failure:inserted, rollback:true, partial_rows_after_failure:0, replay };
  });
  await test("advisory lock / two publishers / real lock timeout",async () => {
    await seed(); const b = await connect(); const acquired = barrier(); const resume = barrier();
    let aPromise;
    try {
      const a = { query: async (sql,values) => {
        const result = await client.query(sql,values);
        if (sql.includes("pg_advisory_xact_lock")) { acquired.release(); await resume.promise; }
        return result;
      } };
      aPromise = engine.applyTransaction(a,fixture()); await acquired.promise;
      const bPromise = engine.applyTransaction(b,fixture());
      const rejected = assert.rejects(bPromise,e => { assert.equal(e.code,"55P03"); return true; });
      const blockers = await observeBlocked(client,b.processID,client.processID);
      await rejected; resume.release(); const aResult = await aPromise;
      assert.equal(aResult.skip,17);
      const retry = await engine.applyTransaction(b,fixture()); assert.equal(retry.skip,17);
      return { key:engine.IMPORT_LOCK_KEY, connections:[client.processID,b.processID], blockers, second_publisher:"55P03 after engine lock_timeout", first_publisher:aResult, retry };
    } finally { resume.release(); await aPromise?.catch(() => {}); await b.end(); }
  });
  await test("FOR UPDATE / concurrent modification timeout / rollback",async () => {
    await seed(); const b = await connect(); const locked = barrier(); const resume = barrier(); let aPromise;
    try {
      let paused = false;
      const a = { query: async (sql,values) => {
        const result = await client.query(sql,values);
        if (!paused && sql.includes(`from public.${tables.protocol_rows}`) && sql.includes("for update")) {
          paused = true; locked.release(); await resume.promise;
        }
        return result;
      } };
      const changed = fixture(); changed.protocol_rows[0].name += " concurrent publisher";
      aPromise = engine.applyTransaction(a,changed); await locked.promise;
      await b.query("begin"); await b.query("set local lock_timeout='500ms'");
      const modification = b.query(`update public.${tables.protocol_rows} set approval_status='approved' where id=$1`,[id(11)]);
      const rejected = assert.rejects(modification,e => { assert.equal(e.code,"55P03"); return true; });
      const blockers = await observeBlocked(client,b.processID,client.processID);
      await rejected; await b.query("rollback"); resume.release(); const counts = await aPromise;
      const row = (await client.query(`select name,approval_status from public.${tables.protocol_rows} where id=$1`,[id(11)])).rows[0];
      assert.equal(row.name,changed.protocol_rows[0].name); assert.equal(row.approval_status,"draft");
      return { blockers, concurrent_update:"55P03", concurrent_transaction:"rollback", publisher:counts, row };
    } finally { resume.release(); await aPromise?.catch(() => {}); await b.end(); }
  });
  await test("concurrent protected-state change / no silent stale write",async () => {
    await seed(); const b = await connect(); let aPromise;
    try {
      await b.query("begin");
      await b.query(`update public.${tables.protocol_rows} set approval_status='approved' where id=$1`,[id(11)]);
      const data = fixture(); data.protocol_rows[0].name = "must not overwrite";
      aPromise = engine.applyTransaction(client,data);
      const rejected = assert.rejects(aPromise,/protocol_not_draft/);
      const blockers = await observeBlocked(b,client.processID,b.processID);
      await b.query("commit"); await rejected;
      const row = (await client.query(`select name,approval_status from public.${tables.protocol_rows} where id=$1`,[id(11)])).rows[0];
      assert.equal(row.name,fixture().protocol_rows[0].name); assert.equal(row.approval_status,"approved");
      return { blockers, publisher:"rejected after reading committed protected state", row };
    } finally { await b.query("rollback"); await aPromise?.catch(() => {}); await b.end(); }
  });
  await test("authenticated ACL / global SELECT / direct writes denied",async () => {
    await seed(); await client.query("set role authenticated");
    try {
      const role = (await client.query("select current_user,rolbypassrls from pg_roles where rolname=current_user")).rows[0];
      assert.equal(role.current_user,"authenticated"); assert.equal(role.rolbypassrls,false);
      const reads = {};
      for (const table of Object.values(tables)) {
        reads[table] = (await client.query(`select count(*)::int as count from public.${table}`)).rows[0].count;
        assert(reads[table] > 0);
        await rejectSQL(`insert into public.${table} select * from public.${table} limit 1`,[],"42501");
      }
      return { role, global_reads:reads, direct_insert:"42501 on all 14" };
    } finally { await client.query("reset role"); }
  });
  await test("domain safety / no operational rows",async () => {
    const relevant = ["agenda_itens","sanitario_agenda_v2","sanitario_agenda_animais_v2","sanitario_agenda_closures_v2",
      "eventos","eventos_sanitario","insumo_movimentacoes","insumo_lotes","insumos","sanitario_casos"];
    const counts = {};
    for (const table of relevant) { counts[table] = (await client.query(`select count(*)::int as count from public.${table}`)).rows[0].count; assert.equal(counts[table],0); }
    const all = (await client.query(`select tablename from pg_tables where schemaname='public' and (tablename like '%carencia%' or tablename like '%withdrawal%')`)).rows;
    const operational = all.filter(r => ![tables.withdrawal_rule_rows,tables.withdrawal_source_rows].includes(r.tablename));
    for (const {tablename} of operational) { counts[tablename] = (await client.query(`select count(*)::int as count from public.${tablename}`)).rows[0].count; assert.equal(counts[tablename],0); }
    return { counts, active_withdrawal:"no execution/factual rows; technical rules only" };
  });
  report.status = report.cases.some(c => c.result === "FAIL") ? "CHANGES_REQUIRED" : "READY_FOR_REVIEW";
} catch (error) {
  report.status = "BLOCKED_ENVIRONMENT";
  report.environment_error = error.message;
  console.log(`BLOCKED: ${error.message}`);
} finally {
  await client?.end();
  if (created) {
    assert.match(database,/^sanitario_p3_[a-f0-9]{32}$/);
    docker(["exec",container,"dropdb","-U","postgres",database]);
    report.environment.cleaned_up = true;
  }
  writeFileSync(path.join(root,"tests/codex/sanitario-v2-postgres.evidence.json"), `${JSON.stringify(report,null,2)}\n`);
  console.log(`PUBLISHER_P3_STATUS=${report.status}`);
  if (report.status !== "READY_FOR_REVIEW") process.exitCode = 1;
}
