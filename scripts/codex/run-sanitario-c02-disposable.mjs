// Opt-in owner of NEW disposable C02 containers. Never adopts an existing name.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const exec = promisify(execFile);
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const ownerLabel = "com.rebanhosync.c02.run";
const idPattern = /^[a-f0-9]{64}$/;
const inspectFormat = `{"id":{{json .Id}},"runId":{{json (index .Config.Labels "${ownerLabel}")}},"state":{{json .State.Status}},"mounts":{{json .Mounts}}}`;
const realDocker = async args => {
  const result = await exec("docker", args, {
    encoding: "utf8", timeout: 15000, maxBuffer: 4 * 1024 * 1024,
  });
  return args[0] === "logs" ? result.stdout + result.stderr : result.stdout;
};

export async function withDisposableC02({ scope, run, docker = realDocker,
  artifactDir = mkdtempSync(path.join(tmpdir(), "rebanhosync-c02-run-")),
  signal, readinessMs = 90000 }) {
  assert(["p11", "f6"].includes(scope), "C02_SCOPE_REQUIRED");
  assert.equal(typeof run, "function", "C02_HARNESS_REQUIRED");
  signal?.throwIfAborted();
  const runId = randomUUID();
  const name = `rebanhosync-c02-${scope}-sql-${BigInt(`0x${runId.replaceAll("-", "")}`)}`;
  const cidfile = path.join(artifactDir, "cid");
  assert(!existsSync(cidfile), "C02_CIDFILE_ALREADY_EXISTS");
  const record = { runId, name, image, scope, container: null, status: "creating", warnings: [] };
  const save = () => writeFileSync(path.join(artifactDir, "run.json"), JSON.stringify(record, null, 2) + "\n");
  let id, failure, value;
  save();
  try {
    id = (await docker(["create", "--rm", "--pull=never", "--restart=no",
      "--name", name, "--label", `${ownerLabel}=${runId}`, "--cidfile", cidfile,
      "--publish", "127.0.0.1::5432", "--env", `POSTGRES_DB=rebanhosync_c02_${scope}`,
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "PGDATA=/var/lib/postgresql/c02-data",
      image, "postgres", "-D", "/var/lib/postgresql/c02-data", "-c", "listen_addresses=*"])).trim();
    assert(idPattern.test(id), "C02_INVALID_CONTAINER_ID");
    record.container = id;
    record.status = "created";
    save();
    signal?.throwIfAborted();
    await docker(["start", id]);
    const deadline = Date.now() + readinessMs;
    let ready = false;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      try {
        await docker(["exec", id, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", `rebanhosync_c02_${scope}`]);
        ready = true;
        break;
      } catch {
        await delay(Math.min(250, Math.max(0, deadline - Date.now())), undefined, { signal });
      }
    }
    assert(ready, "C02_DATABASE_NOT_READY");
    const binding = (await docker(["port", id, "5432/tcp"])).trim();
    assert.match(binding, /^127\.0\.0\.1:\d+$/, "C02_LOOPBACK_BINDING_REQUIRED");
    const port = Number(binding.split(":")[1]);
    assert(port > 0 && port <= 65535, "C02_INVALID_PORT");
    record.status = "running";
    save();
    signal?.throwIfAborted();
    value = await run({ container: id, name, port, scope, artifactDir });
  } catch (error) {
    failure = error;
  } finally {
    // A lost create response can still leave our CID file. Never fall back to a name/prefix.
    if (!idPattern.test(id ?? "") && existsSync(cidfile)) id = readFileSync(cidfile, "utf8").trim();
    if (idPattern.test(id ?? "")) {
      record.container = id;
      try {
        let owned;
        try { owned = JSON.parse(await docker(["inspect", "--format", inspectFormat, id])); }
        catch (error) {
          if (!/No such (object|container)/i.test(`${error.message} ${error.stderr ?? ""}`)) throw error;
        }
        if (owned) {
          assert(owned.id === id && owned.runId === runId && owned.mounts.length === 0, "C02_CONTAINER_OWNERSHIP_MISMATCH");
          try {
            const logs = await docker(["logs", "--tail", "200", id]);
            const safe = logs.split("\n").map(line => /password|secret|token|authorization|jwt|postgres(?:ql)?:\/\/|eyJ[\w-]+\.[\w-]+\.[\w-]+/i.test(line) ? "[REDACTED]" : line).join("\n");
            writeFileSync(path.join(artifactDir, "container.log"), safe);
          } catch { record.warnings.push("container_logs_unavailable"); }
          if (owned.state === "running") await docker(["stop", "--time", "10", id]);
          else await docker(["rm", id]);
        }
        record.status = "cleaned";
      } catch (cleanupError) {
        record.status = "cleanup_failed";
        failure = failure ? new AggregateError([failure, cleanupError], "C02_EXECUTION_AND_CLEANUP_FAILED") : cleanupError;
      }
    } else {
      record.status = "creation_indeterminate";
      record.warnings.push("container_creation_indeterminate_manual_recovery_required");
    }
    save();
  }
  if (failure) throw failure;
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [consent, scope, mode, ...extra] = process.argv.slice(2);
  assert(consent === "--run-local" && ["p11", "f6"].includes(scope) && !extra.length &&
    (!mode || (scope === "f6" && mode === "integration")),
  "Usage (creates/deletes only its NEW container): --run-local p11|f6 [integration]");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error("C02_EXECUTION_INTERRUPTED"));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const timeout = setTimeout(() => controller.abort(new Error("C02_EXECUTION_TIMEOUT")), 20 * 60 * 1000);
  const artifactDir = mkdtempSync(path.join(tmpdir(), "rebanhosync-c02-run-"));
  console.log(`C02 lifecycle diagnostics: ${artifactDir}`);
  try {
    await withDisposableC02({ scope, signal: controller.signal, artifactDir, run: async context => {
      const { stdout } = await exec(process.execPath, ["tests/codex/sanitario-c02-p11.local.mjs", context.name,
        String(context.port), scope, ...(mode ? [mode] : [])],
      { cwd: root, signal: controller.signal, maxBuffer: 4 * 1024 * 1024 });
      process.stdout.write(stdout);
    } });
  } finally {
    clearTimeout(timeout);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}
