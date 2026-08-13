\set ON_ERROR_STOP on

begin;

do $$
declare
  v_signature regprocedure := to_regprocedure(
    'public.apply_individual_animal_purchase(uuid,uuid,uuid,jsonb,jsonb,jsonb)'
  );
  v_overloads integer;
begin
  select count(*) into v_overloads
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'apply_individual_animal_purchase';

  if v_signature is null or v_overloads <> 1 then
    raise exception 'unexpected apply_individual_animal_purchase signature set';
  end if;
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_individual_animal_purchase'
      and (
        has_function_privilege('public', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'legacy purchase overload executable by PUBLIC or anon';
  end if;
  if not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
    raise exception 'authenticated cannot execute legacy purchase RPC';
  end if;
end
$$;

select uf.user_id as test_user_id, uf.fazenda_id as test_farm_id
from public.user_fazendas uf
where uf.deleted_at is null
order by uf.created_at
limit 1
\gset

set local role authenticated;
select set_config('commercial_v1_grants_test.farm_id', :'test_farm_id', true);
select set_config('commercial_v1_grants_test.user_id', :'test_user_id', true);

do $$
declare
  v_farm uuid := current_setting('commercial_v1_grants_test.farm_id')::uuid;
  v_user uuid := current_setting('commercial_v1_grants_test.user_id')::uuid;
  v_operation uuid := 'a5100000-0000-4000-8000-000000000001';
  v_tx uuid := 'a5200000-0000-4000-8000-000000000001';
  v_animal uuid := 'a5300000-0000-4000-8000-000000000001';
  v_occurred timestamptz := '2026-08-13T15:30:00.000Z';
  v_animal_json jsonb;
  v_event jsonb;
  v_detail jsonb;
  v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  v_result := public.apply_individual_animal_purchase(
    v_farm, v_operation, v_tx, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
  );
  if v_result->>'status' <> 'REJECTED'
     or v_result->>'reason_code' <> 'COMMERCIAL_PURCHASE_FORBIDDEN' then
    raise exception 'identity-free legacy call was not rejected: %', v_result;
  end if;
  if exists (select 1 from public.animais where id = v_animal)
     or exists (select 1 from public.eventos where id = v_operation)
     or exists (select 1 from public.eventos_comercial where evento_id = v_operation) then
    raise exception 'identity-free legacy call persisted partial data';
  end if;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  v_animal_json := jsonb_build_object(
    'id', v_animal,
    'fazenda_id', v_farm,
    'identificacao', 'RPC-V1-GRANT-001',
    'sexo', 'F',
    'status', 'ativo',
    'lote_id', null,
    'data_nascimento', '2025-01-01',
    'data_entrada', '2026-08-13',
    'data_saida', null,
    'pai_id', null,
    'mae_id', null,
    'nome', null,
    'rfid', null,
    'especie', 'bovino',
    'origem', 'compra',
    'raca', null,
    'papel_macho', null,
    'habilitado_monta', false,
    'observacoes', null,
    'payload', '{}'::jsonb,
    'client_id', 'rpc-v1-grants-test',
    'client_op_id', v_operation,
    'client_tx_id', v_tx,
    'client_recorded_at', v_occurred
  );
  v_event := jsonb_build_object(
    'id', v_operation,
    'fazenda_id', v_farm,
    'dominio', 'comercial',
    'occurred_at', v_occurred,
    'animal_id', v_animal,
    'lote_id', null,
    'source_task_id', null,
    'source_tx_id', null,
    'source_client_op_id', null,
    'corrige_evento_id', null,
    'observacoes', null,
    'payload', jsonb_build_object('kind', 'commercial_purchase_v1'),
    'client_id', 'rpc-v1-grants-test',
    'client_op_id', v_operation,
    'client_tx_id', v_tx,
    'client_recorded_at', v_occurred
  );
  v_detail := jsonb_build_object(
    'evento_id', v_operation,
    'fazenda_id', v_farm,
    'operation_type', 'compra',
    'scope', 'animal',
    'occurred_at', v_occurred,
    'quantidade_animais', 1,
    'peso_vivo_total', 300,
    'peso_medio_derivado', 300,
    'valor_bruto', 2500,
    'frete', 0,
    'comissao', 0,
    'descontos', 0,
    'taxas_impostos', 0,
    'valor_liquido_derivado', 2500,
    'contraparte_id', null,
    'contraparte_nome', 'Fornecedor grants test',
    'animal_ids', jsonb_build_array(v_animal),
    'lote_id', null,
    'finance_transaction_id', null,
    'snapshot', '{}'::jsonb,
    'calculation_status', 'partial',
    'issues', '[]'::jsonb,
    'limitations', '[]'::jsonb,
    'observacoes', null,
    'client_id', 'rpc-v1-grants-test',
    'client_op_id', v_operation,
    'client_tx_id', v_tx,
    'client_recorded_at', v_occurred
  );

  v_result := public.apply_individual_animal_purchase(
    v_farm, v_operation, v_tx, v_animal_json, v_event, v_detail
  );
  if v_result->>'status' <> 'APPLIED' or coalesce((v_result->>'replay')::boolean, true) then
    raise exception 'authenticated legacy purchase failed: %', v_result;
  end if;
  if (select count(*) from public.animais where id = v_animal and status::text = 'ativo') <> 1
     or (select count(*) from public.eventos where id = v_operation) <> 1
     or (select count(*) from public.eventos_comercial where evento_id = v_operation) <> 1 then
    raise exception 'authenticated legacy purchase did not persist one complete unit';
  end if;

  v_result := public.apply_individual_animal_purchase(
    v_farm, v_operation, v_tx, v_animal_json, v_event, v_detail
  );
  if v_result->>'status' <> 'APPLIED' or not (v_result->>'replay')::boolean then
    raise exception 'authenticated legacy replay failed: %', v_result;
  end if;

  v_result := public.apply_individual_animal_purchase(
    v_farm,
    v_operation,
    v_tx,
    v_animal_json,
    v_event,
    jsonb_set(v_detail, '{valor_bruto}', '2600'::jsonb)
  );
  if v_result->>'status' <> 'CONFLICT'
     or v_result->>'reason_code' <> 'COMMERCIAL_PURCHASE_DETAIL_DIVERGENT' then
    raise exception 'authenticated divergent legacy replay did not conflict: %', v_result;
  end if;
end
$$;

rollback;
