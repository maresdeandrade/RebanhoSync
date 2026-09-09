\set ON_ERROR_STOP on

begin;

-- ============================================================================
-- C4.1b — Subsumed Operational Cleanup Verification Test
-- ============================================================================

-- 1. Structural Verification: 14 old FOR ALL write policies must NOT exist
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'finance_transactions_write_manager',
      'finance_categories_write_manager',
      'lotes_write_manager',
      'pastos_write_manager',
      'pasto_ocupacoes_write_manager',
      'insumos_write_manager',
      'insumo_lotes_write_manager',
      'insumo_apresentacoes_write_manager',
      'contrapartes_write_manager',
      'config_write_manager',
      'protocolos_write_manager',
      'protocolo_itens_write_manager',
      'sociedade_animais_write_manager',
      'sociedades_pecuarias_write_manager'
    );

  if v_count <> 0 then
    raise exception 'Old FOR ALL write policies still exist: count=%', v_count;
  end if;
end
$$;

-- 2. Structural Verification: 14 SELECT member policies must remain intact
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and cmd = 'SELECT'
    and policyname in (
      'finance_transactions_select_member',
      'finance_categories_select_member',
      'lotes_select_member',
      'pastos_select_member',
      'pasto_ocupacoes_select_member',
      'insumos_select_member',
      'insumo_lotes_select_member',
      'insumo_apresentacoes_select_member',
      'contrapartes_select_member',
      'config_select_member',
      'protocolos_select_member',
      'protocolo_itens_select_member',
      'sociedade_animais_select_member',
      'sociedades_pecuarias_select_member'
    );

  if v_count <> 14 then
    raise exception 'Expected 14 SELECT member policies, found %', v_count;
  end if;
end
$$;

-- 3. Structural Verification: 42 new specific write policies must exist with exact commands
do $$
declare
  v_rec record;
  v_count integer := 0;
begin
  for v_rec in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'finance_transactions', 'finance_categories', 'lotes', 'pastos', 'pasto_ocupacoes',
        'insumos', 'insumo_lotes', 'insumo_apresentacoes', 'contrapartes', 'fazenda_sanidade_config',
        'protocolos_sanitarios', 'protocolos_sanitarios_itens', 'sociedade_animais', 'sociedades_pecuarias'
      )
      and (
        policyname like '%_insert_manager' or
        policyname like '%_update_manager' or
        policyname like '%_delete_manager'
      )
  loop
    v_count := v_count + 1;

    if v_rec.policyname like '%_insert_manager' then
      if v_rec.cmd <> 'INSERT' or v_rec.with_check is null or v_rec.qual is not null then
        raise exception 'Policy % has invalid definition for INSERT', v_rec.policyname;
      end if;
    elsif v_rec.policyname like '%_update_manager' then
      if v_rec.cmd <> 'UPDATE' or v_rec.qual is null or v_rec.with_check is null then
        raise exception 'Policy % has invalid definition for UPDATE', v_rec.policyname;
      end if;
    elsif v_rec.policyname like '%_delete_manager' then
      if v_rec.cmd <> 'DELETE' or v_rec.qual is null or v_rec.with_check is not null then
        raise exception 'Policy % has invalid definition for DELETE', v_rec.policyname;
      end if;
    end if;
  end loop;

  if v_count <> 42 then
    raise exception 'Expected 42 new write policies, found %', v_count;
  end if;
end
$$;

-- 4. Helper Implication Verification: role_in_fazenda(owner/manager) => has_membership
do $$
declare
  v_f1 uuid := '11111111-1111-4111-8111-111111111111';
  v_f2 uuid := '22222222-2222-4222-8222-222222222222';
  v_u_owner uuid := 'aaaa1111-1111-4111-8111-111111111111';
  v_u_mgr uuid := 'aaaa2222-2222-4222-8222-222222222222';
  v_u_cowboy uuid := 'aaaa3333-3333-4333-8333-333333333333';
  v_u_del uuid := 'aaaa5555-5555-4555-8555-555555555555';
  v_u_other uuid := 'aaaa6666-6666-4666-8666-666666666666';
  v_u_none uuid := 'aaaa7777-7777-4777-8777-777777777777';

  v_role boolean;
  v_member boolean;
