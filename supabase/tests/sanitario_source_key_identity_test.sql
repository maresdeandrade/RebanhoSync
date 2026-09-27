\set ON_ERROR_STOP on

begin;

do $$
declare
  v_farm_one uuid := 'c02a2001-0000-4000-8000-000000000001';
  v_farm_two uuid := 'c02a2001-0000-4000-8000-000000000002';
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sanitario_fontes_tecnicas_v2'
      and column_name = 'source_key'
      and is_nullable = 'YES'
      and column_default is null
  ) then
    raise exception 'source_key must be nullable and have no default';
  end if;

  insert into public.fazendas(id, nome)
  values
    (v_farm_one, 'C0.2A.2 source identity farm one'),
    (v_farm_two, 'C0.2A.2 source identity farm two');

  -- Legacy rows remain valid without source_key.
  insert into public.sanitario_fontes_tecnicas_v2(
    id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
  ) values (
    'c02a2101-0000-4000-8000-000000000001', null, 'bula', 'global', null,
    'Legacy source without key', 'forte', 'SIM_BULA'
  );

  -- Canonical source_key is accepted.
  insert into public.sanitario_fontes_tecnicas_v2(
    id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
  ) values (
    'c02a2101-0000-4000-8000-000000000002', 'SRC_PNCEBT_BRUCELOSE', 'norma_oficial',
    'global', null, 'Canonical source with key', 'forte', 'SIM_NORMA'
  );

  begin
    insert into public.sanitario_fontes_tecnicas_v2(
      id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
    ) values (
      'c02a2101-0000-4000-8000-000000000003', 'src_bula_x', 'bula', 'global', null,
      'Invalid source key', 'forte', 'SIM_BULA'
    );
    raise exception 'invalid source_key should have failed';
  exception when check_violation then
    null;
  end;

  insert into public.sanitario_fontes_tecnicas_v2(
    id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
  ) values (
    'c02a2101-0000-4000-8000-000000000004', 'SRC_GLOBAL_ACTIVE_DUP', 'bula',
    'global', null, 'Active global identity', 'forte', 'SIM_BULA'
  );
  begin
    insert into public.sanitario_fontes_tecnicas_v2(
      id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
    ) values (
      'c02a2101-0000-4000-8000-000000000005', 'SRC_GLOBAL_ACTIVE_DUP', 'bula',
      'global', null, 'Duplicate active global identity', 'forte', 'SIM_BULA'
    );
    raise exception 'active global duplicate should have failed';
  exception when unique_violation then
    null;
  end;

  insert into public.sanitario_fontes_tecnicas_v2(
    id, source_key, kind, scope, fazenda_id, title, strength, evidence_status, deleted_at
  ) values (
    'c02a2101-0000-4000-8000-000000000006', 'SRC_GLOBAL_TOMBSTONE_DUP', 'bula',
    'global', null, 'Tombstoned global identity', 'forte', 'SIM_BULA', now()
  );
  begin
    insert into public.sanitario_fontes_tecnicas_v2(
      id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
    ) values (
      'c02a2101-0000-4000-8000-000000000007', 'SRC_GLOBAL_TOMBSTONE_DUP', 'bula',
      'global', null, 'Reused tombstoned global identity', 'forte', 'SIM_BULA'
    );
    raise exception 'tombstoned global duplicate should have failed';
  exception when unique_violation then
    null;
  end;

  -- The same tenant key is allowed in different farms.
  insert into public.sanitario_fontes_tecnicas_v2(
    id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
  ) values
    ('c02a2101-0000-4000-8000-000000000008', 'SRC_TENANT_SHARED', 'mv_responsavel',
      'fazenda', v_farm_one, 'Farm source one', 'apoio', 'PRECISA_VALIDAR'),
    ('c02a2101-0000-4000-8000-000000000009', 'SRC_TENANT_SHARED', 'mv_responsavel',
      'fazenda', v_farm_two, 'Farm source two', 'apoio', 'PRECISA_VALIDAR');

  begin
    insert into public.sanitario_fontes_tecnicas_v2(
      id, source_key, kind, scope, fazenda_id, title, strength, evidence_status
    ) values (
      'c02a2101-0000-4000-8000-000000000010', 'SRC_TENANT_SHARED', 'mv_responsavel',
      'fazenda', v_farm_one, 'Duplicate source in farm one', 'apoio', 'PRECISA_VALIDAR'
    );
    raise exception 'same-farm duplicate should have failed';
  exception when unique_violation then
    null;
  end;

  -- Product class natural keys remain reserved after tombstone.
  insert into public.sanitario_product_classes_v2(
    id, scope, fazenda_id, class_key, name, product_type, species_scope,
    curation_status, automation_status, deleted_at
  ) values (
    'c02a2201-0000-4000-8000-000000000001', 'global', null,
    'classe_tombstone_test', 'Class tombstone test', 'vacina', array['bovino'],
    'archived', 'blocked', now()
  );
  begin
    insert into public.sanitario_product_classes_v2(
      id, scope, fazenda_id, class_key, name, product_type, species_scope,
      curation_status, automation_status
    ) values (
      'c02a2201-0000-4000-8000-000000000002', 'global', null,
      'classe_tombstone_test', 'Reused class tombstone', 'vacina', array['bovino'],
      'candidate', 'manual_only'
    );
    raise exception 'tombstoned class_key duplicate should have failed';
  exception when unique_violation then
    null;
  end;
end
$$;

select 'SANITARIO_SOURCE_KEY_IDENTITY_TEST_OK' as result;

rollback;
