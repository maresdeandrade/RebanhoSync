/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterAll, expect, it } from "vitest";
import pg from "pg";
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { setActiveFarmId } from "@/lib/storage";
import { setSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
import { processGesture, drainReconciliationObligations } from "@/lib/offline/syncWorker";
import { supabase } from "@/lib/supabase";
import { enqueueSanitaryAssessmentV1 } from "@/lib/sanitario/execution/sanitaryAssessmentV1";
import { projectSanitaryAssessmentV1 } from "@/lib/sanitario/triage/sanitaryAssessmentProjectionV1";

const dbUrl = process.env.ASSESSMENT_TEST_DB_URL;
const project = process.env.ASSESSMENT_TEST_PROJECT;
const database = dbUrl ? new pg.Client({ connectionString: dbUrl }) : null;
const nativeFetch = globalThis.fetch;

afterAll(async () => { globalThis.fetch = nativeFetch; await database?.end(); db.close(); });

it.skipIf(!dbUrl || !/^rs-assessment-[a-f0-9]{12}$/.test(project ?? ""))(
  "Dexie → queue → Auth/sync-batch → PostgreSQL → replay → pull → projection",
  async () => {
    expect(new URL(dbUrl!).hostname).toBe("127.0.0.1");
    expect(new URL(dbUrl!).port).toBe("57432");
    await database!.connect();
    const email = `${crypto.randomUUID()}@example.test`, password = `${crypto.randomUUID()}Aa1!`;
    const { data: signed, error } = await supabase.auth.signUp({ email, password });
    expect(error).toBeNull(); expect(signed.session).toBeTruthy();
    const userId = signed.user!.id, farm=crypto.randomUUID(), other=crypto.randomUUID(), animal=crypto.randomUUID(), protocol=crypto.randomUUID(), item=crypto.randomUUID();
    await database!.query("insert into public.fazendas(id,nome) values($1,'Fixture A'),($2,'Fixture B')",[farm,other]);
    await database!.query("insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,'owner'),($1,$3,'owner')",[userId,farm,other]);
    await database!.query("insert into public.animais(id,fazenda_id,identificacao,sexo) values($1,$2,'Fixture','F')",[animal,farm]);
    await database!.query("insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values($1,true,3,3,'ready')",[farm]);
    await database!.query("insert into public.sanitario_protocolos_v2(id,family_code,name,scope,legal_status,version) values($1,$2,'Fixture','global','condicional',1)",[protocol,`fixture-http-${crypto.randomUUID()}`]);
    await database!.query("insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field,snapshot_template) values($1,$2,'fixture-http',1,'condicional','manejo_sanitario','none','{}','{}','[]','{}',$3::jsonb)",[item,protocol,JSON.stringify({metadata:{planning_scope:"assessment_only"}})]);
    await establishLocalOwnership(signed.session!); setActiveFarmId(farm); setSanitarioV2PushEnabled(true,"local");
    await db.sync_sanitario_v2_cutovers.put({ key:`${farm}:3`,fazenda_id:farm,contract_version:3,status:"APPLIED",prepared_at:new Date().toISOString(),applying_at:null,applied_at:new Date().toISOString(),failed_at:null,last_error:null,updated_at:new Date().toISOString() });
    await db.state_animais.put({id:animal,fazenda_id:farm,deleted_at:null} as never);
    const input={fazendaId:farm,animalIds:[animal],protocolId:protocol,itemId:item,itemVersion:1,occurredOn:"2026-01-01",responsibleName:"Fixture",result:"no_treatment_indicated" as const};
    const firstId=await enqueueSanitaryAssessmentV1(input), [firstOp]=await db.queue_ops.toArray();
    expect(await db.event_eventos.get(firstId)).toBeUndefined();
    let loseAck=true, failPartialPull=false, interruptedPull=false; const requests: unknown[]=[]; const receipts: unknown[]=[];
    globalThis.fetch = async (resource, init) => {
      if (failPartialPull && String(resource).includes("/rest/v1/eventos_animais")) {
        failPartialPull=false; interruptedPull=true;
        return new Response(JSON.stringify({ message: "fixture: conexão interrompida" }), { status: 503, headers: { "content-type": "application/json" } });
      }
      const response=await nativeFetch(resource,init);
      if (String(resource).endsWith("/sync-batch")) {
        const request=JSON.parse(String(init?.body));
        if(request.ops.some((op: {client_op_id:string})=>op.client_op_id===firstOp.client_op_id)) {
          requests.push(request.ops); receipts.push(await response.clone().json());
          if(loseAck){loseAck=false;throw new TypeError("simulated ACK loss after real response");}
        }
      }
      return response;
    };
    await processGesture((await db.queue_gestures.get(firstOp.client_tx_id))!);
    expect((await database!.query("select count(*)::int n from public.eventos where id=$1",[firstId])).rows[0].n).toBe(1);
    expect(await db.queue_ops.get(firstOp.client_op_id)).toBeDefined();
    db.close(); await db.open();
    setActiveFarmId(other);
    await expect(enqueueSanitaryAssessmentV1(input)).rejects.toThrow("FARM_CHANGED");
    setActiveFarmId(farm);
    await supabase.auth.signOut();
    await processGesture((await db.queue_gestures.get(firstOp.client_tx_id))!);
    expect(await db.queue_ops.get(firstOp.client_op_id)).toBeDefined();
    const login=await supabase.auth.signInWithPassword({email,password}); expect(login.error).toBeNull();
    const secondId=await enqueueSanitaryAssessmentV1({...input,result:"treatment_indicated"});
    const secondOp=(await db.queue_ops.toArray()).find(op=>op.record?.payload?.event?.id===secondId)!;
    await processGesture((await db.queue_gestures.get(secondOp.client_tx_id))!);
    expect((await database!.query("select count(*)::int n from public.eventos where id=$1",[secondId])).rows[0].n).toBe(1);
    await db.queue_ops.update(firstOp.client_op_id,{next_attempt_at:undefined});
    await db.queue_gestures.update(firstOp.client_tx_id,{next_attempt_at:undefined,status:"PENDING"});
    await processGesture((await db.queue_gestures.get(firstOp.client_tx_id))!);
    expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
    expect(receipts[1]).toEqual(receipts[0]);
    expect(await db.queue_ops.get(firstOp.client_op_id)).toBeUndefined();
    expect(await db.event_eventos.get(firstId)).toBeDefined();
    expect(await db.event_eventos_sanitario.get(firstId)).toMatchObject({tipo:"avaliacao",produto:null});
    const relations=await db.event_eventos_animais.where("evento_id").equals(firstId).toArray();
    expect(relations.map(r=>r.animal_id)).toEqual([animal]);
    const projection=projectSanitaryAssessmentV1({events:[(await db.event_eventos.get(firstId))!],relations,farmId:farm,animalId:animal,protocolId:protocol,itemId:item,itemVersion:1,cycleKey:"2026",asOf:"2026-12-31"});
    expect(projection).toEqual({state:"no_treatment_indicated",eventId:firstId});
    const correctionId=await enqueueSanitaryAssessmentV1({...input,result:"insufficient_data",correctsEventId:firstId,observation:"Correção documentada"});
    const correction=(await db.queue_ops.toArray()).find(op=>op.record?.payload?.event?.id===correctionId)!;
    failPartialPull=true;
    await processGesture((await db.queue_gestures.get(correction.client_tx_id))!);
    expect((await database!.query("select corrige_evento_id from public.eventos where id=$1",[correctionId])).rows[0].corrige_evento_id).toBe(firstId);
    expect(interruptedPull).toBe(true);
    expect(await db.sync_reconcile_obligations.get(`${farm}:sanitario-v2`)).toBeDefined();
    db.close(); await db.open();
    await drainReconciliationObligations(farm);
    expect(await db.event_eventos.get(correctionId)).toMatchObject({ corrige_evento_id: firstId });
    expect(await db.sync_reconcile_obligations.get(`${farm}:sanitario-v2`)).toBeUndefined();
    const counts=await database!.query("select (select count(*)::int from public.eventos where fazenda_id=$1) events,(select count(*)::int from public.sanitario_agenda_v2 where fazenda_id=$1) agendas,(select count(*)::int from public.insumo_movimentacoes where fazenda_id=$1) stock",[farm]);
    expect(counts.rows[0]).toEqual({events:3,agendas:0,stock:0});
  }, 120000,
);
