// Real PostgreSQL sessions. Task-owned disposable database only; fixtures retained.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";
import { finishBlockedPair } from "./helpers/obitoDisposableGuards.mjs";

const container = "a05b04-pg-test";
const database = "v31_disposable_a05b04d";
const cli = ["exec", "-i", container, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database];
function sql(input) {
  const r = spawnSync("docker", cli, { input, encoding: "utf8", timeout: 15000 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function session() {
  const child = spawn("docker", cli);
  let output = "", error = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { error += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output, error }));
  });
  return { child, done, output: () => output, write: (value) => child.stdin.write(value + "\n") };
}
async function until(predicate) {
  const end = Date.now() + 10000;
  while (!predicate()) {
    assert(Date.now() < end, "PostgreSQL barrier timeout");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
function fixture() {
  const f = Object.fromEntries(["farm", "foreignFarm", "actor", "outsider", "animal", "otherAnimal", "agenda", "death", "event"].map((key) => [key, randomUUID()]));
  sql(`begin;
    insert into auth.users(id,aud,role,email) values ('${f.actor}','authenticated','authenticated','${f.actor}@a05.invalid'),('${f.outsider}','authenticated','authenticated','${f.outsider}@a05.invalid');
    insert into public.fazendas(id,nome) values ('${f.farm}','A05 concurrency disposable'),('${f.foreignFarm}','A05 foreign');
    insert into public.user_fazendas(user_id,fazenda_id,role) values ('${f.actor}','${f.farm}','owner');
    insert into public.animais(id,fazenda_id,identificacao,sexo) values ('${f.animal}','${f.farm}','${f.animal}','F'),('${f.otherAnimal}','${f.farm}','${f.otherAnimal}','F');
    insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id) values ('${f.death}','${f.farm}','obito',now(),'${f.animal}');
    insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values ('${f.farm}',true,3,3,'ready');
    set local role service_role;
    select public.internal_sanitario_admit_v3('${f.actor}','${f.farm}','create_agenda',jsonb_build_object(
      'actor_user_id','${f.actor}','fazenda_id','${f.farm}','contract_version',3,'client_op_id','${randomUUID()}','domain_op_id','${randomUUID()}',
      'payload',jsonb_build_object('id','${f.agenda}','dedup_key','${f.agenda}','janela_inicio','2026-11-04','data_programada','2026-11-04','acao_sanitaria','vacinacao','client_id','a05-test','client_recorded_at',now()),
      'animal_ids',jsonb_build_array('${f.animal}','${f.otherAnimal}')),false);
    commit;`);
  return f;
}
function command(f, kind) {
  const args = { actor_user_id: f.actor, fazenda_id: f.farm, contract_version: 3, client_op_id: randomUUID(), domain_op_id: randomUUID(), client_id: "a05-test", client_tx_id: randomUUID() };
  if (kind === "death_participant") args.payload = { agenda_id: f.agenda, animal_id: f.animal, death_event_id: f.death };
  else Object.assign(args, {
    expected_revision: 0,
    event_payload: { id: f.event, natureza: "primary_execution", source_sanitario_agenda_v2_id: f.agenda, occurred_at: "2026-11-04T12:00:00Z", client_id: "a05-test", client_recorded_at: "2026-11-04T12:00:00Z", client_tx_id: args.client_tx_id, payload: { sanitario_v3_progressive: true } },
    detail_payload: { tipo: "vacinacao", produto_nome_snapshot: "Produto teste", dose_quantidade: 2, dose_unidade: "mL", via_aplicacao: "SC" },
    event_animals: [{ id: randomUUID(), animal_id: f.animal }],
  });
  return `select public.internal_sanitario_admit_v3('${f.actor}','${f.farm}','${kind}','${JSON.stringify(args)}'::jsonb,false);`;
}

test("PostgreSQL: execução × dispensa sob bloqueio real, replay e isolamento", async (t) => {
  assert.equal(process.env.A05_B04_ALLOW_DISPOSABLE, "1");
  assert.equal(sql("select current_database()"), database);
  const inspected = JSON.parse(spawnSync("docker", ["inspect", container], { encoding: "utf8" }).stdout)[0];
  assert.match(process.env.A05_B04_CONTAINER_ID ?? "", /^[a-f0-9]{64}$/);
  assert.equal(inspected.Id, process.env.A05_B04_CONTAINER_ID);
  assert.equal(inspected.Mounts.length, 0);
  for (const cancelFirst of [true, false]) await t.test(`common Agenda first=${cancelFirst ? "death" : "generic"}`, async () => {
    const f = fixture(), agenda = randomUUID();
    sql(`insert into public.agenda_itens(id,fazenda_id,dominio,tipo,data_prevista,animal_id) values('${agenda}','${f.farm}','pesagem','pesagem',current_date,'${f.animal}')`);
    const death = `set local role service_role; select public.internal_obito_agenda_cancel('${f.actor}','${f.farm}','${agenda}','${f.animal}','${f.death}','${randomUUID()}','${randomUUID()}','a05-test');`;
    const generic = `set local role authenticated; select set_config('request.jwt.claim.sub','${f.actor}',true); update public.agenda_itens set status='concluido' where id='${agenda}' and fazenda_id='${f.farm}';`;
    const first = session(), second = session(), app = `a05-${randomUUID()}`;
    try {
      first.write(`begin; set local statement_timeout='12s'; ${cancelFirst ? death : generic} select 'FIRST_DONE';`);
      await until(() => first.output().includes("FIRST_DONE"));
      second.write(`set application_name='${app}'; begin; set local statement_timeout='12s'; ${cancelFirst ? generic : death} commit;`);
      const [a,b] = await finishBlockedPair({ sql, first, second, until, app });
      if (cancelFirst) { assert.notEqual(b.code, 0); assert.match(b.error, /OBITO_AGENDA_CANCELLATION_IMMUTABLE/); }
      else { assert.equal(b.code, 0, b.error); assert.match(b.output, /"outcome": "conflict"/); }
      assert.equal(sql(`select status from public.agenda_itens where id='${agenda}'`), cancelFirst ? "cancelado" : "concluido");
    } finally { first.child.stdin.end(); second.child.stdin.end(); await Promise.all([first.done, second.done]); }
  });
  for (const deathFirst of [true, false]) await t.test(`first=${deathFirst ? "death" : "execution"}`, async () => {
    const f = fixture();
    const death = command(f, "death_participant"), execution = command(f, "apply_factual_core");
    const first = session(), second = session();
    const app = `a05-${randomUUID()}`;
    try {
      first.write(`begin; set local statement_timeout='12s'; set local role service_role; ${deathFirst ? death : execution} select 'FIRST_DONE';`);
      await until(() => first.output().includes("FIRST_DONE"));
      second.write(`set application_name='${app}'; set statement_timeout='12s'; set role service_role; ${deathFirst ? execution : death}`);
      // Prove the second writer is blocked on the first transaction, not just sequential.
      const [a, b] = await finishBlockedPair({ sql, first, second, until, app });
      if (deathFirst) {
        assert.match(a.output, /"outcome": "applied"/);
        assert.notEqual(b.code, 0);
        assert.match(b.error, /SANITARIO_PARTICIPANT_DECEASED/);
        assert.equal(sql(`select count(*) from public.eventos where id='${f.event}'`), "0");
      } else {
        assert.match(a.output, /"confirmed": true/);
        assert.equal(b.code, 0, b.error);
        assert.match(b.output, /"outcome": "conflict"/);
        assert.equal(sql(`select execution_evento_id from public.sanitario_agenda_animais_v2 where agenda_id='${f.agenda}' and animal_id='${f.animal}'`), f.event);
      }
      assert.equal(sql(`select planned_status from public.sanitario_agenda_animais_v2 where agenda_id='${f.agenda}' and animal_id='${f.otherAnimal}'`), "planejado");
      assert.equal(sql(`select status from public.sanitario_agenda_v2 where id='${f.agenda}'`), "programada");
      // A fresh session simulates lost ACK/restart, including a now-disabled gate.
      sql(`update public.sanitario_sync_v2_gates set enabled=false where fazenda_id='${f.farm}'`);
      const replay = sql(`set role service_role; ${death}`);
      assert.match(replay, /"replayed": true/);
      assert.match(replay, deathFirst ? /"outcome": "applied"/ : /"outcome": "conflict"/);
      const spoof = spawnSync("docker", cli, { input: `set role service_role; ${death.replaceAll(f.actor, f.outsider)}`, encoding: "utf8" });
      assert.notEqual(spoof.status, 0); assert.match(spoof.stderr, /MEMBERSHIP_REQUIRED/);
      const crossFarm = spawnSync("docker", cli, { input: `set role service_role; ${death.replaceAll(f.farm, f.foreignFarm)}`, encoding: "utf8" });
      assert.notEqual(crossFarm.status, 0); assert.match(crossFarm.stderr, /MEMBERSHIP_REQUIRED/);
      const changedIdentity = spawnSync("docker", cli, { input: `set role service_role; ${death.replaceAll(f.animal, f.otherAnimal)}`, encoding: "utf8" });
      assert.notEqual(changedIdentity.status, 0); assert.match(changedIdentity.stderr, /IDEMPOTENCY_CONFLICT/);
    } finally {
      // Closing only these test sessions rolls back an unfinished transaction.
      first.child.stdin.end(); second.child.stdin.end();
      await Promise.all([first.done, second.done]);
    }
  });
});
