\set ON_ERROR_STOP on

begin;

-- ============================================================================
-- C4.1a — Exact Permissive Policy Cleanup Verification Test
-- ============================================================================

-- 1. Structural Verification: Old FOR ALL policies must NOT exist
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and (
      (tablename = 'agenda_itens' and policyname = 'agenda_write_member') or
      (tablename = 'animais' and policyname = 'animais_write_member') or
      (tablename = 'sanitario_casos' and policyname = 'sanitario_casos_write_member')
    );

  if v_count <> 0 then
    raise exception 'Old FOR ALL write policies still exist: count=%', v_count;
  end if;
end
$$;

-- 2. Structural Verification: SELECT policies must remain intact
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and cmd = 'SELECT'
    and (
      (tablename = 'agenda_itens' and policyname = 'agenda_select_member') or
      (tablename = 'animais' and policyname = 'animais_select_member') or
      (tablename = 'sanitario_casos' and policyname = 'sanitario_casos_select_member')
    );

  if v_count <> 3 then
    raise exception 'SELECT policies missing or modified: expected 3, found %', v_count;
  end if;
end
$$;

-- 3. Structural Verification: 9 new specific write policies must exist with exact commands
do $$
declare
  v_rec record;
  v_count integer := 0;
begin
  for v_rec in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'agenda_insert_member', 'agenda_update_member', 'agenda_delete_member',
        'animais_insert_member', 'animais_update_member', 'animais_delete_member',
        'sanitario_casos_insert_member', 'sanitario_casos_update_member', 'sanitario_casos_delete_member'
      )
  loop
    v_count := v_count + 1;

    if v_rec.policyname like '%_insert_%' then
      if v_rec.cmd <> 'INSERT' or v_rec.with_check is null or v_rec.qual is not null then
        raise exception 'Policy % has invalid definition for INSERT', v_rec.policyname;
      end if;
    elsif v_rec.policyname like '%_update_%' then
      if v_rec.cmd <> 'UPDATE' or v_rec.qual is null or v_rec.with_check is null then
        raise exception 'Policy % has invalid definition for UPDATE', v_rec.policyname;
      end if;
    elsif v_rec.policyname like '%_delete_%' then
      if v_rec.cmd <> 'DELETE' or v_rec.qual is null or v_rec.with_check is not null then
        raise exception 'Policy % has invalid definition for DELETE', v_rec.policyname;
      end if;
    end if;
  end loop;

  if v_count <> 9 then
    raise exception 'Expected 9 new write policies, found %', v_count;
  end if;
end
$$;

-- 4. Setup test users and fazendas as admin
do $$
declare
  v_member uuid := 'c4a11111-1111-4111-8111-111111111111';
  v_outsider uuid := 'c4a22222-2222-4222-8222-222222222222';
  v_f1 uuid := 'c4af1111-1111-4111-8111-111111111111';
  v_f2 uuid := 'c4af2222-2222-4222-8222-222222222222';
begin
  -- Setup test users
  insert into auth.users (id, aud, role, email)
  values
    (v_member, 'authenticated', 'authenticated', 'c4_member@test.local'),
    (v_outsider, 'authenticated', 'authenticated', 'c4_outsider@test.local')
  on conflict (id) do nothing;

  -- Setup fazendas
  insert into public.fazendas (id, nome, created_by, client_id, client_op_id, client_recorded_at)
  values
    (v_f1, 'Fazenda Member C4', v_member, 'test', gen_random_uuid(), now()),
    (v_f2, 'Fazenda Other C4', v_outsider, 'test', gen_random_uuid(), now());

  -- Membership: v_member is owner of v_f1; v_outsider is owner of v_f2
  insert into public.user_fazendas (fazenda_id, user_id, role, client_id, client_op_id, client_recorded_at)
  values
    (v_f1, v_member, 'owner', 'test', gen_random_uuid(), now()),
    (v_f2, v_outsider, 'owner', 'test', gen_random_uuid(), now());

  -- Grant DELETE within transaction to test DELETE RLS policies under authenticated role
  execute 'grant delete on public.animais, public.agenda_itens, public.sanitario_casos to authenticated';
end
$$;

-- 5. Switch to role authenticated as MEMBER of f1
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c4a11111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_f1 uuid := 'c4af1111-1111-4111-8111-111111111111';
  v_anim_id uuid := 'c4aa1111-1111-4111-8111-111111111111';
  v_agenda_id uuid := 'c4ab1111-1111-4111-8111-111111111111';
  v_caso_id uuid := 'c4ac1111-1111-4111-8111-111111111111';
  v_cnt integer;
