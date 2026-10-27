// Explicit opt-in SQL rehearsal against this task's fresh, disposable container.
// No reset/delete, remote URL, production credentials or full Auth certification.
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { buildPlan, sourceInsertRow, coverageInsertRow } from "../../scripts/codex/import-sanitario-protocols-v2.mjs";

const [container, portText, scope = "p11", securityMode] = process.argv.slice(2);
assert.ok(["p11", "f6"].includes(scope));
const full = scope === "f6";
assert.ok(process.argv.slice(2).length <= 4 && (!securityMode || (full && ["integration", "admin", "post-approval"].includes(securityMode))));
const postApproval = securityMode === "post-approval";
const admin = securityMode === "admin" || postApproval;
const integration = ["integration", "admin", "post-approval"].includes(securityMode);
const originalSnapshotFile = "docs/review/evidence/SANITARIO_V2_C02_SUPABASE_READONLY_SNAPSHOT_20261026.json";
const remoteSnapshotFile = postApproval ? "docs/review/evidence/SANITARIO_V2_C02_POST_APPROVAL_READONLY_20261027.json" : originalSnapshotFile;
const originalSnapshot = admin ? JSON.parse(readFileSync(originalSnapshotFile, "utf8")) : null;
const remoteSnapshot = postApproval ? { ...originalSnapshot, ...JSON.parse(readFileSync(remoteSnapshotFile, "utf8")) } : originalSnapshot;
const prefix = `C02_${scope.toUpperCase()}`;
assert.match(container ?? "", new RegExp("^rebanhosync-c02-" + scope + "-sql-\\d+$"));
const port = Number(portText);
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
const inspect = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
assert.ok(inspect.Config.Env.includes(`POSTGRES_DB=rebanhosync_c02_${scope}`));
assert.ok(inspect.NetworkSettings.Ports["5432/tcp"].some(p => p.HostIp === "127.0.0.1" && Number(p.HostPort) === port));
const database = `rebanhosync_c02_${scope}`;
const marker = `${prefix}_DISPOSABLE_LOCAL_ONLY`;
const db = new pg.Client({ host: "127.0.0.1", port, database, user: "postgres", password: "", ssl: false, options: "" });
const tables = ["sanitario_fontes_tecnicas_v2", "sanitario_fonte_cobertura_campos_v2", "sanitario_produtos_v2",
  "sanitario_produto_especie_autorizacao_v2", "sanitario_produto_fontes_v2", "sanitario_produto_dose_rules_v2",
  "sanitario_produto_carencia_rules_v2", "sanitario_produto_carencia_fontes_v2"];
const candidateFile = `docs/review/evidence/SANITARIO_V2_C02_${scope.toUpperCase()}_REVIEW_CANDIDATE_20261026.json`;
const candidate = JSON.parse(readFileSync(candidateFile, "utf8"));
const id = candidate.payload.product_rows[0].id;
const results = [];
const record = label => { results.push(label); console.log(`OK ${label}`); };
const run = promisify(execFile);
const cli = mode => run(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", mode, admin ? "--c02-admin" : `--c02-${scope}`, candidateFile,
  ...(admin ? ["--project-ref", remoteSnapshot.project_ref] : []), "--local-port", String(port)], {
  env: { ...process.env, DB_URL: "must-not-be-read", ALLOW_SANITARIO_REMOTE_IMPORT: "1" },
});
async function snapshot() {
  const result = {};
  for (const table of tables) result[table] =
    (await db.query(`select to_jsonb(t) as row from public.${table} t`)).rows.map(r => JSON.stringify(r.row)).sort();
  return result;
}
async function deniedWithoutWrites(pattern, mode = "--apply-local") {
  const before = await snapshot();
  await assert.rejects(cli(mode), error => pattern.test(error.stderr));
  assert.deepEqual(await snapshot(), before);
}

