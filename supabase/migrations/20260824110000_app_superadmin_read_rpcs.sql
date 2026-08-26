-- 20260824110000_app_superadmin_read_rpcs.sql
-- ============================================================================
-- RebanhoSync — Admin Track A2: RPCs Administrativas Globais Read-Only
-- ============================================================================
-- 1. public.admin_get_platform_metrics()
-- 2. public.admin_list_platform_users(search, limit_count, offset_count)
-- 3. public.admin_get_platform_user(_user_id)
-- 4. public.admin_list_platform_farms(search, limit_count, offset_count)
-- 5. public.admin_list_platform_invites(status_filter, search, limit_count, offset_count)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Métricas da plataforma (KPIs globais agregados)
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_platform_metrics()
returns table (
  total_users bigint,
  new_users_30d bigint,
  total_farms bigint,
  total_active_animals bigint,
  pending_valid_invites bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Forbidden: Access denied' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::bigint from auth.users) as total_users,
    (select count(*)::bigint from auth.users where created_at >= (now() - interval '30 days')) as new_users_30d,
    (select count(*)::bigint from public.fazendas where deleted_at is null) as total_farms,
    (select count(*)::bigint from public.animais where deleted_at is null and status = 'ativo') as total_active_animals,
    (select count(*)::bigint from public.farm_invites where deleted_at is null and status = 'pending' and expires_at > now()) as pending_valid_invites;
end;
$$;

revoke all on function public.admin_get_platform_metrics() from public, anon;
grant execute on function public.admin_get_platform_metrics() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Listagem paginada de usuários da plataforma
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_platform_users(
  search text default null,
  limit_count int default 50,
  offset_count int default 0
)
returns table (
  id uuid,
  email text,
  display_name text,
  can_create_farm boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  farms_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_limit int;
  v_offset int;
  v_search text;
begin
  if not public.is_app_admin() then
    raise exception 'Forbidden: Access denied' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(limit_count, 50), 1), 100);
  v_offset := greatest(coalesce(offset_count, 0), 0);
  v_search := nullif(trim(search), '');

  return query
  select
    u.id,
    u.email::text,
    up.display_name,
    coalesce(up.can_create_farm, true) as can_create_farm,
    u.created_at,
    u.last_sign_in_at,
    count(distinct uf.fazenda_id) filter (where uf.deleted_at is null) as farms_count
  from auth.users u
  left join public.user_profiles up on up.user_id = u.id and up.deleted_at is null
  left join public.user_fazendas uf on uf.user_id = u.id
  where (
    v_search is null
    or u.email ilike ('%' || v_search || '%')
    or up.display_name ilike ('%' || v_search || '%')
    or up.phone ilike ('%' || v_search || '%')
  )
  group by u.id, u.email, up.display_name, up.can_create_farm, u.created_at, u.last_sign_in_at
  order by u.created_at desc, u.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_platform_users(text, int, int) from public, anon;
grant execute on function public.admin_list_platform_users(text, int, int) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Detalhes de um usuário da plataforma com memberships
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_platform_user(_user_id uuid)
returns table (
  id uuid,
  email text,
  display_name text,
  phone text,
  can_create_farm boolean,
  is_superadmin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  farms jsonb
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Forbidden: Access denied' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    up.display_name,
    up.phone,
    coalesce(up.can_create_farm, true) as can_create_farm,
    exists(select 1 from public.app_superadmins sa where sa.user_id = u.id) as is_superadmin,
    u.created_at,
    u.last_sign_in_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'fazenda_id', f.id,
          'fazenda_nome', f.nome,
          'role', uf.role,
          'is_primary', uf.is_primary,
          'accepted_at', uf.accepted_at
        ) order by uf.created_at desc
      ) filter (where uf.fazenda_id is not null and uf.deleted_at is null),
      '[]'::jsonb
    ) as farms
  from auth.users u
  left join public.user_profiles up on up.user_id = u.id and up.deleted_at is null
  left join public.user_fazendas uf on uf.user_id = u.id and uf.deleted_at is null
  left join public.fazendas f on f.id = uf.fazenda_id and f.deleted_at is null
  where u.id = _user_id
  group by u.id, u.email, up.display_name, up.phone, up.can_create_farm, u.created_at, u.last_sign_in_at;
end;
$$;

