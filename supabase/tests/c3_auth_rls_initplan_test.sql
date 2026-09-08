\set ON_ERROR_STOP on

begin;

-- ============================================================================
-- C3.1 — RLS InitPlan Hardening Verification Test
-- ============================================================================

-- 1. Structural Verification: Ensure all 8 policies exist and use subselect for auth.uid()
do $$
declare
  v_policy record;
  v_count integer := 0;
begin
  for v_policy in
    select
      tablename,
      policyname,
      qual,
      with_check
    from pg_policies
    where (tablename = 'fazendas' and policyname = 'fazendas_insert_auth')
       or (tablename = 'user_profiles' and policyname in ('user_profiles_select_related', 'user_profiles_insert_self', 'user_profiles_update_self'))
       or (tablename = 'user_settings' and policyname = 'user_settings_self')
       or (tablename = 'user_fazendas' and policyname = 'user_fazendas_select_member')
       or (tablename = 'app_superadmins' and policyname = 'app_superadmins_select_self')
       or (tablename = 'eventos_ecc' and policyname = 'user_fazenda_access')
  loop
    v_count := v_count + 1;
    -- Verify that qual or with_check contains subquery form of auth.uid()
    if (v_policy.qual is not null and v_policy.qual ~* 'auth\.uid\(\)' and v_policy.qual !~* 'SELECT auth\.uid\(\)')
       or (v_policy.with_check is not null and v_policy.with_check ~* 'auth\.uid\(\)' and v_policy.with_check !~* 'SELECT auth\.uid\(\)') then
      raise exception 'Policy %.% still uses bare auth.uid() without subselect', v_policy.tablename, v_policy.policyname;
    end if;
  end loop;

  if v_count <> 8 then
    raise exception 'Expected 8 hardened policies, found %', v_count;
  end if;
end
$$;

-- 2. Behavioral Verification: Simulate authenticated user and verify RLS enforcement
do $$
declare
  v_u1 uuid := 'c3111111-1111-4111-8111-111111111111';
  v_u2 uuid := 'c3222222-2222-4222-8222-222222222222';
  v_f1 uuid := 'c3f11111-1111-4111-8111-111111111111';
  v_row_count integer;
begin
  -- Setup test users in auth.users
  insert into auth.users (id, aud, role, email)
  values
    (v_u1, 'authenticated', 'authenticated', 'c3_u1@test.local'),
    (v_u2, 'authenticated', 'authenticated', 'c3_u2@test.local')
  on conflict (id) do nothing;

  -- Test fazendas insert with created_by = auth.uid()
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Insert fazenda as u1
  insert into public.fazendas (id, nome, created_by, client_id, client_op_id, client_recorded_at)
  values (v_f1, 'Fazenda C3 Test', v_u1, 'test', gen_random_uuid(), now());

  -- Verify user_settings self access
  insert into public.user_settings (user_id, theme, date_format, number_format, notifications, sync_prefs, client_id, client_op_id, client_recorded_at)
  values (v_u1, 'system', 'DD/MM/YYYY', '1.234,56', '{}'::jsonb, '{}'::jsonb, 'test', gen_random_uuid(), now());

  select count(*) into v_row_count from public.user_settings where user_id = v_u1;
  if v_row_count <> 1 then
    raise exception 'user_settings self SELECT failed';
  end if;

  -- Verify app_superadmins
  insert into public.app_superadmins (user_id, created_by)
  values (v_u1, v_u1);

  select count(*) into v_row_count from public.app_superadmins where user_id = v_u1;
  if v_row_count <> 1 then
    raise exception 'app_superadmins self SELECT failed';
  end if;

  -- Setup user_fazendas for u1 and u2 on f1
  insert into public.user_fazendas (fazenda_id, user_id, role, client_id, client_op_id, client_recorded_at)
  values
    (v_f1, v_u1, 'owner', 'test', gen_random_uuid(), now()),
    (v_f1, v_u2, 'cowboy', 'test', gen_random_uuid(), now());

  -- Verify user_fazendas self and related
  select count(*) into v_row_count from public.user_fazendas where fazenda_id = v_f1;
  if v_row_count < 2 then
    raise exception 'user_fazendas related SELECT failed';
  end if;

  -- Setup user_profiles
  insert into public.user_profiles (user_id, display_name, locale, timezone, can_create_farm, client_id, client_op_id, client_recorded_at)
  values
    (v_u1, 'User One', 'pt-BR', 'America/Sao_Paulo', true, 'test', gen_random_uuid(), now()),
    (v_u2, 'User Two', 'pt-BR', 'America/Sao_Paulo', false, 'test', gen_random_uuid(), now());

  select count(*) into v_row_count from public.user_profiles where user_id in (v_u1, v_u2);
  if v_row_count <> 2 then
    raise exception 'user_profiles related SELECT failed';
  end if;

  -- Setup animal and evento for eventos_ecc probe
  insert into public.animais (id, fazenda_id, identificacao, sexo, client_id, client_op_id, client_recorded_at)
  values ('c3a11111-1111-4111-8111-111111111111', v_f1, 'BR-C3-1', 'F', 'test', gen_random_uuid(), now());

  insert into public.eventos (id, fazenda_id, occurred_at, dominio, animal_id, client_id, client_op_id, client_recorded_at)
  values ('c3e11111-1111-4111-8111-111111111111', v_f1, now(), 'ecc', 'c3a11111-1111-4111-8111-111111111111', 'test', gen_random_uuid(), now());

  -- Verify eventos_ecc
  insert into public.eventos_ecc (event_id, fazenda_id, animal_id, ecc, client_id, client_op_id, client_recorded_at)
  values ('c3e11111-1111-4111-8111-111111111111', v_f1, 'c3a11111-1111-4111-8111-111111111111', 3.0, 'test', gen_random_uuid(), now());

  select count(*) into v_row_count from public.eventos_ecc where event_id = 'c3e11111-1111-4111-8111-111111111111';
  if v_row_count <> 1 then
    raise exception 'eventos_ecc access failed';
  end if;
end
$$;

select 'C3_AUTH_RLS_INITPLAN_TEST_OK' as result;

rollback;
