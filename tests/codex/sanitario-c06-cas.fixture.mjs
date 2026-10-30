// Extends the C06 harness: same builders, queue writer, browser and real backend.
import assert from "node:assert/strict";

export async function runSanitaryCasCasesC06(h) {
  const {report,a,b,outsider,farmA,farmB,animalB,page,context,boot,enqueue,processBatch,drain,replay,receiptCheck,origins,local,remote,snapshot,check}=h;
  report.c06_contract={decision:"PARTIAL_PER_OPERATION",scope:"ordered create/reschedule with explicit expected_revision; receipt lookup precedes CAS",
    dynamic_result_reference:{status:"NOT_APPLICABLE",reason:"canonical envelope has no result-reference/dependency expression; revisions and target UUIDs must be explicit"}};
  report.c06_cas_blocked_ids=[];
  report.c06_cas_http=[];
  page.on("response",response=>{
    if(response.url().endsWith("/functions/v1/sync-batch"))report.c06_cas_http.push({tx:response.request().postDataJSON().client_tx_id,http:response.status()});
  });
  const gesture=async batch=>(await local()).gestures.find(row=>row.client_tx_id===batch.tx);
  const row=async id=>(await remote()).agendas.find(entry=>entry.id===id);
  const accepted=batch=>batch.operations.map(op=>op.client_op_id);
  const outcomes=async batch=>{
    const g=await gesture(batch);assert(g);
    for(const op of batch.operations){const result=g.operation_results.find(r=>r.op_id===op.client_op_id);assert(result?.matched);assert.equal(result.domain_op_id,op.domain_op_id);}
    assert(report.c06_cas_http.some(entry=>entry.tx===batch.tx&&entry.http===200));return g;
  };
  let anchor;
  await check("CAS01 dependência estática válida: criar, reagendar rev0, reagendar rev1",async()=>{
    const batch=await enqueue({chain:true});await processBatch(batch.tx);await drain(farmA);
    const g=await outcomes(batch);assert.equal(g.status,"DONE");assert(g.operation_results.every(r=>r.status==="APPLIED"));
    anchor=await row(batch.id);assert.equal(Number(anchor.revision),2);assert.equal(anchor.data_programada,"2026-11-03");
    return{batch,gesture:g,anchor,receipts:await receiptCheck(batch,accepted(batch))};
  });
  await check("CAS02 dependência rejeitada não cria efeito órfão",async()=>{
    const batch=await enqueue({badAnimal:animalB,chain:true});await processBatch(batch.tx);await drain(farmA);
    const g=await outcomes(batch);assert.equal(g.status,"REJECTED");assert.equal(g.operation_results.filter(r=>r.status==="REJECTED").length,1);
    assert.equal(g.operation_results.filter(r=>r.status==="BLOCKED_DEPENDENCY").length,2);assert.equal(await row(batch.id),undefined);
    const state=await local();for(const op of batch.operations)assert(state.rejections.some(r=>r.client_op_id===op.client_op_id&&r.fazenda_id===farmA));
    assert.equal(state.ops.filter(op=>op.client_tx_id===batch.tx).length,0);
    await drain(farmA);assert.equal((await local()).ops.filter(op=>op.client_tx_id===batch.tx).length,0);
    assert(!(await remote()).animals.some(r=>r.agenda_id===batch.id));return{batch,gesture:g,receipts:await receiptCheck(batch,[])};
  });
  await check("CAS03 CAS obsoleto preserva criação anterior e revisão do alvo",async()=>{
    const before=await row(anchor.id),batch=await enqueue({target:anchor.id,revision:0});await processBatch(batch.tx);await drain(farmA);
    const g=await outcomes(batch),conflict=g.operation_results.find(r=>r.status==="CONFLICT");assert(conflict);assert.equal(Number(conflict.current_revision),2);
    assert.equal(conflict.reason_code,"SANITARIO_AGENDA_REVISION_CONFLICT");assert.equal(g.status,"REJECTED");assert.deepEqual(await row(anchor.id),before);
    assert(await row(batch.id));const state=await local();assert(state.rejections.some(r=>r.client_op_id===conflict.op_id&&r.result_status==="CONFLICT"));
    const acceptedOp=batch.operations.find(op=>op.command==="create_agenda");return{batch,gesture:g,conflict,receipts:await receiptCheck(batch,[acceptedOp.client_op_id])};
  });
  let raced,loser;
  await check("CAS04 concorrência: um vencedor por revisão server-authoritative",async()=>{
    const before=await row(anchor.id);
    const left=await enqueue({target:anchor.id,revision:Number(before.revision),plannedFor:"2026-11-12"});
    const right=await enqueue({target:anchor.id,revision:Number(before.revision),plannedFor:"2026-11-13"});
    await Promise.all([processBatch(left.tx),processBatch(right.tx)]);await drain(farmA);
    const gestures=await Promise.all([outcomes(left),outcomes(right)]),all=gestures.flatMap(g=>g.operation_results);
    assert.equal(all.filter(r=>r.status==="APPLIED").length,3);assert.equal(all.filter(r=>r.status==="CONFLICT").length,1);
    const winner=all.find(r=>r.status==="APPLIED"&&r.canonical_result?.command==="reschedule_agenda");
    // Server receipt determines the winner; client completion order is irrelevant.
    const data=await remote(),receipts=data.receipts.filter(r=>[...left.operations,...right.operations].some(op=>op.client_op_id===r.client_op_id));
    const schedules=receipts.filter(r=>r.operation_kind==="agenda_schedule");assert.equal(schedules.length,1);
    const winningBatch=[left,right].find(batch=>batch.operations.some(op=>op.client_op_id===schedules[0].client_op_id));assert(winningBatch);
    const after=await row(anchor.id);assert.equal(Number(after.revision),Number(before.revision)+1);
    assert.equal(after.data_programada,winningBatch.operations.find(op=>op.command==="reschedule_agenda").payload.data_programada);
    for(const batch of [left,right])await receiptCheck(batch,gestures.find(g=>g.client_tx_id===batch.tx).operation_results.filter(r=>r.status==="APPLIED").map(r=>r.op_id));
    raced={left,right,gestures,receipts,after,winner:winner?.op_id??schedules[0].client_op_id};
    loser=[left,right].find(batch=>batch!==winningBatch);return raced;
  });
  await check("CAS05 conflito terminal não faz retry; nova intenção exige revisão atual",async()=>{
    const before=await snapshot(),old=await gesture(loser);
    await page.evaluate(()=>window.c06.worker.recoverErroredGesturesOnce());await processBatch(loser.tx);
    assert.deepEqual(await row(anchor.id),before.postgres.agendas.find(r=>r.id===anchor.id));
    assert.deepEqual((await remote()).receipts,before.postgres.receipts);assert.equal((await local()).ops.filter(r=>r.client_tx_id===loser.tx).length,0);
    const fresh=await enqueue({target:anchor.id,revision:Number(raced.after.revision),plannedFor:"2026-11-14"});
    assert(!fresh.operations.some(op=>loser.operations.some(oldOp=>oldOp.client_op_id===op.client_op_id||oldOp.domain_op_id===op.domain_op_id)));
    await processBatch(fresh.tx);await drain(farmA);assert.equal((await gesture(fresh)).status,"DONE");
    assert.equal(Number((await row(anchor.id)).revision),Number(raced.after.revision)+1);
    return{old,oldBatch:loser,newIntention:fresh,receipts:await receiptCheck(fresh,accepted(fresh))};
  });
  await check("CAS06 lost ACK da cadeia: recibo anterior ao CAS evita reaplicação",async()=>{
    const batch=await enqueue({chain:true});let committed;
    const fault=async route=>{const response=await route.fetch();committed={http:response.status(),...await response.json()};await route.abort("timedout");};
    await context.route("**/functions/v1/sync-batch",fault);
    try{await processBatch(batch.tx);}finally{await context.unroute("**/functions/v1/sync-batch",fault);}
    assert.equal(committed.http,200);assert(committed.results.every(r=>r.status==="APPLIED"));
    const pending=await snapshot();assert.equal(pending.local.ops.filter(r=>r.client_tx_id===batch.tx).length,3);
    assert.equal(Number((await row(batch.id)).revision),2);
    await page.reload();await boot();await replay(batch.tx);
    assert.deepEqual((await remote()).agendas,pending.postgres.agendas);assert.equal((await gesture(batch)).status,"DONE");
    return{batch,committed,pending,receipts:await receiptCheck(batch,accepted(batch)),restart:"page reload preserving IndexedDB"};
  });
  await check("CAS07 reconciliação da cadeia mantém as três origens duráveis",async()=>{
    const batch=await enqueue({chain:true}),fault=route=>route.abort("failed");let pending;
    await context.route("**/rest/v1/sanitario_agenda_v2?*",fault);
    try{await processBatch(batch.tx);pending=await snapshot();}finally{await context.unroute("**/rest/v1/sanitario_agenda_v2?*",fault);}
    assert.equal(pending.local.ops.filter(r=>r.client_tx_id===batch.tx).length,0);const origin=origins(pending.local,batch);
    await page.reload();await boot();await drain(farmA);assert.equal((await local()).obligations.length,0);
    assert((await local()).agendas.some(r=>r.id===batch.id&&Number(r.revision)===2));
    return{batch,pending,origin,receipts:await receiptCheck(batch,accepted(batch))};
  });
  await check("CAS08 farm-switch/RLS rejeita CAS de A no contexto B sem reverter criação B",async()=>{
    const before=await row(anchor.id),batch=await enqueue({farm:farmB,animal:animalB,target:anchor.id,revision:Number(before.revision)});
    await page.evaluate(farm=>localStorage.setItem("gestao_agro_active_fazenda_id",farm),farmB);
    await processBatch(batch.tx);const g=await outcomes(batch);
    assert.equal(g.status,"ERROR");assert.equal(g.operation_results.filter(r=>r.status==="APPLIED").length,1);
    assert.equal(g.operation_results.filter(r=>r.status==="BLOCKED_DEPENDENCY").length,1);assert.deepEqual(await row(anchor.id),before);
    const blocked=batch.operations.find(op=>op.command==="reschedule_agenda");report.c06_cas_blocked_ids.push(blocked.client_op_id);
    assert.equal((await row(batch.id)).fazenda_id,farmB);
    const state=await local();assert(state.ops.some(op=>op.client_op_id===blocked.client_op_id&&op.sync_state==="BLOCKED_DEPENDENCY"&&op.record.fazenda_id===farmB));
    await drain(farmB);const recovered=await local();
    assert(recovered.ops.some(op=>op.client_op_id===blocked.client_op_id&&op.sync_state==="PENDING"&&op.record.fazenda_id===farmB));
    assert.equal(await page.evaluate(()=>localStorage.getItem("gestao_agro_active_fazenda_id")),farmB);
    const matrix=[];for(const [actor,farms]of [[a,[farmA]],[b,[farmB]],[outsider,[]]]){
      const result=await actor.client.from("sanitario_agenda_v2").select("id,fazenda_id");assert.ifError(result.error);assert(result.data.every(r=>farms.includes(r.fazenda_id)));
      if(!farms.length)assert.equal(result.data.length,0);matrix.push({actor:actor===a?"A":actor===b?"B":"outsider",rows:result.data});
    }
    return{batch,gesture:g,beforeRecovery:state,afterRecovery:recovered,matrix,receipts:await receiptCheck(batch,[batch.operations.find(op=>op.command==="create_agenda").client_op_id])};
  });
}
