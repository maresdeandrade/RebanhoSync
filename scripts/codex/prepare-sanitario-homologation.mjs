// Packaging only. Never provisions, connects, imports, deploys or approves.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildApprovalCandidate, buildApprovalForm, CANONICAL_PATH, DECISION_PATH } from "./prepare-sanitario-approval-v2.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
assert(args.length === 1 && args[0] === "--validate" || args.length === 2 && args[0] === "--output",
  "Use --validate or --output <new directory>");
const git = (...params) => execFileSync("git", params, { encoding: "utf8", windowsHide: true }).trim();
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const bytes = name => readFileSync(path.join(root, name));
const main = "86c802a111c7ef3ecdd23ae2618190a0d36c5be4";
git("merge-base", "--is-ancestor", main, "HEAD");
git("merge-base", "--is-ancestor", "5e4240b9f147ad446e87d2474a2cf9fbd67ac6ce", "HEAD");
const canonical = bytes(CANONICAL_PATH), decisions = bytes(DECISION_PATH);
const packet = JSON.parse(decisions);
const candidate = buildApprovalCandidate(JSON.parse(canonical), packet, canonical, decisions);
const candidateText = JSON.stringify(candidate, null, 2) + "\n";
const form = buildApprovalForm(candidate, packet);
assert.deepEqual(form, JSON.parse(bytes("docs/review/evidence/SANITARIO_V2_APROVACAO_PENDENTE_20261017.json")));
const targets = JSON.parse(bytes("config/backend-targets.json"));
assert.equal(targets.homologation_project_refs.length, 0, "Review target bindings before packaging a provisioned project");

const migrations = readdirSync(path.join(root, "supabase/migrations")).filter(name => name.endsWith(".sql")).sort()
  .map(name => `supabase/migrations/${name}`);
const functions = ["sync-batch", "sanitario-reconcile", "telemetry-ingest"];
const closure = new Set(["supabase/functions/deno.json"]);
function visit(name) {
  assert(!path.isAbsolute(name) && !name.split("/").includes(".."), "Package path escapes repository");
  if (closure.has(name)) return;
  closure.add(name);
  const text = bytes(name).toString();
  assert(!text.includes("zqloazqzhwauamcejmuz"), `Production destination in deploy source: ${name}`);
  for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)) {
    const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
    visit(dependency);
  }
  const deno = path.posix.join(path.posix.dirname(name), "deno.json");
  if (existsSync(path.join(root, deno))) closure.add(deno);
}
functions.forEach(name => visit(`supabase/functions/${name}/index.ts`));
const payloadFiles = [CANONICAL_PATH, DECISION_PATH,
  "docs/review/evidence/SANITARIO_V2_APROVACAO_PENDENTE_20261017.json"];
const tooling = ["scripts/codex/import-sanitario-protocols-v2.mjs", "scripts/codex/sanitario-v2-contract.mjs",
  "scripts/codex/prepare-sanitario-approval-v2.mjs", "scripts/codex/prepare-sanitario-homologation.mjs",
  "scripts/codex/verify-sanitario-homologation-target.mjs", "scripts/codex/backend-environment.mjs",
  "config/backend-targets.json"];
