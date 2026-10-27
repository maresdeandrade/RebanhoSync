import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const module = await import("../../scripts/codex/run-sanitario-c02-disposable.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const externalId = "b".repeat(64);
function engine(options = {}) {
  const containers = new Map([[externalId, { state: "running", runId: "external", autoRemove: false }]]);
  const calls = [];
  let sequence = 0;
  const docker = async args => {
    calls.push(args);
    const id = args.at(-1);
    if (args[0] === "create") {
      if (options.collision) throw new Error("name already in use");
      const created = (++sequence).toString(16).padStart(64, "a");
      const runId = args[args.indexOf("--label") + 1].split("=")[1];
      containers.set(created, { state: "created", runId, autoRemove: args.includes("--rm") });
      if (options.createWithoutCid) throw new Error("create response lost before CID write");
      writeFileSync(args[args.indexOf("--cidfile") + 1], created);
      if (options.partialCreate) throw new Error("create response lost");
      return created;
    }
    const container = containers.get(id);
    if (args[0] === "inspect") {
      if (!container) throw Object.assign(new Error("No such object"), { stderr: "No such object" });
      return JSON.stringify({ id, runId: options.foreignLabel ? "external" : container.runId, state: container.state, mounts: [] });
    }
    if (args[0] === "start") {
      if (options.startFailure) throw new Error("start failed");
      container.state = "running";
      return id;
    }
    if (args[0] === "port") return "127.0.0.1:61234\n";
    if (args[0] === "exec") {
      if (options.notReady) throw new Error("database not ready");
      return "accepting connections";
    }
    if (args[0] === "logs") return "database ready\npassword=must-not-be-persisted\n";
    if (args[0] === "stop") {
      if (options.stopFailure) throw new Error("daemon unavailable");
      container.state = "exited";
      if (container.autoRemove) containers.delete(id);
      return id;
    }
    if (args[0] === "rm") { containers.delete(id); return id; }
    throw new Error(`Unexpected Docker command ${args[0]}`);
  };
  return { docker, calls, containers };
}
const directory = () => mkdtempSync(path.join(tmpdir(), "c02-lifecycle-test-"));
const launch = options => {
  expect(module.withDisposableC02, "A managed launcher must replace detached run + stop without removal").toBeTypeOf("function");
  return module.withDisposableC02(options);
};

describe("C02 execution-owned container lifecycle (simulated Docker only)", () => {
  it("reproduces accumulation from the recorded detached run/stop pattern", async () => {
    const fake = engine();
    const cidfile = path.join(directory(), "cid");
    const id = await fake.docker(["create", "--label", "run=historical", "--cidfile", cidfile]);
    await fake.docker(["start", id]);
    await fake.docker(["stop", id]);
    expect(fake.containers.get(id).state).toBe("exited");
    expect(fake.containers.size).toBe(2);
  });

  it("leaves no owned container after successful execution and retains diagnostics", async () => {
    const fake = engine(), artifactDir = directory();
    const result = await launch({ scope: "f6", docker: fake.docker, artifactDir, run: async context => {
      expect(context.port).toBe(61234);
      expect(context.container).toMatch(/^[a-f0-9]{64}$/);
      return "fixture passed";
    } });
    expect(result).toBe("fixture passed");
    expect([...fake.containers.keys()]).toEqual([externalId]);
    expect(fake.calls.find(c => c[0] === "create")).toContain("--rm");
    expect(readFileSync(path.join(artifactDir, "container.log"), "utf8")).not.toContain("must-not-be-persisted");
    expect(JSON.parse(readFileSync(path.join(artifactDir, "run.json"))).status).toBe("cleaned");
  });

  it("cleans its own container when the SQL harness fails", async () => {
    const fake = engine();
    await expect(launch({ scope: "p11", docker: fake.docker, artifactDir: directory(), run: async () => { throw new Error("SQL failure"); } })).rejects.toThrow("SQL failure");
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("removes a created container when startup fails", async () => {
    const fake = engine({ startFailure: true });
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), run: async () => {} })).rejects.toThrow("start failed");
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("recovers its exact CID if create succeeded but its response was lost", async () => {
    const fake = engine({ partialCreate: true });
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), run: async () => {} })).rejects.toThrow("create response lost");
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("records indeterminate creation when the daemon creates but returns no CID", async () => {
    const fake = engine({ createWithoutCid: true }), artifactDir = directory();
    let executed = false;
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir, run: async () => { executed = true; } }))
      .rejects.toThrow("create response lost before CID write");
    const owned = [...fake.containers.entries()].find(([id]) => id !== externalId);
    expect(owned[1].state).toBe("created");
    const record = JSON.parse(readFileSync(path.join(artifactDir, "run.json")));
    expect(record.status).toBe("creation_indeterminate");
    expect(record.container).toBeNull();
    expect(record.runId).toBe(owned[1].runId);
    const create = fake.calls[0];
    expect(record.name).toBe(create[create.indexOf("--name") + 1]);
    expect(record.warnings).toContain("container_creation_indeterminate_manual_recovery_required");
    expect(fake.calls.map(call => call[0])).toEqual(["create"]);
    expect(executed).toBe(false);
    expect(fake.containers.get(externalId).state).toBe("running");
  });

  it("does not remove any container after a name collision", async () => {
    const fake = engine({ collision: true });
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), run: async () => {} })).rejects.toThrow("name already in use");
    expect(fake.calls.some(c => ["stop", "rm"].includes(c[0]))).toBe(false);
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("refuses cleanup if the ownership label does not match", async () => {
    const fake = engine({ foreignLabel: true });
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), run: async () => {} })).rejects.toThrow("C02_CONTAINER_OWNERSHIP_MISMATCH");
    expect(fake.calls.some(c => ["stop", "rm"].includes(c[0]))).toBe(false);
  });

  it("cleans after readiness timeout without invoking the SQL harness", async () => {
    const fake = engine({ notReady: true });
    let executed = false;
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), readinessMs: 0, run: async () => { executed = true; } })).rejects.toThrow("C02_DATABASE_NOT_READY");
    expect(executed).toBe(false);
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("waits for TCP readiness instead of the temporary init Unix socket", async () => {
    const fake = engine();
    await launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), run: async () => {} });
    const readiness = fake.calls.find(c => c[0] === "exec");
    expect(readiness[readiness.indexOf("-h") + 1]).toBe("127.0.0.1");
  });

  it("cleans on cancellation of the owning execution", async () => {
    const fake = engine(), controller = new AbortController();
    await expect(launch({ scope: "f6", docker: fake.docker, signal: controller.signal, artifactDir: directory(), run: async () => {
      controller.abort(new Error("execution interrupted"));
      controller.signal.throwIfAborted();
    } })).rejects.toThrow("execution interrupted");
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("uses distinct names and ownership under concurrent submissions", async () => {
    const fake = engine();
    await Promise.all(["f6", "f6"].map(scope => launch({ scope, docker: fake.docker, artifactDir: directory(), run: async () => {} })));
    const creates = fake.calls.filter(c => c[0] === "create");
    expect(new Set(creates.map(c => c[c.indexOf("--name") + 1])).size).toBe(2);
    expect([...fake.containers.keys()]).toEqual([externalId]);
  });

  it("reports cleanup failure and preserves its recovery identity", async () => {
    const fake = engine({ stopFailure: true }), artifactDir = directory();
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir, run: async () => {} })).rejects.toThrow("daemon unavailable");
    const record = JSON.parse(readFileSync(path.join(artifactDir, "run.json")));
    expect(record.status).toBe("cleanup_failed");
    expect(record.container).toMatch(/^[a-f0-9]{64}$/);
    expect(record.runId).toBeTruthy();
    expect(readdirSync(artifactDir)).toContain("cid");
  });

  it("preserves both the SQL and cleanup errors instead of reporting success", async () => {
    const fake = engine({ stopFailure: true });
    const error = await launch({ scope: "f6", docker: fake.docker, artifactDir: directory(),
      run: async () => { throw new Error("SQL failed first"); } }).catch(error => error);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors.map(e => e.message)).toEqual(["SQL failed first", "daemon unavailable"]);
  });

  it("rejects already cancelled execution before creating a container", async () => {
    const fake = engine(), controller = new AbortController();
    controller.abort(new Error("cancelled before start"));
    await expect(launch({ scope: "f6", docker: fake.docker, artifactDir: directory(), signal: controller.signal,
      run: async () => {} })).rejects.toThrow("cancelled before start");
    expect(fake.calls).toEqual([]);
  });

  it("does not invoke Docker when the CLI lacks explicit local execution opt-in", () => {
    const result = spawnSync(process.execPath, ["scripts/codex/run-sanitario-c02-disposable.mjs"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Usage (creates/deletes only its NEW container)");
  });
});
