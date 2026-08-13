-- Fase 14.2: compra individual (animal + evento + detalhe) como uma unidade remota.

create or replace function public.commercial_purchase_record_fingerprint(
  p_kind text,
  p_record jsonb
) returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select pg_catalog.md5(
    case p_kind
      when 'animal' then pg_catalog.jsonb_build_object(
        'id', p_record->'id', 'fazenda_id', p_record->'fazenda_id',
        'identificacao', p_record->'identificacao', 'sexo', p_record->'sexo',
        'status', p_record->'status', 'lote_id', p_record->'lote_id',
        'data_nascimento', to_jsonb((p_record->>'data_nascimento')::date),
        'data_entrada', to_jsonb((p_record->>'data_entrada')::date),
        'data_saida', to_jsonb((p_record->>'data_saida')::date), 'pai_id', p_record->'pai_id',
        'mae_id', p_record->'mae_id', 'nome', p_record->'nome', 'rfid', p_record->'rfid',
        'especie', p_record->'especie', 'origem', p_record->'origem', 'raca', p_record->'raca',
        'papel_macho', p_record->'papel_macho',
        'habilitado_monta', to_jsonb(coalesce((p_record->>'habilitado_monta')::boolean, false)),
        'observacoes', p_record->'observacoes', 'payload', coalesce(p_record->'payload', '{}'::jsonb),
        'client_id', p_record->'client_id', 'client_op_id', p_record->'client_op_id',
        'client_tx_id', p_record->'client_tx_id',
        'client_recorded_at', to_jsonb((p_record->>'client_recorded_at')::timestamptz)
      )
      when 'event' then pg_catalog.jsonb_build_object(
        'id', p_record->'id', 'fazenda_id', p_record->'fazenda_id',
        'dominio', p_record->'dominio',
        'occurred_at', to_jsonb((p_record->>'occurred_at')::timestamptz),
        'animal_id', p_record->'animal_id', 'lote_id', p_record->'lote_id',
        'source_task_id', p_record->'source_task_id', 'source_tx_id', p_record->'source_tx_id',
        'source_client_op_id', p_record->'source_client_op_id',
        'corrige_evento_id', p_record->'corrige_evento_id',
        'observacoes', p_record->'observacoes', 'payload', coalesce(p_record->'payload', '{}'::jsonb),
        'client_id', p_record->'client_id', 'client_op_id', p_record->'client_op_id',
        'client_tx_id', p_record->'client_tx_id',
        'client_recorded_at', to_jsonb((p_record->>'client_recorded_at')::timestamptz)
      )
      when 'detail' then pg_catalog.jsonb_build_object(
        'evento_id', p_record->'evento_id', 'fazenda_id', p_record->'fazenda_id',
        'operation_type', p_record->'operation_type', 'scope', p_record->'scope',
        'occurred_at', to_jsonb((p_record->>'occurred_at')::timestamptz),
        'quantidade_animais', to_jsonb((p_record->>'quantidade_animais')::integer),
        'peso_vivo_total', to_jsonb(pg_catalog.trim_scale((p_record->>'peso_vivo_total')::numeric)),
        'peso_medio_derivado', to_jsonb(pg_catalog.trim_scale((p_record->>'peso_medio_derivado')::numeric)),
        'valor_bruto', to_jsonb(pg_catalog.trim_scale((p_record->>'valor_bruto')::numeric)),
        'frete', to_jsonb(pg_catalog.trim_scale((p_record->>'frete')::numeric)),
        'comissao', to_jsonb(pg_catalog.trim_scale((p_record->>'comissao')::numeric)),
        'descontos', to_jsonb(pg_catalog.trim_scale((p_record->>'descontos')::numeric)),
        'taxas_impostos', to_jsonb(pg_catalog.trim_scale((p_record->>'taxas_impostos')::numeric)),
        'valor_liquido_derivado', to_jsonb(pg_catalog.trim_scale((p_record->>'valor_liquido_derivado')::numeric)),
        'contraparte_id', p_record->'contraparte_id', 'contraparte_nome', p_record->'contraparte_nome',
        'animal_ids', p_record->'animal_ids', 'lote_id', p_record->'lote_id',
        'finance_transaction_id', p_record->'finance_transaction_id',
        'snapshot', coalesce(p_record->'snapshot', '{}'::jsonb),
        'calculation_status', to_jsonb(coalesce(p_record->>'calculation_status', 'partial')),
        'issues', coalesce(p_record->'issues', '[]'::jsonb),
        'limitations', coalesce(p_record->'limitations', '[]'::jsonb),
        'observacoes', p_record->'observacoes', 'client_id', p_record->'client_id',
        'client_op_id', p_record->'client_op_id', 'client_tx_id', p_record->'client_tx_id',
        'client_recorded_at', to_jsonb((p_record->>'client_recorded_at')::timestamptz)
      )
      else pg_catalog.jsonb_build_object('invalid_kind', p_kind)
    end::text
  );
