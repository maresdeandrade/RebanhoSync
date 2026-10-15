// Optional isolated SQL verification. Never uses an existing database or --apply.
// Install pinned PGlite packages outside this repo and set SANITARIO_PGLITE_MODULE_ROOT.
// Supabase auth and tenant prerequisites below are stubs: no RLS/auth/concurrency certification.
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import pg from "pg";
import * as contract from "../../scripts/codex/sanitario-v2-contract.mjs";
import * as publisher from "../../scripts/codex/import-sanitario-protocols-v2.mjs";
const dependencyRoot = process.env.SANITARIO_PGLITE_MODULE_ROOT;
assert(
  dependencyRoot,
  "Set SANITARIO_PGLITE_MODULE_ROOT to an external node_modules directory",
);
const { PGlite } = await import(
  pathToFileURL(path.join(dependencyRoot, "@electric-sql/pglite/dist/index.js"))
);
const { PGLiteSocketServer } = await import(
  pathToFileURL(
    path.join(dependencyRoot, "@electric-sql/pglite-socket/dist/index.js"),
  )
);
const root = process.cwd();
const db = await PGlite.create();
await db.exec(`
create schema auth;
create table auth.users(id uuid primary key);
create table public.fazendas(id uuid primary key);
create table public.produtos_veterinarios(id uuid primary key);
create table public.protocolos_sanitarios(id uuid primary key);
create table public.protocolos_sanitarios_itens(id uuid primary key);
create type public.estado_uf_enum as enum ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO');
create type public.farm_role_enum as enum ('owner','manager','worker','viewer');
create role authenticated;
create role anon;
create role service_role;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function public.has_membership(uuid) returns boolean language sql as $$select false$$;
create function public.role_in_fazenda(uuid, public.farm_role_enum[]) returns boolean language sql as $$select false$$;
`);
const migrations = [
  "20260608090000_sanitario_protocol_product_source_v2.sql",
  "20260610203500_sanitario_product_class_v2.sql",
  "20260615120000_sanitario_protocol_item_product_class_group_v2.sql",
  "20260923132000_sanitario_source_key_identity.sql",
];
for (const file of migrations)
  await db.exec(readFileSync(`${root}/supabase/migrations/${file}`, "utf8"));

const report = {
  environment: "PGlite PostgreSQL WASM, fresh memory database, loopback only",
  limitations: [
    "auth/tenant prerequisites stubbed",
    "single backend; no concurrency proof",
    "not Supabase end-to-end",
  ],
  engine: (await db.query("select version()")).rows[0].version,
  migrations: migrations.map((file) => ({
    file,
    sha256: createHash("sha256")
      .update(readFileSync(`${root}/supabase/migrations/${file}`))
      .digest("hex"),
  })),
  cases: [],
};
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 55432 });
let client;
const payloadPath = path.join(
  root,
  "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json",
);
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
report.payload_sha256 = createHash("sha256")
  .update(readFileSync(payloadPath))
  .digest("hex");
const data = contract.validateCanonicalTechnicalContract(payload).data;
const source = readFileSync(
  path.join(root, "scripts/codex/import-sanitario-protocols-v2.mjs"),
  "utf8",
);
const privateSource = source
  .slice(
    source.indexOf("const ROOT ="),
    source.indexOf("async function main()"),
  )
  .replace(/\bexport (?=(?:async )?function)/g, "");
