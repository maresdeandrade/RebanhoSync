-- Extend the existing sanitary queue/ledger. No gate, seed or curatorial approval.
alter table public.sanitario_sync_v2_operations drop constraint ck_sanitario_sync_v2_operation_kind;
alter table public.sanitario_sync_v2_operations add constraint ck_sanitario_sync_v2_operation_kind check
  (operation_kind in ('agenda_create','agenda_targets_replace','factual_core','administrative_closure','automation_plan','agenda_schedule'));

create function public.guard_sanitary_automation_plan_writer_v2()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if (tg_op = 'INSERT' and new.payload ? 'sanitary_agenda_automation_v2') or
    (tg_op = 'UPDATE' and new.payload->'sanitary_agenda_automation_v2' is distinct from old.payload->'sanitary_agenda_automation_v2') then
    if current_user <> 'service_role' or current_setting('rebanhosync.sanitario_sync_v2_internal',true) is distinct from 'on' then
      raise exception 'SANITARIO_PLAN_CANONICAL_WRITER_REQUIRED' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_sanitary_automation_plan_writer_v2 before insert or update on public.fazenda_sanidade_config
for each row execute function public.guard_sanitary_automation_plan_writer_v2();
revoke all on function public.guard_sanitary_automation_plan_writer_v2() from public,anon,authenticated;
grant execute on function public.guard_sanitary_automation_plan_writer_v2() to service_role;

create function public.internal_sanitario_sync_v2_set_automation_plan(
  actor_user_id uuid, fazenda_id uuid, contract_version integer, client_op_id uuid, domain_op_id uuid,
  expected_revision bigint, client_id text, client_tx_id uuid, plan jsonb, expected_plan jsonb
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
#variable_conflict use_variable
declare
  config public.fazenda_sanidade_config%rowtype; current_revision bigint; fingerprint text; receipt jsonb; rule jsonb; accepted jsonb;
begin
  -- Same owner/manager planning permission and farm rollout gate as Agenda creation.
  perform public.internal_sanitario_sync_v2_authorize(actor_user_id,fazenda_id,contract_version,client_id,'agenda_create',array['owner','manager']::public.farm_role_enum[]);
  if client_op_id is null or domain_op_id is null or client_tx_id is null or expected_revision is null or expected_revision < 0
    or jsonb_typeof(plan) is distinct from 'object' or jsonb_typeof(plan->'enabled') is distinct from 'boolean'
    or coalesce(plan->>'schemaVersion','') not in ('1','2') or (plan->>'revision')::bigint is distinct from expected_revision+1
    or jsonb_typeof(plan->'rules') is distinct from 'array' or jsonb_array_length(plan->'rules') > 20
    or jsonb_typeof(plan->'context') is distinct from 'object' then
    raise exception 'SANITARIO_PLAN_INVALID' using errcode='22023';
  end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('actor',actor_user_id,'plan',plan,'expected_plan',expected_plan,'expected_revision',expected_revision,'client_tx_id',client_tx_id)::text,'UTF8')),'hex');
  receipt := public.internal_sanitario_sync_v2_existing_result(fazenda_id,'automation_plan',fazenda_id,client_op_id,domain_op_id,fingerprint);
  if receipt is not null then return receipt; end if;
  select * into config from public.fazenda_sanidade_config c where c.fazenda_id=fazenda_id and c.deleted_at is null for update;
  if not found then raise exception 'SANITARIO_PLAN_CONFIG_NOT_FOUND' using errcode='23503'; end if;
  current_revision := coalesce((config.payload->'sanitary_agenda_automation_v2'->>'revision')::bigint,0);
  if current_revision <> expected_revision or
    ((config.payload->'sanitary_agenda_automation_v2') - array['confirmedBy','confirmedAt','updatedAt']) is distinct from
    (nullif(expected_plan,'null'::jsonb) - array['confirmedBy','confirmedAt','updatedAt']) then
    raise exception 'SANITARIO_PLAN_REVISION_CONFLICT current_revision=%', current_revision using errcode='PT409';
  end if;
  if (plan->>'enabled')::boolean then
    if jsonb_array_length(plan->'rules')=0 then raise exception 'SANITARIO_PLAN_RULE_REQUIRED' using errcode='22023'; end if;
    for rule in select value from jsonb_array_elements(plan->'rules') loop
      if not exists (select 1 from public.sanitario_protocolos_v2 p join public.sanitario_protocolo_itens_versions_v2 i on i.protocol_id=p.id
        where p.id::text=rule->>'protocolId' and p.version=(rule->>'protocolVersion')::integer and p.deleted_at is null and p.scope='global'
          and p.status='active' and p.approval_status='approved' and p.approved_by is not null
          and i.id::text=rule->>'itemId' and i.version=(rule->>'itemVersion')::integer and i.status='active' and i.deleted_at is null and i.allows_agenda_auto
          and i.product_id::text is not distinct from rule->>'productId'
          and position('no_agenda_auto' in i.limitations::text || i.snapshot_template::text)=0) then
        raise exception 'SANITARIO_PLAN_RULE_NOT_APPROVED' using errcode='23514';
      end if;
    end loop;
  end if;
  accepted := plan || jsonb_build_object('confirmedBy',actor_user_id,'confirmedAt',transaction_timestamp(),'updatedAt',transaction_timestamp());
  perform set_config('rebanhosync.sanitario_sync_v2_internal','on',true);
  update public.fazenda_sanidade_config c set payload=jsonb_set(coalesce(c.payload,'{}'::jsonb),'{sanitary_agenda_automation_v2}',accepted),
    client_id=client_id,client_op_id=client_op_id,client_tx_id=client_tx_id,client_recorded_at=transaction_timestamp()
    where c.fazenda_id=fazenda_id;
  receipt := jsonb_build_object('command','set_automation_plan','fazenda_id',fazenda_id,'status','saved','revision',expected_revision+1,'replayed',false);
  insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
    values(fazenda_id,'automation_plan',fazenda_id,client_op_id,domain_op_id,actor_user_id,contract_version,fingerprint,receipt);
  return receipt;
