/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { matchesPersistedSeedCalf, matchesPersistedSeedReproduction, waitForTestFarmGesture } from "../progress";
import { retryRejectedOperation } from "@/lib/offline/ops";
import type { Operation, Rejection, Animal } from "@/lib/offline/types";

const farmId = "model";
const txId = "tx";
beforeEach(async () => {
  await db.queue_gestures.clear();
  await db.queue_ops.clear();
  await db.sync_reconcile_obligations.clear();
  await db.queue_gestures.put({client_tx_id:txId,fazenda_id:farmId,client_id:"test",created_at:"2026-10-23T12:00:00Z",status:"PENDING"});
});
describe("test farm dependency confirmation", () => {
  it("resumes a confirmed birth after later taxonomy changes but rejects a different parent", () => {
    const identity={id:"calf",fazenda_id:farmId,mae_id:"mother",pai_id:"father",data_nascimento:"2020-01-01",identificacao:"DEMO-1",sexo:"F"};
    const calf={...identity,payload:{birth_event_id:"birth",generated_from:"evento_parto",taxonomy_facts:{em_lactacao:true}}};
    expect(matchesPersistedSeedCalf(calf,{...identity,birth_event_id:"birth"})).toBe(true);
    expect(matchesPersistedSeedCalf(calf,{...identity,mae_id:"other",birth_event_id:"birth"})).toBe(false);
  });
  it("does not release a dependent operation before an installed ACK", async () => {
    let released=false;
    const pending=waitForTestFarmGesture(farmId,txId,2000).then(()=>{released=true;},error=>error);
    await new Promise(resolve=>setTimeout(resolve,50));
    expect(released).toBe(false);
    await db.queue_gestures.update(txId,{status:"DONE",sync_result:"APPLIED"});
    await new Promise(resolve=>setTimeout(resolve,250));
    expect(released).toBe(false);
    await db.queue_gestures.update(txId,{diagnostics:{ack_installed_at:"2026-10-23T12:00:01Z"}});
    await pending;
    expect(released).toBe(true);
  });
  it("stops on rejection without discarding persisted progress", async () => {
    await db.queue_gestures.update(txId,{status:"REJECTED",last_error:"dependency rejected"});
    await expect(waitForTestFarmGesture(farmId,txId,1000)).rejects.toThrow("dependency rejected");
    expect((await db.queue_gestures.get(txId))?.status).toBe("REJECTED");
  });
  it("does not accept a transaction belonging to another farm",async()=>{
    await expect(waitForTestFarmGesture("other",txId,1000)).rejects.toThrow("FARM_MISMATCH");
  });
  it.each([undefined, 1])("captures a missing revision but never rebases an existing revision (%s)", async(captured)=>{
    await db.state_animais.put({id:"mother",fazenda_id:farmId,revision:3,payload:{}} as Animal);
    await db.queue_gestures.update(txId,{status:"REJECTED"});
    await db.queue_ops.put({client_op_id:"op",client_tx_id:txId,fazenda_id:farmId,table:"animais",action:"UPDATE",record:{id:"mother",fazenda_id:farmId,payload:{updated:true}},sync_state:"REJECTED",expected_revision:captured,created_at:"2026-10-23T12:00:00Z"} as Operation);
    await retryRejectedOperation({client_op_id:"op",client_tx_id:txId,fazenda_id:farmId} as Rejection);
    expect((await db.queue_ops.get("op"))?.expected_revision).toBe(captured ?? 3);
    expect((await db.queue_ops.get("op"))?.client_op_id).toBe("op");
  });
  it("keeps the persisted transaction available after an unconfirmed timeout", async()=>{
    await expect(waitForTestFarmGesture(farmId,txId,20)).rejects.toThrow("SYNC_UNCONFIRMED");
    expect((await db.queue_gestures.get(txId))?.status).toBe("PENDING");
  });
});


it("rejects conflicting seed diagnosis results and due dates despite identical IDs", () => {
  const expected = { tipo: "diagnostico", macho_id: null, payload: { resultado: "positivo", data_prevista_parto: "2026-10-20", episode_evento_id: "service" } };
  expect(matchesPersistedSeedReproduction(expected, expected)).toBe(true);
  expect(matchesPersistedSeedReproduction({ ...expected, payload: { ...expected.payload, resultado: "negativo" } }, expected)).toBe(false);
  expect(matchesPersistedSeedReproduction({ ...expected, payload: { ...expected.payload, data_prevista_parto: "2026-10-21" } }, expected)).toBe(false);
});
