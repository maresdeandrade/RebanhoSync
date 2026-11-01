-- V3.1-B: one admission, authenticated receipts and fail-closed preparation.
-- No gate is activated and no historical receipt is rewritten.
begin;
lock table public.sanitario_sync_v2_gates, public.sanitario_agenda_v2,
  public.sanitario_agenda_animais_v2, public.sanitario_agenda_closures_v2,
  public.eventos, public.eventos_sanitario, public.eventos_animais,
  public.insumo_movimentacoes, public.agenda_itens, public.fazenda_sanidade_config
  in share row exclusive mode;

create function public.internal_sanitario_v3_fingerprint(actor uuid, farm uuid, command text, args jsonb)
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  a jsonb := args; p jsonb; e jsonb; d jsonb; animals jsonb;
  version integer := (args->>'contract_version')::integer;
begin
  -- Populate the original composites for exact historical fingerprint formulas.
  if command='create_agenda' then
    p := to_jsonb(jsonb_populate_record(null::public.sanitario_sync_v2_agenda_input,a->'payload'));
    a := jsonb_set(a,'{payload}',p);
  elsif command='close_agenda' then
    p := to_jsonb(jsonb_populate_record(null::public.sanitario_sync_v2_closure_input,a->'payload'));
    a := jsonb_set(a,'{payload}',p);
  elsif command='apply_factual_core' then
    e := to_jsonb(jsonb_populate_record(null::public.sanitario_sync_v2_event_input,a->'event_payload'));
    d := to_jsonb(jsonb_populate_record(null::public.sanitario_sync_v2_detail_input,a->'detail_payload'));
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into animals
      from jsonb_populate_recordset(null::public.sanitario_sync_v2_event_animal_input,a->'event_animals') x;
    a := a || jsonb_build_object('event_payload',e,'detail_payload',d,'event_animals',animals);
  end if;
  if version=3 then
    -- Only these arrays are sets. Arrays inside snapshots retain their order.
    if a ? 'animal_ids' then
      select jsonb_agg(value order by value::text) into animals from jsonb_array_elements(a->'animal_ids');
      a := jsonb_set(a,'{animal_ids}',coalesce(animals,'[]'));
    end if;
    if a ? 'event_animals' then
      select jsonb_agg(value order by value->>'animal_id',value->>'id') into animals from jsonb_array_elements(a->'event_animals');
      a := jsonb_set(a,'{event_animals}',coalesce(animals,'[]'));
    end if;
    return encode(sha256(convert_to(jsonb_build_object('actor',actor,'farm',farm,'command',command,'args',a)::text,'UTF8')),'hex');
  end if;
  case command
    when 'create_agenda' then return md5(jsonb_build_object('contract_version',version,'payload',p,'animal_ids',a->'animal_ids')::text);
    when 'replace_agenda_animals' then return md5(jsonb_build_object('contract_version',version,'expected_revision',a->'expected_revision','agenda_id',a->'agenda_id','client_id',a->'client_id','animal_ids',a->'animal_ids')::text);
    when 'apply_factual_core' then return md5(jsonb_build_object('contract_version',version,'expected_revision',a->'expected_revision','event',e,'detail',d,'animals',animals)::text);
    when 'close_agenda' then return md5(jsonb_build_object('contract_version',version,'expected_revision',a->'expected_revision','payload',p)::text);
    when 'set_automation_plan' then return encode(sha256(convert_to(jsonb_build_object('actor',actor,'plan',a->'plan','expected_plan',a->'expected_plan','expected_revision',a->'expected_revision','client_tx_id',a->'client_tx_id')::text,'UTF8')),'hex');
    when 'reschedule_agenda' then return encode(sha256(convert_to(jsonb_build_object('actor',actor,'agenda_id',a->'agenda_id','date',a->'planned_for','expected_revision',a->'expected_revision')::text,'UTF8')),'hex');
    else raise exception 'SANITARIO_OPERATION_NOT_ALLOWLISTED' using errcode='42501';
  end case;
end $$;

