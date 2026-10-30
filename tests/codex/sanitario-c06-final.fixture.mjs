// Four factual/stock compositions on the existing owned local Supabase harness.
// No fabricated ACK, remote fixture, DDL or alternative domain writer.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { restrictContextToLoopback } from "./sanitary-disposable-support.fixture.mjs";

export async function runSanitaryFactualFinalC06({ db, env, report, a, b, both, outsider, farmA, farmB, animalA, protocol, items }) {
  assert.equal(env.API_URL, "http://127.0.0.1:55421");
  const item = items.find(row => row.logical_item_key === "raiva_primovac_dose1");
  assert(item);
  const product = { id: randomUUID(), nome_comercial: "C06 synthetic declared application", classe: item.product_class };
  await db.query(`insert into public.sanitario_produtos_v2(id,nome_comercial,classe,tipo_produto,metadata)
    values($1,$2,$3,'fixture','{"synthetic":true}')`, [product.id, product.nome_comercial, product.classe]);
  report.c06_final_contract = { mode: "declared executed_fact, not prospective authorization", product,
    withdrawal: "unknown: no technical source or rule supplied", initial_balance: 100, consumption: 2 };
  let vite, browser, context, page;
  const sentBatches = [];
  const remote = async () => {
    const result = {};
    for (const [key, table, order] of [["events", "eventos", "id"], ["details", "eventos_sanitario", "evento_id"],
      ["eventAnimals", "eventos_animais", "id"], ["movements", "insumo_movimentacoes", "id"],
      ["lots", "insumo_lotes", "id"], ["agendas", "sanitario_agenda_v2", "id"],
      ["receipts", "sanitario_sync_v2_operations", "client_op_id"]]) {
      result[key] = (await db.query(`select * from public.${table} order by ${order}`)).rows;
    }
    return result;
  };
  const local = () => page.evaluate(async () => {
    const { db } = window.c06f;
    const result = {};
    for (const [key, store] of Object.entries({ gestures: "queue_gestures", ops: "queue_ops", rejections: "queue_rejections",
      obligations: "sync_reconcile_obligations", events: "event_eventos", details: "event_eventos_sanitario",
      eventAnimals: "event_eventos_animais", movements: "state_insumo_movimentacoes", lots: "state_insumo_lotes",
      agendas: "ops_sanitario_agenda_v2", ownership: "local_ownership" })) result[key] = await db[store].toArray();
    return result;
  });
  const snapshot = async () => ({ local: await local(), postgres: await remote() });
  const selected = process.argv.find(arg => arg.startsWith("--c06-final-cases="))?.split("=")[1].split(",");
  report.c06_final_selected_cases = selected ?? ["F1", "F2", "F3", "F4"];
  const check = async (name, run) => {
    if (selected && !selected.includes(name.slice(0, 2))) return;
    report.c06_final_step = name;
    const before = await snapshot();
    try {
      const evidence = await run();
      report.cases.push({ name, status: "PROVEN", before, evidence, after: await snapshot() });
      console.log(`PROVEN ${name}`);
    } catch (error) {
      report.cases.push({ name, status: "FAILED", before, after: await snapshot().catch(() => null) });
      throw error;
    }
  };
  const boot = async (login = false) => page.evaluate(async ({ login, email, password, farms }) => {
    let step = "imports";
    try {
    const [{ db }, { supabase }, cut, pull, worker, ownership] = await Promise.all([
      import("/src/lib/offline/db.ts"), import("/src/lib/supabase.ts"), import("/src/lib/offline/sanitarioV2Cutover.ts"),
      import("/src/lib/offline/pull.ts"), import("/src/lib/offline/syncWorker.ts"), import("/src/lib/offline/ownership.ts")]);
    if (login) {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw Error("C06_FINAL_LOGIN_FAILED");
      await ownership.establishLocalOwnership(result.data.session);
    }
    cut.setSanitarioV2PushEnabled(true, "local");
    localStorage.setItem("gestao_agro_active_fazenda_id", farms[0]);
    window.c06f = { db, supabase, cut, pull, worker };
    if (login) for (const farm of farms) {
      for (const table of ["animais", "fazenda_sanidade_config", "insumos", "insumo_lotes"]) {
        step = `pull:${table}`;
        await pull.pullDataForFarm(farm, [table], { mode: "merge" });
      }
      step = "technical catalog";
      await pull.pullSanitarioTechnicalCatalogV2(farm);
      step = "protocol catalog";
      await pull.pullSanitarioProtocolCatalogV2();
      step = "cutover";
      await cut.applySanitarioV2Cutover(farm, pull.pullSanitarioV2CutoverState);
    }
    } catch (error) { throw Error(`C06_FINAL_BOOT:${step}:${error.code ?? ""}:${error.message ?? String(error)}`); }
  }, { login, email: both.email, password: both.password, farms: [farmA, farmB] });
  const processBatch = tx => page.evaluate(async tx => {
    const { db, worker } = window.c06f;
    await worker.processGesture(await db.queue_gestures.get(tx));
  }, tx);
  const drain = () => page.evaluate(async farm => {
    const { pull, worker } = window.c06f;
    await worker.drainReconciliationObligations(farm);
    await pull.pullDataForFarm(farm, ["insumos", "insumo_lotes", "insumo_movimentacoes"], { mode: "merge" });
  }, farmA);
  const replay = async tx => {
    await expect.poll(async () => {
      await page.evaluate(() => window.c06f.worker.recoverErroredGesturesOnce());
      await processBatch(tx);
      return (await local()).ops.filter(op => op.client_tx_id === tx).length;
    }, { timeout: 45000, intervals: [300, 1000] }).toBe(0);
    await drain();
  };
  const enqueue = async () => {
    const insumo = randomUUID(), lot = randomUUID();
    await db.query("insert into public.insumos(id,fazenda_id,nome,tipo,unidade_base) values($1,$2,$3,'sanitario','ml')", [insumo, farmA, `C06 synthetic ${insumo}`]);
    await db.query(`insert into public.insumo_lotes(id,fazenda_id,insumo_id,quantidade_inicial_base,saldo_atual_base,unidade_base)
      values($1,$2,$3,100,100,'ml')`, [lot, farmA, insumo]);
    return page.evaluate(async ({ farm, animal, product, protocol, item, lot }) => {
      try {
      const { db, cut, pull, worker } = window.c06f;
      const [{ buildManualSanitaryAgendaRecordsV2 }, { executeSanitaryAgendaV2 }, { getClientId }] = await Promise.all([
        import("/src/lib/sanitario/agenda/sanitaryManualAgendaV2.ts"), import("/src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts"),
        import("/src/lib/offline/ops.ts")]);
      await pull.pullDataForFarm(farm, ["insumos", "insumo_lotes"], { mode: "merge" });
      const clientId = getClientId(), identity = cut.createSanitarioV2Identity();
      const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const records = buildManualSanitaryAgendaRecordsV2({ clientOpId: identity.clientOpId, syncContext: { clientId, projectRef: "local" },
        target: { scope: "animal", id: animal, fazendaId: farm }, confirmed: true, plannedFor: date,
        source: { kind: "sanitary_precheck_preview_v2", protocolId: protocol.id, protocolItemVersionId: item.id,
          actionType: "vacinacao", generationMode: "manual", familyCode: "raiva", itemKey: item.logical_item_key,
          itemLabel: "C06 declared fact", protocolName: protocol.nome, precheckStatus: "eligible", productRequirementKind: "product_class", productClass: item.product_class } });
      const create = cut.buildCreateAgendaOperation(identity, records.agenda, [animal]);
      await cut.validateSanitarioV2Enqueue({ fazendaId: farm, projectRef: "local", operations: [create] });
      await db.transaction("rw", [db.queue_gestures, db.queue_ops, db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2], async () => {
        await db.ops_sanitario_agenda_v2.put(records.agenda);
        await db.ops_sanitario_agenda_animais_v2.bulkPut(records.animals);
        await cut.writeSanitarioV2Queue({ fazendaId: farm, clientId, operations: [create] });
      });
      await worker.processGesture(await db.queue_gestures.get(identity.clientTxId));
      if ((await db.queue_gestures.get(identity.clientTxId)).status !== "DONE") throw Error("C06_FINAL_AGENDA_NOT_ACKED");
      const input = { fazendaId: farm, agendaId: records.agenda.id, clientOpId: crypto.randomUUID(), executedAt: date,
        registrationMode: "executed_fact", responsibleName: "Synthetic declaration only", sync: { clientId, projectRef: "local" },
        product: { productId: product.id, productName: product.nome_comercial, productClass: product.classe, inventoryLotId: lot, quantityConsumed: 2, unit: "ml" },
        application: { dose: 1, doseUnit: "ml", route: "subcutanea" },
        confirmation: { userConfirmedExecution: true, userConfirmedStockMovement: true } };
      const result = await executeSanitaryAgendaV2(input);
      const operations = await db.queue_ops.filter(op => op.client_op_id === input.clientOpId || op.record?.source_evento_id === result.eventId).toArray();
      if (operations.length !== 2) throw Error("C06_FINAL_EXPECTED_FACT_AND_MOVEMENT");
      return { input, result, operations, tx: operations[0].client_tx_id, eventId: result.eventId, agendaId: records.agenda.id, lot };
      } catch (error) { throw Error(`C06_FINAL_ENQUEUE:${error.code ?? ""}:${error.message ?? String(error)}`); }
    }, { farm: farmA, animal: animalA, product, protocol, item, lot });
  };
  const assertRemote = async (batch, applied, movement) => {
    const state = await remote();
    assert.equal(state.events.filter(row => row.id === batch.eventId).length, Number(applied));
    assert.equal(state.details.filter(row => row.evento_id === batch.eventId).length, Number(applied));
    assert.equal(state.movements.filter(row => row.source_evento_id === batch.eventId).length, Number(movement));
    assert.equal(Number(state.lots.find(row => row.id === batch.lot).saldo_atual_base), movement ? 98 : 100);
    const fact = batch.operations.find(op => op.record?.command === "apply_factual_core");
    assert(fact);
    assert.equal(state.receipts.filter(row => row.client_op_id === fact.client_op_id).length, Number(applied));
    assert(!state.movements.some(row => !state.events.some(event => event.id === row.source_evento_id)));
    return state;
  };
  const independentPull = async batch => {
    const peer = await browser.newContext();
    try {
      await peer.grantPermissions(["local-network-access"], { origin: "http://127.0.0.1:8181" });
      await restrictContextToLoopback(peer);
      await peer.route("http://127.0.0.1:8181/", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>C06 independent client</body></html>" }));
      const tab = await peer.newPage(); await tab.goto("http://127.0.0.1:8181/");
      return await tab.evaluate(async ({ email, password, farm, eventId, lot }) => {
        const [{ db }, { supabase }, pull, ownership] = await Promise.all([import("/src/lib/offline/db.ts"),
          import("/src/lib/supabase.ts"), import("/src/lib/offline/pull.ts"), import("/src/lib/offline/ownership.ts")]);
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw Error("C06_FINAL_PEER_LOGIN_FAILED");
        await ownership.establishLocalOwnership(result.data.session);
        await pull.pullSanitarioV2CutoverState(farm);
        await pull.pullDataForFarm(farm, ["insumos", "insumo_lotes", "insumo_movimentacoes"], { mode: "merge" });
        return { event: await db.event_eventos.get(eventId), detail: await db.event_eventos_sanitario.get(eventId),
          movements: await db.state_insumo_movimentacoes.filter(row => row.source_evento_id === eventId).toArray(),
          lot: await db.state_insumo_lotes.get(lot), queue: await db.queue_ops.count() };
      }, { email: a.email, password: a.password, farm: farmA, eventId: batch.eventId, lot: batch.lot });
    } finally { await peer.close(); }
  };
  const cancelMovementAttempt = async batch => {
    const lock = new pg.Client({ connectionString: env.DB_URL });
    await lock.connect(); await lock.query("begin");
    let pending;
    try {
      await lock.query("select id from public.insumo_lotes where id=$1 for no key update", [batch.lot]);
      pending = processBatch(batch.tx);
      let waiting;
      await expect.poll(async () => {
        const receipts = await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where entity_id=$1 and operation_kind='factual_core'", [batch.eventId]);
        waiting = (await db.query("select pid from pg_stat_activity where wait_event_type='Lock' and query ilike '%insumo_movimentacoes%' and pid<>pg_backend_pid()")).rows;
        return receipts.rows[0].n === 1 && waiting.length === 1;
      }, { timeout: 20000, intervals: [100, 300] }).toBe(true);
      assert.equal((await db.query("select pg_cancel_backend($1) cancelled", [waiting[0].pid])).rows[0].cancelled, true);
      await pending; return true;
    } finally { await lock.query("rollback"); await lock.end(); await pending?.catch(() => {}); }
  };
  try {
    Object.assign(process.env, { VITE_SUPABASE_URL: env.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: env.ANON_KEY,
      VITE_SUPABASE_FUNCTIONS_URL: `${env.API_URL}/functions/v1`, VITE_BACKEND_ENV: "homologation" });
    vite = await createServer({ cacheDir: "scratch/c06-final-vite-cache", server: { host: "127.0.0.1", port: 8181, strictPort: true }, logLevel: "error" });
    await vite.listen(); browser = await chromium.launch({ headless: true }); context = await browser.newContext();
    context.on("request", request => {
      if (request.url().endsWith("/functions/v1/sync-batch") && request.method() === "POST") sentBatches.push(request.postDataJSON());
    });
    await context.grantPermissions(["local-network-access"], { origin: "http://127.0.0.1:8181" });
    await restrictContextToLoopback(context);
    await context.route("http://127.0.0.1:8181/", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>C06 factual isolated harness</body></html>" }));
    page = await context.newPage(); await page.goto("http://127.0.0.1:8181/"); await boot(true);
    await check("F1 positive factual consumption and independent pull", async () => {
      const batch = await enqueue(); const pending = await snapshot();
      await processBatch(batch.tx); await drain();
      const state = await assertRemote(batch, true, true), after = await local();
      assert.equal(after.gestures.find(row => row.client_tx_id === batch.tx).status, "DONE");
      assert.equal(Number(after.lots.find(row => row.id === batch.lot).saldo_atual_base), 98);
      assert(after.events.some(row => row.id === batch.eventId));
      assert(after.details.some(row => row.evento_id === batch.eventId));
      assert.equal(after.movements.filter(row => row.source_evento_id === batch.eventId).length, 1);
      const independent = await independentPull(batch);
      assert.equal(independent.event.id, batch.eventId); assert.equal(independent.detail.evento_id, batch.eventId);
      assert.equal(independent.movements.length, 1); assert.equal(independent.movements[0].id, state.movements[0].id);
      assert.equal(Number(independent.lot.saldo_atual_base), 98); assert.equal(independent.queue, 0);
      for (const actor of [b, outsider]) for (const table of ["eventos", "eventos_sanitario", "insumo_movimentacoes"]) {
        const read = await actor.client.from(table).select("fazenda_id").eq("fazenda_id", farmA);
        assert.ifError(read.error); assert.deepEqual(read.data, []);
      }
      assert.equal(state.details.find(row => row.evento_id === batch.eventId).carencia_carne_dias, null);
      return { batch, pending, independent, rls: "B/outsider cannot read A", balance: "100 - 2 = 98" };
    });
    await check("F2 real commit lost ACK reload and same identity replay", async () => {
      const batch = await enqueue(); let committed;
      const fault = async route => { const response = await route.fetch(); committed = await response.json(); await route.abort("timedout"); };
      await context.route("**/functions/v1/sync-batch", fault);
      try { await processBatch(batch.tx); } finally { await context.unroute("**/functions/v1/sync-batch", fault); }
      assert(committed.results.every(row => row.status === "APPLIED"));
      const pending = await snapshot(), server = await assertRemote(batch, true, true);
      assert.equal(pending.local.ops.filter(op => op.client_tx_id === batch.tx).length, 2);
      await page.reload(); await boot();
      assert.deepEqual((await local()).ops.filter(op => op.client_tx_id === batch.tx), pending.local.ops.filter(op => op.client_tx_id === batch.tx));
      await replay(batch.tx); const after = await assertRemote(batch, true, true);
      for (const key of ["events", "details", "movements", "receipts"]) assert.deepEqual(after[key], server[key]);
      assert.equal((await local()).obligations.length, 0);
      return { batch, committed, pending, restart: "reload with original IndexedDB/operation identities" };
    });
    await check("F3 real gate rejection preserves fact and dependent audit without remote debit", async () => {
      const batch = await enqueue();
      await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1", [farmA]);
      try { await processBatch(batch.tx); } finally { await db.query("update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1", [farmA]); }
      const after = await local(); await assertRemote(batch, false, false);
      assert.equal(after.gestures.find(row => row.client_tx_id === batch.tx).status, "REJECTED");
      assert(after.rejections.some(row => row.client_op_id === batch.input.clientOpId && row.reason_code === "SANITARIO_SYNC_DISABLED"));
      assert.equal(after.ops.filter(row => row.client_tx_id === batch.tx).length, 2);
      assert(after.ops.filter(row => row.client_tx_id === batch.tx).every(row => row.sync_state === "REJECTED"));
      return { batch, rejection: after.rejections.filter(row => row.client_tx_id === batch.tx), policy: "terminal durable; no false success" };
    });
    await check("F4 applied fact retains rejected stock and explicitly retries only the missing effect", async () => {
      const batch = await enqueue();
      // Existing factual obligations coalesce by farm/scope; keep their tables.
      await page.evaluate(async farm => {
        const { upsertReconciliationObligations } = await import("/src/lib/offline/reconciliationObligations.ts");
        await upsertReconciliationObligations([{ fazendaId: farm, scope: "factual", tables: ["insumos"] }]);
      }, farmA);
      const cancelled = await cancelMovementAttempt(batch);
      await assertRemote(batch, true, false);
      const after = await local(), gesture = after.gestures.find(row => row.client_tx_id === batch.tx);
      assert.equal(gesture.status, "REJECTED");
      assert.equal(gesture.operation_results.filter(row => row.status === "APPLIED").length, 1);
      assert.equal(gesture.operation_results.filter(row => row.status === "REJECTED").length, 1);
      assert(after.rejections.some(row => row.client_tx_id === batch.tx));
      assert(after.events.some(row => row.id === batch.eventId));
      assert.equal(after.movements.filter(row => row.source_evento_id === batch.eventId).length, 0);
      const movement = batch.operations.find(op => op.table === "state_insumo_movimentacoes");
      assert.equal(after.ops.find(op => op.client_op_id === movement.client_op_id).sync_state, "REJECTED");
      assert.equal(Number(after.lots.find(row => row.id === batch.lot).saldo_atual_base), 100);
      const retained = await snapshot();
      const sentBefore = sentBatches.length;
      await page.evaluate(() => window.c06f.worker.recoverErroredGesturesOnce());
      await processBatch(batch.tx); await drain();
      await assertRemote(batch, true, false);
      assert.equal(sentBatches.length, sentBefore, "Terminal movement must not retry automatically");
      await page.evaluate(async id => {
        const { db } = window.c06f;
        const { retryRejectedOperation } = await import("/src/lib/offline/ops.ts");
        const rejection = await db.queue_rejections.filter(row => row.client_op_id === id).first();
        await retryRejectedOperation(rejection);
      }, movement.client_op_id);
      const retryReserved = await snapshot();
      assert.equal(Number(retryReserved.local.lots.find(row => row.id === batch.lot).saldo_atual_base), 98);
      const cancelledAgain = await cancelMovementAttempt(batch);
      await assertRemote(batch, true, false);
      const rejectedAgain = await snapshot();
      assert.equal(Number(rejectedAgain.local.lots.find(row => row.id === batch.lot).saldo_atual_base), 100);
      assert.equal(rejectedAgain.local.ops.find(row => row.client_op_id === movement.client_op_id).sync_state, "REJECTED");
      await page.evaluate(async id => {
        const { db } = window.c06f;
        const { retryRejectedOperation } = await import("/src/lib/offline/ops.ts");
        const rejection = await db.queue_rejections.filter(row => row.client_op_id === id).first();
        await retryRejectedOperation(rejection);
      }, movement.client_op_id);
      assert.equal(Number((await local()).lots.find(row => row.id === batch.lot).saldo_atual_base), 98);
      await processBatch(batch.tx); await drain();
      await assertRemote(batch, true, true);
      const retry = sentBatches.at(-1);
      assert.equal(retry.ops.length, 1); assert.equal(retry.ops[0].client_op_id, movement.client_op_id);
      const final = await local();
      assert.equal(final.ops.filter(op => op.client_tx_id === batch.tx).length, 0);
      assert.equal(final.gestures.find(row => row.client_tx_id === batch.tx).status, "DONE");
      assert.equal(Number(final.lots.find(row => row.id === batch.lot).saldo_atual_base), 98);
      assert.equal(final.obligations.length, 0);
      return { batch, cancelled, retained, retryReserved, cancelledAgain, rejectedAgain, retry, decision: "DB_57014 remains terminal; canonical explicit retry preserves stock identity and sends no factual command" };
    });
    report.c06_final_snapshot = await snapshot();
    report.c06_final_status = "READY_FOR_REVIEW";
  } catch (error) {
    report.c06_final_failure = String(error.stack).replace(/https?:\/\/\S+|eyJ[\w.-]+/g, "[REDACTED]").slice(0, 3500);
    throw error;
  } finally {
    if (page && !page.isClosed()) report.local_test_flag_disabled = await page.evaluate(() => {
      window.c06f.cut.setSanitarioV2PushEnabled(false, "local");
      return !window.c06f.cut.isSanitarioV2PushEnabled("local");
    }).catch(() => false);
    await context?.close(); await browser?.close(); await vite?.close(); report.browser_closed = true;
  }
}
