// Exact versioned RPC on an owned, disposable local PostgreSQL server. No hosted target.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const run = randomUUID();
const name = `i03-neonatal-${run}`;
const database = "i03_neonatal";
const source = "supabase_db_GestaoAgro";
let containerId;
const docker = (args, input) => execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
const sql = (text, role = "postgres") => {
  assert(["postgres", "supabase_admin", "service_role"].includes(role));
  return docker(["exec", "-i", containerId, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], `set role ${role};\n${text}`).trim();
};
const id = () => randomUUID();
const actor = id(), farm = id(), animal = id();
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'`;
function call(op) {
  return `select public.internal_sanitario_sync_v2_apply_factual_core('${actor}', '${farm}', 2, '${op.id}', '${op.domain}', ${op.revision},
    jsonb_populate_record(null::public.sanitario_sync_v2_event_input, ${literal(op.event)}::jsonb),
    jsonb_populate_record(null::public.sanitario_sync_v2_detail_input, ${literal(op.detail)}::jsonb),
    array[jsonb_populate_record(null::public.sanitario_sync_v2_event_animal_input, ${literal(op.animal)}::jsonb)]);`;
}
try {
  assert.match(docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]), /^(npipe:\/\/|unix:\/\/)/);
  const image = docker(["inspect", "--format", "{{.Config.Image}}", source]).trim();
  // No port is published; psql talks only inside this container. Image must already exist.
  containerId = docker(["run", "--pull=never", "--detach", "--rm", "--name", name, "--label", `com.rebanhosync.i03.run=${run}`,
    "--user", "postgres", "--entrypoint", "sh", image, "-c",
    `initdb -D /tmp/i03-db --auth=trust -U postgres >/tmp/i03-init.log && exec postgres -D /tmp/i03-db -c shared_preload_libraries=pg_cron -c cron.database_name=${database} -c cron.launch_active_jobs=off`]).trim();
  assert.match(containerId, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    try { docker(["exec", containerId, "pg_isready", "-U", "postgres"]); ready = true; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert(ready, "Disposable PostgreSQL unavailable");
  docker(["exec", containerId, "createdb", "-U", "postgres", "--template=template0", database]);
  const roles = docker(["exec", source, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c",
    "select format('create role %I nologin;',rolname) from pg_roles where rolname not like 'pg_%' and rolname <> 'postgres' and rolname not like 'rebanhosync_%'"]);
  sql(`${roles}\nalter role supabase_admin superuser login; alter role service_role bypassrls; create schema extensions; create extension pgcrypto with schema extensions;`);
  sql(docker(["exec", source, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--schema=auth", "--no-owner"]), "supabase_admin");
  const files = readdirSync("supabase/migrations").filter(file => file.endsWith(".sql") && file <= "20261004210000_sanitario_sync_v2_revision_conflict_pt409.sql").sort();
  sql(files.map(file => readFileSync(`supabase/migrations/${file}`, "utf8")).join("\n"));
  sql(`insert into auth.users(id) values('${actor}');
    insert into public.fazendas(id,nome) values('${farm}','I03 synthetic local');
    insert into public.user_fazendas(user_id,fazenda_id,role) values('${actor}','${farm}','owner');
    insert into public.animais(id,fazenda_id,identificacao,sexo,status,origem) values('${animal}','${farm}','I03','F','ativo','nascimento');
    insert into public.sanitario_sync_v2_gates(fazenda_id,enabled) values('${farm}',true);`);
  const agendas = [id(), id(), id(), id()];
  for (let day = 0; day < agendas.length; day++) {
    sql(`insert into public.sanitario_agenda_v2(id,fazenda_id,status,dedup_key,source_demand_key,preview_group_id,protocol_item_snapshot,janela_inicio,data_programada,acao_sanitaria,client_id,client_op_id,client_recorded_at)
      values('${agendas[day]}','${farm}','programada','i03:d${day}','i03:d${day}','i03','{}','2026-04-0${day + 1}','2026-04-0${day + 1}','${day === 3 ? "revisao_neonatal" : "cura_umbigo"}','i03','${id()}','2026-04-01');
      insert into public.sanitario_agenda_animais_v2(agenda_id,fazenda_id,animal_id) values('${agendas[day]}','${farm}','${animal}');`);
  }
  for (let day = 0; day < 3; day++) {
    const eventId = id();
    const op = { id: eventId, domain: id(), revision: Number(sql(`select revision from public.sanitario_agenda_v2 where id='${agendas[day]}';`)),
      event: { id: eventId, source_sanitario_agenda_v2_id: agendas[day], natureza: "primary_execution", occurred_at: `2026-04-0${day + 1}T12:00:00Z`, animal_id: animal, client_id: "i03", client_tx_id: id(), client_recorded_at: "2026-04-04T12:00:00Z", payload: { schema: "sanitary_agenda_execution_v2" } },
      detail: { tipo: "medicamento", produto_nome_snapshot: "Produto não informado", payload: {} }, animal: { id: id(), animal_id: animal } };
    const first = JSON.parse(sql(call(op), "service_role"));
    const replay = JSON.parse(sql(call(op), "service_role"));
    assert.deepEqual(replay, first);
    assert.equal(first.agenda_status, "fechada");
    assert.equal(first.revision, op.revision + 1);
    assert.equal(sql(`select count(*) from public.eventos where id='${eventId}';`), "1");
    assert.equal(sql(`select count(*) from public.eventos_sanitario where evento_id='${eventId}' and produto_sanitario_v2_id is null and dose_quantidade is null and via_aplicacao is null and carencia_carne_dias is null;`), "1");
    assert.equal(sql(`select count(*) from public.eventos_animais where evento_id='${eventId}' and animal_id='${animal}';`), "1");
    for (const future of agendas.slice(day + 1)) assert.equal(sql(`select status from public.sanitario_agenda_v2 where id='${future}';`), "programada");
    console.log(`PASS D${day}: fact, detail, animal, revision, replay and future intentions`);
  }
  const target = agendas[3];
  const eventId = id();
  const bad = { id: eventId, domain: id(), revision: 99, event: { id: eventId, source_sanitario_agenda_v2_id: target, natureza: "primary_execution", occurred_at: "2026-04-04", client_id: "i03", client_recorded_at: "2026-04-04", payload: {} }, detail: { tipo: "medicamento" }, animal: { id: id(), animal_id: animal } };
  assert.throws(() => sql(call(bad), "service_role"), error => error.stderr.toString().includes("SANITARIO_AGENDA_REVISION_CONFLICT"));
  assert.equal(sql(`select count(*) from public.eventos where id='${eventId}';`), "0");
  console.log("PASS stale revision: conflict without partial fact");
  bad.revision = Number(sql(`select revision from public.sanitario_agenda_v2 where id='${target}';`));
  bad.animal.animal_id = id();
  assert.throws(() => sql(call(bad), "service_role"), error => error.stderr.toString().includes("SANITARIO_EVENT_ANIMAL_CROSS_FARM_OR_MISSING"));
  console.log("PASS invalid animal: no cross-farm fact");
} catch (error) {
  // Only bounded SQL diagnostics; never serialize process environments or connection secrets.
  console.error(error.stderr?.toString().slice(-1800) ?? error.message);
  process.exitCode = 1;
} finally {
  if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
    const owner = docker(["inspect", "--format", '{{index .Config.Labels "com.rebanhosync.i03.run"}}', containerId]).trim();
    assert.equal(owner, run, "Refusing cleanup of a resource owned by another run");
    docker(["stop", containerId]);
    console.log("Disposed owned local PostgreSQL container");
  }
}