-- Preserve each established implementation and its historical fingerprint formula.
-- The six functions are internal implementation details, reachable for new writes
-- only while the authenticated admission has installed transaction-local context.
do $$
declare f record; definition text; marker text; variable text;
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('internal_sanitario_sync_v2_create_agenda','internal_sanitario_sync_v2_replace_agenda_animals',
      'internal_sanitario_sync_v2_apply_factual_core','internal_sanitario_sync_v2_close_agenda','internal_sanitario_sync_v2_set_automation_plan','internal_sanitario_sync_v2_reschedule_agenda')) <> 6 then
    raise exception 'SANITARIO_WRITER_BASELINE_MISMATCH'; end if;
  for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'internal_sanitario_sync_v2_create_agenda','internal_sanitario_sync_v2_replace_agenda_animals',
      'internal_sanitario_sync_v2_apply_factual_core','internal_sanitario_sync_v2_close_agenda',
      'internal_sanitario_sync_v2_set_automation_plan','internal_sanitario_sync_v2_reschedule_agenda')
  loop
    definition := pg_get_functiondef(f.oid);
    if f.proname in ('internal_sanitario_sync_v2_set_automation_plan','internal_sanitario_sync_v2_reschedule_agenda') then
      marker := 'receipt := public.internal_sanitario_sync_v2_existing_result'; variable := 'fingerprint';
    else
      marker := 'v_existing := public.internal_sanitario_sync_v2_existing_result'; variable := 'v_fingerprint';
    end if;
    if position(marker in definition)=0 then raise exception 'SANITARIO_WRITER_BASELINE_MISMATCH'; end if;
    definition := replace(definition,marker,
      variable || ' := coalesce(nullif(current_setting(''rebanhosync.sanitario_v3_fingerprint'',true),''''),' || variable || ');' || chr(10) || marker);
    execute definition;
  end loop;
end $$;

-- Keep all existing product/role/rollout checks, adding the common farm lock and
-- authenticated context before any phase read. No direct V2 new write remains.
do $$
declare definition text; marker text := '  select g.* into v_gate';
begin
  definition := pg_get_functiondef('public.internal_sanitario_sync_v2_authorize(uuid,uuid,integer,text,text,public.farm_role_enum[])'::regprocedure);
  if position(marker in definition)=0 then raise exception 'SANITARIO_AUTHORIZE_BASELINE_MISMATCH'; end if;
  definition := replace(definition,marker,$insert$
  perform pg_advisory_xact_lock_shared(hashtextextended('sanitario-v31:'||fazenda_id::text,0));
  if contract_version <> 3 or current_setting('rebanhosync.sanitario_v3_farm',true) is distinct from fazenda_id::text
    or current_setting('rebanhosync.sanitario_v3_actor',true) is distinct from actor_user_id::text then
    raise exception 'SANITARIO_SINGLE_ADMISSION_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from public.sanitario_sync_v2_gates g where g.fazenda_id=fazenda_id and g.foundation_state='ready') then
    raise exception 'SANITARIO_FOUNDATION_NOT_READY' using errcode='55000';
  end if;
  select g.* into v_gate$insert$);
  execute definition;
end $$;

create function public.internal_sanitario_admit_v3(
  actor_user_id uuid, fazenda_id uuid, command text, operation_args jsonb, receipt_only boolean default false
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
#variable_conflict use_variable
declare
  a jsonb := operation_args; kind text; entity uuid; fingerprint text; receipt jsonb; result jsonb;
  actor_role public.farm_role_enum; client uuid; domain_id uuid; version integer;
  agenda public.sanitario_sync_v2_agenda_input;
  event public.sanitario_sync_v2_event_input;
  detail public.sanitario_sync_v2_detail_input;
  closure public.sanitario_sync_v2_closure_input;
  relations public.sanitario_sync_v2_event_animal_input[]; targets uuid[];
begin
  if current_user <> 'service_role' then raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select uf.role into actor_role from public.user_fazendas uf join public.fazendas f on f.id=uf.fazenda_id and f.deleted_at is null
    where uf.user_id=actor_user_id and uf.fazenda_id=fazenda_id and uf.deleted_at is null;
  if actor_role is null then raise exception 'SANITARIO_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if command not in ('create_agenda','replace_agenda_animals','apply_factual_core','close_agenda','set_automation_plan','reschedule_agenda') then
    raise exception 'SANITARIO_OPERATION_NOT_ALLOWLISTED' using errcode='42501'; end if;
  if actor_role='cowboy' and command <> 'apply_factual_core' then raise exception 'SANITARIO_ROLE_NOT_ALLOWED' using errcode='42501'; end if;
  if a->>'actor_user_id' is distinct from actor_user_id::text or a->>'fazenda_id' is distinct from fazenda_id::text then
    raise exception 'SANITARIO_FAZENDA_CONTEXT_MISMATCH' using errcode='42501'; end if;
  client := (a->>'client_op_id')::uuid; domain_id := (a->>'domain_op_id')::uuid; version := (a->>'contract_version')::integer;
  case command
    when 'create_agenda' then kind:='agenda_create'; entity:=(a->'payload'->>'id')::uuid;
    when 'replace_agenda_animals' then kind:='agenda_targets_replace'; entity:=(a->>'agenda_id')::uuid;
    when 'apply_factual_core' then kind:='factual_core'; entity:=(a->'event_payload'->>'id')::uuid;
    when 'close_agenda' then kind:='administrative_closure'; entity:=(a->'payload'->>'id')::uuid;
    when 'set_automation_plan' then kind:='automation_plan'; entity:=fazenda_id;
    when 'reschedule_agenda' then kind:='agenda_schedule'; entity:=(a->>'agenda_id')::uuid;
  end case;
  fingerprint := public.internal_sanitario_v3_fingerprint(actor_user_id,fazenda_id,command,a);
  -- Lookup acquires the immutable-operation lock; lost ACK is resolved before
  -- checking new-write phase, rollout, revision or product availability.
  receipt := public.internal_sanitario_get_receipt(actor_user_id,fazenda_id,kind,entity,client,domain_id,fingerprint);
  if receipt_only then return receipt; end if;
  if receipt->>'outcome'='found' then return receipt->'canonical_result'; end if;
  if version is distinct from 3 then raise exception 'SANITARIO_CLIENT_CONTRACT_OUTDATED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('sanitario-v31:'||fazenda_id::text,0));
  if not exists(select 1 from public.sanitario_sync_v2_gates g where g.fazenda_id=fazenda_id and g.foundation_state='ready') then
    raise exception 'SANITARIO_FOUNDATION_NOT_READY' using errcode='55000'; end if;
  perform set_config('rebanhosync.sanitario_v3_farm',fazenda_id::text,true);
  perform set_config('rebanhosync.sanitario_v3_actor',actor_user_id::text,true);
  perform set_config('rebanhosync.sanitario_v3_fingerprint',fingerprint,true);
  if command='apply_factual_core' then
    event := jsonb_populate_record(null::public.sanitario_sync_v2_event_input,a->'event_payload');
    detail := jsonb_populate_record(null::public.sanitario_sync_v2_detail_input,a->'detail_payload');
    if event.source_sanitario_agenda_v2_id is not null or event.natureza='primary_execution' or exists (
      with recursive chain as (
        select e.id,e.corrige_evento_id,e.source_sanitario_agenda_v2_id from public.eventos e where e.id=event.corrige_evento_id and e.fazenda_id=fazenda_id
        union select e.id,e.corrige_evento_id,e.source_sanitario_agenda_v2_id from public.eventos e join chain c on e.id=c.corrige_evento_id where e.fazenda_id=fazenda_id
      ) select 1 from chain where source_sanitario_agenda_v2_id is not null
    ) then raise exception 'SANITARIO_V3_EXECUTION_NOT_ENABLED' using errcode='55000'; end if;
    if event.natureza='standalone_fact' and (coalesce(event.payload->>'entry_history_source','') not in ('external_documented','external_declared')
      or detail.produto_sanitario_v2_id is not null or detail.insumo_id is not null or detail.estoque_lote_id is not null
      or detail.carencia_carne_ate is not null or detail.carencia_leite_ate is not null
      or detail.carencia_carne_dias is not null or detail.carencia_leite_dias is not null
      or detail.custo_unitario_snapshot is not null or detail.custo_total_snapshot is not null
      or event.payload->>'creates_agenda'='true' or event.payload->>'creates_stock_movement'='true'
      or event.payload->>'creates_local_execution'='true' or event.payload->>'creates_active_withdrawal'='true'
      or (event.payload->>'entry_history_source'='external_documented' and
        (event.payload->>'evidence_class' is distinct from 'documented' or nullif(btrim(event.payload->>'evidence_reference'),'') is null
          or jsonb_typeof(event.payload->'evidence_covered_fields') is distinct from 'array'))
      or (event.payload->>'entry_history_source'='external_declared' and event.payload->>'evidence_class' is distinct from 'declared')) then
      raise exception 'SANITARIO_EXTERNAL_HISTORY_FORBIDDEN_EFFECT' using errcode='22023'; end if;
    select array_agg(x) into relations from jsonb_populate_recordset(null::public.sanitario_sync_v2_event_animal_input,a->'event_animals') x;
    result := public.internal_sanitario_sync_v2_apply_factual_core(actor_user_id,fazenda_id,version,client,domain_id,(a->>'expected_revision')::bigint,event,detail,relations);
  elsif command='create_agenda' then
    agenda := jsonb_populate_record(null::public.sanitario_sync_v2_agenda_input,a->'payload');
    select array_agg(value::uuid) into targets from jsonb_array_elements_text(a->'animal_ids');
    result := public.internal_sanitario_sync_v2_create_agenda(actor_user_id,fazenda_id,version,client,domain_id,agenda,targets);
  elsif command='replace_agenda_animals' then
    select array_agg(value::uuid) into targets from jsonb_array_elements_text(a->'animal_ids');
    result := public.internal_sanitario_sync_v2_replace_agenda_animals(actor_user_id,fazenda_id,version,client,domain_id,(a->>'expected_revision')::bigint,(a->>'agenda_id')::uuid,a->>'client_id',targets);
    update public.sanitario_agenda_animais_v2 s set obrigacao_origem_agenda_id=g.obrigacao_origem_agenda_id from public.sanitario_agenda_v2 g
      where s.agenda_id=(a->>'agenda_id')::uuid and s.fazenda_id=fazenda_id and g.id=s.agenda_id and g.fazenda_id=s.fazenda_id;
  elsif command='close_agenda' then
    closure := jsonb_populate_record(null::public.sanitario_sync_v2_closure_input,a->'payload');
    if exists(select 1 from public.eventos e where e.fazenda_id=fazenda_id and e.source_sanitario_agenda_v2_id=closure.agenda_id) then
      raise exception 'SANITARIO_V3_EXECUTION_NOT_ENABLED' using errcode='55000'; end if;
    result := public.internal_sanitario_sync_v2_close_agenda(actor_user_id,fazenda_id,version,client,domain_id,(a->>'expected_revision')::bigint,closure);
  elsif command='set_automation_plan' then
    result := public.internal_sanitario_sync_v2_set_automation_plan(actor_user_id,fazenda_id,version,client,domain_id,(a->>'expected_revision')::bigint,a->>'client_id',(a->>'client_tx_id')::uuid,a->'plan',a->'expected_plan');
  elsif command='reschedule_agenda' then
    result := public.internal_sanitario_sync_v2_reschedule_agenda(actor_user_id,fazenda_id,version,client,domain_id,(a->>'expected_revision')::bigint,a->>'client_id',(a->>'agenda_id')::uuid,(a->>'planned_for')::date);
  end if;
  perform set_config('rebanhosync.sanitario_v3_farm','',true);
  perform set_config('rebanhosync.sanitario_v3_actor','',true);
  perform set_config('rebanhosync.sanitario_v3_fingerprint','',true);
  return result;
end $$;

create or replace function public.guard_sanitario_sync_v2_internal_writes()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r jsonb := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  prior jsonb := case when tg_op='INSERT' then '{}' else to_jsonb(old) end;
  farm uuid; source uuid; sanitary boolean; core public.eventos%rowtype;
begin
  farm := (r->>'fazenda_id')::uuid;
  source := coalesce(r->>'evento_id',r->>'source_evento_id',r->>'corrige_evento_id')::uuid;
  sanitary := tg_table_name in ('sanitario_agenda_v2','sanitario_agenda_animais_v2','sanitario_agenda_closures_v2','eventos_sanitario')
    or r->>'dominio'='sanitario' or prior->>'dominio'='sanitario';
  if source is not null then
    select * into core from public.eventos e where e.id=source and e.fazenda_id=farm;
    sanitary := coalesce(sanitary,false) or core.dominio='sanitario';
  end if;
  if tg_op <> 'INSERT' then
    sanitary := coalesce(sanitary,false) or exists(select 1 from public.eventos e
      where e.id=coalesce(prior->>'evento_id',prior->>'source_evento_id',prior->>'corrige_evento_id')::uuid
        and e.fazenda_id=(prior->>'fazenda_id')::uuid and e.dominio='sanitario');
  end if;
  if tg_table_name='fazenda_sanidade_config' then
    sanitary := (tg_op='DELETE' and r->'payload' ? 'sanitary_agenda_automation_v2') or
      r->'payload'->'sanitary_agenda_automation_v2' is distinct from prior->'payload'->'sanitary_agenda_automation_v2';
  end if;
  if coalesce(sanitary,false) then
    if tg_op='UPDATE' and prior->>'fazenda_id' is distinct from r->>'fazenda_id' then
      raise exception 'SANITARIO_FAZENDA_CONTEXT_MISMATCH' using errcode='42501'; end if;
    perform pg_advisory_xact_lock_shared(hashtextextended('sanitario-v31:'||farm::text,0));
    if current_user <> 'service_role' or current_setting('rebanhosync.sanitario_v3_farm',true) is distinct from farm::text
      or nullif(current_setting('rebanhosync.sanitario_v3_actor',true),'') is null then
      raise exception 'SANITARIO_SINGLE_ADMISSION_REQUIRED' using errcode='42501'; end if;
    if not exists(select 1 from public.sanitario_sync_v2_gates g where g.fazenda_id=farm and g.foundation_state='ready') then
      raise exception 'SANITARIO_FOUNDATION_NOT_READY' using errcode='55000'; end if;
    -- This trigger precedes the identity trigger alphabetically. Assign roots on
    -- canonical INSERT only; never promote an existing historical Agenda.
    if tg_op='INSERT' and tg_table_name='sanitario_agenda_v2' then
      new.obrigacao_origem_agenda_id := new.id;
    elsif tg_op='INSERT' and tg_table_name='sanitario_agenda_animais_v2' then
      select g.obrigacao_origem_agenda_id into new.obrigacao_origem_agenda_id
        from public.sanitario_agenda_v2 g where g.id=new.agenda_id and g.fazenda_id=farm;
    end if;
    if tg_table_name='eventos' and (r->>'sanitario_contract_version' is distinct from '3' or r->>'dominio' is distinct from 'sanitario') then
      raise exception 'SANITARIO_SINGLE_ADMISSION_REQUIRED' using errcode='42501'; end if;
    if tg_table_name='eventos_sanitario' and (core.dominio is distinct from 'sanitario'::public.dominio_enum or core.sanitario_contract_version is distinct from 3) then
      raise exception 'SANITARIO_FACTUAL_CORE_REQUIRED' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;

-- Existing four triggers now also protect DELETE. Additional indirect surfaces
-- use the same guard and lock, including the legacy SECURITY DEFINER writer.
do $$
declare tbl text;
begin
  foreach tbl in array array['sanitario_agenda_v2','sanitario_agenda_animais_v2','sanitario_agenda_closures_v2',
    'eventos','eventos_sanitario','eventos_animais','insumo_movimentacoes','agenda_itens','fazenda_sanidade_config'] loop
    execute format('create trigger sanitario_v31_admission_guard before insert or update or delete on public.%I for each row execute function public.guard_sanitario_sync_v2_internal_writes()',tbl);
  end loop;
end $$;

create function public.internal_sanitario_v3_guards_digest() returns text
language sql stable security invoker set search_path=pg_catalog,public as $$
  select md5(string_agg(pg_get_functiondef(p.oid),'' order by p.proname)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('guard_sanitario_sync_v2_internal_writes','internal_sanitario_admit_v3','internal_sanitario_sync_v2_authorize');
$$;

create function public.internal_sanitario_transition_foundation(
  actor_user_id uuid, fazenda_id uuid, expected_state text, target_state text,
  transition_id uuid, expected_revision bigint, prepared_evidence jsonb default null
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
#variable_conflict use_variable
declare g public.sanitario_sync_v2_gates%rowtype;
begin
  if current_user <> 'service_role' then raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.user_fazendas uf join public.fazendas f on f.id=uf.fazenda_id and f.deleted_at is null
    where uf.user_id=actor_user_id and uf.fazenda_id=fazenda_id and uf.deleted_at is null and uf.role in ('owner','manager')) then
    raise exception 'SANITARIO_ROLE_NOT_ALLOWED' using errcode='42501'; end if;
  if transition_id is null or expected_revision is null or not ((expected_state='inactive' and target_state='frozen') or (expected_state='frozen' and target_state='ready')) then
    raise exception 'SANITARIO_FOUNDATION_TRANSITION_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sanitario-v31:'||fazenda_id::text,0));
  select * into g from public.sanitario_sync_v2_gates s where s.fazenda_id=fazenda_id for update;
  if not found then raise exception 'SANITARIO_FOUNDATION_GATE_MISSING' using errcode='55000'; end if;
  if g.foundation_state=target_state and g.foundation_transition_id=transition_id and g.foundation_revision=expected_revision+1
    and (target_state='frozen' or g.foundation_evidence=prepared_evidence) then return to_jsonb(g); end if;
  if g.foundation_state is distinct from expected_state or g.foundation_revision is distinct from expected_revision
    or (expected_state='frozen' and g.foundation_transition_id is distinct from transition_id) then
    raise exception 'SANITARIO_FOUNDATION_TRANSITION_CONFLICT' using errcode='40001'; end if;
  if target_state='ready' then
    if prepared_evidence is null or prepared_evidence->>'frozen_revision' is distinct from expected_revision::text
      or prepared_evidence->>'schema_revision' is distinct from '20261030121000'
      or prepared_evidence->>'guards_digest' is distinct from public.internal_sanitario_v3_guards_digest()
      or nullif(btrim(prepared_evidence->>'consumer_build'),'') is null
      or prepared_evidence->'checks' is distinct from '{"admission":true,"consumers":true,"inventory":true}'::jsonb
      or coalesce(prepared_evidence->>'inventory_disposition','') not in ('empty','preserved','reconciled')
      or to_regclass('public.ux_eventos_sanitario_agenda_primary_execution') is null
      or to_regclass('public.sanitario_atendimentos') is null
      or (select count(*) from pg_trigger where tgname='sanitario_v31_admission_guard' and tgenabled='O') <> 9 then
      raise exception 'SANITARIO_FOUNDATION_EVIDENCE_INVALID' using errcode='55000'; end if;
    update public.sanitario_sync_v2_gates s set foundation_state='ready',foundation_revision=expected_revision+1,
      foundation_prepared_revision=expected_revision,foundation_evidence=prepared_evidence,
      minimum_contract_version=3,maximum_contract_version=3 where s.fazenda_id=fazenda_id returning * into g;
  else
    update public.sanitario_sync_v2_gates s set foundation_state='frozen',foundation_transition_id=transition_id,
      foundation_revision=expected_revision+1,foundation_prepared_revision=null,foundation_evidence=null
      where s.fazenda_id=fazenda_id returning * into g;
  end if;
  return to_jsonb(g);
end $$;

revoke all on function public.internal_sanitario_v3_fingerprint(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.internal_sanitario_v3_guards_digest() from public,anon,authenticated;
revoke all on function public.internal_sanitario_transition_foundation(uuid,uuid,text,text,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.internal_sanitario_v3_fingerprint(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) to service_role;
grant execute on function public.internal_sanitario_v3_guards_digest() to service_role;
grant execute on function public.internal_sanitario_transition_foundation(uuid,uuid,text,text,uuid,bigint,jsonb) to service_role;
-- Current callers have migrated; historical legacy operations without a ledger
-- remain preserved locally, not silently replayed through this definer endpoint.
revoke execute on function public.sanitario_complete_agenda_with_event(uuid,timestamptz,public.sanitario_tipo_enum,text,text,jsonb,text,uuid,uuid,timestamptz) from public,anon,authenticated;
commit;
