-- commercial_operation_v2: atomic purchase/sale for one animal or a frozen lot snapshot.
-- commercial_purchase_v1 remains available for queued legacy individual purchases.

create or replace function public.commercial_operation_compact_json(p_value jsonb)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case jsonb_typeof(p_value)
    when 'object' then (
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.commercial_operation_compact_json(value), ',' order by key), '') || '}'
      from jsonb_each(p_value)
    )
    when 'array' then (
      select '[' || coalesce(string_agg(public.commercial_operation_compact_json(value), ',' order by ordinality), '') || ']'
      from jsonb_array_elements(p_value) with ordinality
    )
    else p_value::text
  end;
$$;

revoke all on function public.commercial_operation_compact_json(jsonb) from public;
revoke all on function public.commercial_operation_compact_json(jsonb) from anon;
revoke all on function public.commercial_operation_compact_json(jsonb) from authenticated;

create or replace function public.apply_commercial_operation_v2(
  p_fazenda_id uuid,
  p_client_op_id uuid,
  p_client_tx_id uuid,
  p_operation jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event jsonb := p_operation->'event';
  v_detail jsonb := p_operation->'detail';
  v_animals jsonb := p_operation->'animals';
  v_operation_type text := p_operation->>'operation_type';
  v_scope text := p_operation->>'scope';
  v_operation_id uuid;
  v_animal_ids uuid[];
  v_animal jsonb;
  v_animal_id uuid;
  v_existing_event public.eventos%rowtype;
  v_existing_detail public.eventos_comercial%rowtype;
  v_existing_animal public.animais%rowtype;
  v_existing_count integer;
  v_expected_count integer;
  v_matching_animals integer := 0;
begin
  if v_user_id is null or not public.has_membership(p_fazenda_id) then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_FORBIDDEN');
  end if;
  if p_client_op_id is null or p_client_tx_id is null or
     p_operation->>'client_op_id' <> p_client_op_id::text or
     p_operation->>'client_tx_id' <> p_client_tx_id::text or
     p_operation->>'domain' <> 'commercial_operation_v2' or
     (p_operation->>'contract_version')::integer <> 2 or p_operation->>'command' <> 'apply_commercial_operation' then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_ENVELOPE_INVALID');
  end if;
  -- Same compact JSON content measured by client/Edge: UTF-8 bytes, never characters
  -- or PostgreSQL's internal jsonb storage size.
  if octet_length(convert_to(public.commercial_operation_compact_json(p_operation), 'UTF8')) > 1048576 then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_PAYLOAD_TOO_LARGE');
  end if;
  v_operation_id := (p_operation->>'operation_id')::uuid;
  v_animal_ids := array(
    select value::uuid from jsonb_array_elements_text(p_operation->'animal_ids') order by value
  );
  v_expected_count := cardinality(v_animal_ids);
  if v_expected_count < 1 or v_expected_count > 500 or
     jsonb_array_length(v_animals) <> v_expected_count or
     (select count(distinct u.id) from unnest(v_animal_ids) as u(id)) <> v_expected_count then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_ANIMAL_COUNT_INVALID');
  end if;
  if v_operation_type is null or v_operation_type not in ('compra', 'venda') or
     v_scope is null or v_scope not in ('animal', 'lote') or
     v_event->>'id' is distinct from v_operation_id::text or v_event->>'dominio' is distinct from 'comercial' or
     v_detail->>'evento_id' is distinct from v_operation_id::text or
     v_detail->>'operation_type' is distinct from v_operation_type or
     v_detail->>'scope' is distinct from v_scope or
     (v_detail->>'quantidade_animais')::integer is distinct from v_expected_count or
     v_event->>'occurred_at' is null or
     (p_operation->>'occurred_at')::timestamptz is distinct from (v_event->>'occurred_at')::timestamptz or
     (v_event->>'occurred_at')::timestamptz is distinct from (v_detail->>'occurred_at')::timestamptz then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_DOMAIN_INVALID');
  end if;
  if p_operation->>'fazenda_id' is distinct from p_fazenda_id::text or
     v_event->>'fazenda_id' is distinct from p_fazenda_id::text or
     v_detail->>'fazenda_id' is distinct from p_fazenda_id::text or
     exists (select 1 from jsonb_array_elements(v_animals) item where item->>'fazenda_id' is distinct from p_fazenda_id::text) then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_FARM_MISMATCH');
  end if;
  if (select array_agg((item->>'id')::uuid order by item->>'id') from jsonb_array_elements(v_animals) item)
     is distinct from v_animal_ids or
     array(select value::uuid from jsonb_array_elements_text(p_operation->'animal_ids'))
       is distinct from v_animal_ids then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_ANIMAL_LINK_INVALID');
  end if;
  if array(select value::uuid from jsonb_array_elements_text(v_detail->'animal_ids'))
       is distinct from v_animal_ids or
     (v_scope = 'animal' and v_expected_count = 1 and v_event->>'animal_id' is distinct from v_animal_ids[1]::text) or
     (v_scope = 'lote' and v_event->>'animal_id' is not null) or
     v_event->>'lote_id' is distinct from v_detail->>'lote_id' then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_LINK_INVALID');
  end if;
  if v_operation_type = 'compra' and v_scope = 'animal' and v_expected_count <> 1 then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_INDIVIDUAL_COUNT_INVALID');
  end if;
  if v_scope = 'lote' and v_detail->>'lote_id' is null then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_LOT_REQUIRED');
  end if;

  if v_detail->>'lote_id' is not null then
    -- The row lock conflicts with the composite FK check used when an animal is
    -- concurrently inserted/moved into this lot. Snapshot validation therefore
    -- runs while the lot membership boundary is closed to new committed members.
    perform 1
    from public.lotes
    where id = (v_detail->>'lote_id')::uuid
      and fazenda_id = p_fazenda_id
      and deleted_at is null
    for update;
    if not found then
      return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_LOT_INVALID');
    end if;
  end if;
  if v_detail->>'contraparte_id' is not null and not exists (
    select 1 from public.contrapartes where id = (v_detail->>'contraparte_id')::uuid and fazenda_id = p_fazenda_id and deleted_at is null
  ) then
    return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_COUNTERPARTY_INVALID');
  end if;
  if v_detail->>'finance_transaction_id' is not null and not exists (
    select 1 from public.finance_transactions where id = (v_detail->>'finance_transaction_id')::uuid and fazenda_id = p_fazenda_id and deleted_at is null
  ) then
    return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_FINANCE_LINK_INVALID');
  end if;

  -- Stable lock order prevents individual-vs-lot and lot-vs-lot deadlocks.
  for v_animal_id in select u.id from unnest(v_animal_ids) as u(id) order by u.id loop
    perform pg_advisory_xact_lock(hashtextextended(v_animal_id::text, 0));
  end loop;
  if v_operation_type = 'compra' then
    if (
      select count(distinct lower(btrim(item->>'identificacao')))
      from jsonb_array_elements(v_animals) item
      where item->>'identificacao' is not null and btrim(item->>'identificacao') <> ''
    ) <> v_expected_count then
      return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_IDENTIFICATION_INVALID');
    end if;
    for v_animal in
      select item
      from jsonb_array_elements(v_animals) item
      order by lower(btrim(item->>'identificacao'))
    loop
      perform pg_advisory_xact_lock(
        hashtextextended('commercial-ident:' || lower(btrim(v_animal->>'identificacao')), 2)
      );
    end loop;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_operation_id::text, 1));

  select * into v_existing_event from public.eventos where id = v_operation_id;
  select * into v_existing_detail from public.eventos_comercial where evento_id = v_operation_id;
  v_existing_count := (v_existing_event.id is not null)::integer + (v_existing_detail.evento_id is not null)::integer;

  if v_existing_count > 0 then
    if v_existing_count <> 2 then
      return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_PARTIAL_EXISTING');
    end if;
    if v_existing_event.fazenda_id <> p_fazenda_id or v_existing_detail.fazenda_id <> p_fazenda_id then
      return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_CROSS_FARM');
    end if;
    if public.commercial_purchase_record_fingerprint('event', to_jsonb(v_existing_event)) <>
       public.commercial_purchase_record_fingerprint('event', v_event) then
      return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_EVENT_DIVERGENT');
    end if;
    if public.commercial_purchase_record_fingerprint('detail', to_jsonb(v_existing_detail)) <>
       public.commercial_purchase_record_fingerprint('detail', v_detail) then
      return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_DETAIL_DIVERGENT');
    end if;
    for v_animal in select item from jsonb_array_elements(v_animals) item order by item->>'id' loop
      select * into v_existing_animal from public.animais where id = (v_animal->>'id')::uuid;
      if v_existing_animal.id is null or v_existing_animal.fazenda_id <> p_fazenda_id then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_PARTIAL_EXISTING');
      end if;
      if v_operation_type = 'compra' then
        if public.commercial_purchase_record_fingerprint('animal', to_jsonb(v_existing_animal)) <>
           public.commercial_purchase_record_fingerprint('animal', v_animal) then
          return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_ANIMAL_DIVERGENT');
        end if;
      elsif v_existing_animal.status::text <> 'vendido' or v_existing_animal.data_saida is distinct from (v_animal->>'data_saida')::date or
            v_existing_animal.lote_id is not null then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_SALE_STATE_DIVERGENT');
      end if;
    end loop;
    return jsonb_build_object('status', 'APPLIED', 'replay', true, 'operation_id', v_operation_id, 'animal_ids', to_jsonb(v_animal_ids));
  end if;

  if v_operation_type = 'compra' then
    for v_animal in select item from jsonb_array_elements(v_animals) item order by item->>'id' loop
      if v_animal->>'status' <> 'ativo' or v_animal->>'origem' <> 'compra' then
        return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_PURCHASE_STATE_INVALID');
      end if;
      if v_scope = 'lote' and (v_animal->>'lote_id')::uuid is distinct from (v_detail->>'lote_id')::uuid then
        return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_PURCHASE_LOT_INVALID');
      end if;
      if exists (select 1 from public.animais where id = (v_animal->>'id')::uuid) then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_ANIMAL_ALREADY_EXISTS');
      end if;
      if exists (select 1 from public.animais where fazenda_id = p_fazenda_id and lower(identificacao) = lower(v_animal->>'identificacao') and deleted_at is null) then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_IDENTIFICATION_DUPLICATE');
      end if;
    end loop;
  else
    for v_animal in select item from jsonb_array_elements(v_animals) item order by item->>'id' loop
      if v_animal->>'status' is distinct from 'vendido' or
         v_animal->>'lote_id' is not null or
         (v_animal->>'data_saida')::date is distinct from (v_detail->>'occurred_at')::date then
        return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_SALE_STATE_INVALID');
      end if;
      select * into v_existing_animal from public.animais where id = (v_animal->>'id')::uuid for update;
      if v_existing_animal.id is null or v_existing_animal.fazenda_id <> p_fazenda_id then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_ANIMAL_INVALID');
      end if;
      if v_existing_animal.status::text <> 'ativo' or v_existing_animal.deleted_at is not null then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_ANIMAL_INELIGIBLE');
      end if;
      if v_scope = 'lote' and v_existing_animal.lote_id is distinct from (v_detail->>'lote_id')::uuid then
        return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_LOT_COMPOSITION_CHANGED');
      end if;
    end loop;
    if v_scope = 'lote' and (
      select array_agg(a.id order by a.id)
      from public.animais a
      where a.fazenda_id = p_fazenda_id
        and a.lote_id = (v_detail->>'lote_id')::uuid
        and a.status::text = 'ativo'
        and a.deleted_at is null
    ) is distinct from v_animal_ids then
      return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_LOT_COMPOSITION_CHANGED');
    end if;
  end if;

  if v_operation_type = 'compra' then
    insert into public.animais (
      id, fazenda_id, identificacao, sexo, status, lote_id, data_nascimento, data_entrada, data_saida,
      pai_id, mae_id, nome, rfid, especie, origem, raca, papel_macho, habilitado_monta, observacoes,
      payload, client_id, client_op_id, client_tx_id, client_recorded_at
    )
    select
      (item->>'id')::uuid, p_fazenda_id, item->>'identificacao', (item->>'sexo')::public.sexo_enum,
      'ativo'::public.animal_status_enum, (item->>'lote_id')::uuid, (item->>'data_nascimento')::date,
      (item->>'data_entrada')::date, null, (item->>'pai_id')::uuid, (item->>'mae_id')::uuid,
      item->>'nome', item->>'rfid', item->>'especie', 'compra'::public.origem_enum, item->>'raca',
      (item->>'papel_macho')::public.papel_macho_enum, coalesce((item->>'habilitado_monta')::boolean, false),
      item->>'observacoes', coalesce(item->'payload', '{}'::jsonb), item->>'client_id',
      (item->>'client_op_id')::uuid, p_client_tx_id, (item->>'client_recorded_at')::timestamptz
    from jsonb_array_elements(v_animals) item;
  end if;

  insert into public.eventos (
    id, fazenda_id, dominio, occurred_at, animal_id, lote_id, source_task_id, source_tx_id,
    source_client_op_id, corrige_evento_id, observacoes, payload, client_id, client_op_id,
    client_tx_id, client_recorded_at
  ) values (
    v_operation_id, p_fazenda_id, 'comercial'::public.dominio_enum, (v_event->>'occurred_at')::timestamptz,
    (v_event->>'animal_id')::uuid, (v_event->>'lote_id')::uuid, (v_event->>'source_task_id')::uuid,
    (v_event->>'source_tx_id')::uuid, (v_event->>'source_client_op_id')::uuid,
    (v_event->>'corrige_evento_id')::uuid, v_event->>'observacoes', coalesce(v_event->'payload', '{}'::jsonb),
    v_event->>'client_id', (v_event->>'client_op_id')::uuid, p_client_tx_id,
    (v_event->>'client_recorded_at')::timestamptz
  );

  insert into public.eventos_comercial (
    evento_id, fazenda_id, operation_type, scope, occurred_at, quantidade_animais, peso_vivo_total,
    peso_medio_derivado, valor_bruto, frete, comissao, descontos, taxas_impostos,
    valor_liquido_derivado, contraparte_id, contraparte_nome, animal_ids, lote_id,
    finance_transaction_id, snapshot, calculation_status, issues, limitations, observacoes,
    client_id, client_op_id, client_tx_id, client_recorded_at
  ) values (
    v_operation_id, p_fazenda_id, v_operation_type, v_scope, (v_detail->>'occurred_at')::timestamptz,
    v_expected_count, (v_detail->>'peso_vivo_total')::numeric, (v_detail->>'peso_medio_derivado')::numeric,
    (v_detail->>'valor_bruto')::numeric, (v_detail->>'frete')::numeric, (v_detail->>'comissao')::numeric,
    (v_detail->>'descontos')::numeric, (v_detail->>'taxas_impostos')::numeric,
    (v_detail->>'valor_liquido_derivado')::numeric, (v_detail->>'contraparte_id')::uuid,
    v_detail->>'contraparte_nome', v_animal_ids, (v_detail->>'lote_id')::uuid,
    (v_detail->>'finance_transaction_id')::uuid, coalesce(v_detail->'snapshot', '{}'::jsonb),
    coalesce(v_detail->>'calculation_status', 'partial'), coalesce(v_detail->'issues', '[]'::jsonb),
    coalesce(v_detail->'limitations', '[]'::jsonb), v_detail->>'observacoes', v_detail->>'client_id',
    (v_detail->>'client_op_id')::uuid, p_client_tx_id, (v_detail->>'client_recorded_at')::timestamptz
  );

  if v_operation_type = 'venda' then
    update public.animais a set
      status = 'vendido',
      data_saida = (v_detail->>'occurred_at')::date,
      lote_id = null,
      client_id = item->>'client_id',
      client_op_id = (item->>'client_op_id')::uuid,
      client_tx_id = p_client_tx_id,
      client_recorded_at = (item->>'client_recorded_at')::timestamptz
    from jsonb_array_elements(v_animals) item
    where a.fazenda_id = p_fazenda_id and a.id = (item->>'id')::uuid;
    get diagnostics v_matching_animals = row_count;
    if v_matching_animals <> v_expected_count then
      raise exception using errcode = '40001', message = 'COMMERCIAL_OPERATION_SALE_PARTIAL_UPDATE';
    end if;
  end if;

  return jsonb_build_object('status', 'APPLIED', 'replay', false, 'operation_id', v_operation_id, 'animal_ids', to_jsonb(v_animal_ids));
exception
  when unique_violation or foreign_key_violation or check_violation then
    return jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_OPERATION_CONSTRAINT_CONFLICT', 'reason_message', sqlerrm);
  when not_null_violation or data_exception then
    return jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_OPERATION_PAYLOAD_INVALID', 'reason_message', sqlerrm);
end;
$$;

revoke all on function public.apply_commercial_operation_v2(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.apply_commercial_operation_v2(uuid, uuid, uuid, jsonb) from anon;
grant execute on function public.apply_commercial_operation_v2(uuid, uuid, uuid, jsonb) to authenticated;

comment on function public.apply_commercial_operation_v2(uuid, uuid, uuid, jsonb) is
  'Aplica atomicamente commercial_operation_v2: N animais, um Evento e um eventos_comercial, com replay fail-closed.';
