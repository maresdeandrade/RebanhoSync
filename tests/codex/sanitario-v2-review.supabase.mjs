// Disposable Supabase project: actual Auth/JWT/PostgREST and existing functional baseline.
// CLI credentials are used only in memory and are never included in the report.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { runInNewContext } from "node:vm";
import * as contract from "../../scripts/codex/sanitario-v2-contract.mjs";
import { existsSync } from "node:fs";
import { buildApprovalCandidate, CANONICAL_PATH, DECISION_PATH } from "../../scripts/codex/prepare-sanitario-approval-v2.mjs";

const directory = mkdtempSync(path.join(tmpdir(), "sanitario-review-supabase-"));
const project = `sanitary-review-${randomUUID().slice(0, 8)}`;
const report = { project, environment: "isolated local Supabase; synthetic users only", cases: [] };
const cli = args => execFileSync("supabase", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const child = (args, env) => new Promise(resolve => {
  const task = spawn(process.execPath, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  task.stdout.on("data", chunk => { stdout += chunk; }); task.stderr.on("data", chunk => { stderr += chunk; });
  task.on("close", code => resolve({ code, stdout, stderr }));
});
let db, edge;
try {
  const dockerHost = execFileSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8", windowsHide: true }).trim();
  assert.match(dockerHost, /^(npipe:\/\/|unix:\/\/)/, "Only a local Docker context is allowed");
  const dest = path.join(directory, "supabase"); mkdirSync(dest);
  let config = readFileSync("supabase/config.toml", "utf8").replace('project_id = "GestaoAgro"', `project_id = "${project}"`);
  for (const port of [54320, 54321, 54322, 54323, 54324, 54325, 54327, 54329]) config = config.replaceAll(String(port), String(port + 1100));
  config = config.replace("inspector_port = 8083", "inspector_port = 55483").replace(/(\[db.seed\]\r?\nenabled = )true/, "$1false");
  config = config.replace(/^\[local_smtp\]$/m, "[local_smtp]\nport = 55424");
  writeFileSync(path.join(dest, "config.toml"), config);
  cpSync("supabase/migrations", path.join(dest, "migrations"), { recursive: true });
  cpSync("supabase/functions", path.join(dest, "functions"), { recursive: true });
  mkdirSync(path.join(directory, "src/lib/animals"), { recursive: true });
  cpSync("src/lib/animals/taxonomyFactsContract.ts", path.join(directory, "src/lib/animals/taxonomyFactsContract.ts"));
  console.log("Starting dedicated local Auth/PostgREST project");
  try { cli(["start", "--workdir", directory, "--exclude", "studio,postgres-meta,realtime,storage-api,imgproxy,logflare,vector,supavisor"]); }
  catch (error) { report.start_diagnostics = error.stderr?.toString().split(/\r?\n/).filter(line => /ERROR:|SQLSTATE|At statement|failed to/.test(line)).map(line => line.replace(/https?:\/\/\S+|postgres(?:ql)?:\/\/\S+|eyJ[\w.-]+/g, "[REDACTED]")).slice(-10); throw new Error("ISOLATED_START_FAILED"); }
  const env = Object.fromEntries(cli(["status", "-o", "env", "--workdir", directory]).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/); return match ? [[match[1], match[2]]] : [];
  }));
  assert.equal(new URL(env.DB_URL).hostname, "127.0.0.1"); assert.equal(new URL(env.API_URL).port, "55421");
  writeFileSync(path.join(directory, "empty.env"), "");
  edge = spawn("supabase", ["functions", "serve", "--workdir", directory, "--env-file", path.join(directory, "empty.env")], { windowsHide: true, stdio: "ignore" });
  let ready = false;
  for (let attempt = 0; attempt < 80 && !ready; attempt++) {
    try { ready = (await fetch(`${env.API_URL}/functions/v1/sync-batch`, { signal: AbortSignal.timeout(1000) })).status === 401; } catch { /* Own container starting. */ }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, "Isolated Edge auth gate unavailable");
  const baseline = await child(["scripts/codex/validate-supabase-baseline-functional.mjs"], { ...process.env, ...env,
    FUNCTIONS_URL: `${env.API_URL}/functions/v1`, REBANHOSYNC_DISPOSABLE_LOCAL_DB: "1", REBANHOSYNC_SKIP_FUNCTIONS_SERVE: "1" });
  report.baseline_checks = baseline.stdout.split(/\r?\n/).filter(line => /^authenticated privileges|^user_profiles:|^user_settings:|^[1-5]\/5|^OK baseline/.test(line));
  if (baseline.code !== 0) { report.baseline_failure = baseline.stderr.split(/\r?\n/).filter(line => /^Error:/.test(line)).map(line => line.replace(/https?:\/\/\S+|postgres(?:ql)?:\/\/\S+|eyJ[\w.-]+/g, "[REDACTED]")); throw new Error("FUNCTIONAL_BASELINE_FAILED"); }
  db = new pg.Client({ connectionString: env.DB_URL }); await db.connect();
  const cb = readFileSync(CANONICAL_PATH), pb = readFileSync(DECISION_PATH), packet = JSON.parse(pb);
  const candidate = buildApprovalCandidate(JSON.parse(cb), packet, cb, pb);
  const source = readFileSync("scripts/codex/import-sanitario-protocols-v2.mjs", "utf8");
  const privateSource = source.slice(source.indexOf("const ROOT ="), source.indexOf("async function main()")).replace(/\bexport (?=(?:async )?function)/g, "");
  const applyFixture = runInNewContext(`${privateSource}\napplyTransaction;`, { ...contract, process, path, existsSync, readFileSync, Date });
  await applyFixture(db, contract.validateCanonicalTechnicalContract(candidate).data);
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const sessions = [];
  for (let index = 0; index < 2; index++) {
    const email = `${randomUUID()}@local.invalid`, password = `${randomUUID()}Aa!`;
    const created = await adminClient.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
    const user = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.ifError((await user.auth.signInWithPassword({ email, password })).error);
    sessions.push({ client: user, id: created.data.user.id });
  }
  await db.query("insert into public.app_superadmins(user_id) values($1)", [sessions[0].id]);
  const item = packet.prepared_item_records.find(row => row.decision_set === "B19").record;
  const params = { _protocol_id: item.protocol_id, _expected_version: packet.prepared_protocol_records.find(row=>row.record.id===item.protocol_id).record.version, _item_ids: [item.id] };
  const denied = await sessions[1].client.rpc("sanitario_catalog_review_preview_v2", params);
  assert.equal(denied.error?.code, "42501"); report.cases.push("HTTP authenticated non-admin rejected");
  const reviewed = await sessions[0].client.rpc("sanitario_catalog_review_preview_v2", params); assert.ifError(reviewed.error); assert.deepEqual(reviewed.data.blockers, []);
  const command = { ...params, _reviewed_content_digest: reviewed.data.reviewed_content_digest, _result: "approved", _justification: "Revisão explícita sintética no projeto local descartável", _request_id: randomUUID() };
  const approved = await sessions[0].client.rpc("sanitario_catalog_decide_v2", command); assert.ifError(approved.error); assert.equal(approved.data.actor_id, sessions[0].id);
  report.cases.push("HTTP JWT reviewer publishes exact B19 version atomically");
  const replay = await sessions[0].client.rpc("sanitario_catalog_decide_v2", command); assert.ifError(replay.error); assert.deepEqual(replay.data, approved.data);
  report.cases.push("HTTP lost-ACK replay returns same audit receipt");
  report.result = "PASS";
} catch (error) { report.result = "FAIL"; report.failure = /^[A-Z_]+$/.test(error.message) ? error.message : "ISOLATED_CHECK_FAILED"; process.exitCode = 1;
} finally {
  await db?.end(); edge?.kill();
  try { cli(["stop", "--project-id", project, "--no-backup", "--workdir", directory]); report.own_project_removed = true; }
  catch { report.own_project_removed = false; process.exitCode = 1; }
  writeFileSync(path.join(directory, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ result: report.result, failure: report.failure, checks: report.cases.length, evidence: path.join(directory, "evidence.json"), cleanup: report.own_project_removed }));
}
