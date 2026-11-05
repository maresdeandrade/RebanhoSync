import { describe, expect, it, vi } from "vitest";
import { assertDisposableDatabase, finishBlockedPair } from "../../../../tests/codex/helpers/obitoDisposableGuards.mjs";

describe("disposable obito harness guards", () => {
  it("requires authorization before issuing any SQL", () => {
    const psql = vi.fn();
    expect(() => assertDisposableDatabase(psql, "owned", {})).toThrow();
    expect(psql).not.toHaveBeenCalled();
  });
  it.each([
    [{ status: 1, stderr: "connection failed", stdout: "owned" }, false],
    [{ status: 0, stderr: "", stdout: "other" }, false],
    [{ status: 0, stderr: "", stdout: "owned\n" }, true],
  ])("checks query result and exact database identity: %j", (result, accepted) => {
    const run = () => assertDisposableDatabase(() => result, "owned", { A05_B04_ALLOW_DISPOSABLE: "1" });
    if (accepted) expect(run).not.toThrow();
    else expect(run).toThrow();
  });
  it("requires an observed lock before committing and preserves both session results", async () => {
    const order: string[] = [];
    const firstResult = { code: 0, output: "first", error: "" };
    const secondResult = { code: 3, output: "second", error: "expected conflict" };
    const first = { child: { stdin: { end: () => order.push("first:end") } }, write: (value: string) => order.push(value), done: Promise.resolve(firstResult) };
    const second = { child: { stdin: { end: () => order.push("second:end") } }, done: Promise.resolve(secondResult) };
    const sql = vi.fn(() => { order.push("lock"); return "1"; });
    const until = async (condition: () => boolean) => { expect(condition()).toBe(true); };
    expect(await finishBlockedPair({ sql, first, second, until, app: "owned-session" })).toEqual([firstResult, secondResult]);
    expect(order).toEqual(["second:end", "lock", "commit;", "first:end"]);
    expect(sql).toHaveBeenCalledWith(expect.stringContaining("wait_event_type='Lock'"));
  });
});
