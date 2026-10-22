// Local-only: replay generic v27 UPDATE semantics against a restored, isolated DB.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = process.env.R01_PROTECTED_BACKUP_DIRECTORY;
assert(directory, "Protected backup directory required");
const container = readFileSync(path.join(directory, "local-container-name.txt"), "utf8");
assert.match(container, /^sanitario-r01-[a-f0-9]{8}b?$/);
const inspect = spawnSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true });
assert.equal(inspect.status, 0);
const metadata = JSON.parse(inspect.stdout)[0];
assert.equal(metadata.State.Running, true);
assert.deepEqual(Object.keys(metadata.NetworkSettings.Networks), [], "Restore DB must have no network");
const { normalizeDbError } = await import(pathToFileURL(path.join(directory, "remote-v27-rules.mjs")));
function query(sql) {
  return spawnSync("docker", ["exec", "-i", container, "psql", "-U", "r01_restore_admin", "-d", "postgres",
    "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"],
  { input: sql, encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
}
function scalar(sql) {
  const result = query(sql);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const [farm, actor] = scalar(`select uf.fazenda_id::text || ',' || uf.user_id::text
  from public.user_fazendas uf join public.fazenda_sanidade_config c on c.fazenda_id=uf.fazenda_id
  where uf.role='owner' and uf.deleted_at is null order by uf.fazenda_id limit 1;`).split(",");
assert.match(farm, /^[a-f0-9-]{36}$/);
assert.match(actor, /^[a-f0-9-]{36}$/);
const key = "sanitary_agenda_automation_v2";
const plan = revision => ({ schemaVersion: 1, revision, enabled: false, rules: [], context: {} });
const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const baseline = scalar(`select md5(jsonb_agg(to_jsonb(c) order by fazenda_id)::text) from public.fazenda_sanidade_config c;`);
const cases = [
  { name: "profile_without_plan_change", current: { unrelated: "same" }, update: "uf='DF'", accepted: true },
  { name: "payload_without_sanitary_field", current: { unrelated: "same" }, payload: { unrelated: "changed" }, accepted: true },
  { name: "payload_with_unchanged_legacy_plan", current: { unrelated: "same", [key]: plan(2) }, payload: { unrelated: "changed", [key]: plan(2) }, accepted: true },
  { name: "payload_with_stale_plan", current: { unrelated: "same", [key]: plan(2) }, payload: { unrelated: "changed", [key]: plan(1) }, accepted: false },
  { name: "direct_plan_update", current: { unrelated: "same", [key]: plan(2) }, payload: { unrelated: "same", [key]: plan(3) }, accepted: false },
  { name: "legacy_plan_insert_into_empty_config", current: { unrelated: "same" }, payload: { unrelated: "same", [key]: plan(1) }, accepted: false },
  { name: "payload_omitting_existing_plan", current: { unrelated: "same", [key]: plan(2) }, payload: { unrelated: "changed" }, accepted: false },
];
const results = [];
function executeCase(test, clientOpId = randomUUID()) {
  const envelope = { table: "fazenda_sanidade_config", action: "UPDATE", client_op_id: clientOpId,
    record: { fazenda_id: farm, payload: test.payload }, before_snapshot: { payload: test.current } };
  const original = structuredClone(envelope);
  const assignment = test.update ?? `payload=${literal(test.payload)}, client_op_id='${clientOpId}'`;
  const result = query(`begin;
    set local role service_role;
    set local rebanhosync.sanitario_sync_v2_internal='on';
    update public.fazenda_sanidade_config set payload=${literal(test.current)} where fazenda_id='${farm}';
    set local rebanhosync.sanitario_sync_v2_internal='off';
    set local role authenticated;
    set local request.jwt.claim.sub='${actor}';
    update public.fazenda_sanidade_config set ${assignment} where fazenda_id='${farm}' returning 'R01_ROW_UPDATED';
    rollback;`);
  if (test.accepted) {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /R01_ROW_UPDATED/);
  } else {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /42501/);
    assert.match(result.stderr, /SANITARIO_PLAN_CANONICAL_WRITER_REQUIRED/);
    const response = normalizeDbError({ code: "42501", message: "SANITARIO_PLAN_CANONICAL_WRITER_REQUIRED" }, envelope);
    assert.equal(response.status, "REJECTED");
    assert.equal(response.reason_code, "PERMISSION_DENIED");
  }
  assert.deepEqual(envelope, original, "Rejected operation identity/input must remain unchanged");
  assert.equal(scalar(`select md5(jsonb_agg(to_jsonb(c) order by fazenda_id)::text) from public.fazenda_sanidade_config c;`), baseline);
  results.push({ name: test.name, result: "PASS", accepted: test.accepted,
    sqlstate: test.accepted ? null : "42501", normalized_status: test.accepted ? "APPLIED" : "REJECTED",
    persisted_changes: 0, client_op_id: clientOpId });
}
for (const test of cases) executeCase(test);
const identity = randomUUID();
executeCase({ ...cases[4], name: "retry_rejected_same_identity_first" }, identity);
executeCase({ ...cases[4], name: "retry_rejected_same_identity_second" }, identity);
const state = JSON.parse(scalar(`select json_build_object('migrations',(select count(*) from supabase_migrations.schema_migrations),
  'gates',(select count(*) from public.sanitario_sync_v2_gates),'catalog',(select count(*) from public.sanitario_protocolos_v2),
  'ledger',(select count(*) from public.sanitario_sync_v2_operations));`));
assert.deepEqual(state, { migrations: 63, gates: 0, catalog: 0, ledger: 0 });
const report = { environment: "owned isolated restored local PostgreSQL", container, cases: results, state,
  transport_scope: "Actual v27 normalizeDbError plus generic SQL UPDATE/RLS; no hosted HTTP or browser worker execution",
  rejection_recovery: "Explicit rejection, unchanged rows and same input IDs; repeated v27 retry remains rejected until transport upgrade or explicit user correction" };
writeFileSync(path.join(directory, "legacy-payload-results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
