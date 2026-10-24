// Invoked only by the existing owned local Supabase harness (--vf4).
// Credentials/sessions stay in memory. Faults interrupt real responses after real commits.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { createConfirmedTestSession, restrictContextToLoopback } from "./sanitary-disposable-support.fixture.mjs";

export async function runSanitaryRecoveryVF4({ db, env, report }) {
  assert.equal(new URL(env.API_URL).hostname, "127.0.0.1");
  assert.equal(new URL(env.API_URL).port, "55421");
  assert.equal(new URL(env.DB_URL).port, "55422");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
  const check = async (name, run) => {
    report.vf4_step = name;
    const evidence = await run();
    report.cases.push({ name, status: "PASS", evidence });
    console.log(`PASS ${name}`);
  };
  const actor = async label => {
    const email = `vf4-${label}-${randomUUID()}@example.test`, password = `${randomUUID()}Aa1!`;
    const client = createClient(env.API_URL, env.ANON_KEY, options);
    const login = await createConfirmedTestSession(admin, client, { email, password });
    return { id: login.user.id, client, email, password, originalToken: login.session.access_token,
      expiresAt: login.session.expires_at, originalRefresh: login.session.refresh_token };
  };
  const a = await actor("a"), b = await actor("b"), both = await actor("both"), outsider = await actor("outsider");
  const farmA = randomUUID(), farmB = randomUUID(), animalA = randomUUID(), animalB = randomUUID();
  report.environment = { kind: "owned disposable local Supabase", api: "http://127.0.0.1:55421", db_host: "127.0.0.1", db_port: 55422,
    real: ["GoTrue Auth/JWT", "PostgREST", "PostgreSQL/RLS", "Edge sync-batch", "Chromium/Dexie/worker"],
    production_accessed: false, synthetic_users: 4, farms: [farmA, farmB], jwt_expiry_seconds: 60 };
  for (const [farm, owner, animal] of [[farmA, a, animalA], [farmB, b, animalB]]) {
    await db.query("insert into public.fazendas(id,nome,codigo,created_by) values($1,'VF4 sintética',$2,$3)", [farm, randomUUID(), owner.id]);
    for (const member of [owner, both]) await db.query("insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values($1,$2,'owner',now())", [farm, member.id]);
    await db.query("insert into public.fazenda_sanidade_config(fazenda_id,uf,payload) values($1,'MG','{}')", [farm]);
    await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo,data_nascimento,especie) values($1,$2,'VF4 animal','F','2023-01-01','bovino')", [animal, farm]);
    await db.query(`insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,allowed_user_ids,rollout_percentage)
      values($1,true,2,2,$2,100)`, [farm, [owner.id, both.id]]);
  }
  const snapshotBytes = readFileSync("docs/review/evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.json");
  const snapshot = JSON.parse(snapshotBytes);
  const items = snapshot.items.filter(i => i.logical_item_key.startsWith("raiva_") && i.status === "active");
  assert.equal(items.length, 3);
  const protocol = snapshot.protocols.find(p => p.id === items[0].protocol_id);
  // Restore only the relevant read-only catalog rows, never invoke bootstrap or curator RPCs.
  // The remote reviewer FK must refer to a synthetic local user; all rule fields are unchanged.
  const insert = async (table, row) => {
    const keys = Object.keys(row);
    await db.query(`insert into public.${table} (${keys.join(",")}) values (${keys.map((_,i)=>`$${i+1}`).join(",")})`,
      keys.map(k => row[k] !== null && typeof row[k] === "object" ? JSON.stringify(row[k]) : row[k]));
  };
  await insert("sanitario_protocolos_v2", { ...protocol, created_by: null, approved_by: a.id });
  for (const item of items) await insert("sanitario_protocolo_itens_versions_v2", item);
  report.catalog_fixture = { snapshot_sha256: createHash("sha256").update(snapshotBytes).digest("hex"),
    protocol_id: protocol.id, item_ids: items.map(i=>i.id), changes: ["protocol.created_by=null", "protocol.approved_by=synthetic local user FK"],
    scope: "three active rabies items only; no bootstrap/import/curatorial decisions" };
  const raw = async (actor, path, method = "GET", body, token) => {
    const session = actor ? await actor.client.auth.getSession() : null;
    const bearer = token ?? session?.data.session?.access_token;
    const response = await fetch(`${env.API_URL}${path}`, { method,
      headers: { apikey: env.ANON_KEY, "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
    return { http: response.status, data: await response.json() };
  };
  const operation = (command, payload, extra={}) => ({ domain: "sanitario_v2", contract_version: 2,
    client_op_id: randomUUID(), client_tx_id: randomUUID(), domain_op_id: randomUUID(), command, payload, ...extra });
  const envelope = (farm, ops) => ({ fazenda_id: farm, client_id: "vf4-real-server", client_tx_id: ops[0].client_tx_id, ops });
  const send = (actor, farm, ops, token) => raw(actor, "/functions/v1/sync-batch", "POST", envelope(farm, ops), token);
  const applied = response => { assert.equal(response.http, 200); assert.equal(response.data.results?.[0]?.status, "APPLIED", JSON.stringify(response.data)); return response.data.results[0]; };
  const denied = response => assert(response.http >= 400 || response.data.results?.every(r=>r.status !== "APPLIED"), JSON.stringify(response.data));
  const count = async (table, id) => Number((await db.query(`select count(*) n from public.${table} where id=$1`, [id])).rows[0].n);
  const creation = (animal, id=randomUUID(), item=items[0], automatic=false) => operation("create_agenda", {
    agenda: { id, dedup_key: `vf4:${id}`, protocolo_id: protocol.id, protocol_item_version_id: item.id,
      protocol_item_snapshot: { generationMode: automatic ? "automatic" : "manual", limitations: item.limitations,
        planningEvidence: { itemVersion: item.version } }, acao_sanitaria: "vacinacao", janela_inicio: "2026-11-01",
      client_recorded_at: new Date().toISOString(), data_programada: "2026-11-01", metadata: { vf4: true } }, animal_ids: [animal] });
  const agendaA = creation(animalA), agendaB = creation(animalB);
  let vite, browser;
  const contexts = [];
  try {
    await check("Auth real: login de quatro identidades e refresh válido", async () => {
      for (const user of [a,b,both,outsider]) { const r=await user.client.auth.getUser(); assert.ifError(r.error); assert.equal(r.data.user.id,user.id); }
      const refresh=await a.client.auth.refreshSession(); assert.ifError(refresh.error); assert.equal(refresh.data.user.id,a.id);
      return { users:4, refresh:"accepted", tokens_recorded:false };
    });
    await check("RLS HTTP: matriz A/B/ambas/outsider, escrita e manipulação de fazenda", async () => {
      const matrix=[];
      for(const [user,expected] of [[a,[farmA]],[b,[farmB]],[both,[farmA,farmB]],[outsider,[]]]) {
        const read=await user.client.from("fazenda_sanidade_config").select("fazenda_id"); assert.ifError(read.error);
        assert.deepEqual(read.data.map(r=>r.fazenda_id).sort(),expected.sort());
        const allowed=await user.client.from("fazenda_sanidade_config").update({uf:"SC"}).eq("fazenda_id",farmA).select("fazenda_id");
        assert.ifError(allowed.error); assert.equal(allowed.data.length, expected.includes(farmA)?1:0);
        matrix.push({actor:user===a?"A":user===b?"B":user===both?"both":"outsider",read:expected.length,write_A:allowed.data.length});
      }
      const spoof=await a.client.from("fazenda_sanidade_config").update({fazenda_id:farmB}).eq("fazenda_id",farmA);
      assert(spoof.error,"tenant reassignment unexpectedly accepted");
      const direct=await a.client.rpc("internal_sanitario_sync_v2_create_agenda",{actor_user_id:a.id,fazenda_id:farmA,
        contract_version:2,client_op_id:randomUUID(),domain_op_id:randomUUID(),
        payload:{...agendaA.payload.agenda,client_id:"vf4-real-server",client_tx_id:agendaA.client_tx_id},animal_ids:[animalA]});
      assert.equal(direct.error?.code,"42501");
      return {matrix,spoof_code:spoof.error.code,direct_internal_rpc:direct.error.code};
    });
    await check("Gate OFF real rejeita membro autorizado sem persistir operação",async()=>{
      const op=creation(animalA);
      await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1",[farmA]);
      try { const r=await send(a,farmA,[op]);denied(r);assert.equal(await count("sanitario_agenda_v2",op.payload.agenda.id),0);return{reason:r.data.results[0].reason_code,rows:0}; }
      finally { await db.query("update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1",[farmA]); }
    });
    await check("Gate local autorizado: criação manual A/B sem Evento e leitura RLS de Agenda", async () => {
      applied(await send(a,farmA,[agendaA])); applied(await send(b,farmB,[agendaB]));
      for(const [user,n]of [[a,1],[b,1],[both,2],[outsider,0]]) {
        const r=await user.client.from("sanitario_agenda_v2").select("id");assert.ifError(r.error);assert.equal(r.data.length,n);
      }
      return {agendas:2,facts:Number((await db.query("select count(*) n from public.eventos")).rows[0].n)};
    });
    await check("Servidor rejeita outsider, envelope cross-tenant, fazenda adulterada e animal de B em A",async()=>{
      for(const [user,farm,op]of [[outsider,farmA,creation(animalA)],[a,farmB,creation(animalB)],
        [a,farmA,{...creation(animalA),fazenda_id:farmB}],[a,farmA,creation(animalB)]]) {
        denied(await send(user,farm,[op]));assert.equal(await count("sanitario_agenda_v2",op.payload.agenda.id),0);
      }
      return {attempts:4,unauthorized_rows:0};
    });
    await check("Replay e concorrência reais: mesmo UUID, um recibo e uma Agenda",async()=>{
      const replay=applied(await send(a,farmA,[agendaA]));
      const concurrent=creation(animalA);
      const results=await Promise.all([send(a,farmA,[concurrent]),send(a,farmA,[concurrent])]);
      assert(results.some(r=>r.data.results?.[0]?.status==="APPLIED"));
      applied(await send(a,farmA,[concurrent]));
      assert.equal(await count("sanitario_agenda_v2",concurrent.payload.agenda.id),1);
      const ledger=await db.query("select client_op_id,canonical_result from public.sanitario_sync_v2_operations where client_op_id=any($1::uuid[])",[[agendaA.client_op_id,concurrent.client_op_id]]);
      assert.equal(ledger.rowCount,2);
      return {replay_status:replay.status,concurrent_statuses:results.map(r=>r.data.results?.[0]?.status),ledger_rows:ledger.rowCount};
    });
    await check("Lote real heterogêneo: APPLIED, rejeição, dependência e conflito; replay preserva sucesso",async()=>{
      const good=creation(animalA),bad=creation(animalB);
      const missing=operation("reschedule_agenda",{agenda_id:randomUUID(),data_programada:"2026-11-02"},{expected_revision:0});
      const conflict=operation("reschedule_agenda",{agenda_id:agendaA.payload.agenda.id,data_programada:"2026-11-03"},{expected_revision:99});
      const batch=[good,bad,missing,conflict]; for(const op of batch)op.client_tx_id=good.client_tx_id;
      const first=await send(a,farmA,batch);assert.equal(first.http,200);
      const statuses=first.data.results.map(r=>r.status);
      assert.equal(statuses[0],"APPLIED");assert.equal(statuses[1],"REJECTED");
      assert.equal(statuses[2],"BLOCKED_DEPENDENCY");assert.equal(statuses[3],"CONFLICT");
      const receipt=(await db.query("select canonical_result from public.sanitario_sync_v2_operations where client_op_id=$1",[good.client_op_id])).rows[0];
      const again=await send(a,farmA,batch);assert.equal(again.data.results[0].status,"APPLIED");
      assert.deepEqual((await db.query("select canonical_result from public.sanitario_sync_v2_operations where client_op_id=$1",[good.client_op_id])).rows[0],receipt);
      assert.equal(await count("sanitario_agenda_v2",good.payload.agenda.id),1);
      applied(await send(a,farmA,[creation(animalA,missing.payload.agenda_id)]));
      applied(await send(a,farmA,[missing]));
      assert.equal((await db.query("select data_programada::text data_programada from public.sanitario_agenda_v2 where id=$1",[missing.payload.agenda_id])).rows[0].data_programada,"2026-11-02");
      assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[missing.client_op_id])).rows[0].n,1);
      return {statuses,reasons:first.data.results.map(r=>r.reason_code),success_receipt_preserved:true,dependency_supplied:true,dependent_retry:"APPLIED"};
    });
    await check("Raiva: três versões homologadas recusam criação automática no servidor",async()=>{
      const results=[];
      for(const item of items){const op=creation(animalA,randomUUID(),item,true);const response=await send(a,farmA,[op]);denied(response);assert.equal(await count("sanitario_agenda_v2",op.payload.agenda.id),0);results.push(response.data.results[0].reason_code);}
      const rows=(await db.query("select id,allows_agenda_auto,limitations from public.sanitario_protocolo_itens_versions_v2")).rows;
      assert(rows.every(i=>!i.allows_agenda_auto&&i.limitations.includes("no_agenda_auto")));
      return {reasons:results,items:rows};
    });
    await check("Indisponibilidade transitória real da RPC: cancelamento PostgreSQL retorna RETRYABLE e replay aplica uma vez",async()=>{
      const op=creation(animalA), key=`${farmA}:agenda:${op.payload.agenda.dedup_key}`;
      const lock=new pg.Client({connectionString:env.DB_URL});await lock.connect();
      let pending;
      try {
        await lock.query("select pg_advisory_lock(hashtextextended($1,0))",[key]);
        pending=send(a,farmA,[op]);
        let waiting=[];const deadline=Date.now()+12000;
        while(!waiting.length&&Date.now()<deadline){waiting=(await db.query("select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and wait_event='advisory'")).rows;if(!waiting.length)await new Promise(r=>setTimeout(r,100));}
        assert.equal(waiting.length,1,"Canonical RPC did not reach controlled lock");
        assert.equal((await db.query("select pg_cancel_backend($1) cancelled",[waiting[0].pid])).rows[0].cancelled,true);
        const cancelled=await pending;assert.equal(cancelled.data.results[0].status,"RETRYABLE",JSON.stringify(cancelled.data));
        assert.equal(await count("sanitario_agenda_v2",op.payload.agenda.id),0);
        await lock.query("select pg_advisory_unlock(hashtextextended($1,0))",[key]);
        applied(await send(a,farmA,[op]));assert.equal(await count("sanitario_agenda_v2",op.payload.agenda.id),1);
        return {cancelled_status:"RETRYABLE",after_retry:"APPLIED",rows:1};
      } finally {await lock.end();await pending?.catch(()=>{});}
    });
    await check("Fato sintético canônico: aceitação e replay não duplicam Evento ou detalhe",async()=>{
      const payload={schema:"sanitary_agenda_execution_v2",registration_mode:"executed_fact",prospective_authorization:false,creates_active_withdrawal:false,vf4:true};
      const op=operation("apply_factual_core",{event:{id:randomUUID(),natureza:"standalone_fact",occurred_at:new Date().toISOString(),client_recorded_at:new Date().toISOString(),animal_id:animalA,payload},
        detail:{tipo:"vacinacao",produto_nome_snapshot:"Produto sintético VF4 sem carência declarada",dose_quantidade:1,dose_unidade:"ml",via_aplicacao:"subcutanea",payload},
        event_animals:[{id:randomUUID(),animal_id:animalA}]});
      applied(await send(a,farmA,[op]));applied(await send(a,farmA,[op]));
      assert.equal(await count("eventos",op.payload.event.id),1);
      const details=await db.query("select count(*)::int n from public.eventos_sanitario where evento_id=$1",[op.payload.event.id]);assert.equal(details.rows[0].n,1);
      return {event_id:op.payload.event.id,events:1,details:1};
    });

    Object.assign(process.env,{VITE_SUPABASE_URL:env.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.ANON_KEY,VITE_SUPABASE_FUNCTIONS_URL:`${env.API_URL}/functions/v1`,VITE_BACKEND_ENV:"homologation"});
    vite=await createServer({server:{host:"127.0.0.1",port:8181,strictPort:true},logLevel:"error"});await vite.listen();
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext();contexts.push(context);
    await context.grantPermissions(["local-network-access"],{origin:"http://127.0.0.1:8181"});
    await restrictContextToLoopback(context);
    await context.route("http://127.0.0.1:8181/",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><html><body>VF4 servidor real</body></html>"}));
    let page=await context.newPage();await page.goto("http://127.0.0.1:8181/");
    await page.evaluate(async({email,password,farm})=>{
      const [{db},{supabase},cut,pull,worker,ownership,manage,plan,windows]=await Promise.all([
        import("/src/lib/offline/db.ts"),import("/src/lib/supabase.ts"),import("/src/lib/offline/sanitarioV2Cutover.ts"),
        import("/src/lib/offline/pull.ts"),import("/src/lib/offline/syncWorker.ts"),import("/src/lib/offline/ownership.ts"),
        import("/src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts"),import("/src/lib/sanitario/agenda/sanitaryAutomationPlanV2.ts"),import("/src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts")]);
      const login=await supabase.auth.signInWithPassword({email,password});if(login.error)throw Error("VF4_LOGIN_FAILED");
      await ownership.establishLocalOwnership(login.data.session);localStorage.setItem("gestao_agro_active_fazenda_id",farm);
      cut.setSanitarioV2PushEnabled(true,"local");await pull.pullDataForFarm(farm,["animais","fazenda_sanidade_config"],{mode:"merge"});
      await cut.applySanitarioV2Cutover(farm,pull.pullSanitarioV2CutoverState);
      window.vf4={db,supabase,worker,pull,manage,plan,windows};
    },{email:a.email,password:a.password,farm:farmA});
    const state=()=>page.evaluate(async()=>({ops:await window.vf4.db.queue_ops.toArray(),gestures:await window.vf4.db.queue_gestures.toArray(),agendas:await window.vf4.db.ops_sanitario_agenda_v2.toArray()}));
    const drain=()=>page.evaluate(async()=>{const{db,worker}=window.vf4;for(const g of await db.queue_gestures.toArray())if(g.status==="PENDING")await worker.processGesture(g);});
    const recover=()=>page.evaluate(()=>window.vf4.worker.recoverErroredGesturesOnce());
    const awaitReplay=async()=>{
      const deadline=Date.now()+45000;
      while(Date.now()<deadline){await recover();await drain();const current=await state();if(!current.ops.length)return current;
        const due=[...current.ops,...current.gestures].map(r=>Date.parse(r.next_attempt_at??"")).filter(Number.isFinite);
        await new Promise(r=>setTimeout(r,Math.min(1000,Math.max(100,Math.max(Date.now(),...due)-Date.now()))));}
      const current=await state();throw Error(`VF4_REPLAY_PENDING ${JSON.stringify({ops:current.ops.map(o=>({state:o.sync_state,reason:o.blocked_reason})),gestures:current.gestures.map(g=>({status:g.status,error:g.last_error}))})}`);
    };
    const reschedule=date=>page.evaluate(({farm,id,date})=>window.vf4.manage.rescheduleLocalSanitaryAgendaV2({fazendaId:farm,agendaId:id,plannedFor:date}),{farm:farmA,id:agendaA.payload.agenda.id,date});
    await check("ACK perdido após commit, timeout de transporte e reinício do cliente: fila converge sem reaplicar",async()=>{
      await reschedule("2026-11-04");const before=await state();assert.equal(before.ops.length,1);
      let committed=false;
      const fault=async route=>{const response=await route.fetch();assert.equal(response.status(),200);committed=true;await route.abort("timedout");};
      await context.route("**/functions/v1/sync-batch",fault);await drain();await context.unroute("**/functions/v1/sync-batch",fault);
      assert(committed);assert((await state()).ops.some(o=>o.client_op_id===before.ops[0].client_op_id));
      const remoteBefore=(await db.query("select revision from public.sanitario_agenda_v2 where id=$1",[agendaA.payload.agenda.id])).rows[0].revision;
      // Close the actual client page; a new page reopens the same context's IndexedDB.
      await page.close();page=await context.newPage();await page.goto("http://127.0.0.1:8181/");
      await page.evaluate(async()=>{const[{db},{supabase},worker,pull,manage]=await Promise.all([import("/src/lib/offline/db.ts"),import("/src/lib/supabase.ts"),import("/src/lib/offline/syncWorker.ts"),import("/src/lib/offline/pull.ts"),import("/src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts")]);window.vf4={db,supabase,worker,pull,manage};});
      assert.equal((await state()).ops[0].client_op_id,before.ops[0].client_op_id);
      await awaitReplay();await page.evaluate(farm=>window.vf4.pull.pullSanitarioV2CutoverState(farm),farmA);
      const after=await state();assert.equal(after.ops.length,0);assert(after.gestures.every(g=>g.status==="DONE"));
      assert.equal(String((await db.query("select revision from public.sanitario_agenda_v2 where id=$1",[agendaA.payload.agenda.id])).rows[0].revision),String(remoteBefore));
      assert.equal(after.agendas.find(a=>a.id===agendaA.payload.agenda.id).data_programada,"2026-11-04");
      const ledger=await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[before.ops[0].client_op_id]);assert.equal(ledger.rows[0].n,1);
      return {client_op_id:before.ops[0].client_op_id,commit_before_ack_loss:true,ledger_rows:1,remaining_ops:0,remote_revision:remoteBefore};
    });
    await check("Offline/reconnect e farm-switch mantêm fazenda da operação e convergem pelo worker real",async()=>{
      await reschedule("2026-11-05");await context.setOffline(true);const before=await state();assert.equal(before.ops.length,1);
      let waiting=false,release;const barrier=new Promise(r=>{release=r;});
      const lateAck=async route=>{const response=await route.fetch();assert.equal(response.status(),200);waiting=true;await barrier;await route.fulfill({response});};
      await context.route("**/functions/v1/sync-batch",lateAck);
      let inFlight;
      try {
        await context.setOffline(false);inFlight=drain();const deadline=Date.now()+20000;
        while(!waiting&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));assert(waiting,"Server ACK was not held");
        await page.evaluate(farm=>localStorage.setItem("gestao_agro_active_fazenda_id",farm),farmB);
        release();await inFlight;
      } finally {release();await context.unroute("**/functions/v1/sync-batch",lateAck);await inFlight?.catch(()=>{});}
      const after=await state();assert.equal(after.ops.length,0);
      const row=(await db.query("select fazenda_id,data_programada::text data_programada from public.sanitario_agenda_v2 where id=$1",[agendaA.payload.agenda.id])).rows[0];
      assert.equal(row.fazenda_id,farmA);assert.equal(row.data_programada,"2026-11-05");
      await page.evaluate(farm=>localStorage.setItem("gestao_agro_active_fazenda_id",farm),farmA);
      return {queued_farm:farmA,selected_farm_during_send:farmB,canonical_farm:row.fazenda_id,real_ack_held_during_switch:true};
    });
    await check("Logout real com operação pendente bloqueia envio; novo login recupera a mesma intenção",async()=>{
      await reschedule("2026-11-06");const before=await state();
      await page.evaluate(async()=>{const r=await window.vf4.supabase.auth.signOut();if(r.error)throw Error("VF4_LOGOUT_FAILED");});
      let sent=0;const observe=request=>{if(request.url().endsWith("/functions/v1/sync-batch"))sent++;};page.on("request",observe);
      await drain();assert.equal(sent,0);assert.equal((await state()).ops[0].client_op_id,before.ops[0].client_op_id);
      await page.evaluate(async({email,password})=>{const r=await window.vf4.supabase.auth.signInWithPassword({email,password});if(r.error)throw Error("VF4_RELOGIN_FAILED");const own=await import("/src/lib/offline/ownership.ts");await own.establishLocalOwnership(r.data.session);},{email:a.email,password:a.password});
      await recover();await drain();page.off("request",observe);assert.equal((await state()).ops.length,0);
      return {unauthenticated_batch_attempts:0,recovered_client_op_id:before.ops[0].client_op_id};
    });
    await check("JWT do cliente expira offline com fila pendente; reconnect usa refresh real e conserva identidade",async()=>{
      const expires=await page.evaluate(async()=>{const r=await window.vf4.supabase.auth.refreshSession();if(r.error)throw Error("VF4_REFRESH_FAILED");window.vf4.supabase.auth.stopAutoRefresh();return r.data.session.expires_at;});
      await reschedule("2026-11-07");await context.setOffline(true);const before=await state();assert.equal(before.ops.length,1);
      const deadline=expires*1000+1500;while(Date.now()<deadline)await new Promise(r=>setTimeout(r,Math.min(1000,deadline-Date.now())));
      let refreshes=0;const observe=request=>{const url=new URL(request.url());if(url.pathname.endsWith("/auth/v1/token")&&url.searchParams.get("grant_type")==="refresh_token")refreshes++;};page.on("request",observe);
      await context.setOffline(false);await awaitReplay();page.off("request",observe);assert(refreshes>=1,"No real refresh observed after expiry");
      const receipt=await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[before.ops[0].client_op_id]);assert.equal(receipt.rows[0].n,1);
      return {expired_before_reconnect:true,refresh_http_requests:refreshes,client_op_id:before.ops[0].client_op_id,receipt_rows:1,remaining_ops:0};
    });
    await check("JWT realmente expirado: HTTP rejeitado, refresh válido e refresh revogado recusado",async()=>{
      const deadline=a.expiresAt*1000+1500;while(Date.now()<deadline)await new Promise(r=>setTimeout(r,Math.min(1000,deadline-Date.now())));
      const op=creation(animalA);const expired=await send(null,farmA,[op],a.originalToken);assert.equal(expired.http,401);assert.equal(await count("sanitario_agenda_v2",op.payload.agenda.id),0);
      const valid=await b.client.auth.refreshSession();assert.ifError(valid.error);
      const refresh=outsider.originalRefresh;assert.ifError((await outsider.client.auth.signOut()).error);
      const revoked=await outsider.client.auth.refreshSession({refresh_token:refresh});assert(revoked.error);
      const anonymous=await send(null,farmA,[creation(animalA)]);assert.equal(anonymous.http,401);
      return {expired_http:expired.http,expired_write_count:0,valid_refresh:true,revoked_refresh_status:revoked.error.status,anonymous_http:anonymous.http};
    });
    await check("Invariantes finais e auditabilidade por operação",async()=>{
      const counts=(await db.query(`select (select count(*)::int from public.eventos) events,
        (select count(*)::int from public.eventos_sanitario) details,(select count(*)::int from public.insumo_movimentacoes) stock,
        (select count(*)::int from public.eventos_sanitario where carencia_carne_ate is not null or carencia_leite_ate is not null) withdrawals,
        (select count(*)::int from public.sanitario_sync_v2_operations) receipts`)).rows[0];
      assert.equal(counts.events,1);assert.equal(counts.details,1);assert.equal(counts.stock,0);assert.equal(counts.withdrawals,0);
      return counts;
    });
    report.result="PASS";
  } finally {
    for(const context of contexts)await context.close();await browser?.close();await vite?.close();
    await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=any($1::uuid[])",[[farmA,farmB]]);
    report.test_gates_disabled=(await db.query("select count(*)::int n from public.sanitario_sync_v2_gates where enabled")).rows[0].n===0;
  }
}
