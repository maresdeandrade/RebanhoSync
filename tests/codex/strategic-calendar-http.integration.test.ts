/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterAll, expect, it } from "vitest";
import pg from "pg";
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { setActiveFarmId } from "@/lib/storage";
import { processGesture } from "@/lib/offline/syncWorker";
import { supabase } from "@/lib/supabase";
import { saveStrategicCalendarV1 } from "@/lib/sanitario/calendar/saveStrategicCalendarV1";

const dbUrl=process.env.CALENDAR_TEST_DB_URL;
const database=dbUrl ? new pg.Client({connectionString:dbUrl}) : null;
const nativeFetch=globalThis.fetch;
afterAll(async()=>{globalThis.fetch=nativeFetch; await database?.end(); db.close();});
it.skipIf(!dbUrl || process.env.CALENDAR_TEST_PROJECT!=="rs-calendar-http-58431")("Dexie → sync-batch → replay → pull",async()=>{
 expect(new URL(dbUrl!).hostname).toBe("127.0.0.1"); expect(new URL(dbUrl!).port).toBe("58432");
 await database!.connect();
 const email=`${crypto.randomUUID()}@example.test`,password=`${crypto.randomUUID()}Aa1!`;
 const signed=await supabase.auth.signUp({email,password}); expect(signed.error).toBeNull(); expect(signed.data.session).toBeTruthy();
 const farm=crypto.randomUUID();
 await database!.query("insert into public.fazendas(id,nome) values($1,'Fixture Dexie')",[farm]);
 await database!.query("insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,'owner')",[signed.data.user!.id,farm]);
 await establishLocalOwnership(signed.data.session!); setActiveFarmId(farm);
 const id=await saveStrategicCalendarV1(farm,0,"5-6-9"); const op=(await db.queue_ops.get(id))!;
 let loseAck=true; const receipts: unknown[]=[]; const requests: unknown[]=[];
 globalThis.fetch=async(resource,init)=>{const response=await nativeFetch(resource,init); if(String(resource).endsWith('/sync-batch')) {requests.push(JSON.parse(String(init?.body)));receipts.push(await response.clone().json());if(loseAck){loseAck=false;throw new TypeError('simulated ACK loss');}} return response;};
 await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
 expect((await database!.query("select payload from public.fazenda_sanidade_config where fazenda_id=$1",[farm])).rows[0].payload.sanitary_strategic_calendar_v1.revision).toBe(1);
 expect(await db.queue_ops.get(id)).toBeDefined();
 await db.queue_ops.update(id,{next_attempt_at:undefined}); await db.queue_gestures.update(op.client_tx_id,{next_attempt_at:undefined,status:"PENDING"});
 await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
 expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]); expect(receipts[1]).toEqual(receipts[0]);
 expect(await db.queue_ops.get(id)).toBeUndefined();
 expect((await db.state_fazenda_sanidade_config.get(farm))?.payload?.sanitary_strategic_calendar_v1).toMatchObject({revision:1,variant:"5-6-9"});
},120000);
