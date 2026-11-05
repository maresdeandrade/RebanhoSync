import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertDisposableDatabase } from "./helpers/obitoDisposableGuards.mjs";

const container = "a05b04-pg-test";
const database = "v31_disposable_a05b04d";

function psql(sql) {
  return spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], {
    input: sql,
    encoding: "utf8",
  });
}

test("execução sanitária não confirma participante dispensado por óbito", () => {
  assertDisposableDatabase(psql, database);
  if (process.env.A05_B04_UPDATE_LOCAL_WRITER === "1") {
    const migration = readFileSync("supabase/migrations/20261103180000_obito_sanitario_participant.sql", "utf8");
    const start = migration.indexOf("create function public.internal_sanitario_admit_v3(");
    const end = migration.indexOf("\nrevoke all on function public.internal_sanitario_admit_v3", start);
    assert(start >= 0 && end > start);
    const applied = psql(migration.slice(start, end).replace("create function", "create or replace function"));
    assert.equal(applied.status, 0, applied.stderr);
  }

  const farm = randomUUID();
  const actor = randomUUID();
  const animal = randomUUID();
  const otherAnimal = randomUUID();
  const agenda = randomUUID();
  const death = randomUUID();
  const otherDeath = randomUUID();
  const otherEvent = randomUUID();
  const event = randomUUID();
  const result = psql(`
begin;
insert into auth.users(id,aud,role,email) values ('${actor}','authenticated','authenticated','${actor}@a05.invalid');
insert into public.fazendas(id,nome) values ('${farm}','A05 disposable');
insert into public.user_fazendas(user_id,fazenda_id,role) values ('${actor}','${farm}','owner');
insert into public.animais(id,fazenda_id,identificacao,sexo) values ('${animal}','${farm}','${animal}','F'),('${otherAnimal}','${farm}','${otherAnimal}','F');
insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values ('${farm}',true,3,3,'ready');
insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id) values ('${death}','${farm}','obito',now(),'${animal}'),('${otherDeath}','${farm}','obito',now(),'${otherAnimal}');
set local role service_role;
select public.internal_sanitario_admit_v3('${actor}','${farm}','create_agenda',jsonb_build_object(
 'actor_user_id','${actor}','fazenda_id','${farm}','contract_version',3,'client_op_id','${randomUUID()}','domain_op_id','${randomUUID()}',
 'payload',jsonb_build_object('id','${agenda}','dedup_key','${agenda}','janela_inicio','2026-10-31','data_programada','2026-10-31','acao_sanitaria','vacinacao','client_id','a05-test','client_recorded_at',now()),
 'animal_ids',jsonb_build_array('${animal}','${otherAnimal}')),false);
do $command$
declare command_args jsonb; first_result jsonb; replay_result jsonb;
begin
  command_args := jsonb_build_object('actor_user_id','${actor}','fazenda_id','${farm}','contract_version',3,'client_id','a05-test','client_op_id','${randomUUID()}','domain_op_id','${randomUUID()}',
    'payload',jsonb_build_object('agenda_id','${agenda}','animal_id','${animal}','death_event_id','${death}'));
  first_result := public.internal_sanitario_admit_v3('${actor}','${farm}','death_participant',command_args,false);
  if first_result->>'outcome' is distinct from 'applied' then raise exception 'TEST_DEATH_NOT_APPLIED: %',first_result; end if;
  if not exists(select 1 from public.sanitario_agenda_animais_v2 where agenda_id='${agenda}' and animal_id='${animal}' and planned_status='nao_executado' and not_executed_reason='obito:${death}') then raise exception 'TEST_DEATH_OUTCOME_NOT_RECORDED'; end if;
  update public.sanitario_agenda_animais_v2 set planned_status='planejado',not_executed_reason=null where agenda_id='${agenda}' and animal_id='${animal}';
  replay_result := public.internal_sanitario_admit_v3('${actor}','${farm}','death_participant',command_args,false);
  if replay_result->>'outcome' is distinct from 'applied' or replay_result->>'replayed' is distinct from 'true' then raise exception 'TEST_REPLAY_NOT_PROVEN: %',replay_result; end if;
  if not exists(select 1 from public.sanitario_agenda_animais_v2 where agenda_id='${agenda}' and animal_id='${animal}' and planned_status='planejado' and not_executed_reason is null) then raise exception 'TEST_REPLAY_CHANGED_LATER_STATE'; end if;
end $command$;
do $test$
declare result jsonb;
begin
  begin
    result := public.internal_sanitario_admit_v3('${actor}','${farm}','apply_factual_core',jsonb_build_object(
      'actor_user_id','${actor}','fazenda_id','${farm}','contract_version',3,'client_op_id','${randomUUID()}','domain_op_id','${randomUUID()}','expected_revision',0,
      'event_payload',jsonb_build_object('id','${event}','natureza','primary_execution','source_sanitario_agenda_v2_id','${agenda}','occurred_at',now(),'client_id','a05-test','client_recorded_at',now(),'client_tx_id','${randomUUID()}','payload',jsonb_build_object('sanitario_v3_progressive',true)),
      'detail_payload',jsonb_build_object('tipo','vacinacao','produto_nome_snapshot','Produto teste','dose_quantidade',2,'dose_unidade','mL','via_aplicacao','SC'),
      'event_animals',jsonb_build_array(jsonb_build_object('id','${randomUUID()}','animal_id','${animal}'))),false);
  exception when sqlstate 'PT409' then
    result := jsonb_build_object('confirmed',false);
  end;
  if result->>'confirmed' is distinct from 'false' then raise exception 'TEST_DECEASED_EXECUTION_CONFIRMED'; end if;
  if not exists(select 1 from public.sanitario_agenda_animais_v2 where agenda_id='${agenda}' and animal_id='${animal}' and planned_status='planejado' and not_executed_reason is null) then raise exception 'TEST_DEATH_OUTCOME_OVERWRITTEN'; end if;
  if not exists(select 1 from public.sanitario_agenda_animais_v2 where agenda_id='${agenda}' and animal_id='${otherAnimal}' and planned_status='planejado') then raise exception 'TEST_OTHER_PARTICIPANT_CHANGED'; end if;
  if not exists(select 1 from public.sanitario_agenda_v2 where id='${agenda}' and status='programada') then raise exception 'TEST_AGENDA_CLOSED'; end if;
end $test$;
do $reverse$
declare execution jsonb; death_result jsonb;
begin
  execution := public.internal_sanitario_admit_v3('${actor}','${farm}','apply_factual_core',jsonb_build_object(
    'actor_user_id','${actor}','fazenda_id','${farm}','contract_version',3,'client_op_id','${randomUUID()}','domain_op_id','${randomUUID()}','expected_revision',0,
    'event_payload',jsonb_build_object('id','${otherEvent}','natureza','primary_execution','source_sanitario_agenda_v2_id','${agenda}','occurred_at',now(),'client_id','a05-test','client_recorded_at',now(),'client_tx_id','${randomUUID()}','payload',jsonb_build_object('sanitario_v3_progressive',true)),
    'detail_payload',jsonb_build_object('tipo','vacinacao','produto_nome_snapshot','Produto teste','dose_quantidade',2,'dose_unidade','mL','via_aplicacao','SC'),
    'event_animals',jsonb_build_array(jsonb_build_object('id','${randomUUID()}','animal_id','${otherAnimal}'))),false);
  if execution->>'confirmed' is distinct from 'true' then raise exception 'TEST_EXECUTION_NOT_CONFIRMED: %',execution; end if;
  death_result := public.internal_sanitario_admit_v3('${actor}','${farm}','death_participant',jsonb_build_object(
    'actor_user_id','${actor}','fazenda_id','${farm}','contract_version',3,'client_id','a05-test','client_op_id','${randomUUID()}','domain_op_id','${randomUUID()}',
    'payload',jsonb_build_object('agenda_id','${agenda}','animal_id','${otherAnimal}','death_event_id','${otherDeath}')),false);
  if death_result->>'outcome' is distinct from 'conflict' then raise exception 'TEST_EXECUTED_PARTICIPANT_NOT_CONFLICT: %',death_result; end if;
  if not exists(select 1 from public.sanitario_agenda_animais_v2 where agenda_id='${agenda}' and animal_id='${otherAnimal}' and planned_status='executado' and execution_evento_id='${otherEvent}') then raise exception 'TEST_EXECUTION_OVERWRITTEN'; end if;
end $reverse$;
rollback;
`);
  assert.equal(result.status, 0, result.stderr);
});
