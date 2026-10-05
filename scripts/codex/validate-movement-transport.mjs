// Explicitly disposable LOCAL Supabase only; no reset, remote deploy or secret output.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

if (process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB !== "1") {
  throw new Error(
    "Movement HTTP tests persist facts; designate the local disposable environment explicitly",
  );
}
const status = execFileSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const env = {};
for (const line of status.split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=["']?(.*?)["']?$/);
  if (match) env[match[1]] = match[2];
}
for (const key of ["DB_URL", "API_URL"]) {
  const url = new URL(env[key]);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Refusing non-local movement target");
}
if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY)
  throw new Error("Local Auth credentials unavailable");
const db = new pg.Client({ connectionString: env.DB_URL });
await db.connect();
try {
  for (const [relation, file] of [
    [
      "animal_lot_movement_receipts",
      "20261001200402_f24_4e21a_animal_lot_movement_foundation.sql",
    ],
    [
      "animal_lot_movement_effect_decisions",
      "20261002005751_f24_4e211a_server_completion_gate.sql",
    ],
  ]) {
    if (
      !(
        await db.query("select to_regclass($1) relation", [
          `public.${relation}`,
        ])
      ).rows[0].relation
    ) {
      await db.query("begin");
      await db.query(readFileSync(`supabase/migrations/${file}`, "utf8"));
      await db.query("commit");
      console.log(
        `Prepared ${relation} in designated disposable LOCAL database`,
      );
    }
  }
  if (
    !(
      await db.query(
        "select to_regprocedure('public.guard_animal_lot_fact_insert_v1()') as guard",
      )
    ).rows[0].guard
  ) {
    await db.query("begin");
    await db.query(
      readFileSync(
        "supabase/migrations/20261003120000_f24_4e2_close_generic_animal_lot_fact_boundary.sql",
        "utf8",
      ),
    );
    await db.query("commit");
  }
  await db.query("begin");
  await db.query(
    readFileSync(
      "supabase/migrations/20261005175412_f24_4e_lot_pasture_subject_boundary.sql",
      "utf8",
    ),
  );
  await db.query("commit");
  await db.query("notify pgrst, 'reload schema'");
} finally {
  await db.end();
}

const child = spawn(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--maxWorkers=1",
    ...process.argv.slice(2),
    "supabase/tests/animalLotMovementTransport.e2e.test.ts",
    "supabase/tests/stateConflictSyncBatch.e2e.test.ts",
  ],
  {
    env: {
      ...process.env,
      REBANHOSYNC_TEST_API_URL: env.API_URL,
      REBANHOSYNC_TEST_ANON_KEY: env.ANON_KEY,
      REBANHOSYNC_TEST_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
      REBANHOSYNC_TEST_DB_URL: env.DB_URL,
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
process.exitCode = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => resolve(code ?? 1));
});