$$;

revoke all on function public.commercial_purchase_record_fingerprint(text, jsonb) from public;

create or replace function public.apply_individual_animal_purchase(
  p_fazenda_id uuid,
  p_client_op_id uuid,
  p_client_tx_id uuid,
  p_animal jsonb,
  p_evento jsonb,
  p_comercial jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_animal public.animais%rowtype;
  v_evento public.eventos%rowtype;
  v_comercial public.eventos_comercial%rowtype;
  v_animal_id uuid;
  v_evento_id uuid;
  v_existing_count integer;
  v_animal_ids uuid[];
begin
  if auth.uid() is null or not public.has_membership(p_fazenda_id) then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_FORBIDDEN');
  end if;
  if p_animal->>'id' is null or p_evento->>'id' is null or p_comercial->>'evento_id' is null then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_PARENT_REQUIRED');
  end if;
  v_animal_id := (p_animal->>'id')::uuid;
  v_evento_id := (p_evento->>'id')::uuid;
  if p_client_op_id is null or p_client_tx_id is null or
     p_animal->>'fazenda_id' <> p_fazenda_id::text or
     p_evento->>'fazenda_id' <> p_fazenda_id::text or
     p_comercial->>'fazenda_id' <> p_fazenda_id::text then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_FARM_MISMATCH');
  end if;
  if p_animal->>'status' <> 'ativo' or p_animal->>'origem' <> 'compra' or
     p_evento->>'dominio' <> 'comercial' or
     p_evento->>'occurred_at' is null or p_comercial->>'occurred_at' is null or
     p_comercial->>'operation_type' <> 'compra' or p_comercial->>'scope' <> 'animal' or
     (p_comercial->>'quantidade_animais')::integer <> 1 or
     p_comercial->'finance_transaction_id' <> 'null'::jsonb then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_DOMAIN_INVALID');
  end if;
  v_animal_ids := array(select value::uuid from pg_catalog.jsonb_array_elements_text(p_comercial->'animal_ids'));
  if p_evento->>'animal_id' <> v_animal_id::text or
     p_comercial->>'evento_id' <> v_evento_id::text or
     pg_catalog.cardinality(v_animal_ids) <> 1 or v_animal_ids[1] <> v_animal_id then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_LINK_MISMATCH');
  end if;
  if (p_evento->>'occurred_at')::timestamptz is distinct from
       (p_comercial->>'occurred_at')::timestamptz or
     (p_animal->>'lote_id')::uuid is distinct from (p_evento->>'lote_id')::uuid or
     (p_evento->>'lote_id')::uuid is distinct from (p_comercial->>'lote_id')::uuid then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_LINK_MISMATCH');
  end if;
  if p_animal->>'client_op_id' <> p_client_op_id::text or
     p_animal->>'client_tx_id' <> p_client_tx_id::text or
     p_evento->>'client_tx_id' <> p_client_tx_id::text or
     p_comercial->>'client_tx_id' <> p_client_tx_id::text then
    return pg_catalog.jsonb_build_object('status', 'REJECTED', 'reason_code', 'COMMERCIAL_PURCHASE_IDENTITY_MISMATCH');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_animal_id::text, 0));

  select * into v_animal from public.animais where id = v_animal_id;
  select * into v_evento from public.eventos where id = v_evento_id;
  select * into v_comercial from public.eventos_comercial where evento_id = v_evento_id;
  v_existing_count := (v_animal.id is not null)::integer +
    (v_evento.id is not null)::integer + (v_comercial.evento_id is not null)::integer;

  if v_existing_count > 0 then
    if v_existing_count <> 3 then
      return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_PARTIAL_EXISTING');
    end if;
    if v_animal.fazenda_id <> p_fazenda_id or v_evento.fazenda_id <> p_fazenda_id or
       v_comercial.fazenda_id <> p_fazenda_id then
      return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_CROSS_FARM');
    end if;
    if public.commercial_purchase_record_fingerprint('animal', to_jsonb(v_animal)) <>
       public.commercial_purchase_record_fingerprint('animal', p_animal) then
      return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_ANIMAL_DIVERGENT');
    end if;
    if public.commercial_purchase_record_fingerprint('event', to_jsonb(v_evento)) <>
       public.commercial_purchase_record_fingerprint('event', p_evento) then
      return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_EVENT_DIVERGENT');
    end if;
    if public.commercial_purchase_record_fingerprint('detail', to_jsonb(v_comercial)) <>
       public.commercial_purchase_record_fingerprint('detail', p_comercial) then
      return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_DETAIL_DIVERGENT');
    end if;
    return pg_catalog.jsonb_build_object('status', 'APPLIED', 'replay', true,
      'animal_id', v_animal_id, 'evento_id', v_evento_id);
  end if;

  if exists (select 1 from public.contrapartes where id = (p_comercial->>'contraparte_id')::uuid
             and fazenda_id <> p_fazenda_id) then
    return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_COUNTERPARTY_CROSS_FARM');
  end if;

  insert into public.animais (
    id, fazenda_id, identificacao, sexo, status, lote_id, data_nascimento, data_entrada,
    data_saida, pai_id, mae_id, nome, rfid, especie, origem, raca, papel_macho,
    habilitado_monta, observacoes, payload, client_id, client_op_id, client_tx_id,
    client_recorded_at
  ) values (
    v_animal_id, p_fazenda_id, p_animal->>'identificacao', (p_animal->>'sexo')::public.sexo_enum,
    'ativo'::public.animal_status_enum, (p_animal->>'lote_id')::uuid,
    (p_animal->>'data_nascimento')::date, (p_animal->>'data_entrada')::date,
    (p_animal->>'data_saida')::date, (p_animal->>'pai_id')::uuid, (p_animal->>'mae_id')::uuid,
    p_animal->>'nome', p_animal->>'rfid', p_animal->>'especie', 'compra'::public.origem_enum,
    p_animal->>'raca', (p_animal->>'papel_macho')::public.papel_macho_enum,
    coalesce((p_animal->>'habilitado_monta')::boolean, false), p_animal->>'observacoes',
    coalesce(p_animal->'payload', '{}'::jsonb), p_animal->>'client_id',
    (p_animal->>'client_op_id')::uuid, p_client_tx_id,
    (p_animal->>'client_recorded_at')::timestamptz
  );

  insert into public.eventos (
    id, fazenda_id, dominio, occurred_at, animal_id, lote_id, source_task_id,
    source_tx_id, source_client_op_id, corrige_evento_id, observacoes, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at
  ) values (
    v_evento_id, p_fazenda_id, 'comercial'::public.dominio_enum,
    (p_evento->>'occurred_at')::timestamptz, v_animal_id, (p_evento->>'lote_id')::uuid,
    (p_evento->>'source_task_id')::uuid, (p_evento->>'source_tx_id')::uuid,
    (p_evento->>'source_client_op_id')::uuid, (p_evento->>'corrige_evento_id')::uuid,
    p_evento->>'observacoes', coalesce(p_evento->'payload', '{}'::jsonb),
    p_evento->>'client_id', (p_evento->>'client_op_id')::uuid, p_client_tx_id,
    (p_evento->>'client_recorded_at')::timestamptz
  );

  insert into public.eventos_comercial (
    evento_id, fazenda_id, operation_type, scope, occurred_at, quantidade_animais,
    peso_vivo_total, peso_medio_derivado, valor_bruto, frete, comissao, descontos,
    taxas_impostos, valor_liquido_derivado, contraparte_id, contraparte_nome,
    animal_ids, lote_id, finance_transaction_id, snapshot, calculation_status,
    issues, limitations, observacoes, client_id, client_op_id, client_tx_id,
    client_recorded_at
  ) values (
    v_evento_id, p_fazenda_id, 'compra', 'animal', (p_comercial->>'occurred_at')::timestamptz, 1,
    (p_comercial->>'peso_vivo_total')::numeric, (p_comercial->>'peso_medio_derivado')::numeric,
    (p_comercial->>'valor_bruto')::numeric, (p_comercial->>'frete')::numeric,
    (p_comercial->>'comissao')::numeric, (p_comercial->>'descontos')::numeric,
    (p_comercial->>'taxas_impostos')::numeric, (p_comercial->>'valor_liquido_derivado')::numeric,
    (p_comercial->>'contraparte_id')::uuid, p_comercial->>'contraparte_nome', v_animal_ids,
    (p_comercial->>'lote_id')::uuid, null, coalesce(p_comercial->'snapshot', '{}'::jsonb),
    coalesce(p_comercial->>'calculation_status', 'partial'),
    coalesce(p_comercial->'issues', '[]'::jsonb), coalesce(p_comercial->'limitations', '[]'::jsonb),
    p_comercial->>'observacoes', p_comercial->>'client_id',
    (p_comercial->>'client_op_id')::uuid, p_client_tx_id,
    (p_comercial->>'client_recorded_at')::timestamptz
  );

  return pg_catalog.jsonb_build_object('status', 'APPLIED', 'replay', false,
    'animal_id', v_animal_id, 'evento_id', v_evento_id);
