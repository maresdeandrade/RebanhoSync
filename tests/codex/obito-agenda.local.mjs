import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertDisposableDatabase } from "./helpers/obitoDisposableGuards.mjs";

const database = "v31_disposable_a05b04d";
function psql(sql) {
  return spawnSync("docker", ["exec", "-i", "a05b04-pg-test", "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], { input: sql, encoding: "utf8" });
}

test("cancelamento por óbito é condicional e tem recibo durável", () => {
  assertDisposableDatabase(psql, database);
  if (process.env.A05_B04_REPLACE_LOCAL_FUNCTION === "1") {
    const migration = readFileSync(new URL("../../supabase/migrations/20261103181000_obito_agenda_cancel.sql", import.meta.url), "utf8");
    const start = migration.indexOf("create function public.internal_obito_agenda_cancel(");
    const end = migration.indexOf("revoke all on function public.internal_obito_agenda_cancel", start);
    assert.ok(start >= 0 && end > start, "definição local da função não encontrada");
    const definition = migration.slice(start, end).replace("create function", "create or replace function");
    const replacement = psql(definition);
    assert.equal(replacement.status, 0, replacement.stderr);
  }
  const farm = randomUUID();
  const otherFarm = randomUUID();
  const actor = randomUUID();
  const animal = randomUUID();
  const otherAnimal = randomUUID();
  const event = randomUUID();
  const agenda = randomUUID();
  const completed = randomUUID();
  const other = randomUUID();
  const op = randomUUID();
  const tx = randomUUID();
  const result = psql(`
begin;
insert into auth.users(id,aud,role,email) values ('${actor}','authenticated','authenticated','${actor}@a05.invalid');
insert into public.fazendas(id,nome) values ('${farm}','A05 disposable'),('${otherFarm}','A05 other');
insert into public.user_fazendas(user_id,fazenda_id,role) values ('${actor}','${farm}','owner');
insert into public.animais(id,fazenda_id,identificacao,sexo) values ('${animal}','${farm}','${animal}','F'),('${otherAnimal}','${farm}','${otherAnimal}','F');
insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id) values ('${event}','${farm}','obito',now(),'${animal}');
insert into public.agenda_itens(id,fazenda_id,dominio,tipo,data_prevista,animal_id,status) values
 ('${agenda}','${farm}','pesagem','pesagem',current_date,'${animal}','agendado'),
 ('${completed}','${farm}','pesagem','pesagem',current_date,'${animal}','concluido'),
 ('${other}','${farm}','pesagem','pesagem',current_date,'${otherAnimal}','agendado');
set local role service_role;
do $test$
declare applied jsonb; replayed jsonb; status_result jsonb;
begin
 applied := public.internal_obito_agenda_cancel('${actor}','${farm}','${agenda}','${animal}','${event}','${op}','${tx}','a05-test');
 if applied->>'outcome' is distinct from 'applied' then raise exception 'TEST_NOT_APPLIED: %',applied; end if;
 perform set_config('role','postgres',true);
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub','${actor}',true);
 begin
   update public.agenda_itens set status='agendado' where id='${agenda}' and fazenda_id='${farm}';
   raise exception 'TEST_STALE_GENERIC_UPDATE_ACCEPTED';
 exception when check_violation then
   if sqlerrm <> 'OBITO_AGENDA_CANCELLATION_IMMUTABLE' then raise; end if;
 end;
 perform set_config('role','postgres',true);
 update public.agenda_itens set payload='{"alteracao":"posterior"}'::jsonb where id='${agenda}' and fazenda_id='${farm}';
 perform set_config('role','service_role',true);
 replayed := public.internal_obito_agenda_cancel('${actor}','${farm}','${agenda}','${animal}','${event}','${op}','${tx}','a05-test');
 if replayed->>'outcome' is distinct from 'applied' or replayed->>'replayed' is distinct from 'true' then raise exception 'TEST_REPLAY_FAILED: %',replayed; end if;
 perform set_config('role','postgres',true);
 if not exists(select 1 from public.agenda_itens where id='${agenda}' and status='cancelado' and payload->>'alteracao'='posterior') then raise exception 'TEST_REPLAY_OVERWROTE_LATER_STATE'; end if;
 perform set_config('role','service_role',true);
 begin
   perform public.internal_obito_agenda_cancel('${actor}','${farm}','${agenda}','${otherAnimal}','${event}','${op}','${tx}','a05-test');
   raise exception 'TEST_IDENTITY_REUSE_ACCEPTED';
 exception when unique_violation then null; end;
 status_result := public.internal_obito_agenda_cancel('${actor}','${farm}','${completed}','${animal}','${randomUUID()}','${randomUUID()}','${tx}','a05-test');
 if status_result->>'outcome' is distinct from 'dependency' then raise exception 'TEST_MISSING_DEATH_ACCEPTED'; end if;
 status_result := public.internal_obito_agenda_cancel('${actor}','${farm}','${completed}','${animal}','${event}','${randomUUID()}','${tx}','a05-test');
 if status_result->>'outcome' is distinct from 'conflict' then raise exception 'TEST_EXPECTED_CONFLICT: %',status_result; end if;
 status_result := public.internal_obito_agenda_cancel('${actor}','${farm}','${other}','${animal}','${event}','${randomUUID()}','${tx}','a05-test');
 if status_result->>'outcome' is distinct from 'not_found' then raise exception 'TEST_ANIMAL_ISOLATION: %',status_result; end if;
 perform set_config('role','postgres',true);
 if not exists(select 1 from public.agenda_itens where id='${other}' and status='agendado') then raise exception 'TEST_OTHER_AGENDA_CHANGED'; end if;
 update public.agenda_itens set deleted_at=now() where id='${other}';
 perform set_config('role','service_role',true);
 status_result := public.internal_obito_agenda_cancel('${actor}','${farm}','${other}','${otherAnimal}','${event}','${randomUUID()}','${tx}','a05-test');
 if status_result->>'outcome' is distinct from 'dependency' then raise exception 'TEST_WRONG_DEATH_ANIMAL_ACCEPTED'; end if;
 perform set_config('role','postgres',true);
 update public.agenda_itens set deleted_at=now() where id='${completed}';
 perform set_config('role','service_role',true);
 status_result := public.internal_obito_agenda_cancel('${actor}','${farm}','${completed}','${animal}','${event}','${randomUUID()}','${tx}','a05-test');
 if status_result->>'outcome' is distinct from 'not_found' then raise exception 'TEST_DELETED_AGENDA_ACCEPTED'; end if;
 begin
   perform public.internal_obito_agenda_cancel('${actor}','${otherFarm}','${agenda}','${animal}','${event}','${randomUUID()}','${tx}','a05-test');
   raise exception 'TEST_FOREIGN_FARM_ACCEPTED';
 exception when insufficient_privilege then null; end;
end $test$;
rollback;
`);
  assert.equal(result.status, 0, result.stderr);
});
