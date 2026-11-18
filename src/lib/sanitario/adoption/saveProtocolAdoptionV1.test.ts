/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { auth: {
  getSession: vi.fn(async () => ({ data: { session: { access_token: "fixture", expires_at: 9999999999, user: { id: "test-owner" } } } })),
  refreshSession: vi.fn(),
} } }));
vi.mock("@/lib/offline/pull", () => ({ DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: vi.fn(async () => undefined), pullInitialData: vi.fn(),
  pullSanitarioAgendaV2: vi.fn(), pullSanitarioV2CutoverState: vi.fn(),
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({ trackPilotMetric: vi.fn() }));
import { db } from "@/lib/offline/db";
import { seedLocalOwner } from "@/lib/offline/__tests__/ownershipTestFixture";
import { applyOpLocal, reapplyOpLocal, rollbackOpLocal } from "@/lib/offline/ops";
import { mapOperationForSync, processGesture } from "@/lib/offline/syncWorker";
import { getLocalStoreName } from "@/lib/offline/tableMap";
import { setActiveFarmId } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { pullDataForFarm } from "@/lib/offline/pull";
import { saveProtocolAdoptionV1 } from "./saveProtocolAdoptionV1";
import { executeProtocolAdoptionV1 } from "../../../../supabase/functions/sync-batch/protocol-adoption-v1";

const farm = "10000000-0000-4000-8000-000000000001";
const families = { clostridioses: { monitoringEnabled: false } };
const config = () => db.table(getLocalStoreName("fazenda_sanidade_config"));
async function clear() {
  await db.queue_ops.clear(); await db.queue_gestures.clear(); await db.queue_rejections.clear();
  await db.sync_reconcile_obligations.clear(); await config().clear();
}
beforeEach(async () => {
  await clear(); await seedLocalOwner("test-owner"); setActiveFarmId(farm);
  vi.stubGlobal("fetch", vi.fn()); vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "local-fixture");
  await config().put({ fazenda_id: farm, payload: { sibling: true } });
});
afterEach(async () => { await clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("enqueues one stable intention atomically and never applies or rolls back configuration", async () => {
  const outcomes = await Promise.allSettled([saveProtocolAdoptionV1(farm,0,families), saveProtocolAdoptionV1(farm,0,families)]);
  expect(outcomes.filter(x=>x.status==="fulfilled")).toHaveLength(1);
  const [op] = await db.queue_ops.toArray();
  const before = await config().get(farm);
  await applyOpLocal(op); await reapplyOpLocal(op); await rollbackOpLocal(op);
  expect(await config().get(farm)).toEqual(before);
  const transport = mapOperationForSync(op,farm);
  expect(transport).toMatchObject({domain:"sanitary_protocol_adoption_v1",client_op_id:op.client_op_id,expected_revision:0,families});
  expect(transport).not.toHaveProperty("client_recorded_at");
  expect(()=>mapOperationForSync(op,"other")).toThrow("IDENTITY_MISMATCH");
});
it("rejects a switched farm and unavailable local ownership", async () => {
  setActiveFarmId("other"); await expect(saveProtocolAdoptionV1(farm,0,families)).rejects.toThrow("FARM_CHANGED");
  setActiveFarmId(farm); await seedLocalOwner("different-owner");
  await expect(saveProtocolAdoptionV1(farm,0,families)).rejects.toThrow("ownership");
  expect(await db.queue_ops.count()).toBe(0);
});
it("rejects farm switch while session ownership is being checked", async () => {
  vi.mocked(supabase.auth.getSession).mockImplementationOnce(async () => {
    setActiveFarmId("other"); return { data:{session:{user:{id:"test-owner"}}},error:null } as never;
  });
  await expect(saveProtocolAdoptionV1(farm,0,families)).rejects.toThrow("FARM_CHANGED");
});
async function runResult(status:string, reason_code:string) {
  const id=await saveProtocolAdoptionV1(farm,0,families); const op=await db.queue_ops.get(id);
  vi.mocked(fetch).mockResolvedValue({ok:true,status:200,json:async()=>({results:[{op_id:id,status,reason_code,retryable:status==="RETRYABLE"}]})} as Response);
  await processGesture((await db.queue_gestures.get(op!.client_tx_id))!);
  return id;
}
it("ACK triggers config pull without installing the submitted preference", async () => {
  const id=await runResult("APPLIED","PROTOCOL_ADOPTION_APPLIED");
  expect(await db.queue_ops.get(id)).toBeUndefined();
  expect((await db.queue_gestures.toArray())[0]).toMatchObject({status:"DONE",sync_result:"APPLIED"});
  expect(vi.mocked(pullDataForFarm).mock.calls.some(call=>call[1]?.includes("fazenda_sanidade_config"))).toBe(true);
  expect((await config().get(farm)).payload).toEqual({sibling:true});
});
it("stale conflict is terminal, audited and reconciled without local rollback", async () => {
  const id=await runResult("CONFLICT","PROTOCOL_ADOPTION_STALE_REVISION");
  expect(await db.queue_ops.get(id)).toMatchObject({sync_state:"REJECTED",blocked_reason:"PROTOCOL_ADOPTION_STALE_REVISION"});
  expect(await db.queue_rejections.count()).toBe(1);
  expect((await config().get(farm)).payload).toEqual({sibling:true});
});
it("unavailable RPC retains the original queued identity and reason", async () => {
  const id=await runResult("RETRYABLE","PROTOCOL_ADOPTION_RPC_UNAVAILABLE");
  expect(await db.queue_ops.get(id)).toMatchObject({sync_state:"RETRYABLE",blocked_reason:"PROTOCOL_ADOPTION_RPC_UNAVAILABLE"});
});
it("lost ACK followed by restart replays the identical command until confirmed pull", async () => {
  const id=await saveProtocolAdoptionV1(farm,0,families);
  const op=(await db.queue_ops.get(id))!;
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("ACK unavailable"))
    .mockResolvedValueOnce({ok:true,status:200,json:async()=>({results:[{op_id:id,status:"APPLIED"}]})} as Response);
  await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
  expect(await db.queue_ops.get(id)).toBeDefined();
  expect((await config().get(farm)).payload).toEqual({sibling:true});
  db.close(); await db.open();
  await processGesture((await db.queue_gestures.get(op.client_tx_id))!);
  const requests=vi.mocked(fetch).mock.calls.map(call=>JSON.parse(String(call[1]?.body)));
  expect(requests[1].ops).toEqual(requests[0].ops);
  expect(await db.queue_ops.get(id)).toBeUndefined();
  expect(await db.queue_gestures.get(op.client_tx_id)).toMatchObject({status:"DONE",sync_result:"APPLIED"});
});
it("dedicated handler fails closed for missing RPC and forwards canonical conflict", async () => {
  const op={domain:"sanitary_protocol_adoption_v1",contract_version:1,fazenda_id:farm,client_tx_id:"tx",client_op_id:"op"};
  const client={rpc:vi.fn().mockResolvedValue({data:null,error:{code:"PGRST202"}})};
  expect(await executeProtocolAdoptionV1(client,op,{fazendaId:farm,clientTxId:"tx"})).toMatchObject({status:"RETRYABLE",reason_code:"PROTOCOL_ADOPTION_RPC_UNAVAILABLE"});
  client.rpc.mockResolvedValue({data:{status:"CONFLICT",reason_code:"PROTOCOL_ADOPTION_STALE_REVISION"},error:null});
  expect(await executeProtocolAdoptionV1(client,op,{fazendaId:farm,clientTxId:"tx"})).toMatchObject({status:"CONFLICT",terminal:true});
});
