-- Revision conflicts are domain HTTP 409 errors, not serialization failures.
-- CREATE OR REPLACE preserves the existing ownership and EXECUTE grants.

create or replace function public.internal_sanitario_sync_v2_replace_agenda_animals(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  expected_revision bigint,
  agenda_id uuid,
  client_id text,
  animal_ids uuid[]
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
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, client_id,
    'agenda_targets_replace', array['owner','manager']::public.farm_role_enum[]
  );
  if expected_revision is null then
    raise exception 'SANITARIO_EXPECTED_REVISION_REQUIRED' using errcode = '22004';
  end if;
  if client_op_id is null or domain_op_id is null or agenda_id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  v_count := coalesce(cardinality(animal_ids), 0);
  if v_count = 0 or v_count > 500
     or pg_column_size(pg_catalog.jsonb_build_object('agenda_id', agenda_id, 'animal_ids', to_jsonb(animal_ids))) > 1048576 then
    raise exception 'SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED' using errcode = '54000';
  end if;
  if (select count(distinct x) from unnest(animal_ids) x) <> v_count or array_position(animal_ids, null) is not null then
    raise exception 'SANITARIO_AGENDA_TARGETS_INVALID' using errcode = '22023';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'expected_revision', expected_revision,
    'agenda_id', agenda_id, 'client_id', client_id, 'animal_ids', to_jsonb(animal_ids)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'agenda_targets_replace', agenda_id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  select a.* into v_agenda from public.sanitario_agenda_v2 a
   where a.id = agenda_id and a.fazenda_id = fazenda_id for update;
  if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode = '23503'; end if;
  if v_agenda.revision <> expected_revision then
    raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = 'PT409';
  end if;
  if v_agenda.status <> 'programada'::public.sanitario_agenda_v2_status_enum then
    raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode = '55000';
  end if;
  if (select count(*) from public.animais a where a.fazenda_id = fazenda_id and a.id = any(animal_ids) and a.deleted_at is null) <> v_count then
    raise exception 'SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING' using errcode = '23503';
  end if;
  perform pg_catalog.set_config('statement_timeout', '10s', true);
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  delete from public.sanitario_agenda_animais_v2 aa
   where aa.agenda_id = agenda_id and aa.fazenda_id = fazenda_id;
  insert into public.sanitario_agenda_animais_v2(agenda_id, fazenda_id, animal_id)
  select agenda_id, fazenda_id, x from unnest(animal_ids) x;
  update public.sanitario_agenda_v2 a
     set revision = a.revision + 1
   where a.id = agenda_id and a.fazenda_id = fazenda_id;
  v_result := pg_catalog.jsonb_build_object(
    'agenda_id', agenda_id, 'status', 'programada', 'revision', expected_revision + 1,
    'animal_ids', to_jsonb(animal_ids), 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'agenda_targets_replace', agenda_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
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
    if v_agenda.revision <> expected_revision then
      raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = 'PT409';
    end if;
    if v_agenda.status <> 'programada'::public.sanitario_agenda_v2_status_enum then
      raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode = '55000';
    end if;
    if exists (
      (select aa.animal_id from public.sanitario_agenda_animais_v2 aa
        where aa.agenda_id = v_agenda.id and aa.fazenda_id = fazenda_id)
      except
      (select unnest(v_animal_ids))
    ) or exists (
      (select unnest(v_animal_ids))
      except
      (select aa.animal_id from public.sanitario_agenda_animais_v2 aa
        where aa.agenda_id = v_agenda.id and aa.fazenda_id = fazenda_id)
    ) then
      raise exception 'SANITARIO_EVENT_ANIMALS_MUST_MATCH_AGENDA' using errcode = '22023';
    end if;
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
    sanitario_sync_v2_nature, sanitario_contract_version, domain_op_id
  ) values (
    event_payload.id, fazenda_id, 'sanitario', event_payload.occurred_at,
    event_payload.animal_id, event_payload.lote_id,
    event_payload.source_sanitario_agenda_v2_id, event_payload.corrige_evento_id,
    event_payload.observacoes, coalesce(event_payload.payload, '{}'::jsonb),
    event_payload.client_id, client_op_id, event_payload.client_tx_id,
    event_payload.client_recorded_at, event_payload.natureza, contract_version, domain_op_id
  );
  insert into public.eventos_sanitario(
    evento_id, fazenda_id, tipo, produto, payload, client_id, client_op_id,
    client_tx_id, client_recorded_at, produto_sanitario_v2_id, insumo_id,
    produto_nome_snapshot, produto_snapshot, estoque_lote_id,
    estoque_lote_codigo_snapshot, lote_fabricante, validade_produto,
    dose_quantidade, dose_unidade, via_aplicacao, responsavel_nome, responsavel_tipo,
    carencia_carne_dias, carencia_leite_dias, carencia_carne_ate, carencia_leite_ate,
    custo_unitario_snapshot, custo_total_snapshot, sanitario_contract_version, domain_op_id
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
    detail_payload.carencia_carne_dias, detail_payload.carencia_leite_dias,
    detail_payload.carencia_carne_ate, detail_payload.carencia_leite_ate,
    detail_payload.custo_unitario_snapshot, detail_payload.custo_total_snapshot,
    contract_version, domain_op_id
  );
  insert into public.eventos_animais(id, fazenda_id, evento_id, animal_id)
  select (x).id, fazenda_id, event_payload.id, (x).animal_id from unnest(event_animals) x;
  if event_payload.source_sanitario_agenda_v2_id is not null
     and event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum then
    update public.sanitario_agenda_animais_v2 aa
       set planned_status = 'executado', execution_evento_id = event_payload.id
     where aa.agenda_id = event_payload.source_sanitario_agenda_v2_id
       and aa.fazenda_id = fazenda_id;
    update public.sanitario_agenda_v2 a
       set status = 'fechada', revision = a.revision + 1
     where a.id = event_payload.source_sanitario_agenda_v2_id
       and a.fazenda_id = fazenda_id;
  end if;
  v_result := pg_catalog.jsonb_build_object(
    'evento_id', event_payload.id,
    'agenda_id', event_payload.source_sanitario_agenda_v2_id,
    'agenda_status', case when event_payload.source_sanitario_agenda_v2_id is null then null else 'fechada' end,
    'revision', case when event_payload.source_sanitario_agenda_v2_id is null then null else expected_revision + 1 end,
    'animal_ids', to_jsonb(v_animal_ids), 'replayed', false
  );
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

