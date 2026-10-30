// C06: canonical multi-operation queue + real owned Auth/Edge/Postgres.
// Faults abort real transport or IndexedDB transactions; no fabricated server results.
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { restrictContextToLoopback } from "./sanitary-disposable-support.fixture.mjs";

export async function runSanitaryHeterogeneousC06({ db, env, report, a, b, both, outsider, farmA, farmB, animalA, animalB, protocol, items }) {
  assert.equal(env.API_URL,"http://127.0.0.1:55421");
  let vite,browser,context,page;
  const item=items.find(row=>row.logical_item_key==="raiva_primovac_dose1");assert(item);
  report.environment.jwt_expiry_seconds=120;
  report.c06_contract={decision:"NOT_DETERMINED",scope:"sanitario_v2 create_agenda + reschedule_agenda in one canonical gesture"};
  const local=()=>page.evaluate(async()=>{
    const {db}=await import("/src/lib/offline/db.ts");
    return {gestures:await db.queue_gestures.toArray(),ops:await db.queue_ops.toArray(),
      rejections:await db.queue_rejections.toArray(),obligations:await db.sync_reconcile_obligations.toArray(),
      agendas:await db.ops_sanitario_agenda_v2.toArray(),animals:await db.ops_sanitario_agenda_animais_v2.toArray(),
      events:await db.event_eventos.count(),details:await db.event_eventos_sanitario.count(),stock:await db.state_insumo_movimentacoes.count()};
  });
  const remote=async()=>({
    agendas:(await db.query("select id,fazenda_id,revision,data_programada::text,execution_evento_id from public.sanitario_agenda_v2 order by id")).rows,
    animals:(await db.query("select agenda_id,fazenda_id,animal_id,execution_evento_id from public.sanitario_agenda_animais_v2 order by agenda_id,animal_id")).rows,
    receipts:(await db.query("select fazenda_id,entity_id,client_op_id,domain_op_id,operation_kind,canonical_result from public.sanitario_sync_v2_operations order by client_op_id")).rows,
    ...(await db.query(`select (select count(*)::int from public.eventos) events,
      (select count(*)::int from public.eventos_sanitario) details,(select count(*)::int from public.insumo_movimentacoes) stock`)).rows[0],
  });
  const snapshot=async()=>({local:await local(),postgres:await remote()});
  const check=async(name,run)=>{
    report.c06_step=name;const before=await snapshot();
    try{const evidence=await run(),after=await snapshot();
      for(const stores of [after.local,after.postgres])for(const key of ["events","details","stock"])assert.equal(stores[key],0);
      report.cases.push({name,status:"PROVEN",before,evidence,after});console.log(`PROVEN ${name}`);
    }catch(error){report.cases.push({name,status:"FAILED",before,after:await snapshot().catch(()=>null)});throw error;}
  };
  const boot=async(login=false)=>{
    await page.evaluate(async({login,email,password,farms})=>{
      const [{db},{supabase},cut,pull,ownership,worker]=await Promise.all([
        import("/src/lib/offline/db.ts"),import("/src/lib/supabase.ts"),import("/src/lib/offline/sanitarioV2Cutover.ts"),
        import("/src/lib/offline/pull.ts"),import("/src/lib/offline/ownership.ts"),import("/src/lib/offline/syncWorker.ts")]);
      if(login){const result=await supabase.auth.signInWithPassword({email,password});if(result.error)throw Error("C06_LOGIN_FAILED");await ownership.establishLocalOwnership(result.data.session);}
      cut.setSanitarioV2PushEnabled(true,"local");
      localStorage.setItem("gestao_agro_active_fazenda_id",farms[0]);
      if(login)for(const farm of farms){await pull.pullDataForFarm(farm,["animais","fazenda_sanidade_config"],{mode:"merge"});await cut.applySanitarioV2Cutover(farm,pull.pullSanitarioV2CutoverState);}
      window.c06={db,supabase,cut,pull,worker};
    },{login,email:both.email,password:both.password,farms:[farmA,farmB]});
  };
  // Use the production builders and validated transactional queue writer. Only the
  // grouping into one gesture is harness-specific; no queue rows are hand-written.
  const enqueue=(options={})=>page.evaluate(async({farm,animal,protocol,item,options})=>{
    const {db,cut}=window.c06;
    const [{buildManualSanitaryAgendaRecordsV2},{buildRescheduleAgendaV2},{getClientId}]=await Promise.all([
      import("/src/lib/sanitario/agenda/sanitaryManualAgendaV2.ts"),import("/src/lib/sanitario/agenda/sanitaryPlanningSyncV2.ts"),import("/src/lib/offline/ops.ts")]);
    const identity=cut.createSanitarioV2Identity(),clientId=getClientId();
    const records=buildManualSanitaryAgendaRecordsV2({clientOpId:identity.clientOpId,syncContext:{clientId,projectRef:"local"},
      target:{scope:"animal",id:options.badAnimal??animal,fazendaId:farm},confirmed:true,plannedFor:"2026-11-01",
      source:{kind:"sanitary_precheck_preview_v2",protocolId:protocol.id,protocolItemVersionId:item.id,actionType:"vacinacao",generationMode:"manual",
        familyCode:"raiva",itemKey:item.logical_item_key,itemLabel:"C06 manual",protocolName:protocol.nome??"Raiva",precheckStatus:"eligible"}});
    const create=cut.buildCreateAgendaOperation(identity,records.agenda,records.animals.map(row=>row.animal_id));
    const reschedule=buildRescheduleAgendaV2(farm,options.target??records.agenda.id,options.revision??0,"2026-11-02");
    reschedule.client_tx_id=identity.clientTxId;
    const operations=options.reverse?[reschedule,create]:[create,reschedule];
    await cut.validateSanitarioV2Enqueue({fazendaId:farm,clientId,projectRef:"local",operations});
    try{
      await db.transaction("rw",[db.queue_gestures,db.queue_ops,db.ops_sanitario_agenda_v2,db.ops_sanitario_agenda_animais_v2],async()=>{
        await db.ops_sanitario_agenda_v2.put({...records.agenda,client_tx_id:identity.clientTxId,client_id:clientId,contract_version:2,revision:0});
        await db.ops_sanitario_agenda_animais_v2.bulkPut(records.animals);
        await cut.writeSanitarioV2Queue({fazendaId:farm,clientId,operations});
        if(options.abortLocal)throw Error("C06_INJECTED_LOCAL_ABORT");
      });
    }catch(error){if(!options.abortLocal)throw error;return{tx:identity.clientTxId,id:records.agenda.id,operations,aborted:true};}
    return{tx:identity.clientTxId,id:records.agenda.id,operations};
  },{farm:options.farm??farmA,animal:options.animal??animalA,protocol,item,options});
  const processBatch=tx=>page.evaluate(async tx=>{const{db,worker}=window.c06;await worker.processGesture(await db.queue_gestures.get(tx));},tx);
  const drain=farm=>page.evaluate(farm=>window.c06.worker.drainReconciliationObligations(farm),farm);
  const replay=async tx=>{
    await expect.poll(async()=>{
      await page.evaluate(()=>window.c06.worker.recoverErroredGesturesOnce());await processBatch(tx);
      return (await local()).ops.filter(row=>row.client_tx_id===tx).length;
    },{timeout:45000,intervals:[300,600,1000]}).toBe(0);
    await drain(farmA);await drain(farmB);
  };
  const receiptCheck=async(batch,accepted)=>{
    const data=await remote();
    for(const op of batch.operations){const rows=data.receipts.filter(row=>row.client_op_id===op.client_op_id);
      assert.equal(rows.length,accepted.includes(op.client_op_id)?1:0);if(rows.length)assert.equal(rows[0].domain_op_id,op.domain_op_id);}
    return data.receipts.filter(row=>batch.operations.some(op=>op.client_op_id===row.client_op_id));
  };
  const origins=(state,batch)=>{
    const origin=state.obligations.flatMap(row=>row.diagnostics?.origins??[]).find(row=>row.client_tx_id===batch.tx);
    assert(origin);assert.deepEqual([...origin.client_op_ids].sort(),batch.operations.map(op=>op.client_op_id).sort());return origin;
  };
  try{
    Object.assign(process.env,{VITE_SUPABASE_URL:env.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.ANON_KEY,VITE_SUPABASE_FUNCTIONS_URL:`${env.API_URL}/functions/v1`,VITE_BACKEND_ENV:"homologation"});
    vite=await createServer({cacheDir:"scratch/c06-vite-cache",server:{host:"127.0.0.1",port:8181,strictPort:true},logLevel:"error"});await vite.listen();
    browser=await chromium.launch({headless:true});context=await browser.newContext();
    await context.grantPermissions(["local-network-access"],{origin:"http://127.0.0.1:8181"});await restrictContextToLoopback(context);
    await context.route("http://127.0.0.1:8181/",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><html><body>C06 local owned harness</body></html>"}));
    page=await context.newPage();await page.goto("http://127.0.0.1:8181/");await boot(true);
    let anchor;
    await check("01 integral: create + reschedule no mesmo gesto",async()=>{
      const batch=await enqueue();const persisted=await local();assert.equal(persisted.ops.filter(row=>row.client_tx_id===batch.tx).length,2);
      await processBatch(batch.tx);await drain(farmA);const after=await local();
      assert.equal(after.gestures.find(row=>row.client_tx_id===batch.tx).status,"DONE");
      const receipts=await receiptCheck(batch,batch.operations.map(op=>op.client_op_id));
      const row=(await remote()).agendas.find(row=>row.id===batch.id);assert.equal(row.data_programada,"2026-11-02");
      anchor=row;return{batch,persisted,receipts};
    });
    await check("02 rejeição por operação preserva irmã aplicada e rollback da RPC falha",async()=>{
      const batch=await enqueue({badAnimal:animalB,target:anchor.id,revision:Number(anchor.revision),reverse:true});
      await processBatch(batch.tx);await drain(farmA);const after=await local(),gesture=after.gestures.find(row=>row.client_tx_id===batch.tx);
      assert.equal(gesture.status,"REJECTED");assert.equal(gesture.operation_results.filter(row=>row.status==="APPLIED").length,1);
      const rejected=batch.operations.find(op=>op.command==="create_agenda"),accepted=batch.operations.find(op=>op.command==="reschedule_agenda");
      assert(after.rejections.some(row=>row.client_op_id===rejected.client_op_id));
      assert(!(await remote()).agendas.some(row=>row.id===batch.id));
      const receipts=await receiptCheck(batch,[accepted.client_op_id]);
      report.c06_contract.decision="PARTIAL_PER_OPERATION";return{batch,receipts,rejection:after.rejections.find(row=>row.client_op_id===rejected.client_op_id),gesture};
    });
    await check("03 retry após falha de transporte antes do commit",async()=>{
      const batch=await enqueue();const before=await remote();
      const fault=route=>route.abort("timedout");await context.route("**/functions/v1/sync-batch",fault);
      try{await processBatch(batch.tx);}finally{await context.unroute("**/functions/v1/sync-batch",fault);}
      const pending=await snapshot();assert.deepEqual(pending.postgres,before);
      assert.equal(pending.local.ops.filter(row=>row.client_tx_id===batch.tx).length,2);
      await replay(batch.tx);return{batch,pending,receipts:await receiptCheck(batch,batch.operations.map(op=>op.client_op_id))};
    });
    await check("04 lost ACK após commit integral + reload lógico conserva identidades",async()=>{
      const batch=await enqueue();let committed;
      const fault=async route=>{const response=await route.fetch();committed=await response.json();await route.abort("timedout");};
      await context.route("**/functions/v1/sync-batch",fault);
      try{await processBatch(batch.tx);}finally{await context.unroute("**/functions/v1/sync-batch",fault);}
      assert(committed.results.every(row=>row.status==="APPLIED"));const pending=await snapshot();
      assert.equal(pending.local.ops.filter(row=>row.client_tx_id===batch.tx).length,2);
      await page.reload();await boot();await replay(batch.tx);
      assert.deepEqual((await remote()).agendas,pending.postgres.agendas);
      return{batch,committed,pending,receipts:await receiptCheck(batch,batch.operations.map(op=>op.client_op_id)),restart:"page reload, same IndexedDB"};
    });
    await check("05 ACK local transacional falha: fila durável sobrevive e replay converge",async()=>{
      const batch=await enqueue();
      await page.evaluate(()=>{window.c06.failAck=()=>{throw Error("C06_ACK_TRANSACTION_ABORT");};window.c06.db.queue_ops.hook("deleting",window.c06.failAck);});
      try{await processBatch(batch.tx);}finally{await page.evaluate(()=>window.c06.db.queue_ops.hook("deleting").unsubscribe(window.c06.failAck));}
      const pending=await snapshot();assert.equal(pending.local.ops.filter(row=>row.client_tx_id===batch.tx).length,2);
      assert.equal(pending.postgres.receipts.filter(row=>batch.operations.some(op=>op.client_op_id===row.client_op_id)).length,2);
      await page.reload();await boot();await replay(batch.tx);assert.deepEqual((await remote()).agendas,pending.postgres.agendas);
      return{batch,pending,receipts:await receiptCheck(batch,batch.operations.map(op=>op.client_op_id))};
    });
    await check("06 pull falha após ACK: obrigação durável com ambas origens + restart",async()=>{
      const batch=await enqueue();
      const fault=route=>route.abort("failed");await context.route("**/rest/v1/sanitario_agenda_v2?*",fault);
      let pending;
      try{await processBatch(batch.tx);pending=await snapshot();}finally{await context.unroute("**/rest/v1/sanitario_agenda_v2?*",fault);}
      assert.equal(pending.local.ops.filter(row=>row.client_tx_id===batch.tx).length,0);const origin=origins(pending.local,batch);
      await page.reload();await boot();await drain(farmA);assert.equal((await local()).obligations.length,0);
      assert((await local()).agendas.some(row=>row.id===batch.id&&row.data_programada==="2026-11-02"));
      return{batch,pending,origin,receipts:await receiptCheck(batch,batch.operations.map(op=>op.client_op_id))};
    });
    await check("07 farm-switch e RLS: pendências e obrigações permanecem na fazenda de origem",async()=>{
      const batchA=await enqueue(),batchB=await enqueue({farm:farmB,animal:animalB});
      const fault=route=>route.abort("failed");await context.route("**/rest/v1/sanitario_agenda_v2?*",fault);
      let pending;
      try{await page.evaluate(farm=>localStorage.setItem("gestao_agro_active_fazenda_id",farm),farmB);await processBatch(batchB.tx);pending=await snapshot();}
      finally{await context.unroute("**/rest/v1/sanitario_agenda_v2?*",fault);}
      const origin=origins(pending.local,batchB);assert(pending.local.ops.some(op=>op.client_tx_id===batchA.tx));
      await drain(farmA);assert((await local()).obligations.some(row=>row.fazenda_id===farmB));
      await drain(farmB);await processBatch(batchA.tx);await drain(farmA);
      const matrix=[];for(const [actor,farms]of [[a,[farmA]],[b,[farmB]],[outsider,[]]]){
        const result=await actor.client.from("sanitario_agenda_v2").select("id,fazenda_id");assert.ifError(result.error);
        assert(result.data.every(row=>farms.includes(row.fazenda_id)));if(!farms.length)assert.equal(result.data.length,0);
        matrix.push({actor:actor===a?"A":actor===b?"B":"outsider",rows:result.data.length,farms:[...new Set(result.data.map(row=>row.fazenda_id))]});
      }
      for(const batch of [batchA,batchB])await receiptCheck(batch,batch.operations.map(op=>op.client_op_id));
      return{batchA,batchB,pending,origin,matrix};
    });
    await check("08 gate OFF rejeita todas operações sem fabricar sucesso",async()=>{
      const batch=await enqueue();await db.query("update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1",[farmA]);
      try{await processBatch(batch.tx);await drain(farmA);}finally{await db.query("update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1",[farmA]);}
      const after=await local(),gesture=after.gestures.find(row=>row.client_tx_id===batch.tx);assert.equal(gesture.status,"REJECTED");
      for(const op of batch.operations)assert(after.rejections.some(row=>row.client_op_id===op.client_op_id&&row.reason_code==="SANITARIO_SYNC_DISABLED"));
      return{batch,gesture,receipts:await receiptCheck(batch,[])};
    });
    await check("09 falha da transação local desfaz gesto, operações e projeções juntas",async()=>{
      const before=await snapshot(),batch=await enqueue({abortLocal:true});assert(batch.aborted);
      assert.deepEqual(await snapshot(),before);return{batch,local_atomicity:"rollback complete before any HTTP send"};
    });
    const final=await snapshot();assert.equal(final.local.ops.length,0);assert.equal(final.local.obligations.length,0);
    report.c06_final=final;report.c06_status="READY_FOR_REVIEW";
  }catch(error){
    report.c06_failure_stack=String(error.stack).replace(/https?:\/\/\S+|eyJ[\w.-]+|sb_(?:secret|publishable)_[\w-]+/g,"[REDACTED]").slice(0,3500);
    throw error;
  }finally{
    if(page&&!page.isClosed())report.local_test_flag_disabled=await page.evaluate(()=>{window.c06.cut.setSanitarioV2PushEnabled(false,"local");return !window.c06.cut.isSanitarioV2PushEnabled("local");}).catch(()=>false);
    await context?.close();await browser?.close();await vite?.close();report.browser_closed=true;
  }
}
