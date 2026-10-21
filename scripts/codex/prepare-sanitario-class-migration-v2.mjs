// Preparation only: exact single-migration transaction, history CAS and retry.
// psql executes the resulting file only after separate remote authorization.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CLASS_DELTA_PATH } from "./prepare-sanitario-class-delta-v2.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export function prepareClassMigration(mode) {
  assert(["dry-run", "apply"].includes(mode), "Use dry-run or apply");
  const packet = JSON.parse(readFileSync(CLASS_DELTA_PATH, "utf8"));
  const previous = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_BACKEND_PREFLIGHT_20261019.json", "utf8"));
  const baseline = [...previous.inventory.migrations, ...previous.migration_comparison.pending.map(m => ({
    version: m.file.slice(0, 14), name: m.file.slice(15, -4),
  }))].sort((a, b) => a.version.localeCompare(b.version));
  assert.equal(baseline.length, 63);
  const fingerprint = createHash("md5").update(baseline.map(m => `${m.version}:${m.name}`).join("|")).digest("hex");
  const original = readFileSync(packet.inputs.migration.path, "utf8");
  assert.equal(sha(original), packet.inputs.migration.sha256, "MIGRATION_HASH_CONFLICT");
  assert.equal(original.match(/^begin;\s*$/gm)?.length, 1);
  assert.equal(original.match(/^commit;\s*$/gm)?.length, 1);
  const body = original.replace(/^begin;\s*$/gm, "").replace(/^commit;\s*$/gm, "");
  const version = "20261020232807", name = "sanitario_class_scheme_planning_v2";
  const quote = "$r04b2_original$";
  assert(!original.includes(quote));
  const tables = ["sanitario_protocolos_v2", "sanitario_protocolo_itens_versions_v2", "sanitario_product_classes_v2",
    "sanitario_fontes_tecnicas_v2", "sanitario_produtos_v2", "sanitario_fonte_cobertura_campos_v2",
    "sanitario_produto_fontes_v2", "sanitario_agenda_v2", "eventos", "sanitario_sync_v2_gates",
    "sanitario_sync_v2_operations", "fazenda_sanidade_config"];
  const state = `jsonb_build_array(${tables.map(t => `(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.${t} t)`).join(",\n")})`;
  const sql = `-- PREPARED ONLY: project ${packet.project_ref}; mode ${mode}.
-- Migration SHA256 ${packet.inputs.migration.sha256}; no catalog publication/approval.
\\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('rebanhosync:R04B2:migration',0));
lock table supabase_migrations.schema_migrations in exclusive mode;
do $r04b2_pre$ begin
 if (select count(*) from supabase_migrations.schema_migrations where version<>'${version}')<>63 or
 (select md5(string_agg(version||':'||name,'|' order by version)) from supabase_migrations.schema_migrations where version<>'${version}')<>'${fingerprint}' then
  raise exception 'R04B2_MIGRATION_BASELINE_DIVERGED'; end if;
 if exists(select 1 from public.sanitario_sync_v2_gates where enabled) then
  raise exception 'R04B2_REQUIRES_GATES_OFF'; end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version='${version}' and
   (name is distinct from '${name}' or statements is distinct from array[${quote}${original}${quote}])) then
  raise exception 'R04B2_MIGRATION_HISTORY_CONFLICT'; end if;
end $r04b2_pre$;
select set_config('rebanhosync.r04b2_before',(${state})::text,true);
select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as already_applied \\gset
\\if :already_applied
\\echo R04B2_EXACT_MIGRATION_ALREADY_RECORDED
\\else
${body}
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','${name}',array[${quote}${original}${quote}]);
\\endif
do $r04b2_post$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>64 then raise exception 'R04B2_HISTORY_COUNT'; end if;
 if (${state}) is distinct from current_setting('rebanhosync.r04b2_before')::jsonb then
  raise exception 'R04B2_UNEXPECTED_DATA_CHANGE'; end if;
end $r04b2_post$;
${mode === "apply" ? "commit" : "rollback"};
`;
  return { sql, baseline, fingerprint, sql_sha256: sha(sql), mode, executes_remote: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, output] = process.argv.slice(2);
  assert(output && process.argv.length === 4, "Use <dry-run|apply> <new output SQL file>");
  const result = prepareClassMigration(mode);
  writeFileSync(output, result.sql, { flag: "wx" });
  console.log(JSON.stringify({ file: output, mode, sql_sha256: result.sql_sha256, executes_remote: false }));
}
