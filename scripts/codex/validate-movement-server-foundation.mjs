// Local disposable PostgreSQL only. Copies schema, never application data or remote databases.
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const status = execFileSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const dbLine = status.split(/\r?\n/).find((line) => line.startsWith("DB_URL="));
if (!dbLine) throw new Error("Supabase local DB_URL unavailable");
const sourceUrl = new URL(dbLine.slice(7).replace(/^["']|["']$/g, ""));
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname) ||
  !["postgres:", "postgresql:"].includes(sourceUrl.protocol)
) {
  throw new Error("Refusing non-local PostgreSQL target");
}
const project = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([\w-]+)"/m,
)?.[1];
if (!project) throw new Error("Local Supabase project_id unavailable");
const database = `f24_movement_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Client({ connectionString: sourceUrl.href });
await admin.connect();
let isolated;
let created = false;
try {
  const schema = execFileSync(
    "docker",
    [
      "exec",
      `supabase_db_${project}`,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      sourceUrl.pathname.slice(1),
      "--schema-only",
      // Domain/Auth contracts only; platform GraphQL/Realtime/Storage are tested by baseline-functional.
      "--schema=public",
      "--schema=auth",
      "--schema=extensions",
    ],
    {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("\\"))
    .join("\n");
  await admin.query(`create database "${database}"`);
  created = true;
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${database}`;
  isolated = new pg.Client({ connectionString: testUrl.href });
  await isolated.connect();
  // Only the empty default schema of the just-created, uniquely named database.
  await isolated.query("drop schema public");
  // Restore platform objects/owners using the container administrator. Credentials remain
  // inside its existing environment; neither emitted nor written to artifacts.
  try {
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        `supabase_db_${project}`,
        "bash",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" psql --no-psqlrc -U supabase_admin -d "$1" -v ON_ERROR_STOP=1',
        "movement-schema-restore",
        database,
      ],
      {
        input: schema,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
  } catch (error) {
    throw new Error(
      `Local schema restore failed: ${error.stderr?.toString().trim() ?? "no diagnostic"}`,
    );
  }
  // Schema-filtered pg_dump omits CREATE EXTENSION. Use the real installed crypto extension.
  await isolated.query(
    "create extension if not exists pgcrypto with schema extensions",
  );
  const alreadyApplied = await isolated.query(
    "select to_regclass('public.animal_lot_movement_receipts') as relation",
  );
  if (!alreadyApplied.rows[0].relation) {
    const migration = readFileSync(
      "supabase/migrations/20261001200402_f24_4e21a_animal_lot_movement_foundation.sql",
      "utf8",
    );
    await isolated.query("begin");
    await isolated.query(migration);
    await isolated.query("commit");
  }
  // Existing commercial concurrency suite requires one real membership; no source data copied.
  const user = randomUUID();
  const farm = randomUUID();
  await isolated.query("insert into auth.users(id, email) values ($1, $2)", [
    user,
    `${user}@movement.invalid`,
  ]);
  await isolated.query(
    "insert into public.fazendas(id,nome) values ($1,'Movement disposable baseline')",
    [farm],
  );
  await isolated.query(
    "insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,'owner')",
    [user, farm],
  );
  console.log(
    "Disposable local schema prepared; running focused PostgreSQL suites.",
  );
  const child = spawn(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "supabase/tests/animalLotMovementFoundation.test.ts",
      "supabase/tests/stateConflictConcurrency.test.ts",
      "supabase/tests/commercialOperationV2Concurrency.test.ts",
    ],
    {
      env: {
        ...process.env,
        REBANHOSYNC_TEST_DB_URL: testUrl.href,
        REBANHOSYNC_MOVEMENT_DISPOSABLE_DB: "1",
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const result = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = result;
} finally {
  await isolated?.end();
  if (created) {
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()",
      [database],
    );
    await admin.query(`drop database "${database}"`);
    console.log(
      "Disposable test database removed; source database data unchanged.",
    );
  }
  await admin.end();
}
