begin;

alter table public.sanitario_sync_v2_operations drop constraint ck_sanitario_sync_v2_operation_kind;
alter table public.sanitario_sync_v2_operations add constraint ck_sanitario_sync_v2_operation_kind check
  (operation_kind in ('agenda_create','agenda_targets_replace','factual_core','administrative_closure','automation_plan','agenda_schedule','collaboration','death_participant'));

create function pg_temp.obito_replace_once(source text, anchor text, replacement text)
returns text language plpgsql as $$
declare matches integer;
begin
  matches := (length(source)-length(replace(source,anchor,'')))/nullif(length(anchor),0);
  if matches is distinct from 1 then raise exception 'OBITO_SANITARIO_BASELINE_MISMATCH: %',matches; end if;
  return replace(source,anchor,replacement);
end $$;

do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.internal_sanitario_sync_v2_apply_factual_core(uuid,uuid,integer,uuid,uuid,bigint,public.sanitario_sync_v2_event_input,public.sanitario_sync_v2_detail_input,public.sanitario_sync_v2_event_animal_input[])'::regprocedure);
  definition := pg_temp.obito_replace_once(definition,
    'select array_agg(s.animal_id order by s.animal_id) into v_collisions',
    $replacement$if exists (
      select 1 from public.sanitario_agenda_animais_v2 aa
      where aa.agenda_id=v_agenda.id and aa.fazenda_id=fazenda_id and aa.animal_id=any(v_animal_ids)
        and aa.planned_status='nao_executado' and aa.not_executed_reason like 'obito:%'
    ) or exists (
      select 1 from public.sanitario_sync_v2_operations receipt
      where receipt.fazenda_id=fazenda_id and receipt.operation_kind='death_participant'
        and receipt.canonical_result->>'outcome'='applied'
        and receipt.canonical_result->>'root_id'=v_agenda.obrigacao_origem_agenda_id::text
        and (receipt.canonical_result->>'animal_id')::uuid=any(v_animal_ids)
    ) then raise exception 'SANITARIO_PARTICIPANT_DECEASED' using errcode='PT409'; end if;
    select array_agg(s.animal_id order by s.animal_id) into v_collisions$replacement$);
  execute definition;
end $$;

alter function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) rename to internal_sanitario_admit_v3_before_obito;

create function public.internal_sanitario_admit_v3(actor_user_id uuid,fazenda_id uuid,command text,operation_args jsonb,receipt_only boolean default false)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
#variable_conflict use_variable
declare
  args jsonb := operation_args;
  payload jsonb := args->'payload';
  agenda_id uuid;
  animal_id uuid;
  event_id uuid;
  op_id uuid;
  domain_id uuid;
  client text;
  role_value public.farm_role_enum;
  agenda public.sanitario_agenda_v2%rowtype;
  participant public.sanitario_agenda_animais_v2%rowtype;
  fingerprint text;
  previous jsonb;
  result jsonb;
