// Rehearse the packaged release only in an owned, disposable local project.
// Does not approve/import drafts or execute any remote command.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";

const root = process.cwd();
const directory = mkdtempSync(path.join(tmpdir(), "sanitario-deployment-"));
const release = path.join(directory, "release");
const project = `sanitary-release-${randomUUID().slice(0, 8)}`;
const report = { project, environment: "owned disposable local Supabase; no remote operations", cases: [] };
const run = (command, args, env = process.env) => execFileSync(command, args, {
  cwd: root, env, encoding: "utf8", windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"], maxBuffer: 24 * 1024 * 1024,
});
const cli = args => run("supabase", [...args, "--workdir", release]);
const record = name => { report.cases.push({ name, result: "PASS" }); console.log(`PASS ${name}`); };
let db, started = false;
try {
  assert.match(run("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]).trim(), /^(npipe:\/\/|unix:\/\/)/);
  run(process.execPath, ["scripts/codex/prepare-sanitario-homologation.mjs", "--output", release]);
  const manifest = JSON.parse(readFileSync(path.join(release, "release-manifest.json")));
  for (const file of manifest.files) {
    assert.equal(createHash("sha256").update(readFileSync(path.join(release, file.path))).digest("hex"), file.sha256);
  }
  assert(!existsSync(path.join(release, "supabase/.temp")));
  assert(!existsSync(path.join(release, "supabase/seed.sql")));
  assert(!existsSync(path.join(release, "supabase/functions/test-auth")));
  assert.equal(manifest.target.project_ref, null);
  assert(manifest.remote_authorizations.every(operation => operation.authorized === false));
  record("complete package hashes, dependency closure and absence of production links/secrets/authorizations");
  const configPath = path.join(release, "supabase/config.toml");
  let config = readFileSync(configPath, "utf8").replace('project_id = "sanitario-v2-homologation"', `project_id = "${project}"`);
  for (const port of [54320, 54321, 54322, 54323, 54324, 54325, 54327, 54329]) {
    config = config.replaceAll(String(port), String(port + 1200));
  }
  config = config.replace("inspector_port = 8083", "inspector_port = 55583")
    .replace(/^\[local_smtp\]$/m, "[local_smtp]\nport = 55524");
  writeFileSync(configPath, config);
  started = true;
  console.log("Starting owned local project and replaying the packaged migration chain");
  cli(["start", "--exclude", "studio,postgres-meta,realtime,storage-api,imgproxy,logflare,vector,supavisor"]);
  const env = Object.fromEntries(cli(["status", "-o", "env"]).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/); return match ? [[match[1], match[2]]] : [];
  }));
  const dbUrl = new URL(env.DB_URL);
  assert.equal(dbUrl.hostname, "127.0.0.1");
  assert.equal(dbUrl.port, "55522");
  assert.equal(dbUrl.search, "");
  db = new pg.Client({ connectionString: env.DB_URL }); await db.connect();
  const versions = (await db.query("select version from supabase_migrations.schema_migrations order by version")).rows.map(row => row.version);
  assert.deepEqual(versions, manifest.migrations.map(file => path.basename(file.path).split("_")[0]));
  report.migration_count = versions.length;
  record("all 63 packaged migrations applied to a fresh database without seed");
  const dry = cli(["db", "push", "--local", "--dry-run", "--skip-vault"]);
  assert(!/Applying migration/i.test(dry));
  record("CLI migration dry-run on owned local target has no pending migrations");
  const snapshot = async () => (await db.query(`select
    (select count(*)::int from public.sanitario_protocolos_v2) protocols,
    (select count(*)::int from public.sanitario_protocolo_itens_versions_v2) items,
    (select count(*)::int from public.sanitario_sync_v2_operations) operations,
    (select count(*)::int from public.agenda_itens) agendas,
    (select count(*)::int from public.eventos) events,
    (select count(*)::int from public.insumo_movimentacoes) stock,
    (select count(*)::int from public.app_admin_audit_events) decisions,
    (select count(*)::int from public.sanitario_sync_v2_gates where enabled) enabled_gates`).then(result => result.rows[0]));
  const before = await snapshot();
  const importer = ["scripts/codex/import-sanitario-protocols-v2.mjs"];
  const importEnv = { ...process.env, DB_URL: env.DB_URL };
  const dryImport = run(process.execPath, [...importer, "--dry-run", "--review-candidate", path.join(release, "candidate.review.json")], importEnv);
  assert.match(dryImport, /summary .*"create":[1-9]/);
  assert.deepEqual(await snapshot(), before);
  report.import_plan_summary = dryImport.match(/summary (.*)/)?.[1];
  record("existing candidate importer dry-run proposes drafts and makes zero persistent writes");
  for (const suffix of [["--apply", "--review-candidate", path.join(release, "candidate.review.json")], ["--apply"]]) {
    let denied = false;
    try { run(process.execPath, [...importer, ...suffix], importEnv); }
    catch (error) {
      assert.match(error.stderr.toString(), /REVIEW_CANDIDATE_CANNOT_APPLY|IMPORT_REAL_NOT_AUTHORIZED/); denied = true;
    }
    assert(denied);
  }
  assert.deepEqual(await snapshot(), before);
  record("candidate and unauthorized canonical apply fail closed without import or approval");
  const grants = (await db.query(`select
    has_function_privilege('authenticated','public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid)','execute') reviewer_entry,
    has_function_privilege('anon','public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid)','execute') anonymous_entry,
    has_function_privilege('authenticated','public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb)','execute') direct_plan,
    has_function_privilege('service_role','public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb)','execute') edge_plan`)).rows[0];
  assert.deepEqual(grants, { reviewer_entry: true, anonymous_entry: false, direct_plan: false, edge_plan: true });
  assert(Object.values(before).every(value => value === 0));
  report.final_counts = before;
  record("RPC grants, disabled gates, empty catalog and zero planning side effects after rehearsal");
} catch (error) {
  report.error = String(error.message).replace(/https?:\/\/\S+|postgres(?:ql)?:\/\/\S+|eyJ[\w.-]+/g, "[REDACTED]").slice(0, 1200);
  console.error(report.error); process.exitCode = 1;
} finally {
  await db?.end();
  if (started) {
    try { cli(["stop", "--no-backup"]); report.cleaned_up = true; }
    catch { report.cleaned_up = false; process.exitCode = 1; }
  }
  writeFileSync(path.join(directory, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`Evidence: ${path.join(directory, "evidence.json")}`);
}
