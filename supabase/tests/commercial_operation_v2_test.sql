\set ON_ERROR_STOP on

begin;

select uf.user_id as test_user_id, uf.fazenda_id as test_farm_id
from public.user_fazendas uf
where uf.deleted_at is null
order by uf.created_at
limit 1
\gset

set local role authenticated;
select set_config('request.jwt.claim.sub', :'test_user_id', true);
select set_config('commercial_test.farm_id', :'test_farm_id', true);

do $$
declare
  v_farm uuid := current_setting('commercial_test.farm_id')::uuid;
  v_lot uuid := '91000000-0000-4000-8000-000000000001';
  v_animal uuid := '92000000-0000-4000-8000-000000000001';
  v_operation uuid := '93000000-0000-4000-8000-000000000001';
  v_tx uuid := '94000000-0000-4000-8000-000000000001';
  v_sale uuid := '95000000-0000-4000-8000-000000000001';
  v_sale_tx uuid := '96000000-0000-4000-8000-000000000001';
  v_duplicate_operation uuid := '97000000-0000-4000-8000-000000000001';
  v_duplicate_tx uuid := '98000000-0000-4000-8000-000000000001';
  v_duplicate_animal uuid := '99000000-0000-4000-8000-000000000001';
  v_occurred timestamptz := '2026-08-13T12:00:00.000Z';
  v_animal_json jsonb;
  v_event jsonb;
  v_detail jsonb;
  v_command jsonb;
  v_result jsonb;
  v_finance_before bigint;
