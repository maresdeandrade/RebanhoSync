// Shared fixture only; canonical planning/writes remain in the existing importer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { withDisposableC02 } from "../../../scripts/codex/run-sanitario-c02-disposable.mjs";

const profiles = {
  p38: { marker: "C02_P38_DISPOSABLE_LOCAL_ONLY", flag: "--c02-p38", snapshot: "SANITARIO_V2_C02_P38_REMOTE_BEFORE_20261029.json", candidate: "SANITARIO_V2_C02_P38_REVIEW_CANDIDATE_20261028.json", output: "SANITARIO_V2_C02_P38_APPLY_20261029.sql", authorization: "C02-P38-20261029-EXPLICIT-USER-EXECUTIVE-CLOSURE" },
  f6: { marker: "C02_F6_CLOSURE_DISPOSABLE_LOCAL_ONLY", flag: "--c02-f6-closure", snapshot: "SANITARIO_V2_C02_F6_CLOSURE_ADMIN_BEFORE_20261029.json", candidate: "SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_20261029.json", output: "SANITARIO_V2_C02_F6_CLOSURE_APPLY_20261029.sql", authorization: "C02-F6-20261029-EXPLICIT-USER-CONSOLIDATED-CLOSURE" },
};

export async function rehearseReviewedSnapshot(profile, outputFile = null) {
  const config = profiles[profile];
  assert(config, "C02_REVIEWED_PROFILE_REQUIRED");
  const directory = "docs/review/evidence/";
  const snapshotFile = directory + config.snapshot;
  const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));
  assert.equal(snapshot.project_ref, "zqloazqzhwauamcejmuz");
  const tables = ["sanitario_fontes_tecnicas_v2", "sanitario_fonte_cobertura_campos_v2", "sanitario_produtos_v2", "sanitario_produto_especie_autorizacao_v2", "sanitario_produto_fontes_v2", "sanitario_produto_dose_rules_v2", "sanitario_produto_carencia_rules_v2", "sanitario_produto_carencia_fontes_v2"];
  await withDisposableC02({ scope: "p11", run: async ({ container, port }) => {
    const migration = readFileSync("supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql", "utf8");
    const identity = readFileSync("supabase/migrations/20260923132000_sanitario_source_key_identity.sql", "utf8");
    const ddl = migration.slice(0, migration.indexOf("drop trigger if exists"));
    const sourceIdentity = identity.slice(0, identity.indexOf("-- Preflight")) + "\n" + [...identity.matchAll(/create unique index ux_sanitario_fontes_v2_[\s\S]*?;/g)].map(m => m[0]).join("\n");
    execFileSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", "rebanhosync_c02_p11", "-v", "ON_ERROR_STOP=1"], {
      encoding: "utf8", input: `begin;
        comment on database rebanhosync_c02_p11 is '${config.marker}';
        create table if not exists public.fazendas(id uuid primary key);
        create table if not exists auth.users(id uuid primary key);
        do $$ begin create type public.estado_uf_enum as enum ('SP','GO','SC','DF'); exception when duplicate_object then null; end $$;
        ${ddl}\n${sourceIdentity}
        grant usage,create on schema public to postgres;
        grant usage on schema auth to postgres;
        ${tables.map(t => `alter table public.${t} owner to postgres;`).join("\n")}
        grant all on all tables in schema public to postgres;
        commit;`, stdio: ["pipe", "pipe", "pipe"],
    });
    const db = new pg.Client({ host: "127.0.0.1", port, user: "postgres", database: "rebanhosync_c02_p11" });
    await db.connect();
    try {
      for (const table of tables) for (const row of snapshot.rows[table]) {
        const columns = Object.keys(row);
        await db.query(`insert into public.${table} (${columns.join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")})`, columns.map(c => row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
      }
      const before = (await db.query("select count(*)::int as count from sanitario_produto_carencia_rules_v2")).rows[0].count;
      const result = execFileSync(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", config.flag, directory + config.candidate, "--local-port", String(port), "--mcp-snapshot", snapshotFile, "--emit-mcp-apply", outputFile ?? directory + config.output, "--project-ref", "zqloazqzhwauamcejmuz", "--authorization-ref", config.authorization], { encoding: "utf8" });
      assert.equal((await db.query("select count(*)::int as count from sanitario_produto_carencia_rules_v2")).rows[0].count, before);
      console.log(result.trim());
    } finally { await db.end(); }
  } });
}
