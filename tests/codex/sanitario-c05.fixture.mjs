// C05 composes the real provider, product UI, local writers, worker and owned backend.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { restrictContextToLoopback } from "./sanitary-disposable-support.fixture.mjs";

export async function runSanitaryAuthCompositionC05({ db, env, report, both, outsider, farmA, farmB, animalA, protocol, items }) {
  let vite, browser, context, page, lastBatch;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const secondAnimal=randomUUID();
  await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo,data_nascimento,especie) values($1,$2,'C05 segundo animal','F','2023-01-01','bovino')",[secondAnimal,farmA]);
  await db.query("update public.user_fazendas set role='manager' where user_id=$1 and fazenda_id=$2", [both.id,farmB]);
  await db.query("insert into public.user_settings(user_id,active_fazenda_id) values($1,$2) on conflict(user_id) do update set active_fazenda_id=excluded.active_fazenda_id",[both.id,farmA]);
  report.migrations = (await db.query("select version from supabase_migrations.schema_migrations order by version")).rows.map(row=>row.version);
  report.environment.real.push("AuthProvider", "ProtocolosSanitarios UI");
  report.environment.jwt_expiry_seconds=120;
  const local = () => page.evaluate(async()=>{
    const { db }=await import("/src/lib/offline/db.ts");
    return { agendas:await db.ops_sanitario_agenda_v2.toArray(), animals:await db.ops_sanitario_agenda_animais_v2.toArray(),
      ops:await db.queue_ops.toArray(),gestures:await db.queue_gestures.toArray(),
      rejections:await db.queue_rejections.toArray(),reconcile:await db.sync_reconcile_obligations.toArray(),
      events:await db.event_eventos.count(),details:await db.event_eventos_sanitario.count(),stock:await db.state_insumo_movimentacoes.count() };
  });
  const remote = async()=> ({...(await db.query(`select
    (select count(*)::int from public.sanitario_agenda_v2) agendas,
    (select count(*)::int from public.sanitario_agenda_animais_v2) animals,
    (select count(*)::int from public.sanitario_sync_v2_operations) receipts,
    (select count(*)::int from public.eventos) events,
    (select count(*)::int from public.eventos_sanitario) details,
    (select count(*)::int from public.insumo_movimentacoes) stock`)).rows[0],
    rows:(await db.query("select id,fazenda_id,revision,data_programada::text,execution_evento_id from public.sanitario_agenda_v2 order by id")).rows,
    ledger:(await db.query("select client_op_id,canonical_result from public.sanitario_sync_v2_operations order by client_op_id")).rows,
  });
  const observe = async()=>({
    ui:{user:await page.getByLabel("Identidade C05",{exact:true}).textContent(),farm:await page.getByLabel("Fazenda C05",{exact:true}).textContent(),role:await page.getByLabel("Papel C05",{exact:true}).textContent()},
    local:await local(),postgres:await remote(),
  });
  const check = async(name,run)=>{
    report.c05_step=name;
    const before=await observe();
    try {
      const evidence=await run(); const stores=await observe();
      assert.equal(stores.local.events,0);assert.equal(stores.local.details,0);assert.equal(stores.local.stock,0);
      assert.equal(stores.postgres.events,0);assert.equal(stores.postgres.details,0);assert.equal(stores.postgres.stock,0);
      // Deliberately retain IDs, revisions and statuses, never session/token objects.
      report.cases.push({name,status:"PROVEN",evidence,before,stores});console.log(`PROVEN ${name}`);
    } catch(error) {report.cases.push({name,status:"FAILED",reason:"C05_ASSERTION_OR_ENVIRONMENT_FAILURE",before,stores:await observe().catch(()=>null)});throw error;}
  };
  const drain = () => page.evaluate(async farm=>{
    const [{db},worker]=await Promise.all([import("/src/lib/offline/db.ts"),import("/src/lib/offline/syncWorker.ts")]);
    for(const gesture of await db.queue_gestures.toArray())if(gesture.status==="PENDING")await worker.processGesture(gesture);
    for(const obligation of await db.sync_reconcile_obligations.toArray())for(const origin of obligation.diagnostics?.origins??[]) {
      if(!origin.client_op_ids.length||origin.client_op_ids.some(id=>typeof id!=="string"||!id))throw Error("C05_RECONCILIATION_ORIGIN_MISSING");
    }
    await worker.drainReconciliationObligations(farm);
  },farmA);
  const replay = async()=>{
    const deadline=Date.now()+45000;
    while(Date.now()<deadline){await page.evaluate(async()=>{const worker=await import("/src/lib/offline/syncWorker.ts");await worker.recoverErroredGesturesOnce();});await drain();if(!(await local()).ops.length)return;await sleep(500);}
    throw Error("C05_QUEUE_DID_NOT_CONVERGE");
  };
  const selectFarm = async farm=>{
    await page.evaluate(farm=>window.c05Auth.setActiveFarm(farm),farm);
    await expect(page.getByLabel("Fazenda C05",{exact:true})).toHaveText(farm);
    await expect(page.getByLabel("Loading C05",{exact:true})).toHaveText("false");
  };
  const reschedule = date=> page.evaluate(async({farm,date})=>{
    const [{db},manage]=await Promise.all([import("/src/lib/offline/db.ts"),import("/src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts")]);
    const row=(await db.ops_sanitario_agenda_v2.toArray()).find(row=>row.fazenda_id===farm);
    await manage.rescheduleLocalSanitaryAgendaV2({fazendaId:farm,agendaId:row.id,plannedFor:date});
  },{farm:farmA,date});
  try {
    Object.assign(process.env,{VITE_SUPABASE_URL:env.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.ANON_KEY,VITE_SUPABASE_FUNCTIONS_URL:`${env.API_URL}/functions/v1`,VITE_BACKEND_ENV:"homologation"});
    vite=await createServer({cacheDir:"scratch/c05-vite-cache",server:{host:"127.0.0.1",port:8181,strictPort:true},logLevel:"error"});await vite.listen();
    browser=await chromium.launch({headless:true});context=await browser.newContext();
    await context.grantPermissions(["local-network-access"],{origin:"http://127.0.0.1:8181"});
    await restrictContextToLoopback(context);
    // Serve the real local HTML shell for client-side routes, without replacing API responses.
    await context.route("http://127.0.0.1:8181/**",async route=>{
      if(!route.request().isNavigationRequest())return route.fallback();
      const response=await route.fetch({url:"http://127.0.0.1:8181/e2e/fixtures/sanitary-auth-real.html"});
      await route.fulfill({response});
    });
    page=await context.newPage();
    page.setDefaultTimeout(15000);
    report.browser_errors=[];
    report.browser_http_counts={};
    page.on("pageerror",error=>report.browser_errors.push(error.message.replace(/https?:\/\/\S+|eyJ[\w.-]+/g,"[REDACTED]")));
    page.on("request",request=>{
      const url=new URL(request.url());
      if(url.port==="55421")report.browser_http_counts[url.pathname]=(report.browser_http_counts[url.pathname]??0)+1;
      if(request.url().endsWith("/functions/v1/sync-batch")&&request.method()==="POST")lastBatch=request.postDataJSON();
    });
    await page.goto("http://127.0.0.1:8181/",{waitUntil:"commit"});
    // Cold Vite/PostCSS compilation in a fresh worktree can exceed 30s on Windows.
    // This is a shell readiness budget, not a timeout change for Auth/RPC/sync.
    await expect(page.getByLabel("Identidade C05",{exact:true})).toHaveText("none",{timeout:90000});
    console.log("C05 real provider mounted without session");
    await page.evaluate(async({email,password})=>{const{ supabase }=await import("/src/lib/supabase.ts");const result=await supabase.auth.signInWithPassword({email,password});if(result.error)throw Error("C05_REAL_LOGIN_FAILED");},{email:both.email,password:both.password});
    await expect(page.getByLabel("Identidade C05",{exact:true})).toHaveText(both.id);
    await expect(page.getByLabel("Loading C05",{exact:true})).toHaveText("false");
    console.log("C05 real browser login established");
    await page.evaluate(async farms=>{
      const pull=await import("/src/lib/offline/pull.ts"),cut=await import("/src/lib/offline/sanitarioV2Cutover.ts");
      cut.setSanitarioV2PushEnabled(true,"local");
      await pull.pullSanitarioProtocolCatalogV2();
      for(const farm of farms){await pull.pullDataForFarm(farm,["animais","fazenda_sanidade_config"],{mode:"merge"});await cut.applySanitarioV2Cutover(farm,pull.pullSanitarioV2CutoverState);}
    },[farmA,farmB]);
    await page.goto("http://127.0.0.1:8181/protocolos-sanitarios",{waitUntil:"commit"});
    await expect(page.getByRole("heading",{name:"Central Sanitária",exact:true})).toBeVisible({timeout:30000});
    await check("Sessão válida: provider → planejamento UI → fila → Edge → reconciliação",async()=>{
      await expect(page.getByRole("heading",{name:"Central Sanitária",exact:true})).toBeVisible();
      await expect(page.getByLabel("Papel C05",{exact:true})).toHaveText("owner");
      const item=items.find(item=>item.logical_item_key==="raiva_primovac_dose1");assert(item);
      await page.getByLabel("Selecionar protocolo",{exact:true}).selectOption(protocol.id);
      await page.getByLabel("Selecionar item do protocolo",{exact:true}).selectOption(item.id);
      await page.getByLabel("Selecionar VF4 animal",{exact:true}).check();
      await page.getByRole("button",{name:"Planejar agenda para selecionados",exact:true}).click();
      await page.getByRole("button",{name:"Confirmar e gerar Agenda",exact:true}).click();
      await expect.poll(async()=>(await local()).ops.length).toBe(1);
      const pending=await local();assert.equal(pending.agendas.length,1);assert.equal(pending.animals[0].animal_id,animalA);
      assert.equal(pending.agendas[0].execution_evento_id,null);assert.equal(pending.gestures[0].fazenda_id,farmA);assert.equal(pending.ops[0].record.fazenda_id,farmA);
      await drain();assert.equal((await local()).ops.length,0);assert.equal((await remote()).agendas,1);
      return {user:both.id,farm:farmA,client_op_id:pending.ops[0].client_op_id,queue_before:1,queue_after:0};
    });
    await check("Farm-switch A→B: settings e papel reais tardios não contaminam B",async()=>{
      for(const table of ["user_settings","user_fazendas"]){
        await selectFarm(farmA);let held=false,release;const barrier=new Promise(resolve=>{release=resolve;});
        const pattern=`**/rest/v1/${table}?*`;
        const handler=async route=>{
          const url=new URL(route.request().url());
          if(held||route.request().method()!=="GET"||(table==="user_fazendas"&&url.searchParams.get("fazenda_id")!==`eq.${farmA}`))return route.fallback();
          const response=await route.fetch();held=true;await barrier;await route.fulfill({response});
        };
        await context.route(pattern,handler);
        const pending=page.evaluate(async({table,user,farm})=>{if(table==="user_settings")await window.c05Auth.refreshSettings();else await window.c05Auth.loadRoleForFarm(user,farm);},{table,user:both.id,farm:farmA});
        try {await expect.poll(()=>held,{timeout:15000}).toBe(true);await selectFarm(farmB);release();await pending;
          await expect(page.getByLabel("Fazenda C05",{exact:true})).toHaveText(farmB);
          await expect(page.getByLabel("Papel C05",{exact:true})).toHaveText("manager");
        } finally {release();await context.unroute(pattern,handler);await pending.catch(()=>{});}
      }
      const settings=(await db.query("select active_fazenda_id from public.user_settings where user_id=$1",[both.id])).rows[0];assert.equal(settings.active_fazenda_id,farmB);
      await selectFarm(farmA);return{late_responses:["user_settings","user_fazendas"],B_role:"manager",remote_settings:farmB};
    });
    await check("Lost ACK após commit: reinício da página conserva UUID e revisão",async()=>{
      await reschedule("2026-11-04");const before=await local();assert.equal(before.ops.length,1);
      let committed=false;const fault=async route=>{const response=await route.fetch();assert.equal(response.status(),200);committed=true;await route.abort("timedout");};
      await context.route("**/functions/v1/sync-batch",fault);
      try {await drain();}finally{await context.unroute("**/functions/v1/sync-batch",fault);}
      assert(committed);assert.equal((await local()).ops[0].client_op_id,before.ops[0].client_op_id);
      const id=before.agendas[0].id;const revision=(await db.query("select revision from public.sanitario_agenda_v2 where id=$1",[id])).rows[0].revision;
      await page.reload();await expect(page.getByLabel("Loading C05",{exact:true})).toHaveText("false");await replay();
      assert.equal(String((await db.query("select revision from public.sanitario_agenda_v2 where id=$1",[id])).rows[0].revision),String(revision));
      assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[before.ops[0].client_op_id])).rows[0].n,1);
      return {client_op_id:before.ops[0].client_op_id,remote_revision:revision,receipt_rows:1,page_reloaded:true};
    });
    await check("Sessão ausente: provider bloqueia UI e envio e preserva pendência",async()=>{
      await reschedule("2026-11-05");const before=await local();
      await page.evaluate(async()=>{const{ supabase }=await import("/src/lib/supabase.ts");await supabase.auth.signOut();});
      await expect(page.getByLabel("Identidade C05",{exact:true})).toHaveText("none");
      await expect(page.getByRole("heading",{name:"Central Sanitária",exact:true})).toHaveCount(0);
      let requests=0;const observe=req=>{if(req.url().endsWith("/functions/v1/sync-batch"))requests++;};page.on("request",observe);
      try{await drain();}finally{page.off("request",observe);}
      assert.equal(requests,0);assert.equal((await local()).ops[0].client_op_id,before.ops[0].client_op_id);
      await page.evaluate(async({email,password})=>{const{ supabase }=await import("/src/lib/supabase.ts");const r=await supabase.auth.signInWithPassword({email,password});if(r.error)throw Error("C05_RELOGIN_FAILED");},{email:both.email,password:both.password});
      await expect(page.getByLabel("Identidade C05",{exact:true})).toHaveText(both.id);await selectFarm(farmA);await replay();
      return {unauthenticated_requests:0,preserved_op:before.ops[0].client_op_id,recovered:true};
    });
    await check("Expiração offline, reconnect e refresh real recuperam uma intenção",async()=>{
      const expires=await page.evaluate(async()=>{const{ supabase }=await import("/src/lib/supabase.ts");const r=await supabase.auth.refreshSession();if(r.error)throw Error("C05_REFRESH_FAILED");supabase.auth.stopAutoRefresh();return r.data.session.expires_at;});
      await reschedule("2026-11-06");const before=await local();await context.setOffline(true);
      while(Date.now()<expires*1000+1500)await sleep(Math.min(1000,expires*1000+1500-Date.now()));
      assert.equal((await remote()).receipts,3);assert.equal((await local()).ops[0].client_op_id,before.ops[0].client_op_id);
      const expired=await fetch(`${env.API_URL}/functions/v1/sync-batch`,{method:"POST",headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${both.originalToken}`,"Content-Type":"application/json"},body:JSON.stringify({...lastBatch,client_tx_id:before.ops[0].client_tx_id,ops:[before.ops[0].record]})});
      assert.equal(expired.status,401);assert.equal((await remote()).receipts,3);
      let refreshes=0;const observe=req=>{const u=new URL(req.url());if(u.pathname.endsWith("/auth/v1/token")&&u.searchParams.get("grant_type")==="refresh_token")refreshes++;};page.on("request",observe);
      try{await context.setOffline(false);await replay();}finally{page.off("request",observe);}
      assert(refreshes>0);await expect(page.getByLabel("Identidade C05",{exact:true})).toHaveText(both.id);
      assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[before.ops[0].client_op_id])).rows[0].n,1);
      return {expired_offline:true,expired_http:expired.status,refresh_requests:refreshes,client_op_id:before.ops[0].client_op_id,receipt_rows:1};
    });
    await check("Usuário sem permissão: RLS e Edge rejeitam envelope válido na fazenda A",async()=>{
      const read=await outsider.client.from("sanitario_agenda_v2").select("id");assert.ifError(read.error);assert.equal(read.data.length,0);
      const send=async actor=>{
        // The earlier global signOut revoked the original Node session of `both`.
        // Use the current real browser session for the authorized control, in memory only.
        const token=actor===both ? await page.evaluate(async()=>{const{ supabase }=await import("/src/lib/supabase.ts");return (await supabase.auth.getSession()).data.session?.access_token;})
          : (await actor.client.auth.getSession()).data.session?.access_token;
        assert(token);
        const response=await fetch(`${env.API_URL}/functions/v1/sync-batch`,{method:"POST",headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(lastBatch)});
        return {http:response.status,data:await response.json()};
      };
      assert(lastBatch);const control=await send(both);assert.equal(control.http,200);assert.equal(control.data.results[0].status,"APPLIED");
      const denied=await send(outsider);assert.equal(denied.http,403);assert.equal(denied.data.error,"Forbidden - no access to this farm");
      return {rls_visible_rows:0,control_http:200,outsider_http:403,layer:"direct negative HTTP probe with envelope captured from real worker; no outsider UI claim"};
    });
    await check("Sucesso parcial da fila e gate OFF: primeiro gesto aplicado, segundo rejeitado",async()=>{
      await reschedule("2026-11-07");const first=(await local()).ops[0];
      const created=await page.evaluate(async({farm,animal,protocol,item,actor})=>{
        const windows=await import("/src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts");
        const source=await windows.loadSanitaryProtocolWindowSourceV2(farm);
        const result=windows.buildSanitaryProtocolWindowV2({source,protocolId:protocol,itemId:item,evaluatedAt:new Date().toISOString().slice(0,10),generationMode:"manual"});
        const rows=result.rows.filter(row=>row.animalId===animal);if(rows.length!==1||!rows[0].canSelect)throw Error("C05_SECOND_TARGET_NOT_PLANNABLE");
        return windows.createGroupedManualSanitaryAgendasV2({fazendaId:farm,rows,plannedFor:"2026-11-08",confirmed:true,generationMode:"manual",createdBy:actor});
      },{farm:farmA,animal:secondAnimal,protocol:protocol.id,item:items.find(item=>item.logical_item_key==="raiva_primovac_dose1").id,actor:both.id});
      const before=await local();assert.equal(before.ops.length,2);
      await page.evaluate(async tx=>{const[{db},worker]=await Promise.all([import("/src/lib/offline/db.ts"),import("/src/lib/offline/syncWorker.ts")]);await worker.processGesture(await db.queue_gestures.get(tx));},first.client_tx_id);
      assert.equal((await local()).ops.length,1);
      await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1",[farmA]);
      const rejected=before.ops.find(op=>op.client_op_id!==first.client_op_id);assert(rejected);
      await drain();const after=await local();assert.equal(after.ops.length,0);
      assert(after.rejections.some(row=>row.client_op_id===rejected.client_op_id&&row.reason_code==="SANITARIO_SYNC_DISABLED"));
      assert.equal((await db.query("select count(*)::int n from public.sanitario_agenda_v2 where id=$1",[created[0].agendaId])).rows[0].n,0);
      const row=(await db.query("select data_programada::text date from public.sanitario_agenda_v2 where id=$1",[before.agendas.find(row=>row.id!==created[0].agendaId).id])).rows[0];assert.equal(row.date,"2026-11-07");
      assert(after.gestures.some(gesture=>gesture.client_tx_id===rejected.client_tx_id&&gesture.status==="REJECTED"));
      assert.equal(after.reconcile.length,0);
      return {applied_op:first.client_op_id,rejected_op:rejected.client_op_id,remote_date:row.date,scope:"partial success across two canonical gestures; heterogeneous single-batch certification remains outside this case",remaining_ops:0,rejection_retained:true,reconciliation_remaining:0};
    });
  } catch(error) {
    if(page&&!page.isClosed())report.browser_body=(await page.locator("body").innerText({timeout:3000}).catch(()=>"unavailable")).slice(0,2500);
    throw error;
  } finally {
    if(page&&!page.isClosed())report.local_test_flag_disabled=await page.evaluate(async()=>{const cut=await import("/src/lib/offline/sanitarioV2Cutover.ts");cut.setSanitarioV2PushEnabled(false,"local");return !cut.isSanitarioV2PushEnabled("local");}).catch(()=>false);
    await context?.close();await browser?.close();await vite?.close();
  }
}
