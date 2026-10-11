import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { assertLocalUrl, assertMigrationBaseline } from "./performance-contract.mjs";

// CLI secrets are captured in memory. No linked/remote command or env file.
export function readLocalConnection() {
  let text;
  try {
    const workdir = process.env.REBANHOSYNC_BENCHMARK_SUPABASE_WORKDIR;
    text = execFileSync("supabase", ["status", "-o", "env", ...(workdir ? ["--workdir", workdir] : [])], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  } catch { throw new Error("LOCAL_STATUS_UNAVAILABLE"); }
  const values = Object.fromEntries(text.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, "")];
  }));
  assertLocalUrl(values.API_URL, ["http:"]);
  assertLocalUrl(values.DB_URL, ["postgres:", "postgresql:"]);
  if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY) throw new Error("LOCAL_KEYS_UNAVAILABLE");
  return { api: values.API_URL, database: values.DB_URL, anon: values.ANON_KEY, service: values.SERVICE_ROLE_KEY };
}

export async function seedLocalFixture(connection, options) {
  if (process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB !== "1") throw new Error("DISPOSABLE_LOCAL_OPT_IN_REQUIRED");
  const sql = new pg.Client({ connectionString: connection.database });
  const admin = createClient(connection.api, connection.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = randomUUID();
  const fixture = {
    farms: Array.from({ length: options.farms }, () => randomUUID()),
    animals: [], email: `f24-6-${user}@example.test`, password: `Aa1!${randomUUID()}`,
  };
  let connected = false;
  let userCreated = false;
  const createdFarms = [];
  const cleanup = async () => {
    try {
      if (connected && createdFarms.length) {
      // Delete only newly generated fixture farms, with server-side cascades.
      // Never enumerate/delete preexisting application rows or disable constraints.
      await sql.query("delete from public.fazendas where id = any($1::uuid[]) and nome = 'F24.6 benchmark fixture'", [createdFarms]);
      const remaining = await sql.query("select count(*)::int as n from public.fazendas where id = any($1::uuid[])", [createdFarms]);
      if (remaining.rows[0].n !== 0) throw new Error("LOCAL_FIXTURE_CLEANUP_FAILED");
      }
      if (userCreated) {
        const { error } = await admin.auth.admin.deleteUser(user);
        if (error) throw new Error("LOCAL_AUTH_CLEANUP_FAILED");
        if (connected) {
          const users = await sql.query("select count(*)::int as n from auth.users where id = $1", [user]);
          if (users.rows[0].n !== 0) throw new Error("LOCAL_AUTH_CLEANUP_FAILED");
        }
        userCreated = false;
      }
      return { fixture_farms_deleted: true, fixture_user_deleted: true };
    } finally {
      if (connected) { await sql.end(); connected = false; }
    }
  };
  try {
    await sql.connect(); connected = true;
    const environment = {
      postgres_version: (await sql.query("show server_version")).rows[0].server_version,
      migration_versions: (await sql.query("select version from supabase_migrations.schema_migrations order by version")).rows.map(row => row.version),
    };
    const expectedVersions = readdirSync("supabase/migrations").filter(name => /^\d+_.*\.sql$/.test(name)).map(name => name.split("_")[0]);
    environment.migration_history_match = assertMigrationBaseline(environment.migration_versions, expectedVersions, options.purpose);
    environment.missing_versions = expectedVersions.filter(version => !environment.migration_versions.includes(version));
    const { error } = await admin.auth.admin.createUser({ id: user, email: fixture.email, password: fixture.password, email_confirm: true });
    if (error) throw new Error("LOCAL_AUTH_SEED_FAILED");
    userCreated = true;
    for (const farm of fixture.farms) {
      await sql.query("insert into public.fazendas(id,nome) values($1,'F24.6 benchmark fixture')", [farm]);
      createdFarms.push(farm);
      await sql.query("insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,'owner',now())", [user, farm]);
    }
    const count = options.workload === "reconnect" ? options.gestures : options.animals;
    for (let i = 0; i < count; i++) fixture.animals.push({ id: randomUUID(), fazenda_id: fixture.farms[i % fixture.farms.length] });
    const inserted = await sql.query("insert into public.animais(id,fazenda_id,identificacao,sexo,observacoes) select x.id,x.fazenda_id,x.id::text,'F','F24.6 benchmark baseline' from jsonb_to_recordset($1::jsonb) as x(id uuid,fazenda_id uuid)", [JSON.stringify(fixture.animals)]);
    const actual = (await sql.query('select count(*)::int as n from public.animais where fazenda_id=any($1::uuid[])', [fixture.farms])).rows[0].n;
    if (inserted.rowCount !== count || actual !== count) throw new Error('REMOTE_FIXTURE_COUNT_MISMATCH');
    environment.fixture_animals_expected = count;
    environment.fixture_animals_actual = actual;
    return { fixture, cleanup, environment };
  } catch (error) {
    try { await cleanup(); } catch { throw new Error("LOCAL_SEED_AND_CLEANUP_FAILED"); }
    throw error;
  }
}