const sourceFiles = [...migrations, ...[...closure].sort(), ...payloadFiles, ...tooling];
const ready = packet.decision_sets.filter(group => group.submission_status === "READY_FOR_GLOBAL_REVIEW");
assert.equal(ready.flatMap(group => group.item_keys).length, 7);
const approvals = [
  ["H01", "Provision new exclusive Supabase project; organization, region, cost and owner"],
  ["H02", "Bind exclusive ref, public key digest, preview origin and independent Auth settings"],
  ["H03", "Run remote migration dry-run, approve exact file hashes, then apply migrations"],
  ["H04", "Deploy only named Functions and set APP_ORIGIN in the exclusive project"],
  ["H05", "Promote exact candidate to canonical draft payload in a reviewed local commit"],
  ["H06", "Remote import dry-run and explicit draft import, without technical approval"],
  ["H07", "Grant catalog reviewer permission to a real identified authorized user"],
  ["H08", "Reviewer explicitly decides each of the five ready sets through existing RPC/UI"],
  ["H09", "Provision test farm/members and authorize narrow remote sync gate and preview rollout"],
  ["H10", "Execute remote A/B smoke using actual test context and recorded identities"],
].map(([id, operation]) => ({ id, operation, authorized: false, actor_id: null, decision_reference: null }));
const manifest = {
  artifact: "sanitario_v2_isolated_homologation_release", schema_version: 1,
  source_commit: git("rev-parse", "HEAD"), integrated_main: main,
  target: { state: "NOT_PROVISIONED", project_ref: null, organization_id: null,
    region_proposal: "sa-east-1", preview_origin: null, api_url: null, functions_url: null,
    publishable_key_sha256: null, must_be_exclusive_project: true,
    forbidden_project_refs: targets.production_project_refs,
    forbidden_public_key_sha256: Object.values(targets.production_publishable_key_sha256).flat(),
    reuse_production_auth_users_secrets_data_or_functions: false },
  migrations: migrations.map(name => ({ path: name, sha256: sha256(bytes(name)) })),
  functions: functions.map(name => ({ name, verify_jwt: true, entrypoint: `supabase/functions/${name}/index.ts`,
    runtime_secrets: name === "sanitario-reconcile" ? ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
      : name === "sync-batch" ? ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN"]
      : ["SUPABASE_URL", "SUPABASE_ANON_KEY", "APP_ORIGIN"] })),
  excluded: ["test-auth", "supabase/.temp", "supabase/seed.sql", ".env*", "credentials and production data"],
  files: sourceFiles.map(name => ({ path: name, sha256: sha256(bytes(name)) })),
  candidate: { path: "candidate.review.json", sha256: sha256(candidateText), schema_form: form.schema_version,
    schema_decisions: packet.schema_version, review_only: true, import_real_authorized: false,
    operational_approvals: 0, ready_items: 7, commercial_pending: 7, restricted: 6,
    review_digest_authority: "sanitario_catalog_review_preview_v2; not the candidate file hash",
    decisions: form.decisions },
  item_inventory: candidate.payload.protocol_item_rows.map(item => ({ id: item.id, protocol_id: item.protocol_id,
    logical_item_key: item.logical_item_key, version: item.version, status: item.status,
    allows_agenda_auto: item.allows_agenda_auto,
    decision_set: packet.decision_sets.find(group => group.item_keys.includes(item.logical_item_key))?.id })),
  permissions: { catalog_review: "authenticated + public.is_app_admin(), server auth.uid() and transaction_timestamp()",
    private_sync_rpcs: "service_role only; server revalidates actor membership, owner/manager, farm gate and revision",
    global_approval_needs_farm_or_executor_vet: false },
  remote_authorizations: approvals,
  recovery: { forward_only: true, preserve_queue_ids_receipts_history: true,
    stop_new_enqueues_before_disabling_farm_gate: true, automatic_rollback_or_reset: false,
    historical_text_agenda_id_migration: false },
};
if (args[0] === "--output") {
  const directory = path.resolve(args[1]);
  assert(!existsSync(directory), "Output directory must not exist");
  mkdirSync(directory, { recursive: true });
  for (const name of sourceFiles) {
    const destination = path.join(directory, name);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, bytes(name));
  }
  // New unlinked project. Never copy .temp, seed, production links or environment files.
  const config = bytes("supabase/config.toml").toString()
    .replace('project_id = "GestaoAgro"', 'project_id = "sanitario-v2-homologation"')
    .replace(/(\[db.seed\]\r?\nenabled = )true/, "$1false") +
    "\n[functions.sync-batch]\nverify_jwt = true\n\n[functions.telemetry-ingest]\nverify_jwt = true\n";
  writeFileSync(path.join(directory, "supabase/config.toml"), config);
  writeFileSync(path.join(directory, "candidate.review.json"), candidateText);
  manifest.files.push({ path: "supabase/config.toml", sha256: sha256(config) });
  writeFileSync(path.join(directory, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ output: directory, migrations: migrations.length, function_files: closure.size,
    candidate_sha256: manifest.candidate.sha256, remote_operations: 0 }));
} else {
  console.log(JSON.stringify({ validation: "PASS", integrated_main: main, migrations: migrations.length,
    function_files: closure.size, candidate_sha256: manifest.candidate.sha256,
    ready_items: 7, commercial_pending: 7, restricted: 6, remote_operations: 0 }));
}