async function postApprovalReplay() {
  for (const table of tables) for (const row of remoteSnapshot.rows[table]) {
    const columns = Object.keys(row);
    await db.query(`insert into public.${table} (${columns.join(",")}) values (${columns.map((_,i)=>"$"+(i+1)).join(",")})`,
      columns.map(c=>row[c] && typeof row[c]==="object" ? JSON.stringify(row[c]) : row[c]));
  }
  const before = await snapshot();
  for (const table of tables) assert.deepEqual(before[table], remoteSnapshot.rows[table].map(r=>JSON.stringify(r)).sort());
  record("exact materialization of current read-only post-approval snapshot");
  const dry = await cli("--dry-run");
  const summary = JSON.parse(dry.stdout.split("\n").find(l=>l.startsWith("summary ")).slice(8));
  assert.deepEqual(summary, { create: 0, update: 0, skip: 652, reject: 0 });
  assert.deepEqual(await snapshot(), before);
  record("canonical post-approval dry-run skips 652; all UUIDs, metadata and provenance unchanged");
  const directory = mkdtempSync(join(tmpdir(), "c02-post-approval-"));
  const sqlFile = join(directory, "local-only-replay.sql");
  const preparation = await run(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs",
    "--apply", "--c02-admin", candidateFile, "--project-ref", remoteSnapshot.project_ref, "--local-port", String(port),
    "--emit-mcp-apply", sqlFile, "--mcp-snapshot", remoteSnapshotFile, "--authorization-ref", "C02-POST-APPROVAL-LOCAL-REPLAY",
    "--confirm-c02", createHash("sha256").update(readFileSync(candidateFile)).digest("hex"), "--c02-action", "technical"],
  { env: { ...process.env, DB_URL: "must-not-connect" } });
  const prepared = JSON.parse(preparation.stdout.trim());
  assert.equal(prepared.writes, 0);
  assert.equal(prepared.local_transaction_rolled_back, true);
  assert.deepEqual(await snapshot(), before);
  const sql = readFileSync(sqlFile, "utf8");
  assert.equal(/^\s*execute '/m.test(sql), false);
  const result = await db.query(sql);
  const replay = result.find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(replay.replay, true);
  assert.equal(replay.skip, 652);
  assert.deepEqual(await snapshot(), before);
  record("MCP packet contains zero DML, rolls back local preparation and converges under real PostgreSQL locks");
  const approved = remoteSnapshot.rows.sanitario_produtos_v2.filter(p=>p.metadata?.c02_cadastral_approval);
  assert.equal(approved.length,39);
  assert(approved.every(p=>p.status_curatorial==="ativo" && p.metadata.approved_for_catalog===true && p.metadata.review_only===true));
  assert(remoteSnapshot.rows.sanitario_produto_dose_rules_v2.every(r=>r.status_curatorial==="precisa_validar"));
  assert(remoteSnapshot.rows.sanitario_produto_carencia_rules_v2.every(r=>r.status_curatorial==="precisa_validar"));
  assert(remoteSnapshot.rows.sanitario_produto_especie_autorizacao_v2.every(r=>r.authorization_status==="PRECISA_VALIDAR"));
  record("39 approved registrations remain separate from pending dose, withdrawal and species rules");
  const writer = readFileSync("scripts/codex/import-sanitario-protocols-v2.mjs","utf8");
  const approve = new Function("assert", "C02_ADMIN_PROJECT_REF", "C02_F6_SHA256",
    writer.slice(writer.indexOf("async function approveC02Products("),writer.indexOf("\nconst c02Tables"))+
    ";return approveC02Products;")(assert, remoteSnapshot.project_ref,
    createHash("sha256").update(readFileSync(candidateFile)).digest("hex"));
  await db.query("begin");
  try {
    const product = candidate.payload.product_rows[0];
    await db.query(`update public.sanitario_produtos_v2 set status_curatorial='precisa_validar',
      metadata=jsonb_set(metadata-'c02_cadastral_approval','{approved_for_catalog}','false'::jsonb) where id=$1`,[product.id]);
    await approve(db, { product_rows: [{id:product.id,status_curatorial:"precisa_validar"}] },
      {admin:true,authorizationRef:"C02-LOCAL-ONLY-APPROVAL-CONSISTENCY"});
    const row = (await db.query("select to_jsonb(t) as row from public.sanitario_produtos_v2 t where id=$1",[product.id])).rows[0].row;
    assert.equal(row.status_curatorial,"ativo");
    assert.equal(row.metadata.approved_for_catalog,true);
    assert.equal(row.metadata.review_only,true);
    assert.equal(row.metadata.operational_authorization,false);
    assert.equal(row.metadata.c02_cadastral_approval.scope,"product_registration_only");
    const old = remoteSnapshot.rows.sanitario_produtos_v2.find(p=>p.id===product.id);
    const restored = {...row.metadata,c02_cadastral_approval:old.metadata.c02_cadastral_approval};
    assert.deepEqual(restored,old.metadata);
  } finally { await db.query("rollback"); }
  assert.deepEqual(await snapshot(),before);
  record("canonical registration approval writes active/catalog flag atomically, preserves historical provenance and rolls back local exercise");
  writeFileSync("docs/review/evidence/SANITARIO_V2_C02_POST_APPROVAL_LOCAL_RESULT_20261027.json",JSON.stringify({
    observed_at:new Date().toISOString(), container:container, local_port:port,
    server_version:(await db.query("show server_version")).rows[0].server_version,
    remote_observed_at:remoteSnapshot.observed_at, remote_snapshot:remoteSnapshot.snapshot,
    snapshot_sha256:createHash("sha256").update(readFileSync(remoteSnapshotFile)).digest("hex"),
    candidate_sha256:createHash("sha256").update(readFileSync(candidateFile)).digest("hex"),
    results, summary, preparation:prepared, replay, all_eight_tables_unchanged:true,
    remote_connections:0, remote_writes:0
  },null,2)+"\n");
}