begin
  -- 5.1 INSERT as member
  insert into public.animais (id, fazenda_id, identificacao, sexo, client_id, client_op_id, client_recorded_at)
  values (v_anim_id, v_f1, 'BR-C4-1', 'M', 'test', gen_random_uuid(), now());

  insert into public.agenda_itens (id, fazenda_id, dominio, tipo, status, data_prevista, animal_id, client_id, client_op_id, client_recorded_at)
  values (v_agenda_id, v_f1, 'pesagem', 'pesagem', 'agendado', '2026-09-10', v_anim_id, 'test', gen_random_uuid(), now());

  insert into public.sanitario_casos (id, fazenda_id, animal_id, tipo, status, opened_at, payload, client_id, client_op_id, client_recorded_at)
  values (v_caso_id, v_f1, v_anim_id, 'clinico', 'aberto', now(), '{}'::jsonb, 'test', gen_random_uuid(), now());

  -- 5.2 SELECT as member
  select count(*) into v_cnt from public.animais where id = v_anim_id;
  if v_cnt <> 1 then raise exception 'Member cannot select animal'; end if;

  select count(*) into v_cnt from public.agenda_itens where id = v_agenda_id;
  if v_cnt <> 1 then raise exception 'Member cannot select agenda_item'; end if;

  select count(*) into v_cnt from public.sanitario_casos where id = v_caso_id;
  if v_cnt <> 1 then raise exception 'Member cannot select sanitario_caso'; end if;

  -- 5.3 UPDATE as member
  update public.animais set observacoes = 'Updated by member' where id = v_anim_id;
  update public.agenda_itens set payload = '{"note": "Updated by member"}'::jsonb where id = v_agenda_id;
  update public.sanitario_casos set observacoes = 'Updated by member' where id = v_caso_id;
end
$$;

-- 6. Switch context to OUTSIDER (authenticated, but member of f2, not f1)
select set_config('request.jwt.claim.sub', 'c4a22222-2222-4222-8222-222222222222', true);

do $$
declare
  v_anim_id uuid := 'c4aa1111-1111-4111-8111-111111111111';
  v_agenda_id uuid := 'c4ab1111-1111-4111-8111-111111111111';
  v_caso_id uuid := 'c4ac1111-1111-4111-8111-111111111111';
  v_cnt integer;
begin
  -- 6.1 Outsider cannot SELECT f1 rows
  select count(*) into v_cnt from public.animais where id = v_anim_id;
  if v_cnt <> 0 then raise exception 'Outsider can see animal in f1'; end if;

  select count(*) into v_cnt from public.agenda_itens where id = v_agenda_id;
  if v_cnt <> 0 then raise exception 'Outsider can see agenda_item in f1'; end if;

  select count(*) into v_cnt from public.sanitario_casos where id = v_caso_id;
  if v_cnt <> 0 then raise exception 'Outsider can see sanitario_caso in f1'; end if;

  -- 6.2 Outsider cannot UPDATE f1 rows (0 rows affected)
  update public.animais set observacoes = 'Hacked' where id = v_anim_id;
  update public.agenda_itens set payload = '{"note": "Hacked"}'::jsonb where id = v_agenda_id;
  update public.sanitario_casos set observacoes = 'Hacked' where id = v_caso_id;
end
$$;

-- 7. Switch back to MEMBER to confirm no changes were made and perform DELETE
select set_config('request.jwt.claim.sub', 'c4a11111-1111-4111-8111-111111111111', true);

do $$
declare
  v_anim_id uuid := 'c4aa1111-1111-4111-8111-111111111111';
  v_agenda_id uuid := 'c4ab1111-1111-4111-8111-111111111111';
  v_caso_id uuid := 'c4ac1111-1111-4111-8111-111111111111';
  v_cnt integer;
begin
  select count(*) into v_cnt from public.animais where id = v_anim_id and observacoes = 'Updated by member';
  if v_cnt <> 1 then raise exception 'Animal was modified by outsider'; end if;

  -- 7.1 DELETE as member
  delete from public.sanitario_casos where id = v_caso_id;
  delete from public.agenda_itens where id = v_agenda_id;
  delete from public.animais where id = v_anim_id;

  select count(*) into v_cnt from public.animais where id = v_anim_id;
  if v_cnt <> 0 then raise exception 'Member delete animal failed'; end if;

  select count(*) into v_cnt from public.agenda_itens where id = v_agenda_id;
  if v_cnt <> 0 then raise exception 'Member delete agenda_item failed'; end if;

  select count(*) into v_cnt from public.sanitario_casos where id = v_caso_id;
  if v_cnt <> 0 then raise exception 'Member delete sanitario_caso failed'; end if;
end
$$;

reset role;

select 'C4_1A_EXACT_PERMISSIVE_CLEANUP_TEST_OK' as result;

rollback;
