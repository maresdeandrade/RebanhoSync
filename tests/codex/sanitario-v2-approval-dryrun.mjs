// Disposable PostgreSQL WASM only. Reuses the canonical planner and actual CLI.
// Auth prerequisites are stubs; this does not certify hosted Supabase/RLS/concurrency.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import { buildApprovalCandidate, CANONICAL_PATH, DECISION_PATH } from "../../scripts/codex/prepare-sanitario-approval-v2.mjs";
import { validateCanonicalTechnicalContract } from "../../scripts/codex/sanitario-v2-contract.mjs";
import { buildPlan, assertPublishablePlan } from "../../scripts/codex/import-sanitario-protocols-v2.mjs";

const dependencyRoot = process.env.SANITARIO_PGLITE_MODULE_ROOT;
assert(dependencyRoot, "Defina SANITARIO_PGLITE_MODULE_ROOT para dependencias externas existentes");
const { PGlite } = await import(pathToFileURL(path.join(dependencyRoot, "@electric-sql/pglite/dist/index.js")));
const { PGLiteSocketServer } = await import(pathToFileURL(path.join(dependencyRoot, "@electric-sql/pglite-socket/dist/index.js")));
const canonicalBytes = readFileSync(CANONICAL_PATH);
const packetBytes = readFileSync(DECISION_PATH);
const candidate = buildApprovalCandidate(JSON.parse(canonicalBytes), JSON.parse(packetBytes), canonicalBytes, packetBytes);
const outputDir = mkdtempSync(path.join(tmpdir(), "sanitario-approval-dryrun-"));
const candidatePath = path.join(outputDir, "candidate.json");
writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + "\n");
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 55434 });
let client;
try {
  await db.exec(`
create schema auth;
create table auth.users(id uuid primary key);
create table public.fazendas(id uuid primary key);
create table public.produtos_veterinarios(id uuid primary key);
create table public.protocolos_sanitarios(id uuid primary key);
create table public.protocolos_sanitarios_itens(id uuid primary key);
create type public.estado_uf_enum as enum ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO');
create type public.farm_role_enum as enum ('owner','manager','worker','viewer');
create role authenticated;
create role anon;
create role service_role;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function public.has_membership(uuid) returns boolean language sql as $$select false$$;
create function public.role_in_fazenda(uuid, public.farm_role_enum[]) returns boolean language sql as $$select false$$;
`);
  for (const name of ["20260608090000_sanitario_protocol_product_source_v2.sql", "20260610203500_sanitario_product_class_v2.sql",
    "20260615120000_sanitario_protocol_item_product_class_group_v2.sql", "20260923132000_sanitario_source_key_identity.sql"])
    await db.exec(readFileSync(path.join("supabase/migrations", name), "utf8"));
  await server.start();
  const connect = async () => {
    const connection = new pg.Client({ host: "127.0.0.1", port: 55434, user: "postgres", database: "postgres", connectionTimeoutMillis: 5000 });
    await connection.connect();
    return connection;
  };
  client = await connect();
  const plan = await buildPlan(client, validateCanonicalTechnicalContract(candidate).data);
  assertPublishablePlan(plan);
  const counts = plan.reduce((out, op) => ({ ...out, [op.action]: (out[op.action] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { create: 144, reject: 4 });
  const tables = [...new Set(plan.map((op) => op.table))];
  const assertEmpty = async () => {
    for (const table of tables) {
      assert(/^sanitario_[a-z_0-9]+$/.test(table));
      assert.equal(Number((await client.query(`select count(*) from public.${table}`)).rows[0].count), 0);
    }
  };
  await assertEmpty();
  await client.end(); client = null;
  const run = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", "--dry-run", "--review-candidate", candidatePath],
      { env: { ...process.env, DB_URL: "postgresql://postgres@127.0.0.1:55434/postgres" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (bytes) => { stdout += bytes; });
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  assert.equal(run.code, 0, run.stderr);
  client = await connect();
  await assertEmpty();
  assert.deepEqual(readFileSync(CANONICAL_PATH), canonicalBytes);
  const evidence = { result: "PASS", environment: "fresh PostgreSQL WASM in memory, loopback only",
    limitations: ["Auth/tenant prerequisites stubbed", "No hosted RLS or concurrency certification", "No writes performed by the planner or CLI"],
    candidate_sha256: createHash("sha256").update(readFileSync(candidatePath)).digest("hex"),
    plan_counts: counts, expected_member_rejections: 4, tables_checked_empty: tables.length,
    actual_cli_dry_run_exit: run.code, canonical_bytes_unchanged: true, signatures_created: 0 };
  writeFileSync(path.join(outputDir, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ ...evidence, evidence_directory: outputDir }));
} finally {
  if (client) await client.end();
  await server.stop();
  await db.close();
}
