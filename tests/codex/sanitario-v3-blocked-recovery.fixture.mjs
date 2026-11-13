// Exercised by the isolated Supabase VF4 harness with real Auth, Edge, PostgreSQL and IndexedDB.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function runSanitaryBlockedRecoveryV3({ page, context, db, report, farmA, farmB, animalA, animalB, a, agendaB, check, creation, operation, send, applied }) {
      const target=randomUUID();
      const enqueueSchedule=(revision,date,targetId=target)=>page.evaluate(async({farm,target,revision,date})=>{
        const cut=await import("/src/lib/offline/sanitarioV2Cutover.ts");
        const {buildRescheduleAgendaV2}=await import("/src/lib/sanitario/agenda/sanitaryPlanningSyncV2.ts");
        const {getClientId}=await import("/src/lib/offline/clientIdentity.ts");
        const op=buildRescheduleAgendaV2(farm,target,revision,date);
        await cut.enqueueSanitarioV2Operations({fazendaId:farm,clientId:getClientId(),projectRef:"local",operations:[op]});
        return op;
      },{farm:farmA,target:targetId,revision,date});
      const snapshot=()=>page.evaluate(async()=>{const {db}=window.vf4;return {ops:await db.queue_ops.toArray(),gestures:await db.queue_gestures.toArray(),rejections:await db.queue_rejections.toArray(),obligations:await db.sync_reconcile_obligations.toArray(),agendas:await db.ops_sanitario_agenda_v2.toArray()};});
      const process=op=>page.evaluate(async tx=>{const{db,worker}=window.vf4;await worker.processGesture(await db.queue_gestures.get(tx));},op.client_tx_id);
      const drain=()=>page.evaluate(farm=>window.vf4.worker.drainReconciliationObligations(farm),farmA);
      const requireReady=async(blocked,original)=>{await drain();const state=await snapshot();const op=state.ops.find(o=>o.client_op_id===blocked.client_op_id);assert.equal(op?.sync_state,"PENDING");assert.deepEqual(op?.record,original.record);return state;};
      const remoteState=async()=>({rows:(await db.query("select id,fazenda_id,revision,data_programada::text from public.sanitario_agenda_v2 where id=$1",[target])).rows,receipts:(await db.query("select client_op_id,domain_op_id,canonical_result from public.sanitario_sync_v2_operations where entity_id=$1",[target])).rows});
      await check("Dependência V3 indisponível e depois comprovada sem reinício",async()=>{
        const blocked=await enqueueSchedule(1,"2026-11-12");await process(blocked);
        const before=await snapshot(),remoteMissing=await remoteState();
        assert.equal(remoteMissing.rows.length,0);assert.equal(remoteMissing.receipts.length,0);
        const pending=before.ops.find(o=>o.client_op_id===blocked.client_op_id);assert.equal(pending.sync_state,"BLOCKED_DEPENDENCY");
        assert.equal(pending.blocked_reason,"SANITARIO_AGENDA_NOT_FOUND");
        await drain();
        const afterUnavailable=await snapshot();assert.deepEqual(afterUnavailable.ops.find(o=>o.client_op_id===blocked.client_op_id),pending);
        applied(await send(a,farmA,[creation(animalA,target)]));
        applied(await send(a,farmA,[operation("reschedule_agenda",{agenda_id:target,data_programada:"2026-11-11"},{expected_revision:0})]));
        const stale=await enqueueSchedule(0,"2026-11-10");await process(stale);
        const beforeDrain=await snapshot(),remoteAvailable=await remoteState();
        assert(beforeDrain.ops.some(o=>o.client_op_id===stale.client_op_id&&o.sync_state==="REJECTED"));
        assert.equal(Number(remoteAvailable.rows[0].revision),1);
        assert(beforeDrain.obligations.some(o=>o.scope==="sanitario-v2"));
        const foreignBefore=(await db.query("select revision,data_programada::text from public.sanitario_agenda_v2 where id=$1",[agendaB.payload.agenda.id])).rows[0];
        await page.evaluate(farm=>localStorage.setItem("gestao_agro_active_fazenda_id",farm),farmB);
        await drain();
        const afterDrain=await snapshot();
        assert.equal(await page.evaluate(()=>localStorage.getItem("gestao_agro_active_fazenda_id")),farmB);
        assert.deepEqual((await db.query("select revision,data_programada::text from public.sanitario_agenda_v2 where id=$1",[agendaB.payload.agenda.id])).rows[0],foreignBefore);
        await page.evaluate(farm=>localStorage.setItem("gestao_agro_active_fazenda_id",farm),farmA);
        report.blocked_diagnostic={blocked,stale,before,remoteMissing,afterUnavailable,beforeDrain,remoteAvailable,afterDrain,foreignBefore};
        assert.equal(afterDrain.ops.find(o=>o.client_op_id===blocked.client_op_id)?.sync_state,"PENDING");
        assert.deepEqual(afterDrain.ops.find(o=>o.client_op_id===blocked.client_op_id)?.record,pending.record);
        await process(blocked);await drain();
        const final=await snapshot(),remoteFinal=await remoteState();
        assert.equal(Number(remoteFinal.rows[0].revision),2);assert.equal(remoteFinal.rows[0].data_programada,"2026-11-12");
        assert.equal(remoteFinal.receipts.filter(r=>r.client_op_id===blocked.client_op_id&&r.domain_op_id===blocked.domain_op_id).length,1);
        assert(!final.ops.some(o=>o.client_op_id===blocked.client_op_id));
        const clientId=before.gestures.find(g=>g.client_tx_id===blocked.client_tx_id).client_id;
        const replay=await page.evaluate(async({farm,clientId,op})=>window.vf4.supabase.functions.invoke("sync-batch",{body:{fazenda_id:farm,client_id:clientId,client_tx_id:op.client_tx_id,ops:[op]}}),{farm:farmA,clientId,op:blocked});
        assert.ifError(replay.error);assert.equal(replay.data.results[0].status,"APPLIED");
        assert.deepEqual(await remoteState(),remoteFinal);
        report.blocked_diagnostic.final=final;report.blocked_diagnostic.remoteFinal=remoteFinal;
        return{blocked:blocked.client_op_id,identity_preserved:true,revision:2};
      });
      await check("Dependência reaparece em revisão superior e CAS termina em conflito",async()=>{
        const target3=randomUUID(),blocked=await enqueueSchedule(1,"2026-11-18",target3);await process(blocked);
        const before=await snapshot(),original=before.ops.find(o=>o.client_op_id===blocked.client_op_id);assert.equal(original.sync_state,"BLOCKED_DEPENDENCY");
        applied(await send(a,farmA,[creation(animalA,target3)]));
        applied(await send(a,farmA,[operation("reschedule_agenda",{agenda_id:target3,data_programada:"2026-11-16"},{expected_revision:0})]));
        applied(await send(a,farmA,[operation("reschedule_agenda",{agenda_id:target3,data_programada:"2026-11-17"},{expected_revision:1})]));
        const ready=await requireReady(blocked,original);
        await process(blocked);await drain();
        const after=await snapshot(),remote=(await db.query("select revision,data_programada::text from public.sanitario_agenda_v2 where id=$1",[target3])).rows[0];
        assert.equal(Number(remote.revision),2);assert.equal(remote.data_programada,"2026-11-17");
        assert(after.ops.some(o=>o.client_op_id===blocked.client_op_id&&o.sync_state==="REJECTED"));
        assert(after.rejections.some(r=>r.client_op_id===blocked.client_op_id&&r.result_status==="CONFLICT"));
        assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",[blocked.client_op_id])).rows[0].n,0);
        report.blocked_advanced={original,ready,after,remote};return{identity:blocked.client_op_id,status:"CONFLICT",revision:2};
      });
      await check("Predecessor terminal não reabre dependente",async()=>{
        const bad=creation(animalB),child=operation("reschedule_agenda",{agenda_id:bad.payload.agenda.id,data_programada:"2026-11-15"},{expected_revision:0,fazenda_id:farmA});
        bad.fazenda_id=farmA;child.client_tx_id=bad.client_tx_id;
        await page.evaluate(async({farm,ops})=>{const cut=await import("/src/lib/offline/sanitarioV2Cutover.ts");const{getClientId}=await import("/src/lib/offline/clientIdentity.ts");await cut.enqueueSanitarioV2Operations({fazendaId:farm,clientId:getClientId(),projectRef:"local",operations:ops});},{farm:farmA,ops:[bad,child]});
        await process(bad);const terminal=await snapshot();
        const original=terminal.ops.filter(o=>[bad.client_op_id,child.client_op_id].includes(o.client_op_id));
        assert.equal(original.length,2);assert(original.every(o=>o.sync_state==="REJECTED"));
        assert(terminal.rejections.some(r=>r.client_op_id===child.client_op_id&&r.payload?.terminal_dependency_client_op_id===bad.client_op_id));
        await drain();
        await page.evaluate(()=>window.vf4.worker.recoverBlockedSanitarioV2Operations("app_startup"));
        const after=await snapshot();assert.deepEqual(after.ops.filter(o=>[bad.client_op_id,child.client_op_id].includes(o.client_op_id)),original);
        assert.equal((await db.query("select count(*)::int n from public.sanitario_agenda_v2 where id=$1",[bad.payload.agenda.id])).rows[0].n,0);
        assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=any($1)",[[bad.client_op_id,child.client_op_id]])).rows[0].n,0);
        report.blocked_terminal={original,after:after.ops.filter(o=>[bad.client_op_id,child.client_op_id].includes(o.client_op_id))};
        return{predecessor:bad.client_op_id,dependent:child.client_op_id,terminal_preserved:true};
      });
      await check("Falha de pull e restart recuperam dependência sem trocar identidade",async()=>{
        const target2=randomUUID(),blocked=await enqueueSchedule(1,"2026-11-16",target2);await process(blocked);
        const before=await snapshot(),original=before.ops.find(o=>o.client_op_id===blocked.client_op_id);
        assert.equal(original.sync_state,"BLOCKED_DEPENDENCY");
        applied(await send(a,farmA,[creation(animalA,target2)]));
        applied(await send(a,farmA,[operation("reschedule_agenda",{agenda_id:target2,data_programada:"2026-11-15"},{expected_revision:0})]));
        const failure=route=>route.abort("failed");await context.route("**/rest/v1/sanitario_agenda_v2?*",failure);
        try {await drain();} finally {await context.unroute("**/rest/v1/sanitario_agenda_v2?*",failure);}
        const failed=await snapshot();assert.deepEqual(failed.ops.find(o=>o.client_op_id===blocked.client_op_id),original);assert(failed.obligations.some(o=>o.scope==="sanitario-v2"));
        await page.reload();await page.evaluate(async()=>{const[{db},{supabase},worker,pull,manage]=await Promise.all([import("/src/lib/offline/db.ts"),import("/src/lib/supabase.ts"),import("/src/lib/offline/syncWorker.ts"),import("/src/lib/offline/pull.ts"),import("/src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts")]);window.vf4={db,supabase,worker,pull,manage};});
        const ready=await requireReady(blocked,original);
        await process(blocked);await drain();
        const remote=(await db.query("select revision,data_programada::text from public.sanitario_agenda_v2 where id=$1",[target2])).rows[0];
        assert.equal(Number(remote.revision),2);assert.equal(remote.data_programada,"2026-11-16");
        assert.equal((await db.query("select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1 and domain_op_id=$2",[blocked.client_op_id,blocked.domain_op_id])).rows[0].n,1);
        report.blocked_restart={failed,ready,remote,after:await snapshot()};return{identity:blocked.client_op_id,restart:"same IndexedDB",revision:2};
      });
}