create or replace function public.internal_sanitario_sync_v2_close_agenda(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  expected_revision bigint,
  payload public.sanitario_sync_v2_closure_input
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_agenda public.sanitario_agenda_v2%rowtype;
  v_status public.sanitario_agenda_v2_status_enum;
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, payload.client_id,
    'administrative_closure', array['owner','manager']::public.farm_role_enum[]
  );
  if expected_revision is null then
    raise exception 'SANITARIO_EXPECTED_REVISION_REQUIRED' using errcode = '22004';
  end if;
  if client_op_id is null or domain_op_id is null or payload.id is null or payload.agenda_id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  if payload.closure_type not in (
    'cancelled'::public.sanitario_agenda_closure_v2_type_enum,
    'dismissed'::public.sanitario_agenda_closure_v2_type_enum
  ) then
    raise exception 'SANITARIO_ADMINISTRATIVE_CLOSURE_TYPE_INVALID' using errcode = '22023';
  end if;
  v_status := case payload.closure_type
    when 'cancelled'::public.sanitario_agenda_closure_v2_type_enum then 'cancelada'::public.sanitario_agenda_v2_status_enum
    else 'dispensada'::public.sanitario_agenda_v2_status_enum
  end;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'expected_revision', expected_revision, 'payload', to_jsonb(payload)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'administrative_closure', payload.id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  select a.* into v_agenda from public.sanitario_agenda_v2 a
   where a.id = payload.agenda_id and a.fazenda_id = fazenda_id for update;
  if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode = '23503'; end if;
  if v_agenda.revision <> expected_revision then
    raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = 'PT409';
  end if;
  if v_agenda.status <> 'programada'::public.sanitario_agenda_v2_status_enum
     or exists (
       select 1 from public.eventos e
       where e.fazenda_id = fazenda_id
         and e.source_sanitario_agenda_v2_id = payload.agenda_id
         and e.sanitario_sync_v2_nature = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
         and e.deleted_at is null
     ) then
    raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  insert into public.sanitario_agenda_closures_v2(
    id, fazenda_id, agenda_id, closure_type, dedup_key, client_id, client_op_id,
    client_tx_id, client_recorded_at, closed_at, closed_by, execution_evento_id,
    reason, partial_payload, metadata, contract_version, domain_op_id
  ) values (
    payload.id, fazenda_id, payload.agenda_id, payload.closure_type, payload.dedup_key,
    payload.client_id, client_op_id, payload.client_tx_id, payload.client_recorded_at,
    payload.closed_at, actor_user_id, null, payload.reason,
    coalesce(payload.partial_payload, '{}'::jsonb), coalesce(payload.metadata, '{}'::jsonb),
    contract_version, domain_op_id
  );
  update public.sanitario_agenda_v2 a
     set status = v_status, revision = a.revision + 1
   where a.id = payload.agenda_id and a.fazenda_id = fazenda_id;
  v_result := pg_catalog.jsonb_build_object(
    'closure_id', payload.id, 'agenda_id', payload.agenda_id,
    'status', v_status, 'revision', expected_revision + 1, 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'administrative_closure', payload.id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;