await db.connect();
try {
  assert.equal((await db.query("select to_regclass('public.sanitario_produtos_v2') as table")).rows[0].table, null,
    "Rehearsal requires a fresh database; never resets an existing fixture.");
  const migrationFile = "supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql";
  const identityFile = "supabase/migrations/20260923132000_sanitario_source_key_identity.sql";
  const migration = readFileSync(migrationFile, "utf8");
  const identity = readFileSync(identityFile, "utf8");
  // Active table/type/index DDL unchanged. External dependencies are minimal local
  // fixtures; policies/auth helpers are outside this persistence rehearsal.
  const ddl = migration.slice(0, migration.indexOf("drop trigger if exists"));
  assert.ok(ddl.includes("create unique index if not exists ux_sanitario_produtos_v2_nome_registro"));
  const sourceIdentity = identity.slice(0, identity.indexOf("-- Preflight")) + "\n" +
    [...identity.matchAll(/create unique index ux_sanitario_fontes_v2_[\s\S]*?;/g)].map(m => m[0]).join("\n");
  const baseFile = "supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql";
  const aclFile = "supabase/migrations/20260913232253_f24_acl_forward_only_reconciliation.sql";
  const base = integration ? readFileSync(baseFile, "utf8") : "";
  const helper = name => {
    const match = base.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`));
    assert.ok(match, name);
    return match[0];
  };
  // This optional fixture includes the unchanged sanitary RLS/policies/triggers.
  // External tenant/auth tables remain minimal. Integration uses auth.uid() null;
  // admin mode uses inspected helpers and synthetic subjects, not signed JWTs.
  const securityDdl = integration ? `
    create type public.farm_role_enum as enum ('cowboy','manager','owner');
    create table public.user_fazendas(user_id uuid, fazenda_id uuid, role public.farm_role_enum, deleted_at timestamptz);
    create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
    ${helper("set_updated_at")}\n${helper("has_membership")}\n${helper("role_in_fazenda")}
    ${migration.slice(migration.indexOf("drop trigger if exists"), migration.indexOf("comment on table public.produtos_veterinarios"))}
    -- Project the final F24 ACL onto only the eight technical tables in this fixture.
    revoke all on table ${tables.map(t => `public.${t}`).join(",")} from public,anon,authenticated,service_role;
    grant select on table ${tables.map(t => `public.${t}`).join(",")} to authenticated,service_role;
  ` : "";
  const bootstrap = `comment on database ${database} is '${marker}';
    create table if not exists public.fazendas(id uuid primary key);
    create table if not exists auth.users(id uuid primary key);
    ${admin ? base.match(/do \$\$ begin create type public.estado_uf_enum[\s\S]*?end \$\$;/)[0] : "do $$ begin create type public.estado_uf_enum as enum ('SP'); exception when duplicate_object then null; end $$;"}
    ${ddl}\n${sourceIdentity}
    grant usage, create on schema public to postgres;
    grant usage on schema auth to postgres;
    alter database ${database} owner to postgres;
    ${tables.map(table => `alter table public.${table} owner to postgres;`).join("\n")}
    grant all on all tables in schema public to postgres;
    ${securityDdl}
    ${admin ? "grant all on public.user_fazendas to postgres;\n" + remoteSnapshot.functions.map(f=>f.definition+";").join("\n") : ""}`;
  execFileSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1"],
    { input: `begin;\n${bootstrap}\ncommit;`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  if (postApproval) await postApprovalReplay();
  else {
  const originals = JSON.parse(execFileSync("git", ["show", "6f1b8dcec93254d60be73757a6515193240e208c:docs/review/evidence/SANITARIO_V2_F6_PRODUCTS_REVIEW.json"], { encoding: "utf8" })).payload.product_rows;
  if (admin) {
    const ids = new Set(originals.map(p => p.id));
    for (const table of tables) for (const row of remoteSnapshot.rows[table]) {
      if (table === "sanitario_produtos_v2" && ids.has(row.id)) continue;
      const columns = Object.keys(row);
      await db.query(`insert into public.${table} (${columns.join(",")}) values (${columns.map((_,i)=>`$${i+1}`).join(",")})`,
        columns.map(c => row[c] && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
    }
    const localConstraints = (await db.query(`select con.conname as name,pg_get_constraintdef(con.oid) as definition
      from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[])`, [tables])).rows;
    assert.deepEqual(localConstraints.map(r=>JSON.stringify(r)).sort(), remoteSnapshot.constraints.map(({name,definition})=>JSON.stringify({name,definition})).sort());
    const indexes = (await db.query("select * from pg_indexes where schemaname='public' and tablename=any($1::text[])", [tables])).rows;
    assert.deepEqual(indexes.map(i=>i.indexdef).sort(), remoteSnapshot.indexes.map(i=>i.indexdef).sort());
    for (const table of remoteSnapshot.tables) {
      const columns = (await db.query(`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null
        from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`, [`public.${table.table}`])).rows;
      assert.deepEqual(columns, table.columns);
    }
    record("local clone of read-only remote technical rows; eight table columns, 46 constraints and 19 indexes match destination");
  }
  const physicals = [];
  for (const baseline of originals.filter(p => full || p.id === id)) {
    const { product_key: ignored, ...physical } = admin ? remoteSnapshot.rows.sanitario_produtos_v2.find(p => p.id === baseline.id) : baseline;
    if (!admin) physical.metadata = { ...physical.metadata, independent_note: { preserved: true }, semantic_review_notes: "concurrent documentary note" };
    const columns = Object.keys(physical);
    await db.query(`insert into public.sanitario_produtos_v2 (${columns.join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")})`,
      columns.map(c => c === "metadata" ? JSON.stringify(physical[c]) : physical[c]));
    physicals.push(physical);
  }
  const physical = physicals.find(p => p.id === id);
  let equivalentSource, equivalentCoverage;
  if (full && !admin) {
    // Fixture starts with the already persisted pilot, not a second empty pilot.
    const pilot = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json")).payload;
    pilot.product_rows[0].metadata = physical.metadata;
    const fixturePlan = await buildPlan(db, pilot);
    assert.ok(fixturePlan.every(op => ["create", "update", "skip"].includes(op.action)));
    for (const op of fixturePlan) {
      if (op.action === "skip") continue;
      const columns = Object.keys(op.row);
      const values = columns.map(c => op.row[c] && typeof op.row[c] === "object" ? JSON.stringify(op.row[c]) : op.row[c]);
      if (op.action === "create") await db.query(`insert into public.${op.table} (${columns.join(",")}) values (${columns.map((_,i)=>`$${i+1}`).join(",")})`, values);
      else await db.query(`update public.${op.table} set ${columns.map((c,i)=>`${c}=$${i+1}`).join(",")} where id=$${columns.length+1}`, [...values, op.canonical_id]);
    }
    equivalentSource = sourceInsertRow(candidate.payload.source_rows[1]);
    equivalentSource.id = "00000000-0000-4000-8000-000000000002";
    equivalentSource.source_key = "SRC_EXISTING_EQUIVALENT_OFFICIAL_LABEL";
    equivalentSource.title = "Previously documented official source";
    equivalentSource.metadata = { independent_source_note: "preserve" };
    equivalentCoverage = coverageInsertRow({ ...candidate.payload.coverage_rows.find(c => c.source_key === candidate.payload.source_rows[1].source_key),
      id: "00000000-0000-4000-8000-000000000003", notes: "Previously documented coverage" }, equivalentSource);
    for (const [table, row] of [[tables[0], equivalentSource], [tables[1], equivalentCoverage]]) {
      const columns = Object.keys(row);
      await db.query(`insert into public.${table} (${columns.join(",")}) values (${columns.map((_,i)=>`$${i+1}`).join(",")})`,
        columns.map(c => row[c] && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
    }
  }
  if (admin) {
    equivalentSource = sourceInsertRow(candidate.payload.source_rows[1]);
    equivalentCoverage = coverageInsertRow(candidate.payload.coverage_rows.find(c=>c.source_key===equivalentSource.source_key), equivalentSource);
  }
  const expected = admin ? { create: 613, update: 39, skip: 0, total: 652 } : full ? { create: 592, update: 38, skip: 22, total: 652 } : { create: 19, update: 1, skip: 0, total: 20 };
  record(admin ? "administrative local rehearsal from observed 42-product remote snapshot; no remote connection" : full ? "fresh local F6 fixture: 39 commercial UUIDs, persisted P11 and equivalent source/coverage" : "fresh local P11 fixture");

  const beforeDry = await snapshot();
  const dry = await cli("--dry-run");
  assert.ok(dry.stdout.includes(`"create":${expected.create}`));
  assert.ok(dry.stdout.includes(`"update":${expected.update}`));
  assert.deepEqual(await snapshot(), beforeDry);
  record(`SQL dry-run: ${expected.create} creates + ${expected.update} updates; zero persistent changes`);

  // Inject failure at the last link-table writes, after prior inserts/updates.
  await db.query(`create function public.c02_fixture_abort() returns trigger language plpgsql as $$
    begin raise exception 'C02_FIXTURE_INJECTED_FAILURE'; end $$;
    create trigger c02_fixture_abort before insert on public.sanitario_produto_carencia_fontes_v2
    for each row execute function public.c02_fixture_abort()`);
  await deniedWithoutWrites(/C02_FIXTURE_INJECTED_FAILURE/);
  await db.query("alter table public.sanitario_produto_carencia_fontes_v2 disable trigger c02_fixture_abort");
  record("mid-transaction SQL failure rolls back source, product enrichment and every technical row");

  const attempts = await Promise.allSettled([cli("--apply-local"), cli("--apply-local")]);
  const concurrent = [];
  let concurrencyRetries = 0;
  for (const attempt of attempts) {
    if (attempt.status === "fulfilled") concurrent.push(attempt.value);
    else if (admin && /canceling statement due to lock timeout/.test(attempt.reason.stderr ?? "")) {
      // Keep the writer's 5s guard. After the competing caller finishes, an
      // explicit retry must converge rather than duplicate or partially write.
      concurrencyRetries++;
      concurrent.push(await cli("--apply-local"));
    } else throw attempt.reason;
  }
  const summaries = concurrent.map(r => JSON.parse(/local summary (.*)/.exec(r.stdout)[1]));
  assert.ok(summaries.some(s => s.create === expected.create && s.update === expected.update));
  assert.ok(summaries.some(s => s.skip === expected.total && !s.create && !s.update));
  record(concurrencyRetries ? `concurrent lock timeout preserves transaction guard; ${concurrencyRetries} explicit retry converges with ${expected.total} skips` : `two concurrent SQL applications serialize; replay skips all ${expected.total} rows`);
  const afterApply = await snapshot();
  assert.deepEqual(tables.map(t => afterApply[t].length), admin ? [59, 297, 42, 39, 212, 39, 38, 38] : full ? [41, 206, 39, 39, 212, 39, 38, 38] : [1, 6, 1, 1, 6, 1, 2, 2]);
  const replay = await cli("--apply-local");
  assert.ok(replay.stdout.includes(`"skip":${expected.total}`));
  const replaySummary = JSON.parse(/local summary (.*)/.exec(replay.stdout)[1]);
  assert.deepEqual(replaySummary, { create: 0, update: 0, skip: expected.total, reject: 0 });
  assert.deepEqual(await snapshot(), afterApply);
  record(`SQL replay converges with ${expected.total} skips and no duplicate or content change`);

  const product = (await db.query("select * from public.sanitario_produtos_v2 where id=$1", [id])).rows[0];
  assert.deepEqual(product.metadata, physical.metadata);
  assert.equal(product.status_curatorial, "precisa_validar");
  assert.equal(product.registro_numero, null);
  assert.equal(product.principio_ativo, "Moxidectina 1 g/100 mL");
  assert.equal(product.id, id);
  assert.ok((await db.query("select status_curatorial from public.sanitario_produto_dose_rules_v2 union all select status_curatorial from public.sanitario_produto_carencia_rules_v2")).rows.every(r => r.status_curatorial === "precisa_validar"));
  assert.equal((await db.query("select authorization_status from public.sanitario_produto_especie_autorizacao_v2")).rows[0].authorization_status, "PRECISA_VALIDAR");
  assert.equal((await db.query("select count(*)::int as count from public.sanitario_protocolos_v2")).rows[0].count, 0);
  record("UUID, MAPA identity, complete concurrent metadata, pending states and false flags preserved");

  let securityEvidence = null;
  if (integration) {
    const role = (await db.query(`select current_user as name, rolsuper, rolbypassrls
      from pg_roles where rolname=current_user`)).rows[0];
    assert.equal(role.name, "postgres");
    const relations = (await db.query(`select relname, relrowsecurity, relforcerowsecurity,
      pg_get_userbyid(relowner) as owner from pg_class where oid=any($1::regclass[]) order by relname`,
    [tables.map(t => `public.${t}`)])).rows;
    assert.equal(relations.length, tables.length);
    assert.ok(relations.every(r => r.relrowsecurity && !r.relforcerowsecurity && r.owner === "postgres"));
    const privileges = (await db.query(`select role, name,
      has_table_privilege(role, name, 'SELECT') as can_select,
      has_table_privilege(role, name, 'INSERT') as can_insert,
      has_table_privilege(role, name, 'UPDATE') as can_update,
      has_table_privilege(role, name, 'DELETE') as can_delete
      from unnest($1::text[]) role cross join unnest($2::text[]) name order by role,name`,
    [["anon", "authenticated", "service_role"], tables.map(t => `public.${t}`)])).rows;
    assert.ok(privileges.every(p => !p.can_insert && !p.can_update && !p.can_delete && p.can_select === (p.role !== "anon")));
    for (const role of ["authenticated", "service_role", "anon"]) {
      await db.query("begin");
      try {
        await db.query(`set local role ${role}`);
        if (role === "anon") await assert.rejects(db.query("select * from public.sanitario_produtos_v2"), e => e.code === "42501");
        else {
          assert.equal((await db.query("select count(*)::int n from public.sanitario_produtos_v2")).rows[0].n, admin ? 42 : 39);
          await assert.rejects(db.query("update public.sanitario_produtos_v2 set principio_ativo=principio_ativo where id=$1", [id]), e => e.code === "42501");
        }
      } finally { await db.query("rollback"); }
    }
    assert.deepEqual(await snapshot(), afterApply);
    securityEvidence = { role, relations, privileges,
      external_auth_fixture: admin ? "Inspected auth.uid()/membership definitions with synthetic subject IDs; JWT signing and Supabase Auth not certified" : "auth.uid() returns null; tenant memberships and Supabase Auth not certified" };
    record("RLS enabled, real updated_at triggers and postgres ownership support local apply/replay; API roles cannot write technical tables");
  }

  if (full) {
    for (const original of physicals) {
      const row = (await db.query("select * from public.sanitario_produtos_v2 where id=$1", [original.id])).rows[0];
      assert.deepEqual(row.metadata, original.metadata);
      assert.equal(row.status_curatorial, "precisa_validar");
      assert.equal(row.registro_numero, original.registro_numero);
      const target = candidate.payload.product_rows.find(p => p.id === row.id);
      for (const field of ["fabricante", "principio_ativo", "apresentacao"])
        assert.equal(row[field], target[field]);
    }
    assert.ok((await db.query("select authorization_status from public.sanitario_produto_especie_autorizacao_v2")).rows.every(r => r.authorization_status === "PRECISA_VALIDAR"));
    for (const [code, quantity, unit, route] of [["P05", 3, "mL", "SC"], ["P13", 5, "mg", "oral"]]) {
      const target = candidate.payload.product_rows.find(p => p.metadata.research_lot_code === code);
      const rules = (await db.query("select * from public.sanitario_produto_dose_rules_v2 where product_id=$1", [target.id])).rows;
      assert.equal(rules.length, 1);
      assert.equal(Number(rules[0].dose_quantity), quantity);
      assert.equal(rules[0].dose_unit, unit);
      assert.equal(rules[0].route, route);
    }
    const reused = (await db.query("select * from public.sanitario_fontes_tecnicas_v2 where id=$1", [equivalentSource.id])).rows[0];
    assert.deepEqual(reused.metadata, equivalentSource.metadata);
    assert.equal(reused.title, equivalentSource.title);
    const coverage = (await db.query("select * from public.sanitario_fonte_cobertura_campos_v2 where id=$1", [equivalentCoverage.id])).rows[0];
    assert.equal(coverage.notes, equivalentCoverage.notes);
    assert.equal((await db.query("select count(*)::int n from public.sanitario_fontes_tecnicas_v2 where url=$1", [reused.url])).rows[0].n, 1);
    for (const code of ["P05", "P33"]) {
      const key = candidate.payload.product_rows.find(p => p.metadata.research_lot_code === code).product_key;
      assert.ok(candidate.payload.dose_rule_rows.some(r => r.product_key === key));
    }
    for (const code of ["P06", "P40", "P41"]) {
      const product = candidate.payload.product_rows.find(p => p.metadata.research_lot_code === code);
      assert.equal((await db.query("select count(*)::int n from public.sanitario_produto_dose_rules_v2 where product_id=$1", [product.id])).rows[0].n, 0);
    }
    for (const code of ["P33", "P38", "P40", "P41"]) {
      const product = candidate.payload.product_rows.find(p => p.metadata.research_lot_code === code);
      assert.equal((await db.query("select count(*)::int n from public.sanitario_produto_carencia_rules_v2 where product_id=$1 and aptitude='leite'", [product.id])).rows[0].n, 0);
    }
    record(admin ? "all 39 identities/metadata preserved; vaccine and antiparasitic evidence retained by field" : "all 39 identities/metadata preserved; equivalent source/coverage reused; vaccine and antiparasitic evidence retained by field");
    await db.query("update public.sanitario_fontes_tecnicas_v2 set strength='apoio' where id=$1", [equivalentSource.id]);
    await deniedWithoutWrites(/C02_F6_SOURCE_CONFLICT:strength/);
    await db.query("update public.sanitario_fontes_tecnicas_v2 set strength=$2 where id=$1", [equivalentSource.id, equivalentSource.strength]);
    record("incompatible source evidence rejected without partial writes");
    const anotherSource = candidate.payload.source_rows[2];
    await db.query("update public.sanitario_fontes_tecnicas_v2 set url=$2 where id=$1", [anotherSource.id, equivalentSource.url]);
    await deniedWithoutWrites(/C02_F6_SOURCE_AMBIGUOUS/);
    await db.query("update public.sanitario_fontes_tecnicas_v2 set url=$2 where id=$1", [anotherSource.id, anotherSource.url]);
    await db.query("update public.sanitario_fontes_tecnicas_v2 set deleted_at=now() where id=$1", [equivalentSource.id]);
    await deniedWithoutWrites(/C02_F6_SOURCE_TOMBSTONED/);
    await db.query("update public.sanitario_fontes_tecnicas_v2 set deleted_at=null where id=$1", [equivalentSource.id]);
    await db.query("update public.sanitario_fonte_cobertura_campos_v2 set coverage_status='partially_covers' where id=$1", [equivalentCoverage.id]);
    await deniedWithoutWrites(/C02_F6_COVERAGE_CONFLICT/);
    await db.query("update public.sanitario_fonte_cobertura_campos_v2 set coverage_status=$2 where id=$1", [equivalentCoverage.id, equivalentCoverage.coverage_status]);
    record("ambiguous source, source tombstone and incompatible field coverage rejected without partial writes");
  }

  await db.query("update public.sanitario_produtos_v2 set status_curatorial='ativo' where id=$1", [id]);
  await deniedWithoutWrites(new RegExp(`${prefix}_BASELINE_NOT_PENDING`));
  await deniedWithoutWrites(new RegExp(`${prefix}_BASELINE_NOT_PENDING`), "--dry-run");
  await db.query("update public.sanitario_produtos_v2 set status_curatorial='precisa_validar' where id=$1", [id]);
  record("curated product rejected in both apply and dry-run, without partial changes");

  await db.query("update public.sanitario_produtos_v2 set registro_numero='6709' where id=$1", [id]);
  await deniedWithoutWrites(new RegExp(`${prefix}_IDENTITY_CONFLICT:registro_numero`));
  await db.query("update public.sanitario_produtos_v2 set registro_numero=null where id=$1", [id]);
  await db.query("update public.sanitario_produtos_v2 set principio_ativo='different' where id=$1", [id]);
  await deniedWithoutWrites(new RegExp(`${prefix}_CONTENT_CONFLICT:principio_ativo`));
  await db.query("update public.sanitario_produtos_v2 set principio_ativo=$2 where id=$1", [id, product.principio_ativo]);
  record("registration identity and unexpected existing enrichment rejected without overwrite");

  await db.query("update public.sanitario_produto_dose_rules_v2 set dose_quantity=1 where product_id=$1", [id]);
  await deniedWithoutWrites(new RegExp(`${prefix}_EXISTING_TECHNICAL_CONTENT_CONFLICT`));
  await db.query("update public.sanitario_produto_dose_rules_v2 set dose_quantity=0.02 where product_id=$1", [id]);
  record("conflicting existing technical rule rejected instead of silently updated");

  await db.query("update public.sanitario_produtos_v2 set metadata=jsonb_set(metadata,'{operational_authorization}','true') where id=$1", [id]);
  await deniedWithoutWrites(new RegExp(`${prefix}_OPERATIONAL_FLAG`));
  await db.query("update public.sanitario_produtos_v2 set metadata=$2::jsonb where id=$1", [id, JSON.stringify(product.metadata)]);
  record("existing operational authorization rejected, never reset or promoted by pilot");

  const beforeDuplicate = await snapshot();
  await assert.rejects(db.query(`insert into public.sanitario_fontes_tecnicas_v2
    (id, source_key, kind, scope, title, strength, evidence_status)
    select '00000000-0000-4000-8000-000000000001', source_key, kind, scope, title, strength, evidence_status
    from public.sanitario_fontes_tecnicas_v2`), error => error.code === "23505");
  assert.deepEqual(await snapshot(), beforeDuplicate);
  record("active source identity unique index rejects duplicate UUID for the same source key");

  await db.query(`comment on database ${database} is 'unmarked'`);
  await deniedWithoutWrites(new RegExp(`${admin ? "C02_ADMIN" : prefix}_DISPOSABLE_DATABASE_REQUIRED`), "--dry-run");
  await db.query(`comment on database ${database} is '${marker}'`);
  record("unmarked local target rejected despite remote-import env override");

  if (admin) {
    // All extra tenant data is rolled back. This exercises canonical RLS with
    // synthetic subject IDs; it does not exercise JWT signing or Supabase Auth.
    const farms = ["00000000-0000-4000-8000-000000000101", "00000000-0000-4000-8000-000000000102"];
    const users = ["00000000-0000-4000-8000-000000000111", "00000000-0000-4000-8000-000000000112", "00000000-0000-4000-8000-000000000113"];
    const sources = ["00000000-0000-4000-8000-000000000121", "00000000-0000-4000-8000-000000000122"];
    const beforeTenants = await snapshot();
    await db.query("begin");
    try {
      for (let i=0;i<2;i++) {
        await db.query("insert into public.fazendas(id) values($1)", [farms[i]]);
        await db.query("insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,'manager')", [users[i],farms[i]]);
        await db.query(`insert into public.sanitario_fontes_tecnicas_v2(id,source_key,kind,scope,fazenda_id,title,strength,evidence_status)
          values($1,$2,'bibliografia','fazenda',$3,'Synthetic tenant fixture','apoio','PRECISA_VALIDAR')`, [sources[i],`SRC_C02_TENANT_${i}`,farms[i]]);
      }
      await db.query("set local role authenticated");
      for (let i=0;i<users.length;i++) {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [users[i]]);
        const visible = (await db.query("select id from public.sanitario_fontes_tecnicas_v2 where id=any($1::uuid[]) order by id", [sources])).rows;
        assert.deepEqual(visible.map(r=>r.id), i<2 ? [sources[i]] : []);
        assert.equal((await db.query("select count(*)::int n from public.sanitario_produtos_v2")).rows[0].n,42);
      }
    } finally { await db.query("rollback"); }
    assert.deepEqual(await snapshot(),beforeTenants);
    await deniedWithoutWrites(/C02_ADMIN_REMOTE_WRITE_DISABLED/, "--apply");
    for (const table of [tables[0],tables[1],tables[2]]) {
      const existingIds = new Set(remoteSnapshot.rows[table].filter(r=>table!==tables[2] || !physicals.some(p=>p.id===r.id)).map(r=>r.id));
      assert.deepEqual((await snapshot())[table].filter(raw=>existingIds.has(JSON.parse(raw).id)), beforeDry[table].filter(raw=>existingIds.has(JSON.parse(raw).id)));
    }
    record("two tenant managers and outsider see only their farm sources; global catalog shared intentionally; remote apply disabled and original unrelated rows preserved");
  }

  const report = {
    observed_at: new Date().toISOString(), database: "task-owned disposable local PostgreSQL",
    server_version: (await db.query("show server_version")).rows[0].server_version,
    container_id: inspect.Id, local_port: port,
    candidate_sha256: createHash("sha256").update(readFileSync(candidateFile)).digest("hex"),
    ddl_sources: [migrationFile, identityFile, ...(integration ? [baseFile, aclFile] : [])],
    scope: integration ? "Sanitary DDL, RLS/policies and updated_at triggers; F24 technical ACL projection; local postgres owner; minimal external auth/tenant fixtures" : "Active technical table/type/index DDL; external FK fixtures; no RLS/auth certification",
    ...(integration ? { security: securityEvidence } : {}),
    ...(admin ? { remote_snapshot_sha256: createHash("sha256").update(readFileSync(remoteSnapshotFile)).digest("hex"), remote_project_inspected_read_only: remoteSnapshot.project_ref } : {}),
    results, first_apply: summaries.find(s => s.create), replay: replaySummary,
    concurrency_retries: concurrencyRetries,
    final_counts: Object.fromEntries(tables.map(t => [t, afterApply[t].length])),
    remote_connections: 0, schema_or_migration_files_modified: false,
  };
  writeFileSync(`docs/review/evidence/SANITARIO_V2_C02_${scope.toUpperCase()}_${admin ? "ADMIN_" : integration ? "INTEGRATION_" : ""}SQL_RESULT_20261026.json`, JSON.stringify(report, null, 2) + "\n");
  }
} finally { await db.end(); }
