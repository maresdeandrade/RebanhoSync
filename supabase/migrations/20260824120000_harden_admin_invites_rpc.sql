-- 20260824120000_harden_admin_invites_rpc.sql
-- ============================================================================
-- RebanhoSync — Admin Track A2.1: Hardening Read-Only Convites
-- 1. Remoção da coluna token do retorno de admin_list_platform_invites
-- 2. Separação mutuamente exclusiva de status 'pending' (válido) vs 'expired'
-- ============================================================================

drop function if exists public.admin_list_platform_invites(text, text, int, int);

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
    i.expires_at,
    i.created_at
  from public.farm_invites i
  join public.fazendas f on f.id = i.fazenda_id and f.deleted_at is null
  left join auth.users u_inviter on u_inviter.id = i.invited_by
  left join public.user_profiles up_inviter on up_inviter.user_id = i.invited_by and up_inviter.deleted_at is null
  where i.deleted_at is null
    and (
      v_status is null
      or (v_status = 'pending' and i.status = 'pending' and i.expires_at >= now())
      or (v_status = 'expired' and i.status = 'pending' and i.expires_at < now())
      or (v_status not in ('pending', 'expired') and i.status::text = v_status)
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
