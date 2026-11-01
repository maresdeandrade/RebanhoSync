-- V3.2: progressive factual groups, one admission and explicit durable collision.
-- No farm activation, no historical rewriting. Replaces the incompatible primary
-- index only inside the transaction that installs its replacement protections.
begin;
lock table public.eventos,public.eventos_sanitario,public.eventos_animais,public.sanitario_atendimentos,
 public.sanitario_agenda_v2,public.sanitario_agenda_animais_v2 in share row exclusive mode;
alter table public.eventos add column sanitario_v3_confirmation text check(sanitario_v3_confirmation in ('confirmed','collision'));
alter table public.eventos_sanitario add column sanitario_v3_confirmation text check(sanitario_v3_confirmation in ('confirmed','collision'));
grant update(em_disputa,revision,updated_at) on public.sanitario_atendimentos to service_role;
create or replace function public.guard_sanitario_atendimento_factual()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if tg_op='UPDATE' and current_user='service_role'
    and current_setting('rebanhosync.sanitario_v3_farm',true)=new.fazenda_id::text
    and (to_jsonb(new)-array['em_disputa','revision','updated_at'])=(to_jsonb(old)-array['em_disputa','revision','updated_at'])
    and new.em_disputa and not old.em_disputa and new.revision=old.revision+1 then return new; end if;
  if tg_op <> 'INSERT' then
    raise exception 'SANITARIO_ATENDIMENTO_ADMIN_NOT_IMPLEMENTED' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.eventos e
    join public.eventos_sanitario es on es.evento_id = e.id and es.fazenda_id = e.fazenda_id
    join public.sanitario_agenda_v2 a on a.id = e.source_sanitario_agenda_v2_id and a.fazenda_id = e.fazenda_id
    join public.sanitario_agenda_animais_v2 aa on aa.agenda_id = a.id and aa.fazenda_id = a.fazenda_id
      and aa.animal_id = new.animal_id
    join public.sanitario_agenda_animais_v2 raiz on raiz.agenda_id = new.obrigacao_origem_agenda_id
      and raiz.fazenda_id = new.fazenda_id and raiz.animal_id = new.animal_id
    where e.id = new.evento_id and e.fazenda_id = new.fazenda_id
      and e.dominio = 'sanitario'::public.dominio_enum
      and e.sanitario_sync_v2_nature = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
      and (e.sanitario_v3_confirmation is null or e.sanitario_v3_confirmation='confirmed')
      and e.corrige_evento_id is null and e.deleted_at is null and es.deleted_at is null and a.deleted_at is null
      and a.obrigacao_origem_agenda_id = new.obrigacao_origem_agenda_id
      and aa.obrigacao_origem_agenda_id = new.obrigacao_origem_agenda_id
      and raiz.obrigacao_origem_agenda_id = new.obrigacao_origem_agenda_id
  ) then
    raise exception 'SANITARIO_ATENDIMENTO_FACT_SCOPE_INVALID' using errcode = '23503';
  end if;
  return new;
