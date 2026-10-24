// Native local Supabase verification. No protocol import, feature-gate writes or deploy.
// The successful apply_factual_core path is deliberately BLOCKED while gates stay off.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { createConfirmedTestSession } from "./sanitary-disposable-support.fixture.mjs";

const workdir = process.env.SANITARIO_REVIEW_WORKDIR;
assert(workdir, "SANITARIO_REVIEW_WORKDIR must name this run's disposable project");
const config = readFileSync(path.join(workdir, "supabase/config.toml"), "utf8");
assert.match(config, /^project_id = "sanitario-v2-review-[a-f0-9]{8}"$/m);
assert.match(config, /\[db.seed\]\s+enabled = false/);
assert.equal(process.env.ALLOW_SANITARIO_IMPORT, undefined);
assert.equal(process.env.ALLOW_SANITARIO_REMOTE_IMPORT, undefined);
// Credentials are captured in memory only, never printed or written as evidence.
const env = JSON.parse(execFileSync("supabase", ["status", "--workdir", workdir, "-o", "json"],
  { cwd: workdir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
for (const key of ["API_URL", "FUNCTIONS_URL", "DB_URL"]) {
  const url = new URL(env[key]);
  assert.equal(url.hostname, "127.0.0.1", "Non-local target refused");
  assert.equal(url.port, key === "DB_URL" ? "56322" : "56321");
}
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
const db = new pg.Client({ connectionString: env.DB_URL, connectionTimeoutMillis: 5000 });
const runId = randomUUID();
const report = {
  run_id: runId,
  baseline: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  project: /^project_id = "([^"]+)"/m.exec(config)[1],
  target: "native Supabase, loopback ports 56321/56322, dedicated disposable project",
  cases: [],
  canonical_factual_acceptance: "BLOCKED_BY_NO_FLAG_ACTIVATION",
  limitations: ["No successful canonical factual write/replay was attempted with gates enabled.",
    "Recovery reads a separately prepared synthetic direct fact, not an accepted v2 command.",
    "No physical mobile device or production/cloud target was exercised."],
};
async function test(name, fn) {
  try {
    const outcome = { name, result: "PASS", evidence: await fn() };
    report.cases.push(outcome);
    console.log(`PASS ${name}`);
  } catch (error) {
    // Do not serialize SDK/pg error objects, request headers, sessions or URLs.
    report.cases.push({ name, result: "FAIL", code: String(error.code ?? error.name) });
    console.error(`FAIL ${name}: ${String(error.code ?? error.name)}`);
    if (error.code === "ERR_ASSERTION") console.error(error.message);
    process.exitCode = 1;
  }
}
async function user(label) {
  const password = `${randomUUID()}-Aa1!`;
  const email = `sanitario-review-${label}-${runId}@example.test`;
  const client = createClient(env.API_URL, env.ANON_KEY, options);
  const signed = await createConfirmedTestSession(admin, client, { email, password });
  return { id: signed.user.id, token: signed.session.access_token, client, email, password };
}
async function withRole(role, actorId, fn) {
  await db.query("begin");
  try {
    assert(["authenticated", "anon", "service_role"].includes(role));
    await db.query(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId ?? ""]);
    const result = await fn();
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
async function api(route, token, method = "GET", body) {
  const response = await fetch(`${env.API_URL}${route}`, {
    method, headers: { apikey: env.ANON_KEY, "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, data: await response.json() };
}
const factId = randomUUID();
const occurrence = "2026-10-14T12:00:00.000Z";
const factualPayload = { schema: "sanitary_agenda_execution_v2", registration_mode: "executed_fact",
  prospective_authorization: false, catalog_review_warnings: ["product_curation_precisa_validar"],
  creates_active_withdrawal: false, review_fixture: runId };
await db.connect();
try {
  report.engine = (await db.query("select version() value")).rows[0].value;
  report.migrations = readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort()
    .map(file => ({ file, sha256: createHash("sha256").update(readFileSync(`supabase/migrations/${file}`)).digest("hex") }));
  report.sources = ["supabase/functions/sync-batch/index.ts", "supabase/functions/sync-batch/sanitario-v2.ts",
    "supabase/functions/sync-batch/sanitary-product-evidence.ts", "src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts",
    "tests/codex/sanitario-v2-remote-factual.integration.mjs"].map(file => ({ file,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex") }));
  const initialGates = (await db.query("select * from public.sanitario_sync_v2_gates order by fazenda_id")).rows;
  assert(initialGates.every(gate => !gate.enabled), "Disposable environment must have no enabled gate");
  const owner = await user("owner"), member = await user("member"), outsider = await user("outsider");
  for (const actor of [owner, member, outsider]) {
    await db.query("insert into public.user_profiles(user_id, display_name) values ($1,$2)", [actor.id, "Synthetic sanitary review"]);
  }
  const farms = [];
  for (const actor of [owner, outsider]) {
    const id = randomUUID();
    await db.query("insert into public.fazendas(id,nome,codigo,created_by) values ($1,$2,$3,$4)",
      [id, "Synthetic sanitary review", randomUUID(), actor.id]);
    await db.query("insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values ($1,$2,'owner',now())", [id, actor.id]);
    farms.push(id);
  }
  await db.query("insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values ($1,$2,'cowboy',now())", [farms[0], member.id]);
  const op = { domain: "sanitario_v2", command: "apply_factual_core", contract_version: 2,
    client_op_id: randomUUID(), client_tx_id: randomUUID(), domain_op_id: randomUUID(), expected_revision: 0,
    payload: { event: { id: randomUUID(), natureza: "standalone_fact", occurred_at: occurrence,
      payload: factualPayload }, detail: { tipo: "vacinacao", produto_nome_snapshot: "Synthetic review product",
      dose_quantidade: 1, dose_unidade: "ml", via_aplicacao: "subcutanea", payload: factualPayload }, event_animals: [] } };
  const envelope = { client_id: "sanitario-v2-review", client_tx_id: op.client_tx_id, fazenda_id: farms[0], ops: [op] };
  await test("Edge authentication rejects missing and invalid JWT", async () => {
    for (const token of [null, "invalid-test-credential"]) {
      assert.equal((await api("/functions/v1/sync-batch", token, "POST", envelope)).status, 401);
    }
    return { missing_jwt: 401, invalid_jwt: 401 };
  });
  await test("Outsider and cross-farm envelope are denied before execution", async () => {
    assert.equal((await api("/functions/v1/sync-batch", outsider.token, "POST", envelope)).status, 403);
    assert.equal((await api("/functions/v1/sync-batch", owner.token, "POST", { ...envelope, fazenda_id: farms[1] })).status, 403);
    return { outsider: 403, cross_farm: 403 };
  });
  await test("Disabled gate rejects repeated canonical factual requests without writes", async () => {
    const results = await Promise.all([1, 2, 3].map(() => api("/functions/v1/sync-batch", owner.token, "POST", envelope)));
    for (const result of results) {
      assert.equal(result.status, 200);
      assert.equal(result.data.results[0].reason_code, "SANITARIO_SYNC_DISABLED");
      assert.equal(result.data.results[0].status, "REJECTED");
    }
    assert.equal(Number((await db.query("select count(*) from public.eventos where id=$1", [op.payload.event.id])).rows[0].count), 0);
    assert.equal(Number((await db.query("select count(*) from public.sanitario_sync_v2_operations where client_op_id=$1", [op.client_op_id])).rows[0].count), 0);
    return { repetitions: 3, reason: "SANITARIO_SYNC_DISABLED", new_events: 0, new_receipts: 0 };
  });
  const rpcSql = `select public.internal_sanitario_sync_v2_apply_factual_core($1,$2,2,$3,$4,0,
    jsonb_populate_record(null::public.sanitario_sync_v2_event_input,$5::jsonb),
    jsonb_populate_record(null::public.sanitario_sync_v2_detail_input,$6::jsonb),
    array[]::public.sanitario_sync_v2_event_animal_input[])`;
  const rpcArgs = [owner.id, farms[0], op.client_op_id, op.domain_op_id,
    JSON.stringify({ ...op.payload.event, client_id: envelope.client_id, client_tx_id: op.client_tx_id }), JSON.stringify(op.payload.detail)];
  await test("SQL ACL blocks direct RPC; service executor also enforces disabled gate", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await assert.rejects(withRole(role, owner.id, () => db.query(rpcSql, rpcArgs)), error =>
        error.code === "42501" && (role !== "service_role" || error.message.includes("SANITARIO_SYNC_DISABLED")));
    }
    return { anon: "42501", authenticated: "42501", service_role: "SANITARIO_SYNC_DISABLED" };
  });
  // This is a synthetic direct-fact fixture under authenticated RLS, not a v2 apply bypass.
  await test("Authenticated direct fact preserves retrospective data atomically", async () => {
    await withRole("authenticated", owner.id, async () => {
      await db.query(`insert into public.eventos(id,fazenda_id,dominio,occurred_at,payload,client_id,client_op_id,client_tx_id)
        values ($1,$2,'sanitario',$3,$4,'sanitario-v2-review',$5,$6)`, [factId, farms[0], occurrence, factualPayload, randomUUID(), randomUUID()]);
      await db.query(`insert into public.eventos_sanitario(evento_id,fazenda_id,tipo,produto,produto_nome_snapshot,
        dose_quantidade,dose_unidade,via_aplicacao,responsavel_nome,carencia_carne_dias,carencia_leite_dias,payload)
        values ($1,$2,'vacinacao','Synthetic review product','Synthetic review product',1,'ml','subcutanea','Synthetic responsible',null,null,$3)`,
      [factId, farms[0], factualPayload]);
    });
    return { route: "synthetic direct fixture; not canonical v2 acceptance", event_and_detail_committed: true };
  });
  const readFact = actor => api(`/rest/v1/eventos_sanitario?evento_id=eq.${factId}&select=*`, actor.token);
  await test("Duplicate direct fact identity is rejected without duplicating history", async () => {
    const duplicate = await api("/rest/v1/eventos", owner.token, "POST", {
      id: factId, fazenda_id: farms[0], dominio: "sanitario", occurred_at: occurrence, payload: factualPayload,
    });
    assert.equal(duplicate.status, 409); assert.equal(duplicate.data.code, "23505");
    assert.equal(Number((await db.query("select count(*) from public.eventos where id=$1", [factId])).rows[0].count), 1);
    return { direct_fixture_duplicate: 409, sqlstate: "23505", persisted_facts: 1,
      limitation: "Not canonical v2 replay certification" };
  });
  await test("Real PostgREST RLS isolates facts and denies cross-tenant writes", async () => {
    for (const actor of [owner, member]) {
      const result = await readFact(actor); assert.equal(result.status, 200); assert.equal(result.data.length, 1);
    }
    assert.deepEqual((await readFact(outsider)).data, []);
    const denied = await api("/rest/v1/eventos", outsider.token, "POST", { fazenda_id: farms[0], dominio: "sanitario", occurred_at: occurrence });
    assert.equal(denied.status, 403); assert.equal(denied.data.code, "42501");
    return { owner_rows: 1, member_rows: 1, outsider_rows: 0, foreign_insert: 403 };
  });
  await test("Revocation denies a still-valid JWT without deleting factual history", async () => {
    await db.query("update public.user_fazendas set deleted_at=now() where user_id=$1 and fazenda_id=$2", [member.id, farms[0]]);
    assert.deepEqual((await readFact(member)).data, []);
    assert.equal((await api("/functions/v1/sync-batch", member.token, "POST", envelope)).status, 403);
    assert.equal((await readFact(owner)).data.length, 1);
    return { revoked_member_rows: 0, revoked_member_sync: 403, owner_history_rows: 1 };
  });
  await test("New login and independent database connection recover the same factual data", async () => {
    const fresh = createClient(env.API_URL, env.ANON_KEY, options);
    const session = await fresh.auth.signInWithPassword({ email: owner.email, password: owner.password });
    assert.ifError(session.error);
    const result = await api(`/rest/v1/eventos_sanitario?evento_id=eq.${factId}&select=*`, session.data.session.access_token);
    assert.equal(result.status, 200); assert.equal(result.data.length, 1);
    const detail = result.data[0];
    assert.equal(detail.dose_quantidade, 1); assert.equal(detail.dose_unidade, "ml");
    assert.equal(detail.via_aplicacao, "subcutanea"); assert.equal(detail.responsavel_nome, "Synthetic responsible");
    assert.equal(detail.carencia_carne_dias, null); assert.equal(detail.carencia_leite_dias, null);
    // Existing sanitary snapshot trigger adds these canonical keys even without a protocol.
    assert.deepEqual(detail.payload, { ...factualPayload, protocol_item_version_id: null,
      protocol_item_logical_key: null, protocol_item_version: null });
    const independent = new pg.Client({ connectionString: env.DB_URL }); await independent.connect();
    try { assert.equal((await independent.query("select occurred_at from public.eventos where id=$1", [factId])).rows[0].occurred_at.toISOString(), occurrence); }
    finally { await independent.end(); }
    await fresh.auth.signOut();
    return { independent_login: true, independent_connection: true, dose_route_responsible_preserved: true, unknown_withdrawal_is_null: true };
  });
  const finalGates = (await db.query("select * from public.sanitario_sync_v2_gates order by fazenda_id")).rows;
  assert.deepEqual(finalGates, initialGates);
  report.gates_unchanged = true;
  report.fixtures = { farms, users: [owner.id, member.id, outsider.id], direct_fact_id: factId };
  report.status = report.cases.some(item => item.result === "FAIL") ? "FAIL" : "NEGATIVE_BOUNDARIES_AND_DIRECT_RECOVERY_VERIFIED_CANONICAL_ACCEPTANCE_BLOCKED";
} catch (error) {
  report.status = "FAIL";
  report.setup_error_code = String(error.code ?? error.name);
  console.error(`FAIL setup: ${report.setup_error_code}`);
  process.exitCode = 1;
} finally {
  await db.end();
  const output = process.env.SANITARIO_REVIEW_EVIDENCE;
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`RESULT ${report.status}`);
}