revoke all on function public.admin_get_platform_user(uuid) from public, anon;
grant execute on function public.admin_get_platform_user(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Listagem paginada de fazendas da plataforma
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_platform_farms(
  search text default null,
  limit_count int default 50,
  offset_count int default 0
)
returns table (
  id uuid,
  nome text,
  codigo text,
  municipio text,
  estado text,
  area_total_ha numeric,
  created_at timestamptz,
  owner_id uuid,
  owner_name text,
  owner_email text,
  active_animals_count bigint,
  members_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_limit int;
  v_offset int;
  v_search text;
begin
  if not public.is_app_admin() then
    raise exception 'Forbidden: Access denied' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(limit_count, 50), 1), 100);
  v_offset := greatest(coalesce(offset_count, 0), 0);
  v_search := nullif(trim(search), '');

  return query
  select
    f.id,
    f.nome,
    f.codigo,
    f.municipio,
    f.estado::text,
    f.area_total_ha,
    f.created_at,
    owner_info.owner_id,
    owner_info.owner_name,
    owner_info.owner_email,
    coalesce(animais_agg.active_animals_count, 0)::bigint as active_animals_count,
    coalesce(members_agg.members_count, 0)::bigint as members_count
  from public.fazendas f
  left join lateral (
    select
      uf.user_id as owner_id,
      up.display_name as owner_name,
      u.email::text as owner_email
    from public.user_fazendas uf
    join auth.users u on u.id = uf.user_id
    left join public.user_profiles up on up.user_id = u.id and up.deleted_at is null
    where uf.fazenda_id = f.id
      and uf.role = 'owner'
      and uf.deleted_at is null
    order by uf.is_primary desc, uf.created_at asc
    limit 1
  ) owner_info on true
  left join lateral (
    select count(*)::bigint as active_animals_count
    from public.animais a
    where a.fazenda_id = f.id
      and a.deleted_at is null
      and a.status = 'ativo'
  ) animais_agg on true
  left join lateral (
    select count(*)::bigint as members_count
    from public.user_fazendas uf
    where uf.fazenda_id = f.id
      and uf.deleted_at is null
  ) members_agg on true
  where f.deleted_at is null
    and (
      v_search is null
      or f.nome ilike ('%' || v_search || '%')
      or f.codigo ilike ('%' || v_search || '%')
      or f.municipio ilike ('%' || v_search || '%')
      or owner_info.owner_name ilike ('%' || v_search || '%')
      or owner_info.owner_email ilike ('%' || v_search || '%')
    )
  order by f.created_at desc, f.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_platform_farms(text, int, int) from public, anon;
grant execute on function public.admin_list_platform_farms(text, int, int) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Listagem paginada de convites da plataforma
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_platform_invites(
  status_filter text default null,
  search text default null,
  limit_count int default 50,
  offset_count int default 0
)
returns table (
  id uuid,
  fazenda_id uuid,
  fazenda_nome text,
  invited_by uuid,
  inviter_name text,
  inviter_email text,
  email text,
  phone text,
  role public.farm_role_enum,
  status public.farm_invite_status_enum,
  is_expired boolean,
  token uuid,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_limit int;
  v_offset int;
  v_search text;
  v_status text;
begin
  if not public.is_app_admin() then
    raise exception 'Forbidden: Access denied' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(limit_count, 50), 1), 100);
  v_offset := greatest(coalesce(offset_count, 0), 0);
  v_search := nullif(trim(search), '');
  v_status := nullif(trim(status_filter), '');

  return query
  select
    i.id,
    i.fazenda_id,
    f.nome as fazenda_nome,
    i.invited_by,
    up_inviter.display_name as inviter_name,
    u_inviter.email::text as inviter_email,
    i.email,
    i.phone,
    i.role,
    i.status,
    (i.status = 'pending' and i.expires_at < now()) as is_expired,
    i.token,
    i.expires_at,
    i.created_at
  from public.farm_invites i
  join public.fazendas f on f.id = i.fazenda_id and f.deleted_at is null
  left join auth.users u_inviter on u_inviter.id = i.invited_by
  left join public.user_profiles up_inviter on up_inviter.user_id = i.invited_by and up_inviter.deleted_at is null
  where i.deleted_at is null
    and (
      v_status is null
      or (v_status = 'expired' and i.status = 'pending' and i.expires_at < now())
      or (v_status <> 'expired' and i.status::text = v_status)
    )
    and (
      v_search is null
      or i.email ilike ('%' || v_search || '%')
      or i.phone ilike ('%' || v_search || '%')
      or f.nome ilike ('%' || v_search || '%')
      or up_inviter.display_name ilike ('%' || v_search || '%')
    )
  order by i.created_at desc, i.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_platform_invites(text, text, int, int) from public, anon;
grant execute on function public.admin_list_platform_invites(text, text, int, int) to authenticated, service_role;
