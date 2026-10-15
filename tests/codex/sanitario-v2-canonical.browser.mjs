// Real Chromium IndexedDB -> app builders/worker -> local Edge/RPC/PostgreSQL.
// Credentials stay in memory. Requires the specifically isolated local review stack.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const isolated = process.env.SANITARIO_REVIEW_WORKDIR;
assert(isolated, "SANITARIO_REVIEW_WORKDIR required");
const config = readFileSync(path.join(isolated, "supabase/config.toml"), "utf8");
assert.match(config, /^project_id = "sanitario-v2-review-ea70bd7c"$/m);
assert.match(config, /\[db.seed\]\s+enabled = false/);
const target = JSON.parse(execFileSync("supabase", ["status", "--workdir", isolated, "-o", "json"],
  { cwd: isolated, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
for (const key of ["API_URL", "DB_URL", "FUNCTIONS_URL"]) {
  const u = new URL(target[key]);
  assert.equal(u.hostname, "127.0.0.1");
  assert.equal(u.port, key === "DB_URL" ? "56322" : "56321");
}
process.env.VITE_SUPABASE_URL = target.API_URL;
process.env.VITE_SUPABASE_FUNCTIONS_URL = target.FUNCTIONS_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = target.ANON_KEY;
const db = new pg.Client({ connectionString: target.DB_URL });
const admin = createClient(target.API_URL, target.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { baseline: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  observed_main: execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim(),
  environment: "isolated native Supabase + real Chromium IndexedDB; no operational data", cases: [] };
let browser, vite;
const contexts = [];
const farms = [];
const transport = [];
const secret = `${randomUUID()}-Aa1!`;
let actor;
async function jsonRow(table, id) {
  assert(["animais", "insumos", "insumo_lotes", "sanitario_produtos_v2", "sanitario_protocolos_v2", "sanitario_protocolo_itens_versions_v2"].includes(table));
  return (await db.query(`select row_to_json(t) value from public.${table} t where id=$1`, [id])).rows[0].value;
}
async function client(who = actor) {
  const context = await browser.newContext(); contexts.push(context);
  await context.grantPermissions(["local-network-access"], { origin: "http://127.0.0.1:8180" });
  // Only the document is a test shell; all production TS modules and network paths are real.
  await context.route("http://127.0.0.1:8180/", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>Canonical sanitary certification</body></html>" }));
  await context.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.abort();
    return route.fallback();
  });
  const page = await context.newPage();
  page.on("console", message => { if (message.type() === "error" && /CORS|Access-Control|private network|cross.origin/i.test(message.text())) transport.push({ browser_error: message.text().replace(/eyJ[A-Za-z0-9_.-]+/g, "[redacted]") }); });
  page.on("requestfailed", request => { const u = new URL(request.url()); transport.push({ failed: `${u.origin}${u.pathname}`, reason: request.failure()?.errorText }); });
  page.on("response", async response => {
    if (response.url().endsWith("/functions/v1/sync-batch")) {
      try { const data = await response.json(); transport.push({ status: response.status(), results: data.results }); } catch { /* interrupted response */ }
    }
  });
  await page.goto("http://127.0.0.1:8180/");
  await load(page, who);
  return { context, page };
}
async function load(page, who = actor) {
  await page.evaluate(async credentials => {
    const [{ db }, { supabase }, cut, worker, pull, ownership, execution] = await Promise.all([
      import("/src/lib/offline/db.ts"), import("/src/lib/supabase.ts"), import("/src/lib/offline/sanitarioV2Cutover.ts"),
      import("/src/lib/offline/syncWorker.ts"), import("/src/lib/offline/pull.ts"),
      import("/src/lib/offline/ownership.ts"), import("/src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts"),
    ]);
    const session = await supabase.auth.signInWithPassword(credentials);
    if (session.error) throw new Error(`Synthetic login failed: ${session.error.status} ${session.error.code} ${session.error.message}`);
    await ownership.establishLocalOwnership(session.data.session);
    cut.setSanitarioV2PushEnabled(true, cut.SANITARIO_V2_STAGING_PROJECT_REF);
    window.cert = { db, supabase, cut, worker, pull, execution };
  }, { email: who.email, password: secret });
}
async function fixture(page, who = actor) {
  const f = { farm: randomUUID(), animal: randomUUID(), protocol: randomUUID(), item: randomUUID(), product: randomUUID(), supply: randomUUID(), lot: randomUUID() };
  farms.push(f.farm);
  await db.query("insert into public.fazendas(id,nome,codigo,created_by) values($1,'Synthetic canonical sanitary',$2,$3)", [f.farm, randomUUID(), who.id]);
  await db.query("insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values($1,$2,'owner',now())", [f.farm, who.id]);
  await db.query(`insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,allowed_user_ids,allowed_client_ids,rollout_percentage)
    values($1,true,2,2,array[$2::uuid],array['canonical-cert'],100)`, [f.farm, who.id]);
  await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo,data_nascimento) values($1,$2,$3,'F',current_date-200)", [f.animal, f.farm, randomUUID()]);
  await db.query(`insert into public.sanitario_produtos_v2(id,nome_comercial,classe,tipo_produto,status_curatorial)
    values($1,$2,'vacina_teste','vacina','ativo')`, [f.product, `Synthetic ${f.product}`]);
  await db.query(`insert into public.sanitario_protocolos_v2(id,family_code,name,scope,fazenda_id,species_scope,legal_status,version,status,approval_status)
    values($1,$2,'Synthetic only','fazenda',$3,'["bovino"]','condicional',1,'draft','draft')`, [f.protocol, `synthetic_${f.protocol}`, f.farm]);
  await db.query(`insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,product_class,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field,status,allows_agenda_auto)
    values($1,$2,'synthetic_dose',1,'recomendado','vacinacao','product_class','vacina_teste','{}','{}','[]','{}','draft',false)`, [f.item, f.protocol]);
  await db.query("insert into public.insumos(id,fazenda_id,nome,tipo,unidade_base) values($1,$2,'Synthetic stock','sanitario','ml')", [f.supply, f.farm]);
  await db.query("insert into public.insumo_lotes(id,fazenda_id,insumo_id,unidade_base,quantidade_inicial_base,saldo_atual_base) values($1,$2,$3,'ml',100,100)", [f.lot, f.farm, f.supply]);
  await hydrate(page, f);
  return f;
}
async function hydrate(page, f) {
  const rows = { animal: await jsonRow("animais", f.animal), protocol: await jsonRow("sanitario_protocolos_v2", f.protocol),
    item: await jsonRow("sanitario_protocolo_itens_versions_v2", f.item), product: await jsonRow("sanitario_produtos_v2", f.product),
    supply: await jsonRow("insumos", f.supply), lot: await jsonRow("insumo_lotes", f.lot) };
  await page.evaluate(async ({ f, rows }) => {
    const { db, cut, pull } = window.cert;
    await db.state_animais.put(rows.animal); await db.state_insumos.put(rows.supply); await db.state_insumo_lotes.put(rows.lot);
    await db.catalog_sanitario_protocolos_v2.put(rows.protocol); await db.catalog_sanitario_protocolo_itens_versions_v2.put(rows.item); await db.catalog_sanitario_produtos_v2.put(rows.product);
    await cut.applySanitarioV2Cutover(f.farm, pull.pullSanitarioV2CutoverState);
  }, { f, rows });
}
async function agenda(page, f) {
  return page.evaluate(async f => {
    const { db, cut } = window.cert;
    const now = new Date().toISOString(); const identity = cut.createSanitarioV2Identity(); const id = crypto.randomUUID();
    const record = { id, fazenda_id: f.farm, status: "programada", dedup_key: id, client_id: "canonical-cert", client_op_id: identity.clientOpId,
      client_tx_id: identity.clientTxId, client_recorded_at: now, server_received_at: now, created_at: now, updated_at: now, deleted_at: null,
      protocolo_id: f.protocol, protocol_item_version_id: f.item, protocol_item_snapshot: { itemKey: "synthetic_dose", version: 1, actionType: "vacinacao", productRequirementKind: "product_class", productClass: "vacina_teste" },
      janela_inicio: now.slice(0,10), janela_fim: null, data_programada: now.slice(0,10), lote_id: null,
      produto_snapshot: {}, produto_classe: "vacina_teste", acao_sanitaria: "vacinacao", revision: 0,
      metadata: { itemKey: "synthetic_dose", productRequirementKind: "product_class", targetAnimalIds: [f.animal] } };
    const operation = cut.buildCreateAgendaOperation(identity, record, [f.animal]);
    await cut.enqueueSanitarioV2Operations({ fazendaId: f.farm, clientId: "canonical-cert", projectRef: cut.SANITARIO_V2_STAGING_PROJECT_REF, operations: [operation] });
    return { id, tx: identity.clientTxId };
  }, f);
}
async function sync(page, tx) {
  const output = await page.evaluate(async tx => {
    const { db, worker } = window.cert; const gesture = await db.queue_gestures.get(tx);
    const sent = (await db.queue_ops.where("client_tx_id").equals(tx).toArray()).map(op => worker.mapOperationForSync(op, gesture.fazenda_id));
    await worker.processGesture(gesture);
    return { gesture: await db.queue_gestures.get(tx), ops: await db.queue_ops.where("client_tx_id").equals(tx).toArray(), sent };
  }, tx);
  if (output.gesture.sync_result === "REJECTED" && output.sent[0]?.command === "create_agenda" && output.gesture.operation_results?.[0]?.reason_code === "SANITARIO_RPC_REJECTED") {
    const o = output.sent[0];
    // Diagnosis only, always rolled back. Never counted as canonical acceptance.
    await db.query("begin");
    try {
      await db.query("set local role service_role");
      await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: "service_role", sub: actor.id })]);
      await db.query(`select public.internal_sanitario_sync_v2_create_agenda($1,$2,$3,$4,$5,
        jsonb_populate_record(null::public.sanitario_sync_v2_agenda_input,$6::jsonb),$7::uuid[])`,
      [actor.id, output.gesture.fazenda_id, o.contract_version, o.client_op_id, o.domain_op_id,
        JSON.stringify({ ...o.payload.agenda, client_id: "canonical-cert", client_tx_id: tx }), o.payload.animal_ids]);
    } catch (error) { output.rpc_diagnostic = { code: error.code, constraint: error.constraint, detail: error.detail, message: error.message }; }
    finally { await db.query("rollback"); }
    output.remote_after_rejection = (await db.query(`select
      (select count(*) from public.sanitario_agenda_v2 where id=$1)::int agendas,
      (select count(*) from public.sanitario_sync_v2_operations where client_op_id=$2)::int receipts,
      (select count(*) from public.eventos where fazenda_id=$3)::int events`, [o.payload.agenda.id, o.client_op_id, output.gesture.fazenda_id])).rows[0];
    report.blocking_attempt = output;
  }
  return output;
}
async function execute(page, f, agendaId) {
  return page.evaluate(async ({ f, agendaId }) => {
    const { db, execution, cut } = window.cert; const result = await execution.executeSanitaryAgendaV2({
      fazendaId: f.farm, agendaId, clientOpId: crypto.randomUUID(), executedAt: new Date().toISOString().slice(0,10), registrationMode: "executed_fact",
      responsibleName: "Synthetic responsible", product: { productId: f.product, productName: `Synthetic ${f.product}`, productClass: "vacina_teste", inventoryLotId: f.lot, quantityConsumed: 2, unit: "ml" },
      application: { dose: 2, doseUnit: "ml", route: "subcutanea" }, confirmation: { userConfirmedExecution: true, userConfirmedStockMovement: true },
      sync: { clientId: "canonical-cert", projectRef: cut.SANITARIO_V2_STAGING_PROJECT_REF } });
    const op = (await db.queue_ops.toArray()).find(op => op.record.command === "apply_factual_core" && op.record.payload.event.id === result.eventId);
    return { ...result, tx: op.client_tx_id, record: op.record,
      checkpoint: { gesture: await db.queue_gestures.get(op.client_tx_id), ops: await db.queue_ops.where("client_tx_id").equals(op.client_tx_id).toArray() } };
  }, { f, agendaId });
}
async function state(page, f, a, e) {
  const remote = (await db.query(`select (select count(*) from public.eventos where id=$1)::int events,
    (select count(*) from public.eventos_sanitario where evento_id=$1)::int details,
    (select count(*) from public.eventos_animais where evento_id=$1)::int animals,
    (select count(*) from public.insumo_movimentacoes where source_evento_id=$1)::int movements,
    (select saldo_atual_base from public.insumo_lotes where id=$2) balance,
    (select revision from public.sanitario_agenda_v2 where id=$3) revision,
    (select execution_evento_id from public.sanitario_agenda_v2 where id=$3) legacy_event_id,
    (select id from public.eventos where source_sanitario_agenda_v2_id=$3 and sanitario_sync_v2_nature='primary_execution') event_id,
    (select count(*) from public.sanitario_agenda_animais_v2 where agenda_id=$3 and execution_evento_id=$1 and planned_status='executado')::int executed_targets`, [e.eventId, f.lot, a.id])).rows[0];
  const local = await page.evaluate(async ({ f, a, e }) => { const { db } = window.cert; return {
    event: !!await db.event_eventos.get(e.eventId), detail: !!await db.event_eventos_sanitario.get(e.eventId),
    agenda: await db.ops_sanitario_agenda_v2.get(a.id), gesture: await db.queue_gestures.get(e.tx),
    ops: await db.queue_ops.where("client_tx_id").equals(e.tx).count(), balance: (await db.state_insumo_lotes.get(f.lot))?.saldo_atual_base,
  }; }, { f, a, e });
  return { remote, local };
}
async function check(code, fn) {
  const selectedFrom = Number((process.env.SANITARIO_CASE_FROM ?? "C1").slice(1));
  if (Number(code.slice(1)) < selectedFrom) { report.cases.push({code,result:"NOT_EXECUTED",reason:"Earlier scenario already observed in preserved prior run; focused continuation."}); return; }
  try { const evidence = await fn(); report.cases.push({ code, result: "PASS", evidence }); console.log(`PASS ${code}`); }
  catch (error) { report.cases.push({ code, result: "FAIL", error: error.message }); console.error(`FAIL ${code}: ${error.message}`); throw error; }
}
const endpoint = "**/functions/v1/sync-batch";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function scheduledFact(page, who = actor) {
  const f = await fixture(page, who); const a = await agenda(page, f);
  assert.equal((await sync(page, a.tx)).gesture.sync_result, "APPLIED");
  await page.evaluate(farm => window.cert.pull.pullSanitarioV2CutoverState(farm), f.farm);
  const e = await execute(page, f, a.id); return { f, a, e };
}
async function retry(page, tx) {
  const due = await page.evaluate(async tx => {
    const { db } = window.cert; const g = await db.queue_gestures.get(tx);
    const ops = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
    return Math.max(0, Date.parse(g.next_attempt_at ?? "") || 0, ...ops.map(op => Date.parse(op.next_attempt_at ?? "") || 0));
  }, tx);
  const delay = Math.max(0, due-Date.now()+80); assert(delay < 60_000, "Unexpected retry horizon");
  if (delay) await pause(delay);
  return sync(page, tx);
}
async function restoreCheckpoint(page, e) {
  // Explicit fault injection: restore the durable pre-ACK queue checkpoint.
  // Domain records/identity are unchanged; replay still goes through the real worker.
  await page.evaluate(async checkpoint => {
    const { db } = window.cert;
    await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
      await db.queue_gestures.put(checkpoint.gesture); await db.queue_ops.bulkPut(checkpoint.ops);
    });
  }, e.checkpoint);
}
async function reopen(c, who = actor) {
  c.page = await c.context.newPage(); await c.page.goto("http://127.0.0.1:8180/"); await load(c.page, who);
}
async function assertConverged(page, x) {
  const s = await state(page, x.f, x.a, x.e);
  assert.equal(s.remote.events, 1); assert.equal(s.remote.details, 1); assert.equal(s.remote.animals, 1);
  assert.equal(s.remote.movements, 1); assert.equal(Number(s.remote.balance), 98); assert.equal(Number(s.remote.revision), 1);
  assert(s.local.event && s.local.detail); assert.equal(s.local.ops, 0); assert.equal(s.local.gesture.sync_result, "APPLIED");
  return s;
}
try {
  await db.connect();
  const created = await admin.auth.admin.createUser({ email: `canonical-${randomUUID()}@example.test`, password: secret, email_confirm: true }); assert.ifError(created.error);
  actor = { id: created.data.user.id, email: created.data.user.email };
  await db.query("insert into public.user_profiles(user_id,display_name) values($1,'Synthetic canonical certification')", [actor.id]);
  vite = await createServer({ root: process.cwd(), envDir: isolated, server: { host: "127.0.0.1", port: 8180, strictPort: true }, logLevel: "error" }); await vite.listen();
  browser = await chromium.launch({ headless: true });
  const c = await client();
  let accepted;
  await check("C1", async () => {
    const f = await fixture(c.page); const a = await agenda(c.page, f); const scheduled = await sync(c.page, a.tx);
    assert.equal(scheduled.gesture.sync_result, "APPLIED", `create_agenda: ${scheduled.gesture.operation_results?.[0]?.reason_code}; ${scheduled.rpc_diagnostic?.constraint}`);
    await c.page.evaluate(farm => window.cert.pull.pullSanitarioV2CutoverState(farm), f.farm);
    const e = await execute(c.page, f, a.id); const ack = await sync(c.page, e.tx);
    const s = await state(c.page, f, a, e);
    assert.equal(ack.gesture.sync_result, "APPLIED", JSON.stringify({ ack, remote: s.remote }));
    assert.equal(s.remote.events, 1); assert.equal(s.remote.details, 1); assert.equal(s.remote.animals, 1); assert.equal(s.remote.movements, 1);
    assert.equal(Number(s.remote.balance), 98); assert.equal(Number(s.remote.revision), 1); assert.equal(s.remote.event_id, e.eventId);
    assert.equal(s.remote.executed_targets, 1);
    assert(s.local.event && s.local.detail); assert.equal(s.local.ops, 0);
    accepted = { f, a, e };
    return { ...s, transport: transport.slice(-2) };
  });
  await check("C2", async () => {
    await restoreCheckpoint(c.page, accepted.e);
    assert.equal((await sync(c.page, accepted.e.tx)).gesture.sync_result, "APPLIED");
    return { ...await assertConverged(c.page, accepted), injection: "pre-ACK durable checkpoint restored; identical operation identities" };
  });
  await check("C3", async () => {
    const x = await scheduledFact(c.page); let remoteResponse;
    const loseAck = async route => { const response = await route.fetch(); remoteResponse = await response.json(); await route.abort("connectionreset"); };
    await c.page.route(endpoint, loseAck);
    const interrupted = await sync(c.page, x.e.tx);
    await c.page.unroute(endpoint, loseAck);
    const beforeRetry = await state(c.page, x.f, x.a, x.e);
    assert.equal(beforeRetry.remote.events, 1); assert.equal(beforeRetry.remote.movements, 1);
    assert.notEqual(interrupted.gesture.status, "DONE"); assert(beforeRetry.local.ops > 0 && beforeRetry.local.event);
    assert.equal((await retry(c.page, x.e.tx)).gesture.sync_result, "APPLIED");
    return { remote_response_without_local_ack: remoteResponse.results, interrupted: interrupted.gesture, before_retry: beforeRetry.remote, final: await assertConverged(c.page, x) };
  });
  await check("C4", async () => {
    const x = await scheduledFact(c.page);
    const timeout = async route => { await pause(6_100); await route.abort().catch(()=>{}); };
    await c.page.route(endpoint, timeout);
    const timedOut = await sync(c.page, x.e.tx); await c.page.unroute(endpoint, timeout);
    assert.notEqual(timedOut.gesture.status, "DONE"); assert.equal((await state(c.page, x.f, x.a, x.e)).remote.events, 0);
    // A real renderer crash while a second attempt has claimed the gesture.
    const due = Date.parse(timedOut.gesture.next_attempt_at ?? "") || 0; if (due > Date.now()) await pause(due-Date.now()+80);
    let sawRequest; const started = new Promise(resolve => { sawRequest = resolve; }); let release;
    const suspended = async route => { sawRequest(); await new Promise(resolve => { release = resolve; }); await route.abort().catch(()=>{}); };
    await c.page.route(endpoint, suspended);
    const inFlight = sync(c.page, x.e.tx).catch(()=>null); await started;
    const claimed = await c.page.evaluate(tx => window.cert.db.queue_gestures.get(tx), x.e.tx); assert.equal(claimed.status, "SYNCING");
    const devtools = await c.context.newCDPSession(c.page);
    const crashed = c.page.waitForEvent("crash"); void devtools.send("Page.crash").catch(()=>{}); await crashed;
    await c.page.close(); release(); await inFlight;
    await reopen(c);
    const recovered = await c.page.evaluate(() => window.cert.worker.recoverStaleSyncingGesturesOnce()); assert(recovered >= 1);
    assert.equal((await retry(c.page, x.e.tx)).gesture.sync_result, "APPLIED");
    return { timeout: timedOut.gesture, before_renderer_crash: claimed, recovered, final: await assertConverged(c.page, x) };
  });
  await check("C5", async () => {
    const x = await scheduledFact(c.page);
    await db.query("update public.sanitario_produtos_v2 set status_curatorial='precisa_validar' where id=$1", [x.f.product]);
    const factualAck = await sync(c.page, x.e.tx);
    assert.equal(factualAck.gesture.sync_result, "APPLIED");
    const direct = await assertConverged(c.page, x);
    // A real identity mismatch must still reject, retain the immutable envelope,
    // and offer the same public retry API used by the reconciliation screen.
    const y = await scheduledFact(c.page);
    await db.query("update public.sanitario_produtos_v2 set status_curatorial='precisa_validar',nome_comercial='Synthetic mismatched identity' where id=$1", [y.f.product]);
    const ack = await sync(c.page, y.e.tx); const s = await state(c.page, y.f, y.a, y.e);
    report.c5_attempt = {ack,state:s};
    assert.equal(ack.gesture.sync_result, "REJECTED"); assert(s.local.event && s.local.detail);
    assert.equal(s.remote.events, 0); assert.equal(s.remote.movements, 0); assert.equal(Number(s.remote.balance), 100);
    assert.notEqual(s.local.gesture.sync_result, "APPLIED");
    assert.equal(ack.ops.length, 2); assert(ack.ops.every(op => op.sync_state === "REJECTED"));
    await db.query("update public.sanitario_produtos_v2 set nome_comercial=$2 where id=$1", [y.f.product, `Synthetic ${y.f.product}`]);
    const rearmed = await c.page.evaluate(async tx => {
      const { retryRejectedOperation } = await import("/src/lib/offline/ops.ts");
      const rejection = (await window.cert.db.queue_rejections.where("client_tx_id").equals(tx).toArray())
        .find(row => row.reason_code === "SANITARIO_PRODUCT_CATALOG_VERSION_MISMATCH");
      if (!rejection) throw new Error("Missing factual rejection");
      await retryRejectedOperation(rejection);
      return window.cert.db.queue_ops.where("client_tx_id").equals(tx).sortBy("op_order");
    }, y.e.tx);
    const envelopes = ops => ops.map(op => [op.client_op_id,op.domain_op_id,op.record])
      .sort((a,b) => a[0].localeCompare(b[0]));
    assert.deepEqual(envelopes(rearmed), envelopes(y.e.checkpoint.ops));
    assert.equal((await sync(c.page, y.e.tx)).gesture.sync_result, "APPLIED");
    const recovered = await assertConverged(c.page, y);
    return { curatorial_change_only:direct.remote, rejected_ack:ack.gesture, before_recovery:s,
      recovery:recovered, original_operation_identity_and_payload_preserved:true,
      policy:"explicit retrospective fact accepted with pending curatorship; identity mismatch rejected; public explicit retry converges after identity repair without approval of prospective use" };
  });
  await check("C6", async () => {
    const second = await admin.auth.admin.createUser({ email: `canonical-other-${randomUUID()}@example.test`, password: secret, email_confirm: true }); assert.ifError(second.error);
    const who = { id: second.data.user.id, email: second.data.user.email };
    await db.query("insert into public.user_profiles(user_id,display_name) values($1,'Synthetic other owner')", [who.id]);
    const other = await client(who); const x = await scheduledFact(c.page); const y = await scheduledFact(other.page, who);
    const wire = await c.page.evaluate(e => ({ client_id: "canonical-cert", fazenda_id: e.checkpoint.gesture.fazenda_id, client_tx_id: e.tx,
      ops: e.checkpoint.ops.map(op => window.cert.worker.mapOperationForSync(op, e.checkpoint.gesture.fazenda_id)) }), x.e);
    const post = (page, body, override) => page.evaluate(async ({body, override}) => {
      const { supabase } = window.cert; const { data } = await supabase.auth.getSession(); const { env } = await import("/src/lib/env.ts");
      const response = await fetch(`${env.supabaseFunctionsUrl}/sync-batch`, { method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabasePublishableKey, Authorization: `Bearer ${override ?? data.session.access_token}` }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, { body, override });
    const foreign = await post(other.page, wire); assert.equal(foreign.status, 403);
    const spoof = await post(other.page, { ...wire, fazenda_id: y.f.farm });
    assert.equal(spoof.body.results[0].status, "REJECTED");
    const wrongCatalog = await agenda(other.page, { ...y.f, protocol: x.f.protocol, item: x.f.item });
    const catalogAck = await sync(other.page, wrongCatalog.tx); assert.equal(catalogAck.gesture.sync_result, "REJECTED");
    // Switching/pulling another cached farm does not change a persisted gesture's tenant.
    const switchedFarm = await fixture(c.page); await c.page.evaluate(farm => window.cert.pull.pullSanitarioV2CutoverState(farm), switchedFarm.farm);
    assert.equal((await sync(c.page, x.e.tx)).gesture.sync_result, "APPLIED");
    const rls = await other.page.evaluate(async farm => {
      const result = await window.cert.supabase.from("eventos").select("id").eq("fazenda_id", farm); return { rows: result.data?.length, error: result.error?.code };
    }, x.f.farm); assert.equal(rls.rows, 0);
    assert.equal((await db.query("select count(*)::int n from public.eventos where fazenda_id=$1", [switchedFarm.farm])).rows[0].n, 0);
    await db.query("delete from public.user_fazendas where fazenda_id=$1 and user_id=$2", [y.f.farm, who.id]);
    const revoked = await sync(other.page, y.e.tx); const preserved = await state(other.page, y.f, y.a, y.e);
    assert.notEqual(revoked.gesture.sync_result, "APPLIED"); assert(preserved.local.event && preserved.local.detail); assert.equal(preserved.remote.events, 0);
    const b64 = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now()/1_000); const unsigned = `${b64({alg:"HS256",typ:"JWT"})}.${b64({sub:who.id,role:"authenticated",aud:"authenticated",iat:now-3600,exp:now-60})}`;
    const expired = `${unsigned}.${createHmac("sha256", target.JWT_SECRET).update(unsigned).digest("base64url")}`;
    const expiredAuth = await admin.auth.getUser(expired); assert(expiredAuth.error && /expired/i.test(expiredAuth.error.message), "Expected actual GoTrue expiry rejection");
    const expiredResponse = await post(other.page, wire, expired); assert.equal(expiredResponse.status, 401);
    const renewed = await scheduledFact(other.page, who); const refreshStatuses = [];
    const expireFirstRequest = async route => {
      const response = await route.fetch(refreshStatuses.length === 0
        ? {headers:{...route.request().headers(),authorization:`Bearer ${expired}`}} : {});
      refreshStatuses.push(response.status()); await route.fulfill({response});
    };
    await other.page.route(endpoint,expireFirstRequest);
    const afterRefresh = await sync(other.page,renewed.e.tx); await other.page.unroute(endpoint,expireFirstRequest);
    assert.deepEqual(refreshStatuses,[401,200]);assert.equal(afterRefresh.gesture.sync_result,"APPLIED");
    const renewedState = await assertConverged(other.page,renewed);
    return { outsider: foreign.status, rls, spoof: spoof.body.results, cross_farm_catalog: catalogAck.gesture.operation_results,
      farm_switch: "pending original-farm fact applied; selected/pulled other farm has zero events", membership_revoked: revoked.gesture,
      local_fact_after_revocation: preserved.local.event && preserved.local.detail, expired_auth_reason: expiredAuth.error.message, expired_edge_status: expiredResponse.status,
      worker_expiry_injection:"first request carries the signed expired synthetic-user JWT; real GoTrue refresh and second transport succeed",refresh_statuses:refreshStatuses,after_refresh:renewedState.remote };
  });
  await check("C7", async () => {
    const f = await fixture(c.page); const a = await agenda(c.page, f); assert.equal((await sync(c.page, a.tx)).gesture.sync_result, "APPLIED");
    await c.page.evaluate(farm => window.cert.pull.pullSanitarioV2CutoverState(farm), f.farm);
    const independent = await client(); await hydrate(independent.page, f);
    const e1 = await execute(c.page, f, a.id); const e2 = await execute(independent.page, f, a.id);
    const results = await Promise.all([sync(c.page,e1.tx),sync(independent.page,e2.tx)]);
    assert.deepEqual(results.map(r=>r.gesture.sync_result).sort(), ["APPLIED","REJECTED"]);
    const facts = (await db.query("select id from public.eventos where source_sanitario_agenda_v2_id=$1 and sanitario_sync_v2_nature='primary_execution'",[a.id])).rows;
    assert.equal(facts.length,1); const winner = facts[0].id === e1.eventId ? e1 : e2;
    const s = await state(winner === e1 ? c.page : independent.page,f,a,winner);
    assert.equal(Number(s.remote.balance),98); assert.equal(s.remote.movements,1); assert.equal(Number(s.remote.revision),1);
    return { results: results.map(r=>r.gesture), state:s.remote, independent_browser_contexts:true };
  });
  await check("C8", async () => {
    const f = await fixture(c.page); const a = await agenda(c.page,f); assert.equal((await sync(c.page,a.tx)).gesture.sync_result,"APPLIED");
    await c.page.evaluate(farm=>window.cert.pull.pullSanitarioV2CutoverState(farm),f.farm);
    await c.context.setOffline(true); const e = await execute(c.page,f,a.id);
    const offline = await state(c.page,f,a,e); assert(offline.local.event && offline.local.detail && offline.local.ops > 0); assert.equal(offline.remote.events,0);
    await c.page.close(); c.page = await c.context.newPage(); await c.context.setOffline(false);
    await c.page.goto("http://127.0.0.1:8180/"); await load(c.page);
    const restored = await state(c.page,f,a,e); assert(restored.local.event && restored.local.detail && restored.local.ops > 0);
    assert.equal((await sync(c.page,e.tx)).gesture.sync_result,"APPLIED");
    return { offline:offline.local.gesture, after_client_restart:restored.local.gesture, final:await assertConverged(c.page,{f,a,e}), lifecycle:"real offline registration, page close/new renderer, reconnect/login; same IndexedDB browser context" };
  });
} catch (error) { process.exitCode = 1; report.failure = String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,"[redacted]"); }
finally {
  for (const code of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]) {
    if (!report.cases.some(item => item.code === code)) report.cases.push({ code, result: "NOT_EXECUTED", reason: "Sequential certification stopped before this scenario; see failure and blocking_attempt." });
  }
  report.transport = transport;
  if (farms.length) { await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=any($1::uuid[])", [farms]);
    report.final_gates = (await db.query("select fazenda_id,enabled from public.sanitario_sync_v2_gates where fazenda_id=any($1::uuid[])", [farms])).rows; }
  report.enabled_gate_count_after_cleanup = (await db.query("select count(*)::int count from public.sanitario_sync_v2_gates where enabled")).rows[0].count;
  report.local_gates_after_cleanup = [];
  for (const context of contexts) {
    report.local_gates_after_cleanup.push(await context.pages()[0]?.evaluate(() => {
      const cut = window.cert?.cut; if (!cut) return "not_initialized";
      cut.setSanitarioV2PushEnabled(false, cut.SANITARIO_V2_STAGING_PROJECT_REF);
      return cut.isSanitarioV2PushEnabled(cut.SANITARIO_V2_STAGING_PROJECT_REF);
    }).catch(()=>"unavailable"));
    await context.close();
  }
  if (browser) await browser.close(); if (vite) await vite.close(); await db.end();
  report.source_hash = createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex");
  report.sources = ["src/lib/offline/pull.ts","src/lib/offline/syncWorker.ts","supabase/functions/sync-batch/index.ts","supabase/functions/sync-batch/inventory-dependency.ts",
    "supabase/migrations/20261015070038_sanitario_agenda_catalog_v2_references.sql"].map(file=>({file,sha256:createHash("sha256").update(readFileSync(file)).digest("hex")}));
  const output = path.join(isolated,"canonical-browser-evidence.json");
  if (existsSync(output)) copyFileSync(output, path.join(isolated,`canonical-browser-previous-${Date.now()}.json`));
  writeFileSync(output,JSON.stringify(report,null,2)+"\n");
}