end;
$$;
create or replace function public.internal_sanitario_sync_v2_apply_factual_core(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  expected_revision bigint,
  event_payload public.sanitario_sync_v2_event_input,
  detail_payload public.sanitario_sync_v2_detail_input,
  event_animals public.sanitario_sync_v2_event_animal_input[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_agenda public.sanitario_agenda_v2%rowtype;
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
  v_animal_ids uuid[];
  v_collisions uuid[];
  v_id uuid;
  v_progressive boolean;
  v_claim jsonb;
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, event_payload.client_id,
    'factual_core', array['owner','manager','cowboy']::public.farm_role_enum[]
  );
  if client_op_id is null or domain_op_id is null or event_payload.id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  if event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
     and event_payload.source_sanitario_agenda_v2_id is not null
     and expected_revision is null then
    raise exception 'SANITARIO_EXPECTED_REVISION_REQUIRED' using errcode = '22004';
  end if;
  v_count := coalesce(cardinality(event_animals), 0);
  if v_count = 0 or v_count > 500
     or pg_column_size(pg_catalog.jsonb_build_object(
       'event', to_jsonb(event_payload), 'detail', to_jsonb(detail_payload), 'animals', to_jsonb(event_animals)
     )) > 1048576 then
    raise exception 'SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED' using errcode = '54000';
  end if;
  select array_agg((x).animal_id order by (x).animal_id) into v_animal_ids from unnest(event_animals) x;
  if (select count(distinct (x).id) from unnest(event_animals) x) <> v_count
     or (select count(distinct (x).animal_id) from unnest(event_animals) x) <> v_count
     or exists (select 1 from unnest(event_animals) x where (x).id is null or (x).animal_id is null) then
    raise exception 'SANITARIO_EVENT_ANIMALS_INVALID' using errcode = '22023';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'expected_revision', expected_revision,
    'event', to_jsonb(event_payload), 'detail', to_jsonb(detail_payload), 'animals', to_jsonb(event_animals)
  )::text);
  v_fingerprint := nullif(current_setting('rebanhosync.sanitario_v3_fingerprint',true),'');
  if v_fingerprint is null then raise exception 'SANITARIO_SINGLE_ADMISSION_REQUIRED' using errcode='42501'; end if;
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'factual_core', event_payload.id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.animais a where a.fazenda_id = fazenda_id and a.id = any(v_animal_ids) and a.deleted_at is null) <> v_count then
    raise exception 'SANITARIO_EVENT_ANIMAL_CROSS_FARM_OR_MISSING' using errcode = '23503';
  end if;
  if event_payload.source_sanitario_agenda_v2_id is not null
     and event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum then
    select a.* into v_agenda from public.sanitario_agenda_v2 a
     where a.id = event_payload.source_sanitario_agenda_v2_id and a.fazenda_id = fazenda_id for update;
    if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode = '23503'; end if;
    v_progressive := event_payload.payload->>'sanitario_v3_progressive' = 'true';
    if not coalesce(v_progressive,false) or v_agenda.obrigacao_origem_agenda_id is null then
      raise exception 'SANITARIO_V3_PROGRESSIVE_REQUIRED' using errcode='55000'; end if;
    if v_agenda.status <> 'programada' or v_agenda.deleted_at is not null then
      raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode='55000'; end if;
    if exists(select 1 from unnest(v_animal_ids) id where not exists(
      select 1 from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=v_agenda.id
        and aa.fazenda_id=fazenda_id and aa.animal_id=id and aa.obrigacao_origem_agenda_id=v_agenda.obrigacao_origem_agenda_id)) then
      raise exception 'SANITARIO_EVENT_ANIMAL_OUTSIDE_OBLIGATION' using errcode='23503'; end if;
    -- Stable lock order, same keys used by the claim primitive. Global revision
    -- describes planning and is deliberately not a CAS for disjoint execution.
    foreach v_id in array v_animal_ids loop
      perform pg_advisory_xact_lock(hashtextextended('sanitario:claim:'||fazenda_id::text||':'||v_agenda.obrigacao_origem_agenda_id::text||':'||v_id::text,0));
    end loop;
    select array_agg(s.animal_id order by s.animal_id) into v_collisions from public.sanitario_atendimentos s
      where s.fazenda_id=fazenda_id and s.obrigacao_origem_agenda_id=v_agenda.obrigacao_origem_agenda_id and s.animal_id=any(v_animal_ids);
  elsif event_payload.source_sanitario_agenda_v2_id is not null
        and event_payload.natureza <> 'correction'::public.sanitario_sync_v2_event_nature_enum then
    raise exception 'SANITARIO_AGENDA_SOURCE_REQUIRES_PRIMARY_EXECUTION' using errcode = '22023';
  end if;
  if event_payload.natureza = 'correction'::public.sanitario_sync_v2_event_nature_enum
     and not exists (
       select 1 from public.eventos e
       where e.id = event_payload.corrige_evento_id and e.fazenda_id = fazenda_id
         and e.dominio = 'sanitario'::public.dominio_enum and e.deleted_at is null
     ) then
    raise exception 'SANITARIO_CORRECTED_EVENT_NOT_FOUND' using errcode = '23503';
  end if;
  perform pg_catalog.set_config('statement_timeout', '10s', true);
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  insert into public.eventos(
    id, fazenda_id, dominio, occurred_at, animal_id, lote_id,
    source_sanitario_agenda_v2_id, corrige_evento_id, observacoes, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at,
    sanitario_sync_v2_nature, sanitario_contract_version, domain_op_id, sanitario_v3_confirmation
  ) values (
    event_payload.id, fazenda_id, 'sanitario', event_payload.occurred_at,
    event_payload.animal_id, event_payload.lote_id,
    event_payload.source_sanitario_agenda_v2_id, event_payload.corrige_evento_id,
    event_payload.observacoes, coalesce(event_payload.payload, '{}'::jsonb),
    event_payload.client_id, client_op_id, event_payload.client_tx_id,
    event_payload.client_recorded_at, event_payload.natureza, contract_version, domain_op_id,
    case when v_progressive then case when v_collisions is null then 'confirmed' else 'collision' end end
  );
  insert into public.eventos_sanitario(
    evento_id, fazenda_id, tipo, produto, payload, client_id, client_op_id,
    client_tx_id, client_recorded_at, produto_sanitario_v2_id, insumo_id,
    produto_nome_snapshot, produto_snapshot, estoque_lote_id,
    estoque_lote_codigo_snapshot, lote_fabricante, validade_produto,
    dose_quantidade, dose_unidade, via_aplicacao, responsavel_nome, responsavel_tipo,
    carencia_carne_dias, carencia_leite_dias, carencia_carne_ate, carencia_leite_ate,
    custo_unitario_snapshot, custo_total_snapshot, sanitario_contract_version, domain_op_id, sanitario_v3_confirmation
  ) values (
    event_payload.id, fazenda_id, detail_payload.tipo,
    coalesce(nullif(btrim(detail_payload.produto_nome_snapshot), ''), 'Produto sanitario v2'),
    coalesce(detail_payload.payload, '{}'::jsonb), event_payload.client_id, client_op_id,
    event_payload.client_tx_id, event_payload.client_recorded_at,
    detail_payload.produto_sanitario_v2_id, detail_payload.insumo_id,
    detail_payload.produto_nome_snapshot, coalesce(detail_payload.produto_snapshot, '{}'::jsonb),
    detail_payload.estoque_lote_id, detail_payload.estoque_lote_codigo_snapshot,
    detail_payload.lote_fabricante, detail_payload.validade_produto,
    detail_payload.dose_quantidade, detail_payload.dose_unidade, detail_payload.via_aplicacao,
    detail_payload.responsavel_nome, detail_payload.responsavel_tipo,
    case when v_collisions is null then detail_payload.carencia_carne_dias end, case when v_collisions is null then detail_payload.carencia_leite_dias end,
    case when v_collisions is null then detail_payload.carencia_carne_ate end, case when v_collisions is null then detail_payload.carencia_leite_ate end,
    case when v_collisions is null then detail_payload.custo_unitario_snapshot end, case when v_collisions is null then detail_payload.custo_total_snapshot end,
    contract_version, domain_op_id,
    case when v_progressive then case when v_collisions is null then 'confirmed' else 'collision' end end
  );
  insert into public.eventos_animais(id, fazenda_id, evento_id, animal_id)
  select (x).id, fazenda_id, event_payload.id, (x).animal_id from unnest(event_animals) x;
  if event_payload.source_sanitario_agenda_v2_id is not null
     and event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum then
    if v_collisions is null then
      foreach v_id in array v_animal_ids loop
        v_claim := public.internal_sanitario_claim_atendimento(fazenda_id,v_agenda.obrigacao_origem_agenda_id,v_id,event_payload.id);
        if v_claim->>'outcome' <> 'claimed' then raise exception 'SANITARIO_CLAIM_ATOMICITY_FAILED'; end if;
      end loop;
      update public.sanitario_agenda_animais_v2 aa set planned_status='executado',execution_evento_id=event_payload.id
        where aa.agenda_id=v_agenda.id and aa.fazenda_id=fazenda_id and aa.animal_id=any(v_animal_ids);
    else
      update public.sanitario_atendimentos s set em_disputa=true, revision=s.revision+1,updated_at=transaction_timestamp()
        where s.fazenda_id=fazenda_id and s.obrigacao_origem_agenda_id=v_agenda.obrigacao_origem_agenda_id and s.animal_id=any(v_collisions) and not s.em_disputa;
    end if;
  end if;
  v_result := jsonb_build_object('evento_id',event_payload.id,'agenda_id',event_payload.source_sanitario_agenda_v2_id,
    'agenda_status',case when v_progressive then 'programada' end,'revision',v_agenda.revision,
    'confirmed',v_collisions is null,'outcome',case when v_collisions is null then 'confirmed' else 'collision' end,
    'collision_animal_ids',coalesce(to_jsonb(v_collisions),'[]'::jsonb),'animal_ids',to_jsonb(v_animal_ids),'replayed',false);
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'factual_core', event_payload.id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;

create or replace function public.internal_sanitario_admit_v3(
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
    if ((event.source_sanitario_agenda_v2_id is not null or event.natureza='primary_execution') and
        (event.natureza is distinct from 'primary_execution' or event.source_sanitario_agenda_v2_id is null or event.payload->>'sanitario_v3_progressive' is distinct from 'true')) or exists (
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


-- Keep the original predicate as a lookup index. The old uniqueness prohibited
-- multiple events for even disjoint animals; attendance PK + immutable ledger
-- now provide operation and obligation protection.
create index ix_eventos_sanitario_agenda_primary_execution on public.eventos(fazenda_id,source_sanitario_agenda_v2_id)
 where sanitario_sync_v2_nature='primary_execution' and source_sanitario_agenda_v2_id is not null and deleted_at is null;
drop index public.ux_eventos_sanitario_agenda_primary_execution;
commit;