end $$;

create function public.internal_sanitario_sync_v2_reschedule_agenda(
  actor_user_id uuid, fazenda_id uuid, contract_version integer, client_op_id uuid, domain_op_id uuid,
  expected_revision bigint, client_id text, agenda_id uuid, planned_for date
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
#variable_conflict use_variable
declare agenda public.sanitario_agenda_v2%rowtype; fingerprint text; receipt jsonb;
begin
  perform public.internal_sanitario_sync_v2_authorize(actor_user_id,fazenda_id,contract_version,client_id,'agenda_targets_replace',array['owner','manager']::public.farm_role_enum[]);
  if client_op_id is null or domain_op_id is null or agenda_id is null or planned_for is null or expected_revision is null or expected_revision < 0 then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode='22004'; end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('actor',actor_user_id,'agenda_id',agenda_id,'date',planned_for,'expected_revision',expected_revision)::text,'UTF8')),'hex');
  receipt := public.internal_sanitario_sync_v2_existing_result(fazenda_id,'agenda_schedule',agenda_id,client_op_id,domain_op_id,fingerprint);
  if receipt is not null then return receipt; end if;
  select * into agenda from public.sanitario_agenda_v2 a where a.id=agenda_id and a.fazenda_id=fazenda_id for update;
  if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode='23503'; end if;
  if agenda.revision <> expected_revision then raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%',agenda.revision using errcode='PT409'; end if;
  if agenda.status <> 'programada' or agenda.deleted_at is not null or exists
    (select 1 from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=agenda_id and (aa.planned_status='executado' or aa.execution_evento_id is not null)) then
    raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode='55000'; end if;
  perform set_config('rebanhosync.sanitario_sync_v2_internal','on',true);
  update public.sanitario_agenda_v2 a set data_programada=planned_for,revision=a.revision+1 where a.id=agenda_id and a.fazenda_id=fazenda_id;
  receipt := jsonb_build_object('command','reschedule_agenda','agenda_id',agenda_id,'status','programada','revision',expected_revision+1,'replayed',false);
  insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
    values(fazenda_id,'agenda_schedule',agenda_id,client_op_id,domain_op_id,actor_user_id,contract_version,fingerprint,receipt);
  return receipt;
end $$;

revoke all on function public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.internal_sanitario_sync_v2_reschedule_agenda(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,date) from public,anon,authenticated;
grant execute on function public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb) to service_role;
grant execute on function public.internal_sanitario_sync_v2_reschedule_agenda(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,date) to service_role;

