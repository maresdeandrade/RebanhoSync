/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "fixture", expires_at: 9999999999, user: { id: "calendar-owner" } } } })) } } }));
import { db } from "@/lib/offline/db";
import { seedLocalOwner } from "@/lib/offline/__tests__/ownershipTestFixture";
import { applyOpLocal, reapplyOpLocal, rollbackOpLocal } from "@/lib/offline/ops";
import { mapOperationForSync } from "@/lib/offline/syncWorker";
import { setActiveFarmId } from "@/lib/storage";
import { saveStrategicCalendarV1 } from "../saveStrategicCalendarV1";

const farm="10000000-0000-4000-8000-000000000001";
beforeEach(async()=>{await db.queue_ops.clear();await db.queue_gestures.clear();await db.state_fazenda_sanidade_config.clear();await seedLocalOwner("calendar-owner");setActiveFarmId(farm);await db.state_fazenda_sanidade_config.put({fazenda_id:farm,payload:{activated_template_slugs:["legacy"]}} as never);});
afterEach(async()=>{await db.queue_ops.clear();await db.queue_gestures.clear();await db.state_fazenda_sanidade_config.clear();});

it("enfileira intenção única isolada sem alterar configuração efetiva",async()=>{
  const outcomes=await Promise.allSettled([saveStrategicCalendarV1(farm,0,"5-6-9"),saveStrategicCalendarV1(farm,0,"5-7-9")]);
  expect(outcomes.filter(x=>x.status==="fulfilled")).toHaveLength(1);
  const [op]=await db.queue_ops.toArray(); const prior=await db.state_fazenda_sanidade_config.get(farm);
  await applyOpLocal(op);await reapplyOpLocal(op);await rollbackOpLocal(op);
  expect(await db.state_fazenda_sanidade_config.get(farm)).toEqual(prior);
  expect(mapOperationForSync(op,farm)).toMatchObject({domain:"sanitary_strategic_calendar_v1",expected_revision:0,client_op_id:op.client_op_id});
  expect(()=>mapOperationForSync(op,"other")).toThrow("IDENTITY_MISMATCH");
});
it("recusa troca de fazenda antes da escrita",async()=>{setActiveFarmId("other");await expect(saveStrategicCalendarV1(farm,0,"5-7-9")).rejects.toThrow("FARM_CHANGED");expect(await db.queue_ops.count()).toBe(0);});
