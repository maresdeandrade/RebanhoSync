// Preparation only. Produces SQL; does not connect or authorize its execution.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [mode, output] = process.argv.slice(2);
assert(["dry-run", "apply"].includes(mode) && output && process.argv.length === 4,
  "Use <dry-run|apply> <new output SQL file>");
const previous = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_BACKEND_PREFLIGHT_20261019.json"));
const migrations = previous.migration_comparison.pending;
assert.equal(migrations.length, 3);
const fingerprint = createHash("md5").update(previous.inventory.migrations
  .map(m => m.version + ":" + m.name).join("|")).digest("hex");
const before = `jsonb_build_object(
 'catalog',(select count(*) from public.sanitario_protocolos_v2),
 'items',(select count(*) from public.sanitario_protocolo_itens_versions_v2),
 'ledger',(select count(*) from public.sanitario_sync_v2_operations),
 'gates',(select count(*) from public.sanitario_sync_v2_gates),
 'config', (select md5(jsonb_agg(to_jsonb(c) order by fazenda_id)::text) from public.fazenda_sanidade_config c))`;
const statements = migrations.map(m => {
  const bytes = readFileSync(path.join("supabase/migrations", m.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), m.sha256, "Exact migration hash required");
  let sql = bytes.toString();
  if (m.file.startsWith("20261015070038_")) {
    assert.equal(sql.match(/^begin;\s*$/gm)?.length, 1);
    assert.equal(sql.match(/^commit;\s*$/gm)?.length, 1);
    // Replace only the first migration's outer transaction with the all-or-nothing batch.
    sql = sql.replace(/^begin;\s*$/gm, "").replace(/^commit;\s*$/gm, "");
  }
  const version = m.file.split("_")[0], name = m.file.slice(15, -4);
  const delimiter = "$r01_" + m.sha256.slice(0, 12) + "$";
  assert(!bytes.toString().includes(delimiter));
  return `-- ${m.file} SHA256 ${m.sha256}\n${sql}\n` +
    `insert into supabase_migrations.schema_migrations(version,name,statements) values ` +
    `('${version}','${name}',array[${delimiter}${bytes.toString()}${delimiter}]);\n`;
});
const sql = `-- Destination: zqloazqzhwauamcejmuz. R01 only. Mode: ${mode}.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('rebanhosync:R01:20261019',0));
lock table supabase_migrations.schema_migrations in exclusive mode;
do $r01pre$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>60 or
 (select md5(string_agg(version||':'||name,'|' order by version)) from supabase_migrations.schema_migrations)<>'${fingerprint}' then
  raise exception 'R01_MIGRATION_BASELINE_DIVERGED'; end if;
 if exists(select 1 from public.sanitario_sync_v2_gates where enabled) or
 exists(select 1 from public.sanitario_protocolos_v2) or
 exists(select 1 from public.sanitario_protocolo_itens_versions_v2) then
  raise exception 'R01_NONEMPTY_CATALOG_OR_ENABLED_GATE'; end if;
end $r01pre$;
select set_config('rebanhosync.r01_before',(${before})::text,true);
${statements.join("\n")}
do $r01post$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>63 then raise exception 'R01_HISTORY_COUNT'; end if;
 if (${before}) is distinct from current_setting('rebanhosync.r01_before')::jsonb then
  raise exception 'R01_UNEXPECTED_DATA_CHANGE'; end if;
 if to_regprocedure('public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid)') is null or
 to_regprocedure('public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb)') is null or
 to_regprocedure('public.internal_sanitario_sync_v2_reschedule_agenda(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,date)') is null then
  raise exception 'R01_EXPECTED_RPC_MISSING'; end if;
end $r01post$;
${mode === "apply" ? "commit" : "rollback"};
`;
writeFileSync(output, sql, { flag: "wx" });
console.log(JSON.stringify({ mode, migrations: migrations.map(m => m.file), sql_sha256:
  createHash("sha256").update(sql).digest("hex"), transaction: "single batch", executes_remote: false }));