begin
  if command <> 'death_participant' then
    return public.internal_sanitario_admit_v3_before_obito(actor_user_id,fazenda_id,command,operation_args,receipt_only);
  end if;
  if current_user <> 'service_role' then raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select membership.role into role_value from public.user_fazendas membership
    join public.fazendas farm on farm.id=membership.fazenda_id and farm.deleted_at is null
    where membership.user_id=actor_user_id and membership.fazenda_id=fazenda_id and membership.deleted_at is null;
  if role_value is null then raise exception 'SANITARIO_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if args->>'actor_user_id' is distinct from actor_user_id::text or args->>'fazenda_id' is distinct from fazenda_id::text then
    raise exception 'SANITARIO_FAZENDA_CONTEXT_MISMATCH' using errcode='42501'; end if;
  agenda_id := (payload->>'agenda_id')::uuid;
  animal_id := (payload->>'animal_id')::uuid;
  event_id := (payload->>'death_event_id')::uuid;
  op_id := (args->>'client_op_id')::uuid;
  domain_id := (args->>'domain_op_id')::uuid;
  client := args->>'client_id';
  if agenda_id is null or animal_id is null or event_id is null or op_id is null or domain_id is null or nullif(btrim(client),'') is null then
    raise exception 'SANITARIO_REQUIRED_ARGUMENT_MISSING' using errcode='22004';
  end if;
  fingerprint := public.internal_sanitario_v3_fingerprint(actor_user_id,fazenda_id,command,args);
  previous := public.internal_sanitario_sync_v2_existing_result(fazenda_id,'death_participant',agenda_id,op_id,domain_id,fingerprint);
  if previous is not null then
    if receipt_only then return jsonb_build_object('outcome','found','canonical_result',previous); end if;
    return previous || jsonb_build_object('replayed',true);
  end if;
  if receipt_only then return jsonb_build_object('outcome','absent'); end if;
  if (args->>'contract_version')::integer is distinct from 3 then raise exception 'SANITARIO_CLIENT_CONTRACT_OUTDATED' using errcode='22023'; end if;
  perform set_config('rebanhosync.sanitario_v3_farm',fazenda_id::text,true);
  perform set_config('rebanhosync.sanitario_v3_actor',actor_user_id::text,true);
  perform public.internal_sanitario_sync_v2_authorize(actor_user_id,fazenda_id,3,client,'factual_core',array['owner','manager','cowboy']::public.farm_role_enum[]);
  if not exists(select 1 from public.eventos event where event.id=event_id and event.fazenda_id=fazenda_id and event.animal_id=animal_id and event.dominio='obito' and event.deleted_at is null) then
    return jsonb_build_object('outcome','dependency','agenda_id',agenda_id,'animal_id',animal_id,'death_event_id',event_id);
  end if;
  select item.* into agenda from public.sanitario_agenda_v2 item where item.id=agenda_id and item.fazenda_id=fazenda_id and item.deleted_at is null for update;
  if not found or agenda.obrigacao_origem_agenda_id is null then
    result := jsonb_build_object('outcome','not_found','agenda_id',agenda_id,'animal_id',animal_id,'death_event_id',event_id);
  else
    perform pg_advisory_xact_lock(hashtextextended('sanitario:claim:'||fazenda_id::text||':'||agenda.obrigacao_origem_agenda_id::text||':'||animal_id::text,0));
    select item.* into participant from public.sanitario_agenda_animais_v2 item where item.agenda_id=agenda_id and item.fazenda_id=fazenda_id and item.animal_id=animal_id for update;
    if not found then
      result := jsonb_build_object('outcome','not_found','agenda_id',agenda_id,'animal_id',animal_id,'death_event_id',event_id);
    elsif agenda.status<>'programada' or participant.planned_status<>'planejado' or exists(
      select 1 from public.sanitario_atendimentos attendance where attendance.fazenda_id=fazenda_id
        and attendance.obrigacao_origem_agenda_id=agenda.obrigacao_origem_agenda_id and attendance.animal_id=animal_id
    ) then
      result := jsonb_build_object('outcome','conflict','agenda_id',agenda_id,'animal_id',animal_id,'death_event_id',event_id);
    else
      update public.sanitario_agenda_animais_v2 item set planned_status='nao_executado',not_executed_reason='obito:'||event_id::text
        where item.agenda_id=agenda_id and item.fazenda_id=fazenda_id and item.animal_id=animal_id and item.planned_status='planejado';
      update public.sanitario_agenda_v2 item set operational_revision=item.operational_revision+1,closing_barrier=null where item.id=agenda_id and item.fazenda_id=fazenda_id;
      result := jsonb_build_object('outcome','applied','agenda_id',agenda_id,'animal_id',animal_id,'death_event_id',event_id,'root_id',agenda.obrigacao_origem_agenda_id,'replayed',false);
    end if;
  end if;
  insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
    values(fazenda_id,'death_participant',agenda_id,op_id,domain_id,actor_user_id,3,fingerprint,result);
  return result;
end $$;

revoke all on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) to service_role;

commit;