begin
  insert into public.lotes (id, fazenda_id, nome)
  values (v_lot, v_farm, 'RPC commercial_operation_v2 test');

  select count(*) into v_finance_before
  from public.finance_transactions
  where fazenda_id = v_farm;

  v_animal_json := jsonb_build_object(
    'id', v_animal,
    'fazenda_id', v_farm,
    'identificacao', 'RPC-V2-001',
    'sexo', 'F',
    'status', 'ativo',
    'lote_id', v_lot,
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
    'client_id', 'rpc-test',
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
    'lote_id', v_lot,
    'payload', jsonb_build_object('kind', 'commercial_operation_v2'),
    'client_id', 'rpc-test',
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
    'contraparte_nome', 'Fornecedor teste',
    'animal_ids', jsonb_build_array(v_animal),
    'lote_id', v_lot,
    'finance_transaction_id', null,
    'snapshot', jsonb_build_object('contract_version', 2),
    'calculation_status', 'partial',
    'issues', '[]'::jsonb,
    'limitations', '[]'::jsonb,
    'observacoes', null,
    'client_id', 'rpc-test',
    'client_op_id', v_operation,
    'client_tx_id', v_tx,
    'client_recorded_at', v_occurred
  );
  v_command := jsonb_build_object(
    'domain', 'commercial_operation_v2',
    'command', 'apply_commercial_operation',
    'contract_version', 2,
    'client_op_id', v_operation,
    'client_tx_id', v_tx,
    'operation_id', v_operation,
    'operation_type', 'compra',
    'scope', 'animal',
    'fazenda_id', v_farm,
    'occurred_at', v_occurred,
    'animal_ids', jsonb_build_array(v_animal),
    'animals', jsonb_build_array(v_animal_json),
    'event', v_event,
    'detail', v_detail
  );

  v_result := public.apply_commercial_operation_v2(v_farm, v_operation, v_tx, v_command);
  if v_result->>'status' <> 'APPLIED' or coalesce((v_result->>'replay')::boolean, true) then
    raise exception 'purchase was not applied: %', v_result;
  end if;
  if (select count(*) from public.animais where id = v_animal and status::text = 'ativo') <> 1 or
     (select count(*) from public.eventos where id = v_operation) <> 1 or
     (select count(*) from public.eventos_comercial where evento_id = v_operation and animal_ids = array[v_animal]) <> 1 then
    raise exception 'purchase did not persist the complete unit';
  end if;

  v_result := public.apply_commercial_operation_v2(v_farm, v_operation, v_tx, v_command);
  if v_result->>'status' <> 'APPLIED' or not (v_result->>'replay')::boolean then
    raise exception 'identical purchase replay failed: %', v_result;
  end if;

  v_result := public.apply_commercial_operation_v2(
    v_farm,
    v_operation,
    v_tx,
    jsonb_set(v_command, '{detail,valor_bruto}', '2600'::jsonb)
  );
  if v_result->>'status' <> 'CONFLICT' then
    raise exception 'divergent purchase did not conflict: %', v_result;
  end if;

  v_result := public.apply_commercial_operation_v2(
    v_farm,
    v_duplicate_operation,
    v_duplicate_tx,
    replace(
      replace(
        replace(
          replace(v_command::text, v_operation::text, v_duplicate_operation::text),
          v_tx::text,
          v_duplicate_tx::text
        ),
        v_animal::text,
        v_duplicate_animal::text
      ),
      'RPC-V2-001',
      'rpc-v2-001'
    )::jsonb
  );
  if v_result->>'status' <> 'CONFLICT' or v_result->>'reason_code' <> 'COMMERCIAL_OPERATION_IDENTIFICATION_DUPLICATE' then
    raise exception 'case-insensitive duplicate identification did not conflict: %', v_result;
  end if;

  v_animal_json := jsonb_set(
    jsonb_set(v_animal_json, '{status}', '"vendido"'::jsonb),
    '{lote_id}',
    'null'::jsonb
  );
  v_animal_json := jsonb_set(v_animal_json, '{data_saida}', '"2026-08-13"'::jsonb);
  v_event := jsonb_set(v_event, '{id}', to_jsonb(v_sale));
  v_event := jsonb_set(v_event, '{client_op_id}', to_jsonb(v_sale));
  v_event := jsonb_set(v_event, '{client_tx_id}', to_jsonb(v_sale_tx));
  v_detail := jsonb_set(v_detail, '{evento_id}', to_jsonb(v_sale));
  v_detail := jsonb_set(v_detail, '{operation_type}', '"venda"'::jsonb);
  v_detail := jsonb_set(v_detail, '{client_op_id}', to_jsonb(v_sale));
  v_detail := jsonb_set(v_detail, '{client_tx_id}', to_jsonb(v_sale_tx));
  v_animal_json := jsonb_set(v_animal_json, '{client_tx_id}', to_jsonb(v_sale_tx));
  v_command := jsonb_build_object(
    'domain', 'commercial_operation_v2',
    'command', 'apply_commercial_operation',
    'contract_version', 2,
    'client_op_id', v_sale,
    'client_tx_id', v_sale_tx,
    'operation_id', v_sale,
    'operation_type', 'venda',
    'scope', 'animal',
    'fazenda_id', v_farm,
    'occurred_at', v_occurred,
    'animal_ids', jsonb_build_array(v_animal),
    'animals', jsonb_build_array(v_animal_json),
    'event', v_event,
    'detail', v_detail
  );
  v_result := public.apply_commercial_operation_v2(v_farm, v_sale, v_sale_tx, v_command);
  if v_result->>'status' <> 'APPLIED' or
     (select status::text from public.animais where id = v_animal) <> 'vendido' or
     (select count(*) from public.animais where id = v_animal) <> 1 then
    raise exception 'sale did not preserve and mark the animal sold: %', v_result;
  end if;

  v_result := public.apply_commercial_operation_v2(v_farm, v_sale, v_sale_tx, v_command);
  if v_result->>'status' <> 'APPLIED' or not (v_result->>'replay')::boolean then
    raise exception 'identical sale replay failed: %', v_result;
  end if;

  if (select count(*) from public.finance_transactions where fazenda_id = v_farm) <> v_finance_before then
    raise exception 'commercial RPC created an automatic financial transaction';
  end if;
end
$$;

rollback;