-- Preserve the existing signature, fingerprint and old queued operations.
create or replace function public.internal_sanitario_sync_v2_create_agenda(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  payload public.sanitario_sync_v2_agenda_input,
  animal_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
  v_agenda public.sanitario_agenda_v2%rowtype;
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, payload.client_id,
    'agenda_create', array['owner','manager']::public.farm_role_enum[]
  );
  if client_op_id is null or domain_op_id is null or payload.id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  v_count := coalesce(cardinality(animal_ids), 0);
  if v_count = 0 or v_count > 500
     or pg_column_size(pg_catalog.jsonb_build_object('payload', to_jsonb(payload), 'animal_ids', to_jsonb(animal_ids))) > 1048576 then
    raise exception 'SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED' using errcode = '54000';
  end if;
  if (select count(distinct x) from unnest(animal_ids) x) <> v_count or array_position(animal_ids, null) is not null then
    raise exception 'SANITARIO_AGENDA_TARGETS_INVALID' using errcode = '22023';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'payload', to_jsonb(payload), 'animal_ids', to_jsonb(animal_ids)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'agenda_create', payload.id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  -- Serialize the stable Agenda identity across devices, independently of client operation IDs.
  perform pg_advisory_xact_lock(hashtextextended(fazenda_id::text || ':agenda:' || coalesce(payload.dedup_key,payload.id::text),0));
  if payload.protocol_item_snapshot->>'generationMode'='automatic' and exists (
    select 1 from public.sanitario_agenda_v2 a where a.fazenda_id=fazenda_id and a.dedup_key=payload.dedup_key and a.id<>payload.id
  ) then raise exception 'SANITARIO_AUTOMATIC_IDENTITY_CONFLICT' using errcode='23505'; end if;
  select * into v_agenda from public.sanitario_agenda_v2 a where a.id=payload.id and a.fazenda_id=fazenda_id for update;
  if found then
    if v_agenda.dedup_key is distinct from payload.dedup_key
      or coalesce(v_agenda.catalog_protocolo_v2_id,v_agenda.protocolo_id) is distinct from payload.protocolo_id
      or coalesce(v_agenda.catalog_protocol_item_version_v2_id,v_agenda.protocol_item_version_id) is distinct from payload.protocol_item_version_id
      or (select array_agg(aa.animal_id order by aa.animal_id) from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=v_agenda.id and aa.fazenda_id=fazenda_id)
        is distinct from (select array_agg(x order by x) from unnest(animal_ids) x) then
      raise exception 'SANITARIO_AGENDA_IDENTITY_CONFLICT' using errcode='23505';
    end if;
    -- Never overwrite a cancellation, schedule change or factual execution with another create.
    v_result := jsonb_build_object('agenda_id',v_agenda.id,'status',v_agenda.status,'revision',v_agenda.revision,
      'animal_ids',to_jsonb(animal_ids),'replayed',false,'deduplicated',true);
    insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
      values(fazenda_id,'agenda_create',payload.id,client_op_id,domain_op_id,actor_user_id,contract_version,v_fingerprint,v_result);
    return v_result;
  end if;
  if payload.protocol_item_snapshot->>'generationMode'='automatic' then
    -- Validate publication and farm activation; individual eligibility stays in the existing engine.
    if not exists (
      select 1 from public.sanitario_protocolos_v2 p join public.sanitario_protocolo_itens_versions_v2 i on i.protocol_id=p.id
      join public.fazenda_sanidade_config c on c.fazenda_id=fazenda_id and c.deleted_at is null
      cross join lateral jsonb_array_elements(c.payload->'sanitary_agenda_automation_v2'->'rules') r
      where p.id=payload.protocolo_id and p.scope='global' and p.status='active' and p.deleted_at is null
        and p.approval_status='approved' and p.approved_by is not null
        and i.id=payload.protocol_item_version_id and i.status='active' and i.deleted_at is null and i.allows_agenda_auto
        and position('no_agenda_auto' in i.limitations::text || i.snapshot_template::text)=0
        and c.payload->'sanitary_agenda_automation_v2'->>'enabled'='true'
        and (payload.metadata->>'automationPlanRevision')::bigint=(c.payload->'sanitary_agenda_automation_v2'->>'revision')::bigint
        and r->>'protocolId'=p.id::text and (r->>'protocolVersion')::integer=p.version
        and r->>'itemId'=i.id::text and (r->>'itemVersion')::integer=i.version
        and (payload.protocol_item_snapshot->'planningEvidence'->>'itemVersion')::integer=i.version
        and i.product_id::text is not distinct from r->>'productId'
    ) then raise exception 'SANITARIO_AUTOMATIC_RULE_NOT_APPROVED_OR_ACTIVATED' using errcode='23514'; end if;
  end if;
  if (select count(*) from public.animais a where a.fazenda_id = fazenda_id and a.id = any(animal_ids) and a.deleted_at is null) <> v_count then
    raise exception 'SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING' using errcode = '23503';
  end if;
  perform pg_catalog.set_config('statement_timeout', '10s', true);
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  insert into public.sanitario_agenda_v2(
    id, fazenda_id, status, revision, contract_version, domain_op_id, dedup_key,
    client_id, client_op_id, client_tx_id, client_recorded_at, source_demand_key,
    preview_group_id, protocolo_id, protocol_item_version_id, protocol_item_snapshot,
    janela_inicio, janela_fim, data_programada, lote_id, produto_snapshot,
    produto_classe, acao_sanitaria, metadata
  ) values (
    payload.id, fazenda_id, 'programada', 0, contract_version, domain_op_id, payload.dedup_key,
    payload.client_id, client_op_id, payload.client_tx_id, payload.client_recorded_at,
    payload.source_demand_key, payload.preview_group_id, payload.protocolo_id,
    payload.protocol_item_version_id, coalesce(payload.protocol_item_snapshot, '{}'::jsonb),
    payload.janela_inicio, payload.janela_fim, payload.data_programada, payload.lote_id,
    coalesce(payload.produto_snapshot, '{}'::jsonb), payload.produto_classe,
    payload.acao_sanitaria, coalesce(payload.metadata, '{}'::jsonb)
  );
  insert into public.sanitario_agenda_animais_v2(agenda_id, fazenda_id, animal_id)
  select payload.id, fazenda_id, x from unnest(animal_ids) x;
  v_result := pg_catalog.jsonb_build_object(
    'agenda_id', payload.id, 'status', 'programada', 'revision', 0,
    'animal_ids', to_jsonb(animal_ids), 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'agenda_create', payload.id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;