const engine = runInNewContext(
  `${privateSource}\n({applyTransaction, PUBLISHERS});`,
  { ...contract, process, path, existsSync, readFileSync, Date },
);
const tables = engine.PUBLISHERS.map((p) => p.table);
const snapshot = async () => {
  const out = {};
  for (const table of tables)
    out[table] = (
      await client.query(`select * from public.${table} order by 1,2,3`)
    ).rows;
  return out;
};
async function check(name, run) {
  const evidence = await run();
  report.cases.push({ name, result: "PASS", evidence });
  console.log(`PASS ${name}`);
}
async function reset() {
  await client.query(
    `truncate ${tables.map((t) => `public.${t}`).join(",")} cascade`,
  );
}
function fixture(version = 1, previous) {
  const pid = previous?.protocol_rows[0].id ?? randomUUID();
  const key =
    previous?.protocol_rows[0].protocol_key ??
    `TEST_${pid.replaceAll("-", "")}`;
  return {
    protocol_rows: [
      {
        id: pid,
        protocol_key: key,
        family_code: key,
        name: "Synthetic test only",
        scope: "global",
        species_scope: ["bovino"],
        legal_status: "condicional",
        version: 1,
        status: "draft",
        metadata: { synthetic: true },
      },
    ],
    protocol_item_rows: [
      {
        id: randomUUID(),
        protocol_id: pid,
        protocol_key: key,
        logical_item_key: "synthetic_item",
        version,
        item_status: "recomendado",
        action_type: "manejo_sanitario",
        product_requirement_kind: "none",
        eligibility_rule: {},
        operational_window_rule: {},
        species_authorization: [],
        source_refs_by_field: {},
        snapshot_template: {
          metadata: {
            synthetic: true,
            ...(previous
              ? {
                  supersedes: {
                    id: previous.protocol_item_rows[0].id,
                    version: 1,
                  },
                }
              : {}),
          },
        },
        allows_agenda_auto: false,
        status: "draft",
      },
    ],
  };
}
try {
  await server.start();
  client = new pg.Client({
    host: "127.0.0.1",
    port: 55432,
    database: "postgres",
    user: "postgres",
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  await check(
    "canonical plan uses real PostgreSQL SQL and leaves all 14 tables empty",
    async () => {
      const before = await snapshot();
      const plan = await publisher.buildPlan(client, data);
      const counts = plan.reduce((out, op) => {
        out[op.action] = (out[op.action] ?? 0) + 1;
        return out;
      }, {});
      assert.deepEqual(counts, { create: 141, reject: 4 });
      assert.deepEqual(await snapshot(), before);
      return counts;
    },
  );
  await client.end();
  client = null;
  await check("actual CLI --dry-run succeeds without writes", async () => {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["scripts/codex/import-sanitario-protocols-v2.mjs", "--dry-run"],
        {
          cwd: root,
          env: {
            ...process.env,
            DB_URL: "postgresql://postgres@127.0.0.1:55432/postgres",
          },
        },
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (data) => (stdout += data));
      child.stderr.on("data", (data) => (stderr += data));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /publisher_complete=true/);
    assert.match(result.stdout, /"create":141,"update":0,"skip":0,"reject":4/);
    if (process.env.SANITARIO_SQL_EVIDENCE_DIR)
      writeFileSync(
        path.join(
          process.env.SANITARIO_SQL_EVIDENCE_DIR,
          "canonical-dry-run.log",
        ),
        result.stdout,
      );
    return {
      exit_code: result.code,
      summary: { create: 141, update: 0, skip: 0, reject: 4 },
    };
  });
  client = new pg.Client({
    host: "127.0.0.1",
    port: 55432,
    database: "postgres",
    user: "postgres",
  });
  await client.connect();
  assert(Object.values(await snapshot()).every((rows) => rows.length === 0));
  await check(
    "synthetic supersession retires only exact draft v1, preserves snapshot and converges",
    async () => {
      const original = fixture();
      await engine.applyTransaction(client, original);
      const before = (
        await client.query(
          "select * from public.sanitario_protocolo_itens_versions_v2 where id=$1",
          [original.protocol_item_rows[0].id],
        )
      ).rows[0];
      const next = fixture(2, original);
      const plan = await publisher.buildPlan(client, next);
      assert.equal(
        plan.find((op) => op.classification === "DEPRECATED_ITEM").action,
        "update",
      );
      await engine.applyTransaction(client, next);
      const after = (
        await client.query(
          "select * from public.sanitario_protocolo_itens_versions_v2 where id=$1",
          [before.id],
        )
      ).rows[0];
      assert.equal(after.status, "retired");
      assert(after.deleted_at);
      assert.deepEqual(after.snapshot_template, before.snapshot_template);
      publisher.assertConvergedPlan(await publisher.buildPlan(client, next));
      const replay = await engine.applyTransaction(client, next);
      assert.equal(replay.create, 0);
      assert.equal(replay.update, 0);
      await reset();
      return {
        retired_previous_only: true,
        snapshot_preserved: true,
        replay_updates: 0,
      };
    },
  );
  await check(
    "active predecessor rejects supersession and transaction rolls back",
    async () => {
      const original = fixture();
      await engine.applyTransaction(client, original);
      await client.query(
        "update public.sanitario_protocolo_itens_versions_v2 set status='active' where id=$1",
        [original.protocol_item_rows[0].id],
      );
      const before = await snapshot();
      const next = fixture(2, original);
      const plan = await publisher.buildPlan(client, next);
      assert.equal(
        plan.find((op) => op.reason === "deprecated_item_not_draft").action,
        "reject",
      );
      await assert.rejects(
        engine.applyTransaction(client, next),
        /deprecated_item_not_draft/,
      );
      assert.deepEqual(await snapshot(), before);
      await reset();
      return { no_partial_write: true };
    },
  );
  await check(
    "predecessor identity mismatch rejects and leaves database unchanged",
    async () => {
      const original = fixture();
      await engine.applyTransaction(client, original);
      await client.query(
        "update public.sanitario_protocolo_itens_versions_v2 set logical_item_key='different' where id=$1",
        [original.protocol_item_rows[0].id],
      );
      const before = await snapshot();
      await assert.rejects(
        publisher.buildPlan(client, fixture(2, original)),
        /superseded_item_identity_conflict/,
      );
      assert.deepEqual(await snapshot(), before);
      await reset();
      return { identity_reserved: true };
    },
  );
  await check(
    "real JSON and foreign key constraints reject invalid synthetic writes",
    async () => {
      const original = fixture();
      await engine.applyTransaction(client, original);
      await assert.rejects(
        client.query(
          "update public.sanitario_protocolo_itens_versions_v2 set dose_rule='[]'::jsonb where id=$1",
          [original.protocol_item_rows[0].id],
        ),
        (error) => error.code === "23514",
      );
      await assert.rejects(
        client.query(
          "update public.sanitario_protocolo_itens_versions_v2 set protocol_id=$1 where id=$2",
          [randomUUID(), original.protocol_item_rows[0].id],
        ),
        (error) => error.code === "23503",
      );
      await reset();
      return { json_check: "23514", foreign_key: "23503" };
    },
  );
  assert(Object.values(await snapshot()).every((rows) => rows.length === 0));
  report.status = "PASS_WITH_ENVIRONMENT_LIMITS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (client) await client.end();
  await server.stop();
  await db.close();
  if (process.env.SANITARIO_SQL_EVIDENCE_DIR)
    writeFileSync(
      path.join(process.env.SANITARIO_SQL_EVIDENCE_DIR, "pglite-evidence.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
}