exception
  when unique_violation then
    -- A chamada concorrente pode ter iniciado antes de a vencedora confirmar.
    -- Depois do rollback do sub-bloco, releia o trio confirmado e compare o
    -- conteúdo; 23505 isolado nunca prova replay idêntico.
    select * into v_animal from public.animais where id = v_animal_id;
    select * into v_evento from public.eventos where id = v_evento_id;
    select * into v_comercial from public.eventos_comercial where evento_id = v_evento_id;
    v_existing_count := (v_animal.id is not null)::integer +
      (v_evento.id is not null)::integer + (v_comercial.evento_id is not null)::integer;

    if v_existing_count = 3 then
      if v_animal.fazenda_id <> p_fazenda_id or v_evento.fazenda_id <> p_fazenda_id or
         v_comercial.fazenda_id <> p_fazenda_id then
        return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_CROSS_FARM');
      end if;
      if public.commercial_purchase_record_fingerprint('animal', to_jsonb(v_animal)) <>
         public.commercial_purchase_record_fingerprint('animal', p_animal) then
        return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_ANIMAL_DIVERGENT');
      end if;
      if public.commercial_purchase_record_fingerprint('event', to_jsonb(v_evento)) <>
         public.commercial_purchase_record_fingerprint('event', p_evento) then
        return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_EVENT_DIVERGENT');
      end if;
      if public.commercial_purchase_record_fingerprint('detail', to_jsonb(v_comercial)) <>
         public.commercial_purchase_record_fingerprint('detail', p_comercial) then
        return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_DETAIL_DIVERGENT');
      end if;
      return pg_catalog.jsonb_build_object('status', 'APPLIED', 'replay', true,
        'animal_id', v_animal_id, 'evento_id', v_evento_id);
    end if;
    if v_existing_count > 0 then
      return pg_catalog.jsonb_build_object('status', 'CONFLICT', 'reason_code', 'COMMERCIAL_PURCHASE_PARTIAL_EXISTING');
    end if;
    return pg_catalog.jsonb_build_object('status', 'CONFLICT',
      'reason_code', 'COMMERCIAL_PURCHASE_CONSTRAINT_CONFLICT',
      'reason_message', sqlerrm);
  when foreign_key_violation or check_violation then
    return pg_catalog.jsonb_build_object('status', 'CONFLICT',
      'reason_code', 'COMMERCIAL_PURCHASE_CONSTRAINT_CONFLICT',
      'reason_message', sqlerrm);
  when not_null_violation or data_exception then
    return pg_catalog.jsonb_build_object('status', 'REJECTED',
      'reason_code', 'COMMERCIAL_PURCHASE_PAYLOAD_INVALID',
      'reason_message', sqlerrm);
end;
$$;

revoke all on function public.apply_individual_animal_purchase(uuid, uuid, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.apply_individual_animal_purchase(uuid, uuid, uuid, jsonb, jsonb, jsonb) to authenticated;

comment on function public.apply_individual_animal_purchase(uuid, uuid, uuid, jsonb, jsonb, jsonb) is
  'Aplica atomicamente a compra individual: animal ativo, Evento comercial factual e eventos_comercial; replay compara conteúdo.';
