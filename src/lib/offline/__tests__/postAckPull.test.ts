/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const remote = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>[]>(), calls: [] as { table: string; farm: string; ids?: string[] }[], fail: "" }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: (table: string) => ({ select: () => ({ eq: (_: string, farm: string) => {
  const call = { table, farm, ids: undefined as string[] | undefined }; remote.calls.push(call);
  const response = () => ({ data: (remote.rows.get(table) ?? []).filter(r => r.fazenda_id === farm && (!call.ids || call.ids.includes(r.id as string))), error: remote.fail === table ? new Error("FETCH_FAILED") : null });
  return { in: (_: string, ids: string[]) => { call.ids = ids; return Promise.resolve(response()); }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(response()).then(resolve) };
} }) }) } }));
import { db } from "../db";
import { pullDataForFarm, type PullOptions } from "../pull";
const farm = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const target = "20000000-0000-4000-8000-000000000001";
const plan: PullOptions = { mode: "replace", tableModes: { animais: "merge" }, observations: { animais: { key: "id", ids: [target] } }, requiredAnimalIds: [target] };
const animal = { id: target, fazenda_id: farm, revision: 1, observacoes: "local" };
async function clear() { for (const t of [db.state_animais, db.state_agenda_itens, db.queue_ops]) await t.clear(); }
describe("post-ACK partial atomic installation", () => {
  beforeEach(async () => {
    await clear(); remote.calls = []; remote.fail = ""; remote.rows.clear();
    await db.state_animais.bulkPut([animal, { ...animal, id: "untouched" }, { ...animal, id: "other-farm", fazenda_id: other }] as never[]);
    await db.state_agenda_itens.bulkPut([{ id: "stale", fazenda_id: farm }, { id: "other-agenda", fazenda_id: other }] as never[]);
    remote.rows.set("animais", [{ ...animal, revision: 2, observacoes: "remote" }]);
    remote.rows.set("agenda_itens", [{ id: "fresh", fazenda_id: farm }]);
  });
  afterEach(async () => { vi.restoreAllMocks(); await clear(); });
  it.each(["replace", "merge"] as const)("animal merge and original agenda %s", async mode => {
    await pullDataForFarm(farm, ["animais", "agenda_itens"], { ...plan, mode });
    expect((await db.state_animais.get(target))?.revision).toBe(2);
    expect(await db.state_animais.count()).toBe(3);
    expect(Boolean(await db.state_agenda_itens.get("stale"))).toBe(mode === "merge");
    expect(await db.state_agenda_itens.get("other-agenda")).toBeDefined();
    expect(remote.calls).toEqual([{ table: "animais", farm, ids: [target] }, { table: "agenda_itens", farm, ids: undefined }]);
  });
  it("rejects partial replace before any query", async () => {
    await expect(pullDataForFarm(farm, ["animais"], { ...plan, tableModes: undefined })).rejects.toThrow("PARTIAL_PULL_REPLACE_FORBIDDEN");
    expect(remote.calls).toHaveLength(0);
  });
  it("fetch failure installs neither table", async () => {
    remote.fail = "agenda_itens";
    await expect(pullDataForFarm(farm, ["animais", "agenda_itens"], plan)).rejects.toThrow("FETCH_FAILED");
    expect((await db.state_animais.get(target))?.revision).toBe(1);
    expect(await db.state_agenda_itens.get("stale")).toBeDefined();
  });
  it("failure during second store rolls back first store and deletion", async () => {
    const fail = () => { throw new Error("INSTALL_FAILED"); };
    db.state_agenda_itens.hook("creating", fail);
    try { await expect(pullDataForFarm(farm, ["animais", "agenda_itens"], plan)).rejects.toThrow("INSTALL_FAILED"); }
    finally { db.state_agenda_itens.hook("creating").unsubscribe(fail); }
    expect((await db.state_animais.get(target))?.revision).toBe(1);
    expect(await db.state_agenda_itens.get("stale")).toBeDefined();
  });
  it.each([[], [{ ...animal, revision: 0 }], [{ ...animal, id: "wrong" }], [{ ...animal, fazenda_id: other }], [{ ...animal }, { ...animal }]].map(rows => ({ rows })))("rejects missing/invalid coverage without clearing agenda %#", async ({ rows }) => {
    remote.rows.set("animais", rows);
    await expect(pullDataForFarm(farm, ["animais", "agenda_itens"], plan)).rejects.toThrow("REQUIRED_ANIMAL_SNAPSHOT_NOT_COVERED");
    expect(await db.state_agenda_itens.get("stale")).toBeDefined();
  });
  it("includes tombstone and never advances full cursor", async () => {
    remote.rows.set("animais", [{ ...animal, revision: 2, deleted_at: "2026-10-10T00:00:00Z" }]);
    const before = await db.sync_pull_cursors.toArray();
    await pullDataForFarm(farm, ["animais", "agenda_itens"], plan);
    expect((await db.state_animais.get(target))?.deleted_at).toBeTruthy();
    expect(await db.sync_pull_cursors.toArray()).toEqual(before);
  });
  it("preserves pending target, other animal, agenda and other farm; revision remains captured", async () => {
    await db.queue_ops.bulkPut([
      { client_op_id: "p1", client_tx_id: "tx", table: "animais", action: "UPDATE", expected_revision: 1, record: { id: target, fazenda_id: farm }, created_at: "now" },
      { client_op_id: "p2", client_tx_id: "tx2", table: "animais", action: "UPDATE", expected_revision: 1, record: { id: "other-farm", fazenda_id: other }, created_at: "now" },
      { client_op_id: "p3", client_tx_id: "tx3", table: "agenda_itens", action: "UPDATE", record: { id: "stale", fazenda_id: farm }, created_at: "now" },
      { client_op_id: "p4", client_tx_id: "tx4", table: "animais", action: "UPDATE", record: { id: "untouched", fazenda_id: farm }, created_at: "now" },
    ] as never[]);
    await pullDataForFarm(farm, ["animais", "agenda_itens"], plan);
    expect((await db.state_animais.get(target))?.observacoes).toBe("local");
    expect(await db.state_animais.count()).toBe(3);
    expect(await db.state_agenda_itens.get("stale")).toBeDefined();
    expect((await db.queue_ops.get("p1"))?.expected_revision).toBe(1);
  });
});