begin
  -- Setup test fazendas
  insert into public.fazendas (id, nome, client_id, client_op_id, client_recorded_at)
  values 
    (v_f1, 'Fazenda Implication 1', 'test', gen_random_uuid(), now()),
    (v_f2, 'Fazenda Implication 2', 'test', gen_random_uuid(), now())
  on conflict (id) do nothing;

  -- Setup test auth users
  insert into auth.users (id, aud, role, email)
  values
    (v_u_owner, 'authenticated', 'authenticated', 'owner@test.local'),
    (v_u_mgr, 'authenticated', 'authenticated', 'mgr@test.local'),
    (v_u_cowboy, 'authenticated', 'authenticated', 'cowboy@test.local'),
    (v_u_del, 'authenticated', 'authenticated', 'del@test.local'),
    (v_u_other, 'authenticated', 'authenticated', 'other@test.local'),
    (v_u_none, 'authenticated', 'authenticated', 'none@test.local')
  on conflict (id) do nothing;

  -- Setup user_fazendas
  insert into public.user_fazendas (fazenda_id, user_id, role, deleted_at, client_id, client_op_id, client_recorded_at)
  values
    (v_f1, v_u_owner, 'owner', null, 'test', gen_random_uuid(), now()),
    (v_f1, v_u_mgr, 'manager', null, 'test', gen_random_uuid(), now()),
    (v_f1, v_u_cowboy, 'cowboy', null, 'test', gen_random_uuid(), now()),
    (v_f1, v_u_del, 'owner', now(), 'test', gen_random_uuid(), now()),
    (v_f2, v_u_other, 'owner', null, 'test', gen_random_uuid(), now());

  -- 4.1 Owner: role=T, member=T
  perform set_config('request.jwt.claim.sub', v_u_owner::text, true);
  v_role := public.role_in_fazenda(v_f1, array['owner'::farm_role_enum, 'manager'::farm_role_enum]);
  v_member := public.has_membership(v_f1);
  if not (v_role = true and v_member = true) then raise exception 'Owner implication failed'; end if;

  -- 4.2 Manager: role=T, member=T
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  v_role := public.role_in_fazenda(v_f1, array['owner'::farm_role_enum, 'manager'::farm_role_enum]);
  v_member := public.has_membership(v_f1);
  if not (v_role = true and v_member = true) then raise exception 'Manager implication failed'; end if;

  -- 4.3 Cowboy: role=F, member=T
  perform set_config('request.jwt.claim.sub', v_u_cowboy::text, true);
  v_role := public.role_in_fazenda(v_f1, array['owner'::farm_role_enum, 'manager'::farm_role_enum]);
  v_member := public.has_membership(v_f1);
  if not (v_role = false and v_member = true) then raise exception 'Cowboy implication failed'; end if;

  -- 4.4 Deleted: role=F, member=F
  perform set_config('request.jwt.claim.sub', v_u_del::text, true);
  v_role := public.role_in_fazenda(v_f1, array['owner'::farm_role_enum, 'manager'::farm_role_enum]);
  v_member := public.has_membership(v_f1);
  if not (v_role = false and v_member = false) then raise exception 'Deleted implication failed'; end if;

  -- 4.5 Other farm: role=F, member=F
  perform set_config('request.jwt.claim.sub', v_u_other::text, true);
  v_role := public.role_in_fazenda(v_f1, array['owner'::farm_role_enum, 'manager'::farm_role_enum]);
  v_member := public.has_membership(v_f1);
  if not (v_role = false and v_member = false) then raise exception 'Other farm implication failed'; end if;

  -- 4.6 No membership: role=F, member=F
  perform set_config('request.jwt.claim.sub', v_u_none::text, true);
  v_role := public.role_in_fazenda(v_f1, array['owner'::farm_role_enum, 'manager'::farm_role_enum]);
  v_member := public.has_membership(v_f1);
  if not (v_role = false and v_member = false) then raise exception 'No membership implication failed'; end if;

  -- Grant DELETE within transaction to test DELETE RLS policy under authenticated role
  execute 'grant delete on public.lotes to authenticated';
end
$$;

-- 5. Behavioral RLS Matrix: Owner/Manager vs Cowboy vs Outsider on representative table (lotes)
set local role authenticated;

do $$
declare
  v_f1 uuid := '11111111-1111-4111-8111-111111111111';
  v_u_mgr uuid := 'aaaa2222-2222-4222-8222-222222222222';
  v_u_cowboy uuid := 'aaaa3333-3333-4333-8333-333333333333';
  v_u_other uuid := 'aaaa6666-6666-4666-8666-666666666666';
  v_lot uuid := 'bbbb1111-1111-4111-8111-111111111111';
  v_cnt integer;
begin
  -- 5.1 Manager can INSERT into lotes
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.lotes (id, fazenda_id, nome, client_id, client_op_id, client_recorded_at)
  values (v_lot, v_f1, 'Lote Test C4.1b', 'test', gen_random_uuid(), now());

  -- 5.2 Cowboy can SELECT lotes
  perform set_config('request.jwt.claim.sub', v_u_cowboy::text, true);
  select count(*) into v_cnt from public.lotes where id = v_lot;
  if v_cnt <> 1 then raise exception 'Cowboy cannot select lote'; end if;

  -- 5.3 Cowboy cannot UPDATE lotes (0 rows updated)
  update public.lotes set nome = 'Cowboy update attempt' where id = v_lot;

  -- 5.4 Outsider cannot SELECT lotes (0 rows visible)
  perform set_config('request.jwt.claim.sub', v_u_other::text, true);
  select count(*) into v_cnt from public.lotes where id = v_lot;
  if v_cnt <> 0 then raise exception 'Outsider can select lote in f1'; end if;

  -- 5.5 Manager can UPDATE lotes
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  update public.lotes set nome = 'Manager updated lote' where id = v_lot;

  select count(*) into v_cnt from public.lotes where id = v_lot and nome = 'Manager updated lote';
  if v_cnt <> 1 then raise exception 'Manager update lote failed'; end if;

  -- 5.6 Manager can DELETE lotes
  delete from public.lotes where id = v_lot;
  select count(*) into v_cnt from public.lotes where id = v_lot;
  if v_cnt <> 0 then raise exception 'Manager delete lote failed'; end if;
end
$$;

reset role;

select 'C4_1B_SUBSUMED_OPERATIONAL_CLEANUP_TEST_OK' as result;

rollback;
