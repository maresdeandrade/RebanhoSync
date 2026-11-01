import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { readAnimalTimelineEvents } from "../readAnimalTimelineEvents";
afterEach(async()=>{await db.event_eventos.clear();await db.event_eventos_animais.clear();});
it("includes a confirmed sanitary group by canonical relation without cross farm or unconfirmed facts",async()=>{
  for(const [id,farm,state] of [["group","farm","confirmed"],["pending","farm","pending"],["collision","farm","collision"],["foreign","other","confirmed"]]){
    await db.event_eventos.put({id,fazenda_id:farm,dominio:"sanitario",animal_id:null,occurred_at:"2026-10-31T12:00:00Z",sanitario_v3_confirmation:state,payload:{}} as never);
    await db.event_eventos_animais.put({id:`${id}-a`,fazenda_id:farm,evento_id:id,animal_id:"animal",created_at:"2026-10-31T12:00:00Z"});
  }
  expect((await readAnimalTimelineEvents("farm","animal")).map(e=>e.id)).toEqual(["group"]);
});
it("deduplicates a single-animal fact having both representations and retains other domains",async()=>{
  await db.event_eventos.put({id:"single",fazenda_id:"farm",dominio:"sanitario",animal_id:"animal",occurred_at:"2026-10-30",payload:{}} as never);
  await db.event_eventos_animais.put({id:"single-a",fazenda_id:"farm",evento_id:"single",animal_id:"animal",created_at:"2026-10-30"});
  await db.event_eventos.put({id:"weight",fazenda_id:"farm",dominio:"pesagem",animal_id:"animal",occurred_at:"2026-10-31",payload:{}} as never);
  expect((await readAnimalTimelineEvents("farm","animal")).map(e=>e.id)).toEqual(["weight","single"]);
});
